"""blender --background --python tools/import-karts-blender.py -- .tools/kart-meshes .tools/zenflow-karts.blend
Import exact runtime coachwork with PBR materials into an editable Blender lineup.
Run `node tools/export-kart-meshes.cjs` first. No runtime dependency on Blender.
"""
import bpy, json, sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]); target=Path(args[1])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
manifest=json.loads((source/'manifest.json').read_text())
for i,entry in enumerate(manifest):
    data=json.loads((source/(entry['id']+'.json')).read_text())
    collection=bpy.data.collections.new(data['division']); bpy.context.scene.collection.children.link(collection)
    for j,part in enumerate(data['meshes']):
        mesh=bpy.data.meshes.new(part['name']); mesh.from_pydata(part['vertices'],[],part['faces']); mesh.update()
        obj=bpy.data.objects.new(part['name'],mesh); collection.objects.link(obj); obj.location=(i%4*4.7,i//4*6,0)
        mat=bpy.data.materials.new(entry['id']+'-'+str(j)); mat.use_nodes=True
        shader=mat.node_tree.nodes.get('Principled BSDF'); shader.inputs['Base Color'].default_value=(*part['color'],1)
        shader.inputs['Metallic'].default_value=part['metalness']; shader.inputs['Roughness'].default_value=part['roughness']
        obj.data.materials.append(mat)
        for poly in mesh.polygons: poly.use_smooth=True
bpy.ops.wm.save_as_mainfile(filepath=str(target.resolve()))
print('Saved exact runtime chassis lineup:',target)
