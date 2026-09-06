const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
let source=readFileSync(process.argv[2]||path.join(__dirname,'../game.js'),'utf8');
if(source.includes('<!DOCTYPE')) source=source.slice(source.indexOf('// ---------- Game state ----------')).split('</script>')[0];
const noop=()=>{};
const coreSource=readFileSync(path.join(__dirname,'../core.js'),'utf8');
const roster=vm.runInNewContext(coreSource.match(/const ROSTER = (\[[\s\S]*?\n\]);/)[1]);
class Vec {constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});} set(x,y,z){Object.assign(this,{x,y,z});return this;} copy(){return this;} clone(){return new Vec();} add(){return this;} addScaledVector(){return this;} multiplyScalar(){return this;} normalize(){return this;} lerp(){return this;} applyAxisAngle(){return this;}}
const elements=new Map(),listeners={};
function element(id){if(!elements.has(id)){const classes=new Set();elements.set(id,{id,textContent:'',innerHTML:'',className:'',style:{setProperty(k,v){this[k]=v;}},dataset:{},classList:{add:(...x)=>x.forEach(v=>classes.add(v)),remove:(...x)=>x.forEach(v=>classes.delete(v)),contains:x=>classes.has(x),toggle:noop},querySelector:x=>element(id+x),querySelectorAll:()=>[],getContext:()=>new Proxy({},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>{t[k]=v;return true;}}),events:{},addEventListener(n,fn){this.events[n]=fn;},setAttribute:noop,focus:noop,setPointerCapture:noop,getBoundingClientRect:()=>({left:0,width:150})});}return elements.get(id);}
const context={console,Math,Set,Map,THREE:{Vector3:Vec},window:{},document:{getElementById:element,querySelectorAll:()=>[],addEventListener:(n,fn)=>{listeners[n]=fn;},hidden:false},navigator:{getGamepads:()=>[]},localStorage:{getItem:()=>null,setItem:noop},performance:{now:()=>100},matchMedia:()=>({matches:false,addEventListener:noop}),addEventListener:(n,fn)=>{listeners[n]=fn;},requestAnimationFrame:noop,setTimeout:()=>1,clearTimeout:noop,innerWidth:1400,innerHeight:900,devicePixelRatio:1,scene:{add:noop,remove:noop},rng:()=>.99,lerp:(a,b,t)=>a+(b-a)*t,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),wrap01:v=>((v%1)+1)%1,track:{len:1000},TRACK_W:16,trackAG:()=>0,trackCurv:()=>0,orientOnTrack:noop,trackPoint:noop,trackTan:noop,trackUp:noop,trackRight:noop,_p:new Vec(),_v1:new Vec(),_v2:new Vec(),_v3:new Vec(),noiseHit:noop,SFX:new Proxy({},{get:()=>noop}),AUDIO:{on:false},audioInit:noop,audioUpdate:noop,ROSTER:roster,STAT_NAMES:[],itemBoxes:[],tokens:[],mines:[],missiles:[],sparksBlue:{emit:noop},sparksOrange:{emit:noop},sparksPink:{emit:noop},boostFx:{emit:noop},smokeFx:{emit:noop},goldFx:{emit:noop},hitFx:{emit:noop},ordinal:n=>n===1?'st':n===2?'nd':n===3?'rd':'th',renderer:{render:noop},camera:{},world:{traverse:noop},ITEMS:{burst:{name:'SIGNAL BURST'},shield:{name:'AEGIS SHIELD'},mine:{name:'LOOM MINE'},missile:{name:'VECTOR MISSILE'},pulse:{name:'OVERSEER PULSE'},triple:{name:'NODE CLUSTER'}},itemIconSVG:()=>''};
// Minimal kart rig matching the vehicles.js contract (named nodes with {x,y,z} transforms) so stepRacer -> animateKart runs headless.
const node=(name,x=0,y=0,z=0)=>({name,position:new Vec(x,y,z),rotation:new Vec(),scale:new Vec(1,1,1),material:{},visible:true,children:[],parent:null,getWorldPosition:v=>v,traverse(fn){fn(this);this.children.forEach(c=>c.traverse(fn));},add(...list){list.forEach(o=>{this.children.push(o);o.parent=this;});return this;}});
context.buildKart=div=>{const root=node(div.name+' Reference Chassis'),body=node('body'),pilot=node('pilot',0,1,.37),head=node('head',0,1.2,0),arms=[node('arm-l',-.34,.9,.02),node('arm-r',.34,.9,.02)],steeringWheel=node('steering-wheel',0,1.45,-.34),exhaust=[node('exhaust-l',-.48,.37,1.89),node('exhaust-r',.48,.37,1.89)],under=node('underbody-flow-ring'),shield=node('aegis-shield'),halo=node('halo'),star=node('star');
 const wheels=[[-1.23,.6,-1.25],[1.23,.6,-1.25],[-1.23,.6,1.28],[1.23,.6,1.28]].map((p,i)=>{const pivot=node(['wheel-fl','wheel-fr','wheel-rl','wheel-rr'][i],...p),spin=node('spin'),glow=node('wheel-light-ring');pivot.add(spin,glow);root.add(pivot);return {pivot,spin,glow,side:i%2?1:-1,rest:new Vec(...p)};});
 steeringWheel.rotation.x=-.7;root.add(body,under,shield);body.add(node('torso'),pilot,steeringWheel,...exhaust);pilot.add(head,...arms,halo,star);
 root.userData={wheels,body,pilot,head,arms,steeringWheel,exhaust,under,shield,halo,star,glow:{},chassis:div.id,clipState:null,clipNodes:null,anim:null};return root;};
vm.createContext(context);vm.runInContext(readFileSync(path.join(__dirname,'../kart-clips.js'),'utf8'),context);
const vehicleSource=readFileSync(path.join(__dirname,'../vehicles.js'),'utf8');vm.runInContext(vehicleSource.slice(vehicleSource.indexOf('// ---------- Kart rig animation'),vehicleSource.indexOf('// ---------- Item / token pickups')),context);vm.runInContext(readFileSync(path.join(__dirname,'../racefx.js'),'utf8'),context);vm.runInContext(readFileSync(path.join(__dirname,'../abilities.js'),'utf8'),context);vm.runInContext(source,context);
const run=s=>vm.runInContext(s,context);
const cases=[];function test(name,fn){try{fn();cases.push({name,pass:true});console.log('PASS',name);}catch(e){cases.push({name,pass:false,error:e.message});console.error('FAIL',name, e.stack);}}
function racer(id='zenflow'){run(`clearAbilities();tokens.length=0;missiles.length=0;globalThis.r=new Racer(ROSTER.find(d=>d.id==='${id}'),false,0);r.specialAI=Infinity;game.player=r;game.racers=[r];game.state='race';game.raceTime=0;Object.keys(input).forEach(k=>input[k]=false);`);}
function travel(distance){run(`r.throttle=false;r.brake=false;r.speed=${distance>0?50:-9};for(let i=0;i<${Math.ceil(Math.abs(distance)/.0001)};i++){r.speed=${distance>0?50:-9};stepRacer(r,${Math.min(.0001,Math.abs(distance))*1000/(distance>0?50:9)});}`);}
// Advance in small steps through the real physics function, with a straight test track.
test('Initial grid / idle update does not award a checkpoint or lap',()=>{racer();run('for(let i=0;i<120;i++)stepRacer(r,1/120)');assert.equal(run('r.lap'),1);assert.equal(run('r.finished'),false);});
test('Forward driving awards exactly three complete laps',()=>{racer();travel(.04);travel(.94);assert.equal(run('r.lap'),1);travel(.08);assert.equal(run('r.lap'),2);travel(1);assert.equal(run('r.lap'),3);travel(1);assert.equal(run('r.lap'),4);assert.equal(run('r.finished'),true);});
test('Reverse looping cannot award laps or finish',()=>{racer();travel(-3.2);assert.equal(run('r.lap'),1);assert.equal(run('r.finished'),false);});
test('Reverse shortcut then forward start crossing cannot award a lap',()=>{racer();travel(.03);travel(-.2);travel(.22);assert.equal(run('r.lap'),1);assert.equal(run('r.finished'),false);});
test('Brake has priority over a held accelerator',()=>{racer();run('r.u=.1;r.speed=30;r.throttle=true;r.brake=true;stepRacer(r,1/120)');assert.ok(run('r.speed')<30,'Braking while accelerating must reduce speed');});
test('Pause clears held input and restores countdown',()=>{racer();run("game.state='countdown';input.throttle=true;input.drift=true;pause()");assert.equal(run('game.state'),'paused');assert.equal(run('input.throttle'),false);assert.equal(run('input.drift'),false);run('resume()');assert.equal(run('game.state'),'countdown');});
test('Pause/resume preserves race time',()=>{racer();run('game.raceTime=42;pause();resume()');assert.equal(run('game.state'),'race');assert.equal(run('game.raceTime'),42);});
test('Finished racers rank by time ahead of unfinished racers',()=>{racer();run(`game.racers=[{progress:2.9,finished:false,rank:1,div:r.div},{progress:4,finished:true,finishTime:102,rank:2,div:r.div},{progress:4,finished:true,finishTime:99,rank:3,div:r.div}];updateRanks(true)`);assert.equal(run('game.racers[2].rank'),1);assert.equal(run('game.racers[1].rank'),2);assert.equal(run('game.racers[0].rank'),3);});
test('Paused animation frames freeze physics and race clock',()=>{racer();run('game.raceTime=42;r.speed=35;pause();globalThis.beforeU=r.u;frame(1000);frame(2000)');assert.equal(run('r.u'),run('beforeU'));assert.equal(run('game.raceTime'),42);});
test('Paused circuit redraws once, then sleeps while controls remain responsive',()=>{racer();let draws=0;context.renderer.render=()=>draws++;run('pause();frame(2100);frame(2200);frame(2300)');assert.equal(draws,1);context.renderer.render=noop;});
test('Hidden tabs perform no rendering or simulation work',()=>{racer();let draws=0;context.renderer.render=()=>draws++;context.document.hidden=true;run('frame(5000)');assert.equal(draws,0);assert.equal(run('game.raceTime'),0);context.document.hidden=false;context.renderer.render=noop;});
test('Window blur pauses active races and releases controls',()=>{racer();run('input.left=true;input.item=true');listeners.blur();assert.equal(run('game.state'),'paused');assert.equal(run('input.left'),false);assert.equal(run('input.item'),false);});
test('Results distinguish unfinished racers from recorded finish times',()=>{racer();run(`r.finished=true;r.finishTime=99;r.progress=4;r.rank=1;game.racers.push({progress:2.5,finished:false,lap:2,rank:2,div:{name:'Opponent',acc:'#ccc'}});showResults()`);assert.equal(run('game.state'),'results');assert.match(element('board').innerHTML,/01:39.00/);assert.match(element('board').innerHTML,/RACING · LAP 2/);});
function opponent(id='zenflow',offset=.01){run(`globalThis.o=new Racer(ROSTER.find(d=>d.id==='${id}'),false,1);o.specialAI=Infinity;o.u=wrap01(r.u+${offset});o.lat=r.lat;o.speed=40;game.racers.push(o);`);}
test('Every division has a separately named, documented power',()=>{assert.equal(run('ROSTER.length'),12);assert.equal(run('Object.keys(ABILITIES).length'),12);assert.equal(run('new Set(ROSTER.map(d=>ABILITIES[d.id].name)).size'),12);assert.ok(run('ROSTER.every(d=>ABILITIES[d.id].description.length>20&&ABILITIES[d.id].cooldown>0)'));});
test('All twelve powers activate once and reject cooldown spam',()=>{for(const d of roster){racer(d.id);assert.equal(run('useSpecial(r)'),true,d.id);const cooldown=run('r.specialCooldown');assert.ok(cooldown>0,d.id);assert.equal(run('useSpecial(r)'),false,d.id);assert.equal(run('r.specialCooldown'),cooldown,d.id);}});
test('Power activation is rejected outside racing and after finishing',()=>{for(const state of ['countdown','paused','roster','results']){racer();run(`game.state='${state}'`);assert.equal(run('useSpecial(r)'),false,state);}racer();run('r.finished=true');assert.equal(run('useSpecial(r)'),false);});
test('Powers recover cooldown only with simulation time and reset in fresh races',()=>{racer();run('useSpecial(r);stepAbilities(1)');assert.equal(run('r.specialCooldown'),18);run('pause();frame(3000)');assert.equal(run('r.specialCooldown'),18);racer();assert.equal(run('r.specialCooldown'),0);});
test('Time Dilation slows nearby rivals but preserves owner and distant rivals',()=>{racer();opponent();run('useSpecial(r);stepAbilities(.1)');assert.ok(run('o.slow')>0);assert.equal(run('r.slow'),0);racer();opponent('zenflow',.1);run('useSpecial(r);stepAbilities(.1)');assert.equal(run('o.slow'),0);});
test('Shared Fortune transfers tokens and respects the reserve cap',()=>{racer('collective');opponent();run('r.tokens=9;o.tokens=3;useSpecial(r)');assert.equal(run('r.tokens'),10);assert.equal(run('o.tokens'),2);});
test('Phase Walk blocks direct attacks until its duration expires',()=>{racer('hybrid');run("useSpecial(r);hitRacer(r,'test')");assert.equal(run('r.spin'),0);run("stepAbilities(4);hitRacer(r,'test')");assert.ok(run('r.spin')>0);});
test('Hologram Decoy intercepts a hostile missile then expires',()=>{racer('nexus');opponent();run('useSpecial(r);missiles.push({owner:o,u:r.u,lat:r.lat,mesh:{}});stepAbilities(.1)');assert.equal(run('missiles.length'),0);run('stepAbilities(.1)');assert.equal(run('abilityZones.length'),0);});
test('Impact Drive spins a rival on contact',()=>{racer('kinetic');opponent('zenflow',.001);run('useSpecial(r);stepWorld(.01)');assert.ok(run('o.spin')>0);assert.equal(run('r.spin'),0);});
test('Verdict Mirror reflects one attack to the attacker',()=>{racer('juris');opponent();run("useSpecial(r);hitRacer(r,'test',o)");assert.equal(run('r.spin'),0);assert.ok(run('o.spin')>0);assert.equal(run('r.reflect'),0);});
test('Sonic Lance hits the nearest forward rival in its lane',()=>{racer('signal');opponent();run('useSpecial(r)');assert.ok(run('o.spin')>0);racer('signal');opponent('zenflow',-.01);run('useSpecial(r)');assert.equal(run('o.spin'),0);});
test('Thread Snare slows a crossing rival and expires',()=>{racer('loom');opponent('zenflow',-.005);run('useSpecial(r);stepAbilities(.1)');assert.ok(run('o.slow')>0);run('stepAbilities(6)');assert.equal(run('abilityZones.length'),0);});
test('Side Step changes lane without advancing race distance',()=>{racer('vector');run('globalThis.originalDistance=r.distance;globalThis.originalLat=r.lat;useSpecial(r)');assert.notEqual(run('r.lat'),run('originalLat'));assert.equal(run('r.distance'),run('originalDistance'));assert.ok(run('Math.abs(r.lat)<TRACK_W/2'));assert.ok(run('r.phase')>0);});
test('Orbital Magnet collects across lanes but respects range and cap',()=>{racer('aether');run('r.tokens=9;tokens.push({u:r.u,lat:6,t:0,mesh:{visible:true}},{u:wrap01(r.u+.08),lat:0,t:0,mesh:{visible:true}});useSpecial(r);stepAbilities(.1)');assert.equal(run('r.tokens'),10);assert.equal(run('tokens[0].mesh.visible'),false);assert.equal(run('tokens[1].mesh.visible'),true);});
test('Sentinel Drone slows forward rivals',()=>{racer('animus');opponent();run('useSpecial(r);stepAbilities(.1)');assert.ok(run('o.speed')<40);assert.ok(run('o.slow')>0);});
test('Sentinel Drone respects shields, reflection, phase, and regeneration',()=>{for(const defense of ['shield','reflect','phase','regen']){racer('animus');opponent();run(`o.${defense}=4;useSpecial(r);stepAbilities(.1)`);assert.equal(run('o.speed'),40,defense);assert.equal(run('o.slow'),0,defense);}});
test('Regenesis cleanses spin and slow, recovers loss once, and caps tokens',()=>{racer('helix');run('r.spin=1;r.slow=3;r.wheelspin=1;r.tokens=9;r.lastLostTokens=3;useSpecial(r)');assert.equal(run('r.spin+r.slow+r.wheelspin'),0);assert.equal(run('r.tokens'),10);assert.equal(run('r.lastLostTokens'),0);assert.ok(run('r.regen')>0);});
test('Race cleanup removes all lingering ability zones',()=>{racer('nexus');run('useSpecial(r);clearAbilities()');assert.equal(run('abilityZones.length'),0);});
context.makeProjectileMesh=()=>{const Three=require('../vendor/three.min.js');const root=new Three.Group(),geometry=new Three.SphereGeometry(.5,8,6),material=new Three.MeshBasicMaterial();geometry.addEventListener('dispose',()=>context.disposalCounts.geometries++);material.addEventListener('dispose',()=>context.disposalCounts.materials++);root.add(new Three.Mesh(geometry,material),new Three.Mesh(geometry,material));return root;};
test('Projectile expiry disposes GPU resources once, including shared child resources',()=>{racer();context.disposalCounts={geometries:0,materials:0};run('globalThis.expiring=makeProjectileMesh();mines.push({u:wrap01(r.u+.3),lat:0,mesh:expiring,core:expiring.children[0],owner:r,life:.001});stepWorld(.01);disposeProjectile(expiring)');assert.equal(run('mines.length'),0);assert.deepEqual(context.disposalCounts,{geometries:1,materials:1});});
test('Race projectile cleanup releases mines and missiles',()=>{racer();context.disposalCounts={geometries:0,materials:0};run('mines.push({mesh:makeProjectileMesh()});missiles.push({mesh:makeProjectileMesh()});clearProjectiles();clearProjectiles()');assert.equal(run('mines.length+missiles.length'),0);assert.deepEqual(context.disposalCounts,{geometries:2,materials:2});});
test('Records remain separate across circuits and selection rejects mid-race changes',()=>{
 assert.notEqual(run("raceRecordKey('zenflow',1,'cherry')"),run("raceRecordKey('zenflow',1,'canopy')"));
 context.MAPS=[{id:'cherry'},{id:'stormforge'},{id:'canopy'}];
 run("game.state='roster';chooseMap('canopy')");assert.equal(run('chosenMapId'),'canopy');
 run("game.state='race'");assert.equal(run("chooseMap('stormforge')"),false);assert.equal(run('chosenMapId'),'canopy');
 run("game.state='roster'");assert.equal(run("chooseMap('missing')"),false);
});
const rigFinite=()=>{let ok=true;run('r.mesh').traverse(o=>{for(const v of [o.position,o.rotation,o.scale])if(![v.x,v.y,v.z].every(Number.isFinite))ok=false;});return ok;};
test('Kart rig animation keeps transforms finite through drift, spin, hit, boost, wheelspin and finish states',()=>{racer();
 run('r.speed=30;r.throttle=true;r.steer=.8;r.drifting=true;r.driftDir=1;r.hop=.28;for(let i=0;i<60;i++)stepRacer(r,1/120)');assert.ok(rigFinite());assert.ok(Math.abs(run('r.mesh.userData.body.rotation.z'))>1e-4,'body rolls under lateral load');assert.ok(run('r.mesh.userData.steeringWheel.rotation.z')<0,'steering wheel follows -steer');
 run('r.spin=1.1;r.hitCd=1.6;for(let i=0;i<60;i++)stepRacer(r,1/120)');assert.ok(rigFinite());assert.equal(run('r.mesh.userData.clipState.active'),'spinout');assert.ok(run('r.mesh.userData.arms[0].rotation.x')>.5,'pilot flails');
 run('r.spin=0;r.hitCd=1;for(let i=0;i<30;i++)stepRacer(r,1/120)');assert.equal(run('r.mesh.userData.clipState.active'),'hit');
 run('r.hitCd=0;r.boost=1;r.wheelspin=.5;r.speed=30;for(let i=0;i<30;i++)stepRacer(r,1/120)');assert.ok(rigFinite());assert.equal(run('r.mesh.userData.clipState.active'),'boost');assert.ok(run('r.mesh.userData.exhaust[0].scale.x')!==1,'exhaust pulses under boost');assert.ok(run('r.mesh.userData.wheels[2].spin.rotation.x')>run('r.mesh.userData.wheels[0].spin.rotation.x'),'rear wheels overspin');
 // Procedural finish poses are checked with the Blender clips stashed, then the real clips are layered back on top.
 run('globalThis.realClips=KART_CLIPS.clips;KART_CLIPS.clips={};r.boost=0;r.wheelspin=0;r.finished=true;r.rank=1;for(let i=0;i<60;i++)stepRacer(r,1/120)');assert.ok(rigFinite());assert.equal(run('r.mesh.userData.clipState.active'),'victory');assert.ok(run('r.mesh.userData.arms[1].rotation.x')>1,'victory fist pump');
 run('r.rank=5;for(let i=0;i<30;i++)stepRacer(r,1/120)');assert.equal(run('r.mesh.userData.clipState.active'),'defeat');assert.ok(run('r.mesh.userData.head.rotation.x')<0,'defeat slump');assert.ok(rigFinite());
 run('KART_CLIPS.clips=realClips;resolveKartRig(r.mesh);for(let i=0;i<60;i++)stepRacer(r,1/120);r.rank=1;for(let i=0;i<60;i++)stepRacer(r,1/120)');assert.ok(rigFinite(),'finite with authored clips layered');assert.equal(run('r.mesh.userData.clipState.active'),'victory');assert.ok(run("Object.keys(KART_CLIPS.clips).length")>=8,'authored clip set present');
 assert.ok(run('Object.values(r.mesh.userData.clipState.weights).every(w=>w>=0&&w<=1)'),'clip weights stay normalized');});
test('Suspension follows the road at speed and settles back to the wheel rest height at zero speed',()=>{racer();
 run('r.speed=40;r.throttle=true;for(let i=0;i<240;i++)stepRacer(r,1/120)');assert.ok(run('r.mesh.userData.wheels.some(w=>Math.abs(w.pivot.position.y-w.rest.y)>1e-4)'),'road noise displaces wheels at speed');
 run('r.throttle=false;for(let i=0;i<360;i++){r.speed=0;stepRacer(r,1/120);}');for(let i=0;i<4;i++)assert.ok(Math.abs(run(`r.mesh.userData.wheels[${i}].pivot.position.y-r.mesh.userData.wheels[${i}].rest.y`))<1e-3,'wheel '+i+' back at rest');
 assert.ok(Math.abs(run('r.mesh.userData.body.rotation.z'))<1e-3&&Math.abs(run('r.mesh.userData.body.rotation.x'))<1e-3,'body level at rest');assert.equal(run('r.mesh.userData.clipState.active'),'idle');});
test('Blender clips layer additively onto the procedural pose and reset once their state fades',()=>{racer();
 run("KART_CLIPS.clips.drive={duration:1,loop:true,tracks:{torso:{rotation:[[0,0,.5,0],[1,0,.5,0]]},'wheel-rr':{position:[[0,0,.2,0],[.5,0,.2,0]]},missing:{position:[[0,9,9,9]]}}};resolveKartRig(r.mesh);r.speed=30;r.throttle=true;for(let i=0;i<120;i++)stepRacer(r,1/120)");
 assert.equal(run('r.mesh.userData.clipState.active'),'drive');assert.ok(Math.abs(run('r.mesh.userData.clipNodes.torso.rotation.y')-.5)<.02,'additive rotation applied at full weight');assert.ok(run('r.mesh.userData.wheels[3].pivot.position.y')>run('r.mesh.userData.wheels[3].rest.y')+.15,'clip offset stacks on the suspension');
 run('delete KART_CLIPS.clips.drive;stepRacer(r,1/120)');assert.equal(run('r.mesh.userData.clipNodes.torso.rotation.y'),0,'clip node reset to rest');assert.ok(rigFinite());});
// ---------- Gameplay feel, flow and input ----------
test('Boosts ramp in as a surge rather than an instant multiplier',()=>{racer();run('r.speed=30;r.throttle=true;applyBoost(r,1,1.4,1);stepRacer(r,1/120)');assert.ok(run('r.boostMult')<1.3,'multiplier is still ramping after one step');assert.ok(run('r.surge')>0);run('for(let i=0;i<36;i++)stepRacer(r,1/120)');assert.ok(run('r.boostMult')>1.35,'reaches the target within 0.3 s');assert.ok(run('r.speed')>30);run('r.boost=0;for(let i=0;i<120;i++)stepRacer(r,1/120)');assert.ok(run('r.boostMult')<1.05,'decays back once the boost expires');});
test('Drift needs a hop, a speed floor and a steering commitment inside the hop window; counter-steer holds the charge',()=>{
 racer();run('r.isPlayer=true;r.speed=10;input.drift=true;input.right=true;for(let i=0;i<10;i++)stepRacer(r,1/120)');assert.equal(run('r.drifting'),false,'below the speed floor');assert.equal(run('r.hop'),0);
 const commit=(dir)=>{racer();run(`r.isPlayer=true;r.speed=40;Object.keys(input).forEach(k=>input[k]=false);input.drift=true;stepRacer(r,1/120)`);assert.ok(run('r.hop')>0,'hop starts on press');assert.equal(run('r.drifting'),false,'no direction committed yet');run(`input.${dir}=true;for(let i=0;i<8;i++)stepRacer(r,1/120)`);assert.equal(run('r.drifting'),true);};
 commit('right');assert.equal(run('r.driftDir'),1);run('globalThis.c0=r.driftTime;for(let i=0;i<24;i++)stepRacer(r,1/120)');const into=run('r.driftTime-c0');
 commit('right');run('input.right=false;input.left=true;globalThis.c0=r.driftTime;for(let i=0;i<24;i++)stepRacer(r,1/120)');const counter=run('r.driftTime-c0');assert.ok(counter<into,'counter-steer charges slower than steering into the slide');assert.equal(run('r.drifting'),true,'counter-steer does not cancel the drift');
 run('r.driftTime=2;stepRacer(r,1/120)');assert.equal(run('r.driftTier'),2);run('input.drift=false;stepRacer(r,1/120)');assert.equal(run('r.drifting'),false);assert.ok(run('r.boost')>0,'release grants the mini-turbo');run('Object.keys(input).forEach(k=>input[k]=false)');});
test('Slipstream engages after 0.8 s in a rival\'s draft, tows, then releases into a boost when pulling out',()=>{
 racer();opponent('zenflow',.008);run('r.isPlayer=true;r.u=.1;r.distance=.1;o.u=.108;o.lat=r.lat;o.speed=40;for(let i=0;i<60;i++){o.u=wrap01(r.u+.008);r.speed=40;stepRacer(r,1/120);}');
 assert.equal(run('r.slipOn'),false,'half a second is not enough');assert.ok(run('r.slipT')>.4);
 run('for(let i=0;i<100;i++){o.u=wrap01(r.u+.008);r.speed=40;stepRacer(r,1/120);}');assert.equal(run('r.slipOn'),true);assert.ok(run('r.slipBonus')>0);assert.ok(run('r.maxSpeed')>run('r.maxSpeedBase'),'draft raises the ceiling');assert.equal(element('toast').textContent,'SLIPSTREAM');
 run('updateHUD(.05)');assert.equal(element('speedbar').className,'slip');
 run('o.lat=r.lat+8;stepRacer(r,1/120)');assert.equal(run('r.slipOn'),false);assert.ok(run('r.boost')>0,'pulling out releases a boost');assert.equal(element('toast').textContent,'DRAFT BOOST');
 racer();opponent('zenflow',.03);run('r.u=.1;o.u=.13;o.lat=r.lat;o.speed=40;for(let i=0;i<130;i++){o.u=wrap01(r.u+.03);r.speed=40;stepRacer(r,1/120);}');assert.equal(run('r.slipOn'),false,'30 m back is outside the draft');});
test('Wall impacts scrub speed in proportion to the impact angle',()=>{const bump=(theta)=>{racer();run(`r.u=.2;r.speed=40;r.lat=TRACK_W/2;r.theta=${theta};r.wallCd=0;stepRacer(r,1/120)`);return 40-run('r.speed');};const graze=bump(.05),square=bump(.6);assert.ok(graze<40*.15,'a graze keeps most of the speed: lost '+graze.toFixed(2));assert.ok(square>graze*2.5,'a square hit scrubs far more: '+square.toFixed(2)+' vs '+graze.toFixed(2));assert.ok(run('r.wallScrub')<=.55);assert.ok(run('r.wallCd')>0);});
test('Lap splits record per-lap times, best lap and a delta toast against the previous lap',()=>{
 racer();run('r.isPlayer=true;r.u=0;r.distance=0;r.lastU=0;r.lap=1;game.raceTime=0;r.throttle=false');
 const lap=(sec)=>run(`for(let i=0;i<${Math.round(sec*120)};i++){game.raceTime+=1/120;r.speed=track.len/${sec}+.4;stepRacer(r,1/120);}`);
 lap(40);assert.equal(run('r.lapTimes.length'),1);assert.ok(Math.abs(run('r.lapTimes[0]')-40)<1,'first split ~40 s: '+run('r.lapTimes[0]'));assert.equal(element('toast').textContent,'LAP 2');assert.doesNotMatch(element('toastsub').textContent,/\(/,'no delta on the first split');
 lap(36);assert.equal(run('r.lapTimes.length'),2);assert.ok(run('r.lapTimes[1]')<run('r.lapTimes[0]'));assert.equal(run('r.bestLap'),run('r.lapTimes[1]'));assert.equal(element('toast').textContent,'FINAL LAP');assert.match(element('toastsub').textContent,/^\d\d:\d\d\.\d\d \(−0:0\d\.\d\)$/);
 lap(38);assert.equal(run('r.finished'),true);assert.equal(run('r.lapTimes.length'),3,'the finishing lap is recorded too');assert.equal(run('r.bestLap'),run('r.lapTimes[1]'),'best lap survives a slower final lap');assert.ok(Math.abs(run('r.finishTime')-run('r.lapTimes.reduce((a,b)=>a+b,0)'))<.02,'splits sum to the finish time');});
test('AI directors fire powers only on sensible conditions and respect cooldowns',()=>{
 racer('signal');assert.equal(run('aiWantsSpecial(r)'),false,'no rival ahead');opponent('zenflow',.02);assert.equal(run('aiWantsSpecial(r)'),true,'rival ahead inside 70 m');
 run('r.specialAI=0;stepAbilities(.01)');assert.ok(run('o.spin')>0,'lance fired through the AI timer');const cd=run('r.specialCooldown');assert.ok(cd>0);
 run('o.spin=0;r.specialAI=0;stepAbilities(.01)');assert.equal(run('o.spin'),0,'cooldown blocks a repeat');assert.equal(run('r.specialCooldown')<=cd,true);assert.equal(run('aiWantsSpecial(r)'),false);
 racer('hybrid');assert.equal(run('aiWantsSpecial(r)'),false,'phase walk waits for a threat');run('missiles.push({owner:{},u:wrap01(r.u-.02),lat:r.lat,mesh:{}})');assert.equal(run('aiWantsSpecial(r)'),true,'incoming missile triggers the defensive power');run('missiles.length=0');
 racer('helix');assert.equal(run('aiWantsSpecial(r)'),false);run('r.spin=1');assert.equal(run('aiWantsSpecial(r)'),true,'regenesis answers a spin-out');
 racer('loom');opponent('zenflow',.03);assert.equal(run('aiWantsSpecial(r)'),false,'snare needs a chaser');run('o.u=wrap01(r.u-.008)');assert.equal(run('aiWantsSpecial(r)'),true);});
test('AI items wait for a purpose: missiles need a target, mines a chaser, and missiles re-arm after 3 s',()=>{
 racer();run('game.diff=1;r.item="missile";r.ai.itemDelay=0;r.ai.missileCd=0;buildMissileMesh=()=>makeProjectileMesh();stepAI(r,1/120)');assert.equal(run('r.item'),'missile','held without a target ahead');
 opponent('zenflow',.03);run('r.ai.itemDelay=0;stepAI(r,1/120)');assert.equal(run('r.item'),null,'fired at a rival 30 m ahead');assert.equal(run('missiles.length'),1);assert.ok(run('r.ai.missileCd')>=3,'3 s re-arm');
 run('r.item="missile";r.ai.itemDelay=0;stepAI(r,1/120)');assert.equal(run('r.item'),'missile','re-arm blocks an immediate second missile');
 run('r.item="mine";r.ai.itemDelay=0;r.ai.itemHeld=0;buildMineMesh=()=>makeProjectileMesh();stepAI(r,1/120)');assert.equal(run('r.item'),'mine','mine held with nobody behind');run('o.u=wrap01(r.u-.006);r.ai.itemDelay=0;stepAI(r,1/120)');assert.equal(run('r.item'),null,'mine dropped on a chaser');run('clearProjectiles()');});
test('Rubber band is absent in SIMULATION and capped at +8% / +14% of the player top speed on STANDARD / OVERSEER',()=>{
 racer();opponent('signal',-.5);run('game.diff=0;o.progress=-2;r.progress=2;stepAI(o,1/120)');const sim=run('o.rubber');run('o.progress=4;stepAI(o,1/120)');assert.equal(run('o.rubber'),sim,'simulation ignores the gap');
 for(const [diff,cap] of [[1,1.08],[2,1.14]]){run(`game.diff=${diff};o.progress=-2;stepAI(o,1/120)`);assert.ok(run('o.rubber*o.maxSpeedBase')<=run('r.maxSpeedBase')*cap+1e-9,'cap at diff '+diff);assert.ok(run('o.rubber')>1,'trailing AI catches up at diff '+diff);run('o.progress=4;stepAI(o,1/120)');assert.ok(run('o.rubber')<1,'leading AI eases off at diff '+diff);}
 run('game.diff=1');});
test('Grid slots stagger the start reaction so the front rows launch first',()=>{racer();run('game.racers=[];for(let i=0;i<12;i++)game.racers.push(new Racer(ROSTER[i],false,i))');const delays=run('game.racers.map(r=>r.ai.startDelay)');assert.ok(delays.every(d=>d>0));assert.ok(delays[0]<delays[11]&&delays[2]<delays[10],'rear rows react later');});
test('Item weighting keeps Overseer Pulse from the leader and arms the tail with missiles and clusters',()=>{racer();run('game.racers=Array.from({length:12},(_,i)=>({rank:i+1}))');const original=context.rng;const sample=(rank)=>{const out={};for(let i=0;i<200;i++){context.rng=()=>(i+.5)/200;const k=run(`pickItem({rank:${rank}})`);out[k]=(out[k]||0)+1;}return out;};const lead=sample(1),tail=sample(12);context.rng=original;assert.equal(lead.pulse||0,0,'leader never rolls pulse');assert.ok((lead.shield||0)>(tail.shield||0));assert.ok(((tail.missile||0)+(tail.triple||0))>100,'tail favours missile/cluster: '+JSON.stringify(tail));assert.ok((tail.pulse||0)>0);});
test('Live mines are capped at six per race, retiring the oldest first',()=>{racer();context.disposalCounts={geometries:0,materials:0};run('buildMineMesh=()=>makeProjectileMesh();for(let i=0;i<8;i++){r.item="mine";r.u=wrap01(.1+i*.01);useItem(r);}');assert.equal(run('mines.length'),6);assert.ok(Math.abs(run('mines[0].u')-run('wrap01(.12-3.5/track.len)'))<1e-9,'the two oldest were retired');assert.equal(context.disposalCounts.geometries,2,'retired mines release their geometry');run('clearProjectiles()');});
test('Node Cluster bursts are spaced by a short cooldown and each burst is a surge',()=>{racer();run('r.item="triple";useItem(r);useItem(r)');assert.equal(run('r.tripleLeft'),2,'second press inside the spacing window is ignored');assert.ok(run('r.surge')>0);run('for(let i=0;i<40;i++)stepRacer(r,1/120);useItem(r)');assert.equal(run('r.tripleLeft'),1);run('for(let i=0;i<40;i++)stepRacer(r,1/120);useItem(r)');assert.equal(run('r.item'),null);assert.equal(run('r.tripleLeft'),0);});
test('Results board lists finish time, best lap and gap to the leader, and the sub-line carries the PB delta',()=>{racer();run(`r.finished=true;r.finishTime=99;r.progress=4;r.rank=1;r.bestLap=31.5;game.racers.push({progress:4,finished:true,finishTime:101.25,lap:4,rank:2,bestLap:32.1,div:{name:'Opponent',acc:'#ccc'}},{progress:2.5,finished:false,lap:2,rank:3,div:{name:'Trailer',acc:'#ccc'}});game.newBest=true;game.pbDelta=-2.31;showResults()`);const html=element('board').innerHTML;assert.match(html,/BEST LAP/);assert.match(html,/fastest">00:31.50/,'fastest lap highlighted');assert.match(html,/00:32.10/);assert.match(html,/\+0:02.25/,'gap to leader');assert.match(html,/LEADER/);assert.match(html,/RACING · LAP 2/);assert.match(html,/>—</,'no best lap for an unfinished racer without one');assert.match(element('rsub').textContent,/PB −0:02.31/);});
test('Next Circuit cycles the map list only from the results screen and restarts with the same director',()=>{
 context.MAPS=[{id:'cherry',name:'Cherry'},{id:'stormforge',name:'Storm'},{id:'canopy',name:'Canopy'}];context.FALLBACK_GRAPHICS=true;
 racer();run("selected=ROSTER[0];game.state='race'");assert.equal(run('nextCircuit()'),false,'not from a live race');assert.equal(run('game.state'),'race');
 run("game.state='roster';chooseMap('canopy');game.state='results'");assert.equal(run('nextCircuit()'),true);assert.equal(run('chosenMapId'),'cherry','wraps to the first circuit');assert.equal(run('game.state'),'countdown');assert.equal(run('game.racers.length'),12);assert.equal(run('game.player.div.id'),'zenflow');assert.equal(run('game.player.lapTimes.length'),0);
 run("game.state='results'");assert.equal(run('nextCircuit()'),true);assert.equal(run('chosenMapId'),'stormforge');
 assert.equal(run('restartRace()'),false,'restart needs pause or results');run('pause()');assert.equal(run('restartRace()'),true);assert.equal(run('game.state'),'countdown');run("openRoster()");});
test('Key handlers ignore events typed into form fields and map Escape / R / M',()=>{
 racer();run("selected=ROSTER[0];game.state='race';AUDIO.on=true");const key=(code,tagName='BODY',type='keydown')=>listeners[type]({code,target:{tagName},preventDefault(){}});
 key('KeyW','INPUT');assert.equal(run('input.throttle'),false,'typing in an input never drives');key('KeyW');assert.equal(run('input.throttle'),true);key('KeyW','BODY','keyup');assert.equal(run('input.throttle'),false);
 key('Escape','TEXTAREA');assert.equal(run('game.state'),'race');key('Escape');assert.equal(run('game.state'),'paused');key('Escape');assert.equal(run('game.state'),'race');
 key('KeyM','SELECT');assert.equal(run('AUDIO.on'),true);key('KeyM');assert.equal(run('AUDIO.on'),false);assert.equal(element('mutebtn').textContent,'SOUND OFF');key('KeyM');assert.equal(run('AUDIO.on'),true);
 key('KeyR');assert.equal(run('game.state'),'race','R does nothing mid-race');key('Escape');key('KeyR','INPUT');assert.equal(run('game.state'),'paused');key('KeyR');assert.equal(run('game.state'),'countdown','R restarts from pause');run('openRoster()');});
test('Position-change toasts are pooled, throttled and yield to higher-priority messages',()=>{
 racer();run("r.isPlayer=true;game.raceTime=10;setToast('');setToast.until=0;stepPositionToasts.last=-9;r.rankShown=1;r.rank=2;stepPositionToasts(r,.3)");assert.equal(element('toast').textContent,'','pooled for 0.6 s');
 run('stepPositionToasts(r,.31)');assert.equal(element('toast').textContent,'−1 POSITION');
 run('r.rank=1;stepPositionToasts(r,.61)');assert.equal(element('toast').textContent,'−1 POSITION','throttled inside 1.2 s');
 run("game.raceTime=12;r.rankShown=3;r.rank=1;r.rankDelta=0;stepPositionToasts(r,.61)");assert.equal(element('toast').textContent,'+2 POSITIONS');assert.equal(element('toastsub').textContent,'1ST');
 run("game.raceTime=14;setToast('LAP 2','gold','00:40.00',3);r.rank=4;stepPositionToasts(r,.61)");assert.equal(element('toast').textContent,'LAP 2','a lap split is never replaced by a position toast');});
test('HUD update runs headless with the new elements: gap readout, speed bar, wrong-way delay, power button readiness',()=>{
 racer();opponent('zenflow',.01);run('r.isPlayer=true;r.speed=30;o.progress=r.progress+.01;game.rankTick=0;updateRanks(true);updateHUD(.05)');assert.match(element('ranks').innerHTML,/class="gap">▲ \+\d+\.\ds/);assert.equal(element('speedbar').className,'');assert.equal(element('tP').textContent,'POWER');
 run('r.speed=-5;r.wrongT=.5;updateHUD(.05)');assert.equal(element('wrong').style.display,'none','no warning inside the first second');run('r.wrongT=1.2;updateHUD(.05)');assert.equal(element('wrong').style.display,'block');
 run('r.specialCooldown=5;r.boost=1;r.roulette=.7;updateHUD(.05)');assert.equal(element('tP').textContent,'5s');assert.equal(element('speedbar').className,'boost');assert.equal(element('item').style['--spin'],'0.500');run('r.roulette=0;r.boost=0;updateHUD(.05)');assert.equal(element('item').style['--spin'],'0');});
test('Analog steering clamps travel, ignores other fingers and releases on cancellation',()=>{
 racer();run('r.isPlayer=true;resetInput()');const el=element('tSteer'),ev=(pointerId,clientX)=>({pointerId,clientX,preventDefault:noop});
 el.events.pointerdown(ev(1,120));assert.ok(run('touchSteer')>.8);el.events.pointermove(ev(2,0));assert.ok(run('touchSteer')>.8);
 el.events.pointermove(ev(1,-100));assert.equal(run('touchSteer'),-1);el.events.pointercancel(ev(1,0));assert.equal(run('touchSteer'),0);
 el.events.pointerdown(ev(3,76));assert.equal(run('touchSteer'),0,'center dead zone');run('pause()');assert.equal(run('touchSteer'),0);assert.equal(run('steerPointer'),null);
});
test('Two fingers on the same action do not release one another',()=>{
 racer();run('resetInput()');const el=element('tD'),ev=pointerId=>({pointerId,preventDefault:noop});
 el.events.pointerdown(ev(1));el.events.pointerdown(ev(2));el.events.pointerup(ev(1));assert.equal(run('input.drift'),true);
 el.events.lostpointercapture(ev(2));assert.equal(run('input.drift'),false);assert.equal(run('activeTouchPointers.size'),0);
});
test('Touch steering assist is optional and does not override deliberate steering',()=>{
 racer();run('resetInput();r.isPlayer=true;game.touch=true;game.steeringAssist=true;r.lat=6.5;r.speed=20;stepRacer(r,1/120)');assert.ok(run('r.steer')<0);
 run('game.steeringAssist=false;r.steer=0;stepRacer(r,1/120)');assert.equal(run('r.steer'),0);
 run('game.steeringAssist=true;touchSteer=1;stepRacer(r,1/120)');assert.ok(run('r.steer')>0);run('game.touch=false;resetInput()');
});
test('Touch drift holds charge a rocket start during the final countdown',()=>{
 racer();run("r.isPlayer=true;game.touch=true;game.state='countdown';game.countdown=.5;input.drift=true;for(let i=0;i<61;i++)simStep(1/120)");assert.equal(run('game.state'),'race');assert.ok(run('r.boost')>.8);run('game.touch=false;resetInput()');
});
require('./effects-regression.cjs')({test,assert});
test('Disabling touch mode releases simultaneous steering, drift, item and power',()=>{
 racer();run('resetInput();game.touch=true');
 const ev=pointerId=>({pointerId,clientX:120,preventDefault:noop});
 element('tSteer').events.pointerdown(ev(1));element('tD').events.pointerdown(ev(2));element('tI').events.pointerdown(ev(3));element('tP').events.pointerdown(ev(4));
 assert.equal(run('input.drift&&input.item&&input.special&&touchSteer>0'),true);
 element('touchmode').checked=false;element('touchmode').events.change();
 assert.equal(run('input.drift||input.item||input.special||input.itemEdge||input.specialEdge'),false);assert.equal(run('touchSteer'),0);assert.equal(run('activeTouchPointers.size'),0);
});
test('Resize releases the old steering coordinate and held actions',()=>{
 racer();run('resetInput()');const ev=pointerId=>({pointerId,clientX:120,preventDefault:noop});
 element('tSteer').events.pointerdown(ev(1));element('tD').events.pointerdown(ev(2));
 context.camera.updateProjectionMatrix=noop;context.renderer.setSize=noop;listeners.resize();
 assert.equal(run('touchSteer'),0);assert.equal(run('input.drift'),false);assert.equal(run('steerPointer'),null);
});
test('Resume requests audio recovery in the button gesture',()=>{
 racer();let resumed=0;const old=context.audioInit;context.audioInit=()=>resumed++;
 run('pause();resume()');assert.equal(resumed,1);context.audioInit=old;
});
test('Backgrounding immediately mutes audio before hidden frames stop',()=>{
 racer();let updated=0;const old=context.audioUpdate;context.audioUpdate=()=>updated++;
 context.document.hidden=true;listeners.visibilitychange();assert.equal(updated,1);assert.equal(run('game.state'),'paused');
 context.document.hidden=false;context.audioUpdate=old;
});
require('./kart-materials-regression.cjs')({test,assert});
require('./racefx-regression.cjs')({test,assert});
require('./kart-clips-regression.cjs')({test,assert});
console.log(JSON.stringify({passed:cases.filter(t=>t.pass).length,total:cases.length,cases},null,2));
process.exitCode=cases.every(t=>t.pass)?0:1;
