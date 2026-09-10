"""Blender audience kit: joint-local meshes and sampled articulated cheering clips.
Run with blender --background --python tools/author-audience.py -- OUTPUT_DIR.
Coordinates intentionally use runtime Y-up; review root rotates into Blender Z-up.
"""
import bpy, math, json, os, sys
from mathutils import Vector
out=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else '.'
os.makedirs(out,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts=[];objects=[]
def part(name,parent,pivot,ellipsoids,kind):
    meshes=[]
    for center,scale in ellipsoids:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,location=center)
        o=bpy.context.object;o.scale=scale
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);meshes.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();obj=meshes[0];obj.name=name
    # Store all vertices relative to the intended joint, not the first sphere origin.
    for v in obj.data.vertices:v.co+=obj.location
    obj.location=(0,0,0)
    for f in obj.data.polygons:f.use_smooth=True
    obj.data.update();obj.data.calc_loop_triangles()
    positions=[];normals=[];uv=[]
    for t in obj.data.loop_triangles:
        for vi in t.vertices:
            v=obj.data.vertices[vi];positions.extend(round(x,5) for x in v.co);normals.extend(round(x,5) for x in v.normal);uv.extend([round(v.co.x*4,5),round(v.co.y*4,5)])
    if parent>=0:obj.parent=objects[parent]
    obj.location=pivot
    objects.append(obj);parts.append(dict(name=name,parent=parent,pivot=pivot,positions=positions,normals=normals,uv=uv,kind=kind))
    return len(parts)-1
body=part('tailored-shirt',-1,[0,0,0],[([0,.30,0],[.245,.34,.145])],'shirt')
# Tailored torso: flat hem, waist, chest and sloped shoulders instead of an oval.
obj=objects[body]
profile=[(0,.19,.115),(.10,.205,.13),(.32,.22,.145),(.48,.25,.13),(.57,.17,.10),(.60,.08,.075)]
verts=[];faces=[]
for y,rx,rz in profile:
    for k in range(12):
        a=k/12*math.tau;verts.append((math.cos(a)*rx,y,math.sin(a)*rz))
for j in range(len(profile)-1):
    for k in range(12):
        n=j*12+k;next=j*12+(k+1)%12;faces.append((n,n+12,next+12,next))
faces.extend([tuple(range(12)),tuple((len(profile)-1)*12+k for k in range(11,-1,-1))])
mesh=bpy.data.meshes.new('shirt-cut');mesh.from_pydata(verts,[],faces);mesh.update();obj.data=mesh
for f in mesh.polygons:f.use_smooth=True
mesh.calc_loop_triangles();positions=[];normals=[];uv=[]
for tri in mesh.loop_triangles:
    for vi in tri.vertices:
        v=mesh.vertices[vi];positions.extend(round(x,5) for x in v.co);normals.extend(round(x,5) for x in v.normal);uv.extend([round(v.co.x*4,5),round(v.co.y*4,5)])
parts[body].update(positions=positions,normals=normals,uv=uv)
head=part('face-neck-ears',body,[0,.62,0],[([0,.15,0],[.135,.18,.128]),([0,-.035,0],[.075,.10,.074]),([0,.15,-.124],[.033,.039,.035]),([-.133,.15,0],[.028,.046,.032]),([.133,.15,0],[.028,.046,.032])],'skin')
part('eyes-brows-mouth',head,[0,0,0],[([-.047,.19,-.115],[.019,.012,.018]),([.047,.19,-.115],[.019,.012,.018]),([0,.071,-.113],[.035,.009,.009])],'detail')
part('hair',head,[0,0,0],[([0,.272,.025],[.139,.079,.13])],'hair')
for s in [-1,1]:
    arm=part('sleeve-'+str(s),body,[s*.24,.50,0],[([s*.025,-.14,0],[.085,.19,.088])],'shirt')
    part('forearm-hand-'+str(s),arm,[s*.035,-.30,0],[([0,-.13,0],[.056,.15,.06]),([0,-.28,0],[.065,.084,.042])],'skin')
    leg=part('trouser-'+str(s),body,[s*.12,.01,0],[([0,-.04,-.19],[.108,.115,.265])],'pants')
    part('shin-shoe-'+str(s),leg,[0,-.09,-.39],[([0,-.19,0],[.074,.23,.084]),([0,-.40,-.065],[.087,.064,.15])],'pants')
for p,o in zip(parts,objects):
    m=bpy.data.materials.new('audience-'+p['kind']);m.use_nodes=True;bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value={'shirt':(.3,.12,.07,1),'skin':(.46,.25,.14,1),'hair':(.05,.025,.012,1),'pants':(.025,.04,.065,1),'detail':(.01,.008,.006,1)}[p['kind']];bs.inputs['Roughness'].default_value=.94 if p['kind'] in ['shirt','pants'] else .7;o.data.materials.append(m)
clips={}
for name in ['wave','clap','watch']:
    for o in objects:
        o.animation_data_clear();o.animation_data_create();o.animation_data.action=bpy.data.actions.new(name+'-'+o.name);o.animation_data.action.use_fake_user=True
    for frame in range(49):
        t=frame/48*math.tau
        for i,o in enumerate(objects):
            o.rotation_euler=(0,0,0)
            n=o.name
            if n=='face-neck-ears':o.rotation_euler.y=.16*math.sin(t)
            if n.startswith('sleeve'):
                s=-1 if n.endswith('--1') else 1
                o.rotation_euler.z=s*(2.3+.22*math.sin(t*2)) if name=='wave' else s*(.5+.24*math.sin(t*3)) if name=='clap' else s*.12
                o.rotation_euler.x=-.7 if name=='clap' else -.12
            if n.startswith('forearm'):o.rotation_euler.x=-.65 if name!='watch' else -.32
            o.keyframe_insert('rotation_euler',frame=frame+1)
    samples=[]
    for frame in range(1,50,2):
        bpy.context.scene.frame_set(frame);samples.append([[round(v,5) for v in o.rotation_euler] for o in objects])
    clips[name]=samples
data=dict(source='Blender '+bpy.app.version_string,parts=parts,clips=clips,duration=4)
with open(os.path.join(out,'audience-data.js'),'w') as f:f.write('/* Generated by tools/author-audience.py. */\nconst AUDIENCE_DATA='+json.dumps(data,separators=(',',':'))+';\n')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'audience.blend'))
print('AUDIENCE_EXPORTED',len(parts),'parts',sum(len(p['positions'])//9 for p in parts),'triangles',len(clips),'clips')
