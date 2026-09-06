"""Sample the Blender-authored kart Actions into kart-clips.js (KART_CLIPS runtime format).

    blender --background .tools/zenflow-karts.blend --python-exit-code 1 \
        --python tools/export-kart-clips.py -- kart-clips.js

For every Action tagged by tools/author-kart-clips.py, each slot's f-curves are evaluated at
30 fps over the clip duration. Values are turned into ADDITIVE deltas relative to the rest pose
stored on the reference rig (zf_rest_*), converted from Blender to Three axes
(x, y=z_blender, z=-y_blender; rotation deltas likewise; scale is a magnitude), rounded to
4 decimals and simplified (only keys where the curve changes are kept). The file is plain script
(no JSON fetch) so the offline cache precaches it like any other runtime module.
"""
import bpy, json, sys, os, math, time
from mathutils import Euler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kartrig_common import (FPS, CONTRACT_NODES, CLIP_NAMES, blender_to_three, blender_rot_delta_to_three,
                            blender_scale_delta_to_three, blender_matrix_to_three, three_euler_xyz_from_matrix, find_node)

args = sys.argv[sys.argv.index('--') + 1:]
target = os.path.abspath(args[0] if args else 'kart-clips.js')
REFERENCE = 'zenflow'
TOL = {'position': 4e-4, 'rotation': 1.5e-3, 'scale': 6e-4}
CHANNEL = {'location': 'position', 'rotation_euler': 'rotation', 'scale': 'scale'}
CONVERT = {'position': blender_to_three, 'rotation': blender_rot_delta_to_three, 'scale': blender_scale_delta_to_three}


def r4(v):
    v = round(v, 4)
    return 0.0 if v == 0 else v


def simplify(keys, tol):
    """Greedy linear simplification: drop keys that linear interpolation of the kept neighbours
    reproduces within tol on every axis (the runtime lerps between keys)."""
    if len(keys) <= 2:
        return keys

    def fits(a, b):
        t0, t1 = keys[a][0], keys[b][0]
        for j in range(a + 1, b):
            f = (keys[j][0] - t0) / (t1 - t0)
            for ax in (1, 2, 3):
                if abs(keys[a][ax] + (keys[b][ax] - keys[a][ax]) * f - keys[j][ax]) > tol:
                    return False
        return True

    out, anchor, i = [keys[0]], 0, 2
    while i < len(keys):
        if fits(anchor, i):
            i += 1
        else:
            anchor = i - 1
            out.append(keys[anchor])
            i = anchor + 2
    out.append(keys[-1])
    return out


# --- coordinate self-check on known keys (per-axis remap vs. matrix conjugation) ---------------
for rot in ((.3, 0, 0), (0, .3, 0), (0, 0, .3), (0, 0, -1.2)):
    mb = Euler(rot, 'XYZ').to_matrix()
    via_matrix = three_euler_xyz_from_matrix(blender_matrix_to_three(tuple(tuple(row) for row in mb)))
    via_remap = blender_rot_delta_to_three(rot)
    assert all(abs(a - b) < 1e-6 for a, b in zip(via_matrix, via_remap)), (rot, via_matrix, via_remap)
assert blender_to_three((1, -2, 3)) == (1, 3, 2)
checked = 0
for obj in bpy.data.objects:
    if obj.get('zf_kart') == REFERENCE and obj.get('zf_three_position') is not None and not obj.get('zf_root'):
        back = blender_to_three(tuple(obj['zf_rest_loc']))
        want = tuple(obj['zf_three_position'])
        assert all(abs(a - b) < 1e-4 for a, b in zip(back, want)), (obj.name, back, want)
        checked += 1
assert checked > 10, 'rest-pose round trip needs the reference rig'

clips = {}
stats = []
for act in sorted(bpy.data.actions, key=lambda a: CLIP_NAMES.index(a['zf_clip']) if a.get('zf_clip') in CLIP_NAMES else 99):
    name = act.get('zf_clip')
    if not name:
        continue
    duration = float(act['zf_duration'])
    loop = bool(act['zf_loop'])
    frames = round(duration * FPS)
    assert duration > 0 and frames >= 2, name
    strip = act.layers[0].strips[0]
    tracks = {}
    for slot in act.slots:
        node = slot.name_display
        assert node in CONTRACT_NODES, f"{name}: slot {node} is not a contract node"
        ref = find_node(bpy, REFERENCE, node)
        assert ref is not None, node
        rest = {'location': list(ref['zf_rest_loc']), 'rotation_euler': list(ref['zf_rest_rot']), 'scale': list(ref['zf_rest_scale'])}
        curves = {}
        for fc in strip.channelbag(slot).fcurves:
            if fc.data_path in rest:
                curves.setdefault(fc.data_path, {})[fc.array_index] = fc
        track = {}
        for path, axes in curves.items():
            kind = CHANNEL[path]
            keys = []
            for f in range(frames + 1):
                delta = [axes[i].evaluate(f) - rest[path][i] if i in axes else 0.0 for i in range(3)]
                d = CONVERT[kind](delta)
                keys.append((r4(f / FPS), r4(d[0]), r4(d[1]), r4(d[2])))
            keys = simplify(keys, TOL[kind])
            if any(abs(k[a]) > 0 for k in keys for a in (1, 2, 3)):
                track[kind] = [list(k) for k in keys]
        if track:
            tracks[node] = track
    assert tracks, f"{name}: no animated tracks"
    clips[name] = {'duration': r4(duration), 'loop': loop, 'tracks': tracks}
    stats.append((name, len(tracks), sum(len(v) for t in tracks.values() for v in t.values())))

# --- validation ---------------------------------------------------------------------------------
assert set(clips) >= set(CLIP_NAMES), f"missing clips: {set(CLIP_NAMES) - set(clips)}"
for name, clip in clips.items():
    assert clip['duration'] > 0
    for node, track in clip['tracks'].items():
        assert node in CONTRACT_NODES
        for kind, keys in track.items():
            assert kind in ('position', 'rotation', 'scale') and keys
            for k in keys:
                assert len(k) == 4 and all(math.isfinite(v) for v in k), (name, node, kind, k)
            assert all(keys[i][0] < keys[i + 1][0] for i in range(len(keys) - 1)), (name, node, kind)
            assert keys[0][0] == 0 and abs(keys[-1][0] - clip['duration']) < 1e-6, (name, node, kind)

payload = json.dumps({'version': 1, 'fps': FPS, 'clips': clips}, separators=(',', ':'))
source_blend = os.path.relpath(bpy.data.filepath, os.path.dirname(target)) if bpy.data.filepath else '.tools/zenflow-karts.blend'
header = f"""// ---------- Blender-authored kart animation clips ----------
// GENERATED FILE. Do not hand edit. Produced by tools/export-kart-clips.py (Blender {bpy.app.version_string}, headless) from
// the Actions authored by tools/author-kart-clips.py on the exported runtime rig ({source_blend}).
// Regenerate with:  npm run blender:karts   (or: blender --background {source_blend} --python-exit-code 1 --python tools/export-kart-clips.py -- kart-clips.js)
// Format: version 1, {FPS} fps sampling; every track holds ADDITIVE deltas relative to the node's rest pose as [t, x, y, z]
// (position metres, rotation Euler XYZ radians, scale delta added to 1) in the kart's local Three frame (x right, y up,
// nose toward -z). Keys are sorted by t and only kept where the curve changes; the runtime (vehicles.js sampleKartClip)
// interpolates between them and ignores unknown node names. Clips: {', '.join(f"{n} ({clips[n]['duration']}s{', loop' if clips[n]['loop'] else ''})" for n in clips)}.
"""
text = header + 'const KART_CLIPS=' + payload + ';\n'
assert len(text.encode('utf-8')) < 60 * 1024, f"kart-clips.js too large: {len(text)} bytes"
with open(target, 'w') as fh:
    fh.write(text)
for name, n_tracks, n_keys in stats:
    print(f"  {name:8s} {n_tracks:2d} tracks {n_keys:4d} keys")
print(f"wrote {target}: {len(clips)} clips, {sum(s[1] for s in stats)} tracks, {sum(s[2] for s in stats)} keys, {len(text.encode()) / 1024:.1f} KB")
