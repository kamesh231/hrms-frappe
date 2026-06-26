/* =========================================================================
   FlyLine mockups — discovery flow + reusable timeline result
   - 4-state machine (ADR-003): SEARCH -> FLIGHTS -> CALCULATING -> RESULT
   - Reusable, container-scoped result block so the same toggles + share +
     totals work on the city page AND the read-only /t/[token] shared page
     (PRD §5.6 / Phase 1 edge cases / ADR-011 / ADR-012).
   Mock logic for the prototype, not production timing math.
   ========================================================================= */

(function () {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ----- Mock departure board (AviationStack shape, simplified) ----- */
  const FLIGHTS = [
    { code: "6E 512",  airline: "IndiGo",    cls: "al-indigo",   to: "Hyderabad", dep: "06:15", cutoff: 45, buffer: 18, status: "On time" },
    { code: "AI 543",  airline: "Air India", cls: "al-airindia", to: "Delhi",     dep: "07:40", cutoff: 60, buffer: 12, status: "On time" },
    { code: "SG 231",  airline: "SpiceJet",  cls: "al-spicejet", to: "Bengaluru", dep: "09:25", cutoff: 45, buffer: 8,  status: "Delayed 20m" },
    { code: "QP 1408", airline: "Akasa",     cls: "al-akasa",    to: "Mumbai",    dep: "11:10", cutoff: 45, buffer: 24, status: "On time" },
  ];

  const CALC_STEPS = [
    "Locating Madhurawada on NH-16",
    "Checking live NH-16 traffic (4–5am window)",
    "Looking up airline check-in cutoff",
    "Calculating terminal processing time",
    "Adding your window-shopping buffer",
    "Verifying flight status",
  ];

  /* Baseline component minutes (mock) used by the timing formula (§5.6) */
  const BASE = { cabWait: 8, parkingWalk: 15, checkinQueue: 15, security: 20, gateWalk: 10, browse: 15, safety: 10, travel: 74 };

  /* ===================================================================
     Reusable result block — everything scoped to a `root` element so
     multiple results can live on one page (consolidated prototype).
     =================================================================== */
  function initResult(root) {
    const t = { ownCar: false, parking: "DROPOFF", onlineCheckin: true, cabinOnly: false, browse: true };

    // seed flight from data-flight attribute (shared page) or default to 6E 512
    try { root.__flight = JSON.parse(root.dataset.flight); }
    catch (e) { root.__flight = FLIGHTS[0]; }

    // sync toggle state from the rendered checkboxes
    $$(".js-toggle", root).forEach((el) => {
      t[el.dataset.key] = el.checked;
      el.addEventListener("change", () => {
        t[el.dataset.key] = el.checked;
        if (el.dataset.key === "ownCar") {
          const pc = $(".parking-choice", root);
          if (pc) pc.classList.toggle("hidden", !el.checked);
        }
        recalc();
      });
    });
    $$(".js-park", root).forEach((b) =>
      b.addEventListener("click", () => {
        $$(".js-park", root).forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        t.parking = b.dataset.park;
        recalc();
      })
    );

    const head = $(".adjust-head", root);
    if (head) head.addEventListener("click", () => {
      $(".adjust-body", root).classList.toggle("hidden");
      const c = $(".adjust-caret", root); if (c) c.classList.toggle("open");
    });

    const share = $(".r-share", root);
    if (share) {
      const orig = share.innerHTML;
      share.addEventListener("click", () => {
        // ADR-011: re-sign a JWT from current state on copy
        const link = "https://flyline.in/t/eyJhbGciOiJIUzI1NiJ9..." + Math.random().toString(36).slice(2, 7);
        if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
        share.textContent = "✓ Link copied";
        setTimeout(() => (share.innerHTML = orig), 1800);
      });
    }

    function set(sel, val) { const el = $(sel, root); if (el) el.textContent = val; }

    function recalc() {
      const f = root.__flight || FLIGHTS[0];

      let terminal = BASE.security + BASE.gateWalk + (t.onlineCheckin ? 0 : BASE.checkinQueue);
      if (t.cabinOnly && t.onlineCheckin) terminal = BASE.security + BASE.gateWalk; // skip counter
      const cabWait = t.ownCar ? 0 : BASE.cabWait;
      const parking = (t.ownCar && t.parking === "PARKING") ? BASE.parkingWalk : 0;
      const browse  = t.browse ? BASE.browse : 0;

      const depMin = toMin(f.dep);
      const total  = f.cutoff + terminal + BASE.travel + cabWait + parking + browse + BASE.safety;
      const leave  = depMin - total;
      const arrive = leave + cabWait + parking + BASE.travel;
      const cutoffClose = depMin - f.cutoff;
      const buffer = cutoffClose - arrive;
      const toAirport = cabWait + parking + BASE.travel; // door -> airport

      // hero + totals
      set(".r-leave", to12(fromMin(leave)));
      set(".r-toair", fmtDur(toAirport));
      set(".r-bufferStat", buffer + "m");
      set(".r-total", fmtDur(total)); // home -> departure

      // timeline rows
      set(".r-tlLeave", to12(fromMin(leave)));
      set(".r-tlDrive", fmtDur(BASE.travel));
      set(".r-tlDriveSub", `NH-16, ${BASE.travel} min · ${t.ownCar ? "your car" : "cab"}${cabWait ? " (+" + cabWait + "m wait)" : ""}`);
      set(".r-tlArrive", to12(fromMin(arrive)));
      set(".r-tlCutoff", to12(fromMin(cutoffClose)));
      set(".r-tlAirline", `${f.airline} closes check-in · ${f.cutoff}m before`);
      set(".r-tlTerm", fmtDur(terminal));
      set(".r-tlTermSub", `${terminal} min${t.onlineCheckin ? " · online check-in done" : " · counter check-in"}`);
      set(".r-tlDepart", to12(f.dep));
      set(".r-tlDepartSub", `${f.airline} ${f.code} → ${f.to} · ${f.status}`);

      // buffer bar
      const bar = $(".r-bufferBar", root), fill = $(".r-bufferFill", root), lbl = $(".r-bufferLabel", root);
      if (fill) fill.style.width = Math.max(8, Math.min(100, (buffer / 30) * 100)) + "%";
      if (bar && lbl) {
        if (buffer >= 15) { bar.classList.remove("amber"); lbl.textContent = `${buffer} min buffer — comfortable`; }
        else { bar.classList.add("amber"); lbl.textContent = `${buffer} min buffer — a little tight`; }
      }
    }

    root.__recalc = recalc;
    recalc();
  }

  // init every result block on the page (city + shared)
  $$(".result-block").forEach(initResult);

  /* ===================================================================
     City discovery flow (only runs where the search card exists)
     =================================================================== */
  const origin = $("#origin");
  const showBtn = $("#showFlights");

  if (showBtn) {
    const refreshBtn = () => { showBtn.disabled = !(origin && origin.value.trim().length > 1); };
    if (origin) origin.addEventListener("input", refreshBtn);
    refreshBtn();

    $$(".js-date").forEach((b) =>
      b.addEventListener("click", () => {
        $$(".js-date").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      })
    );

    showBtn.addEventListener("click", () => { renderFlights(); reveal("#flightsStep"); });
  }

  function bufferChip(mins) {
    if (mins > 20) return `<span class="chip chip-green">Leave by · ${mins}m buffer</span>`;
    if (mins >= 10) return `<span class="chip chip-amber">Tight · ${mins}m buffer</span>`;
    return `<span class="chip chip-red">Risky · ${mins}m buffer</span>`;
  }

  function renderFlights() {
    const list = $("#flightsList");
    if (!list) return;
    list.innerHTML = FLIGHTS.map((f, i) => `
      <div class="flight-card" data-i="${i}" role="button" tabindex="0">
        <div class="airline-badge ${f.cls}">${f.code.split(" ")[0]}</div>
        <div class="flight-main">
          <div class="flight-no">${f.airline} ${f.code}</div>
          <div class="flight-route">VTZ → ${f.to}</div>
          <div style="margin-top:8px">${bufferChip(f.buffer)}</div>
        </div>
        <div class="flight-time">
          <div class="t">${to12(f.dep)}</div>
          <div class="muted" style="font-size:12px">${f.status}</div>
        </div>
      </div>`).join("");

    $$(".flight-card", list).forEach((c) => {
      const pick = () => selectFlight(parseInt(c.dataset.i, 10), c);
      c.addEventListener("click", pick);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter") pick(); });
    });
  }

  function selectFlight(i, el) {
    $$(".flight-card").forEach((c) => c.classList.remove("selected"));
    if (el) el.classList.add("selected");
    const chosen = FLIGHTS[i];

    const box = $("#calcSteps");
    if (box) box.innerHTML = CALC_STEPS.map((s) => `<div class="calc-step"><span class="tick">✓</span><span>${s}</span></div>`).join("");
    $("#resultStep") && $("#resultStep").classList.add("hidden");
    reveal("#calcStep");

    const steps = $$("#calcSteps .calc-step");
    let n = 0;
    const advance = () => {
      if (n > 0) { steps[n - 1].classList.remove("active"); steps[n - 1].classList.add("done"); }
      if (n < steps.length) {
        steps[n].classList.add("active");
        steps[n].querySelector(".tick").innerHTML = '<span class="spinner"></span>';
        n++;
        setTimeout(() => { if (n > 0) steps[n - 1].querySelector(".tick").textContent = "✓"; advance(); }, 540);
      } else {
        setTimeout(() => showResult(chosen), 350);
      }
    };
    advance();
  }

  function showResult(flight) {
    $("#calcStep") && $("#calcStep").classList.add("hidden");
    const rs = $("#resultStep");
    if (!rs) return;
    const block = $(".result-block", rs);
    if (block) { block.__flight = flight; block.__recalc(); }
    reveal("#resultStep");
  }

  /* ----- Phase switching (ADR-014 / §5.8) ----- */
  $$(".js-phase").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".js-phase").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const p = b.dataset.phase;
      $("#phase15") && $("#phase15").classList.toggle("hidden", p !== "1.5");
      $("#phase2")  && $("#phase2").classList.toggle("hidden", p !== "2");
    })
  );

  /* ----- helpers ----- */
  function reveal(sel) {
    const el = $(sel);
    if (!el) return;
    el.classList.remove("hidden");
    el.classList.add("step");
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function toMin(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
  function fromMin(min) { min = (min + 1440) % 1440; const h = Math.floor(min / 60); const m = min % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
  function to12(hhmm) { const [h, m] = hhmm.split(":").map(Number); const ap = h < 12 ? "am" : "pm"; const hh = ((h + 11) % 12) + 1; return `${hh}:${String(m).padStart(2, "0")}${ap}`; }
  function fmtDur(mins) { const h = Math.floor(mins / 60), m = mins % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; }
})();
