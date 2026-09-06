# Upgrade verification

Baseline published on main: 2ef4ea889a84c2066397b77b6ef54317b48ea6be. New design is proposed as a draft PR.

## Scope
Actual 3D geometry: floating stratified islands, branching cherry trees with instanced blossoms, bonsai, pagodas, ponds/waterfalls, reflective lilac roadway and cyan rails. Continuous white open cockpit, colored luminous wheels, seated humanoid drivers and two swept-hair silhouettes. Every existing division has a distinct special mechanic/effect; original three-lap race, items, drift, saves and input support remain.

## Evidence
- 34 Node VM/Three.js regression cases cover lap exploits, brake/pause behavior, all twelve powers, cooldown/reset/defenses, bounded finite effect geometry, material disposal and projectile cleanup.
- Browser checks exercised Canvas compatibility mode: director selection, power descriptions, portrait/landscape responsive layouts, controls and pause/race flow. No WebGL context is available in this test browser.
- Blender 4.5 CPU renders in docs/world-review reproduce exported actual Three geometry. These are geometry/composition evidence, not WebGL lighting or shader equivalence.
- Vehicle reconstruction assessment, comparisons and gate evidence are in .img2threejs/vehicle. The visual fidelity gate remains unaccepted: exact image matching, especially anatomy/shell silhouette, has not been demonstrated.
- GLSL programs are authored and geometry/lifetimes tested; final browser GPU shader compilation/performance, physical multi-touch/controllers, and live PWA install still need testing on supported hardware.

## Review boundaries
The original images are references, not gameplay captures. UI preview identifies its concept thumbnail. The unsupported-GPU Canvas renderer is an approximation. No pixel-identical, award-winning or universal zero-bug claim is made. Do not mark this draft visually accepted until the reference comparison and WebGL device checks pass.

## Zukan source inspected
Repository revision e41cef85ec84d9386c604e3b238f1d4a72611288, src/game/render/ElementalVfx.ts: pooled elemental effects, analytic ribbons, instancing and cleanup. The Game.ts entrypoint at that revision throws a restore-placeholder error, so this PR does not claim its runtime integration was complete. Racer effects adapt the verified techniques.
