/* =========================================================================
   FlyLine mockups — discovery flow interactivity (vanilla JS)
   Drives the 4-state machine described in ADR-003:
   SEARCH -> FLIGHTS -> CALCULATING -> RESULT
   Plus post-result toggle recalculation (ADR-012) and phase switching (ADR-014).
   This is mock logic for the prototype, not production timing math.
   ========================================================================= */

(function () {
  "use strict";

  /* ----- Mock departure board (AviationStack shape, simplified) ----- */
  const FLIGHTS = [
    { code: "6E 512",  airline: "IndiGo",   cls: "al-indigo",   to: "Hyderabad", dep: "06:15", cutoff: 45, buffer: 18, status: "On time" },
    { code: "AI 543",  airline: "Air India", cls: "al-airindia", to: "Delhi",     dep: "07:40", cutoff: 60, buffer: 12, status: "On time" },
    { code: "SG 231",  airline: "SpiceJet",  cls: "al-spicejet", to: "Bengaluru", dep: "09:25", cutoff: 45, buffer: 8,  status: "Delayed 20m" },
    { code: "QP 1408", airline: "Akasa",     cls: "al-akasa",    to: "Mumbai",    dep: "11:10", cutoff: 45, buffer: 24, status: "On time" },
  ];

  const CALC_STEPS = [
    "Locating Madhurawada on NH-16",
    "Checking live NH-16 traffic (4–5am window)",
    "Looking up IndiGo check-in cutoff",
    "Calculating terminal processing time",
    "Adding your window-shopping buffer",
    "Verifying flight status",
  ];

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ----- Search card ----- */
  const origin = $("#origin");
  const showBtn = $("#showFlights");
  let dateChoice = "tomorrow";

  if (showBtn) {
    function refreshBtn() {
      showBtn.disabled = !(origin && origin.value.trim().length > 1);
    }
    if (origin) origin.addEventListener("input", refreshBtn);
    refreshBtn();

    $$(".js-date").forEach((b) =>
      b.addEventListener("click", () => {
        $$(".js-date").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        dateChoice = b.dataset.date;
      })
    );

    showBtn.addEventListener("click", () => {
      renderFlights();
      reveal("#flightsStep");
    });
  }

  /* ----- Flights list ----- */
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

  /* ----- Calculating animation ----- */
  function selectFlight(i, el) {
    $$(".flight-card").forEach((c) => c.classList.remove("selected"));
    if (el) el.classList.add("selected");
    window.__flight = FLIGHTS[i];

    const box = $("#calcSteps");
    if (box) {
      box.innerHTML = CALC_STEPS.map((s) => `
        <div class="calc-step">
          <span class="tick">✓</span><span>${s}</span>
        </div>`).join("");
    }
    $("#resultStep") && $("#resultStep").classList.add("hidden");
    reveal("#calcStep");

    const steps = $$("#calcSteps .calc-step");
    let n = 0;
    const advance = () => {
      if (n > 0) steps[n - 1].classList.remove("active"), steps[n - 1].classList.add("done");
      if (n < steps.length) {
        steps[n].classList.add("active");
        steps[n].querySelector(".tick").innerHTML = '<span class="spinner"></span>';
        n++;
        setTimeout(() => { if (n > 0) steps[n - 1].querySelector(".tick").textContent = "✓"; advance(); }, 540);
      } else {
        setTimeout(showResult, 350);
      }
    };
    advance();
  }

  /* ----- Result + toggle recalculation ----- */
  // Baseline component minutes (mock) for the selected-flight timeline.
  const BASE = {
    cabWait: 8, parkingWalk: 15, checkinQueue: 15,
    security: 20, gateWalk: 10, browse: 15, safety: 10, travel: 74,
  };

  const toggles = { ownCar: false, parking: "DROPOFF", onlineCheckin: true, cabinOnly: false, browse: true };

  function showResult() {
    $("#calcStep") && $("#calcStep").classList.add("hidden");
    reveal("#resultStep");
    recalc();
  }

  function recalc() {
    const f = window.__flight || FLIGHTS[0];
    const t = toggles;
    let terminal = BASE.security + BASE.gateWalk + (t.onlineCheckin ? 0 : BASE.checkinQueue);
    if (t.cabinOnly && t.onlineCheckin) terminal = BASE.security + BASE.gateWalk; // skip counter
    const cabWait  = t.ownCar ? 0 : BASE.cabWait;
    const parking  = (t.ownCar && t.parking === "PARKING") ? BASE.parkingWalk : 0;
    const browse   = t.browse ? BASE.browse : 0;

    const depMin = toMin(f.dep);
    const total  = f.cutoff + terminal + BASE.travel + cabWait + parking + browse + BASE.safety;
    const leave  = depMin - total;
    const arrive = leave + cabWait + parking + BASE.travel;
    const cutoffClose = depMin - f.cutoff;
    const buffer = cutoffClose - arrive;

    $("#leaveTime").textContent = to12(fromMin(leave));
    $("#tlLeave").textContent  = to12(fromMin(leave));
    $("#tlArrive").textContent = to12(fromMin(arrive));
    $("#tlCutoff").textContent = to12(fromMin(cutoffClose));
    $("#tlDepart").textContent = to12(f.dep);
    $("#tlAirline").textContent = `${f.airline} closes check-in · ${f.cutoff}m before`;
    $("#tlDepartSub").textContent = `${f.airline} ${f.code} → ${f.to} · ${f.status}`;
    $("#tlDriveSub").textContent = `NH-16, ${BASE.travel} min · ${t.ownCar ? "your car" : "cab"} ${cabWait ? "(+" + cabWait + "m wait)" : ""}`;
    $("#tlTermSub").textContent = `${terminal} min${t.onlineCheckin ? " · online check-in done" : " · counter check-in"}`;

    const bar = $("#bufferBar");
    const fill = $("#bufferFill");
    const lbl = $("#bufferLabel");
    const pct = Math.max(8, Math.min(100, (buffer / 30) * 100));
    fill.style.width = pct + "%";
    if (buffer >= 15) { bar.classList.remove("amber"); lbl.textContent = `${buffer} min buffer — comfortable`; }
    else { bar.classList.add("amber"); lbl.textContent = `${buffer} min buffer — a little tight`; }
  }

  // wire toggles
  $$(".js-toggle").forEach((el) =>
    el.addEventListener("change", () => {
      const key = el.dataset.key;
      toggles[key] = el.checked;
      if (key === "ownCar") {
        $("#parkingChoice").classList.toggle("hidden", !el.checked);
      }
      recalc();
    })
  );
  $$(".js-park").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".js-park").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      toggles.parking = b.dataset.park;
      recalc();
    })
  );

  const adjHead = $("#adjustHead");
  if (adjHead) adjHead.addEventListener("click", () => {
    $("#adjustBody").classList.toggle("hidden");
    $("#adjustCaret").classList.toggle("open");
  });

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

  /* ----- Share (mock) ----- */
  const shareBtn = $("#shareBtn");
  if (shareBtn) shareBtn.addEventListener("click", () => {
    const link = "flyline.in/t/eyJhbGciOiJI...Sdk9";
    navigator.clipboard && navigator.clipboard.writeText("https://" + link).catch(() => {});
    shareBtn.textContent = "✓ Link copied";
    setTimeout(() => (shareBtn.innerHTML = "🔗 Share this timeline"), 1800);
  });

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
  function to12(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const ap = h < 12 ? "am" : "pm";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${String(m).padStart(2, "0")}${ap}`;
  }
})();
