# Reconstruction review — PR 12

Latest continuation: [driver surface and joint correction](anatomy-pass/README.md), including a new head-boundary regression and three-angle clay evidence. Current roster is 10.32 MiB. The sections below document the preceding 7cea5e9 pass.

This PR continues from merged PR 11. It rebuilds the playable GLBs and authored scenery; no reference image is used as runtime geometry, material, background or billboard.

## Changes

- Division-specific angular noses, swept fins, recessed lamps, shields, mechanical details and rear signatures. Curved ZenFlow/Hybrid fairings use smooth lofts; wheel covers no longer conceal their tire profile.
- All twelve Blender-exported karts retain independent live rigs, articulated arms, full seated anatomy and ability compatibility. Chest and back relief is refined. Shipped models total 9.05 MiB.
- All six world-space items have distinct modeled silhouettes and reference energy colors: red burst, cyan shield, green mine, blue missile, gold pulse and purple cluster.
- Denser planted roadside terraces, larger blossom/leaf coverage, pagoda galleries, cliff strata and the large Stormforge portal enrich the existing three circuits.
- Opt-in inspection URLs render actual assets at fixed cameras and display renderer identity: `?review=kart&asset=zenflow&view=front`, `?review=item&asset=triple`, `?review=map&asset=cherry`. Side and rear views use `view=side` and `view=rear`. Studio/map inspection renders directly without the gameplay postprocessing composer.

## Verification

`npm run verify` passed after the final GLB rebuild: gameplay regression, telemetry, immersion, presentation, WebGL-lighting source contracts, production build, release shell, desktop/mobile geometry/resource checks and actual GLB loading/animation/disposal. The expanded six-item geometry/color test also passed. Source-contract tests do not prove shader execution.

The hosted build at initial PR commit `252c2ca` loaded the actual kart and Cherry circuit inspection views. The browser reported **Canvas software rasterizer**, not WebGL. Cherry reported 135,310 rendered triangles and 169 draws. No application error was observed; the browser extension produced an unrelated metadata error. GPU appearance and physical-device performance are not verified by this environment.

[Final orbit sheet](final-orbits.jpg) re-imports the final ZenFlow and Signal GLBs into Blender Cycles CPU, with front, side and rear views. [Final render manifest](final/render-manifest.json) records source SHA-256 hashes and exact camera settings. These are geometry/material review renders, not gameplay captures. [First-pass roster](candidate-01/lineup.jpg) and its manifests retain the earlier candidate evidence and must not be mistaken for the final GLBs.

## Visual acceptance

**The 0.95 exact-likeness target is not certified.** The new nose/wheel silhouettes and energy palettes are closer to the references. Driver musculature remains simplified; coachwork seams, optical materials and world composition still differ. Rear and underside geometry is inferred. A GPU browser comparison at matching gameplay cameras is outstanding. These limitations remain visible rather than being replaced with an invented similarity score.

The previous `.img2threejs/spec.json` rejection history is unchanged. The skill's audited resume archives the previous quality stop and records explicit authorization plus a new strategy. Quality rejection can now lead to another correction cycle or direct Blender/Three.js work; it is no longer a permanent stop. Safety, access and explicit user-cancellation stops remain respected. The skill update was persisted separately in the personal skills repository and passed 24 state tests plus an independent continuation test.
