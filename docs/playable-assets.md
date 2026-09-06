# Playable Blender assets

The twelve `assets/models/*.glb` files contain actual mesh geometry, PBR materials, and
articulated driver/kart hierarchies. Reference PNGs are not embedded or projected into the
models. They are not billboards or pre-rendered character cards.

## Rebuild

Run `bash tools/build-playable-assets.sh --review` from the repository root. The art build
uses Blender 4.5.0 and glTF Transform 4.2.1, installed under `.tools`. Vercel uses the committed
GLBs; it does not install Blender or perform this art build.

1. Export the existing per-division pivot scaffold through `export-kart-rig.cjs`.
2. Import it into Blender with `build-kart-rig-blender.py`.
3. Author closed continuous torso/limb surfaces, enamel bonnet inserts, variant-specific
   front fairings, concave wheel dishes and bevelled wheel parts in `author-playable-karts.py`.
4. Export named geometry using `export-playable-karts.py`.
5. Apply glTF Transform weld, deduplication and pruning. Empty animation/effect nodes,
   custom extras and local transforms must remain unchanged.
6. Re-import the shipped optimized GLBs into Blender and render the three-angle hero plus
   all twelve divisions in CPU Cycles with `render-playable-karts.py`.

## Runtime contract

- glTF Y-up, Three.js forward `-Z`; roots have no grid offset or baked rotation.
- Duplicate runtime names survive Blender's unique-name requirement in `zf_runtime_name`.
- `zf_visible` retains initially hidden shield/halo/star state; glTF itself has no visibility flag.
- `zf_root` identifies the kart root. The existing `body`, `pilot`, `head`, `arm-l/r`,
  wheel pivot and `spin` hierarchy remains addressable for driving, steering and abilities.
- Geometry is shared between runtime instances. Dynamic materials are cloned independently.
- No Draco/Meshopt decoder is required. No texture images or external image URLs are embedded.
- Lighting is dynamic. Physics keeps the existing gameplay collision body and track logic,
  rather than simulating every decorative triangle.
- Every asset is below 50,000 triangles. The twelve GLBs total 8,411,252 bytes in this revision.
  `assets/models/manifest.json` records individual counts and SHA-256 hashes.

## Verification and limits

The anatomy authoring guard rejects a reconstruction that loses more than 10% of the source
extent on any axis. Actual renders were reviewed after an open-volume remeshing failure was
caught and repaired by closing boundary loops before union. The final torso uses a continuous
anatomical envelope rather than disconnected pectoral/abdominal shells.

`docs/playable-review` is the three-angle ZenFlow review. `docs/playable-lineup` shows all
12 actual imported GLBs. Each render manifest records the source GLB SHA-256. These are
Blender review images, not browser WebGL screenshots.

These assets are authored approximations of the reference sheets. The image2threejs review
has not established exact reference fidelity; several coachwork details and driver anatomy
still differ. The recorded quality gate must not be represented as a passing exact-match test.
