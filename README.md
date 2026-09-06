# ZenFlow Racer — Three Circuit Edition

Reference-driven floating-island arcade racer with three selectable circuits, twelve distinct division chassis, twelve powers, and six illustrated items. See [abilities](docs/abilities.md), [verification](docs/upgrade-verification.md) and the original visual references in references/.

## Play
Start from the illustrated title menu. Choose Select Division to pick a director, circuit, and difficulty, then Enter Race. The character select shows the selected director's actual race chassis on a 360° holographic turntable: it turns continuously, can be dragged to spin, and the arrow buttons or keyboard arrows step through the roster. Twelve directors compete across three complete laps. Hop then hold to drift and release for a surge boost; tuck in behind rivals for a slipstream; collect tokens and items. Results list best lap and gap to the leader; Next Circuit cycles the three maps.

- Keyboard: W/Up accelerate, S/Down brake/reverse, A/D or arrows steer, Shift/Space drift, E/Ctrl use item, Q director power, Escape pause, R restart (pause/results), M sound.
- Touch: automatic acceleration; steering, brake, drift, item and POWER buttons; vibration on hits where supported. Touch controls can also be enabled manually.
- Gamepad: triggers accelerate/brake, left stick steer, shoulder buttons drift, X use item, Y director power, Start pause. Requires a standard-mapped controller/browser. Rumble on hits and boosts where the browser exposes vibrationActuator.
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

Vercel uses the checked-in vercel.json configuration. The build outputs dist/. Three r128 is vendored with its MIT license to preserve compatibility with the original renderer, GLTFLoader, and EffectComposer. Do not bump the runtime Three version in a Vercel deploy — `outputEncoding` / example postprocessing paths are pinned. Anime.js 4.2.2 animates menus. Rendering modules are separated from game rules for ongoing work.

## Improvements
Signed race-distance tracking prevents reverse lap shortcuts. Correct finish ordering, brake priority, source-aware input clearing, pause/visibility lifecycle, remembered settings, record persistence, responsive UI, drift feedback, audio limiting/cleanup, detailed correctly oriented karts, reduced draw calls, improved track geometry, mobile graphics settings, and WebGL recovery.

A Canvas compatibility renderer automatically activates if WebGL is unavailable, using the same physics/AI/items and stabilized road visuals. Normal capable devices use the Three.js 3D circuit.

## Immersive worlds
Each circuit is a full 3D world you drive through, not a backdrop:

- **Cherry Blossom Skyway** — pagodas, lantern avenues, a pale moon, falling petals, shader waterfalls and ponds.
- **Nexus Stormforge** — ribbed forge portal, turbines, ember weather and lightning in the sky dome.
- **Vital Canopy Run** — conservatories, the ancient tree, bioluminescent caps, circling fauna and a rolling sea.

Weather, pulsing rails and mist are rebuilt with the map and disposed on switch. See [docs/3d-reconstruction/immersion-pass.md](docs/3d-reconstruction/immersion-pass.md).

## Verification and limits
Node/Three regression cases pass: full forward laps, reverse exploit prevention, braking, pause/countdown, frozen simulation, blur release, finish ranking and result labels, plus boost surge, hop-to-drift, slipstream, angle-based wall scrub, lap splits and best lap, AI power and item rules, rubber-band caps, mine cap, results board, Next Circuit, text-field-safe key handling, kart materials, rig animation, Blender clips, race FX pools, and the immersion layer. Rendering is stubbed in those tests.
Browser checked: director selection, desktop layout, 390×844 portrait and 844×390 landscape layouts, countdown, acceleration/rank updates, pause/resume, touch button events and mute. This cloud browser has no WebGL, so visual checks exercised Canvas compatibility mode. WebGL track frame math and vehicle construction passed numerical/runtime checks; GPU performance, real-device multi-touch, physical gamepads, PWA install/offline lifecycle and full GPU visual appearance still need hardware verification. Awards, zero bugs and universal device performance are not claimed.

## Art tools

Anime.js 4.2.2 animates the menus. Three.js r128 stays pinned to preserve original renderer compatibility; EffectComposer, UnrealBloomPass and final gamma conversion are vendored. Distinct power effects use pooled instancing and analytic shader motion informed by the Zukan Arena effect implementation.

Blender 4.5.0 is an optional offline art/review tool; run `bash tools/setup-blender.sh` on Linux to install a portable copy. The img2threejs skill assessment and gated reconstruction evidence are retained in `.img2threejs/vehicle`. These tools are not included in the browser bundle and are not run on Vercel.

## Reference art edition

All nine approved source images are retained in `references/art/`; optimized runtime artwork lives in `assets/art/`. The title screen uses the approved image with real accessible controls, and the six HUD item illustrations use the original atlas. The Circuit Library shows the kart and power reference sheets.

- Cherry Blossom Skyway: floating gardens, temples, waterfall islands, banked anti-gravity segment.
- Nexus Stormforge: separate technical circuit, animated turbines, foundries, cranes and ribbed hangar.
- Vital Canopy Run: separate flowing circuit, conservatories, vine tunnel, ancient tree and turquoise sea.

The actual race uses Three.js geometry with twelve distinct chassis. The images are visual targets; procedural scenery and shaders are not pixel-identical to the rendered concept art. Canvas compatibility mode is a simpler renderer for devices without WebGL.

`npm run verify` includes gameplay/effect regression tests, build/offline checks, and real Three.js geometry/lifecycle checks across all maps and karts. See [docs/reference-review.md](docs/reference-review.md) for visual review and environment limitations.

## Blender chassis workflow

Blender 4.5.0 (installed by `bash tools/setup-blender.sh` into the gitignored `.tools/`) is the animation authoring tool for the twelve division karts. `npm run blender:karts` runs the whole reproducible pipeline headlessly:

1. `node tools/export-kart-rig.cjs` walks the real `buildKart()` hierarchy for every ROSTER division (with today's `vehicles.js` rig: `body` > `pilot` > `torso`/`head`/`arm-l`/`arm-r`, `steering-wheel`, `exhaust-l/r`, `wheel-*` > `spin`, ...) and writes per-kart JSON (node tree, local transforms, local-space meshes, PBR material parameters) to `.tools/kart-rig/`. Three `(x,y,z)` maps to Blender `(x,-z,y)`.
2. `tools/build-kart-rig-blender.py` rebuilds the twelve rigs in Blender (Empties for Groups, meshes with Principled BSDF materials, emission for glow parts, alpha for the pilot) in a 4x3 grid of named collections; contract nodes missing from an in-progress rig get placeholder Empties.
3. `tools/author-kart-clips.py` authors one slotted Action per clip on the named nodes with real Blender keyframes (Bezier/SINE/BACK/BOUNCE easing, anticipation, overshoot, secondary motion, cyclic loops): `idle`, `drive`, `drift`, `boost`, `spinout`, `hit`, `victory`, `defeat`.
4. `tools/export-kart-clips.py` samples the f-curves at 30 fps into additive rest-relative deltas, converts back to the kart's Three frame (with a coordinate round-trip self-check), simplifies redundant keys and writes `kart-clips.js`, which `vehicles.js` layers onto the procedural pose per racer state. The file is plain script so the offline cache precaches it.
5. `tools/render-karts-blender.sh` renders `docs/kart-review/` (a lit three-quarter still per kart and an eight-frame contact sheet per clip). EEVEE is attempted first; on this GPU-less host Blender aborts without EGL, so the driver falls back per process to Cycles CPU with denoising, which is what produced the committed images.

Blender 4.5.0 ran successfully headless in this implementation environment (see `docs/kart-review/README.md` and `render-manifest.json` for the engine, samples and timings). The renders are geometry and animation evidence, not WebGL-identical shading. The older `tools/export-kart-meshes.cjs` / `tools/import-karts-blender.py` pair still exports a flattened world-space mesh lineup for material review. `tests/kart-clips-regression.cjs` guards the generated clip file against the rig contract.
