// Power impact kit: fixed budgets, no leaks across repeated casts, and a full return to rest.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const THREE=require('three');
const scene=new THREE.Scene();
const context={THREE,scene,Math,Map,Float32Array,console,document:{createElement:()=>({getContext:()=>null})},
 game:{trauma:0},trackUp:(u,out)=>out.set(0,1,0),trackPoint:(u,lat,h,out)=>out.set(lat,h,u*1000),orientOnTrack:(o,u,lat,h)=>o.position.set(lat,h,u*1000)};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../power-vfx.js'),'utf8')+';this.powerVFX=powerVFX;',context);
const fx=context.powerVFX;
// Stub hosts (no THREE, no scene) are a silent no-op.
{const bare={Math,console};vm.createContext(bare);vm.runInContext(fs.readFileSync(path.join(__dirname,'../power-vfx.js'),'utf8')+';this.powerVFX=powerVFX;',bare);bare.powerVFX.init();bare.powerVFX.cast({u:0});bare.powerVFX.update(.1);assert.equal(bare.powerVFX.ready(),false);}
fx.init();assert.equal(fx.ready(),true);
const baseline=scene.children.length,lights=scene.children.filter(o=>o.isPointLight).length;
assert.ok(lights>=1&&lights<=3,'a small fixed light pool');
const kart={u:.1,lat:0,isPlayer:true,mesh:{position:new THREE.Vector3(0,0,100)}},rival={u:.12,lat:1,mesh:{position:new THREE.Vector3(1,0,120)}};
for(let i=0;i<40;i++){fx.cast(kart,'#ff508f');fx.impact(rival,'#6ec9ff');fx.touch(rival,'#baff36');fx.sustain('field',o=>o.set(0,1,100),'#69dcff');fx.update(1/60);}
assert.equal(scene.children.length,baseline,'repeated casts reuse pooled objects');
assert.equal(scene.children.filter(o=>o.isPointLight).length,lights,'lights are never added mid-race (no shader recompiles)');
assert.ok(scene.children.some(o=>o.isPointLight&&o.intensity>0),'casts light the scene');
assert.ok(context.game.trauma>0,'the player feels their own cast');
for(let i=0;i<240;i++)fx.update(1/60);
assert.ok(scene.children.filter(o=>o.isPointLight).every(o=>o.intensity===0),'lights return to dark');
assert.ok(scene.children.filter(o=>o.isSprite).every(o=>!o.visible),'flares retire');
assert.ok(scene.children.filter(o=>o.name==='power-vfx-decal').every(o=>!o.visible),'decals retire');
const motes=scene.getObjectByName('power-vfx-motes').geometry.attributes.size.array;assert.ok(motes.every(v=>v===0),'motes retire');
fx.cast(kart,'#fff');fx.clear();fx.update(.5);assert.ok(scene.children.filter(o=>o.isPointLight).every(o=>o.intensity===0),'clear cancels queued releases');
console.log('PASS power impact kit: fixed pools, no scene growth or light-count changes, full return to rest, safe no-op without a host');
