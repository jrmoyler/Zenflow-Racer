# Audience, terrain and racer finish

Based on main after merged PRs 19 and 20. Existing powers, controls, world reconstruction evidence and the twenty shipping GLBs are preserved.

## Implemented

- Actual Blender 4.5 authoring ran locally. `tools/audience.blend` contains twelve joint-local parts, PBR material definitions and separate retained wave/clap/watch actions. `audience-data.js` contains the exported geometry and sampled Euler clips. The Three.js renderer instances the parts across both seated grandstands and standing promenade visitors: 650 Cherry, 677 Stormforge and 665 Canopy spectators on desktop. Update frequency is bounded to 15 Hz / 10 Hz mobile, independent of rendering; pause and reduced motion freeze animation. These are stylized, low-poly venue characters, not photoreal people.
- Island shoulders receive 1,196 / 1,664 / 1,664 grass, fern and flower clusters on desktop, and half those counts on mobile, in three additional draw batches. They use the existing shared foliage wind system and remain outside the occupied island centers. Existing Blender stonework, water, continuous island caps and landmark architecture remain intact.
- All twenty loaded karts use full-body division paint, secondary trim and colored matte driver suits. Material roles are located through the helmet/stripe nodes, because Blender material indices vary between exports. Template assets stay immutable and per-kart materials remain independently disposable. Procedural fallback liveries also use full-body colors.
- Showroom, card portraits and reconstruction viewer copy circuit hemisphere/sun/rim colors, intensity, direction and environment. Selecting a circuit now updates the world immediately and regenerates portraits. The ACES/sRGB display transform is unchanged. Different viewpoints, shadows, race effects and fog can still produce different pixels; no pixel-identical image guarantee is claimed.
- Fixed the short-desktop setup layout where the roster rail intercepted clicks on Confirm racer. The setup now sizes to its content and scrolls.
- No upgrade/paywall prompt exists in current main or the supplied original HTML. The twenty signatures and 24 equippable powers remain built in, with no purchase gate. README roster counts are corrected.

## Verification

`npm run verify` passed, including all gameplay/add-on tests, release/offline packaging, map geometry and all twenty actual GLB rigs. Final audience/standing-visitor changes also passed `tests/audience.cjs`, all six desktop/mobile map combinations in `tests/natural-world.cjs`, and release/offline rebuilding. New checks cover joint attachment, actual moving instance matrices, pause/reduced motion, standing foot bounds, per-division body paint, and circuit-light direction when the sun target moves.

Actual Chromium 152 WebGL (ANGLE/SwiftShader) review:

- Four shipping karts rendered through the actual loader/material factory: ZenFlow, Nexus, Collective and Ledger (`*-paint.png`). These isolated studies omit the environment map, so they establish geometry and paint rather than final track reflections.
- Audience geometry, expressions, clothing, and clip poses inspected (`audience-rig.png`, `audience-motion.png`). A reversed shirt-normal defect found in the first review was corrected in Blender and re-exported.
- Start → Nexus selection → circuit confirmation → Stormforge live race → pause completed with no page or console errors. `nexus-selection.png` shows the corrected reachable confirmation button.
- All three actual maps rendered (`*-terrain.png`). Those workflow captures use `?lowfx` to bound software rasterization cost. Some were captured before the final standing-visitor addition; current final counts are independently asserted in the map suite.
- `cherry-full-quality.png` uses full WebGL settings, shadows and the final 650-person crowd: 3,715,860 rendered triangles, with no shader/page errors. This is software WebGL, not a physical GPU benchmark.

Physical phone performance and the pre-existing exact reference-fidelity gate remain unverified. Terrain is denser but still stylized procedural scenery. Rejection history and thresholds were not reset or reclassified as accepted; see `continuation.json`.

## Reproduce

Run `npm run blender:audience`, then copy `.tools/audience/audience-data.js` to the project root and `.tools/audience/audience.blend` to `tools/audience.blend`.

Run `node tools/review-audience.cjs` with Playwright installed; optionally set `CHROMIUM_EXECUTABLE` to a local Chromium binary. For circuit inspection run the dev server and open `/?review=map&asset=cherry`, `stormforge`, or `canopy`.
