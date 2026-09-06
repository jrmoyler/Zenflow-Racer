# ZenFlow Racer

Enhanced from the supplied single-file game by six specialist agents and integrated browser review.

## Play
Choose a director and difficulty, then Enter Race. Twelve directors compete across three complete laps. Drift to charge boosts; collect tokens and items.

- Keyboard: W/Up accelerate, S/Down brake/reverse, A/D or arrows steer, Shift/Space drift, E/Ctrl use item, Escape pause.
- Touch: automatic acceleration; steering, brake, drift and item buttons. Touch controls can also be enabled manually.
- Gamepad: triggers accelerate/brake, left stick steer, shoulder buttons drift, X use item, Start pause. Requires a standard-mapped controller/browser.
- Auto throttle is optional on desktop. Fullscreen appears in supported browsers.
- Best times are stored on this device per director and difficulty.

## Install
Open the HTTPS site and use your browser's Install App / Add to Home Screen action (iOS: Safari Share → Add to Home Screen). Desktop and mobile run as an installable web app, not a native executable. Core game files cache for later offline play after the first successful online visit. Online fonts are optional and have system fallbacks.

## Run and deploy
Node 18 or newer. No npm packages need installing.

```sh
npm run dev
npm test
npm run build
```

Vercel uses the checked-in vercel.json configuration. The build outputs dist/. Three r128 is vendored with its MIT license to preserve compatibility with the original renderer. Rendering modules are separated from game rules for ongoing work.

## Improvements
Signed race-distance tracking prevents reverse lap shortcuts. Correct finish ordering, brake priority, source-aware input clearing, pause/visibility lifecycle, remembered settings, record persistence, responsive UI, drift feedback, audio limiting/cleanup, detailed correctly oriented karts, reduced draw calls, improved track geometry, mobile graphics settings, and WebGL recovery.

A Canvas compatibility renderer automatically activates if WebGL is unavailable, using the same physics/AI/items and stabilized road visuals. Normal capable devices use the Three.js 3D circuit.

## Verification and limits
11 Node VM regression cases pass: full forward laps, reverse exploit prevention, braking, pause/countdown, frozen simulation, blur release, finish ranking and result labels. Rendering is stubbed in those tests.
Browser checked: director selection, desktop layout, 390×844 portrait and 844×390 landscape layouts, countdown, acceleration/rank updates, pause/resume, touch button events and mute. This cloud browser has no WebGL, so visual checks exercised Canvas compatibility mode. WebGL track frame math and vehicle construction passed numerical/runtime checks; GPU performance, real-device multi-touch, physical gamepads, PWA install/offline lifecycle and full GPU visual appearance still need hardware verification. Awards, zero bugs and universal device performance are not claimed.
