#!/usr/bin/env bash
# Rebuild only the eight new chassis. Original twelve binaries remain byte-for-byte.
set -euo pipefail
cd "$(dirname "$0")/.."
blender_bin="${BLENDER_BIN:-$PWD/.tools/blender-4.5.0-linux-x64/blender}"
if [[ ! -x "$blender_bin" ]]; then bash tools/setup-blender.sh; fi
wave2_ids=(ledger terra obsidian civic cognara gaia nomad eon)
node tools/export-kart-rig.cjs .tools/wave2-rig "${wave2_ids[@]}"
"$blender_bin" -b --threads 2 --python-exit-code 1 --python tools/build-kart-rig-blender.py -- .tools/wave2-rig .tools/wave2-karts.blend
"$blender_bin" -b .tools/wave2-karts.blend --threads 2 --python-exit-code 1 --python tools/author-playable-karts.py -- .tools/wave2-authored.blend
"$blender_bin" -b .tools/wave2-authored.blend --threads 2 --python-exit-code 1 --python tools/export-playable-karts.py -- .tools/wave2-models
python3 tools/install-wave2-assets.py
node tests/playable-assets.cjs
if [[ "${1:-}" == '--review' ]]; then
  "$blender_bin" -b --threads 2 --python-exit-code 1 --python tools/render-playable-karts.py -- assets/models docs/wave2-review "${wave2_ids[@]}" --reference-studio
fi
