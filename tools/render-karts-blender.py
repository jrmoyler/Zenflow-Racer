"""Headless review renders of the animated kart rigs.

    blender --background .tools/zenflow-karts.blend --python-exit-code 1 \
        --python tools/render-karts-blender.py -- .tools/zenflow-karts.blend docs/kart-review ENGINE MODE [samples] [format]

ENGINE  BLENDER_EEVEE_NEXT | CYCLES | BLENDER_WORKBENCH   (tools/render-karts-blender.sh tries EEVEE and
        falls back per process, because a missing GPU/EGL context aborts Blender instead of raising).
MODE    lineup  one 640x480 three-quarter-front still per kart, three-point lit, dark navy backdrop
        sheets  one 1280x480 contact sheet (4x2 evenly spaced frames) per clip for the ZenFlow kart
        all     both
The script appends to docs/kart-review/render-manifest.json (engine, samples, timings, file sizes).
"""
import bpy, json, os, sys, time, math, tempfile
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kartrig_common import FPS, CLIP_NAMES, assign_clip, find_kart_root

args = sys.argv[sys.argv.index('--') + 1:]
blend, out = os.path.abspath(args[0]), os.path.abspath(args[1])
engine = args[2] if len(args) > 2 else 'CYCLES'
mode = args[3] if len(args) > 3 else 'all'
samples = int(args[4]) if len(args) > 4 else 40
fmt = (args[5] if len(args) > 5 else 'WEBP').upper()
os.makedirs(out, exist_ok=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 0

# ---------------------------------------------------------------- engine / output
scene.render.engine = engine
if engine == 'CYCLES':
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.05
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.denoising_use_gpu = False
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 3
    scene.cycles.transparent_max_bounces = 4
    scene.cycles.caustics_reflective = scene.cycles.caustics_refractive = False
elif engine == 'BLENDER_EEVEE_NEXT':
    scene.eevee.taa_render_samples = max(16, samples)
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.image_settings.file_format = fmt
if fmt == 'PNG':
    scene.render.image_settings.compression = 90
    scene.render.image_settings.color_mode = 'RGB'
elif fmt == 'WEBP':
    scene.render.image_settings.quality = 90
    scene.render.image_settings.color_mode = 'RGB'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.use_stamp = False
ext = {'PNG': '.png', 'WEBP': '.webp', 'JPEG': '.jpg'}[fmt]

# ---------------------------------------------------------------- world, ground, lights, camera
world = bpy.data.worlds.new('review-world') if not scene.world else scene.world
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.012, 0.022, 0.055, 1)   # dark navy
bg.inputs['Strength'].default_value = 1.0

stage = bpy.data.collections.new('review-stage')
scene.collection.children.link(stage)


def link(obj):
    stage.objects.link(obj)
    return obj


ground_mat = bpy.data.materials.new('review-ground')
ground_mat.use_nodes = True
gb = ground_mat.node_tree.nodes.get('Principled BSDF')
gb.inputs['Base Color'].default_value = (0.02, 0.035, 0.08, 1)
gb.inputs['Roughness'].default_value = 0.32
gb.inputs['Metallic'].default_value = 0.15
ground_mesh = bpy.data.meshes.new('review-ground')
ground_mesh.from_pydata([(-60, -60, 0), (60, -60, 0), (60, 60, 0), (-60, 60, 0)], [], [(0, 1, 2, 3)])
ground_mesh.materials.append(ground_mat)
ground = link(bpy.data.objects.new('review-ground', ground_mesh))


def light(name, kind, energy, color, size):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == 'AREA':
        data.size = size
    return link(bpy.data.objects.new(name, data))


key = light('review-key', 'AREA', 1600, (1.0, 0.94, 0.86), 3.0)
fill = light('review-fill', 'AREA', 520, (0.72, 0.84, 1.0), 4.5)
rim = light('review-rim', 'AREA', 1100, (0.55, 0.95, 1.0), 2.0)
cam_data = bpy.data.cameras.new('review-camera')
cam_data.lens = 48
cam_data.sensor_width = 36
camera = link(bpy.data.objects.new('review-camera', cam_data))
scene.camera = camera


def aim(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def frame_kart(root):
    """Three-quarter front view: the kart nose points toward Blender +Y."""
    p = Vector(root.location)
    look = p + Vector((0.0, 0.1, 0.95))
    camera.location = p + Vector((-4.9, 5.9, 2.6))
    aim(camera, look)
    key.location = p + Vector((-3.6, 3.4, 4.6))
    aim(key, look)
    fill.location = p + Vector((4.8, 3.2, 2.6))
    aim(fill, look)
    rim.location = p + Vector((1.6, -5.2, 3.6))
    aim(rim, look)


kart_collections = {c['zf_kart']: c for c in bpy.data.collections if c.get('zf_kart')}


def solo(kart_id):
    for kid, coll in kart_collections.items():
        coll.hide_render = kid != kart_id


def render(path):
    scene.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    return time.time() - t


manifest_path = os.path.join(out, 'render-manifest.json')
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
manifest.update({'blender': bpy.app.version_string, 'engine': engine, 'samples': samples, 'format': fmt,
                 'source': os.path.relpath(blend, os.path.dirname(out)), 'generated': time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())})
manifest.setdefault('files', {})
clips = json.loads(scene['zf_clips'])

if mode in ('lineup', 'all'):
    scene.render.resolution_x, scene.render.resolution_y = 640, 480
    for kart_id in kart_collections:
        root = find_kart_root(bpy, kart_id)
        assign_clip(bpy, 'idle', [kart_id])
        scene.frame_set(20)
        solo(kart_id)
        frame_kart(root)
        path = os.path.join(out, f'kart-{kart_id}{ext}')
        secs = render(path)
        manifest['files'][os.path.basename(path)] = {'kind': 'lineup', 'kart': kart_id, 'clip': 'idle', 'frame': 20, 'bytes': os.path.getsize(path), 'seconds': round(secs, 1)}
        print(f'rendered {path} in {secs:.1f}s ({os.path.getsize(path) // 1024} KB)')

if mode in ('sheets', 'all'):
    import numpy as np
    cols, rows, fw, fh = 4, 2, 320, 240
    scene.render.resolution_x, scene.render.resolution_y = fw, fh
    scene.render.use_stamp = True
    for prop in ('use_stamp_date', 'use_stamp_time', 'use_stamp_render_time', 'use_stamp_frame', 'use_stamp_frame_range', 'use_stamp_camera',
                 'use_stamp_lens', 'use_stamp_scene', 'use_stamp_memory', 'use_stamp_hostname', 'use_stamp_marker', 'use_stamp_filename', 'use_stamp_sequencer_strip'):
        setattr(scene.render, prop, False)
    scene.render.use_stamp_note = True
    scene.render.stamp_font_size = 13
    scene.render.stamp_foreground = (1, 1, 1, 0.92)
    scene.render.stamp_background = (0, 0, 0, 0.45)
    solo('zenflow')
    frame_kart(find_kart_root(bpy, 'zenflow'))
    tmp = tempfile.mkdtemp(prefix='zenflow-sheet-')
    for clip in CLIP_NAMES:
        info = clips[clip]
        n = info['frames']
        frames = [round(k * n / 8) for k in range(8)] if info['loop'] else [round(k * n / 7) for k in range(8)]
        assign_clip(bpy, clip, ['zenflow'])
        sheet = np.zeros((rows * fh, cols * fw, 4), dtype=np.float32)
        total = 0.0
        for k, f in enumerate(frames):
            scene.frame_set(f)
            scene.render.stamp_note_text = f'{clip}  f{f:02d}  {f / FPS:.2f}s' + ('  loop' if info['loop'] else '')
            path = os.path.join(tmp, f'{clip}-{k}.png')
            fmt_backup = scene.render.image_settings.file_format
            scene.render.image_settings.file_format = 'PNG'
            total += render(path)
            scene.render.image_settings.file_format = fmt_backup
            img = bpy.data.images.load(path)
            px = np.array(img.pixels[:], dtype=np.float32).reshape(fh, fw, 4)
            r, c = divmod(k, cols)
            y0 = (rows - 1 - r) * fh          # Blender pixel rows run bottom-up
            sheet[y0:y0 + fh, c * fw:(c + 1) * fw] = px
            bpy.data.images.remove(img)
        out_img = bpy.data.images.new(f'sheet-{clip}', cols * fw, rows * fh, alpha=False)
        out_img.pixels = sheet.ravel()
        path = os.path.join(out, f'clip-{clip}{ext}')
        out_img.save_render(path, scene=scene)
        bpy.data.images.remove(out_img)
        manifest['files'][os.path.basename(path)] = {'kind': 'contact-sheet', 'kart': 'zenflow', 'clip': clip, 'frames': frames, 'duration': info['duration'], 'loop': info['loop'], 'bytes': os.path.getsize(path), 'seconds': round(total, 1)}
        print(f'rendered {path}: frames {frames} in {total:.1f}s ({os.path.getsize(path) // 1024} KB)')

json.dump(manifest, open(manifest_path, 'w'), indent=1)
print(f'render manifest -> {manifest_path} (engine {engine})')
