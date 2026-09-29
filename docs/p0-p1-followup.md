# P0/P1 follow-up review

Baseline: `691bff43247dfe5a7a5a5a5934630ee1cc3e714b` on main, after merged PRs #27, #28 and #29. Four agents reviewed the remaining racer, garage, pacing/map and integration areas. Existing completed work was preserved.

## Fixed defects

- Fitted chassis wheels now use their authored tyre radii; shield animation preserves the fitted chassis envelope. Runtime regressions cover all 40 upgraded chassis and existing pilot articulation/disposal contracts.
- A failed chassis download cannot charge credits or change equipment. Delayed loading stays bound to the original racer. Stale cross-tab purchases no longer display false success receipts.
- Garage now states that Satin paint and visible bolt-on hardware apply to Factory chassis; fitted tiers retain their reference finish, while saved paint is restored on return to Factory and handling sidegrades apply to every tier.
- Add-on cooldown tuning uses one bounded calculation for simulation, Garage, catalog and HUD recharge.
- Canopy's detour now meets the requested 15–20 second extension in deterministic solo AI timing. Its prior personal best records are retained under their original keys; the revised layout uses a new record namespace and telemetry revision.
- Reversing no longer fires false circuit landmark announcements on any map.
- Cutscene Tab navigation stays on Skip. The fading overlay becomes inert immediately, then becomes interactive on reuse.

## Pacing evidence

Actual Standard ZenFlow AI/physics, three laps, 120 Hz, no items/opponents. These are simulated driving measurements, not human laps or phone performance.

| Circuit | Original mean lap | Revised mean lap | Added |
| --- | ---: | ---: | ---: |
| Cherry | 32.73 s | 48.84 s | 16.11 s |
| Stormforge | 33.54 s | 50.41 s | 16.87 s |
| Canopy | 31.14 s | 46.66 s | 15.52 s |

`tools/p0-ai-timing.cjs` now rejects extensions outside 15–20 seconds. Raw laps are in `p0-finalization/ai-timing.json`. Canopy token placement was adjusted to preserve corner clearance. Circuit geometry and all-map desktop/mobile runtime assertions cover the changed route.

## Device and visual status

- **Samsung Galaxy A15: passed, user-reported** in this task. No device model identifier, OS/browser version, build SHA, FPS log or recording was supplied. Preserve the report without manufacturing those details; it does not certify these subsequent code changes on hardware.
- New rendered UI QA could not run here: local Playwright has no Chromium executable; the cloud browser rejects `http://127.0.0.1:4173` with `ERR_BLOCKED_BY_CLIENT`. No new screenshots, WebGL appearance approval or console-clean browser claim is made.
- Existing reference packs and 60 shipped chassis are preserved. Nine Nightfall models still have fused/static tyres, and fitted tier atlases do not separate paint from rider/rubber. Exact-reference art acceptance remains open. Factory hardware visuals and all tier handling effects remain intact.
- Human fastest legal lap/risk-reward review, listening checks and other physical platform certification are not replaced by simulation tests. Historical reports remain historical.

## Validation

`npm run verify`: PASS (exit 0): regressions, production build, offline release shell, all-map runtime, shipped assets. After the final Garage copy adjustment, Garage regressions, production build and release-shell validation passed again.

`node tools/p0-ai-timing.cjs`, `npm run test:balance` and `npm run test:difficulty`: PASS. All nine map/difficulty field cases pass. The updated Canopy solo difficulty means are 49.206 / 46.688 / 45.350 seconds with identical base speed, acceleration and handling across levels. `git diff --check`: PASS. No remote CI result is inferred from local success.
