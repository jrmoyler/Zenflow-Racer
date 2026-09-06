"""Export authored Blender geometry as the actual playable glTF kart rigs.

Run after build-kart-rig-blender.py, optionally author-playable-karts.py:
  blender -b .tools/playable-karts.blend --python tools/export-playable-karts.py -- assets/models

No reference images or render planes enter these files. glTF Y-up converts the Blender
coordinate system back to the game's Three.js axes. Exact duplicate runtime names and
visibility are retained in extras because Blender object names must be unique and glTF
has no visibility flag. The browser loader restores them before binding animation.
"""
import bpy, sys, os, json, hashlib
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
out=Path(args[0]).resolve();out.mkdir(parents=True,exist_ok=True)
entries=[]
for root in [o for o in bpy.data.objects if o.get('zf_root')]:
    kart_id=root['zf_kart']
    objects=[o for o in bpy.data.objects if o.get('zf_kart')==kart_id]
    bpy.ops.object.select_all(action='DESELECT')
    original=root.location.copy();root.location=(0,0,0)
    for obj in objects:
        obj['zf_visible']=not obj.hide_render
        obj['zf_runtime_name']=obj.get('zf_runtime_name',obj.get('zf_node',obj.name))
        # Keep authored latent shield and underbody geometry. Runtime restores visibility.
        obj.hide_set(False);obj.hide_viewport=False;obj.select_set(True)
    target=out/(kart_id+'.glb')
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,
        export_yup=True,export_apply=True,export_extras=True,export_animations=False,
        export_cameras=False,export_lights=False,export_materials='EXPORT',
        export_image_format='NONE',export_draco_mesh_compression_enable=False)
    root.location=original
    triangles=0
    for obj in objects:
        if obj.type=='MESH':
            obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    entries.append({'id':kart_id,'file':kart_id+'.glb','bytes':target.stat().st_size,
        'triangles':triangles,'meshes':sum(o.type=='MESH' for o in objects),
        'nodes':len(objects),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'authored':bool(root.get('zf_blender_authored',False)),
        'operations':json.loads(root.get('zf_author_operations','[]'))})
manifest={'version':1,'generator':'Blender '+bpy.app.version_string,
    'source':'tools/author-playable-karts.py','coordinateSystem':'glTF Y-up / Three.js',
    'contract':'Restore node.name from userData.zf_runtime_name; visible from userData.zf_visible.',
    'referenceImagesEmbedded':False,'assets':entries}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
