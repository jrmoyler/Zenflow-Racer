# Offline world geometry review

The images in this directory are CPU Cycles renders of **the actual `world.js` BufferGeometry and instance transforms**. They are geometry/composition evidence, not screenshots from the browser game. Materials and pastel lighting are approximated in Blender; browser reflection, animated waterfall shaders, gameplay effects, karts and UI are not represented.

- `chase.png`: forward view along the real circuit at normalized distance 0.035.
- `overview.png`: layout overview of the complete floating-island circuit.

The review identified gaps between the moss caps and their cliff rims. The production world now generates both boundaries from the same seeded coordinates. Duplicate canopy vertices now share averaged normals to prevent accidental flat faceting.

To reproduce from the repository root:

```sh
node scripts/render-world-export.cjs
blender -b -t 6 --python scripts/render-world-blender.py
```

The exporter generates `docs/world-review/world-geometry.json` as a temporary intermediate. It is intentionally not retained in the repository. Geometry, vertex colors, custom normals, material parameters and every instance transform are preserved by the exporter. Waterfalls use an approximate static blue material for this review.

The final detail pass replaces the cherry trees' opaque lobe crowns with open, instanced sprays of individually modeled five-petal flowers, plus secondary branch twigs. Desktop uses 590 blossoms per tree; mobile uses 330. Basalt islands now have alternating broken ledge/stratum rings and irregular offset tapers. The latest renders include this pass.
