# Volumetric reconstruction contract

The two driver sheets are construction references, never gameplay backgrounds or stand-in meshes. This PR's reconstruction path uses img2threejs decomposition and contracts to direct Blender geometry authoring. Exported glTF geometry is the playable model; it is not a photograph projected onto a rectangle.

## Observed anatomy

The sheets show 12 faceless, bald, athletic humanoid mannequins. The front and rear views expose pectoral, abdominal, scapular, spinal, hip and calf contours. The joints have narrow recessed/raised collars. There are no hair masses, eyes, glasses, headphones, mouths, shirts or sponsor inscriptions on the body. The original generic skill template included those unrelated features; they were removed before validation.

Measured manually in `drivers-01.png`, ZenFlow crown y≈69, chin y≈121, floor y≈458 gives 389/52≈7.48 head units. Shoulder span≈94px gives 1.8HU; hip span≈64px gives 1.25HU. These are visual measurements, not a scanned physical model. Standing proportions guide the reconstruction, while the existing seated steering-contact rig preserves playable positioning. The anatomy JSON's face coordinates are explicitly **non-observed guide planes** required by the generic schema. They do not authorize creating facial features.

The cranium needs a fuller upper vault and tapered jaw, not a uniform capsule. Pectoral/abdominal masses join continuously into the trunk. Deltoid/bicep, forearm/wrist, thigh/calf and hand surfaces need anatomical taper. Finger contours remain connected to palms. Weld normals and union connected lobes within their own articulation nodes; never fuse wheels, shoulder pivots or ability attachments across moving boundaries.

## Division identity

| Driver | Solid skin albedo | Kart identity |
|---|---|---|
| ZenFlow | #20CFF5 | Cyan teardrop bonnet inset, split white fenders, cyan rings |
| The Collective | #065F46 | Bronze oval grille with vertical bars, emerald bonnet |
| Hybrid Living | #0EA5E9 | Cyan wedge, orange joint seams and coachwork pinstripes |
| Nexus Labs | #FF9E32 | Central orange turbine intake and curved white fins |
| Kinetic Edge | #16A34A | Open suspension, black tyres, green front/rear wings |
| Juris Guard | #C9A84C | Navy armour panels, gold shield nose and bevel trim |
| Signal Velocity | #F43F5E | Long red arrow nose and swept triangular rear fins |
| Binary Loom | #B869F3 | Crossing purple ribbon shells, real negative-space holes |
| Vector Shift | #309DFF | Silver jet wedge, twin tail fins and blue rings |
| Aether Link | #B5451B | Copper-rimmed round nose lens and looped antennas |
| Animus Prime | #22D3EE | Mechanical suspension, white snout, separate hovering drone |
| Vital Helix | #14B8A6 | Teal/orange intertwined rails and looped rear headrest |

All primary white paint uses #F8FBFF. Sheet 1 explicitly supplies trim swatches; sheet 2 colour values are inherited palette identifiers with observed hue agreement, not purported exact pixel inverse-rendering. The individual 3D silhouettes must survive material removal; recolouring one generic chassis does not meet this contract.

## Finish and projection applicability

These references show solid paint, clearcoat and material swatches. The skill explicitly permits solid albedo for flat paint. Raster projection is not applicable: it would bake the sheet's lights, shadows, labels and backgrounds into geometry and contradict the user's request. No photographic texture extraction is claimed. Independent constant roughness fields in `.img2threejs/evidence` document scalar PBR intent; equivalent shader scalar values avoid unnecessary texture memory. Geometry creates relief, real environment lights create highlights and contact shadows. sRGB swatches must convert to linear factors when exporting glTF. Shader roughness and metalness remain independent of albedo.

## Evidence and acceptance

`.img2threejs/spec.json` contains 41 macro/meso/micro components, 12 variant definitions, attachment contracts, repeated wheels/fingers/grille systems, a linked detail inventory and sequential build passes. Strict schema/quality validation passed. That proves the specification's structure only. It does **not** prove fidelity or completed 3D work.

Visual target remains 0.95 with individually critical anatomy, faceless-head, chassis identity, material palette and articulation checks. No exact-replica claim is permitted from the JSON result. Render evidence is required from front, rear, side, three-quarter and grazing-light views. Deterministic diagnostics run before visual acceptance; no fabricated scores or empty placeholder screenshots. Runtime checks must also demonstrate movement, steering/spinning wheels, driver articulation and attached abilities after export.

Kart undersides/cockpit interiors are incompletely visible; source rig dimensions are the explicit construction choice there (confidence≈0.55). Surface reflections cannot uniquely recover material constants. These uncertainties remain limitations instead of being concealed by an exactness claim.

## Recorded correction history

The original exported GLB passed only the orbit noncollapse check (rear/reference area 0.873; side/reference 1.390), proving that it is not a billboard. Its source-image diagnostic did not pass (silhouette IoU 0.1096 with unmatched camera and cockpit occupancy). No visual acceptance followed that failure.

Correction 1 was rejected after its real GLB render showed a floating head and detached chest fragments: a volume remesh had removed open-ended torso/arm surfaces. The rejected render is preserved in `.img2threejs/evidence/correction-01-rejected.png`, and the review is recorded as `refine-code`. Required repair: close anatomical surface boundaries before union and retain distinct articulation groups. The local state tracks this as correction 1 of 3 for blockout (1 of 6 total), with no completed visual passes.

Correction 2 restores the full seated body: neck, trunk, both arms/hands and legs are connected. Orbit noncollapse remains valid (side/reference 1.158; rear/reference 0.931). Source-image diagnostics still fail (IoU 0.2035); differing camera/cockpit occupancy contributes, so the number is not an anatomy score. This correction is recorded as `refine-code` with an estimated 0.6 correspondence, not acceptance. The next bounded refinement addresses saturated bonnet inset, concave dark wheel dishes, continuous front fairings, lower splitter and anatomical surface continuity. Current loop is 2 of 3, and visual pass completion remains zero.

## Final bounded review

The third authored candidate was reviewed using the final optimized GLB rendered in **Blender Cycles CPU**, not a WebGL browser. The render manifest binds images to the actual model SHA-256. Front, side and rear show connected anatomy and occupied steering grips. The bonnet is now deeper blue, wheel dishes are concave/dark, front fairings enclose more of the nose, and the lower splitter has real thickness. The final side/reference and rear/reference silhouette-area ratios are 1.173 and 0.932, so no orbit collapses into a flat plane.

The requested 0.95 correspondence is **not accepted**. The body remains anatomically simplified relative to the reference; head/jaw contours, tyre/rim proportions, front panel/headlight shapes and shoulder/abdominal contour differ. Final Tier 1 IoU is 0.2058 with the previously documented camera/occupancy mismatch; that diagnostic cannot quantify sculpture fidelity reliably, but it does not pass. No Tier 2 acceptance was manufactured. A coarse rejected correspondence estimate of 0.68 is recorded in the final `stop` review, not a validation result.

The reconstruction correction loop is stopped after the third authored candidate (two `refine-code` decisions followed by `stop`). `.img2threejs/evidence/final-state-gate.txt` records the stopped state. Specification validation still passes; visual acceptance, generic part coverage and action-ready acceptance are not marked complete by this pipeline. Separate runtime tests may prove playable articulation, but do not prove visual equivalence. No further geometry corrections are performed under this bounded review.
