/* Execute the actual shipped GLB loader and articulated kart factory, without a browser. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),THREE=require('../vendor/three.min.js'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const c={THREE,console,TextDecoder,TextEncoder,ArrayBuffer,Uint8Array,self:{URL},URL,Blob,setTimeout,performance,FALLBACK_GRAPHICS:true,TEX:{},document:{createElement:()=>({getContext:()=>null})}};
vm.createContext(c);const run=s=>vm.runInContext(s,c);
run(read('vendor/GLTFLoader.js'));
const parseLoader=new THREE.GLTFLoader();
THREE.GLTFLoader.prototype.loadAsync=async file=>{const buffer=fs.readFileSync(path.join(root,file));return new Promise((ok,fail)=>parseLoader.parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'',ok,fail));};
run(read('core.js').split('function hexToRgb')[0]);run(read('kart-clips.js'));run(read('kart-materials.js'));run(read('vehicles.js').split('// ---------- Item / token pickups ----------')[0]);run(read('kart-assets.js'));
(async()=>{
 const progress=[];c.progress=(n,total)=>progress.push([n,total]);await run('loadKartAssets(progress)');assert.equal(progress.length,12);assert.equal(run('KART_ASSETS.templates.size'),12);
 let totalBytes=0,totalTriangles=0;
 for(const div of run('ROSTER')){
  const bytes=fs.readFileSync(path.join(root,'assets/models',div.id+'.glb'));totalBytes+=bytes.length;assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString().trim());assert.equal(gltf.images?.length||0,0,'No reference images can enter playable meshes');assert.ok(bytes.length<4*1024*1024,'bounded uncompressed asset size');
  c.div=div;const a=run('buildKart(div)'),b=run('buildKart(div)');assert.equal(a.userData.asset,'blender-glb');
  const skin=a.getObjectByName('head-mesh').material,templateSkin=run('KART_ASSETS.templates.get(div.id)').getObjectByName('head-mesh').material;
  assert.notEqual(skin,templateSkin,'lighting never mutates cached model material');assert.equal(skin.emissiveIntensity,.16,div.id+': loaded driver receives energy-skin lighting');assert.equal(skin.metalness,.28);
  assert.notEqual(a.userData.body,b.userData.body);assert.notEqual(a.userData.exhaust[0].material,b.userData.exhaust[0].material);
  assert.equal(a.getObjectByName('torso').geometry,b.getObjectByName('torso').geometry,'immutable meshes shared');
  a.updateMatrixWorld(true);const torsoBox=new THREE.Box3().setFromObject(a.getObjectByName('torso')),headBox=new THREE.Box3().setFromObject(a.getObjectByName('head-mesh')),torsoSize=torsoBox.getSize(new THREE.Vector3());
  assert.ok(torsoSize.y>1.4&&torsoSize.x>.65&&torsoSize.z>.65,div.id+': full torso, hips and legs survive Blender processing');
  assert.ok(torsoBox.max.y>=headBox.min.y-.08,div.id+': neck remains attached to head');
  for(const side of ['l','r']){const bounds=new THREE.Box3().setFromObject(a.getObjectByName('arm-'+side+'-mesh')).getSize(new THREE.Vector3());assert.ok(bounds.y>.3&&bounds.z>.5,div.id+': complete articulated arm '+side);}

  a.userData.exhaust[0].material.emissiveIntensity=9;assert.notEqual(b.userData.exhaust[0].material.emissiveIntensity,9);
  const clone=a.clone(true);assert.ok(clone.getObjectByName('torso'),'ability ghost can clone GLB rig without circular userData');
  c.kart=a;run('for(let i=0;i<60;i++)animateShowroomKart(kart,i/60,1/60)');a.updateMatrixWorld(true);
  a.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite),'finite animated GLB transforms');if(o.isMesh){const pos=o.geometry.attributes.position;assert.ok(pos.array.every(Number.isFinite));totalTriangles+=(o.geometry.index?.count||pos.count)/3;}});
  let disposed=0;a.getObjectByName('torso').geometry.addEventListener('dispose',()=>disposed++);c.kart=a;run('disposeKart(kart)');assert.equal(disposed,0,'despawn retains cached GLB geometry');c.kart=b;run('disposeKart(kart)');
 }
 assert.ok(totalBytes<40*1024*1024,'whole roster download budget');
 console.log(`PASS playable assets: 12 actual GLBs, independent live rigs/materials, shared geometry, animation, ghost cloning and disposal; ${(totalBytes/1048576).toFixed(2)} MiB, ${Math.round(totalTriangles)} triangles.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
