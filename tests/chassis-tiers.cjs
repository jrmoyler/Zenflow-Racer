// Chassis tiers: every division ships a Nightfall (dark) and Apex Pearl (final) model that
// meets the runtime contract, and the economy gates them in the documented order.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'core.js'),'utf8').split('function hexToRgb')[0]+';this.ROSTER=ROSTER;this.KART_TIERS=KART_TIERS;',ctx);
const {ROSTER,KART_TIERS}=ctx;
const Economy=require(path.join(root,'economy.js'));
const cfg=JSON.parse(fs.readFileSync(path.join(root,'tools/scan-karts.json'),'utf8'));

function readGlb(file){
 const data=fs.readFileSync(file);assert.equal(data.toString('ascii',0,4),'glTF',file+' is a binary glTF');
 const length=data.readUInt32LE(12);return {json:JSON.parse(data.toString('utf8',20,20+length)),bytes:data.length};
}
const triangles=(json,meshIndex)=>json.meshes[meshIndex].primitives.reduce((n,p)=>n+json.accessors[p.indices].count/3,0);

assert.equal(KART_TIERS.map(t=>t.id).join(),'factory,dark,final','three tiers in progression order');
let total=0;
for(const div of ROSTER){
 assert.match(cfg.accent[div.id]||'',/^#[0-9A-F]{6}$/i,div.id+' has a reference accent');
 for(const tier of ['dark','final']){
  const file=path.join(root,'assets/models/tiers',`${div.id}-${tier}.glb`);
  assert.ok(fs.existsSync(file),`${div.id}-${tier}.glb exists`);
  const {json,bytes}=readGlb(file);total+=bytes;
  assert.ok(bytes<2.2e6,`${div.id}-${tier} stays under 2.2 MB (${bytes})`);
  const top=json.nodes[json.scenes[json.scene].nodes[0]];
  assert.equal(top.extras.zf_root,true);assert.equal(top.extras.zf_id,div.id);assert.equal(top.extras.zf_tier,tier);
  const [w,h,l]=top.extras.zf_size;assert.ok(Math.abs(l-4.5)<1e-3&&w>1.2&&w<3.6&&h>1&&h<3.6,`${div.id}-${tier} fitted to the kart envelope`);
  const children=top.children.map(i=>json.nodes[i]),chassis=children.find(n=>n.name==='chassis');
  assert.ok(chassis&&chassis.mesh!==undefined,'chassis mesh present');
  const tris=children.reduce((n,c)=>n+(c.mesh!==undefined?triangles(json,c.mesh):0),0);
  assert.ok(tris<50000,`${div.id}-${tier} under the 50k triangle budget (${tris})`);
  const wheels=children.filter(n=>/^wheel-(fl|fr|rl|rr)$/.test(n.name));
  const override=cfg.overrides[`${tier}-${div.id}`]||{};
  assert.equal(wheels.length,override.noWheels?0:4,`${div.id}-${tier} wheel split matches its fitting notes`);
  for(const wheel of wheels){
   const [x,y,z]=wheel.translation,front=wheel.name[6]==='f',right=wheel.name[7]==='r';
   assert.ok(y>0&&y<1&&Math.abs(z)<2.3&&Math.abs(x)<1.8,`${div.id}-${tier} ${wheel.name} sits inside the kart`);
   assert.equal(z<0,front,`${wheel.name} is on the correct axle`);assert.equal(x>0,right,`${wheel.name} is on the correct side`);
   assert.ok(wheel.extras.zf_radius>.2&&wheel.extras.zf_radius<.8,'plausible tyre radius');
  }
  const material=json.materials[0];
  assert.ok(material.pbrMetallicRoughness.baseColorTexture&&material.emissiveTexture,'textured with a division-light emissive map');
  assert.ok(json.images.every(img=>img.mimeType==='image/jpeg'&&img.bufferView!==undefined),'textures are embedded JPEG');
 }
}
assert.ok(total<60e6,'all forty tier models together stay under 60 MB');
console.log(`PASS forty tier chassis: contract nodes, fitted envelope, wheel axles, triangle and size budgets (${(total/1e6).toFixed(1)} MB)`);

// Economy: Nightfall is bought, Apex Pearl is earned, Factory is always there.
const ids=['fire'];let s=Economy.migrate({wallet:10000},ids);
assert.match(Economy.tierLock(s,'nexus','final'),/Requires Nightfall/);
assert.equal(Economy.purchase(s,'chassis',{racer:'nexus',tier:'final'},ids),s,'Apex cannot skip Nightfall');
s=Economy.purchase(s,'chassis',{racer:'nexus',tier:'dark'},ids);
assert.deepEqual(s.chassisOwned.nexus,['dark']);assert.equal(s.chassis.nexus,'dark');assert.equal(s.wallet,10000-Economy.TIERS.dark.price);
assert.equal(Economy.purchase(s,'chassis',{racer:'nexus',tier:'dark'},ids),s,'no double charge');
assert.match(Economy.tierLock(s,'nexus','final'),/Career milestone: 8 more finished races and 2 more wins/);
s={...s,careerStats:{...s.careerStats,races:8,wins:1}};assert.match(Economy.tierLock(s,'nexus','final'),/^Career milestone: 1 more win$/);
s={...s,careerStats:{...s.careerStats,wins:2}};assert.equal(Economy.tierLock(s,'nexus','final'),null);
const poor={...s,wallet:10};assert.equal(Economy.purchase(poor,'chassis',{racer:'nexus',tier:'final'},ids),poor,'credits still required');
s=Economy.purchase(s,'chassis',{racer:'nexus',tier:'final'},ids);assert.deepEqual(s.chassisOwned.nexus,['dark','final']);assert.equal(s.chassis.nexus,'final');
s=Economy.equipChassis(s,'nexus','dark');assert.equal(s.chassis.nexus,'dark');
s=Economy.equipChassis(s,'nexus','factory');assert.equal(s.chassis.nexus,undefined);
assert.equal(Economy.equipChassis(s,'eon','final'),s,'unowned tiers cannot be equipped');
const restored=Economy.migrate(JSON.parse(JSON.stringify({...s,chassis:{nexus:'final'}})),ids);
assert.deepEqual(restored.chassisOwned.nexus,['dark','final']);assert.equal(restored.chassis.nexus,'final');
const forged=Economy.migrate({chassisOwned:{eon:['final'],'../x':['dark'],gaia:'dark'},chassis:{eon:'final',civic:'dark'}},ids);
assert.deepEqual(forged.chassisOwned,{},'Apex without Nightfall and malformed entries are dropped');assert.deepEqual(forged.chassis,{},'equips require ownership');
assert.ok(Economy.FIELDS.includes('chassisOwned')&&Economy.FIELDS.includes('chassis'),'tier ownership is persisted with the wallet');
console.log('PASS chassis tier economy: purchase order, milestone reasons, equip/unequip, persistence and forged-save rejection');

// Runtime: every Tier II/III chassis loads through the shipped GLTFLoader and its sculpted pilot is
// skinned out of the fused scan, so it steers, leans and looks like the factory pilot does.
(async()=>{
 const THREE=require('../vendor/three.min.js'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
 // Embedded JPEGs decode to a stub image: this test checks geometry, weights and motion, not pixels.
 globalThis.document=globalThis.document||{createElementNS:()=>{const l={};return {style:{},addEventListener(t,f){l[t]=f;},removeEventListener(){},set src(v){setTimeout(()=>l.load&&l.load({}));},width:4,height:4};}};
 const c={THREE,console,TextDecoder,TextEncoder,ArrayBuffer,Uint8Array,self:{URL},URL,Blob,setTimeout,performance,FALLBACK_GRAPHICS:true,TEX:{},document:{createElement:()=>({getContext:()=>null})}};
 vm.createContext(c);const run=s=>vm.runInContext(s,c);
 run(read('vendor/GLTFLoader.js'));const parser=new THREE.GLTFLoader();
 THREE.GLTFLoader.prototype.loadAsync=async file=>{const b=fs.readFileSync(path.join(root,file));return new Promise((ok,fail)=>parser.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'',ok,fail));};
 run(read('core.js').split('function hexToRgb')[0]);run(read('kart-clips.js'));run(read('kart-materials.js'));run(read('vehicles.js').split('// ---------- Item / token pickups ----------')[0]);run(read('kart-assets.js'));
 run('var orientOnTrack=(o,u,lat,h,yaw)=>{o.position.set(lat,h,u);o.rotation.set(0,yaw,0);}');
 const v=new THREE.Vector3();
 const skinned=(mesh,i)=>{mesh.boneTransform(i,v);return v.clone();};
 for(const div of ROSTER)for(const tier of ['dark','final']){
  const key=div.id+'-'+tier;c.id=div.id;c.tier=tier;
  assert.equal(await run('loadKartTier(id,tier)'),true,key+' loads through GLTFLoader');
  assert.ok(run('KART_TIER_PILOT[id+"-"+tier]'),key+' has measured pilot landmarks');
  const template=run('KART_TIER_ASSETS.templates.get(id+"-"+tier)'),templatePos=Float32Array.from(template.getObjectByName('chassis').geometry.attributes.position.array);
  c.div=div;const kart=run('buildKart(div,tier)'),ud=kart.userData,mesh=kart.getObjectByName('chassis');
  assert.equal(ud.asset,'fitted-glb');assert.equal(ud.fittedPilot,'skinned',key+' pilot is articulated, not rigid');
  assert.ok(mesh.isSkinnedMesh&&mesh.material.skinning,key+' chassis is skinned');
  assert.equal(mesh.skeleton.bones.map(b=>b.name).join(),'body,torso,head,arm-l,arm-r,steering-wheel');
  assert.equal(ud.pilot.position.y,1,'pilot keeps the shared seat height contract');
  for(const name of ['head','arm-l','arm-r','torso'])assert.ok(ud.pilot.getObjectByName(name),key+' '+name+' hangs from the pilot');
  // Weights: normalized, and every articulated part owns a real share of the sculpt.
  const g=mesh.geometry,sw=g.attributes.skinWeight,si=g.attributes.skinIndex,share=new Float64Array(6),n=sw.count;
  for(let i=0;i<n;i++){let sum=0;for(let j=0;j<4;j++){sum+=sw.array[i*4+j];share[si.array[i*4+j]]+=sw.array[i*4+j];}assert.ok(Math.abs(sum-1)<1e-4,key+' weights sum to one');}
  for(const [bone,min] of [[1,.01],[2,.005],[5,.001]])assert.ok(share[bone]/n>min,`${key} bone ${bone} drives ${(share[bone]/n*100).toFixed(2)}% of the sculpt`);
  assert.ok(share[3]+share[4]>0,key+' arms carry sleeves');assert.ok(share[0]/n>.55,key+' coachwork stays on the sprung body');
  // Motion: steer, lean and look move the helmet and grips; the nose never moves relative to the body.
  const joints=ud.pilotJoints,near=(p,r)=>{let best=-1,d=1e9;const P=g.attributes.position;for(let i=0;i<P.count;i++){const e=Math.hypot(P.getX(i)-p[0],P.getY(i)-p[1],P.getZ(i)-p[2]);if(e<d&&e<r){d=e;best=i;}}return best;};
  const top=near([joints.helmet[0],joints.helmet[1],joints.helmet[2]-joints.s],joints.s*.7),nose=(()=>{const P=g.attributes.position;let k=0;for(let i=1;i<P.count;i++)if(P.getZ(i)<P.getZ(k))k=i;return k;})();
  assert.ok(top>=0,key+' helmet visor found');
  kart.updateMatrixWorld(true);mesh.skeleton.update();const restTop=skinned(mesh,top),restNose=skinned(mesh,nose);
  assert.ok(restTop.distanceTo(new THREE.Vector3().fromBufferAttribute(g.attributes.position,top))<1e-4,key+' bind pose is the scan');
  c.r={mesh:kart,speed:18,steer:1,drifting:true,driftDir:1,spin:0,wheelspin:0,boost:0,brake:false,finished:false,rank:3,hitCd:0,hop:0,wheelRot:0,visualYaw:0,theta:0,lat:0,u:.1,throttle:1,shield:0,distance:.1};
  run('for(let i=0;i<40;i++)animateKart(r,1/60,0)');
  assert.ok(Math.abs(ud.steeringWheel.rotation.z)>.3,key+' steering wheel turns');assert.ok(Math.abs(ud.head.rotation.y)>.2,key+' head looks into the corner');assert.ok(Math.abs(ud.pilot.rotation.y)>.1,key+' torso leans into the drift');
  kart.position.set(0,0,0);kart.rotation.set(0,0,0);ud.body.position.set(0,0,0);ud.body.rotation.set(0,0,0);ud.body.scale.set(1,1,1);kart.updateMatrixWorld(true);mesh.skeleton.update();
  const turnedTop=skinned(mesh,top);assert.ok(turnedTop.distanceTo(restTop)>.03,`${key} helmet moves (${turnedTop.distanceTo(restTop).toFixed(3)} m)`);
  assert.ok(skinned(mesh,nose).distanceTo(restNose)<1e-4,key+' nose cone is not dragged by the pilot');
  kart.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),key+' finite pose'));
  // Victory and the showroom turntable also drive the sculpt.
  c.r.finished=true;c.r.rank=1;c.r.steer=0;c.r.drifting=false;run('for(let i=0;i<30;i++)animateKart(r,1/60,0)');assert.ok(ud.clipState.active==='victory'&&ud.arms[1].rotation.x>.2,key+' celebrates with the right arm');
  c.kart=kart;run('for(let i=0;i<30;i++)animateShowroomKart(kart,i/30,1/30,.4)');assert.ok(Math.abs(ud.head.rotation.y)>.01,key+' showroom pilot follows the camera');
  assert.deepEqual(Array.from(template.getObjectByName('chassis').geometry.attributes.position.array),Array.from(templatePos),key+' template scan never deforms');
  const other=run('buildKart(div,tier)');assert.notEqual(other.getObjectByName('chassis').skeleton,mesh.skeleton,'each kart owns its skeleton');
  let freed=0;mesh.skeleton.dispose=()=>{freed++;};c.kart=kart;run('disposeKart(kart)');c.kart=other;run('disposeKart(kart)');assert.equal(freed,1,'despawn releases the skeleton');
 }
 console.log('PASS forty tier pilots: skinned out of the fused scan, steering, drift lean, look-ahead, victory and showroom motion; template-safe and disposed');
})().catch(e=>{console.error(e);process.exitCode=1;});
