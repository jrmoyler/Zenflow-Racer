# Connected racers, circuit atmosphere and equipment validation

Date: 2026-09-09. Base: `2a0cc902cc4e049819dd53c2fbb3b18963a97d7b`. PR #17.

## Changes and verification

- Original 20 playable GLBs retain their geometry and division identity. Post-animation sleeve deformation constrains gloves to steering grips while shoulder vertices remain fixed. Tests exercise eight states and three steering positions for each rider; victory and spinout intentionally release hands. Shared templates remain immutable.
- Cockpit seat and pedal details batch into two meshes per racer. Loaded karts now have the same contact shadow support as procedural karts. Steering geometry and tyre rotation radius are corrected; showroom root bobbing is removed.
- Three maps use layered sky clouds, real horizon ridge geometry and landmark foundations. Desktop/mobile/LOWFX sky costs are tiered. Map-specific fog no longer gets overwritten every frame.
- Canvas fallback has directional shaded cloud banks. Dynamic sleeve position/normal revisions refresh existing cached arrays, with conservative rig bounds preserved.
- Three generated 1536×1024 WebP illustrations are embedded in map selection only. Each includes a canvas trace of its actual circuit spline. Build tests require all three files to exist and be cached offline; generated files were fully decoded and checked before committing.
- The equipment dock is visible on both character and circuit setup. The dialog avoids automatically opening the phone keyboard. All 24 powers equip and persist per division; equipped badges and accessible cooldown labels are visible.

## Automated results

`npm run verify` passed locally and on Vercel. This includes gameplay regressions, ordered setup, 31 add-on behavior checks covering all 24 powers, UI equipment checks, nine effect checks, release/offline cache checks, map resource disposal and mobile geometry budgets, and actual GLB animation/contact/disposal checks. Software regression also proves that buffer deformation changes rasterized pixels without reallocating topology.

Independent review checked hand-coordinate math and deformation stability, then requested cockpit batching and lower-cost mobile cloud shaders; both recommendations were implemented.

## Browser observations

The deployed PR was exercised with the supported browser, using its software 3D renderer:

- Character selection → equipment dialog; 24 power selections exercised.
- Circuit step → change equipped power → select circuit → race.
- Electric Boost cast from its HUD button: in-race acknowledgement and cooldown observed.
- Pause after casting worked.
- Desktop card art rendered for all three maps, with readable labels and real route outlines.
- Fixed CSS phone portrait (390×844) and landscape (844×390) were inspected through the existing responsive-review page. Phone loadout search/equip/Done worked. Review found flex shrink allowed bottom controls to overlap tall map content; the map showroom now uses natural nonshrinking height.
- The final fallback clouds and connected showroom rider were visible in the phone-sized review.

## Limits and external check status

This cloud browser reports `canvas` / `Software 3D`, not WebGL. It does not validate GPU shader appearance or physical-phone performance. Its slow frame timings are not a mobile hardware benchmark. WebGL visual certification and physical-device performance remain unverified; no exact-reference or app-store-readiness claim is made.

GitHub Actions did not execute: GitHub's check annotation says, “The job was not started because your account is locked due to a billing issue.” Vercel independently executed the same `npm run verify` build command successfully. The workflow is preserved rather than weakened to hide the external block.
