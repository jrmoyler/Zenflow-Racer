# Race venue construction pass

The circuits previously concentrated scenery on distant floating islands. This pass adds the infrastructure of an attended race beside the playable spline, with solid barriers and physical architecture.

## Shipped geometry

Each circuit has six roofed, five-tier spectator stands and three open pit structures with five bays, tyre stacks, equipment benches and workshop lights. Stands use cantilever piers, posts, fascia, stepped seating and individually coloured spectator bodies/heads. The map palette supplies vermilion, industrial ochre or botanical green painted surfaces. Buildings stay outside the full circuit envelope, including neighbouring track sectors.

Sector gantries have lattice trusses, support posts and five physical lamps. The starting grid is painted geometry. Red/ivory kerbs follow the transported road frame. Outer bends have paired chevron strokes and poles; rubber strips darken the corner driving line. Road materials use higher roughness and reduced clearcoat, and road barriers are opaque painted material.

## Measured automated checks

`node tests/immersion-regression.cjs` passes all three circuits:

| Circuit | Grandstands | Pit buildings | Desktop spectators | Corner markers | Instanced batches |
|---|---:|---:|---:|---:|---:|
| Cherry | 6 | 3 | 545 | 16 | 10 |
| Stormforge | 6 | 3 | 557 | 36 | 10 |
| Canopy | 6 | 3 | 545 | 42 | 10 |

The venue adds six spline ribbons beyond those instance batches. Mobile mode reduces seating occupancy to fourteen columns per row instead of twenty-two while retaining every stand and venue feature. Static instance matrices and geometry are created once per map, without per-frame crowd allocations or additional point lights.

Tests check every track sample against expanded building envelopes, finite instance transforms, the mobile population/batch budget, deterministic map rebuilds, and exactly-once disposal of venue geometries and materials. Existing `tests/reference-runtime.cjs` and `tests/webgl-lighting.cjs` also pass.

No reference photographs are inserted into the scenery. This evidence is geometry/resource validation; it is not a claim of physical-device frame rate or exact reference likeness.
