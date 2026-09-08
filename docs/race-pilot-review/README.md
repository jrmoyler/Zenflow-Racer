# Equipped race pilots and cockpit review

This pass follows the user's updated direction: finished racing characters instead of bare metallic figures. It is a deliberate stylized racing-pilot design, not an accepted exact reconstruction of the earlier anatomical reference art.

## Authored changes

- Removed pectoral/abdominal lobes from the runtime scaffold and continuous Blender torso. Added shallow compression folds to a fitted racing suit.
- Woven suit material uses roughness 0.78, metalness 0.02 and zero clearcoat. An initial render revealed inherited clearcoat; it was corrected before the final exports.
- Added full enamel helmet shells, curved mirrored visors, separate dark visor gaskets, division-colored chin guards, cheek rails, ear fasteners and crown markings. Division variants use aero blades, communication pods, crown vents or rear stabilizers, combined with their existing division colors.
- Added shoulder protectors, raised collars, harness straps with stitched edges and a buckle, zippers, side piping, gloves with knuckle protection and racing boots.
- Steering wheels now contain a center hub, spokes, shift paddles, thumb controls, a display and a top center marker. These are geometry parented to the existing steering-wheel rig; no screenshot panels are involved.

## Evidence and limits

The final source is all twelve optimized `assets/models/*.glb`, not the procedural fallback or an intermediate blend. `render-manifest.json` and `lineup/render-manifest.json` record SHA-256 hashes of the actual GLBs imported by Blender, camera positions, lighting/render settings and filenames. ZenFlow has front, side and rear views. The lineup covers every division; `pilot-lineup.jpg` is the consolidated contact sheet. All twelve final source hashes were verified after rendering. Contact-sheet inspection confirms the equipment is present across the roster and no obvious detached helmet/shoulder/glove parts appear in the front views.

Visual inspection of the final ZenFlow front/side/rear confirms a closed helmet/neck connection, gloves seated at the wheel, protective panels attached to the articulated shoulders, and a matte suit under the same studio light. The cyan lower-face component is an intentional rigid chin guard. The original head mesh remains inside the helmet to preserve the animation contract.

`node tests/playable-assets.cjs` passes: all twelve assets load through the real GLTFLoader; required rig nodes, closed head geometry, independent mutable materials, shared immutable geometry, animation, ghost cloning, disposal, equipment presence and helmet/paddle parenting remain valid. Aggregate model payload is 11.77 MiB. Physical-phone performance is not measured by these CPU renders or structural tests.

`orbit-check.json` passes the deterministic multi-angle non-degeneration check; this only confirms volume does not collapse at the side/rear camera, not photorealism or reference likeness.

The prior img2threejs state and rejected reviews remain intact. `continuation.json` records their hashes and the authorized changed method. This pass does not assign a fabricated likeness score or convert the earlier rejection into acceptance.
