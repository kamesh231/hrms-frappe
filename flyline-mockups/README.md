# FlyLine — HTML Mockups

Static, clickable HTML mockups for **FlyLine v1.0** (Vizag → Bhogapuram / VTZ),
derived from `FlyLine_PRD_v4` and `FlyLine_ADR_v2`. Built for handoff to Codex
as a visual + structural reference for the production Next.js build.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```bash
cd flyline-mockups
python3 -m http.server 8080   # then visit http://localhost:8080
```

Start at **`index.html`** — it links every screen.

## Screens → spec map

| File | Route | Spec |
| --- | --- | --- |
| `landing.html` | `flyline.in` | §5.2 Landing — hero, CMS background (ADR-013), search widget, social proof |
| `city.html` | `/vizag-to-bhogapuram` | §5.6 single-page progressive reveal (ADR-003); defaults & toggles (ADR-012); phase gating (ADR-014); AEO/FAQ (§5.3) |
| `shared-timeline.html` | `/t/[token]` | Read-only shared result from signed JWT (ADR-011) |
| `trips.html` | `/trips` | §5.4 My Trips — Clerk phone OTP (ADR-009), referral wallet (ADR-016) |
| `support.html` | `/support` | §5.5 Support — paid-only gate + WhatsApp redirect |
| `whatsapp.html` | — | Claude-generated message layer (ADR-006), all 5 trip phases + inbound redirect (ADR-015) |

## Interactive bits (`city.html`)

The discovery flow runs the real 4-state machine from ADR-003:

`SEARCH → FLIGHTS → CALCULATING → RESULT`

- Click **Show flights**, pick a flight card, watch the 6-step calculating
  animation, then the timeline reveals.
- **Adjust your journey** toggles recalculate the leave-time live (mock math in
  `app.js`, mirrors the timing formula in §5.6 / ADR-012).
- The **MOCKUP CONTROL** bar (top) switches launch phase 1 / 1.5 / 2 to show the
  Share-only → email waitlist → WhatsApp opt-in CTA changes.
- `support.html` has a similar control to flip paid/free access.

## Design system

All tokens are CSS custom properties in `assets/styles.css` under `:root`
(brand blue, leave-by green, airline chip colours, buffer semantics, radii,
shadows). Buffer colour convention used throughout:

- **green** > 20 min · **amber** 10–20 min · **red** < 10 min

## What is mocked vs real

These are **front-end mockups only**. No live APIs. Flight data, traffic,
timing math, JWT tokens, payments, OTP and WhatsApp sends are all faked for
presentation. The structure, copy, states and visual system are intended to be
production-faithful so they can be lifted into the real build.
