"""Rebuild the exported runtime kart rigs inside Blender 4.5 (headless).

    blender --background --python tools/build-kart-rig-blender.py -- .tools/kart-rig .tools/zenflow-karts.blend

Run `node tools/export-kart-rig.cjs` first. Every runtime Group becomes an Empty and every
runtime Mesh a mesh object, with parenting, local transforms, smooth shading and Principled
BSDF materials (emission strength for glow parts, alpha for the translucent pilot). The twelve
karts are laid out in a 4x3 grid, one named collection each. Every object carries custom
properties (zf_kart, zf_node, zf_kind, zf_rest_*) so tools/author-kart-clips.py and
tools/export-kart-clips.py address rig nodes by runtime name, never by Blender object name.

If the current runtime export lacks an animation-contract node (rig work in progress), a
placeholder Empty with that name is created at a sensible rest position so the clips can still
be authored and exported. Legacy names that play a contract role are tagged with the contract
name (seated-humanoid -> pilot, continuous-humanoid-surface -> torso, rear-flow-emitter -> exhaust-l/r)
and a missing 'body' Group is synthesised around the coachwork at identity, which leaves every
local rest transform untouched.
"""
import bpy, json, sys, os
from mathutils import Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kartrig_common import (CONTRACT_NODES, PLACEHOLDERS, FPS, three_to_blender, find_node)

args = sys.argv[sys.argv.index('--') + 1:]
source, target = os.path.abspath(args[0]), os.path.abspath(args[1])
GRID_COLS, GRID_DX, GRID_DY = 4, 5.2, 6.5

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 0
manifest = json.load(open(os.path.join(source, 'manifest.json')))
scene['zf_source'] = source
scene['zf_rig_contract'] = json.dumps(manifest.get('rig', {}))

material_cache = {}


def make_material(kart_id, spec):
    key = (kart_id, json.dumps(spec, sort_keys=True))
    if key in material_cache:
        return material_cache[key]
    mat = bpy.data.materials.new(f"{kart_id}-{len(material_cache):02d}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    r, g, b = spec['color']
    bsdf.inputs['Base Color'].default_value = (r, g, b, 1)
    bsdf.inputs['Metallic'].default_value = spec['metalness']
    bsdf.inputs['Roughness'].default_value = spec['roughness']
    if spec.get('clearcoat'):
        bsdf.inputs['Coat Weight'].default_value = min(1.0, spec['clearcoat'])
    strength = spec.get('emissiveIntensity', 0)
    er, eg, eb = spec.get('emissive', [0, 0, 0])
    if strength > 0 and (er + eg + eb) > 0:
        bsdf.inputs['Emission Color'].default_value = (er, eg, eb, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    if spec.get('transparent') and spec.get('opacity', 1) < 1:
        bsdf.inputs['Alpha'].default_value = spec['opacity']
        mat.surface_render_method = 'BLENDED'
    mat.diffuse_color = (r, g, b, 1)
    material_cache[key] = mat
    return mat


def tag(obj, kart_id, node, kind, root=False):
    obj['zf_kart'] = kart_id
    obj['zf_node'] = node
    obj['zf_kind'] = kind
    if root:
        obj['zf_root'] = True
    obj['zf_rest_loc'] = list(obj.location)
    obj['zf_rest_rot'] = list(obj.rotation_euler)
    obj['zf_rest_scale'] = list(obj.scale)


def build_kart(index, entry):
    data = json.load(open(os.path.join(source, entry['file'])))
    kart_id = data['id']
    coll = bpy.data.collections.new(f"{index + 1:02d} {data['division']}")
    scene.collection.children.link(coll)
    coll['zf_kart'] = kart_id
    mesh_cache = {}
    objects = {}
    exhaust_seen = 0
    for node in data['nodes']:
        name = node['name'] or 'mesh'
        contract = name
        # Legacy runtime names that play a contract role are tagged with the contract name.
        if name == 'seated-humanoid':
            contract = 'pilot'
        elif name == 'continuous-humanoid-surface':
            contract = 'torso'
        elif name == 'rear-flow-emitter':
            contract = 'exhaust-l' if node['three']['position'][0] < 0 else 'exhaust-r'
            exhaust_seen += 1
        if node['kind'] == 'mesh':
            gid = node['geometry']
            if gid not in mesh_cache:
                geo = data['geometries'][gid]
                mesh = bpy.data.meshes.new(f"{kart_id}:{name}")
                mesh.from_pydata(geo['vertices'], [], geo['faces'])
                mesh.update()
                for poly in mesh.polygons:
                    poly.use_smooth = True
                mesh_cache[gid] = mesh
            mat = make_material(kart_id, node['material'])
            mesh = mesh_cache[gid]
            if mesh.materials and mesh.materials[0] != mat:
                # Shared runtime geometry with a different material: give it its own datablock.
                mesh = mesh.copy()
                mesh.materials.clear()
            if not mesh.materials:
                mesh.materials.append(mat)
            obj = bpy.data.objects.new(f"{kart_id}:{contract}", mesh)
        else:
            obj = bpy.data.objects.new(f"{kart_id}:{contract}", None)
            obj.empty_display_type = 'PLAIN_AXES'
            obj.empty_display_size = 0.2
        coll.objects.link(obj)
        objects[node['id']] = obj
        if node['parent']:
            obj.parent = objects[node['parent']]
        obj.rotation_mode = 'XYZ'
        obj.location = node['position']
        w, x, y, z = node['quaternion']
        obj.rotation_euler = Quaternion((w, x, y, z)).to_euler('XYZ')
        obj.scale = node['scale']
        if not node['visible']:
            obj.hide_render = True
            obj.hide_viewport = True
        is_root = node['id'] == data['root']
        if is_root:
            obj.location = (index % GRID_COLS * GRID_DX, -(index // GRID_COLS) * GRID_DY, 0)
            obj.empty_display_type = 'ARROWS'
            obj.empty_display_size = 0.6
        tag(obj, kart_id, contract, node['kind'], root=is_root)
        obj['zf_runtime_name'] = name
        obj['zf_three_position'] = node['three']['position']
    root = objects[data['root']]
    # Synthesise a 'body' Group around the coachwork when the runtime rig has none yet.
    if find_node(bpy, kart_id, 'body') is None:
        body = bpy.data.objects.new(f"{kart_id}:body", None)
        body.empty_display_type = 'CUBE'
        body.empty_display_size = 0.3
        coll.objects.link(body)
        body.parent = root
        for child in list(root.children):
            if child is body or child.get('zf_node') in ('wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr', 'underbody-flow-ring', 'aegis-shield'):
                continue
            child.parent = body
        tag(body, kart_id, 'body', 'group')
        body['zf_placeholder'] = True
    placeholders = []
    for node, (parent_name, pos) in PLACEHOLDERS.items():
        if find_node(bpy, kart_id, node) is not None:
            continue
        ph = bpy.data.objects.new(f"{kart_id}:{node}", None)
        ph.empty_display_type = 'SPHERE'
        ph.empty_display_size = 0.12
        coll.objects.link(ph)
        ph.parent = find_node(bpy, kart_id, parent_name) if parent_name else root
        ph.location = three_to_blender(pos)
        tag(ph, kart_id, node, 'group')
        ph['zf_placeholder'] = True
        ph['zf_three_position'] = list(pos)
        placeholders.append(node)
    return kart_id, placeholders, len(objects)


report = []
for i, entry in enumerate(manifest['karts']):
    kart_id, placeholders, count = build_kart(i, entry)
    report.append((kart_id, count, placeholders))
    print(f"built {kart_id}: {count} nodes; placeholders: {', '.join(placeholders) or 'none'}")

missing = [n for n in CONTRACT_NODES if n not in ('spin', 'hair', 'coachwork-batch', 'wheel-light-ring') and find_node(bpy, 'zenflow', n) is None]
assert not missing, f"contract nodes still missing on the reference rig: {missing}"
os.makedirs(os.path.dirname(target), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=target, compress=True)
print('saved', target, 'materials:', len(material_cache), 'objects:', len(bpy.data.objects))
