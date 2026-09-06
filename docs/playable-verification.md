# Playable 3D verification

`npm run verify` passed with the committed twelve GLBs: 8.02 MiB, 561,087 total triangles, all individually below 50,000. Tests parse the shipped GLBs through the actual loader, validate attached anatomy, animate rigs, check material independence, ability cloning, shared geometry disposal, all three circuit builds and offline packaging. Vercel ran the same suite and deployed runtime commit `657dc90cbb00accd9980b77ba74615d92e595663` successfully.

Hosted browser checks exercised title/selection, changing director and circuit, touch race launch, race progression, pause/resume, and portrait/landscape control layouts. The browser has no WebGL; these checks used actual mesh software rendering, which is visibly faceted and slow here. They do not certify WebGL shading or mobile frame rate. Blender review images are actual exported GLB renders, not runtime screenshots.

GitHub Actions run 34060759354 did not start its job: the account is locked due to a billing issue. Vercel verification is independently successful.

Exact-reference fidelity remains unaccepted. The img2threejs three-correction limit was reached; its recorded gate stopped further reconstruction. See `3d-reconstruction/reference-contract.md` for remaining anatomy, panel, rim and camera differences. The existing playable map geometry is retained; this PR does not claim exact reconstruction of the generated map artwork.
