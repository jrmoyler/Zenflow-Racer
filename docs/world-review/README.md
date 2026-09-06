# Offline world geometry review

The existing `chase.png` and `overview.png` files are CPU Cycles renders of an earlier Cherry circuit. They are geometry/composition evidence, **not browser screenshots**, and do not show the new Stormforge or Canopy circuits. Materials and lighting are approximated in Blender; animated waterfall shaders, cloud sprites, browser reflections, gameplay effects, karts and UI are not represented.

The exporter now supports all three current circuits and preserves BufferGeometry, vertex colors, normals, material parameters and every instanced transform. It validates that exported geometry and matrices contain only finite values. It also reports nearby nonadjacent centreline sections as a conservative road-clearance screening metric; this is not an exact collision calculation for banked ribbons.

To export each circuit from the repository root:

```sh
node scripts/render-world-export.cjs cherry /tmp/zenflow-cherry.json
node scripts/render-world-export.cjs stormforge /tmp/zenflow-stormforge.json
node scripts/render-world-export.cjs canopy /tmp/zenflow-canopy.json
```

The map defaults to `cherry`. When no output path is supplied, the exporter writes `zenflow-MAP-geometry.json` to the operating system's temporary directory. Do not commit these large intermediate JSON files.

The existing Blender review script reads one fixed input path. To render a selected circuit using that script:

```sh
node scripts/render-world-export.cjs canopy docs/world-review/world-geometry.json
blender -b -t 6 --python scripts/render-world-blender.py
```

That operation replaces the existing `chase.png` and `overview.png` outputs; archive or rename those files if retaining multiple map reviews. The Blender material/light setup remains an approximation and does not automatically reproduce each map's browser atmosphere. The JSON includes map palette metadata for future renderer improvements.
