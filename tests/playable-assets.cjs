/* Execute the actual shipped GLB loader and articulated kart factory, without a browser. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),THREE=require('../vendor/three.min.js'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const c={THREE,console,TextDecoder,TextEncoder,ArrayBuffer,Uint8Array,self:{URL},URL,Blob,setTimeout,performance,FALLBACK_GRAPHICS:true,TEX:{},document:{createElement:()=>({getContext:()=>null})}};
vm.createContext(c);const run=s=>vm.runInContext(s,c);
run(read('vendor/GLTFLoader.js'));
const parseLoader=new THREE.GLTFLoader();
THREE.GLTFLoader.prototype.loadAsync=async file=>{const buffer=fs.readFileSync(path.join(root,file));return new Promise((ok,fail)=>parseLoader.parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'',ok,fail));};
run(read('core.js').split('function hexToRgb')[0]);run(read('kart-clips.js'));run(read('kart-materials.js'));run(read('vehicles.js').split('// ---------- Item / token pickups ----------')[0]);run(read('kart-assets.js'));
// Weld positions conceptually so normal/UV splits do not look like open mesh edges.
function assertClosedSkin(geometry,label){
 const p=geometry.attributes.position,ids=[],vertices=new Map(),edges=new Map();
 for(let i=0;i<p.count;i++){
  const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
  if(!vertices.has(key))vertices.set(key,vertices.size);ids.push(vertices.get(key));
 }
 const idx=geometry.index,at=i=>ids[idx?idx.getX(i):i],n=idx?idx.count:p.count;
 for(let i=0;i<n;i+=3){const face=[at(i),at(i+1),at(i+2)];if(new Set(face).size<3)continue;
  for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);}
 }
 assert.equal([...edges.values()].filter(n=>n===1).length,0,label+': no open skin boundary');
}
(async()=>{
 const progress=[];c.progress=(n,total)=>progress.push([n,total]);await run('loadKartAssets(progress)');assert.equal(progress.length,run('ROSTER.length'));assert.equal(run('KART_ASSETS.templates.size'),run('ROSTER.length'));assert.equal(run('ROSTER.length'),20);
 let totalBytes=0,totalTriangles=0;
 for(const div of run('ROSTER')){
  const bytes=fs.readFileSync(path.join(root,'assets/models',div.id+'.glb'));totalBytes+=bytes.length;assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString().trim());assert.equal(gltf.images?.length||0,0,'No reference images can enter playable meshes');assert.ok(bytes.length<4*1024*1024,'bounded uncompressed asset size');
  const triangles=(gltf.meshes||[]).reduce((sum,mesh)=>sum+mesh.primitives.reduce((n,p)=>n+gltf.accessors[p.indices===undefined?p.attributes.POSITION:p.indices].count/3,0),0);if(['ledger','terra','obsidian','civic','cognara','gaia','nomad','eon'].includes(div.id))assert.ok(triangles<50000,div.id+': under 50,000 triangle budget ('+triangles+')');
  c.div=div;const a=run('buildKart(div)'),b=run('buildKart(div)');assert.equal(a.userData.asset,'blender-glb');
  for(const [i,name] of ['wheel-fl','wheel-fr','wheel-rl','wheel-rr'].entries())assert.deepEqual(a.getObjectByName(name).position.toArray().map(v=>Math.round(v*100)/100),Array.from(run('KART_WHEEL_REST')[i]),div.id+': wheel '+name+' local pivot');
  for(const state of ['idle','drive','drift','boost','spinout','hit','victory','defeat']){c.clipKart=a;c.clipState=state;run('resetClipNodes(clipKart.userData);sampleKartClip(clipState,.25,1,clipKart.userData)');a.updateMatrixWorld(true);a.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),div.id+': '+state+' transform'));}
  run('resetClipNodes(clipKart.userData)');a.updateMatrixWorld(true);
  assertClosedSkin(a.getObjectByName('head-mesh').geometry,div.id+' head');
  const paint=[];a.traverse(o=>{if(o.isMesh&&o.material?.name===a.getObjectByName('helmet-shell').material.name)paint.push(o.material);});assert.ok(paint.length>0,div.id+': painted body exists');
  const expectedPaint=new THREE.Color(div.acc).convertSRGBToLinear();for(const m of paint)assert.ok(m.color.distanceTo?m.color.distanceTo(expectedPaint)<1e-6:m.color.equals(expectedPaint),div.id+': full body matches division paint');
  const skin=a.getObjectByName('head-mesh').material,templateSkin=run('KART_ASSETS.templates.get(div.id)').getObjectByName('head-mesh').material;
  assert.notEqual(skin,templateSkin,'lighting never mutates cached model material');assert.ok(skin.roughness>=.7&&skin.metalness<.05&&!(skin.clearcoat>0),div.id+': loaded suit remains matte fabric');
  for(const name of ['helmet-shell','helmet-mirrored-visor','suit-raised-collar','harness-buckle','racing-glove','racing-boot','steering-hub','shift-paddle','wheel-center-marker'])assert.ok(a.getObjectByName(name),div.id+': finished equipment '+name);
  assert.equal(a.getObjectByName('helmet-shell').parent,a.userData.head,'helmet follows articulated head');
  assert.equal(a.getObjectByName('shift-paddle').parent,a.userData.steeringWheel,'paddles follow physical wheel');
  assert.notEqual(a.userData.body,b.userData.body);assert.notEqual(a.userData.exhaust[0].material,b.userData.exhaust[0].material);
  assert.equal(a.getObjectByName('torso').geometry,b.getObjectByName('torso').geometry,'immutable meshes shared');
  a.updateMatrixWorld(true);const torsoBox=new THREE.Box3().setFromObject(a.getObjectByName('torso')),headBox=new THREE.Box3().setFromObject(a.getObjectByName('head-mesh')),torsoSize=torsoBox.getSize(new THREE.Vector3());
  assert.ok(torsoSize.y>1.4&&torsoSize.x>.65&&torsoSize.z>.65,div.id+': full torso, hips and legs survive Blender processing');
  assert.ok(torsoBox.max.y>=headBox.min.y-.08,div.id+': neck remains attached to head');
  for(const side of ['l','r']){const bounds=new THREE.Box3().setFromObject(a.getObjectByName('arm-'+side+'-mesh')).getSize(new THREE.Vector3());assert.ok(bounds.y>.3&&bounds.z>.5,div.id+': complete articulated arm '+side);}

  // Real shipped meshes must keep both gloves on their moving steering grips,
  // including scaled pilots and additive drift/boost/hit poses.
  const templateArm=run('KART_ASSETS.templates.get(div.id)').getObjectByName('arm-l-mesh').geometry;
  const templatePositions=Float32Array.from(templateArm.attributes.position.array);
  assert.notEqual(a.getObjectByName('arm-l-mesh').geometry,templateArm,'deforming sleeves are instance-owned');
  for(const state of ['idle','drive','drift','boost','hit','defeat','victory','spinout'])for(const turn of [-1,0,1]){
    c.clipKart=a;c.clipState=state;c.turn=turn;
    run('resetClipNodes(clipKart.userData);clipKart.userData.steeringWheel.rotation.z=turn;clipKart.userData.pilot.rotation.z=turn*.14;sampleKartClip(clipState,.25,1,clipKart.userData);constrainKartHands(clipKart,clipState)');
    a.updateMatrixWorld(true);
    for(const [i,contact] of a.userData.contactRig.arms.entries()){
      if(state==='spinout'||state==='victory'&&i===1)continue;
      const actual=contact.arm.getObjectByName('racing-glove').getWorldPosition(new THREE.Vector3());
      const expected=a.userData.steeringWheel.localToWorld(contact.grip.clone());
      assert.ok(actual.distanceTo(expected)<1e-5,div.id+': '+state+' glove '+i+' stays on rim');
      assert.ok(contact.mesh.geometry.attributes.position.array.every(Number.isFinite),'finite deformed sleeve');
      // Vertices at the shoulder remain fixed, so the sleeve never separates from the torso.
      for(let j=0;j<contact.weights.length;j++)if(contact.weights[j]===0)for(let k=0;k<3;k++)assert.equal(contact.mesh.geometry.attributes.position.array[j*3+k],contact.rest[j*3+k]);
    }
  }
  assert.deepEqual(Array.from(templateArm.attributes.position.array),Array.from(templatePositions),'animation never deforms another racer or cached template');
  run('resetClipNodes(clipKart.userData)');
  assert.equal(a.getObjectByName('cockpit-contact-hardware').children.length,2,'six cockpit components cost only two material draws');
  assert.ok(a.getObjectByName('seat-back-shell')&&a.getObjectByName('pedal-plate'),'cockpit has physical seat and pedal contacts');
  a.userData.exhaust[0].material.emissiveIntensity=9;assert.notEqual(b.userData.exhaust[0].material.emissiveIntensity,9);
  const clone=a.clone(true);assert.ok(clone.getObjectByName('torso'),'ability ghost can clone GLB rig without circular userData');
  c.kart=a;run('for(let i=0;i<60;i++)animateShowroomKart(kart,i/60,1/60)');a.updateMatrixWorld(true);
  a.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite),'finite animated GLB transforms');if(o.isMesh){const pos=o.geometry.attributes.position;assert.ok(pos.array.every(Number.isFinite));totalTriangles+=(o.geometry.index?.count||pos.count)/3;}});
  let disposed=0;a.getObjectByName('torso').geometry.addEventListener('dispose',()=>disposed++);c.kart=a;run('disposeKart(kart)');assert.equal(disposed,0,'despawn retains cached GLB geometry');c.kart=b;run('disposeKart(kart)');
 }
 assert.ok(totalBytes<40*1024*1024,'whole roster download budget');
 console.log(`PASS playable assets: ${run('ROSTER.length')} actual GLBs, independent live rigs/materials, shared geometry, animation, ghost cloning and disposal; ${(totalBytes/1048576).toFixed(2)} MiB, ${Math.round(totalTriangles)} triangles.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
