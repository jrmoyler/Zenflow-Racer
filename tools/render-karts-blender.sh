#!/usr/bin/env bash
# ZenFlow Racer kart animation pipeline (Blender 4.5, headless). Run from the repository root:
#   node tools/export-kart-rig.cjs && bash tools/render-karts-blender.sh      (npm run blender:karts)
# Steps: build the rig .blend from the export -> author clips -> export kart-clips.js -> render
# docs/kart-review (12-kart lineup + one contact sheet per clip). EEVEE is attempted first for the
# renders; a GPU-less host aborts Blender outright (no EGL), so the fallback is per process to Cycles CPU.
# Environment: ZENFLOW_BLENDER (binary), ZENFLOW_BLENDER_LOGS (log dir), ZENFLOW_RENDER_SAMPLES,
# ZENFLOW_RENDER_FORMAT (WEBP|PNG), ZENFLOW_RENDER_ENGINES (space separated fallback order),
# ZENFLOW_SKIP_RENDER=1 to stop after kart-clips.js.
set -euo pipefail
cd "$(dirname "$0")/.."
BLENDER="${ZENFLOW_BLENDER:-.tools/blender-4.5.0-linux-x64/blender}"
RIG="${ZENFLOW_KART_RIG:-.tools/kart-rig}"
BLEND="${ZENFLOW_KART_BLEND:-.tools/zenflow-karts.blend}"
OUT="${ZENFLOW_KART_REVIEW:-docs/kart-review}"
LOGS="${ZENFLOW_BLENDER_LOGS:-.tools/logs}"
SAMPLES="${ZENFLOW_RENDER_SAMPLES:-40}"
FORMAT="${ZENFLOW_RENDER_FORMAT:-WEBP}"
ENGINES="${ZENFLOW_RENDER_ENGINES:-BLENDER_EEVEE_NEXT CYCLES}"
STEP_TIMEOUT="${ZENFLOW_BLENDER_TIMEOUT:-900}"
mkdir -p "$LOGS" "$OUT"
[ -x "$BLENDER" ] || { echo "Blender not found at $BLENDER (run bash tools/setup-blender.sh or set ZENFLOW_BLENDER)" >&2; exit 2; }
[ -f "$RIG/manifest.json" ] || { echo "No rig export at $RIG (run node tools/export-kart-rig.cjs first)" >&2; exit 2; }

run_blender() { # name, args...
  local name="$1"; shift
  echo "== $name"
  timeout "$STEP_TIMEOUT" "$BLENDER" --background --python-exit-code 1 "$@" > "$LOGS/$name.log" 2>&1 \
    || { local code=$?; echo "   $name failed (exit $code), see $LOGS/$name.log" >&2; return $code; }
  grep -E '^(built|saved|authored|wrote|rendered|render manifest|  [a-z]+ +[0-9]+ tracks)' "$LOGS/$name.log" | sed 's/^/   /' || true
}

run_blender build-kart-rig --python tools/build-kart-rig-blender.py -- "$RIG" "$BLEND"
run_blender author-kart-clips "$BLEND" --python tools/author-kart-clips.py -- "$BLEND"
run_blender export-kart-clips "$BLEND" --python tools/export-kart-clips.py -- kart-clips.js
node -e "const vm=require('node:vm'),c={};vm.createContext(c);vm.runInContext(require('node:fs').readFileSync('kart-clips.js','utf8'),c);const k=vm.runInContext('KART_CLIPS',c);console.log('   kart-clips.js ok: version',k.version,'clips',Object.keys(k.clips).join(','))"
[ "${ZENFLOW_SKIP_RENDER:-0}" = "1" ] && { echo "== render skipped (ZENFLOW_SKIP_RENDER=1)"; exit 0; }

rm -f "$OUT/render-manifest.json"
for mode in lineup sheets; do
  ok=0
  for engine in $ENGINES; do
    if run_blender "render-$mode-$engine" "$BLEND" --python tools/render-karts-blender.py -- "$BLEND" "$OUT" "$engine" "$mode" "$SAMPLES" "$FORMAT"; then
      echo "   $mode rendered with $engine"; ok=1; break
    else
      echo "   $engine unavailable for $mode on this host, trying the next engine" >&2
    fi
  done
  [ "$ok" = 1 ] || { echo "no render engine succeeded for $mode" >&2; exit 1; }
done
du -sh "$OUT" | sed 's/^/   review size: /'
