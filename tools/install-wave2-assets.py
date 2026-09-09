"""Validate staging and merge only eight Blender outputs into shipping asset manifest."""
from pathlib import Path
import hashlib,json,shutil,struct
source=Path('.tools/wave2-models');target=Path('assets/models')
ids={'ledger','terra','obsidian','civic','cognara','gaia','nomad','eon'}
staged=json.loads((source/'manifest.json').read_text());manifest=json.loads((target/'manifest.json').read_text())
assert {a['id'] for a in staged['assets']}==ids,'staging must contain exactly Wave2'
# Validate every binary before modifying any shipping file.
for asset in staged['assets']:
    data=(source/asset['file']).read_bytes()
    assert asset['file']==asset['id']+'.glb'
    assert hashlib.sha256(data).hexdigest()==asset['sha256'],'asset hash mismatch'
    gltf=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
    count=sum(gltf['accessors'][p.get('indices',p['attributes']['POSITION'])]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
    assert count<50000 and count==asset['triangles'],(asset['id'],count,asset['triangles'])
    assert not gltf.get('images'),'reference images must never enter playable models'
    assert asset['authored'] is True,'expected actual Blender authoring'
original=[a for a in manifest['assets'] if a['id'] not in ids]
original_hashes={a['file']:hashlib.sha256((target/a['file']).read_bytes()).hexdigest() for a in original}
for asset in staged['assets']:shutil.copyfile(source/asset['file'],target/asset['file'])
order=['ledger','terra','obsidian','civic','cognara','gaia','nomad','eon']
manifest['assets']=original+sorted(staged['assets'],key=lambda a:order.index(a['id']))
(target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert original_hashes=={f:hashlib.sha256((target/f).read_bytes()).hexdigest() for f in original_hashes}
print('Installed eight Blender Wave2 models; original twelve binaries preserved.')
