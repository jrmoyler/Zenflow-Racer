/* Cutscene engine: real Three r128 + jsdom. Shots are evaluated against a circular test circuit,
   so camera rigs, hand-off poses, skip/reduced-motion paths and resource cleanup are exercised
   exactly as shipped. No renderer or pixels are involved. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const THREE=require('../vendor/three.min.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function world(reduced=false){
 const dom=new JSDOM('<!DOCTYPE html><body><button id="title-start">Start</button><button id="rematch">Retry</button><div id="hud"></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://zenflow.example/'});
 const w=dom.window,frames=[];
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true;}});
 const R=100,wrap=u=>((u%1)+1)%1;
 const tan=(u,o)=>o.set(-Math.sin(u*Math.PI*2),0,Math.cos(u*Math.PI*2));
 const right=(u,o)=>o.set(-Math.cos(u*Math.PI*2),0,-Math.sin(u*Math.PI*2));
 const scene=new THREE.Scene(),sun=new THREE.DirectionalLight();scene.add(sun,sun.target);
 const counts={disposedKarts:0,animated:0,geometries:0,materials:0};
 const buildKart=d=>{const k=new THREE.Group();k.name=d.id;const g=new THREE.BoxGeometry(1,1,2),m=new THREE.MeshStandardMaterial();g.addEventListener('dispose',()=>counts.geometries++);m.addEventListener('dispose',()=>counts.materials++);k.add(new THREE.Mesh(g,m));k.userData.wheels=[];return k;};
 const disposeKart=k=>{counts.disposedKarts++;k.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});k.parent?.remove(k);};
 const divs=Array.from({length:12},(_,i)=>({id:['zenflow','collective','nexus'][i]||'d'+i,name:'Division '+i,code:'D'+i,role:'Racer',acc:'#8beeff'}));
 const Object3=THREE.Object3D;
 const c={THREE,console,Math,Set,Map,Promise,
  navigator:{getGamepads:()=>[]},
  matchMedia:()=>({matches:reduced}),requestAnimationFrame:f=>frames.push(f),setTimeout:(f)=>{return 0;},clearTimeout(){},addEventListener(){},
  innerWidth:1400,innerHeight:900,scene,sun,camera:new THREE.PerspectiveCamera(50,1400/900,.1,2000),SOLAR_DIRECTION:new THREE.Vector3(-90,140,-60).normalize(),
  track:{len:Math.PI*2*R},wrap01:wrap,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),trackCurv:()=>.01,trackAG:()=>0,
  trackPoint:(u,lat,h,o)=>{u=wrap(u);return o.set(Math.cos(u*Math.PI*2)*R,0,Math.sin(u*Math.PI*2)*R).add(right(u,new THREE.Vector3()).multiplyScalar(lat)).setY(h);},
  trackTan:(u,o)=>tan(wrap(u),o),trackUp:(u,o)=>o.set(0,1,0),trackRight:(u,o)=>right(wrap(u),o),
  orientOnTrack(obj,u,lat,h){c.trackPoint(u,lat,h,obj.position);const f=tan(wrap(u),new THREE.Vector3()),r=right(wrap(u),new THREE.Vector3());obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r,new THREE.Vector3(0,1,0),f.negate()));obj.updateMatrixWorld(true);},
  buildKart,disposeKart,animateKart:r=>{counts.animated++;c.orientOnTrack(r.mesh,r.u,r.lat,0);},animateShowroomKart:()=>counts.animated++,updateMapScenery(){},applyKartBuildVisuals(){},
  activeMap:{id:'cherry',name:'Cherry Blossom Skyway',theme:'Sanctuary in the clouds',difficulty:'Flowing'},
  ABILITIES:Object.fromEntries(divs.map(d=>[d.id,{name:'Power '+d.id}])),ROSTER:divs,selected:divs[3],saved:{},
  raceFX:{post:{bloom:0,vignette:0,chroma:0,hit:0,flash:0}},ordinal:n=>n===1?'st':n===2?'nd':n===3?'rd':'th',fmtTime:t=>t.toFixed(2),
  raceOrder:(a,b)=>a.rank-b.rank,camState:{init:true,fov:70},resetInput(){},hideTouch(){},showTouch(){counts.touch=(counts.touch||0)+1;},
  game:{state:'countdown',racers:[],player:null,laps:3,diff:1,time:0,raceTime:0,countdown:3.6}};
 c.Racer=class{constructor(div,isPlayer,i){this.div=div;this.isPlayer=isPlayer;this.mesh=buildKart(div);scene.add(this.mesh);this.u=-(0.007+Math.floor(i/2)*0.0068);this.lat=i%2?2.3:-2.3;this.rank=i+1;c.orientOnTrack(this.mesh,this.u,this.lat,0);}};
 const ctx=dom.getInternalVMContext();for(const [k,v] of Object.entries(c))Object.defineProperty(ctx,k,{value:v,writable:true,configurable:true});
 // Test fixtures read and write the live context, not the seed object.
 Object.setPrototypeOf(c,null);
 const run=s=>vm.runInContext(s,ctx);
 for(const f of ['vendor/postprocessing/CopyShader.js','vendor/postprocessing/EffectComposer.js','vendor/postprocessing/ShaderPass.js','presentation.js','cinematics.js','title-attract.js'])vm.runInContext(read(f),ctx,{filename:f});
 run('var rosterAngle=0;');
 const flush=()=>{while(frames.length)frames.shift()();};
 const grid=()=>{run(`game.racers=ROSTER.map((d,i)=>new Racer(d,i===7,i));game.player=game.racers[7];game.state='countdown';`);};
 const pump=(seconds,dt=.05)=>{let n=0;while(seconds>0&&run('cinematicActive()')){run(`tickCinematic(${dt})`);seconds-=dt;n++;}return n;};
 const finite=()=>['position','quaternion'].every(k=>ctx.camera[k].toArray().every(Number.isFinite))&&Number.isFinite(ctx.camera.fov);
 return {dom,w,ctx,run,flush,grid,pump,finite,counts,frames};
}
const near=(a,b,eps=1e-6)=>a.distanceTo(b)<eps;

// 1. Scene transition hands the rebuilt grid to the pre-race cutscene; the race clock never moves.
{
 const t=world();t.grid();let commits=0;t.ctx.commitGrid=()=>commits++;
 assert.equal(t.run("transitionScene('ENTERING THE GRID',commitGrid,{cinematic:'grid'})"),true);
 assert.equal(commits,1,'geometry rebuild happens while the curtain covers');
 assert.equal(t.run('cinematicActive()'),false,'cutscene waits for the rebuilt frame');
 t.flush();assert.equal(t.run('cinematics.active&&cinematics.active.name'),'grid');
 assert.equal(t.run('sceneCut.busy'),false);
 const doc=t.w.document,skip=doc.querySelector('#cinematic .cine-skip');
 assert.ok(doc.body.classList.contains('cinematic-playing'));
 assert.equal(skip.type,'button');assert.equal(skip.getAttribute('aria-label'),'Skip cutscene');assert.equal(doc.activeElement,skip,'Skip is focused for keyboard and switch users');
 assert.equal(doc.querySelectorAll('#cinematic .cine-bar').length,2,'letterbox bars');
 const total=t.run('cinematics.active.total');assert.ok(total>=8&&total<=11,'full grid intro runs 8-11 s: '+total);
 const names=new Set(),positions=[];let flybyCard='';
 for(let s=0;s<total-.2;s+=.05){t.run('tickCinematic(.05)');assert.ok(t.finite());positions.push(t.ctx.camera.position.clone());
  const lower=doc.querySelector('.cine-lower-name').textContent;if(lower)names.add(lower);flybyCard||=doc.querySelector('.cine-title').textContent;}
 assert.equal(flybyCard,'Cherry Blossom Skyway','flyover carries the circuit name card');
 assert.ok(names.size>=4,'dolly names the rivals it passes: '+[...names].join(', '));
 assert.ok([...names].some(n=>n.includes('YOU')),'push-in lands on the player');
 assert.ok(positions[0].distanceTo(positions[40])>5&&positions[40].distanceTo(positions[120])>2,'camera actually travels');
 assert.equal(t.run('game.countdown'),3.6);assert.equal(t.run('game.raceTime'),0);assert.equal(t.run('game.state'),'countdown');
 t.pump(2);assert.equal(t.run('cinematicActive()'),false);
 const hand=t.run('cinematics.countdownPose({pos:new THREE.Vector3(),look:new THREE.Vector3(),up:new THREE.Vector3(),fov:0})');
 assert.ok(near(t.ctx.camera.position,hand.pos),'ends on the countdown rig first frame');assert.equal(t.ctx.camera.fov,62);
 assert.equal(t.run('camState.init'),false);assert.equal(t.run('camState.fov'),62);assert.ok(t.counts.touch>=1,'touch controls return for the countdown');
 assert.equal(doc.body.classList.contains('cinematic-playing'),false);assert.ok(doc.body.classList.contains('cine-reveal'));
 assert.equal(t.run('raceFX.post.flash+raceFX.post.vignette+raceFX.post.bloom'),0,'grade restored');
 // Quick variant for retries skips the establishing flyover.
 t.run("playCinematic('grid',{quick:true})");assert.ok(t.run('cinematics.active.total')<6);t.run('skipCinematic()');
}
// 2. Skip: any fresh key, a click or a gamepad press; held keys, Tab and pause never skip.
{
 const t=world();t.grid();const doc=t.w.document,key=(k,o={})=>{const e=new t.w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true,...o});doc.dispatchEvent(e);return e;};
 t.run("playCinematic('grid')");t.run('tickCinematic(.05)');
 key('w',{repeat:true});key('Tab');assert.equal(t.run('cinematicActive()'),true);
 const e=key('w');assert.equal(e.defaultPrevented,true);assert.equal(t.run('cinematicActive()'),false);
 const hand=t.run('cinematics.countdownPose({pos:new THREE.Vector3(),look:new THREE.Vector3(),up:new THREE.Vector3(),fov:0})');assert.ok(near(t.ctx.camera.position,hand.pos),'skip lands on the hand-off frame');
 t.run("playCinematic('grid')");doc.getElementById('cinematic').dispatchEvent(new t.w.MouseEvent('click',{bubbles:true}));assert.equal(t.run('cinematicActive()'),false,'tap skips');
 t.run("playCinematic('grid')");t.ctx.navigator.getGamepads=()=>[{index:0,buttons:[{pressed:true}]}];t.run('tickCinematic(.05)');assert.equal(t.run('cinematicActive()'),false,'fresh pad press skips');
 t.ctx.navigator.getGamepads=()=>[];
 t.run("playCinematic('grid')");t.run("tickCinematic(.05);game.state='paused'");const before=t.run('cinematics.active.t');
 assert.equal(t.run('tickCinematic(.05)'),false,'pause dialog owns the frame');assert.equal(t.run('cinematics.active.t'),before);assert.ok(doc.getElementById('cinematic').classList.contains('held'));
 key('Escape');assert.equal(t.run('cinematicActive()'),true,'keys belong to the pause dialog while held');
 t.run("game.state='countdown'");assert.equal(t.run('tickCinematic(.05)'),true);assert.equal(doc.getElementById('cinematic').classList.contains('held'),false);t.run('stopCinematic()');
}
// 3. Reduced motion: one short static hold on the hand-off framing, then release.
{
 const t=world(true);t.grid();t.run("playCinematic('grid')");
 assert.equal(t.run('cinematics.active.shots.length'),1);assert.ok(t.run('cinematics.active.total')<=1.5);
 const a=t.run('tickCinematic(.05),camera.position.clone()'),b=t.run('tickCinematic(.5),camera.position.clone()');assert.ok(near(a,b),'static hold');
 assert.ok(t.w.document.getElementById('cinematic').classList.contains('reduced'));t.pump(2);assert.equal(t.run('cinematicActive()'),false);
}
// 4. Menu cutscenes: the racer hero orbit owns and releases its kart; every reveal settles on the menu rig.
{
 const t=world();
 // Lens pass joins the HDR chain before the grade, only while a focus shot is on screen.
 t.run("var raceGrade=new THREE.ShaderPass(THREE.CopyShader);var raceComposer={passes:[{},{},raceGrade],insertPass(p,i){this.passes.splice(i,0,p);}};");
 const before=t.ctx.scene.children.length;t.run("playCinematic('hero')");assert.equal(t.ctx.scene.children.length,before+1,'hero kart staged on the circuit');
 t.run('tickCinematic(.5)');assert.equal(t.run('raceComposer.passes.length'),4);assert.equal(t.run('raceComposer.passes[3]===raceGrade'),true);assert.equal(t.run('raceComposer.passes[2].enabled'),true,'focus falloff on the hero');
 assert.match(t.w.document.querySelector('.cine-lower-name').textContent,/Division 3/);
 t.pump(10);assert.equal(t.run('cinematicActive()'),false);assert.equal(t.ctx.scene.children.length,before,'hero rig removed');
 assert.equal(t.counts.disposedKarts,1);assert.ok(t.counts.geometries>=1&&t.counts.materials>=1);assert.equal(t.run('raceComposer.passes[2].enabled'),false);
 const pose=t.run('rosterCameraPose()');assert.ok(near(t.ctx.camera.position,pose.pos),'settles on the character-select rig');
 t.run('cinematics.disposeLens()');assert.equal(t.run('raceComposer.passes.length'),3);
 for(const [w,h] of [[1400,900],[390,844]]){t.ctx.innerWidth=w;t.ctx.innerHeight=h;
  for(const name of ['roster','circuit','title','intro']){t.run(`playCinematic('${name}',{label:'CHOOSE YOUR RACER',sub:'Floating pagodas'})`);assert.equal(t.run('cinematics.active.name'),name);
   const total=t.run('cinematics.active.total');assert.ok(total>=2&&total<=13,name+' length '+total);
   for(let s=0;s<total+.2;s+=.1){if(!t.run('cinematicActive()'))break;t.run('tickCinematic(.1)');assert.ok(t.finite(),name+' finite at '+s);}
   assert.equal(t.run('cinematicActive()'),false,name+' ends');}}
 t.ctx.innerWidth=1400;t.ctx.innerHeight=900;
 t.run("playCinematic('intro')");assert.equal(t.w.document.querySelector('.cine-fade').style.opacity,'1','intro fades up from black');
 t.pump(9.8);assert.ok(t.w.document.querySelector('.cine-lockup').classList.contains('on'),'title lockup on the final shot');
 t.pump(5);assert.equal(t.w.document.activeElement.id,'title-start','title menu takes focus after the lockup');assert.equal(t.run('titleAttract.started'),true);
 const attract=t.run('titleAttractPose()');assert.ok(near(t.ctx.camera.position,attract.pos),'hands off to the attract camera');
 t.run('clearTitleAttract()');
}
// 5. Finish: the ceremony starts the podium film and the results hold resumes its own framing.
{
 const t=world();t.grid();t.run("game.racers.forEach((r,i)=>{r.finished=true;r.finishTime=90+i;});game.state='results'");
 assert.equal(t.run('tickFinishCeremony(.016)'),true);assert.equal(t.run('cinematics.active.name'),'podium');
 assert.match(t.w.document.querySelector('.cine-lower-tag').textContent,/WINNER/);
 const kids=t.ctx.scene.children.length;t.pump(8);assert.equal(t.run('cinematicActive()'),false);assert.equal(t.ctx.scene.children.length,kids,'podium film adds no scene objects');
 const pose=t.run('finishCeremonyPose()');assert.ok(near(t.ctx.camera.position,pose.pos),'results hold continues from the film');
 assert.equal(t.w.document.activeElement.id,'rematch');
 t.run("game.state='roster';tickFinishCeremony(.016)");assert.equal(t.run('finishCeremony.root'),null);
}
// 6. Final-lap sting frames the race without taking the camera.
{
 const t=world();t.grid();const cam=t.ctx.camera.position.clone();
 assert.equal(t.run("cinematicSting('FINAL LAP','3RD · CHERRY')"),true);const s=t.w.document.getElementById('cine-sting');
 assert.ok(s.classList.contains('on'));assert.equal(s.querySelector('.cine-sting-title').textContent,'FINAL LAP');assert.equal(t.run('cinematicActive()'),false);assert.ok(near(cam,t.ctx.camera.position));
 assert.ok(t.run('raceFX.post.flash')>0);
}
// 7. Review captures never play cutscenes.
{
 const t=world();t.grid();t.w.history.replaceState(null,'','/?review=podium');assert.equal(t.run("playCinematic('grid')"),false);
}
console.log('PASS cinematics: covered grid hand-off, rival dolly, skip/pause/reduced paths, hero/podium cleanup, lens pass, lockup and sting');
