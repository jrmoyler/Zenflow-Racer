# Driver surface and joint correction

Resumed from 7cea5e9 after stream expiry. The images were readable and the installed continuation policy was confirmed in the persistent skill source. Its runtime gate remained active; the skill reader's older text was stale. No state reset or acceptance-threshold change was needed.

The torso now has wider pectoral relief, sloping clavicles, diagonal flank relief and upper/lower-back transitions, sampled at 64 × 72 rather than 48 × 48. A close clay study then exposed apparent gaps at the hips and shoulders plus an open head tip. This led to a second correction: widen and lower the pelvis to overlap the thighs, union a spherical shoulder joint around each existing arm pivot, and cap the head's open boundaries.

[Before/after clay comparison](joint-comparison.jpg) shows the actual GLBs at three angles. `clay/` contains the diagnosis candidate; `joint-final/` contains the current exports. Each manifest records source hashes, camera settings and the explicitly overridden clay material. The older glossy images in this directory belong to the diagnosis candidate. These are Blender geometry studies, not gameplay screenshots. The improved connections are visible in all three views. The standing-reference hands, lower-leg/foot shapes, shoulder segmentation and finer muscle definition remain approximate.

Verification: the new head-boundary regression failed on the prior mesh with **72 open edges**, then passed on all twelve corrected exports. Full `npm run verify` passed after the final rebuild. Rigs, animation, clone isolation, resource disposal and item gates still pass. Download total is **10.32 MiB**, up from 9.05 MiB; the retained anatomy increases the roster's counted triangles from 628,411 to 703,123 (including latent effect geometry). No physical-device performance claim is made.

GitHub's verification jobs for the preceding commit failed with no executed steps and no available job log. Their cause is unresolved; this is separate from passing local verification and the preceding successful Vercel build. No workflow or acceptance gate was removed to hide those failures.

The 0.95 likeness threshold remains unaccepted. GPU gameplay appearance remains unverified in this environment. Original spec/rejection history is unchanged; this direct-modeling correction uses the supported continuation policy.
