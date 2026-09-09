"""Author actual eroded, beveled rock geometry in Blender; export engine-ready mesh arrays."""
import bpy, math, json, os
from mathutils import Vector
from mathutils.noise import noise_vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
assets=[]
for index,name in enumerate(['stratified-limestone','weathered-basalt','river-stone']):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=1)
    obj=bpy.context.object;obj.name=name
    for vertex in obj.data.vertices:
        p=vertex.co.copy();n=noise_vector(p*2.6+Vector((index*11,4,7)))
        p.x*=1.25+n.x*.25;p.y*=.85+n.y*.18;p.z*=.64+n.z*.15
        if index<2:p.x+=math.sin(p.z*15+index)*.055;p.z=round(p.z*9)/9*.3+p.z*.7
        vertex.co=p
    dec=obj.modifiers.new('Silhouette-preserving reduction','DECIMATE');dec.ratio=.38;bpy.ops.object.modifier_apply(modifier=dec.name)
    bevel=obj.modifiers.new('Eroded edges','BEVEL');bevel.width=.035;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name)
    minimum=min(v.co.z for v in obj.data.vertices)
    for v in obj.data.vertices:v.co.z-=minimum
    for polygon in obj.data.polygons:polygon.use_smooth=True
    obj.data.update();obj.data.calc_loop_triangles()
    positions=[];normals=[];uv=[]
    for tri in obj.data.loop_triangles:
        for vi in tri.vertices:
            v=obj.data.vertices[vi];p=v.co;n=v.normal
            positions.extend([round(p.x,5),round(p.z,5),round(-p.y,5)])
            normals.extend([round(n.x,5),round(n.z,5),round(-n.y,5)])
            uv.extend([round(p.x*.5,5),round(p.z*.5,5)])
    mat=bpy.data.materials.new(name);mat.diffuse_color=(.22,.25,.28,1) if index==1 else (.56,.54,.47,1);mat.roughness=.89;mat.use_nodes=True;nodes=mat.node_tree.nodes;bs=nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=mat.diffuse_color;bs.inputs['Roughness'].default_value=.89
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=14;noise.inputs['Detail'].default_value=4
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.3;bump.inputs['Distance'].default_value=.06
    mat.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);mat.node_tree.links.new(bump.outputs['Normal'],bs.inputs['Normal']);obj.data.materials.append(mat)
    assets.append({'name':name,'positions':positions,'normals':normals,'uv':uv,'triangles':len(obj.data.loop_triangles)})
    obj.location.x=index*3.5
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'.tools/natural-stones.blend'))
with open(os.path.join(root,'natural-stone-data.js'),'w') as f:f.write('/* Blender 4.5 export: tools/author-natural-stones.py */\nconst NATURAL_STONE_DATA='+json.dumps(assets,separators=(',',':'))+';\n')
print('EXPORTED',[(a['name'],a['triangles']) for a in assets])
