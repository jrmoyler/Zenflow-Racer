# P0 implementation and release gates

Baseline: main at `5a09544` (merged PR #23). P1 was not started.

**This branch is not a complete P0 certification.** The playable progression loop is implemented; human lap timing, final WebGL visual approval and physical-device certification remain open. Do not label the game finished on the basis of these diagnostics.

## Implemented

- Separate persistent **Zen Credits** wallet. Race tokens still cap at ten, increase speed, are lost on hits and reset per race. Track pickups, magnet pickups and siphoned tokens increment a separate collection counter; recovered tokens do not generate another collection reward.
- Versioned migration inside the existing `zenflow-racer-v2` save. Preserves preferences, original records and previously equipped add-ons. Ward is the starter power. Unknown ownership/builds and invalid numeric values are sanitized.
- Web Locks serialize purchases and rewards across tabs. Each transaction re-reads storage, writes the wallet and receipt together, and only then changes the in-memory wallet. Duplicate finishes and old race IDs cannot pay twice. Starting another race invalidates the previous unsettled race. Quota/storage failure does not produce a spendable in-memory balance. Secure Web Locks support is required for progression; racing remains available if progression storage fails. As a local game this does not claim tamper-proof anti-cheat against manually edited browser storage.
- Garage entries at title, loadout and results. Add-on inventory, tuning, six kart build categories, factory/satin appearance, balance and per-racer equipment. Native dialog keyboard focus and gamepad D-pad/A/B handling. Builds apply at the next grid.
- 24 existing add-ons; three tuning levels (base, −2% cooldown, −4% cooldown). Items and signature powers remain independent.
- Six legal sidegrades; AI chooses from the same categories, level-one add-ons and unchanged base stat rules. AI no longer receives position-dependent speed bonuses. Physical-distance corner lookahead, safe token pursuit and corner braking retain difficulty-dependent decision quality.
- Three geometry extensions with remapped banking and anti-gravity indices. Original track sections and start/finish remain. No global speed, acceleration, drift boost, draft or token-bonus nerfs. Old record keys remain stored; extended-layout records use new keys.
- Results show permanent reward components, tokens collected, wallet, career races/wins, map/racer diversity and next add-on affordability. Retry, Next Circuit, Garage, Change Racer and Main Menu are available.
- Runtime helmet/shoulder proportion profiles for all twenty existing playable GLBs and fallback karts. Braking posture and acceleration compression retain the existing hand constraints and animation nodes. Tires and Aero sidegrades have visible changes; satin finish changes paint roughness.
- `?review=1` telemetry adds player and AI lap splits, circuit revision and collected token counts to the existing physical test reports.

## Economy

Placement rewards for positions 1–12: **120, 100, 85, 75, 65, 55, 50, 45, 40, 35, 30, 25**.
Difficulty bonus: **0%, 20%, 40% of placement**.
Collected tokens: **2 credits each, capped at 60 rewarded pickups**.
Personal best: **25**. Clean race: **25 with zero hits; 10 with one or two hits**.
First circuit completion: **60**. First finish with a racer: **25**.
No streaks, random loot or paid currency. Example: first-place Standard, 19 collected tokens, no hits, personal best and new map/racer = **317 credits**. Maximum configured race payout: **423**.

| Content | Price | Effect |
|---|---:|---|
| Add-on unlock | 180–355 | Existing power, one equipped slot |
| Tuning level 2 / 3 | 180 / 360 | −2% / −4% cooldown from base |
| Tires | 240 | +5% handling, −5% drift charge |
| Motor | 280 | +5% acceleration, −2% top speed |
| Aero | 260 | −8% corner scrub, −3% handling |
| Suspension | 220 | −8% wall impact loss, −5% steering response |
| Energy Core | 300 | −4% signature cooldown, +5% roulette time |
| Armor | 260 | −8% spin duration, +5% weight, −3% acceleration |
| Satin paint | 200 | Appearance only |

## Repeatable timing evidence

`node tools/p0-ai-timing.cjs` executes the actual `stepAI` and `stepRacer`, authored bank/anti-gravity frames and lap gates at 120 Hz. ZenFlow, Standard, one kart, three laps, no items or powers. The same revised physics/AI is used on original and extended geometry to isolate the track change. This is **not a human baseline, field-race benchmark, or fastest legal lap**.

| Circuit | Original mean AI lap | Extended mean AI lap | Increase |
|---|---:|---:|---:|
| Cherry | 31.67 s | 48.76 s | 17.09 s |
| Stormforge | 33.45 s | 50.52 s | 17.07 s |
| Canopy | 31.36 s | 49.02 s | 17.66 s |

Raw splits: `ai-timing.json`. Geometry and sampled nonadjacent road clearance: `track-estimates.json`. Human timing and fastest-legal-lap fields are deliberately not fabricated.

## Visual evidence and limitations

`racers/` contains twenty contact sheets, each with front, rear, left, right, hero, cockpit, chase, sampled drift/boost/victory/spinout and neutral-material views. `hero-lineup.png` and `neutral-lineup.png` compare all twenty. Generated with `node tools/p0-racer-review.cjs` from actual loaded meshes and the actual software renderer. They are geometry diagnostics, **not in-race WebGL screenshots or visual approvals**. The neutral lineup retains some family resemblance, especially rider torsos and related chassis; a final art-direction pass is still needed to meet the strict all-twenty silhouette target.

Blender 4.5 downloaded successfully but its executable crashed with exit 139 even for `--version` and a factory-startup background launch. No new Blender export is claimed. Original GLBs remain intact. The available browser rejected the local game URL with `ERR_BLOCKED_BY_CLIENT`. Final browser screenshots and WebGL visual sign-off remain open unless separately recorded below.

## Remaining P0 acceptance gates

- Competent-human before/after timing, fastest legal laps, and full-field AI/item balance on each circuit.
- Complete scene dressing of the new named driving moments and a tested Stormforge shortcut choice; names and geometry alone do not fulfill these art/route requirements.
- Final rider/kart art direction and all-twenty in-race WebGL QA (clipping, shading, LOD, mobile fallback), including Garage and reward screenshots.
- Modern iPhone/Safari, modern Android/Chrome and lower-end Android/Chrome physical runs: 12 racers, 3 laps, all circuits, all simultaneous controls, lifecycle, install/offline, audio and context recovery. No physical devices are connected to this session. No FPS certification is claimed.

## Verification

Run `npm ci`, `npm test`, `npm run build`, `npm run test:release`, `npm run verify`, `git diff --check`. New tests: economy model/migration, serialized transaction persistence/failures, Garage DOM interactions and circuit geometry. Existing AI test changed to assert equal legal speed rules instead of the removed catch-up multiplier; catalog assertions now use EQUIP.

The complete npm verification pipeline passed during implementation. See `verification.txt` for the final run summary. The Blender startup failure and outstanding visual/device gates remain failures of the full P0 definition, even when automated tests pass.
