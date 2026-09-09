# Natural terrain, water and scenery

This follow-up starts from merged PR #18. It preserves racer rigs, powers, controls and circuit paths.

## Changes

- Island tops use the exact cliff-rim equation and sampled boundary, closing the old gaps and overhangs. A tessellated shoulder adds relief while occupied building/tree surfaces retain their established height. Ground receives vertex variation and an independent height texture.
- Blender 4.5 authors three distinct eroded rock meshes with smooth normals and beveled edges: limestone (672 triangles), basalt (634) and river stone (544). The exported geometry ships directly in `natural-stone-data.js`, reused in three instanced batches per map. Mobile uses half as many instances. These are Blender-authored assets, not Tripo output.
- Distant mountain ranges have sloping front/back faces, modeled ridge relief and material lighting instead of vertical silhouette strips.
- Rock strata, wood and plaster use restrained earth tones, roughness and micro-bump. Existing lantern, fabric, foliage and turbine motion is retained.
- Every map has one ocean. The overlapping Canopy sea is removed. Pond and stream ripples use world coordinates so phase does not reset at mesh boundaries. Water uses wave-gradient normals, air-water Fresnel, a GGX solar highlight, analytical sky reflection and distance fog. This is an inexpensive environment approximation, not scene reflection or fluid simulation.
- Sunlight passing through clouds uses optical attenuation. Water shares the sun direction. Waterfall strands have less opaque, less saturated flow variation.
- Canvas rendering explicitly supports the water/waterfall meshes with supplied material parameters. It does not execute the WebGL wave or reflection shader.

## Verification

`npm run blender:stones` executed on Blender 4.5.0 and exported the actual runtime stone meshes. A Cycles stone-kit image and a Cherry overview of actual exported geometry were rendered and inspected. Offline renders approximate browser materials; they do not validate the GLSL shader appearance.

`npm run verify` passed locally and in the Vercel deployment for b3efb1f. The deployed Canopy side view was inspected in Canvas software mode: terrain, modeled mountains and water load; no application error was observed in the captured browser log (one unrelated browser-extension metadata error was present). The actual water factory also passes a software visibility regression test. `tests/natural-world.cjs` checks all three maps at desktop and mobile settings: finite geometry, exact cap-edge alignment, upward normals, three stone batches, instance counts, a single ocean, fog, depth behavior and shared solar/time uniforms. Existing release, racer, power and asset tests remain included.

Reproduce geometry export using `node scripts/render-world-export.cjs cherry /tmp/natural-cherry.json`. The exporter now loads the new terrain modules and the immersion layer, so the export contains the actual new terrain, rocks and water meshes.

## Tripo access blocker

The user reported authorizing code XPJK-BXFR. Resuming the waiting login session returned: `Network access to "https://apiplatform.tripo3d.ai:443" was blocked by policy.` Tripo doctor consequently reports no local API key. No generation was submitted and no credit consumption is claimed. Starting another code flow would not resolve that network block. The requested Tripo integration remains outstanding until the environment permits the authorization callback/API connection. This is not a user refusal or an invalid-code claim.

Physical-phone performance and WebGL appearance have not been validated on this host. The PR remains draft while the requested Tripo integration is blocked.
