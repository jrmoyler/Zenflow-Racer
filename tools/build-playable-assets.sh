#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Art build only. Vercel ships committed GLBs and never downloads/runs Blender.
blender_bin="${ZENFLOW_BLENDER:-$PWD/.tools/blender-4.5.0-linux-x64/blender}"
if [[ ! -x "$blender_bin" ]]; then bash tools/setup-blender.sh; fi
if [[ ! -d .tools/gltf-tools/node_modules/@gltf-transform/functions ]]; then
  npm install --prefix .tools/gltf-tools @gltf-transform/core@4.2.1 @gltf-transform/functions@4.2.1 @gltf-transform/extensions@4.2.1
fi
node tools/export-kart-rig.cjs
"$blender_bin" --background --threads 4 --python-exit-code 1 --python tools/build-kart-rig-blender.py -- .tools/kart-rig .tools/zenflow-karts.blend
"$blender_bin" --background .tools/zenflow-karts.blend --threads 4 --python-exit-code 1 --python tools/author-playable-karts.py -- .tools/playable-karts.blend
"$blender_bin" --background .tools/playable-karts.blend --threads 4 --python-exit-code 1 --python tools/export-playable-karts.py -- assets/models
node tools/optimize-playable-karts.mjs assets/models
if [[ "${1:-}" == '--review' ]]; then
  "$blender_bin" --background --threads 4 --python-exit-code 1 --python tools/render-playable-karts.py -- assets/models docs/playable-review zenflow
  "$blender_bin" --background --threads 4 --python-exit-code 1 --python tools/render-playable-karts.py -- assets/models docs/playable-lineup --front-only
fi
