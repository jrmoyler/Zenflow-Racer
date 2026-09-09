# Solar atmosphere and living scenery

The sky disc, cloud illumination and directional shadow light now share the same world-space direction in racing, the title scene and the finish ceremony. The sky dome follows the camera without translating its celestial direction. The disc uses a softened edge and limb darkening; forward scattering gives it an atmospheric halo. Existing cloud density occludes it. Its 0.55-degree radius is deliberately slightly exaggerated for phone readability; this is an art-directed atmosphere, not an astronomical simulation. Canvas fallback projects the same direction and draws the disc behind clouds.

Blender 4.5 generates a seamless four-second suspension clip and a 96-triangle pennant. The actual exported positions and interpolated hinge samples ship in `world-motion-data.js`. Each island gets a grounded mast, attached fabric, a crossbar, a suspension hinge, cord and warm paper lantern. There are 23 rigs in Cherry and 32 each in Stormforge and Canopy. Repeated rigid pieces use five instanced batches. Fabric remains individually deformable, pinned at its mast seam. Existing rock, building and road structures remain rigid. Existing turbine, waterfall, weather and bird systems continue to animate.

Shared foliage geometries deform at their tips, preserving stationary crown attachment regions. Fabric uses woven albedo; metal supports use independent micro-bump, roughness and metalness; paper has a warm emissive finish. Existing terrain, wood and road materials retain their surface resources. Anime.js drives a paused eight-second gust envelope through simulation-time `seek`, with no second animation clock. Pausing stops motion. Reduced motion decreases sway, and mobile/low-effects deformation updates at 10 Hz rather than 15 Hz.

## Reproduce

- `npm run blender:world` exports runtime geometry and motion and saves `.tools/living-world.blend`. Run `bash tools/setup-blender.sh` if Blender is absent.
- `npm run verify` includes all existing game/power/asset gates and the new `tests/living-world.cjs`.
- `?review=map&asset=cherry&view=sun` inspects the actual solar direction; replace the map with `stormforge` or `canopy`.
- `node scripts/render-world-export.cjs cherry /tmp/zenflow-solar-geometry.json` exports current real scenery, including instanced rigs, for Blender inspection.
- The Blender world renderer supports `ZENFLOW_WORLD_INPUT`, `ZENFLOW_WORLD_OUTPUT`, `ZENFLOW_WORLD_CAMERA` and `ZENFLOW_WORLD_SAMPLES`. Offline Blender renders approximate browser shading and are not WebGL screenshots.

## Validation and outstanding work

Blender authoring executed successfully on Blender 4.5.0. All three maps pass finite transforms and vertex checks, moving foliage and fabric checks, fixed seam checks, real Anime.js clock advancement, zero-dt pause and timeline replacement. The full release verification passed locally. An offline CPU Cycles overview of exported Cherry geometry was rendered and inspected; it confirms scene placement, not browser solar-shader appearance. The deployed Cherry sun inspection was checked in the supported browser: the disc and halo render at the expected world-space direction. The Canopy trackside inspection also loads the actual terrain, buildings and foliage. That browser uses Canvas software rendering; WebGL shader appearance and physical-phone performance remain unverified.

Tripo CLI doctor found no API key. The selected Tripo skill's browser authorization flow has been started. No generation was submitted, no Tripo credit spend is claimed, and no asset is described as Tripo-generated. The PR remains draft pending this requested integration. Once authorized, generate and inspect one low-poly PBR landmark ornament, prepare it in Blender and integrate it before marking the work complete.

The existing image2threejs character state/spec and their acceptance scores are preserved. `.img2threejs/evidence/living-world-continuation.json` records this separate environmental scope, reference observations, immutable prior hashes and concrete evidence. It does not claim a character reconstruction gate pass.
