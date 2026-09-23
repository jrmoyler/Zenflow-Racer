#!/usr/bin/env python3
"""Fit an image-to-3D kart scan to the ZenFlow Racer runtime contract.

Input: one textured GLB produced from a reference image (single fused mesh).
Output: a compact GLB whose scene is
    root (extras.zf_root, zf_tier, zf_meta)
      chassis            body + pilot, static relative to the sprung body
      wheel-fl/fr/rl/rr  node at the wheel centre, mesh local to that centre
so the runtime can hang the four wheels on spinning/steering pivots.

Frame: Three.js Y-up, forward -Z, ground at y=0, kart length KART_LENGTH.
Textures are re-encoded (JPEG) and an emissive map is derived from the
saturated, bright texels of the base colour so lamps, rim lights and inlays
glow in race lighting exactly where the reference image glows.

Usage: fit-scan-kart.py IN.glb OUT.glb --id zenflow --tier dark [--front +x] [--flip]
"""
import argparse, io, json, struct, sys
import numpy as np
from PIL import Image

KART_LENGTH = 4.5
COLOR_SIZE = 1024
AUX_SIZE = 512
NORMAL_SIZE = 1024


def read_glb(path):
    data = open(path, 'rb').read()
    assert data[:4] == b'glTF'
    off, js, binc = 12, None, None
    while off < len(data):
        length, kind = struct.unpack('<II', data[off:off + 8])
        chunk = data[off + 8:off + 8 + length]
        if kind == 0x4E4F534A: js = json.loads(chunk)
        elif kind == 0x004E4942: binc = chunk
        off += 8 + length
    return js, binc


def accessor(js, binc, index):
    a = js['accessors'][index]
    view = js['bufferViews'][a['bufferView']]
    comps = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a['componentType']]
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = view.get('byteStride', 0)
    item = np.dtype(dtype).itemsize * comps
    if stride and stride != item:
        raw = np.frombuffer(binc, np.uint8, count=stride * a['count'], offset=start).reshape(a['count'], stride)[:, :item]
        arr = np.frombuffer(raw.tobytes(), dtype).reshape(a['count'], comps)
    else:
        arr = np.frombuffer(binc, dtype, count=a['count'] * comps, offset=start).reshape(a['count'], comps)
    return arr.astype(np.float32) if dtype == np.float32 else arr.astype(np.uint32)


def image(js, binc, index):
    img = js['images'][index]
    view = js['bufferViews'][img['bufferView']]
    s = view.get('byteOffset', 0)
    return Image.open(io.BytesIO(binc[s:s + view['byteLength']])).convert('RGB')


def load(path):
    js, binc = read_glb(path)
    prims = [p for m in js['meshes'] for p in m['primitives']]
    assert len(prims) == 1, 'expected one fused primitive'
    p = prims[0]
    pos = accessor(js, binc, p['attributes']['POSITION'])
    nor = accessor(js, binc, p['attributes']['NORMAL'])
    uv = accessor(js, binc, p['attributes']['TEXCOORD_0'])
    idx = accessor(js, binc, p['indices']).reshape(-1, 3)
    # Node transform (Tripo emits identity, but honour it if present).
    node = next(n for n in js['nodes'] if 'mesh' in n)
    if 'matrix' in node:
        m = np.array(node['matrix'], np.float32).reshape(4, 4).T
        pos = pos @ m[:3, :3].T + m[:3, 3]
        nor = nor @ np.linalg.inv(m[:3, :3])
    mat = js['materials'][p.get('material', 0)]
    pbr = mat.get('pbrMetallicRoughness', {})
    tex = lambda t: image(js, binc, js['textures'][t['index']]['source']) if t else None
    return dict(pos=pos, nor=nor, uv=uv, idx=idx,
                color=tex(pbr.get('baseColorTexture')),
                orm=tex(pbr.get('metallicRoughnessTexture')),
                normal=tex(mat.get('normalTexture')))


def orient(pos, nor, front=None, flip=False):
    """Rotate so the long axis is Z with the nose at -Z, Y up, ground at 0."""
    ext = pos.max(0) - pos.min(0)
    if front is None:
        # Longest horizontal axis is the kart's length.
        axis = 0 if ext[0] >= ext[2] else 2
        # The helmet (highest region) sits behind the centre of the wheelbase.
        top = pos[:, 1] > pos[:, 1].max() - ext[1] * .12
        centre = (pos[:, axis].max() + pos[:, axis].min()) / 2
        head = pos[top, axis].mean()
        sign = -1 if head > centre else 1  # nose is on the side away from the helmet
        if flip: sign = -sign
    else:
        axis = 0 if front[1] == 'x' else 2
        sign = 1 if front[0] == '+' else -1
    # Build rotation mapping nose direction -> -Z.
    nose = np.zeros(3); nose[axis] = sign
    target = np.array([0, 0, -1.])
    if np.allclose(nose, target): R = np.eye(3)
    elif np.allclose(nose, -target): R = np.diag([-1., 1., -1.])
    else:
        # Rotation about Y taking nose to -Z.
        a = np.arctan2(nose[0], nose[2]) - np.arctan2(target[0], target[2])
        c, s = np.cos(-a), np.sin(-a)
        R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    pos = pos @ R.T; nor = nor @ R.T
    return pos, nor, dict(axis='xz'[axis // 2], sign=sign)


def find_wheels(pos, tri):
    """Per quadrant: contact patch -> tread width and centre, sidewall -> radius."""
    L = pos[:, 2].max() - pos[:, 2].min()
    ymin = pos[:, 1].min()
    wheels = []
    for zs in (-1, 1):          # front (-z) then rear (+z)
        for xs in (-1, 1):      # left (-x) then right (+x)
            q = (np.sign(pos[:, 0]) == xs) & (np.sign(pos[:, 2] - np.median(pos[:, 2])) == zs)
            pts = pos[q]
            H = pos[:, 1].max() - ymin
            low = pts[pts[:, 1] < ymin + H * .4]
            outer = np.percentile(np.abs(low[:, 0]), 99.7)
            # Outer sidewall band: at that lateral depth only tyre exists, so its
            # extent in the side plane is the tyre disc.
            band = low[np.abs(low[:, 0]) > outer - L * .035]
            band = pts[(np.abs(pts[:, 0]) > outer - L * .035) & (np.abs(pts[:, 2] - np.median(band[:, 2])) < L * .2) & (pts[:, 1] < ymin + H * .55)]
            z0, z1 = np.percentile(band[:, 2], [.5, 99.5]); y0, y1 = band[:, 1].min(), np.percentile(band[:, 1], 99.5)
            zc, yc = (z0 + z1) / 2, (y0 + y1) / 2
            r = ((z1 - z0) / 2 + (y1 - y0) / 2) / 2
            inner = 0
            # Tread: the flat remeshed tread carries vertices mostly at its two
            # shoulders, so find the inner sidewall as the deepest slice (within
            # one radius of the outer face) whose ring at radius r is well populated.
            d = np.hypot(pts[:, 1] - yc, pts[:, 2] - zc)
            ang = ((np.arctan2(pts[:, 1] - yc, pts[:, 2] - zc) + np.pi) / (2 * np.pi) * 24).astype(int) % 24
            shell = (d > r * .6) & (d < r * 1.04)
            step = r * .06; covers = []
            for k in range(int(1.15 / .06)):
                x1 = outer - k * step
                band = shell & (np.abs(pts[:, 0]) <= x1) & (np.abs(pts[:, 0]) > x1 - step)
                covers.append(len(np.unique(ang[band])) / 24)
            peak = max(covers[:4]) if covers else 0
            deep = [k for k, cv in enumerate(covers) if cv >= max(.5, peak * .6)]
            width = max(r * .45, (max(deep) + 1) * step) if deep else r * .6
            wheels.append(dict(x=xs * (outer - width / 2), y=yc, z=zc, r=r, outer=outer, width=width, side=xs))
    return wheels


def segment(pos, idx, wheels):
    """Triangles inside each tyre cylinder become that wheel.

    Candidates are split into connected pieces; only pieces that wrap most of
    the way round the axle (tyre, rim, spokes) or sit on it (hub) are kept, so
    a body panel that merely overlaps the tyre cylinder stays on the chassis."""
    c = pos[idx].mean(1)
    owner = np.full(len(idx), -1)
    for i, w in enumerate(wheels):
        ax = c[:, 0] * w['side']
        vmax = np.hypot(pos[idx][:, :, 1] - w['y'], pos[idx][:, :, 2] - w['z']).max(1)
        cand = np.where((vmax < w['r'] * 1.09) & (ax > w['outer'] - w['width'] * 1.08) & (ax < w['outer'] + w['r'] * .1) & (owner < 0))[0]
        if not len(cand): continue
        for piece in pieces(pos, idx, cand):
            pc = c[piece]
            d = np.hypot(pc[:, 1] - w['y'], pc[:, 2] - w['z'])
            ang = ((np.arctan2(pc[:, 1] - w['y'], pc[:, 2] - w['z']) + np.pi) / (2 * np.pi) * 24).astype(int) % 24
            cover = len(np.unique(ang)) / 24
            outside = (d > w['r'] * .98).mean()
            if (cover >= .6 and outside < .45) or d.mean() < w['r'] * .35:
                owner[piece] = i
    return owner


def pieces(pos, idx, subset):
    """Connected components of a triangle subset, joined through shared (welded) positions."""
    key = np.round(pos / 1e-4).astype(np.int64)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.reshape(-1)
    tri = weld[idx[subset]]
    parent = list(range(len(subset)))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    first = {}
    for t, verts in enumerate(tri):
        for v in verts:
            if v in first:
                ra, rb = find(t), find(first[v])
                if ra != rb: parent[ra] = rb
            else: first[v] = t
    groups = {}
    for t in range(len(subset)): groups.setdefault(find(t), []).append(subset[t])
    return [np.array(g) for g in groups.values()]


def dielectric_paint(orm, color):
    """Scans often mark pearl/white coachwork as metal, which renders as chrome.
    Bright, unsaturated texels are paint: strip metalness, keep a clearcoat-like
    roughness floor. Dark metals and chrome trims are left alone."""
    o = np.asarray(orm).astype(np.float32)
    hsv = np.asarray(color.resize(orm.size, Image.BILINEAR).convert('HSV')).astype(np.float32) / 255
    paint = np.clip((hsv[..., 2] - .55) / .2, 0, 1) * np.clip((.22 - hsv[..., 1]) / .12, 0, 1)
    o[..., 2] *= 1 - .92 * paint
    o[..., 1] = np.maximum(o[..., 1], paint * 255 * .28)
    return Image.fromarray(o.clip(0, 255).astype(np.uint8))


def emissive_from(color, accent):
    """Glow only where the texture carries the division accent: saturated,
    bright texels whose hue is close to the accent hue."""
    a = np.asarray(color).astype(np.float32) / 255
    hsv = np.asarray(color.convert('HSV')).astype(np.float32) / 255
    h, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    ah = np.asarray(Image.new('RGB', (1, 1), accent).convert('HSV')).astype(np.float32)[0, 0] / 255
    dh = np.abs(h - ah[0]); dh = np.minimum(dh, 1 - dh)
    grey = ah[1] < .25  # silver accents glow by brightness alone
    hue = np.ones_like(dh) if grey else np.clip((.075 - dh) / .035, 0, 1)
    smin = .12 if grey else .38
    w = hue * np.clip((sat - smin) / .22, 0, 1) * np.clip((val - .45) / .3, 0, 1)
    if grey: w = np.clip((val - .82) / .12, 0, 1) * np.clip((.25 - sat) / .1, 0, 1)
    out = (a * w[..., None] * 255).astype(np.uint8)
    return Image.fromarray(out), float(w.mean())


class Writer:
    def __init__(self):
        self.bin = bytearray(); self.js = {'asset': {'version': '2.0', 'generator': 'ZenFlow fit-scan-kart'},
            'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [],
            'buffers': [], 'materials': [], 'textures': [], 'images': [], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]}

    def view(self, data, target=None):
        while len(self.bin) % 4: self.bin.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)}
        if target: v['target'] = target
        self.bin += data; self.js['bufferViews'].append(v); return len(self.js['bufferViews']) - 1

    def acc(self, arr, ctype, typ, target, minmax=False, normalized=False):
        a = {'bufferView': self.view(arr.tobytes(), target), 'componentType': ctype, 'count': len(arr), 'type': typ}
        if normalized: a['normalized'] = True
        if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        self.js['accessors'].append(a); return len(self.js['accessors']) - 1

    def tex(self, img, quality=86):
        b = io.BytesIO(); img.save(b, 'JPEG', quality=quality, optimize=True, progressive=False)
        self.js['images'].append({'mimeType': 'image/jpeg', 'bufferView': self.view(b.getvalue())})
        self.js['textures'].append({'sampler': 0, 'source': len(self.js['images']) - 1})
        return len(self.js['textures']) - 1

    def mesh(self, name, pos, nor, uv, idx, material):
        # Compact the vertex set actually used by these triangles.
        used, remap = np.unique(idx, return_inverse=True)
        idx = remap.reshape(-1, 3).astype(np.uint16 if len(used) < 65535 else np.uint32)
        p = pos[used].astype(np.float32)
        n = nor[used]; n = (n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-8)).astype(np.float32)
        attrs = {'POSITION': self.acc(p, 5126, 'VEC3', 34962, True), 'NORMAL': self.acc(n, 5126, 'VEC3', 34962),
                 'TEXCOORD_0': self.acc(uv[used].astype(np.float32), 5126, 'VEC2', 34962)}
        ind = self.acc(idx.reshape(-1), 5123 if idx.dtype == np.uint16 else 5125, 'SCALAR', 34963)
        self.js['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': ind, 'material': material}]})
        return len(self.js['meshes']) - 1

    def save(self, path):
        self.js['buffers'] = [{'byteLength': len(self.bin)}]
        j = json.dumps(self.js, separators=(',', ':')).encode()
        while len(j) % 4: j += b' '
        while len(self.bin) % 4: self.bin.append(0)
        out = struct.pack('<III', 0x46546C67, 2, 28 + len(j) + len(self.bin))
        out += struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--id', required=True); ap.add_argument('--tier', required=True)
    ap.add_argument('--front', choices=['+x', '-x', '+z', '-z']); ap.add_argument('--flip', action='store_true')
    ap.add_argument('--no-wheels', action='store_true')
    ap.add_argument('--accent', required=True)
    args = ap.parse_args()
    m = load(args.src)
    pos, nor, how = orient(m['pos'].astype(np.float64), m['nor'].astype(np.float64), args.front, args.flip)
    ext = pos.max(0) - pos.min(0)
    scale = KART_LENGTH / ext[2]
    pos = pos * scale
    centre = (pos.max(0) + pos.min(0)) / 2
    pos[:, 0] -= centre[0]; pos[:, 2] -= centre[2]; pos[:, 1] -= pos[:, 1].min()
    idx = m['idx']
    wheels = [] if args.no_wheels else find_wheels(pos, idx)
    owner = segment(pos, idx, wheels) if wheels else np.full(len(idx), -1)

    w = Writer()
    color = m['color'].resize((COLOR_SIZE, COLOR_SIZE), Image.LANCZOS)
    emissive, glow = emissive_from(color, args.accent)
    mat = {'name': f'scan-{args.tier}-{args.id}', 'pbrMetallicRoughness': {'baseColorTexture': {'index': w.tex(color)},
           'metallicFactor': 1, 'roughnessFactor': 1}, 'emissiveTexture': {'index': w.tex(emissive, 82)}, 'emissiveFactor': [1, 1, 1]}
    if m['orm'] is not None: mat['pbrMetallicRoughness']['metallicRoughnessTexture'] = {'index': w.tex(dielectric_paint(m['orm'].resize((AUX_SIZE, AUX_SIZE), Image.LANCZOS), color), 84)}
    if m['normal'] is not None: mat['normalTexture'] = {'index': w.tex(m['normal'].resize((NORMAL_SIZE, NORMAL_SIZE), Image.LANCZOS), 90)}
    w.js['materials'].append(mat)

    names = ['wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr']
    root = {'name': f'{args.id}-{args.tier}', 'children': [], 'extras': {'zf_root': True, 'zf_tier': args.tier, 'zf_id': args.id}}
    w.js['nodes'].append(root)
    body = idx[owner < 0]
    w.js['nodes'].append({'name': 'chassis', 'mesh': w.mesh('chassis', pos, nor, m['uv'], body, 0)}); root['children'].append(1)
    meta = []
    for i, wh in enumerate(wheels):
        tris = idx[owner == i]
        if len(tris) < 30: continue
        c = np.array([wh['x'], wh['y'], wh['z']])
        mi = w.mesh(names[i], pos - c, nor, m['uv'], tris, 0)
        w.js['nodes'].append({'name': names[i], 'mesh': mi, 'translation': c.round(5).tolist(), 'extras': {'zf_radius': round(wh['r'], 4), 'zf_width': round(wh['width'], 4)}})
        root['children'].append(len(w.js['nodes']) - 1)
        meta.append(dict(name=names[i], centre=c.round(3).tolist(), r=round(wh['r'], 3), width=round(wh['width'], 3), tris=int(len(tris))))
    size = (pos.max(0) - pos.min(0)).round(3).tolist()
    root['extras']['zf_size'] = size
    w.save(args.dst)
    print(json.dumps(dict(id=args.id, tier=args.tier, orient=how, size=size, tris=int(len(idx)), chassis=int(len(body)), wheels=meta, glow=round(glow, 4))))


if __name__ == '__main__':
    main()
