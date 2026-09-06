// Install reproducible offline tooling (outside the browser dependency graph):
// npm install --prefix .tools/gltf-tools @gltf-transform/core@4.2.1 @gltf-transform/functions@4.2.1 @gltf-transform/extensions@4.2.1
import {NodeIO} from '../.tools/gltf-tools/node_modules/@gltf-transform/core/dist/index.modern.js';
import {dedup,prune,weld} from '../.tools/gltf-tools/node_modules/@gltf-transform/functions/dist/functions.modern.js';
import {ALL_EXTENSIONS} from '../.tools/gltf-tools/node_modules/@gltf-transform/extensions/dist/index.modern.js';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const directory=path.resolve(process.argv[2]||'assets/models');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
for(const entry of manifest.assets){
 const file=path.join(directory,entry.file),doc=await io.read(file);
 const before=doc.getRoot().listNodes().map(n=>JSON.stringify([n.getName(),n.getExtras(),n.getTranslation(),n.getRotation(),n.getScale()]));
 await doc.transform(weld(),dedup(),prune({keepLeaves:true,keepExtras:true,keepAttributes:true}));
 const after=doc.getRoot().listNodes().map(n=>JSON.stringify([n.getName(),n.getExtras(),n.getTranslation(),n.getRotation(),n.getScale()]));
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Optimization modified rig contract '+entry.id);
 await io.write(file,doc);const bytes=fs.readFileSync(file);
 entry.bytes=bytes.length;entry.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 entry.optimization='glTF Transform 4.2.1 weld / dedup / prune; node extras, leaves and transforms retained';
 console.log(entry.id,entry.bytes);
}
fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
