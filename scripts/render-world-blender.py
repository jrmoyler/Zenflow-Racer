"""Offline review of actual game geometry; materials approximate WebGL shading."""
import bpy,json,math,os,sys
from mathutils import Matrix,Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.environ.get('ZENFLOW_WORLD_INPUT',os.path.join(root,'docs/world-review/world-geometry.json'))) as f:data=json.load(f)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
materials={}
for key,m in data['materials'].items():
    mat=bpy.data.materials.new(key);mat.use_nodes=True;nodes=mat.node_tree.nodes;bs=nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*m['color'],1);bs.inputs['Metallic'].default_value=m['metalness'];bs.inputs['Roughness'].default_value=m['roughness']
    if m['basic']:
        bs.inputs['Emission Color'].default_value=(*m['color'],1);bs.inputs['Emission Strength'].default_value=.65
    else:
        bs.inputs['Emission Color'].default_value=(*m['emissive'],1);bs.inputs['Emission Strength'].default_value=m['emissiveIntensity']
    if m['vertexColors']:
        attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='Color';mat.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
    if m['opacity']<1:bs.inputs['Alpha'].default_value=m['opacity']
    materials[key]=mat
meshes={}
for key,g in data['geometries'].items():
    p=g['positions'];verts=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)];indices=g['indices'] if g['indices'] is not None else list(range(len(verts)));faces=[indices[i:i+3] for i in range(0,len(indices),3)]
    mesh=bpy.data.meshes.new(key);mesh.from_pydata(verts,[],faces);mesh.update()
    if g['colors']:
        attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT');col=g['colors'];attr.data.foreach_set('color',[v for i in range(0,len(col),3) for v in (*col[i:i+3],1)])
    for face in mesh.polygons:face.use_smooth=True
    if g.get('normals'):
        normals=g['normals'];mesh.normals_split_custom_set_from_vertices([(normals[i],-normals[i+2],normals[i+1]) for i in range(0,len(normals),3)])
    meshes[key]=mesh
for i,o in enumerate(data['objects']):
    mesh=meshes[o['geometry']];obj=bpy.data.objects.new('world-'+str(i),mesh);bpy.context.collection.objects.link(obj)
    if not mesh.materials:mesh.materials.append(materials[o['material']])
    a=o['matrix'];M=Matrix(tuple(tuple(a[c*4+r] for c in range(4)) for r in range(4)));obj.matrix_world=C@M@C.inverted()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=int(os.environ.get('ZENFLOW_WORLD_SAMPLES','24'));scene.cycles.use_denoising=True
scene.render.resolution_x=960;scene.render.resolution_y=540;scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.61,.67,.88,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
wn=scene.world.node_tree.nodes;wl=scene.world.node_tree.links;tex=wn.new('ShaderNodeTexCoord');separate=wn.new('ShaderNodeSeparateXYZ');ramp=wn.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=0;ramp.color_ramp.elements[0].color=(.83,.53,.68,1);ramp.color_ramp.elements[1].position=.8;ramp.color_ramp.elements[1].color=(.38,.55,.88,1);wl.new(tex.outputs['Normal'],separate.inputs[0]);wl.new(separate.outputs['Z'],ramp.inputs[0]);wl.new(ramp.outputs['Color'],wn['Background'].inputs[0])
sun=bpy.data.lights.new('pastel sun','SUN');sun.energy=2.3;sun.angle=math.radians(1.1);sun.color=(1,.88,.68);obj=bpy.data.objects.new('pastel sun',sun);bpy.context.collection.objects.link(obj);obj.rotation_euler=Vector((90,-60,-140)).to_track_quat('-Z','Y').to_euler()
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.use_nodes=True;tree=scene.node_tree;tree.nodes.clear();layers=tree.nodes.new('CompositorNodeRLayers');glare=tree.nodes.new('CompositorNodeGlare');glare.glare_type='FOG_GLOW';glare.quality='MEDIUM';glare.threshold=1.8;output=tree.nodes.new('CompositorNodeComposite');tree.links.new(layers.outputs['Image'],glare.inputs['Image']);tree.links.new(glare.outputs['Image'],output.inputs['Image'])
for v in data['cameras']:
    if os.environ.get('ZENFLOW_WORLD_CAMERA') and v['name']!=os.environ['ZENFLOW_WORLD_CAMERA']:continue
    camera=bpy.data.cameras.new(v['name']);obj=bpy.data.objects.new(v['name'],camera);bpy.context.collection.objects.link(obj);obj.location=(C@Vector((*v['position'],1))).to_3d();target=C@Vector((*v['target'],1));obj.rotation_euler=(Vector(target[:3])-obj.location).to_track_quat('-Z','Y').to_euler();camera.angle=math.radians(v['fov']);camera.clip_end=2000;scene.camera=obj
    scene.render.filepath=os.path.join(os.environ.get('ZENFLOW_WORLD_OUTPUT',os.path.join(root,'docs/world-review')),v['name']+'.png');bpy.ops.render.render(write_still=True)
