"""CPU review renders re-imported from shipped GLBs, never screenshots of reference planes.
  blender -b --python tools/render-playable-karts.py -- assets/models docs/playable-review zenflow
Omit the last argument for all twelve. Front, side and rear share camera/lights/scale.
"""
import bpy,sys,os,json,math,time,hashlib
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source=Path(args[0]).resolve();out=Path(args[1]).resolve();out.mkdir(parents=True,exist_ok=True)
front_only='--front-only' in args
ids=[a for a in args[2:] if a!='--front-only'] or [a['id'] for a in json.loads((source/'manifest.json').read_text())['assets']]
records=[]
for kart_id in ids:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source/(kart_id+'.glb')))
    for obj in bpy.data.objects:
        obj.hide_render=not obj.get('zf_visible',True)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32
    scene.cycles.use_denoising=True;scene.cycles.denoising_use_gpu=False;scene.cycles.max_bounces=4
    scene.render.resolution_x=720;scene.render.resolution_y=600;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.46,.56,.7,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.12
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));ground=bpy.context.object
    mat=bpy.data.materials.new('studio-floor');mat.use_nodes=True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.3,.39,.5,1)
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.3
    ground.data.materials.append(mat)
    for loc,power,size in [((3,3,6),650,3),((-4,2,4),180,3),((1,-4,5),800,2)]:
        bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object
        light.data.energy=power;light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=6.6
    for angle,pos in [('front',(5.6,7,4.5))]+([] if front_only else [('side',(8,0,3.5)),('rear',(-5.6,-7,4.5))]):
        camera.location=pos;camera.rotation_euler=(Vector((0,0,1.1))-camera.location).to_track_quat('-Z','Y').to_euler()
        path=out/(kart_id+'-'+angle+'.png');scene.render.filepath=str(path)
        started=time.time();bpy.ops.render.render(write_still=True)
        records.append({'id':kart_id,'angle':angle,'file':path.name,'source':str(source/(kart_id+'.glb')),'sourceSha256':hashlib.sha256((source/(kart_id+'.glb')).read_bytes()).hexdigest(),'seconds':round(time.time()-started,2),'engine':'Blender Cycles CPU','samples':32})
    (out/'render-manifest.json').write_text(json.dumps(records,indent=2)+'\n')
print('Rendered',len(records),'real GLB views')
