// GPU-free lifecycle tests for the race presentation FX layer with the real bundled Three.js r128.
module.exports=function registerRaceFXTests({test,assert}){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const THREE=require('../vendor/three.min.js');
 const source=fs.readFileSync(path.join(__dirname,'../racefx.js'),'utf8');
 function mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
 function fixture(flags={}){
  const scene=new THREE.Scene();const classes=new Set();
  const hud={classList:{add:(...x)=>x.forEach(c=>classes.add(c)),remove:(...x)=>x.forEach(c=>classes.delete(c)),contains:c=>classes.has(c)}};
  const c=Object.assign({THREE,scene,console,Math,innerWidth:1400,innerHeight:900,TRACK_W:14,MOBILEFX:false,LOWFX:false,rng:mulberry(7),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t,
   camera:new THREE.PerspectiveCamera(70,1.5,.3,1400),renderer:{},TEX:{spark:new THREE.Texture()},game:{laps:3,time:0},track:{len:1000},
   document:{getElementById:id=>id==='hud'?hud:null},
   trackPoint:(u,lat,h,out)=>out.set(u*1000,h,lat),trackTan:(u,out)=>out.set(1,0,0),trackUp:(u,out)=>out.set(0,1,0),trackRight:(u,out)=>out.set(0,0,1),
   orientOnTrack:(m,u,lat,h)=>m.position.set(u*1000,h,lat)},flags);
  vm.createContext(c);vm.runInContext(source,c);
  return {scene,classes,run:s=>vm.runInContext(s,c),ctx:c};
 }
 // Fake racers: rigged (wheel pivots + nested exhausts like vehicles.js), bare group, and no mesh at all.
 function rigged(ctx,u,lat,isPlayer){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);const wheels=[],exhaust=[];
  [[-1.23,.6,-1.25],[1.23,.6,-1.25],[-1.23,.6,1.28],[1.23,.6,1.28]].forEach(p=>{const pivot=new THREE.Group();pivot.position.set(...p);root.add(pivot);wheels.push({pivot});});
  for(const x of [-.48,.48]){const e=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());e.position.set(x,.37,1.89);body.add(e);exhaust.push(e);}
  root.userData={wheels,exhaust,body};root.position.set(u*1000,.02,lat);
  return {u,lat,speed:42,maxSpeedBase:40,steer:.6,theta:.1,drifting:true,driftDir:1,driftTier:2,driftTime:2,boost:1,boostMult:1.3,spin:0,hitCd:0,shield:0,wheelspin:0,hop:0,finished:false,rank:1,isPlayer,div:{id:'zenflow',acc:'#69dcff'},mesh:root};
 }
 function bare(u,lat){return {u,lat,speed:30,maxSpeedBase:40,drifting:true,driftTier:1,boost:0,spin:0,wheelspin:1,hop:0,isPlayer:false,div:{id:'nexus',acc:'#ffc369'},mesh:new THREE.Group()};}
 function meshless(u,lat){return {u,lat,speed:20,maxSpeedBase:40,drifting:false,driftTier:0,boost:.5,spin:1,isPlayer:false,div:{id:'juris',acc:'#ffcf68'}};}
 const HOOKS=['onDriftTier','onBoost','onHit','onShieldBlock','onWall','onToken','onItemBox','onLap','onFinish','onSpecial','step','update'];
 function assertFinite(scene){scene.traverse(o=>{for(const v of [...o.position.toArray(),...o.scale.toArray(),...o.quaternion.toArray()])assert.ok(Number.isFinite(v),'finite transform '+o.name);
  if(o.geometry){for(const [k,attr] of Object.entries(o.geometry.attributes))assert.ok(attr.array.every(Number.isFinite),`finite attribute ${k} on ${o.name}`);if(o.geometry.index)assert.ok(o.geometry.index.array.every(i=>i<o.geometry.attributes.position.count),'valid index on '+o.name);}
  if(o.isInstancedMesh){const m=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite),'finite instance on '+o.name);}}});}
 function fireAll(ctx,run,racers,rounds){
  const pos=new THREE.Vector3();ctx.fakeRacers=racers;ctx.fakePos=pos;
  for(let i=0;i<rounds;i++){const r=racers[i%racers.length];ctx.fr=r;ctx.fi=i;pos.set(i*3,1,(i%7)-3);
   r.driftTier=i%4;r.drifting=i%5!==0;r.boost=i%3?1:0;r.wheelspin=i%6===0?1:0;r.spin=i%9===0?1:0;r.lat=Math.sin(i*.05)*6;r.u=(r.u+.0006)%1;if(r.mesh)r.mesh.position.set(r.u*1000,.02,r.lat);
   run('raceFX.step(fr,1/120);raceFX.step(fr,1/120);raceFX.onDriftTier(fr,fi%4);raceFX.onBoost(fr,(fi%5)/4);raceFX.onHit(fr,"test");raceFX.onShieldBlock(fr);raceFX.onWall(fr,fi%2?1:-1);raceFX.onToken(fakePos,fi%10);raceFX.onItemBox(fakePos);raceFX.onLap(fr,1+fi%3);raceFX.onFinish(fr);raceFX.onSpecial(fr,fi%2?"signal":undefined);raceFX.update(1/60,fr)');
  }
 }
 test('Race FX init adds a bounded set of pooled meshes with finite geometry',()=>{const {scene,run}=fixture();assert.equal(run('raceFX.init()'),true);assert.ok(run('raceFX.ready'));
  const n=scene.children.length;assert.ok(n>0&&n<=25,'bounded draw calls: '+n);assertFinite(scene);assert.ok(run('raceFX.budget.skidQuads')>=600);assert.ok(run('raceFX.budget.ribbonSamples')>=24);
  assert.ok(scene.children.every(o=>o.frustumCulled===false),'dynamic buffers skip frustum culling');assert.ok(scene.children.every(o=>o.material.transparent&&o.material.depthWrite===false),'overlay materials never write depth');});
 test('Race FX hooks fired 200 times keep geometry finite, object count constant and post hints normalised',()=>{const {scene,run,ctx,classes}=fixture();run('raceFX.init()');const n=scene.children.length;
  const racers=[rigged(ctx,.2,1,true),rigged(ctx,.4,-2,false),bare(.6,5.5),meshless(.8,-6)];fireAll(ctx,run,racers,200);
  assert.equal(scene.children.length,n,'pools never add scene objects');assertFinite(scene);
  const post=run('raceFX.post');for(const k of ['bloom','vignette','chroma','hit','flash'])assert.ok(post[k]>=0&&post[k]<=1,'post '+k+' normalised');assert.ok(post.bloom>0,'boost/hit drive bloom');
  assert.ok(scene.getObjectByName('fx-drift-ribbons').visible,'ribbons visible while drifting');assert.ok(scene.getObjectByName('fx-boost-flames').visible,'flames visible while boosting');assert.ok(scene.getObjectByName('fx-speed-lines').visible,'speed lines visible under boost');
  assert.ok(classes.has('fx-boost')||classes.has('fx-hit')||classes.has('fx-lap'),'HUD-side FX classes toggled');
  for(let i=0;i<300;i++)run('raceFX.update(1/30,null)');assert.ok(!scene.getObjectByName('fx-shock-rings').visible&&!scene.getObjectByName('fx-shards').visible&&!scene.getObjectByName('fx-confetti').visible,'bursts expire');assert.equal(classes.size,0,'timed HUD classes clear');
  assert.ok(run('raceFX.post.bloom')<.02&&run('raceFX.post.chroma')<.02,'post hints settle to zero');});
 test('Race FX skid ring buffer wraps without growth and continuity survives teleports',()=>{const {scene,run,ctx}=fixture();run('raceFX.init()');const r=rigged(ctx,0,0,true);r.drifting=true;ctx.fr=r;
  for(let i=0;i<3000;i++){r.u=(i*.002)%1;r.mesh.position.set(r.u*1000,.02,Math.sin(i*.01)*4);if(i===1500)r.mesh.position.x+=400;run('raceFX.step(fr,1/120)');if(i%2)run('raceFX.update(1/60,fr)');}
  const skid=scene.getObjectByName('fx-skid-marks');assert.equal(skid.geometry.attributes.position.count,600*4);assert.ok(skid.geometry.attributes.aBorn.array.filter(v=>v>=0).length>=600*4,'ring buffer fully cycled');assert.ok(skid.geometry.attributes.aStr.array.some(v=>v>0),'quads were written');assertFinite(scene);});
 test('Race FX clear removes every object and disposes each resource exactly once; re-init works',()=>{const {scene,run,ctx}=fixture();run('raceFX.init()');const n=scene.children.length;
  let geos=0,mats=0;const seenG=new Set(),seenM=new Set();scene.traverse(o=>{if(o.geometry&&!seenG.has(o.geometry)){seenG.add(o.geometry);o.geometry.addEventListener('dispose',()=>geos++);}if(o.material&&!seenM.has(o.material)){seenM.add(o.material);o.material.addEventListener('dispose',()=>mats++);}});
  fireAll(ctx,run,[rigged(ctx,.1,0,true)],5);run('raceFX.clear()');assert.equal(scene.children.length,0);assert.equal(geos,seenG.size,'each geometry disposed once');assert.equal(mats,seenM.size,'each material disposed once');assert.equal(run('raceFX.ready'),false);
  run('raceFX.clear()');assert.equal(geos,seenG.size,'repeat clear never redisposes');for(const h of HOOKS)run(`raceFX.${h}(fakeRacers[0],1)`);
  assert.equal(run('raceFX.init()'),true);assert.equal(scene.children.length,n,'second init rebuilds the same pools');run('raceFX.init()');assert.equal(scene.children.length,n,'repeated init resets instead of duplicating');assertFinite(scene);run('raceFX.clear()');assert.equal(scene.children.length,0);});
 test('Race FX hooks are silent no-ops before init and under the stub Three context',()=>{const {run,ctx}=fixture();ctx.fakeRacers=[rigged(ctx,.1,0,true)];ctx.fakePos=new THREE.Vector3();
  for(const h of HOOKS)run(`raceFX.${h}(fakeRacers[0],1)`);run('raceFX.onToken(fakePos,3);raceFX.onItemBox(fakePos);raceFX.update(.1,null);raceFX.clear()');
  class Vec{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}set(){return this;}copy(){return this;}}
  const stub={THREE:{Vector3:Vec},scene:{add(){},remove(){}},document:{getElementById:()=>null},console,Math};vm.createContext(stub);vm.runInContext(source,stub);
  assert.equal(vm.runInContext('raceFX.init()',stub),false,'stub host cannot build GPU pools');stub.r={u:0,lat:0,speed:10,isPlayer:true,mesh:{}};stub.p=new Vec();
  for(const h of HOOKS)vm.runInContext(`raceFX.${h}(r,1)`,stub);vm.runInContext('raceFX.onToken(p,1);raceFX.onItemBox(p);raceFX.update(.016,r);raceFX.clear()',stub);
  for(const k of Object.keys(vm.runInContext('raceFX.post',stub)))assert.equal(vm.runInContext(`raceFX.post.${k}`,stub),0);});
 test('Race FX mobile profile halves pool budgets and keeps the same draw-call bound',()=>{const desktop=fixture(),mobile=fixture({MOBILEFX:true});desktop.run('raceFX.init()');mobile.run('raceFX.init()');
  const d=desktop.run('raceFX.budget'),m=mobile.run('raceFX.budget');assert.equal(m.low,true);for(const k of ['skidQuads','shards','petals','puffs','glints'])assert.ok(m[k]<=d[k]/2+1,`mobile ${k} halved: ${m[k]} vs ${d[k]}`);
  assert.equal(mobile.scene.children.length,desktop.scene.children.length);const racers=[rigged(mobile.ctx,.3,2,true)];fireAll(mobile.ctx,mobile.run,racers,40);assertFinite(mobile.scene);});
};
