# Reference material and mobile polish

This PR translates the approved driver/item/gameplay sheets into the existing procedural Three.js game. It does not claim pixel-identical reproduction of generated concept art.

## Implemented

- Twelve existing chassis keep their separate geometry and rig contracts. Smoothed coachwork, pearl shells, subtle division pinstripes, metallic trim, five-spoke hubs and soft contact shadows replace the louder flat material treatment. Drivers gain shaped chest panels, polished division colors and joint seams; the two hair shapes are removed to match the featureless reference heads.
- Shared procedural cliff, bark, moss, road and roughness textures; eroded island geometry and individual leaf blades; filtered highlights for race and showroom surfaces. Selection portraits use the main GPU context and restore its render state.
- Reference-shaped Loom Mine and Vector Missile models, cyan item cards and round gold tokens. Existing six-item rules and twelve ability mechanics remain connected to their visual effects.
- Analog touch steering with a dead zone, optional edge assistance, independent pointer tracking, cancellation/pause resets and a final-countdown drift hold for rocket starts. Coarse-pointer devices can reduce rendering resolution without changing physics. The simulation catches up through 100 ms frames at its existing 120 Hz timestep.
- Legible dark HUD surfaces, safe-area offsets and portrait/landscape thumb zones. The Canvas compatibility illustration remains readable instead of flipping edge-on.

## Verification

`npm run verify` passes on Node 24.19.0: 74 game/material/FX/rig regression cases, release/offline resource verification, twelve distinct kart meshes with valid rigs, three closed circuits at desktop and mobile detail levels, map-switch resource disposal, and finite mine/missile geometry within projectile bounds.

The first Vercel preview for commit `6661f8173ac82191c46cbec9cc4087c71e4d68da` reached READY. Final-head deployment status is recorded in the PR description.

Hosted Chrome inspection covered desktop character selection and race launch; 390×844 portrait and 844×390 landscape touch layouts; pause/resume; roster changes to Nexus Labs on Stormforge and Vital Helix on Canopy; and ZenFlow power activation changing the touch button to an 18-second cooldown. `responsive-review.html` embeds the real game at selectable CSS viewport sizes. It does not emulate a phone GPU or physical touch hardware.

## Remaining validation

The available browser reports `data-renderer="canvas"` because it has no WebGL context. Browser screenshots therefore validate the compatibility UI/race path, not the new PBR surfaces. Real WebGL shader compilation, visual comparison against the concept sheets, sustained phone FPS/thermal behavior, and physical multi-touch/gamepad play still need device testing before this draft is considered release-ready. There is no claim that a successful build guarantees every future Vercel deployment.

## Review on a WebGL device

Open the preview, choose each division, inspect the showroom, then race each map. Enable Touch controls and Drag steering; steer while holding DRIFT, release to boost, activate an item and POWER. Try a final-countdown drift hold, pause during a held control, resume, change orientation and switch circuits. Confirm every control releases and the HUD stays readable during boost and shield effects. Use `?lowfx` for the existing low-resolution rendering option.
