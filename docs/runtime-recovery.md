# Runtime recovery and renderer verification

PR #7 continues from the existing twelve Blender GLBs. Reference sheets remain review inputs only; no reference-image cards, scenery plates or kart cutouts are used to render gameplay.

## Fixed

- Replaced positional vertex clustering and average-depth triangle sorting with intact authored topology, per-pixel depth testing and near-plane clipping. Close bonnet panels, wheel rims and road surfaces no longer fragment or paint over one another.
- Software rendering now interpolates authored vertex normals and vertex colors, composites transparent effects, and submits one geometry-rasterized bitmap per view. Its raster is bounded at 480 × 320 independently of display DPR.
- Cached typed buffers and math functions reduce allocation and repeated work. A local native-Canvas twelve-GLB comparison measured a median 522 ms for the prior renderer and 229 ms for this implementation, while the new implementation retained more geometry. The single-GLB regression measured about 21 ms locally. These are CPU test measurements, not phone performance claims.
- Paused/results scenes redraw once and then remain still; hidden tabs do no rendering or simulation work. Resize invalidates the still frame. Input and pause/resume remain active.
- The responsive review page displays actual render work separately from animation-frame intervals, plus race state/time and triangle count.

## Verified

`npm run verify` passes locally and in Vercel. Coverage includes actual GLB loading and articulated rigs, attached anatomy, independent materials, shared-geometry cleanup, abilities, mobile inputs, lap progression, all three circuit builds, offline resources, depth occlusion, near clipping, vertex palettes, transparency and mirrored transforms.

Hosted software-renderer measurements in this cloud browser: title scene about 22 ms render work; crowded Cherry grid about 68 ms. Animation callbacks arrive around 1,016 ms apart even on the paused scene that no longer renders. This environment therefore cannot certify physical-device frame rates. The CPU renderer approximates material lighting; WebGL remains the path for PBR materials and full resolution.

The hosted Cherry race advanced through the countdown, accelerated automatically with touch mode, changed position, collected a Signal Burst, activated Time Dilation (19-second cooldown visible), and paused/resumed through an orientation change. [Actual software-rendered race capture](playable-review/software-mobile-race.jpg) shows the geometry and control layout.

The Blender reference-fidelity review remains rejected and stopped. Existing map geometry remains playable but has not passed an exact-reference reconstruction review. This engineering continuation does not alter those visual acceptance records. See [the reference contract](3d-reconstruction/reference-contract.md).
