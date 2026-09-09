# Wave 2 corrective modeling ledger

The uploaded WAVE2_CHASSIS_SPEC.md authorizes eight new playable chassis, using the same dressed race pilot and articulation. Existing reference sheets are coachwork targets; the older blue bare driver image is superseded by the explicit dressed-pilot contract. No individual Wave 2 hero JPGs were supplied, so these are authored interpretations of the eight written component inventories, not exact image likenesses.

## Preserved pipeline
The mandatory forge/next.py was run against existing .img2threejs/vehicle/state.json. It reports an unavailable spec at an expired workspace path. The original state and rejection history are retained byte-for-byte. They are not reset or marked accepted. Current step: tier1-diagnostics; pass: blockout; recorded corrections: 1.

Prior state/spec SHA-256:
{
  "state.json": "188a1afae3edd249cc59cb255eb190fadb89e0f692b10bcf44e45dbb8f2ce6cf",
  "spec.json": "e85523deffb48065845546ec8fae04057494299523f4f104a7e9f6bb0ff56672"
}

## Changed method and measurable checks
Use eight explicit Three.js coachwork families from the written spec, export their live pivot hierarchy, then use actual Blender continuous garment reconstruction, normals, bevels, wheel dishes, and bounded static-mesh decimation. Preserve the original twelve GLBs exactly; export only the eight new models. Check required rig nodes, four wheel local rest positions, all eight clip states, no embedded images, and fewer than 50,000 triangles in every exported GLB. Render each actual GLB in front, side and rear views under fixed studio lighting. New evidence supplements the legacy pipeline without claiming it passed.

Identity targets: Ledger crystal/hex grille/honeycomb; Terra pylon/overpass arches/blue rails; Obsidian sharp canards/carbon shoulders/chevron; Civic soft oval/round lamps/halo hoop; Cognara dual sensor pods/rose ribbon; Gaia leaf fenders/vines/seed pods/one blue trace; Nomad raised arches/knobby tyres/cases/coil springs/luggage rails; Eon closed tourer/infinity rings/spine light. All use official supplied accent values and helmet variants 0–3 across roster indices 12–19.

## Visual correction: Ledger fascia
Actual front/side/rear Cycles inspection found the violet hex grille read as a floating fence: cells at z=-2.02 had no dark enclosure behind them. Corrective method adds a recessed carbon grille plate spanning x=-.54 to+.56, y=.435 to1.015, at z=-2.004 with .07 depth, and a pearl boundary ribbon at z=-2.04. This connects the grid visually into a machined fascia without changing wheels/pilot/rig pivots. Re-export only Ledger, check <50k triangles, then capture all three views again. The old expired-path next.py result remains unchanged; no legacy acceptance scores have been overwritten.

The first backing correction exposed a geometry-adapter issue: shared sculptedPanel triangulates the XZ plane, so an XY grille produced edge strips without a face. The method changed to a closed XY THREE.Shape extrusion with .07 depth and .008 bevel at z=-2.004. This directly authors the correct vertical face; the legacy state was checked again and remains unchanged.
