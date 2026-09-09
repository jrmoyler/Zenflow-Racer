// ---------- Game state ----------
const game={state:'boot',racers:[],player:null,time:0,raceTime:0,countdown:0,diff:1,touch:false,trauma:0,finishTimer:0,laps:3,rankTick:0,skyMat:null,paused:false};
const SAVE_KEY='zenflow-racer-v2';
let saved={};try{saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{};}catch{}
if(typeof saved!=='object'||Array.isArray(saved))saved={};
game.autoThrottle=saved.autoThrottle===true;
let chosenMapId=typeof MAPS!=='undefined'&&MAPS.some(m=>m.id===saved.map)?saved.map:'cherry';
function raceRecordKey(division,difficulty,mapId=chosenMapId){return mapId+'-'+division+'-'+difficulty;}
function chooseMap(id){
  if(typeof MAPS==='undefined'||!MAPS.some(m=>m.id===id)||!['boot','roster','title','results'].includes(game.state))return false;
  chosenMapId=id;saved.map=id;persist();updateBestTime();
  if(typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent('mapselect',{detail:{id,map:MAPS.find(m=>m.id===id)}}));
  return true;
}
// Existing records belong to the original cherry circuit only.
for(const d of ROSTER)for(let diff=0;diff<=2;diff++){
  const old=d.id+'-'+diff,key=raceRecordKey(d.id,diff,'cherry');
  if(Number.isFinite(saved[old])&&!Number.isFinite(saved[key]))saved[key]=saved[old];
}
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(saved));}catch{}}
const input={throttle:false,brake:false,left:false,right:false,drift:false,item:false,itemEdge:false,special:false,specialEdge:false,addon:false,addonEdge:false};

class Racer{
  constructor(div,isPlayer,gridIdx){
    this.div=div;this.isPlayer=isPlayer;this.mesh=buildKart(div);scene.add(this.mesh);
    const [sp,ac,ha,we]=div.stats;
    this.maxSpeedBase=37+sp*2.2;this.accel=11+ac*2.6;this.handling=.14+ha*.012;this.weight=1+we*.28;
    this.u=-(0.007+Math.floor(gridIdx/2)*0.0068);this.lat=gridIdx%2?2.3:-2.3;this.speed=0;this.theta=0;this.steer=0;this.throttle=false;this.brake=false;
    this.drifting=false;this.driftDir=0;this.driftTime=0;this.driftTier=0;this.driftKey=false;this.boost=0;this.boostMult=1;
    this.lap=1;this.highestLap=1;this.checkpoint=false;this.progress=0;this.tokens=0;this.item=null;this.roulette=0;this.rouletteTick=0;this.tripleLeft=0;
    this.spin=0;this.shield=0;this.hitCd=0;this.wallCd=0;this.finished=false;this.finishTime=0;this.rank=gridIdx+1;this.wheelRot=0;this.visualYaw=0;this.lean=0;this.wrongWay=false;
    // Grid-staggered reaction: front rows launch first so the pack fans out instead of piling into row one.
    this.ai={steer:0,drift:false,offset:(rng()-.5)*4.2,skill:.75+rng()*.25,itemDelay:0,driftHold:0,startDelay:.08+Math.floor(gridIdx/2)*.07+rng()*.2,throttleHold:0,missileCd:0,itemHeld:0,specialIdle:0};
    this.distance=this.u;this.progress=this.u;this.startHold=0;this.wheelspin=0;this.hop=0;this.lastU=this.u;this.rubber=1;
    // Boost surge (accel ramp instead of an instant multiplier), hop→drift commit window, wrong-way timer, triple spacing.
    this.boostTarget=1;this.surge=0;this.hopWindow=0;this.wrongT=0;this.tripleCd=0;
    // Lap splits and slipstream state.
    this.lapStart=0;this.lapTimes=[];this.bestLap=0;this.lastLap=0;
    this.slipT=0;this.slipOn=false;this.slipBonus=0;this.slipOut=0;this.slipToast=false;this.slipTarget=null;this.rankShown=gridIdx+1;this.rankDelta=0;this.rankToastT=0;
    if(typeof initAbility==='function')initAbility(this);
    if(typeof initAddons==='function')initAddons(this,isPlayer?(saved.addons?.[div.id]||null):(typeof ADDONS!=='undefined'?ADDONS[(gridIdx+ROSTER.indexOf(div))%ADDONS.length]?.id:null));
    orientOnTrack(this.mesh,this.u,this.lat,0,0);
  }
  get maxSpeed(){return this.maxSpeedBase*(1+this.tokens*.014)*this.boostMult*(1+(this.slipBonus||0)*.07);}
}

function disposeProjectile(mesh){scene.remove(mesh);if(mesh.userData?.projectileDisposed)return;if(mesh.userData)mesh.userData.projectileDisposed=true;const geometries=new Set(),materials=new Set();mesh.traverse?.(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
function clearProjectiles(){mines.forEach(m=>disposeProjectile(m.mesh));missiles.forEach(m=>disposeProjectile(m.mesh));mines=[];missiles=[];}
function spawnRace(playerDiv){
  const sceneBuildStarted=performance.now();
  disposePreview();if(typeof clearAbilities==='function')clearAbilities();if(typeof clearAddons==='function')clearAddons();
  game.racers.forEach(r=>{scene.remove(r.mesh);if(typeof disposeKart==='function')disposeKart(r.mesh);});game.racers=[];[sparksBlue,sparksOrange,sparksPink,boostFx,goldFx,smokeFx,hitFx].forEach(pool=>pool.clear?.());if(typeof clearFinishCeremony==='function')clearFinishCeremony();clearProjectiles();if(typeof raceFX!=='undefined'&&!(typeof FALLBACK_GRAPHICS!=='undefined'&&FALLBACK_GRAPHICS))raceFX.init();
  if(typeof selectMap==='function'&&selectMap(chosenMapId))miniBounds=null;
  itemBoxes.forEach(b=>{b.t=0;b.mesh.visible=true;orientOnTrack(b.mesh,b.u,b.lat,1.6);});
  tokens.forEach(t=>{t.t=0;t.mesh.visible=true;orientOnTrack(t.mesh,t.u,t.lat,1.3);});
  const mapLabel=document.getElementById('race-map-name');if(mapLabel&&typeof activeMap!=='undefined')mapLabel.textContent=activeMap.name;
  if(hud.countmap){hud.countmap.textContent=(typeof activeMap!=='undefined'&&activeMap?activeMap.name.toUpperCase()+' · ':'')+['SIMULATION','STANDARD','OVERSEER'][game.diff]+' · '+game.laps+' LAPS';hud.countmap.style.opacity=1;}
  setToast.until=0;stepPositionToasts.last=-9;updateHUD.powerReady=undefined;updateHUD.spinning=false;camState.kick=0;camState.roll=0;camState.side=0;
  const others=ROSTER.filter(d=>d!==playerDiv);const order=[];const pool=others.slice();while(pool.length)order.push(pool.splice(Math.floor(rng()*pool.length),1)[0]);
  const playerGrid=7;let k=0;
  for(let i=0;i<12;i++){if(i===playerGrid){game.player=new Racer(playerDiv,true,i);game.racers.push(game.player);}else{game.racers.push(new Racer(order[k++],false,i));}}
  resetInput();lastItemKey=null;simStep.lastN=null;acc=0;
  game.raceTime=0;game.countdown=3.6;game.state='countdown';game.finishTimer=0;game.trauma=0;
  if(typeof raceTelemetry!=='undefined')raceTelemetry.start({map:chosenMapId,division:playerDiv.id,racers:game.racers.length,laps:game.laps,sceneBuildMs:performance.now()-sceneBuildStarted});
  camState.init=false;updateRanks(true);hud.item.querySelector('.ic').innerHTML='';hud.item.querySelector('.lbl').textContent='NO ITEM';setToast('');updateHUD.lastRank=0;
  showTouch();
}

// ---------- Physics step ----------
const DRIFT_TIERS=[0.9,1.9,3.0],DRIFT_BOOST=[0,.55,1.05,1.7],DRIFT_MULT=[1,1.24,1.31,1.38];
const SLIP_MIN=3,SLIP_MAX=14,SLIP_LAT=3.45,SLIP_ENGAGE=.8,MAX_MINES=6;
// Haptics: gamepad dual-rumble and touch vibration, both optional and guarded.
function rumble(strong=.6,weak=.4,ms=180){try{const pad=navigator.getGamepads?.()[0];const act=pad&&pad.vibrationActuator;if(act&&typeof act.playEffect==='function'){const p=act.playEffect('dual-rumble',{duration:ms,strongMagnitude:clamp(strong,0,1),weakMagnitude:clamp(weak,0,1)});if(p&&typeof p.catch==='function')p.catch(()=>{});}}catch{}}
function haptic(ms=40){try{if(game.touch&&typeof navigator.vibrate==='function')navigator.vibrate(ms);}catch{}}
// Every boost source goes through here: the multiplier ramps in over ~0.2 s and an accel surge gives the launch its punch.
function applyBoost(r,duration,mult,strength=1){
  r.boostTarget=Math.max(r.boost>0?r.boostTarget:1,mult);r.boost=Math.max(r.boost,duration);r.surge=Math.max(r.surge,strength);
  if(typeof raceFX!=='undefined')raceFX.onBoost(r,strength);if(r.isPlayer)rumble(.25+strength*.45,.5,140+strength*120);
}
function releaseSlipstream(r){
  const k=r.slipBonus;r.slipOn=false;r.slipT=0;r.slipTarget=null;
  if(k>.25){applyBoost(r,.3+k*.45,1.08+k*.12,.3*k);if(r.isPlayer){SFX.boost(1);setToast('DRAFT BOOST','teal','',2);}}
}
// Tucking in 3–14 m behind a rival within ~1.5 lanes builds a draft: after 0.8 s the tow grows (+7% top speed);
// pulling out or passing releases it as a short boost.
function stepSlipstream(r,dt){
  if(r.finished||r.spin>0||r.wheelspin>0||r.speed<10){if(r.slipOn)releaseSlipstream(r);r.slipT=0;r.slipTarget=null;r.slipToast=false;r.slipBonus=Math.max(0,r.slipBonus-dt*2);return;}
  const R=game.racers;let target=null,best=SLIP_MAX;
  for(let i=0;i<R.length;i++){const o=R[i];if(o===r||o.finished||o.phase>0||o.speed<8)continue;const d=du_dist(r.u,o.u);if(d<SLIP_MIN||d>=best)continue;if(Math.abs(o.lat-r.lat)>SLIP_LAT)continue;best=d;target=o;}
  if(target){
    r.slipTarget=target;r.slipOut=0;r.slipT+=dt;
    if(!r.slipOn&&r.slipT>=SLIP_ENGAGE){r.slipOn=true;if(r.isPlayer&&!r.slipToast){r.slipToast=true;setToast('SLIPSTREAM','teal','',2);SFX.ui();}}
    if(r.slipOn)r.slipBonus=Math.min(1,r.slipBonus+dt/1.2);
  }else{
    if(r.slipOn)releaseSlipstream(r);
    r.slipOut+=dt;if(r.slipOut>.25){r.slipT=0;r.slipTarget=null;r.slipToast=false;}
    r.slipBonus=Math.max(0,r.slipBonus-dt*2);
  }
}
function stepRacer(r,dt){
  const ag=trackAG(r.u);
  // --- controls -> targets
  let steerIn=r.isPlayer&&!r.finished?clamp(((input.right?1:0)-(input.left?1:0))+padSteer+touchSteer,-1,1):r.ai.steer;
  if(r.isPlayer&&game.touch&&game.steeringAssist&&!r.drifting&&r.spin<=0){
    const margin=TRACK_W/2-1.35,edge=Math.max(0,(Math.abs(r.lat)-(margin-1.5))/1.5);
    // Assist only counters passive centrifugal drift near an edge, never a deliberate steer.
    if(Math.abs(steerIn)<.12)steerIn=clamp(trackCurv(r.u)*r.speed*.22-Math.sign(r.lat)*edge*.42,-.55,.55);
  }
  if(r.spin>0){steerIn=0;r.throttle=false;}
  // Return and countersteer respond faster than turn-in, while high-speed lock is reduced.
  const counter=r.steer*steerIn<0,release=Math.abs(steerIn)<Math.abs(r.steer);
  r.steer=lerp(r.steer,steerIn,1-Math.exp(-dt*(counter?18:release?14:r.drifting?9:11)*(r.predict>0?1.35:1)));
  // --- drift state machine: hop first, then commit to a direction inside the hop window
  const wantDrift=r.isPlayer&&!r.finished?input.drift:r.ai.drift;
  if(!r.drifting&&wantDrift&&!r.driftKey&&r.speed>r.maxSpeedBase*.42&&r.spin<=0&&r.hopWindow<=0){r.hop=.28;r.hopWindow=.32;if(r.isPlayer)noiseHit(.08,.2,1200);}
  r.driftKey=wantDrift;
  if(r.hopWindow>0){r.hopWindow-=dt;if(!wantDrift||r.spin>0)r.hopWindow=0;else if(!r.drifting&&Math.abs(r.steer)>.3){r.drifting=true;r.driftDir=Math.sign(r.steer);r.driftTime=0;r.driftTier=0;r.hopWindow=0;}}
  if(r.drifting){
    // Steering into the slide charges the mini-turbo faster; counter-steering opens the arc and holds the charge.
    const into=clamp(r.steer*r.driftDir,-.6,.6);r.driftTime=Math.max(0,r.driftTime+dt*(1+into*.7));
    let tier=0;for(let i=0;i<DRIFT_TIERS.length;i++)if(r.driftTime>DRIFT_TIERS[i])tier=i+1;
    if(tier>r.driftTier){r.driftTier=tier;if(r.isPlayer){SFX.driftTier(tier);rumble(.15*tier,.35,70);}if(typeof raceFX!=='undefined')raceFX.onDriftTier(r,tier);}
    if(!wantDrift||r.speed<r.maxSpeedBase*.3||r.spin>0){
      r.drifting=false;if(r.driftTier>0&&r.spin<=0){applyBoost(r,DRIFT_BOOST[r.driftTier],DRIFT_MULT[r.driftTier],r.driftTier/3);if(r.isPlayer){SFX.boost(r.driftTier);game.trauma=Math.min(1,game.trauma+.18*r.driftTier);}}
      r.driftTier=0;r.driftTime=0;
    }
  }
  // heading relative to track tangent
  let targetTheta;
  if(r.drifting){targetTheta=r.driftDir*.085+r.steer*(r.handling+.06);}
  else targetTheta=r.steer*r.handling*steeringGain(r.speed,r.maxSpeedBase);
  if(r.spin>0)targetTheta=0;
  r.theta=lerp(r.theta,targetTheta,1-Math.exp(-dt*9));
  // --- slipstream (needs the other racers; safe with a single-racer field)
  stepSlipstream(r,dt);if(r.civicDraft>0&&r.spin<=0&&!r.finished)r.slipBonus=Math.max(r.slipBonus,.12);
  // --- longitudinal
  const max=r.maxSpeed*(r.slow>0?.68:1);
  if(r.boost>0){r.boost-=dt;r.boostMult=lerp(r.boostMult,r.boostTarget,1-Math.exp(-dt*9));if(r.boost<=0){r.boost=0;r.boostTarget=1;}}
  else{r.boostTarget=1;r.boostMult=lerp(r.boostMult,1,1-Math.exp(-dt*4));}
  if(r.surge>0){if(r.spin<=0&&r.wheelspin<=0&&r.speed<max*1.08)r.speed+=r.surge*r.accel*dt*1.6;r.surge*=Math.exp(-dt*6);if(r.surge<.02)r.surge=0;}
  if(r.wheelspin>0){r.wheelspin-=dt;r.speed=lerp(r.speed,0,dt*3);}
  else if(r.spin>0){r.speed=lerp(r.speed,4,1-Math.exp(-dt*2.5));}
  else if(r.brake){r.speed=Math.max(-9,r.speed-(r.speed>0?42:8)*dt);}
  else if(r.throttle){const target=max;r.speed+= (target-r.speed)*(r.speed<target?1:3.5)*dt*(r.accel/14)*(r.speed<target?1:1)+ (r.speed<target?r.accel*dt*.25:0);if(r.speed>target)r.speed=lerp(r.speed,target,dt*3);}
  else r.speed=lerp(r.speed,0,1-Math.exp(-dt*.9));
  // corner scrub (turning bleeds speed unless drifting)
  if(!r.drifting&&r.spin<=0)r.speed*=1-Math.abs(r.theta)*1.6*dt*(r.predict>0?.7:1);
  // --- lateral
  const curv=trackCurv(r.u);
  let latVel=r.speed*Math.sin(r.theta) - curv*r.speed*r.speed*.05*(r.drifting?.55:1);
  r.lat+=latVel*dt;
  const W=TRACK_W/2-0.9,edgeGrip=r.div.id==='gaia'&&r.specialActive>0?.35:1;
  if(Math.abs(r.lat)>W){const side=Math.sign(r.lat);r.lat=side*W;
    if(r.wallCd<=0&&r.speed>8){
      // Scrub scales with the impact angle: a graze keeps most of the speed, a square hit loses up to 55%.
      const angle=Math.atan2(Math.max(0,side*latVel),Math.max(1,Math.abs(r.speed)));const scrub=clamp(.06+angle*1.4,.06,.55)*edgeGrip;
      r.speed*=1-scrub;r.wallCd=.35;r.theta=-side*(.05+angle*.35);r.wallScrub=scrub;if(typeof raceFX!=='undefined')raceFX.onWall(r,side);
      if(r.isPlayer){SFX.wall();game.trauma=Math.min(1,game.trauma+.1+scrub*.5);rumble(.2+scrub,.3,90+scrub*160);haptic(20);}
      trackPoint(r.u,r.lat,.4,_p);trackTan(r.u,_v1);for(let i=0;i<10;i++){_v2.set(-_v1.x*8+(rng()-.5)*6,4+rng()*5,-_v1.z*8+(rng()-.5)*6);sparksOrange.emit(_p,_v2,.35+rng()*.3,.4);}}
    else{r.speed*=1-.9*dt*edgeGrip;if(r.spin<=0)r.theta-=side*.6*dt;}}  // scraping: mild drag and a nudge back onto the road
  r.wallCd-=dt;
  if(r.anchor>0&&r.spin<=0)r.speed=clamp(r.speed,r.anchorSpeed-2,r.anchorSpeed+2);
  // --- advance along track
  advanceRaceDistance(r,r.speed*dt/track.len,dt);
  // --- timers
  if(r.spin>0)r.spin-=dt;if(r.shield>0)r.shield-=dt;if(r.hitCd>0)r.hitCd-=dt;if(r.tripleCd>0)r.tripleCd-=dt;
  // --- roulette
  if(r.roulette>0){r.roulette-=dt;if(r.roulette<=0){r.item=pickItem(r);r.roulette=0;if(r.isPlayer){SFX.box();hud.item.classList.add('pop');setTimeout(()=>hud.item.classList.remove('pop'),160);}}}
  // --- visuals: track placement, suspension, body/pilot rig and additive clips live in vehicles.js
  animateKart(r,dt,ag);if(typeof raceFX!=='undefined')raceFX.step(r,dt);
  const ud=r.mesh.userData;
  // particles
  if(r.drifting&&r.speed>10){const pool=[sparksBlue,sparksBlue,sparksOrange,sparksPink][r.driftTier];const side=r.driftDir;
    for(let k=0;k<2;k++){const w=ud.wheels[side>0?3:2];w.pivot.getWorldPosition(_p);trackTan(r.u,_v1);trackUp(r.u,_v2);trackRight(r.u,_v3);
      _v1.multiplyScalar(-10-rng()*8).addScaledVector(_v2,3+rng()*4).addScaledVector(_v3,side*(2+rng()*4));pool.emit(_p,_v1,.25+rng()*.3,.3);}}
  if(r.boost>0||r.speed>r.maxSpeedBase*1.02){ud.exhaust.forEach(e=>{e.getWorldPosition(_p);trackTan(r.u,_v1);_v1.multiplyScalar(-6-rng()*6);_v1.y+=rng()*1.5;boostFx.emit(_p,_v1,.28+rng()*.2,.35);});}
  if(r.throttle&&r.speed<r.maxSpeedBase*.5&&r.speed>1&&rng()<.5){ud.exhaust[0].getWorldPosition(_p);trackTan(r.u,_v1);_v1.multiplyScalar(-2);smokeFx.emit(_p,_v1,.6+rng()*.4,.5);}
  if(r.wheelspin>0){ud.wheels[2].pivot.getWorldPosition(_p);smokeFx.emit(_p,new THREE.Vector3((rng()-.5)*3,1.5,(rng()-.5)*3),.8,.6);}
}

// Distance is measured in laps, not metres. Physical travel and forward hops share every crossing gate.
function advanceRaceDistance(r,du,dt){
  r.lastU=r.u;
  const before=r.distance;r.distance+=du;r.u=wrap01(r.distance);
  const nextLap=Math.min(game.laps+1,Math.max(1,Math.floor(r.distance)+1));
  if(nextLap>r.highestLap){
    r.highestLap=nextLap;
    // Split bookkeeping: interpolate the crossing inside this step so lap times are exact to the sub-step.
    const t=game.raceTime-dt+dt*clamp((Math.floor(r.distance)-before)/Math.max(du,1e-9),0,1);const lapTime=t-r.lapStart;r.lapStart=t;
    if(lapTime>1){r.lastLap=lapTime;r.lapTimes.push(lapTime);if(!r.bestLap||lapTime<r.bestLap)r.bestLap=lapTime;}
    if(nextLap<=game.laps&&typeof raceFX!=='undefined')raceFX.onLap(r,nextLap);
    if(r.isPlayer&&nextLap<=game.laps){SFX.lap();const n=r.lapTimes.length,prev=n>=2?r.lapTimes[n-2]:0;
      setToast(nextLap===game.laps?'FINAL LAP':'LAP '+nextLap,'gold',r.lastLap?fmtTime(r.lastLap)+(prev?' ('+fmtDelta(r.lastLap-prev)+')':''):'',3);}
  }
  r.lap=nextLap;r.checkpoint=r.u>.5;r.wrongWay=r.speed<-2;r.wrongT=r.wrongWay?r.wrongT+dt:0;r.progress=r.distance;
  if(!r.finished&&before<game.laps&&r.distance>=game.laps){
    r.finished=true;r.finishTime=game.raceTime-dt+dt*clamp((game.laps-before)/Math.max(du,1e-9),0,1);if(typeof raceFX!=='undefined')raceFX.onFinish(r);
    r.throttle=true;r.brake=false;r.ai.drift=false;if(r.slipOn){r.slipOn=false;r.slipT=0;}
  }
}

// ---------- Collisions & pickups ----------
function du_dist(a,b){let d=b-a;if(d>.5)d-=1;if(d<-.5)d+=1;return d*track.len;}
function hitRacer(r,source,attacker=null){
  if(typeof powerProtected==='function'&&powerProtected(r,attacker,source!=='reflection'))return;
  if(r.hitCd>0||r.finished)return;
  if(r.shield>0){r.shield=0;if(typeof spawnAddonContact==='function'&&!String(source).startsWith('addon-'))spawnAddonContact(r.perimeter>0?'obsidian':'shield',r.u,r.lat,r);if(typeof raceFX!=='undefined')raceFX.onShieldBlock(r);if(r.isPlayer){SFX.shieldBlock();setToast('AEGIS BLOCK','teal');}return;}
  r.spin=1.1;r.hitCd=1.6;r.drifting=false;r.driftTier=0;r.boost=0;r.boostMult=1;r.boostTarget=1;r.surge=0;r.hopWindow=0;if(r.slipOn){r.slipOn=false;r.slipT=0;r.slipBonus=0;}if(typeof raceFX!=='undefined')raceFX.onHit(r,source);
  if(typeof spawnAddonContact==='function'&&!String(source).startsWith('addon-'))spawnAddonContact(['ram','sonic','reflection'].includes(source)?(attacker?.div?.id||source):source,r.u,r.lat,attacker||r);
  const lost=Math.min(3,r.tokens);r.tokens-=lost;r.lastLostTokens=lost;trackPoint(r.u,r.lat,1,_p);
  for(let i=0;i<14+lost*4;i++){_v1.set((rng()-.5)*14,6+rng()*8,(rng()-.5)*14);(i<lost*4?goldFx:hitFx).emit(_p,_v1,.5+rng()*.5,.6);}
  if(r.isPlayer){SFX.hit();game.trauma=Math.min(1,game.trauma+.6);hud.vig.className='hit';setTimeout(()=>hud.vig.className='',350);rumble(1,.7,340);haptic(70);}
}
function stepWorld(dt){
  const R=game.racers;
  // kart vs kart
  for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const a=R[i],b=R[j];if(a.phase>0||b.phase>0||a.finished||b.finished)continue;const ds=du_dist(a.u,b.u),dl=b.lat-a.lat;
    if(Math.abs(ds)<2.6&&Math.abs(dl)<1.9){if(a.ram>0)hitRacer(b,'ram',a);if(b.ram>0)hitRacer(a,'ram',b);const push=(1.9-Math.abs(dl))*.5,sgn=dl>=0?1:-1;const wa=a.weight,wb=b.weight;if(!(a.anchor>0))a.lat-=sgn*push*wb/(wa+wb);if(!(b.anchor>0))b.lat+=sgn*push*wa/(wa+wb);
      if(a.perimeter>0){if(!(b.anchor>0))b.lat=clamp(b.lat+sgn*1.2,-TRACK_W/2+1,TRACK_W/2-1);powerSlow(b,.5,a);}
      if(b.perimeter>0){if(!(a.anchor>0))a.lat=clamp(a.lat-sgn*1.2,-TRACK_W/2+1,TRACK_W/2-1);powerSlow(a,.5,b);}
      if(Math.abs(ds)<1.2){const front=ds>0?b:a,back=ds>0?a:b;if(!(back.anchor>0))back.speed*=.94;if(!(front.anchor>0))front.speed=Math.min(front.speed+1.5,front.maxSpeed*1.1);}
      if(a.isPlayer||b.isPlayer){if(Math.abs(dl)<1.2&&game.trauma<.2)game.trauma+=.08;}}}
  // item boxes / tokens
  itemBoxes.forEach(b=>{if(b.t>0){b.t-=dt;if(b.t<=0)b.mesh.visible=true;return;}
    b.star.rotation.y+=dt*1.6;b.star.rotation.x=Math.sin(game.time*1.3+b.lat)*.35;b.core.rotation.x+=dt*3;const bob=Math.sin(game.time*2.2+b.lat)*.25;orientOnTrack(b.mesh,b.u,b.lat,1.6+bob,0);b.mesh.rotateY(b.star.rotation.y);
    for(const r of R){if(r.finished||r.phase>0||r.vault>0||r.item||r.roulette>0)continue;if(Math.abs(du_dist(r.u,b.u))<2&&Math.abs(r.lat-b.lat)<1.6){b.t=4.5;b.mesh.visible=false;r.roulette=1.4;r.rouletteTick=0;trackPoint(b.u,b.lat,1.6,_p);if(typeof raceFX!=='undefined')raceFX.onItemBox(_p);for(let i=0;i<18;i++){_v1.set((rng()-.5)*10,3+rng()*7,(rng()-.5)*10);goldFx.emit(_p,_v1,.5+rng()*.4,.5);}if(r.isPlayer)SFX.ui();break;}}});
  tokens.forEach(t=>{if(t.t>0){t.t-=dt;if(t.t<=0)t.mesh.visible=true;return;}orientOnTrack(t.mesh,t.u,t.lat,.9,0);t.mesh.rotateY(game.time*3+t.lat);
    for(const r of R){if(!r.finished&&!(r.phase>0)&&!(r.vault>0)&&Math.abs(du_dist(r.u,t.u))<1.7&&Math.abs(r.lat-t.lat)<1.3&&r.tokens<10&&r.spin<=0){t.t=9;t.mesh.visible=false;r.tokens++;r.speed=Math.min(r.speed+1.2,r.maxSpeed*1.05);trackPoint(t.u,t.lat,1,_p);if(typeof raceFX!=='undefined')raceFX.onToken(_p,r.tokens);for(let i=0;i<8;i++){_v1.set((rng()-.5)*6,3+rng()*4,(rng()-.5)*6);goldFx.emit(_p,_v1,.4,.3);}if(r.isPlayer)SFX.token(r.tokens);break;}}});
  // mines
  for(let i=mines.length-1;i>=0;i--){const m=mines[i];m.life-=dt;if(m.mesh.rotation)m.mesh.rotation.y+=dt*2;if(m.core&&m.core.material)m.core.material.emissiveIntensity=2+Math.sin(game.time*12)*1.5;
    let hit=false;for(const r of R){if(r.phase>0||r.finished||r===m.owner&&m.life>29.4)continue;if(Math.abs(du_dist(r.u,m.u))<1.8&&Math.abs(r.lat-m.lat)<1.5){hitRacer(r,'mine',m.owner);hit=true;break;}}
    if(hit||m.life<=0){trackPoint(m.u,m.lat,.6,_p);for(let k=0;k<26;k++){_v1.set((rng()-.5)*16,4+rng()*10,(rng()-.5)*16);hitFx.emit(_p,_v1,.5+rng()*.5,.6);}disposeProjectile(m.mesh);mines.splice(i,1);if(game.player&&Math.abs(du_dist(game.player.u,m.u))<40)noiseHit(.4,.35,600);}}
  // missiles
  for(let i=missiles.length-1;i>=0;i--){const m=missiles[i];m.life-=dt;m.u+=m.speed*dt/track.len;if(m.u>=1)m.u-=1;
    let target=null,best=1e9;for(const r of R){if(r===m.owner||r.phase>0||r.finished)continue;const d=du_dist(m.u,r.u);if(d>0&&d<best){best=d;target=r;}}
    if(target&&best<70)m.lat=lerp(m.lat,target.lat,1-Math.exp(-dt*(best<20?6:2)));
    m.lat=clamp(m.lat,-TRACK_W/2+1,TRACK_W/2-1);orientOnTrack(m.mesh,m.u,m.lat,.9,0);m.mesh.rotateZ(game.time*14);
    trackPoint(m.u,m.lat,.9,_p);trackTan(m.u,_v1);_v1.multiplyScalar(-4);boostFx.emit(_p,_v1,.25,.2);
    let hit=null;for(const r of R){if(r===m.owner||r.phase>0||r.finished)continue;if(Math.abs(du_dist(m.u,r.u))<2&&Math.abs(r.lat-m.lat)<1.7){hit=r;break;}}
    if(hit){hitRacer(hit,'missile',m.owner);}
    if(hit||m.life<=0){for(let k=0;k<20;k++){_v1.set((rng()-.5)*14,3+rng()*8,(rng()-.5)*14);hitFx.emit(_p,_v1,.45,.5);}disposeProjectile(m.mesh);missiles.splice(i,1);}}
}
function pickItem(r){
  const rank=r.rank,n=game.racers.length;const back=n>1?(rank-1)/(n-1):0; // 0 = leader, 1 = last
  const last=rank>=n;
  // Position-weighted: the leader never rolls Overseer Pulse; the tail of the field leans hard on Node Cluster and Vector Missile.
  const table=[['burst',1.2+back*1.0],['shield',1.4-back*.5],['mine',1.3-back*.9],['missile',(.45+back*1.5)*(last?1.5:1)],['pulse',rank===1?0:back>.6?back*1.6:.05],['triple',back*1.5*(last?1.6:1)]];
  let sum=0;for(let i=0;i<table.length;i++)sum+=table[i][1];let x=rng()*sum;for(const [k,w] of table){if(w<=0)continue;x-=w;if(x<=0)return k;}return 'burst';
}
function buildMineMesh(){if(typeof buildReferenceMine==='function')return buildReferenceMine();const g=new THREE.Group();const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),new THREE.MeshStandardMaterial({color:0x000,emissive:0xa3e635,emissiveIntensity:2}));g.add(core);const shell=new THREE.Mesh(starGeo(.9,.3),new THREE.MeshStandardMaterial({color:0x2a2f18,metalness:.7,roughness:.3}));shell.rotation.x=Math.PI/2;g.add(shell);g.userData.core=core;return g;}
function buildMissileMesh(){if(typeof buildReferenceMissile==='function')return buildReferenceMissile();const g=new THREE.Group();const body=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0,-.9),new THREE.Vector2(.28,-.8),new THREE.Vector2(.3,.3),new THREE.Vector2(0,.95)],12),new THREE.MeshStandardMaterial({color:0xcbd5e1,metalness:.85,roughness:.3}));body.rotation.x=Math.PI/2;g.add(body);const fin=new THREE.Mesh(starGeo(.7,.08),new THREE.MeshStandardMaterial({color:0x0a1628,emissive:0xcbd5e1,emissiveIntensity:1}));fin.position.z=-.7;g.add(fin);return g;}
function useItem(r){
  if(game.state!=='race'||!r.item||r.vault>0||r.spin>0||r.finished)return false;const k=r.item;
  if(k==='triple'){if(r.tripleCd>0)return false;if(!r.tripleLeft)r.tripleLeft=3;r.tripleLeft--;r.tripleCd=.28;applyBoost(r,1.0,1.34,.7);if(r.isPlayer)SFX.boost(2);if(r.tripleLeft>0)return true;}
  else if(k==='burst'){applyBoost(r,1.35,1.4,1);if(r.isPlayer){SFX.boost(3);setToast('SIGNAL BURST','teal','',2);}}
  else if(k==='shield'){r.shield=7;if(r.isPlayer){SFX.shieldBlock();setToast('AEGIS SHIELD','teal','',2);}}
  else if(k==='mine'){
    // Six live mines per race: the oldest is retired before a new one is armed.
    while(mines.length>=MAX_MINES){const old=mines.shift();disposeProjectile(old.mesh);}
    const g=buildMineMesh();scene.add(g);const u=wrap01(r.u-3.5/track.len);orientOnTrack(g,u,r.lat,.5,0);mines.push({u,lat:r.lat,mesh:g,core:g.userData?g.userData.core:null,owner:r,life:30});if(r.isPlayer)SFX.ui();}
  else if(k==='missile'){const g=buildMissileMesh();scene.add(g);
    missiles.push({u:wrap01(r.u+3/track.len),lat:r.lat,mesh:g,owner:r,speed:Math.max(r.speed,20)+42,life:7});if(!r.isPlayer)r.ai.missileCd=3;if(r.isPlayer){SFX.fire();setToast('VECTOR MISSILE','','',2);}}
  else if(k==='pulse'){game.racers.forEach(o=>{if(o!==r&&o.rank<r.rank)hitRacer(o,'pulse',r);});if(r.isPlayer){setToast('OVERSEER PULSE','gold','',2);}SFX.pulse();game.trauma=Math.min(1,game.trauma+.35);
    trackPoint(r.u,r.lat,1,_p);for(let k2=0;k2<60;k2++){_v1.set((rng()-.5)*40,2+rng()*12,(rng()-.5)*40);goldFx.emit(_p,_v1,.8,1);}}
  r.item=null;r.tripleLeft=0;r.ai.itemHeld=0;return true;
}

// ---------- AI ----------
// Situational awareness helpers (allocation-free scans over the live field).
function aiRivalAhead(r,range,lat){const R=game.racers;let best=null,bd=range;for(let i=0;i<R.length;i++){const o=R[i];if(o===r||o.finished||o.phase>0)continue;const d=du_dist(r.u,o.u);if(d>0&&d<bd&&Math.abs(o.lat-r.lat)<lat){bd=d;best=o;}}return best;}
function aiRivalBehind(r,range,lat){const R=game.racers;let best=null,bd=range;for(let i=0;i<R.length;i++){const o=R[i];if(o===r||o.finished||o.phase>0)continue;const d=-du_dist(r.u,o.u);if(d>0&&d<bd&&Math.abs(o.lat-r.lat)<lat){bd=d;best=o;}}return best;}
function aiIncomingMissile(r,range,lat=4){for(let i=0;i<missiles.length;i++){const m=missiles[i];if(m.owner===r)continue;const d=du_dist(m.u,r.u);if(d>0&&d<range&&Math.abs(m.lat-r.lat)<lat)return m;}return null;}
function aiMineAhead(r,range,lat=2.4){for(let i=0;i<mines.length;i++){const m=mines[i];const d=du_dist(r.u,m.u);if(d>0&&d<range&&Math.abs(m.lat-r.lat)<lat)return m;}return null;}
function aiThreatened(r){if(aiIncomingMissile(r,50))return true;if(aiMineAhead(r,18))return true;const b=aiRivalBehind(r,9,2.6);return !!(b&&b.ram>0);}
function aiTokenNear(r,range){for(let i=0;i<tokens.length;i++){const t=tokens[i];if(t.t<=0&&Math.abs(du_dist(r.u,t.u))<range)return true;}return false;}
// Director powers: defensive kinds fire when threatened, offensive kinds when a rival is in their envelope.
function aiWantsSpecial(r){
  if(game.state!=='race'||r.finished||r.specialCooldown>0||r.isPlayer||r.spin>0&&!['helix','eon'].includes(r.div.id))return false;
  let want=false;
  switch(r.div.id){
    case 'zenflow':want=!!(aiRivalAhead(r,18,9)||aiRivalBehind(r,18,9));break;
    case 'collective':{if(r.tokens<10){const R=game.racers;for(let i=0;i<R.length;i++){const o=R[i];if(o!==r&&!o.finished&&!(o.phase>0)&&!(o.vault>0)&&o.tokens>0&&Math.abs(du_dist(r.u,o.u))<35){want=true;break;}}}break;}
    case 'hybrid':want=aiThreatened(r);break;
    case 'nexus':{const b=aiRivalBehind(r,16,9);want=!!aiIncomingMissile(r,60)||!!(b&&b.item==='missile');break;}
    case 'kinetic':want=!!(aiRivalAhead(r,8,3)||aiRivalBehind(r,5,3));break;
    case 'juris':{const b=aiRivalBehind(r,12,9);want=!!aiIncomingMissile(r,50)||!!(b&&b.item);break;}
    case 'signal':want=!!aiRivalAhead(r,70,3);break;
    case 'loom':want=!!aiRivalBehind(r,12,3);break;
    case 'vector':want=!!aiIncomingMissile(r,30,2.2)||!!aiMineAhead(r,15,2.2);break;
    case 'aether':want=r.tokens<10&&aiTokenNear(r,24);break;
    case 'animus':want=!!aiRivalAhead(r,32,9);break;
    case 'helix':want=r.spin>0||r.slow>0||(r.lastLostTokens||0)>0;break;
    case 'ledger':want=game.racers.some(o=>o!==r&&!o.finished&&!(o.phase>0)&&Math.abs(du_dist(r.u,o.u))<16&&(o.item||o.tokens>=3));break;
    case 'terra':want=aiThreatened(r)||!!(aiRivalAhead(r,4,2)||aiRivalBehind(r,4,2));break;
    case 'obsidian':want=!!aiIncomingMissile(r,50)||!!(aiRivalAhead(r,8,3)||aiRivalBehind(r,8,3));break;
    case 'civic':want=!!(aiRivalAhead(r,14,4)||aiRivalBehind(r,14,4));break;
    case 'cognara':want=Math.abs(trackCurv(r.u))>.012||!!aiRivalAhead(r,20,4);break;
    case 'gaia':want=!!aiRivalBehind(r,12,3)||Math.abs(r.lat)>TRACK_W/2-1.1;break;
    case 'nomad':{const ahead=aiRivalAhead(r,10,2);want=!!aiIncomingMissile(r,30,2.2)||!!aiMineAhead(r,15,2.2)||!!(ahead&&du_dist(r.u,ahead.u)>=6);break;}
    case 'eon':want=r.spin>0||r.slow>0||r.speed<r.maxSpeed*.55;break;
  }
  // A power left unused for a long stretch is still worth spending when anyone is nearby.
  if(!want&&r.ai.specialIdle>14&&(aiRivalAhead(r,40,9)||aiRivalBehind(r,40,9)))want=true;
  return want;
}
// Items are held until they can do something: missiles want a target, mines want a chaser, shields wait for a threat.
function aiWantsItem(r,curvNear){
  const held=r.ai.itemHeld;
  switch(r.item){
    case 'missile':return r.ai.missileCd<=0&&!!aiRivalAhead(r,60,5);
    case 'mine':return !!aiRivalBehind(r,14,9)||held>9;
    case 'shield':return aiThreatened(r)||held>8;
    case 'pulse':return r.rank>=3||(held>6&&r.rank>1);
    case 'burst':case 'triple':return Math.abs(curvNear)<.012||held>4;
  }
  return true;
}
function stepAI(r,dt){
  if(r.finished){r.throttle=true;r.ai.steer=lerp(r.ai.steer,-r.lat*.3,dt*2);r.ai.drift=false;return;}
  if(game.state==='countdown'){r.throttle=false;r.ai.steer=0;r.ai.drift=false;return;}
  r.ai.throttleHold+=dt;r.throttle=r.ai.throttleHold>r.ai.startDelay;
  const look=0.012+r.speed*0.0004;const cA=trackCurv(r.u+look),cB=trackCurv(r.u+look*2.2);
  const skill=r.ai.skill+game.diff*.08;
  // Racing line: set up wide for the corner seen far ahead, then cut to the apex (inside) as the near curvature builds.
  const nearK=Math.min(Math.abs(cA)*45,1);
  let target=Math.sign(cA)*Math.min(Math.abs(cA)*170,4.4)-Math.sign(cB)*Math.min(Math.abs(cB)*95,3.2)*(1-nearK)+r.ai.offset*(1-nearK);
  // avoid mines ahead and missiles closing from behind
  for(let i=0;i<mines.length;i++){const m=mines[i];const d=du_dist(r.u,m.u);if(d>0&&d<28&&Math.abs(m.lat-r.lat)<3){target+= (r.lat>m.lat?2.6:-2.6);}}
  for(let i=0;i<missiles.length;i++){const m=missiles[i];if(m.owner===r)continue;const d=du_dist(m.u,r.u);if(d>0&&d<24&&Math.abs(m.lat-r.lat)<2.4)target+=(r.lat>m.lat?2.4:-2.4);}
  // avoid rear-ending slower racers; lift the throttle when boxed in directly behind one
  let lift=false;const R=game.racers;
  for(let i=0;i<R.length;i++){const o=R[i];if(o===r)continue;const d=du_dist(r.u,o.u);if(d>0&&d<9&&Math.abs(o.lat-r.lat)<2.2&&o.speed<r.speed){target+=(r.lat>o.lat?1.8:-1.8);if(d<5.5&&Math.abs(o.lat-r.lat)<1.6&&o.speed<r.speed-3&&!r.slipOn)lift=true;}}
  if(lift)r.throttle=false;
  target=clamp(target,-5.4,5.4);
  // Predict the lane at reaction time; damp weaving and feed forward the road's lateral load.
  const lateral=r.speed*Math.sin(r.theta)-trackCurv(r.u)*r.speed*r.speed*.05;
  const err=target-r.lat-lateral*.22;
  const roadHold=trackCurv(r.u)*r.speed*.05/Math.max(.1,r.handling*steeringGain(r.speed,r.maxSpeedBase));
  r.ai.steer=clamp(err/3.2*skill+roadHold,-1,1);
  // drifting
  const bigCurve=Math.abs(cA)>.02||Math.abs(cB)>.024;
  if(!r.drifting){if(bigCurve&&r.speed>r.maxSpeedBase*.6&&rng()<skill*dt*4){r.ai.drift=true;r.ai.driftHold=1.2+rng()*1.6+game.diff*.4;r.ai.steer=Math.sign(cA)*Math.max(.5,Math.abs(r.ai.steer));}}
  else{r.ai.driftHold-=dt;if(r.ai.driftHold<=0||(!bigCurve&&Math.abs(trackCurv(r.u+look*.5))<.006))r.ai.drift=false;else r.ai.steer=clamp(r.ai.steer+r.driftDir*.35,-1,1);}
  if(!r.drifting&&r.ai.driftHold<=0)r.ai.drift=false;
  r.brake=false;
  // items
  if(r.ai.missileCd>0)r.ai.missileCd-=dt;
  if(r.item){r.ai.itemHeld+=dt;r.ai.itemDelay-=dt;if(r.ai.itemDelay<=0&&aiWantsItem(r,cA)){useItem(r);r.ai.itemDelay=.6+rng()*1.2;}}
  else{r.ai.itemDelay=.6+rng()*2;r.ai.itemHeld=0;}
  r.ai.specialIdle=r.specialCooldown>0?0:r.ai.specialIdle+dt;
  // rubber band relative to player: none in SIMULATION; STANDARD/OVERSEER never exceed the player's top speed by more than 8% / 14%.
  const p=game.player;
  if(game.diff===0||!p){r.rubber=.9+r.ai.skill*.1;}
  else{const diff=p.progress-r.progress;const band=[0,.8,.7][game.diff],base=[.9,.95,1.03][game.diff],cap=[1,1.08,1.14][game.diff];
    r.rubber=clamp(base+diff*band,.84,cap*p.maxSpeedBase/r.maxSpeedBase);}
}

// ---------- Camera ----------
const camState={init:false,pos:new THREE.Vector3(),look:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),fov:66,kick:0,boostPrev:0,roll:0,side:0};
// Chase rig: close and low so the livery and pilot read, pulling back and widening with speed, kicking FOV on boost,
// leaning into drifts, looking through corners via trackCurv, and rolling gently with the chassis lean.
function chaseCamera(p,portrait){
  const spd=clamp(p.speed/p.maxSpeedBase,0,1.4);
  const back=(portrait?7.9:7.0)+spd*1.0+(p.boost>0?.8:0)+camState.kick*.4;
  const height=(portrait?3.3:2.7)+spd*.25;
  const lookAhead=(portrait?4.6:5.5)+spd*.8;
  const curv=trackCurv(wrap01(p.u+0.012+spd*.012));
  return {back,height,lookAhead,lookUp:portrait?1.5:1.0,lookSide:clamp(curv*95,-3.5,3.5),fov:66+spd*7+camState.kick*9+(p.boost>0?5:0)+(p.drifting?p.driftTier*1.2:0)+(portrait?4:0)};
}
function updateCamera(dt){
  const p=game.player;if(!p)return;
  trackPoint(p.u,p.lat,0.9,_p);trackTan(p.u,_v1);trackUp(p.u,_v2);trackRight(p.u,_v3);
  const fwd=_v1.clone().applyAxisAngle(_v2,p.visualYaw*.35),up=_v2.clone();
  let target,look,fovT;
  if(game.state==='countdown'){const k=clamp(1-game.countdown/3.6,0,1);const a=lerp(Math.PI*.75,0,smooth(k));const dist=lerp(9,7.6,k);
    target=_p.clone().addScaledVector(fwd,Math.cos(a)*-dist).addScaledVector(_v3,Math.sin(a)*dist).addScaledVector(up,lerp(1.6,3.0,k));look=_p.clone().addScaledVector(fwd,1.5).addScaledVector(up,.6);fovT=62;camState.kick=0;camState.boostPrev=p.boost;}
  else{
    if(p.boost>camState.boostPrev+.25)camState.kick=1;camState.boostPrev=p.boost;camState.kick*=Math.exp(-dt*2.4);
    const portrait=innerHeight>innerWidth*1.05,c=chaseCamera(p,portrait);
    const sideT=p.drifting?-p.driftDir*.9:0;camState.side=lerp(camState.side,sideT,1-Math.exp(-dt*4));
    target=_p.clone().addScaledVector(fwd,-c.back).addScaledVector(up,c.height).addScaledVector(_v3,p.visualYaw*-1.1+camState.side*.5);
    look=_p.clone().addScaledVector(fwd,c.lookAhead).addScaledVector(up,c.lookUp).addScaledVector(_v3,c.lookSide+camState.side);fovT=c.fov;}
  if(!camState.init){camState.pos.copy(target);camState.look.copy(look);camState.up.copy(up);camState.init=true;camState.roll=0;camState.side=0;}
  const k=1-Math.exp(-dt*(game.state==='countdown'?3:7.5));camState.pos.lerp(target,k);camState.look.lerp(look,1-Math.exp(-dt*11));camState.up.lerp(up,1-Math.exp(-dt*6)).normalize();
  // shake (trauma^2) and lean roll
  game.trauma=Math.max(0,game.trauma-dt*1.5);const sh=game.trauma*game.trauma;const t=game.time*31;
  camState.roll=lerp(camState.roll,game.state==='countdown'?0:(p.lean||0)*.55+(p.drifting?p.driftDir*.012:0),1-Math.exp(-dt*5));
  camera.position.copy(camState.pos).addScaledVector(_v3,Math.sin(t)*sh*.5).addScaledVector(up,Math.cos(t*1.3)*sh*.35);
  camera.up.copy(camState.up);camera.lookAt(camState.look);camera.rotateZ(Math.sin(t*.9)*sh*.05+camState.roll);
  camState.fov=lerp(camState.fov,fovT,1-Math.exp(-dt*5));camera.fov=camState.fov;camera.updateProjectionMatrix();
  // shadows follow the player
  sun.target.position.copy(_p);sun.position.copy(_p).add(new THREE.Vector3(-90,140,-60));
  hud.vig.className=p.boost>0?'boost':(hud.vig.className==='hit'?'hit':p.slipOn?'slip':'');
}

// ---------- HUD ----------
const hud={};['pos','lap','tok','item','mini','speedo','speedbar','timer','toast','toastsub','count','countmap','vig','wrong','ranks','tP'].forEach(id=>hud[id]=document.getElementById(id));
const miniCtx=hud.mini.getContext('2d');let miniBounds=null;
// Toasts carry a priority: a lower-priority message (position changes) never replaces a lap split or item call-out that is still showing.
function setToast(text,cls='',sub='',prio=1){
  if(text&&prio<(setToast.prio||0)&&game.raceTime<(setToast.until||0))return false;
  hud.toast.textContent=text;hud.toast.className=cls;if(hud.toastsub)hud.toastsub.textContent=sub||'';
  if(!text){setToast.until=0;return true;}
  setToast.prio=prio;setToast.until=game.raceTime+1.3;
  requestAnimationFrame(()=>hud.toast.classList.add('show'));clearTimeout(setToast.t);setToast.t=setTimeout(()=>hud.toast.classList.remove('show'),sub?1900:1400);return true;
}
function fmtTime(t){const m=Math.floor(t/60),s=t-m*60;return `${String(m).padStart(2,'0')}:${s.toFixed(2).padStart(5,'0')}`;}
// Signed split, e.g. "−0:01.3" (one decimal) or "+0:02.31" (two decimals for results/PB).
function fmtDelta(d,decimals=1){const sign=d<0?'−':'+';d=Math.abs(d);const m=Math.floor(d/60),s=d-m*60;return sign+m+':'+s.toFixed(decimals).padStart(decimals+3,'0');}
function raceOrder(a,b){return a.finished&&b.finished?a.finishTime-b.finishTime:a.finished?-1:b.finished?1:b.progress-a.progress;}
// Time gap to the racer ahead (or to the chaser when leading), estimated from track distance at the player's pace.
function gapText(sorted,p){
  const i=sorted.indexOf(p);if(i<0||sorted.length<2||p.finished)return '';
  const pace=Math.max(8,Math.abs(p.speed)),len=typeof track!=='undefined'?track.len:1000;
  if(i===0){const gap=(p.progress-sorted[1].progress)*len/pace;return '▼ LEAD +'+gap.toFixed(1)+'s';}
  const gap=(sorted[i-1].progress-p.progress)*len/pace;return '▲ +'+gap.toFixed(1)+'s';
}
function updateRanks(force){
  const sorted=game.racers.slice().sort(raceOrder);sorted.forEach((r,i)=>r.rank=i+1);
  if(!force&&game.rankTick>0)return;
  const gap=game.player?gapText(sorted,game.player):'';
  hud.ranks.innerHTML=sorted.map((r,i)=>`<div class="${r.isPlayer?'me':''}" style="--c:${r.div.acc}"><i></i>${String(i+1).padStart(2,' ')} ${r.div.name.toUpperCase()}${r.finished?' ✓':''}</div>`).join('')+(gap?`<div class="gap">${gap}</div>`:'');
}
function drawMini(){
  if(!track.pos||!track.pos.length)return;const c=miniCtx,W=hud.mini.width;c.clearRect(0,0,W,W);
  if(!miniBounds){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;track.pos.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);});const s=Math.max(x1-x0,z1-z0)*1.12;miniBounds={x0:(x0+x1)/2-s/2,z0:(z0+z1)/2-s/2,s};}
  const map=p=>[(p.x-miniBounds.x0)/miniBounds.s*W,(p.z-miniBounds.z0)/miniBounds.s*W];
  c.lineCap='round';c.lineJoin='round';
  // outline
  c.beginPath();for(let i=0;i<=N_SAMP;i+=6){const [x,y]=map(track.pos[i%N_SAMP]);i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.strokeStyle='rgba(5,10,24,.85)';c.lineWidth=16;c.stroke();
  // road, coloured by anti-grav
  for(let i=0;i<N_SAMP;i+=6){const a=track.pos[i],b=track.pos[(i+6)%N_SAMP];const [ax,ay]=map(a),[bx,by]=map(b);c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.strokeStyle=track.ag[i]>.5?'#00D9B5':'#8B9BAE';c.lineWidth=track.ag[i]>.5?9:8;c.stroke();}
  const [sx,sy]=map(track.pos[0]);c.fillStyle='#F5F5F5';c.fillRect(sx-4,sy-4,8,8);
  game.racers.forEach(r=>{if(r.isPlayer)return;const [x,y]=map(r.mesh.position);c.fillStyle=r.div.acc;c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillRect(-5,-5,10,10);c.restore();});
  const p=game.player;const [x,y]=map(p.mesh.position);c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle='#0A0F1E';c.fillRect(-9,-9,18,18);c.fillStyle='#a8f8ff';c.fillRect(-6.5,-6.5,13,13);c.restore();
}
let lastItemKey=null;
const DRIFT_LABELS=['DRIFT · HOLD TO CHARGE','BLUE BOOST · RELEASE','GOLD BOOST · RELEASE','ULTRA BOOST · RELEASE'];
function updateHUD(dt){
  const p=game.player;if(!p)return;
  game.rankTick-=dt;updateRanks(false);if(game.rankTick<=0)game.rankTick=.25;
  hud.pos.querySelector('.n').textContent=p.rank;hud.pos.querySelector('.o').textContent=ordinal(p.rank);if(p.rank!==updateHUD.lastRank){updateHUD.lastRank=p.rank;updateHUD.bump=.35;}updateHUD.bump=Math.max(0,(updateHUD.bump||0)-dt);hud.pos.className=(p.rank===1?'p1':p.rank>=9?'pl':'')+(updateHUD.bump>0?' bump':'');
  hud.lap.textContent=p.finished?'FINISH':`LAP ${Math.min(p.lap,game.laps)}/${game.laps}`;hud.tok.textContent=p.tokens;
  hud.speedo.querySelector('b').textContent=Math.round(Math.max(0,p.speed)*3.1);
  // speed bar: fills against the boosted ceiling, teal while boosting, soft blue in a draft
  if(hud.speedbar){hud.speedbar.style.setProperty('--v',Math.round(clamp(p.speed/(p.maxSpeedBase*1.4),0,1)*100)+'%');const cls=p.boost>0?'boost':p.slipOn?'slip':'';if(hud.speedbar.className!==cls)hud.speedbar.className=cls;}
  hud.timer.textContent=fmtTime(p.finished?p.finishTime:game.raceTime);
  // wrong-way warning waits a second of genuine reversing before it fades in
  hud.wrong.style.display=p.wrongT>1?'block':'none';
  // item slot with a countdown ring while the roulette spins
  const ic=hud.item.querySelector('.ic'),lbl=hud.item.querySelector('.lbl');
  if(p.roulette>0){p.rouletteTick-=dt;if(p.rouletteTick<=0){p.rouletteTick=.07+ (1.4-p.roulette)*.08;const keys=Object.keys(ITEMS);const k=keys[Math.floor(rng()*keys.length)];ic.innerHTML=itemIconSVG(k);lbl.textContent='';SFX.ui();}
    hud.item.style.setProperty('--spin',(1-p.roulette/1.4).toFixed(3));if(!updateHUD.spinning){updateHUD.spinning=true;hud.item.classList.add('spin');}}
  else{if(updateHUD.spinning){updateHUD.spinning=false;hud.item.classList.remove('spin');hud.item.style.setProperty('--spin','0');}
    if(p.item){const key=p.item+(p.tripleLeft||'');if(key!==lastItemKey){ic.innerHTML=itemIconSVG(p.item);lbl.textContent=ITEMS[p.item].name+(p.tripleLeft?` ×${p.tripleLeft}`:'');lastItemKey=key;}}
    else if(lastItemKey!==null){ic.innerHTML='';lbl.textContent='NO ITEM';lastItemKey=null;}}
  const drift=document.getElementById('driftmeter');if(drift){drift.hidden=!p.drifting;drift.style.setProperty('--charge',Math.min(100,p.driftTime/3*100)+'%');drift.dataset.tier=p.driftTier;drift.textContent=DRIFT_LABELS[p.driftTier];}
  if(typeof updateAddonHUD==='function')updateAddonHUD(p);
  const special=document.getElementById('specialHUD');if(special&&typeof ABILITIES!=='undefined'){const ability=ABILITIES[p.div.id];const ready=!(p.specialCooldown>0);const specialLabel=document.getElementById('specialLabel');if(specialLabel)specialLabel.textContent=ability.name+' · '+(ready?(game.touch?'READY':'Q / Y · READY'):Math.ceil(p.specialCooldown)+'s');special.dataset.ready=ready?'true':'false';special.style.setProperty('--ready',Math.max(0,1-p.specialCooldown/ability.cooldown));
    if(hud.tP){if(ready!==updateHUD.powerReady){updateHUD.powerReady=ready;if(ready)hud.tP.classList.add('ready');else hud.tP.classList.remove('ready');}hud.tP.textContent=ready?'POWER':Math.ceil(p.specialCooldown)+'s';}}
  drawMini();
}

// ---------- Race flow ----------
function onPlayerFinish(){
  if(typeof clearAddons==='function')clearAddons();if(typeof clearAbilities==='function')clearAbilities();
  if(typeof raceTelemetry!=='undefined')raceTelemetry.finish(game.player.finishTime);
  updateRanks(true);const p=game.player,key=raceRecordKey(p.div.id,game.diff);const old=saved[key];
  game.newBest=!Number.isFinite(old)||p.finishTime<old;game.pbDelta=Number.isFinite(old)?p.finishTime-old:null;
  if(game.newBest){saved[key]=p.finishTime;persist();}
  game.state='finish';SFX.finish();rumble(.6,.8,400);
  const pb=game.newBest?(Number.isFinite(old)?'PB '+fmtDelta(game.pbDelta,2):'NEW PERSONAL BEST'):'';
  setToast(p.rank===1?'VICTORY':'FINISH','gold',pb,4);game.finishTimer=3.2;hideTouch();
}
function showResults(){
  const sorted=game.racers.slice().sort(raceOrder);const leader=sorted[0];
  const p=game.player;document.getElementById('rtitle').innerHTML=p.rank===1?'Circuit <span>Champion</span>':p.rank<=3?'Podium <span>Finish</span>':'Race <span>Complete</span>';
  const pb=game.newBest?(Number.isFinite(game.pbDelta)?' · PB '+fmtDelta(game.pbDelta,2):' · PERSONAL BEST'):'';
  document.getElementById('rsub').textContent=`${p.div.name.toUpperCase()} · ${ordinal(p.rank).toUpperCase()==='ST'?'1ST':p.rank+ordinal(p.rank).toUpperCase()} · ${fmtTime(p.finishTime)}${pb} · ${['SIMULATION','STANDARD','OVERSEER'][game.diff]}${typeof activeMap!=='undefined'&&activeMap?' · '+activeMap.name.toUpperCase():''}`;
  let fastest=0;for(const r of sorted)if(r.bestLap>0&&(!fastest||r.bestLap<fastest))fastest=r.bestLap;
  const board=document.getElementById('board');
  board.innerHTML='<div class="hd"><b>#</b><span>DIRECTOR</span><i>TIME</i><i class="bl">BEST LAP</i><i class="gp">GAP</i></div>'+sorted.map((r,i)=>{
    const gap=!r.finished?'':r===leader?'LEADER':leader&&leader.finished?fmtDelta(r.finishTime-leader.finishTime,2):'';
    return `<div class="${r.isPlayer?'me':''}" style="--c:${r.div.acc}"><b>${i+1}</b><span><em></em>${r.div.name}</span><i>${r.finished?fmtTime(r.finishTime):'RACING · LAP '+Math.min(r.lap,game.laps)}</i><i class="bl${r.bestLap>0&&r.bestLap===fastest?' fastest':''}">${r.bestLap>0?fmtTime(r.bestLap):'—'}</i><i class="gp">${gap}</i></div>`;}).join('');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');game.state='results';
}
// Results → Next Circuit: cycle to the following MAPS entry and restart with the same director and difficulty.
function nextCircuit(){
  if(game.state!=='results'||typeof MAPS==='undefined'||!MAPS.length)return false;
  const i=MAPS.findIndex(m=>m.id===chosenMapId);if(!chooseMap(MAPS[(i+1)%MAPS.length].id))return false;
  document.getElementById('results').classList.add('hidden');audioInit();startRace();return true;
}
// Pause/results → Restart: same circuit, same grid roll.
function restartRace(){
  if(game.state!=='paused'&&game.state!=='results')return false;
  document.getElementById('pause').classList.add('hidden');document.getElementById('results').classList.add('hidden');audioInit();startRace();return true;
}
function toggleMute(){
  audioInit();AUDIO.on=!AUDIO.on;saved.muted=!AUDIO.on;persist();
  for(const id of ['mutebtn','pausemute']){const el=document.getElementById(id);if(el)el.textContent=AUDIO.on?'SOUND ON':'SOUND OFF';}
  return AUDIO.on;
}
// Position-change toasts: changes are pooled for 0.6 s (start-line churn collapses to one message) and yield to lap/item toasts.
function stepPositionToasts(p,dt){
  if(p.rank!==p.rankShown){p.rankDelta+=p.rankShown-p.rank;p.rankShown=p.rank;p.rankToastT=.6;}
  if(p.rankToastT>0){p.rankToastT-=dt;if(p.rankToastT<=0){const d=p.rankDelta;p.rankDelta=0;
    if(d&&game.raceTime>4&&!p.finished&&game.raceTime-(stepPositionToasts.last||-9)>1.2&&setToast((d>0?'+':'−')+Math.abs(d)+(Math.abs(d)===1?' POSITION':' POSITIONS'),d>0?'teal':'',d>0?ordinal(p.rank)==='st'?'1ST':p.rank+ordinal(p.rank).toUpperCase():'',0))stepPositionToasts.last=game.raceTime;}}
}

// ---------- Main loop ----------
let last=performance.now(),acc=0;const STEP=1/120;
let lastFrameState=null,staticFrameDirty=true;
const frameReview={start:0,count:0};
function reportFrameMetrics(now){
  if(typeof location==='undefined'||!/[?&]review=1(?:&|$)/.test(location.search))return;
  if(!frameReview.start){frameReview.start=now;return;}
  frameReview.count++;
  if(now-frameReview.start<1000)return;
  const out=document.documentElement.dataset;
  out.frameMs=((now-frameReview.start)/frameReview.count).toFixed(1);
  out.raceState=game.state;out.raceSeconds=game.raceTime.toFixed(2);
  out.renderTriangles=String(renderer.info?.render?.triangles||0);
  out.renderWorkMs=(renderer.info?.render?.workMs||0).toFixed(1);
  out.renderMode=FALLBACK_GRAPHICS?'Software 3D':'WebGL';
  frameReview.start=now;frameReview.count=0;
}
function frame(now){
  requestAnimationFrame(frame);
  if(typeof renderReconstructionReview==='function'&&renderReconstructionReview())return;
  if(document.hidden){last=now;return;}
  reportFrameMetrics(now);
  if(typeof raceTelemetry!=='undefined')raceTelemetry.frame(now,game.state,game.raceTime);
  if(game.state!==lastFrameState){staticFrameDirty=true;lastFrameState=game.state;}
  const elapsed=(now-last)/1000;let dt=Math.min(.1,Math.max(0,elapsed));last=now;
  if(typeof updateRenderBudget==='function'&&['race','countdown'].includes(game.state))updateRenderBudget(elapsed*1000);
  if(typeof sceneCut!=='undefined'&&sceneCut.busy){renderRaceScene();if(game.state==='roster')renderSelectedPreview(0);return;}
  if(typeof tickFinishCeremony==='function'&&tickFinishCeremony(dt)){renderRaceScene();audioUpdate(dt,game.player);return;}
  if(typeof tickTitleAttract==='function'&&tickTitleAttract(dt)){renderRaceScene();return;}
  if(game.state==='paused')pollGamepad();
  if(game.state==='paused'||game.state==='boot'||game.state==='roster'||game.state==='results'){ if(game.state!=='boot'&&game.state!=='roster'&&staticFrameDirty){(typeof renderRaceScene==='function'?renderRaceScene():renderer.render(scene,camera));staticFrameDirty=false;}if(game.state==='roster'){rosterOrbit(dt);(typeof renderRaceScene==='function'?renderRaceScene():renderer.render(scene,camera));renderSelectedPreview(dt);}audioUpdate(dt,game.player);return;}
  if(typeof updateMapScenery==='function')updateMapScenery(dt);
  pollGamepad();game.time+=dt;acc+=dt;let steps=0;
  while(acc>=STEP&&steps<12&&['countdown','race','finish'].includes(game.state)){simStep(STEP);acc-=STEP;steps++;}
  if(steps===12)acc=0;
  [sparksBlue,sparksOrange,sparksPink,boostFx,goldFx,smokeFx,hitFx].forEach(p=>p.update(dt));if(typeof raceFX!=='undefined')raceFX.update(dt,game.player);
  updateCamera(dt);updateHUD(dt);
  world.traverse(o=>{if(o.userData.spin)o.rotation.z+=o.userData.spin*dt*(o.geometry&&o.geometry.type==='TorusGeometry'?1:0),o.rotation.y+=o.userData.spin*dt;});
  TEX.crowd.offset.y=Math.sin(game.time*6)*.012;
  if(game.skyMat)game.skyMat.uniforms.time.value=game.time;
  audioUpdate(dt,game.player);
  (typeof renderRaceScene==='function'?renderRaceScene():renderer.render(scene,camera));
}
function simStep(dt){
  const p=game.player;
  if(game.state==='countdown'){
    game.countdown-=dt;const c=game.countdown;
    const n=c>3?'':c>2?'3':c>1?'2':c>0?'1':'GO';
    if(n!==simStep.lastN){simStep.lastN=n;hud.count.textContent=n;hud.count.className=n==='GO'?'go':'';hud.count.style.opacity=n?1:0;if(hud.countmap)hud.countmap.style.opacity=n==='GO'?0:1;if(n&&n!=='GO')SFX.count();if(n==='GO'){SFX.go();setTimeout(()=>hud.count.style.opacity=0,700);
        // start boost / wheelspin judgment
        if(p.startHold>0&&p.startHold<.9){applyBoost(p,1.0,1.3,.8);SFX.boost(2);setToast('ROCKET START','teal','',3);}else if(p.startHold>=1.6){p.wheelspin=.9;setToast('WHEELSPIN','','',3);haptic(30);}}}
    if(c<=0){game.state='race';game.racers.forEach(r=>{if(!r.isPlayer)r.ai.throttleHold=0;});}
    else{if(input.throttle||(game.touch&&input.drift))p.startHold+=dt;else p.startHold=0;game.racers.forEach(r=>{if(!r.isPlayer)stepAI(r,dt);r.throttle=false;stepRacer(r,dt);});return;}
  }
  game.raceTime+=dt;
  p.throttle=(input.throttle||game.touch||game.autoThrottle)&&!input.brake;p.brake=input.brake;
  if(p.finished){p.throttle=true;p.brake=false;stepAI(p,dt);}
  if(input.specialEdge){input.specialEdge=false;if(typeof useSpecial==='function')useSpecial(p);}
  if(typeof stepAbilities==='function')stepAbilities(dt);
  if(input.addonEdge){input.addonEdge=false;if(typeof useAddon==='function')useAddon(p);}
  if(game.state==='race'){if(typeof stepAddons==='function')stepAddons(dt);if(typeof stepAddonEffects==='function')stepAddonEffects(dt);}
  if(input.itemEdge){input.itemEdge=false;useItem(p);}
  game.racers.forEach(r=>{if(!r.isPlayer){stepAI(r,dt);}});
  game.racers.forEach(r=>{const save=r.maxSpeedBase;if(!r.isPlayer)r.maxSpeedBase*=r.rubber||1;stepRacer(r,dt);r.maxSpeedBase=save;});
  updateRanks(false);
  if(game.state==='race')stepPositionToasts(p,dt);
  if(p.finished&&game.state==='race')onPlayerFinish();
  stepWorld(dt);
  if(game.state==='finish'){game.finishTimer-=dt;if(game.finishTimer<=0)showResults();}
}
// idle orbit while roster is open
let rosterAngle=0;
function rosterOrbit(dt){if(matchMedia('(prefers-reduced-motion: reduce)').matches)dt=0;if(typeof updateMapScenery==='function')updateMapScenery(dt);if(typeof frameRosterCircuit==='function')frameRosterCircuit(dt);game.time+=dt;if(game.skyMat)game.skyMat.uniforms.time.value=game.time;
  itemBoxes.forEach(b=>{b.star.rotation.y+=dt*1.6;orientOnTrack(b.mesh,b.u,b.lat,1.6,0);b.mesh.rotateY(b.star.rotation.y);});world.traverse(o=>{if(o.userData.spin)o.rotation.y+=o.userData.spin*dt;});}

// ---------- Input ----------
const KEYS={KeyW:'throttle',ArrowUp:'throttle',KeyS:'brake',ArrowDown:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'drift',ShiftRight:'drift',Space:'drift',KeyE:'item',ControlLeft:'item',ControlRight:'item',KeyQ:'special',KeyF:'addon'};
const heldKeys=new Set(),touchHeld=new Set(),padHeld=new Set();let padSteer=0,padPause=false,touchSteer=0;
const activeTouchPointers=new Map();
game.analogSteering=saved.analogSteering!==false;game.steeringAssist=saved.steeringAssist!==false;
function syncInput(){for(const key of ['throttle','brake','left','right','drift','item','special','addon']){const on=touchHeld.has(key)||padHeld.has(key)||[...heldKeys].some(code=>KEYS[code]===key);if(key==='item'&&on&&!input.item)input.itemEdge=true;if(key==='special'&&on&&!input.special)input.specialEdge=true;if(key==='addon'&&on&&!input.addon)input.addonEdge=true;input[key]=on;}}
function bindControlsProbe(){
  const probe={
    getYaw(){return game.player?-game.player.theta:0;},
    getSpeed(){return game.player?game.player.speed:0;},
    setKeys(codes){heldKeys.clear();for(const code of codes||[])heldKeys.add(code);syncInput();if(game.player&&game.player.isPlayer){game.player.throttle=!!input.throttle;game.player.brake=!!input.brake;}},
    setSteer(v){touchSteer=clamp(-v,-1,1);syncInput();}
  };
  if(typeof window!=='undefined')window.__controlsTest=probe;
  if(typeof globalThis!=='undefined')globalThis.__controlsTest=probe;
}
bindControlsProbe();
function resetInput(){heldKeys.clear();touchHeld.clear();padHeld.clear();padSteer=0;touchSteer=0;steerPointer=null;activeTouchPointers.clear();const pad=document.getElementById('tSteer');if(pad){pad.style.setProperty('--steer','0px');pad.setAttribute?.('aria-valuenow','0');}for(const k of Object.keys(input))input[k]=false;document.querySelectorAll('#touch .act').forEach(el=>el.classList.remove('act'));}
// Key events that originate inside a text field never drive the kart or the menus.
function typingTarget(e){const t=e&&e.target;if(!t||!t.tagName)return false;const tag=String(t.tagName).toUpperCase();return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||t.isContentEditable===true;}
addEventListener('keydown',e=>{if(typingTarget(e))return;const k=KEYS[e.code];if(k&&['race','countdown','finish'].includes(game.state)){heldKeys.add(e.code);syncInput();if(e.preventDefault)e.preventDefault();audioInit();}
  if(e.repeat)return;
  if(e.code==='Escape'){if(game.state==='race'||game.state==='countdown')pause();else if(game.state==='paused')resume();}
  else if(e.code==='KeyR'){if(restartRace()&&e.preventDefault)e.preventDefault();}
  else if(e.code==='KeyM'){if(['race','countdown','finish','paused','results'].includes(game.state)){toggleMute();if(e.preventDefault)e.preventDefault();}}});
addEventListener('keyup',e=>{if(KEYS[e.code]){heldKeys.delete(e.code);syncInput();}});
addEventListener('blur',()=>{resetInput();pause();if(typeof raceTelemetry!=='undefined')raceTelemetry.interrupt('blur');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();pause();audioUpdate(0,game.player);}if(typeof raceTelemetry!=='undefined')raceTelemetry.interrupt(document.hidden?'hidden':'visible');});
// Rescale the usable axis range to avoid a sudden steering jump at the deadzone.
function analogAxis(value,deadzone=.12){const magnitude=Math.abs(value);if(!Number.isFinite(value)||magnitude<=deadzone)return 0;const t=clamp((magnitude-deadzone)/(1-deadzone),0,1);return Math.sign(value)*t*(.65+.35*t);}
function steeringGain(speed,maxSpeed){return lerp(1.24,.78,clamp(Math.abs(speed)/Math.max(1,maxSpeed),0,1));}
function pollGamepad(){const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p&&p.connected!==false);if(!pad){padHeld.clear();padSteer=0;padPause=false;syncInput();return;}
  const down=i=>!!pad.buttons[i]?.pressed;padSteer=analogAxis(pad.axes[0]||0);
  padHeld.clear();if(down(7)||down(0))padHeld.add('throttle');if(down(6)||down(1))padHeld.add('brake');if(down(4)||down(5))padHeld.add('drift');if(down(2))padHeld.add('item');if(down(3))padHeld.add('special');if(down(10))padHeld.add('addon');if(down(14))padHeld.add('left');if(down(15))padHeld.add('right');
  if(down(9)&&!padPause){if(game.state==='paused')resume();else pause();}padPause=down(9);syncInput();}
const touchEl=document.getElementById('touch');
function bindTouch(id,key){const el=document.getElementById(id);if(!el)return;
  el.addEventListener('pointerdown',e=>{
    if(!['race','countdown'].includes(game.state))return;e.preventDefault();audioInit();
    activeTouchPointers.set(e.pointerId,{key,el});el.setPointerCapture?.(e.pointerId);touchHeld.add(key);syncInput();el.classList.add('act');
  });
  const off=e=>{activeTouchPointers.delete(e.pointerId);if(![...activeTouchPointers.values()].some(p=>p.key===key)){touchHeld.delete(key);syncInput();}if(![...activeTouchPointers.values()].some(p=>p.el===el))el.classList.remove('act');};
  el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('lostpointercapture',off);
}
const steerPad=document.getElementById('tSteer');let steerPointer=null;
if(steerPad){
  const move=e=>{const b=steerPad.getBoundingClientRect();touchSteer=analogAxis((e.clientX-b.left-b.width/2)/(b.width*.36),.06);steerPad.style.setProperty('--steer',(touchSteer*b.width*.31)+'px');steerPad.setAttribute?.('aria-valuenow',String(Math.round(touchSteer*100)));};
  steerPad.addEventListener('pointerdown',e=>{if(!['race','countdown'].includes(game.state)||steerPointer!==null)return;e.preventDefault();audioInit();steerPointer=e.pointerId;steerPad.setPointerCapture?.(e.pointerId);move(e);steerPad.classList.add('act');});
  steerPad.addEventListener('pointermove',e=>{if(e.pointerId===steerPointer)move(e);});
  const release=e=>{if(e.pointerId!==steerPointer)return;steerPointer=null;touchSteer=0;steerPad.style.setProperty('--steer','0px');steerPad.setAttribute?.('aria-valuenow','0');steerPad.classList.remove('act');};
  for(const type of['pointerup','pointercancel','lostpointercapture'])steerPad.addEventListener(type,release);
}
for(const [id,key] of[['analogmode','analogSteering'],['steerassist','steeringAssist']]){
  const toggle=document.getElementById(id);if(toggle){toggle.checked=game[key];toggle.addEventListener('change',()=>{game[key]=toggle.checked;saved[key]=game[key];persist();resetInput();if(['race','countdown'].includes(game.state))showTouch();});}
}
bindTouch('tL','left');bindTouch('tR','right');bindTouch('tD','drift');bindTouch('tI','item');bindTouch('tB','brake');bindTouch('tS','special');bindTouch('tP','special');bindTouch('tA','addon');bindTouch('addonHUD','addon');
game.touch=typeof saved.touchMode==='boolean'?saved.touchMode:matchMedia('(pointer:coarse)').matches;
function showTouch(){touchEl.classList.toggle?.('analog',game.analogSteering);if(game.touch){touchEl.classList.add('on');if(document.documentElement&&document.documentElement.dataset)document.documentElement.dataset.touch='on';}}
function hideTouch(){touchEl.classList.remove('on');if(document.documentElement&&document.documentElement.dataset)delete document.documentElement.dataset.touch;}
// UI buttons
const touchModeToggle=document.getElementById('touchmode');
if(touchModeToggle){touchModeToggle.checked=game.touch;touchModeToggle.addEventListener('change',()=>{resetInput();game.touch=touchModeToggle.checked;saved.touchMode=game.touch;persist();if(['race','countdown'].includes(game.state)){if(game.touch)showTouch();else hideTouch();}});}
const autoThrottleToggle=document.getElementById('autothrottle');
if(autoThrottleToggle){autoThrottleToggle.checked=game.autoThrottle;autoThrottleToggle.addEventListener('change',()=>{game.autoThrottle=autoThrottleToggle.checked;saved.autoThrottle=game.autoThrottle;persist();});}
const fullscreenButton=document.getElementById('fullscreen');
if(fullscreenButton){fullscreenButton.hidden=!document.documentElement?.requestFullscreen;fullscreenButton.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setToast('FULLSCREEN UNAVAILABLE');}};document.addEventListener('fullscreenchange',()=>{fullscreenButton.textContent=document.fullscreenElement?'EXIT FULLSCREEN':'FULLSCREEN';});}
function updateBestTime(){const el=document.getElementById('besttime');if(el&&selected)el.textContent=Number.isFinite(saved[raceRecordKey(selected.id,game.diff)])?'BEST '+fmtTime(saved[raceRecordKey(selected.id,game.diff)]):'SET YOUR FIRST RECORD';}
function pause(){if(game.state!=='race'&&game.state!=='countdown')return;game.prevState=game.state;game.state='paused';staticFrameDirty=true;resetInput();acc=0;document.getElementById('pause').classList.remove('hidden');hideTouch();}
function resume(){if(game.state!=='paused')return;resetInput();audioInit();game.state=game.prevState;document.getElementById('pause').classList.add('hidden');last=performance.now();acc=0;if(typeof resetRenderBudget==='function')resetRenderBudget();if(typeof raceTelemetry!=='undefined')raceTelemetry.interrupt('resume');showTouch();}
document.getElementById('pausebtn').onclick=()=>{if(game.state==='paused')resume();else pause();};
document.getElementById('resume').onclick=resume;
document.getElementById('mutebtn').onclick=toggleMute;
{const pm=document.getElementById('pausemute');if(pm)pm.onclick=toggleMute;const rs=document.getElementById('restart');if(rs)rs.onclick=restartRace;const nm=document.getElementById('nextmap');if(nm)nm.onclick=nextCircuit;}
if(saved.muted===true&&typeof AUDIO!=='undefined'){AUDIO.on=false;for(const id of ['mutebtn','pausemute']){const el=document.getElementById(id);if(el)el.textContent='SOUND OFF';}}
document.getElementById('quit').onclick=()=>{document.getElementById('pause').classList.add('hidden');openRoster();};
document.getElementById('again').onclick=()=>{document.getElementById('results').classList.add('hidden');openRoster();};
document.getElementById('rematch').onclick=()=>{document.getElementById('results').classList.add('hidden');audioInit();startRace();};
document.querySelectorAll('#diff button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#diff button').forEach(x=>x.classList.remove('on'));b.classList.add('on');game.diff=+b.dataset.d;SFX.ui();updateBestTime();});
addEventListener('resize',()=>{resetInput();staticFrameDirty=true;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);if(typeof raceTelemetry!=='undefined')raceTelemetry.event('resize',{width:innerWidth,height:innerHeight});});

// ---------- Roster screen ----------
let selected=null;
const raceSetup={step:"title",racerConfirmed:false,mapConfirmed:false};
function buildRosterUI(){
  const grid=document.getElementById('grid');
  grid.innerHTML=ROSTER.map((d,i)=>`<div class="card" role="button" tabindex="0" aria-pressed="false" aria-label="Select ${d.name}" data-i="${i}" style="--acc:${d.acc}"><div class="bar"></div><div class="nm">${d.name}</div><div class="rl">${d.code} · ${d.role}</div>
    <div class="st">${STAT_NAMES.map((s,k)=>`<span>${s}</span><i><b style="--w:${d.stats[k]*20}%"></b></i>`).join('')}</div></div>`).join('');
  grid.querySelectorAll('.card').forEach(c=>{const d=ROSTER[+c.dataset.i];const cv=texMark(d.mark,d.acc,d.acc2,96);cv.className='mark';c.appendChild(cv);
    c.onclick=()=>{if(game.state!=='boot'){audioInit();SFX.ui();}grid.querySelectorAll('.card').forEach(x=>{x.classList.remove('sel');x.setAttribute('aria-pressed','false');});c.classList.add('sel');c.setAttribute('aria-pressed','true');selected=d;document.getElementById('pick').innerHTML=`Selected: <b>${d.name}</b> · Racer`;document.getElementById('confirm-racer').disabled=false;saved.selected=d.id;persist();updateBestTime();updateSelectedPreview(d);};c.onkeydown=e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();c.click();}};});
  const initial=ROSTER.findIndex(d=>d.id===saved.selected);grid.querySelectorAll('.card')[Math.max(0,initial)]?.click();
  document.getElementById('go').onclick=()=>{if(!selected||!raceSetup.racerConfirmed||!raceSetup.mapConfirmed||raceSetup.step!=='map')return;audioInit();SFX.go();startRace();};
}
function openRoster(){if(typeof sceneCut!=='undefined'&&!sceneCut.committing&&!['boot','roster'].includes(game.state))return transitionScene('CHARACTER SELECT',openRoster);if(typeof clearFinishCeremony==='function')clearFinishCeremony();clearProjectiles();if(typeof raceFX!=='undefined')raceFX.reset?.();if(typeof clearAbilities==='function')clearAbilities();if(typeof clearAddons==='function')clearAddons();resetInput();updateBestTime();game.state='roster';if(typeof window.resetRaceSetup==='function')window.resetRaceSetup();if(typeof selectMap==='function'&&selectMap(chosenMapId))miniBounds=null;document.getElementById('roster').classList.remove('hidden');document.getElementById('hud').classList.add('hidden');hideTouch();game.racers.forEach(r=>{scene.remove(r.mesh);if(typeof disposeKart==='function')disposeKart(r.mesh);});game.racers=[];game.player=null;if(selected)updateSelectedPreview(selected);}
function startRace(){if(!selected)return false;if(['boot','roster','title'].includes(game.state)&&(!raceSetup.racerConfirmed||!raceSetup.mapConfirmed||raceSetup.step!=='map'))return false;if(typeof sceneCut!=='undefined'&&!sceneCut.committing)return transitionScene('ENTERING THE GRID',startRace);if(typeof clearFinishCeremony==='function')clearFinishCeremony();if(typeof clearTitleAttract==='function')clearTitleAttract();document.getElementById('roster').classList.add('hidden');document.getElementById('hud').classList.remove('hidden');spawnRace(selected);last=performance.now();}

// ---------- Boot ----------
async function boot(){
 try{
  await loadKartAssets((done,total)=>{document.getElementById('loading-status').textContent='ASSEMBLING RACERS · '+done+' / '+total;const progress=document.getElementById('loading-progress');progress.max=total;progress.value=done;});
  buildTextures();game.skyMat=buildSky();buildTrackFrames();buildTrackMeshes();buildEnvironment();kartGeos();buildPickups();buildParticles();applyMapAtmosphere();if(typeof raceFX!=='undefined'&&!FALLBACK_GRAPHICS)raceFX.init();
  renderer.setSize(innerWidth,innerHeight);buildRosterUI();
  document.getElementById('loading').classList.add('hidden');openRoster();
  if(typeof raceTelemetry!=='undefined')raceTelemetry.ready();
  requestAnimationFrame(frame);
 }catch(error){console.error('3D asset loading failed',error);graphicsNotice('The 3D racers could not load. Reload to try again.',true);}
}
if(document.fonts&&document.fonts.load){Promise.all([document.fonts.load('700 20px "Rajdhani"'),document.fonts.load('500 12px "Rajdhani"')]).catch(()=>{}).then(()=>setTimeout(boot,30));}else setTimeout(boot,300);

// Isolated selection showroom: the same kart geometry used in the race, presented
// on a holographic turntable that completes full 360° turns and can be spun by hand.
let previewScene=null,previewCamera=null,previewKart=null,previewStage=null,previewAngle=-.55;
const previewSpin={velocity:0,dragging:false,lastX:0,pointer:null};
function disposePreview(){if(previewKart){previewScene.remove(previewKart);if(typeof disposeKart==='function')disposeKart(previewKart);previewKart=null;}}
function buildPreviewStage(){
 previewScene=new THREE.Scene();previewScene.environment=scene.environment;previewCamera=new THREE.PerspectiveCamera(30,1,.1,80);
 previewScene.add(new THREE.HemisphereLight(0xdff6ff,0x55688c,.72));
 const key=new THREE.DirectionalLight(0xfff3ea,1.05);key.position.set(-4,7,-6);previewScene.add(key);
 const fill=new THREE.DirectionalLight(0xbfe9ff,.35);fill.position.set(6,3,4);previewScene.add(fill);
 const rim=new THREE.DirectionalLight(0x9effff,.9);rim.position.set(2,4,8);previewScene.add(rim);
 previewStage=new THREE.Group();previewScene.add(previewStage);
 // Soft contact shadow keeps the chassis grounded on the pedestal.
 const c=mkCanvas(128,128),g=c.getContext('2d'),gr=g.createRadialGradient(64,64,4,64,64,64);gr.addColorStop(0,'rgba(8,18,40,.6)');gr.addColorStop(.55,'rgba(8,18,40,.2)');gr.addColorStop(1,'rgba(8,18,40,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(6.6,6.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.004;previewStage.add(shadow);
 // Opaque paddock turntable: machined edge, rubber deck, no floating hologram rings.
 const disc=new THREE.Mesh(new THREE.CylinderGeometry(2.7,2.8,.18,64),new THREE.MeshStandardMaterial({color:0x24272b,roughness:.82,metalness:.2}));disc.position.y=-.1;previewStage.add(disc);
 const ring=new THREE.Mesh(new THREE.CylinderGeometry(2.81,2.81,.035,64,1,true),new THREE.MeshStandardMaterial({color:0xe85e43,roughness:.46,metalness:.55}));ring.position.y=-.12;previewStage.add(ring);
 const halo=new THREE.Group(),ticks=new THREE.Group();previewStage.add(halo,ticks);
 for(let i=0;i<8;i++){const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.014,6),new THREE.MeshStandardMaterial({color:0x92979c,roughness:.4,metalness:.8}));const a=i/8*Math.PI*2;bolt.position.set(Math.cos(a)*2.55,.001,Math.sin(a)*2.55);ticks.add(bolt);}
 previewStage.userData={ring,halo,disc,ticks,rim};
}
function updateSelectedPreview(d){
 const power=typeof ABILITIES!=='undefined'?ABILITIES[d.id]:null;
 for(const [id,value] of Object.entries({'selected-power':power?.name||'','selected-description':power?.description||''})){const el=document.getElementById(id);if(el)el.textContent=value;}

 if(typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent('racerselect',{detail:{division:d,ability:power}}));
 if(typeof THREE.Scene!=='function'||renderer.renderRosterPreview)return;
 disposePreview();if(!previewScene)buildPreviewStage();
 previewKart=buildKart(d);previewScene.add(previewKart);
 const accent=new THREE.Color(d.id==='vector'?'#309DFF':d.acc);
 previewStage.userData.rim.color.set(0xfff4e7);
 previewStage.userData.ring.material.color.copy(accent);
 previewStage.userData.disc.material.color.set(0x24272b);
 previewSpin.velocity=0;
}
function spinPreview(delta){previewAngle+=delta;previewSpin.velocity=clamp(previewSpin.velocity+delta*6,-9,9);}
(()=>{const el=document.getElementById('kart-preview');if(!el||!el.addEventListener)return;
 el.addEventListener('pointerdown',e=>{if((e.button!==0&&e.pointerType==='mouse')||e.target?.closest?.('button'))return;previewSpin.dragging=true;previewSpin.pointer=e.pointerId;previewSpin.lastX=e.clientX;previewSpin.velocity=0;el.setPointerCapture?.(e.pointerId);el.classList.add('dragging');});
 el.addEventListener('pointermove',e=>{if(!previewSpin.dragging||e.pointerId!==previewSpin.pointer)return;const dx=e.clientX-previewSpin.lastX;previewSpin.lastX=e.clientX;spinPreview(dx*.011);});
 const release=e=>{if(e.pointerId!==previewSpin.pointer)return;previewSpin.dragging=false;previewSpin.pointer=null;el.classList.remove('dragging');};
 el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
})();
function renderSelectedPreview(dt){if(document.body?.classList.contains('title-open'))return;const el=document.getElementById('kart-preview');if(!el||!selected||!el.getBoundingClientRect)return;const rect=el.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
 // Full turntable rotation (about eleven seconds per 360°), plus hand-spun momentum.
 if(!previewSpin.dragging&&!matchMedia('(prefers-reduced-motion: reduce)').matches){previewAngle+=dt*(.58+previewSpin.velocity);previewSpin.velocity*=Math.exp(-dt*2.4);}
 if(typeof renderer.renderRosterPreview==='function'){renderer.renderRosterPreview(selected,rect,previewAngle);return;}
 if(!previewKart||!renderer.setScissor)return;
 previewScene.environment=scene.environment;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 animateShowroomKart(previewKart,reduced?0:game.time,reduced?0:dt,previewAngle);
 const stage=previewStage.userData;stage.ticks.rotation.y=previewAngle;
 previewCamera.aspect=rect.width/rect.height;const narrow=rect.width<rect.height*1.15;
 previewCamera.position.set(5.5,2.9,-7.3).multiplyScalar(narrow?1.45:1.08);previewCamera.lookAt(0,.55,0);previewCamera.updateProjectionMatrix();
 const y=innerHeight-rect.bottom;renderer.setViewport(rect.left,y,rect.width,rect.height);renderer.setScissor(rect.left,y,rect.width,rect.height);renderer.setScissorTest(true);const oldAuto=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(previewScene,previewCamera);renderer.autoClear=oldAuto;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
}
// Portraits share the main renderer and its reflection environment: no extra GPU context.
const directorPortraits=new Map();
window.renderDirectorPortrait=function(d){
 if(directorPortraits.has(d.id))return directorPortraits.get(d.id);
 if(typeof renderer.renderDirectorPortrait==='function'){const out=renderer.renderDirectorPortrait(d);directorPortraits.set(d.id,out);return out;}
 const target=new THREE.WebGLRenderTarget(160,180,{encoding:THREE.sRGBEncoding,depthBuffer:true});
 const previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),auto=renderer.autoClear;
 let kart;
 try{
  const stage=new THREE.Scene(),cam=new THREE.PerspectiveCamera(32,160/180,.1,30);kart=buildKart(d);
  stage.environment=scene.environment;stage.add(kart);stage.add(new THREE.HemisphereLight(0xffffff,0x798cb0,.6));const key=new THREE.DirectionalLight(0xffffff,1.2);key.position.set(-2,5,-4);stage.add(key);
  cam.position.set(2.5,2.4,-5.5);cam.lookAt(0,1.15,0);
  renderer.setRenderTarget(target);renderer.setViewport(0,0,160,180);renderer.setScissorTest(false);renderer.setClearColor(0xeff8fb,0);renderer.autoClear=true;renderer.render(stage,cam);
  const pixels=new Uint8Array(160*180*4);renderer.readRenderTargetPixels(target,0,0,160,180,pixels);
  const out=document.createElement('canvas');out.width=160;out.height=180;const ctx=out.getContext('2d'),image=ctx.createImageData(160,180);
  for(let y=0;y<180;y++)image.data.set(pixels.subarray((179-y)*640,(180-y)*640),y*640);
  ctx.putImageData(image,0,0);directorPortraits.set(d.id,out);return out;
 }catch(error){console.warn('Director portrait unavailable',error);return null;}
 finally{renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clear,alpha);renderer.autoClear=auto;target.dispose();if(kart)disposeKart(kart);}
};
