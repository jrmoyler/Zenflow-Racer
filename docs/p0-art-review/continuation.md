# P0 art continuation after workspace reset

The workspace reset removed unpushed art changes. This pass reconstructs equivalent runtime refinements from the recorded requirements; it is not a recovery of the exact prior source bytes. These diagnostic images were freshly generated from the restored implementation and the committed GLB assets.

The finishing pass owns the sculpted helmet and torso buffers, broadens the upper suit by 10% in width and 12% in depth, raises the integrated collar to y=1.235 with a 0.06 tube radius, adds tailored chest inserts and vents, replaces the full tire surface with graphite rubber while retaining division-colored rims and hubs, and adds batched rotor/spoke hardware, fixed calipers, and animated cooling vanes. Existing shoulder, hand-contact, head, wheel and state-clip articulation is preserved.

`racers/` contains twelve views for each of the twenty actual loaded rigs. `hero-lineup.png` and `neutral-lineup.png` are exact cropped cells from those sheets. The renderer is CanvasRaceRenderer (CPU): these are geometry and articulation diagnostics, not WebGL lighting, physical-mobile performance evidence, or human visual approval.

The previously documented Blender and Tripo execution failures remain valid. Neither was rerun in this restoration, and no newly generated Blender or Tripo model is claimed. The existing committed Blender-authored GLBs remain the asset source.

Rider macro silhouettes remain too similar across the roster. Helmet attachments, proportions, material treatment and tailored details improve differentiation, but this pass does not establish final rider/kart acceptance or AAA quality. Human approval for riders and karts remains outstanding. The user's approval of the other P0 areas is preserved.

Validation: tests/playable-assets.cjs passes for all twenty shipped GLBs, including shared immutable wheel geometry, instance-owned sculpted torso/helmet geometry, unchanged template buffers, correct owned-geometry disposal, articulated hand contact, and finite animations. tests/reference-runtime.cjs passes all twenty fallback karts and all three maps in desktop/mobile configurations. No fresh physical-device or WebGL visual certification is claimed.
