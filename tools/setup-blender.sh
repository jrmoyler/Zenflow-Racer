#!/usr/bin/env bash
set -euo pipefail
# Optional offline art/review tool; never ships to browsers.
blender_root="${ZENFLOW_TOOLS_DIR:-$PWD/.tools}"
mkdir -p "$blender_root"
curl -fL 'https://download.blender.org/release/Blender4.5/blender-4.5.0-linux-x64.tar.xz' -o "$blender_root/blender-4.5.0.tar.xz"
tar -xf "$blender_root/blender-4.5.0.tar.xz" -C "$blender_root"
"$blender_root/blender-4.5.0-linux-x64/blender" --version
