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
