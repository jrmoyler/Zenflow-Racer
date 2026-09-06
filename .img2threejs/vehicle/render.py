import bpy,json,math,pathlib,bmesh
from mathutils import Vector
p=pathlib.Path('/workspace/scratch/d28b7e8ce77d/zenflow-repo/.img2threejs/vehicle');bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for entry in json.loads((p/'mesh.json').read_text()):
 v=entry['positions'];vertices=[v[i:i+3] for i in range(0,len(v),3)];mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(vertices,[],[(i,i+1,i+2) for i in range(0,len(vertices),3)]);mesh.update();bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.00001);bm.to_mesh(mesh);bm.free();obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj)
 for f in mesh.polygons:f.use_smooth=True
 mat=bpy.data.materials.new(entry['name']);mat.use_nodes=True;b=mat.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*[(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in entry['color']],1);b.inputs['Roughness'].default_value=entry['roughness'];b.inputs['Metallic'].default_value=entry['metalness'];b.inputs['Coat Weight'].default_value=.5;b.inputs['Emission Color'].default_value=(*entry['emissive'],1);b.inputs['Emission Strength'].default_value=entry['intensity']*.12;obj.data.materials.append(mat)
def aim(obj,at):obj.rotation_euler=(Vector(at)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('key',(0,3,7),700,5),('fill',(-5,-2,4),450,4),('rim',(4,-4,4),700,3)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1))
bpy.ops.object.camera_add(location=(6,8,5));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=5.2;aim(cam,(0,0,1.3));sc=bpy.context.scene;sc.camera=cam;sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=20;sc.cycles.use_denoising=True;sc.render.resolution_x=800;sc.render.resolution_y=640;sc.render.resolution_percentage=100;sc.render.film_transparent=True;sc.world.color=(.18,.20,.26);sc.view_settings.view_transform='AgX';sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA'
for name,pos in [('front',(-6,8,5)),('rear',(-6,-8,4)),('side',(8,0,3.8))]:
 cam.location=pos;aim(cam,(0,0,1.3));sc.render.filepath=str(p/(name+'.png'));bpy.ops.render.render(write_still=True)
# Actual bust geometry only, for menus; transparent render of same seated pilot.
for obj in sc.objects:
 if obj.type=='MESH':obj.hide_render=obj.name!='continuous-humanoid-surface'
cam.location=(1.6,6,3.1);cam.data.ortho_scale=1.9;aim(cam,(0,-.37,2.1));sc.render.resolution_x=400;sc.render.resolution_y=440;sc.render.filepath=str(p/'portrait.png');bpy.ops.render.render(write_still=True)
