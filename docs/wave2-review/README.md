# Wave 2 playable chassis

Eight new Blender-authored playable GLBs extend the roster to twenty. The original twelve
binaries are preserved. `WAVE2_CHASSIS_SPEC.md` supplies the new identities, official colors,
stat arrays, uniform, shared pivots and coachwork component inventories. Individual Wave 2
hero JPGs listed in that spec were not attached; these models are interpretations of the
written inventory in the established pearl/carbon racing design language.

| Racer | Primary color | Coachwork identity |
|---|---|---|
| Quantum Ledger | `#8B5CF6` | Short faceted nose, hex-cell grille, honeycomb flanks, low rear cowl |
| Terra Axis | `#2563EB` | Pylon nose, broad arches, blue structural beams, panel seams |
| Obsidian Arc | `#EA580C` | Knife canards, carbon shoulders, chevron, orange slit lamps |
| Civic Core | `#7DD3FC` | Oval nose, round lamps, pill flanks, visible rear halo hoop |
| Cognara Mind | `#E0267E` | Continuous lab shell, dual sensor pods, rose neural ribbon |
| Gaia Synthesis | `#22C55E` | Leaf fenders, vine ribbons, seed pods, one subordinate blue circuit trace |
| Nomad Nexus | `#FBBF24` | Raised arches, case pods, coils, luggage tubes, rubber tread blocks |
| Eon Core | `#06B6D4` | Medical tourer, infinity nose rings, centerline light, smooth rear cowls |

All eight use the fitted charcoal race suit, helmet, mirrored visor, harness, gloves and boots.
The helmet headgear and visor cycle continues indices 12–19. The head mesh is retained inside
the helmet and every item remains parented to the existing animation pivot.

## Rebuild and checks

Run `bash tools/build-wave2-assets.sh --review`. The wrapper exports only the eight requested
IDs, imports them into Blender 4.5, reconstructs the continuous garments, welds/relaxes surfaces,
authors rim dishes/bevels, and applies a measured final mesh budget. It merges only the eight
new manifest entries and rejects bad hashes, image embedding and triangle excess before copying.
Build tooling is not run by Vercel; production serves the committed GLBs.

`node tests/playable-assets.cjs` parses the actual shipping assets through Three r128 GLTFLoader,
creates independent articulated copies, verifies all four wheel rest pivots, applies all eight
shared clips, checks finite transforms, closed head surfaces, complete dressed pilots, independent
FX materials, ghost cloning and shared-geometry-safe disposal. Wave 2 is bounded below 50,000
triangles per kart. `node tests/reference-runtime.cjs` exercises twenty distinct procedural
fallback geometries and animation bindings. Material regressions cover twenty unique liveries.

The earlier `docs/playable-assets.md` count and under-50k claim describe an older revision.
The current original-twelve manifest has higher counts. This PR preserves those assets and
applies the supplied under-50k requirement to all eight newly authored models.

## Visual evidence and limits

Front, side and rear PNGs in this directory come from re-importing the actual GLBs into Blender
Cycles CPU under the same fixed studio rig. `render-manifest.json` records each GLB hash, camera,
render size, sample count and timing. These images are model review evidence, not browser WebGL
screenshots. Exact reference fidelity is not established. Existing img2threejs state, rejected
reviews, thresholds and correction history remain intact; see `continuation-ledger.md`.
