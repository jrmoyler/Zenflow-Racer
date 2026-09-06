# ZenFlow Racer — Three Circuit Edition

Reference-driven floating-island arcade racer with three selectable circuits, twelve distinct division chassis, twelve powers, and six illustrated items. See [abilities](docs/abilities.md), [verification](docs/upgrade-verification.md) and the original visual references in references/.

## Play
Start from the illustrated title menu. Choose Select Division to pick a director, circuit, and difficulty, then Enter Race. Twelve directors compete across three complete laps. Drift to charge boosts; collect tokens and items.

- Keyboard: W/Up accelerate, S/Down brake/reverse, A/D or arrows steer, Shift/Space drift, E/Ctrl use item, Q director power, Escape pause.
- Touch: automatic acceleration; steering, brake, drift and item buttons. Touch controls can also be enabled manually.
- Gamepad: triggers accelerate/brake, left stick steer, shoulder buttons drift, X use item, Y director power, Start pause. Requires a standard-mapped controller/browser.
- Auto throttle is optional on desktop. Fullscreen appears in supported browsers.
- Best times are stored on this device per circuit, director, and difficulty. Original records migrate to Cherry Blossom Skyway.

## Install
Open the HTTPS site and use your browser's Install App / Add to Home Screen action (iOS: Safari Share → Add to Home Screen). Desktop and mobile run as an installable web app, not a native executable. Core game files cache for later offline play after the first successful online visit. Online fonts are optional and have system fallbacks.

## Run and deploy
Node 24.x. Run `npm ci` to install the pinned Three.js and Anime.js toolchain. Browser runtime dependencies are also vendored for a self-contained release.

```sh
npm run dev
npm test
npm run build
npm run test:release
```

Vercel uses the checked-in vercel.json configuration. The build outputs dist/. Three r128 is vendored with its MIT license to preserve compatibility with the original renderer. Rendering modules are separated from game rules for ongoing work.

## Improvements
Signed race-distance tracking prevents reverse lap shortcuts. Correct finish ordering, brake priority, source-aware input clearing, pause/visibility lifecycle, remembered settings, record persistence, responsive UI, drift feedback, audio limiting/cleanup, detailed correctly oriented karts, reduced draw calls, improved track geometry, mobile graphics settings, and WebGL recovery.

A Canvas compatibility renderer automatically activates if WebGL is unavailable, using the same physics/AI/items and stabilized road visuals. Normal capable devices use the Three.js 3D circuit.

## Verification and limits
34 Node/Three regression cases pass: full forward laps, reverse exploit prevention, braking, pause/countdown, frozen simulation, blur release, finish ranking and result labels. Rendering is stubbed in those tests.
Browser checked: director selection, desktop layout, 390×844 portrait and 844×390 landscape layouts, countdown, acceleration/rank updates, pause/resume, touch button events and mute. This cloud browser has no WebGL, so visual checks exercised Canvas compatibility mode. WebGL track frame math and vehicle construction passed numerical/runtime checks; GPU performance, real-device multi-touch, physical gamepads, PWA install/offline lifecycle and full GPU visual appearance still need hardware verification. Awards, zero bugs and universal device performance are not claimed.

## Art tools

Anime.js 4.2.2 animates the menus. Three.js r128 stays pinned to preserve original renderer compatibility; EffectComposer, UnrealBloomPass and final gamma conversion are vendored. Distinct power effects use pooled instancing and analytic shader motion informed by the Zukan Arena effect implementation.

Blender 4.5.0 is an optional offline art/review tool; run `bash tools/setup-blender.sh` on Linux to install a portable copy. The img2threejs skill assessment and gated reconstruction evidence are retained in `.img2threejs/vehicle`. These tools are not included in the browser bundle.

## Reference art edition

All nine approved source images are retained in `references/art/`; optimized runtime artwork lives in `assets/art/`. The title screen uses the approved image with real accessible controls, and the six HUD item illustrations use the original atlas. The Circuit Library shows the kart and power reference sheets.

- Cherry Blossom Skyway: floating gardens, temples, waterfall islands, banked anti-gravity segment.
- Nexus Stormforge: separate technical circuit, animated turbines, foundries, cranes and ribbed hangar.
- Vital Canopy Run: separate flowing circuit, conservatories, vine tunnel, ancient tree and turquoise sea.

The actual race uses Three.js geometry with twelve distinct chassis. The images are visual targets; procedural scenery and shaders are not pixel-identical to the rendered concept art. Canvas compatibility mode is a simpler renderer for devices without WebGL.

`npm run verify` includes gameplay/effect regression tests, build/offline checks, and real Three.js geometry/lifecycle checks across all maps and karts. See `docs/reference-review.md` for visual review and environment limitations.

## Blender chassis workflow

`node tools/export-kart-meshes.cjs` exports the exact runtime chassis geometry for import using `tools/import-karts-blender.py`. Blender 4.5.0 was downloaded in the implementation environment, but its binary crashed on startup; the system package installer was also blocked by environment privileges. The importer is provided for a working Blender installation; no successful Blender render is claimed from this environment.
