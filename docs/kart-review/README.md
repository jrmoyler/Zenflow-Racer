# Kart animation review (Blender 4.5.0, headless)

Generated 2026-09-06 16:57 UTC by `npm run blender:karts` from `../.tools/zenflow-karts.blend` (built from the live `vehicles.js` rig). Engine actually used: **CYCLES** (CPU), 40 samples with adaptive sampling and OpenImageDenoise, AgX view transform, WEBP quality 90. EEVEE Next and Workbench were attempted first and abort on this host because Blender cannot create an EGL/GPU context (`Couldn't open libEGL.so.1`), so `tools/render-karts-blender.sh` fell back per process to Cycles. Total render time 13.3 min on 4 CPU threads; folder size 801 KB.

## What these images are

- Geometry and animation evidence only: the exact runtime rig hierarchy, local transforms, meshes and PBR parameters exported by `tools/export-kart-rig.cjs`, posed by the same Blender Actions that were sampled into `kart-clips.js`. They are **not** WebGL screenshots: Blender's Principled BSDF, a three-point area-light rig and a dark navy backdrop replace the game's lighting, bloom, canvas liveries and post-processing, so colours and shading differ from the browser. Procedural motion layered by `animateKart()` at runtime (wheel spin, suspension springs, track orientation) is not shown.
- Every kart plays the shared clips through node names, so the twelve stills demonstrate that the animation contract nodes exist on every division chassis.

## Lineup stills (640x480, idle clip frame 20, three-quarter front)

| File | Kart | Size | Render |
|---|---|---|---|
| `kart-zenflow.webp` | zenflow | 19 KB | 38.1 s |
| `kart-collective.webp` | collective | 23 KB | 33.1 s |
| `kart-hybrid.webp` | hybrid | 20 KB | 34.5 s |
| `kart-nexus.webp` | nexus | 23 KB | 34.3 s |
| `kart-kinetic.webp` | kinetic | 23 KB | 33.4 s |
| `kart-juris.webp` | juris | 19 KB | 23.2 s |
| `kart-signal.webp` | signal | 21 KB | 14.8 s |
| `kart-loom.webp` | loom | 19 KB | 15.2 s |
| `kart-vector.webp` | vector | 20 KB | 14.8 s |
| `kart-aether.webp` | aether | 23 KB | 18.8 s |
| `kart-animus.webp` | animus | 21 KB | 26.6 s |
| `kart-helix.webp` | helix | 22 KB | 33.7 s |

## Clip contact sheets (ZenFlow kart, 1280x480, 4x2 frames, left to right then top to bottom)

| File | Clip | Duration | Loop | Frames sampled | Size |
|---|---|---|---|---|---|
| `clip-idle.webp` | idle | 2.0 s | yes | 0, 8, 15, 22, 30, 38, 45, 52 | 68 KB |
| `clip-drive.webp` | drive | 1.0 s | yes | 0, 4, 8, 11, 15, 19, 22, 26 | 68 KB |
| `clip-drift.webp` | drift | 1.2 s | yes | 0, 4, 9, 14, 18, 22, 27, 32 | 70 KB |
| `clip-boost.webp` | boost | 0.8 s | no | 0, 3, 7, 10, 14, 17, 21, 24 | 68 KB |
| `clip-spinout.webp` | spinout | 1.1 s | no | 0, 5, 9, 14, 19, 24, 28, 33 | 69 KB |
| `clip-hit.webp` | hit | 0.6 s | no | 0, 3, 5, 8, 10, 13, 15, 18 | 65 KB |
| `clip-victory.webp` | victory | 2.4 s | yes | 0, 9, 18, 27, 36, 45, 54, 63 | 71 KB |
| `clip-defeat.webp` | defeat | 2.4 s | yes | 0, 9, 18, 27, 36, 45, 54, 63 | 68 KB |

Each frame carries a burned-in label `clip fNN t.tts [loop]`. Looping clips sample eight evenly spaced frames of the cycle; one-shot clips include the final frame so the return to rest is visible.

## Commands (repository root)

```sh
bash tools/setup-blender.sh                       # once: portable Blender 4.5.0 into .tools/
npm run blender:karts                             # export rig -> build .blend -> author clips -> kart-clips.js -> render
# individual steps, as run by tools/render-karts-blender.sh:
node tools/export-kart-rig.cjs .tools/kart-rig
.tools/blender-4.5.0-linux-x64/blender --background --python-exit-code 1 --python tools/build-kart-rig-blender.py -- .tools/kart-rig .tools/zenflow-karts.blend
.tools/blender-4.5.0-linux-x64/blender --background --python-exit-code 1 .tools/zenflow-karts.blend --python tools/author-kart-clips.py -- .tools/zenflow-karts.blend
.tools/blender-4.5.0-linux-x64/blender --background --python-exit-code 1 .tools/zenflow-karts.blend --python tools/export-kart-clips.py -- kart-clips.js
.tools/blender-4.5.0-linux-x64/blender --background --python-exit-code 1 .tools/zenflow-karts.blend --python tools/render-karts-blender.py -- .tools/zenflow-karts.blend docs/kart-review CYCLES lineup 40 WEBP
.tools/blender-4.5.0-linux-x64/blender --background --python-exit-code 1 .tools/zenflow-karts.blend --python tools/render-karts-blender.py -- .tools/zenflow-karts.blend docs/kart-review CYCLES sheets 40 WEBP
```

`ZENFLOW_BLENDER` overrides the binary, `ZENFLOW_RENDER_ENGINES` the fallback order (default `BLENDER_EEVEE_NEXT CYCLES`), `ZENFLOW_RENDER_SAMPLES` / `ZENFLOW_RENDER_FORMAT` the quality, and `ZENFLOW_SKIP_RENDER=1` stops after `kart-clips.js`. Logs go to `.tools/logs/`. `render-manifest.json` records the engine, samples, timings and per-file sizes of the committed images.

## Limitations

- CPU Cycles at 40 samples leaves slight noise after denoising; EEVEE output on a GPU host will look different (bloom, screen-space effects) and is not what is committed here.
- The Blender file is regenerated from the runtime export on every run, so any curve edits made interactively in `.tools/zenflow-karts.blend` must be moved into `tools/author-kart-clips.py` (or the build step skipped) to survive; `.tools/` is gitignored.
- The lineup frames one idle pose per kart; per-division coachwork differences are visible but liveries are flat colours here because the runtime canvas textures are not exported.
- Contact sheets show the ZenFlow kart only (clips are shared by node name); the other karts play the same Actions in the `.blend`.
