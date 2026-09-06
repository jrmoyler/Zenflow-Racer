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
const input={throttle:false,brake:false,left:false,right:false,drift:false,item:false,itemEdge:false,special:false,specialEdge:false};

class Racer{
  constructor(div,isPlayer,gridIdx){
    this.div=div;this.isPlayer=isPlayer;this.mesh=buildKart(div);scene.add(this.mesh);
    const [sp,ac,ha,we]=div.stats;
    this.maxSpeedBase=37+sp*2.2;this.accel=11+ac*2.6;this.handling=.14+ha*.012;this.weight=1+we*.28;
    this.u=-(0.007+Math.floor(gridIdx/2)*0.0068);this.lat=gridIdx%2?2.3:-2.3;this.speed=0;this.theta=0;this.steer=0;this.throttle=false;this.brake=false;
    this.drifting=false;this.driftDir=0;this.driftTime=0;this.driftTier=0;this.driftKey=false;this.boost=0;this.boostMult=1;
    this.lap=1;this.checkpoint=false;this.progress=0;this.tokens=0;this.item=null;this.roulette=0;this.rouletteTick=0;this.tripleLeft=0;
    this.spin=0;this.shield=0;this.hitCd=0;this.wallCd=0;this.finished=false;this.finishTime=0;this.rank=gridIdx+1;this.wheelRot=0;this.visualYaw=0;this.lean=0;this.wrongWay=false;
    this.ai={steer:0,drift:false,offset:(rng()-.5)*4.2,skill:.75+rng()*.25,itemDelay:0,driftHold:0,startDelay:rng()*.45,throttleHold:0};
    this.distance=this.u;this.progress=this.u;this.startHold=0;this.wheelspin=0;this.hop=0;this.lastU=this.u;this.rubber=1;
    if(typeof initAbility==='function')initAbility(this);
    orientOnTrack(this.mesh,this.u,this.lat,0,0);
  }
  get maxSpeed(){return this.maxSpeedBase*(1+this.tokens*.014)*this.boostMult;}
}

function disposeProjectile(mesh){scene.remove(mesh);if(mesh.userData?.projectileDisposed)return;if(mesh.userData)mesh.userData.projectileDisposed=true;const geometries=new Set(),materials=new Set();mesh.traverse?.(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
function clearProjectiles(){mines.forEach(m=>disposeProjectile(m.mesh));missiles.forEach(m=>disposeProjectile(m.mesh));mines=[];missiles=[];}
function spawnRace(playerDiv){
  disposePreview();if(typeof clearAbilities==='function')clearAbilities();
  game.racers.forEach(r=>{scene.remove(r.mesh);if(typeof disposeKart==='function')disposeKart(r.mesh);});game.racers=[];[sparksBlue,sparksOrange,sparksPink,boostFx,goldFx,smokeFx,hitFx].forEach(pool=>pool.clear?.());clearProjectiles();
  if(typeof selectMap==='function'&&selectMap(chosenMapId))miniBounds=null;
  itemBoxes.forEach(b=>{b.t=0;b.mesh.visible=true;orientOnTrack(b.mesh,b.u,b.lat,1.6);});
  tokens.forEach(t=>{t.t=0;t.mesh.visible=true;orientOnTrack(t.mesh,t.u,t.lat,1.3);});
  const mapLabel=document.getElementById('race-map-name');if(mapLabel&&typeof activeMap!=='undefined')mapLabel.textContent=activeMap.name;
  const others=ROSTER.filter(d=>d!==playerDiv);const order=[];const pool=others.slice();while(pool.length)order.push(pool.splice(Math.floor(rng()*pool.length),1)[0]);
  const playerGrid=7;let k=0;
  for(let i=0;i<12;i++){if(i===playerGrid){game.player=new Racer(playerDiv,true,i);game.racers.push(game.player);}else{game.racers.push(new Racer(order[k++],false,i));}}
  resetInput();lastItemKey=null;simStep.lastN=null;acc=0;
  game.raceTime=0;game.countdown=3.6;game.state='countdown';game.finishTimer=0;game.trauma=0;
  camState.init=false;updateRanks(true);hud.item.querySelector('.ic').innerHTML='';hud.item.querySelector('.lbl').textContent='NO ITEM';setToast('');updateHUD.lastRank=0;
  showTouch();
}

// ---------- Physics step ----------
const DRIFT_TIERS=[0.9,1.9,3.0];
function stepRacer(r,dt){
  const ag=trackAG(r.u);
  // --- controls -> targets
  let steerIn=r.isPlayer&&!r.finished?clamp(((input.right?1:0)-(input.left?1:0))+padSteer,-1,1):r.ai.steer;
  if(r.spin>0){steerIn=0;r.throttle=false;}
  r.steer=lerp(r.steer,steerIn,1-Math.exp(-dt*(r.drifting?7:10)));
  // --- drift state machine
  const wantDrift=r.isPlayer&&!r.finished?input.drift:r.ai.drift;
  if(!r.drifting&&wantDrift&&Math.abs(r.steer)>.3&&r.speed>r.maxSpeedBase*.45&&r.spin<=0&&!r.driftKey){r.drifting=true;r.driftDir=Math.sign(r.steer);r.driftTime=0;r.driftTier=0;r.hop=.28;if(r.isPlayer)noiseHit(.08,.2,1200);}
  r.driftKey=wantDrift;
  if(r.drifting){
    r.driftTime+=dt*(1+Math.abs(r.steer)*.55);
    const tier=DRIFT_TIERS.filter(t=>r.driftTime>t).length;
    if(tier>r.driftTier){r.driftTier=tier;if(r.isPlayer)SFX.driftTier(tier);}
    if(!wantDrift||r.speed<r.maxSpeedBase*.3||r.spin>0){
      r.drifting=false;if(r.driftTier>0&&r.spin<=0){const b=[0,.55,1.05,1.7][r.driftTier];r.boost=Math.max(r.boost,b);r.boostMult=1.32;if(r.isPlayer){SFX.boost(r.driftTier);game.trauma=Math.min(1,game.trauma+.18*r.driftTier);}}
      r.driftTier=0;r.driftTime=0;
    }
  }
  // heading relative to track tangent
  let targetTheta;
  if(r.drifting){targetTheta=r.driftDir*.085+r.steer*(r.handling+.06);}
  else targetTheta=r.steer*r.handling;
  if(r.spin>0)targetTheta=0;
  r.theta=lerp(r.theta,targetTheta,1-Math.exp(-dt*9));
  // --- longitudinal
  const max=r.maxSpeed*(r.slow>0?.68:1);
  if(r.boost>0){r.boost-=dt;if(r.boost<=0){r.boost=0;r.boostMult=1;}}
  else r.boostMult=lerp(r.boostMult,1,1-Math.exp(-dt*4));
  if(r.wheelspin>0){r.wheelspin-=dt;r.speed=lerp(r.speed,0,dt*3);}
  else if(r.spin>0){r.speed=lerp(r.speed,4,1-Math.exp(-dt*2.5));}
  else if(r.brake){r.speed=Math.max(-9,r.speed-(r.speed>0?42:8)*dt);}
  else if(r.throttle){const target=max;r.speed+= (target-r.speed)*(r.speed<target?1:3.5)*dt*(r.accel/14)*(r.speed<target?1:1)+ (r.speed<target?r.accel*dt*.25:0);if(r.speed>target)r.speed=lerp(r.speed,target,dt*3);}
  else r.speed=lerp(r.speed,0,1-Math.exp(-dt*.9));
  // corner scrub (turning bleeds speed unless drifting)
  if(!r.drifting&&r.spin<=0)r.speed*=1-Math.abs(r.theta)*1.6*dt;
  // --- lateral
  const curv=trackCurv(r.u);
  let latVel=r.speed*Math.sin(r.theta) - curv*r.speed*r.speed*.05*(r.drifting?.55:1);
  r.lat+=latVel*dt;
  const W=TRACK_W/2-0.9;
  if(Math.abs(r.lat)>W){const side=Math.sign(r.lat);r.lat=side*W;if(r.wallCd<=0&&r.speed>8){r.speed*=.78;r.wallCd=.35;r.theta=-side*.08;if(r.isPlayer){SFX.wall();game.trauma=Math.min(1,game.trauma+.25);}
      trackPoint(r.u,r.lat,.4,_p);trackTan(r.u,_v1);for(let i=0;i<10;i++){_v2.set(-_v1.x*8+(rng()-.5)*6,4+rng()*5,-_v1.z*8+(rng()-.5)*6);sparksOrange.emit(_p,_v2,.35+rng()*.3,.4);}}
    else r.speed*=1-2.5*dt;}
  r.wallCd-=dt;
  // --- advance along track
  const du=r.speed*dt/track.len;r.lastU=r.u;
  const before=r.distance;r.distance+=du;r.u=wrap01(r.distance);
  const nextLap=Math.min(game.laps+1,Math.max(1,Math.floor(r.distance)+1));
  if(nextLap>r.lap&&r.isPlayer&&nextLap<=game.laps){SFX.lap();setToast(nextLap===game.laps?'FINAL LAP':'LAP '+nextLap,'gold');}
  r.lap=nextLap;r.checkpoint=r.u>.5;r.wrongWay=r.speed<-2;r.progress=r.distance;
  if(!r.finished&&before<game.laps&&r.distance>=game.laps){
    r.finished=true;r.finishTime=game.raceTime-dt+dt*clamp((game.laps-before)/Math.max(du,1e-9),0,1);
    r.throttle=true;r.brake=false;r.ai.drift=false;
  }
  // --- timers
  if(r.spin>0)r.spin-=dt;if(r.shield>0)r.shield-=dt;if(r.hitCd>0)r.hitCd-=dt;
  // --- roulette
  if(r.roulette>0){r.roulette-=dt;if(r.roulette<=0){r.item=pickItem(r);r.roulette=0;if(r.isPlayer){SFX.box();hud.item.classList.add('pop');setTimeout(()=>hud.item.classList.remove('pop'),160);}}}
  // --- visuals
  r.wheelRot+=r.speed*dt/.48;
  const spinYaw=r.spin>0?(1-r.spin/1.1)*Math.PI*4:0;
  const driftYaw=r.drifting?r.driftDir*.55+r.steer*.15:r.steer*.12;
  r.visualYaw=lerp(r.visualYaw,driftYaw,1-Math.exp(-dt*8));
  if(r.hop>0)r.hop-=dt;const hopH=r.hop>0?Math.sin((r.hop/.28)*Math.PI)*.5:0;
  orientOnTrack(r.mesh,r.u,r.lat,0.02+hopH,r.visualYaw+spinYaw+r.theta*.6);
  r.lean=lerp(r.lean,-r.steer*.07-(r.drifting?r.driftDir*.06:0),1-Math.exp(-dt*6));r.mesh.rotateZ(r.lean);
  const ud=r.mesh.userData;
  ud.wheels.forEach((w,i)=>{w.spin.rotation.x=r.wheelRot;w.pivot.rotation.y=i<2?r.steer*.38:0;w.pivot.rotation.z=lerp(w.pivot.rotation.z,w.side*ag*Math.PI/2,1-Math.exp(-dt*5));w.glow.material.emissiveIntensity=ag*2.6;w.glow.material.opacity=ag;});
  ud.under.material.emissiveIntensity=ag*2.4;
  ud.exhaust.forEach(e=>e.material.emissiveIntensity=r.boost>0?5:r.throttle?2.2:.6);
  ud.halo.rotation.y+=dt*2.5;ud.star.rotation.y+=dt*1.5;ud.shield.visible=r.shield>0;if(r.shield>0){const s=1+Math.sin(game.time*9)*.04;ud.shield.scale.set(s,s,s);ud.shield.rotation.y+=dt;}
  ud.pilot.rotation.z=-r.lean*1.8;ud.pilot.rotation.x=r.boost>0?-.12:0;
  // particles
  if(r.drifting&&r.speed>10){const pool=[sparksBlue,sparksBlue,sparksOrange,sparksPink][r.driftTier];const side=r.driftDir;
    for(let k=0;k<2;k++){const w=ud.wheels[side>0?3:2];w.pivot.getWorldPosition(_p);trackTan(r.u,_v1);trackUp(r.u,_v2);trackRight(r.u,_v3);
      _v1.multiplyScalar(-10-rng()*8).addScaledVector(_v2,3+rng()*4).addScaledVector(_v3,side*(2+rng()*4));pool.emit(_p,_v1,.25+rng()*.3,.3);}}
  if(r.boost>0||r.speed>r.maxSpeedBase*1.02){ud.exhaust.forEach(e=>{e.getWorldPosition(_p);trackTan(r.u,_v1);_v1.multiplyScalar(-6-rng()*6);_v1.y+=rng()*1.5;boostFx.emit(_p,_v1,.28+rng()*.2,.35);});}
  if(r.throttle&&r.speed<r.maxSpeedBase*.5&&r.speed>1&&rng()<.5){ud.exhaust[0].getWorldPosition(_p);trackTan(r.u,_v1);_v1.multiplyScalar(-2);smokeFx.emit(_p,_v1,.6+rng()*.4,.5);}
  if(r.wheelspin>0){ud.wheels[2].pivot.getWorldPosition(_p);smokeFx.emit(_p,new THREE.Vector3((rng()-.5)*3,1.5,(rng()-.5)*3),.8,.6);}
}

// ---------- Collisions & pickups ----------
function du_dist(a,b){let d=b-a;if(d>.5)d-=1;if(d<-.5)d+=1;return d*track.len;}
function hitRacer(r,source,attacker=null){
  if(typeof powerProtected==='function'&&powerProtected(r,attacker,source!=='reflection'))return;
  if(r.hitCd>0||r.finished)return;
  if(r.shield>0){r.shield=0;if(r.isPlayer){SFX.shieldBlock();setToast('AEGIS BLOCK','teal');}return;}
  r.spin=1.1;r.hitCd=1.6;r.drifting=false;r.driftTier=0;r.boost=0;r.boostMult=1;
  const lost=Math.min(3,r.tokens);r.tokens-=lost;r.lastLostTokens=lost;trackPoint(r.u,r.lat,1,_p);
  for(let i=0;i<14+lost*4;i++){_v1.set((rng()-.5)*14,6+rng()*8,(rng()-.5)*14);(i<lost*4?goldFx:hitFx).emit(_p,_v1,.5+rng()*.5,.6);}
  if(r.isPlayer){SFX.hit();game.trauma=Math.min(1,game.trauma+.6);hud.vig.className='hit';setTimeout(()=>hud.vig.className='',350);}
}
function stepWorld(dt){
  const R=game.racers;
  // kart vs kart
  for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const a=R[i],b=R[j];if(a.phase>0||b.phase>0)continue;const ds=du_dist(a.u,b.u),dl=b.lat-a.lat;
    if(Math.abs(ds)<2.6&&Math.abs(dl)<1.9){if(a.ram>0)hitRacer(b,'ram',a);if(b.ram>0)hitRacer(a,'ram',b);const push=(1.9-Math.abs(dl))*.5,sgn=dl>=0?1:-1;const wa=a.weight,wb=b.weight;a.lat-=sgn*push*wb/(wa+wb);b.lat+=sgn*push*wa/(wa+wb);
      if(Math.abs(ds)<1.2){const front=ds>0?b:a,back=ds>0?a:b;back.speed*=.94;front.speed=Math.min(front.speed+1.5,front.maxSpeed*1.1);}
      if(a.isPlayer||b.isPlayer){if(Math.abs(dl)<1.2&&game.trauma<.2)game.trauma+=.08;}}}
  // item boxes / tokens
  itemBoxes.forEach(b=>{if(b.t>0){b.t-=dt;if(b.t<=0)b.mesh.visible=true;return;}
    b.star.rotation.y+=dt*1.6;b.star.rotation.x=Math.sin(game.time*1.3+b.lat)*.35;b.core.rotation.x+=dt*3;const bob=Math.sin(game.time*2.2+b.lat)*.25;orientOnTrack(b.mesh,b.u,b.lat,1.6+bob,0);b.mesh.rotateY(b.star.rotation.y);
    for(const r of R){if(r.finished||r.item||r.roulette>0)continue;if(Math.abs(du_dist(r.u,b.u))<2&&Math.abs(r.lat-b.lat)<1.6){b.t=4.5;b.mesh.visible=false;r.roulette=1.4;r.rouletteTick=0;trackPoint(b.u,b.lat,1.6,_p);for(let i=0;i<18;i++){_v1.set((rng()-.5)*10,3+rng()*7,(rng()-.5)*10);goldFx.emit(_p,_v1,.5+rng()*.4,.5);}if(r.isPlayer)SFX.ui();break;}}});
  tokens.forEach(t=>{if(t.t>0){t.t-=dt;if(t.t<=0)t.mesh.visible=true;return;}orientOnTrack(t.mesh,t.u,t.lat,.9,0);t.mesh.rotateY(game.time*3+t.lat);
    for(const r of R){if(!r.finished&&Math.abs(du_dist(r.u,t.u))<1.7&&Math.abs(r.lat-t.lat)<1.3&&r.tokens<10&&r.spin<=0){t.t=9;t.mesh.visible=false;r.tokens++;r.speed=Math.min(r.speed+1.2,r.maxSpeed*1.05);trackPoint(t.u,t.lat,1,_p);for(let i=0;i<8;i++){_v1.set((rng()-.5)*6,3+rng()*4,(rng()-.5)*6);goldFx.emit(_p,_v1,.4,.3);}if(r.isPlayer)SFX.token(r.tokens);break;}}});
  // mines
  for(let i=mines.length-1;i>=0;i--){const m=mines[i];m.life-=dt;m.mesh.rotation.y+=dt*2;m.core.material.emissiveIntensity=2+Math.sin(game.time*12)*1.5;
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
  const rank=r.rank,n=game.racers.length;const back=rank/n; // 0..1, 1 = last
  const table=[['burst',1.2+back*1.2],['shield',1.4-back*.4],['mine',1.3-back*.9],['missile',.5+back*1.4],['pulse',back>.6?back*1.6:0.05],['triple',back*1.5]];
  let sum=0;table.forEach(t=>sum+=t[1]);let x=rng()*sum;for(const [k,w] of table){x-=w;if(x<=0)return k;}return 'burst';
}
function useItem(r){
  if(!r.item||r.spin>0||r.finished)return;const k=r.item;
  if(k==='triple'){if(!r.tripleLeft)r.tripleLeft=3;r.tripleLeft--;r.boost=Math.max(r.boost,1.0);r.boostMult=1.34;if(r.isPlayer)SFX.boost(2);if(r.tripleLeft>0)return;}
  else if(k==='burst'){r.boost=Math.max(r.boost,1.35);r.boostMult=1.4;if(r.isPlayer){SFX.boost(3);setToast('SIGNAL BURST','teal');}}
  else if(k==='shield'){r.shield=7;if(r.isPlayer){SFX.shieldBlock();setToast('AEGIS SHIELD','teal');}}
  else if(k==='mine'){const g=new THREE.Group();const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),new THREE.MeshStandardMaterial({color:0x000,emissive:0xa3e635,emissiveIntensity:2}));g.add(core);const shell=new THREE.Mesh(starGeo(.9,.3),new THREE.MeshStandardMaterial({color:0x2a2f18,metalness:.7,roughness:.3}));shell.rotation.x=Math.PI/2;g.add(shell);scene.add(g);
    const u=wrap01(r.u-3.5/track.len);orientOnTrack(g,u,r.lat,.5,0);mines.push({u,lat:r.lat,mesh:g,core,owner:r,life:30});if(r.isPlayer)SFX.ui();}
  else if(k==='missile'){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0,-.9),new THREE.Vector2(.28,-.8),new THREE.Vector2(.3,.3),new THREE.Vector2(0,.95)],12),new THREE.MeshStandardMaterial({color:0xcbd5e1,metalness:.85,roughness:.3}));body.rotation.x=Math.PI/2;g.add(body);const fin=new THREE.Mesh(starGeo(.7,.08),new THREE.MeshStandardMaterial({color:0x0a1628,emissive:0xcbd5e1,emissiveIntensity:1}));fin.position.z=-.7;g.add(fin);scene.add(g);
    missiles.push({u:wrap01(r.u+3/track.len),lat:r.lat,mesh:g,owner:r,speed:Math.max(r.speed,20)+42,life:7});if(r.isPlayer){SFX.fire();setToast('VECTOR MISSILE');}}
  else if(k==='pulse'){game.racers.forEach(o=>{if(o!==r&&o.rank<r.rank)hitRacer(o,'pulse',r);});if(r.isPlayer){setToast('OVERSEER PULSE','gold');}SFX.pulse();game.trauma=Math.min(1,game.trauma+.35);
    trackPoint(r.u,r.lat,1,_p);for(let k2=0;k2<60;k2++){_v1.set((rng()-.5)*40,2+rng()*12,(rng()-.5)*40);goldFx.emit(_p,_v1,.8,1);}}
  r.item=null;r.tripleLeft=0;
}

// ---------- AI ----------
function stepAI(r,dt){
  if(r.finished){r.throttle=true;r.ai.steer=lerp(r.ai.steer,-r.lat*.3,dt*2);r.ai.drift=false;return;}
  if(game.state==='countdown'){r.throttle=game.countdown<0.001;r.ai.steer=0;r.ai.drift=false;return;}
  r.ai.throttleHold+=dt;r.throttle=r.ai.throttleHold>r.ai.startDelay;
  const look=0.012+r.speed*0.0004;const cA=trackCurv(r.u+look),cB=trackCurv(r.u+look*2.2);
  const skill=r.ai.skill+game.diff*.08;
  let target=clamp(-(Math.sign(cA)*Math.min(Math.abs(cA)*150,4.6))+r.ai.offset*(1-Math.min(Math.abs(cA)*40,1)),-5.2,5.2);
  // avoid mines ahead
  for(const m of mines){const d=du_dist(r.u,m.u);if(d>0&&d<28&&Math.abs(m.lat-r.lat)<3){target+= (r.lat>m.lat?2.6:-2.6);}}
  // avoid rear-ending slower racers
  for(const o of game.racers){if(o===r)continue;const d=du_dist(r.u,o.u);if(d>0&&d<9&&Math.abs(o.lat-r.lat)<2.2&&o.speed<r.speed)target+=(r.lat>o.lat?1.8:-1.8);}
  target=clamp(target,-5.4,5.4);
  const err=target-r.lat;r.ai.steer=clamp(err/2.4*skill,-1,1);
  // drifting
  const bigCurve=Math.abs(cA)>.02||Math.abs(cB)>.024;
  if(!r.drifting){if(bigCurve&&r.speed>r.maxSpeedBase*.6&&rng()<skill*dt*4){r.ai.drift=true;r.ai.driftHold=1.2+rng()*1.6+game.diff*.4;r.ai.steer=Math.sign(cA)*Math.max(.5,Math.abs(r.ai.steer));}}
  else{r.ai.driftHold-=dt;if(r.ai.driftHold<=0||(!bigCurve&&Math.abs(trackCurv(r.u+look*.5))<.006))r.ai.drift=false;else r.ai.steer=clamp(r.ai.steer+r.driftDir*.35,-1,1);}
  if(!r.drifting&&r.ai.driftHold<=0)r.ai.drift=r.ai.drift&&false;
  r.brake=false;
  // items
  if(r.item){r.ai.itemDelay-=dt;if(r.ai.itemDelay<=0){useItem(r);r.ai.itemDelay=.8+rng()*1.5;}}
  else r.ai.itemDelay=.6+rng()*2;
  // rubber band relative to player
  const p=game.player;const diff=p.progress-r.progress;
  const band=[.55,.85,.7][game.diff],base=[.88,.965,1.04][game.diff];
  r.rubber=clamp(base+diff*band,.84,1.16);
}

// ---------- Camera ----------
const camState={init:false,pos:new THREE.Vector3(),look:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),fov:70};
function updateCamera(dt){
  const p=game.player;if(!p)return;
  trackPoint(p.u,p.lat,0.9,_p);trackTan(p.u,_v1);trackUp(p.u,_v2);trackRight(p.u,_v3);
  const fwd=_v1.clone().applyAxisAngle(_v2,p.visualYaw*.35),up=_v2.clone();
  let target,look,fovT;
  if(game.state==='countdown'){const k=clamp(1-game.countdown/3.6,0,1);const a=lerp(Math.PI*.75,0,smooth(k));const dist=lerp(9,8,k);
    target=_p.clone().addScaledVector(fwd,Math.cos(a)*-dist).addScaledVector(_v3,Math.sin(a)*dist).addScaledVector(up,lerp(1.6,3.4,k));look=_p.clone().addScaledVector(fwd,1.5).addScaledVector(up,.6);fovT=62;}
  else{const spd=clamp(p.speed/p.maxSpeedBase,0,1.4);const back=8.2+spd*1.6+(p.boost>0?1.2:0);
    target=_p.clone().addScaledVector(fwd,-back).addScaledVector(up,3.3+spd*.3).addScaledVector(_v3,p.visualYaw*-1.4);
    look=_p.clone().addScaledVector(fwd,6).addScaledVector(up,1.0);fovT=70+spd*6+(p.boost>0?12:0)+(p.drifting?p.driftTier*1.5:0);}
  if(!camState.init){camState.pos.copy(target);camState.look.copy(look);camState.up.copy(up);camState.init=true;}
  const k=1-Math.exp(-dt*(game.state==='countdown'?3:7.5));camState.pos.lerp(target,k);camState.look.lerp(look,1-Math.exp(-dt*11));camState.up.lerp(up,1-Math.exp(-dt*6)).normalize();
  // shake (trauma^2)
  game.trauma=Math.max(0,game.trauma-dt*1.5);const sh=game.trauma*game.trauma;const t=game.time*31;
  camera.position.copy(camState.pos).addScaledVector(_v3,Math.sin(t)*sh*.5).addScaledVector(up,Math.cos(t*1.3)*sh*.35);
  camera.up.copy(camState.up);camera.lookAt(camState.look);camera.rotateZ(Math.sin(t*.9)*sh*.05);
  camState.fov=lerp(camState.fov,fovT,1-Math.exp(-dt*5));camera.fov=camState.fov;camera.updateProjectionMatrix();
  // shadows follow the player
  sun.target.position.copy(_p);sun.position.copy(_p).add(new THREE.Vector3(-90,140,-60));
  hud.vig.className=p.boost>0?'boost':(hud.vig.className==='hit'?'hit':'');
}

// ---------- HUD ----------
const hud={};['pos','lap','tok','item','mini','speedo','timer','toast','count','vig','wrong','ranks'].forEach(id=>hud[id]=document.getElementById(id));
const miniCtx=hud.mini.getContext('2d');let miniBounds=null;
function setToast(text,cls=''){hud.toast.textContent=text;hud.toast.className=cls;if(!text)return;requestAnimationFrame(()=>hud.toast.classList.add('show'));clearTimeout(setToast.t);setToast.t=setTimeout(()=>hud.toast.classList.remove('show'),1400);}
function fmtTime(t){const m=Math.floor(t/60),s=t-m*60;return `${String(m).padStart(2,'0')}:${s.toFixed(2).padStart(5,'0')}`;}
function raceOrder(a,b){return a.finished&&b.finished?a.finishTime-b.finishTime:a.finished?-1:b.finished?1:b.progress-a.progress;}
function updateRanks(force){
  const sorted=game.racers.slice().sort(raceOrder);sorted.forEach((r,i)=>r.rank=i+1);
  if(!force&&game.rankTick>0)return;
  hud.ranks.innerHTML=sorted.map((r,i)=>`<div class="${r.isPlayer?'me':''}" style="--c:${r.div.acc}"><i></i>${String(i+1).padStart(2,' ')} ${r.div.name.toUpperCase()}${r.finished?' ✓':''}</div>`).join('');
}
function drawMini(){
  const c=miniCtx,W=hud.mini.width;c.clearRect(0,0,W,W);
  if(!miniBounds){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;track.pos.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);});const s=Math.max(x1-x0,z1-z0)*1.12;miniBounds={x0:(x0+x1)/2-s/2,z0:(z0+z1)/2-s/2,s};}
  const map=p=>[(p.x-miniBounds.x0)/miniBounds.s*W,(p.z-miniBounds.z0)/miniBounds.s*W];
  c.lineCap='round';c.lineJoin='round';
  // outline
  c.beginPath();for(let i=0;i<=N_SAMP;i+=6){const [x,y]=map(track.pos[i%N_SAMP]);i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.strokeStyle='rgba(5,10,24,.85)';c.lineWidth=16;c.stroke();
  // road, coloured by anti-grav
  for(let i=0;i<N_SAMP;i+=6){const a=track.pos[i],b=track.pos[(i+6)%N_SAMP];const [ax,ay]=map(a),[bx,by]=map(b);c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.strokeStyle=track.ag[i]>.5?'#00D9B5':'#8B9BAE';c.lineWidth=track.ag[i]>.5?9:8;c.stroke();}
  const [sx,sy]=map(track.pos[0]);c.fillStyle='#F5F5F5';c.fillRect(sx-4,sy-4,8,8);
  game.racers.forEach(r=>{if(r.isPlayer)return;const [x,y]=map(r.mesh.position);c.fillStyle=r.div.acc;c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillRect(-5,-5,10,10);c.restore();});
  const p=game.player;const [x,y]=map(p.mesh.position);c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle='#0A0F1E';c.fillRect(-9,-9,18,18);c.fillStyle='#D4A843';c.fillRect(-6.5,-6.5,13,13);c.restore();
}
let lastItemKey=null;
function updateHUD(dt){
  const p=game.player;if(!p)return;
  game.rankTick-=dt;updateRanks(false);if(game.rankTick<=0)game.rankTick=.3;
  hud.pos.querySelector('.n').textContent=p.rank;hud.pos.querySelector('.o').textContent=ordinal(p.rank);if(p.rank!==updateHUD.lastRank){updateHUD.lastRank=p.rank;updateHUD.bump=.35;}updateHUD.bump=Math.max(0,(updateHUD.bump||0)-dt);hud.pos.className=(p.rank===1?'p1':p.rank>=9?'pl':'')+(updateHUD.bump>0?' bump':'');
  hud.lap.textContent=p.finished?'FINISH':`LAP ${Math.min(p.lap,game.laps)}/${game.laps}`;hud.tok.textContent=p.tokens;
  hud.speedo.querySelector('b').textContent=Math.round(Math.max(0,p.speed)*3.1);
  hud.timer.textContent=fmtTime(p.finished?p.finishTime:game.raceTime);hud.wrong.style.display=p.wrongWay?'block':'none';
  // item slot
  const ic=hud.item.querySelector('.ic'),lbl=hud.item.querySelector('.lbl');
  if(p.roulette>0){p.rouletteTick-=dt;if(p.rouletteTick<=0){p.rouletteTick=.07+ (1.4-p.roulette)*.08;const keys=Object.keys(ITEMS);const k=keys[Math.floor(rng()*keys.length)];ic.innerHTML=itemIconSVG(k);lbl.textContent='';SFX.ui();}}
  else if(p.item){const key=p.item+(p.tripleLeft||'');if(key!==lastItemKey){ic.innerHTML=itemIconSVG(p.item);lbl.textContent=ITEMS[p.item].name+(p.tripleLeft?` ×${p.tripleLeft}`:'');lastItemKey=key;}}
  else if(lastItemKey!==null){ic.innerHTML='';lbl.textContent='NO ITEM';lastItemKey=null;}
  const drift=document.getElementById('driftmeter');if(drift){drift.hidden=!p.drifting;drift.style.setProperty('--charge',Math.min(100,p.driftTime/3*100)+'%');drift.dataset.tier=p.driftTier;drift.textContent=p.driftTier?['','BLUE BOOST','GOLD BOOST','ULTRA BOOST'][p.driftTier]+' · RELEASE': 'DRIFT · HOLD TO CHARGE';}
  const special=document.getElementById('specialHUD');if(special&&typeof ABILITIES!=='undefined'){const ability=ABILITIES[p.div.id];const specialLabel=document.getElementById('specialLabel');if(specialLabel)specialLabel.textContent=ability.name+' · '+(p.specialCooldown>0?Math.ceil(p.specialCooldown)+'s':'Q / Y · READY');special.dataset.ready=p.specialCooldown>0?'false':'true';special.style.setProperty('--ready',Math.max(0,1-p.specialCooldown/ability.cooldown));}
  drawMini();
}

// ---------- Race flow ----------
function onPlayerFinish(){updateRanks(true);const key=raceRecordKey(game.player.div.id,game.diff);const old=saved[key];game.newBest=!Number.isFinite(old)||game.player.finishTime<old;if(game.newBest){saved[key]=game.player.finishTime;persist();}game.state='finish';SFX.finish();setToast(game.player.rank===1?'VICTORY':'FINISH','gold');game.finishTimer=3.2;hideTouch();}
function showResults(){
  const sorted=game.racers.slice().sort(raceOrder);
  const p=game.player;document.getElementById('rtitle').innerHTML=p.rank===1?'Circuit <span>Champion</span>':p.rank<=3?'Podium <span>Finish</span>':'Race <span>Complete</span>';
  document.getElementById('rsub').textContent=`${p.div.name.toUpperCase()} · ${ordinal(p.rank).toUpperCase()==='ST'?'1ST':p.rank+ordinal(p.rank).toUpperCase()} · ${fmtTime(p.finishTime)}${game.newBest?' · PERSONAL BEST':''} · ${['SIMULATION','STANDARD','OVERSEER'][game.diff]}`;
  const board=document.getElementById('board');board.innerHTML=sorted.map((r,i)=>`<div class="${r.isPlayer?'me':''}" style="--c:${r.div.acc}"><b>${i+1}</b><span><em></em>${r.div.name}</span><i>${r.finished?fmtTime(r.finishTime):'RACING · LAP '+Math.min(r.lap,game.laps)}</i></div>`).join('');
  document.getElementById('results').classList.remove('hidden');game.state='results';
}

// ---------- Main loop ----------
let last=performance.now(),acc=0;const STEP=1/120;
function frame(now){
  requestAnimationFrame(frame);
  let dt=Math.min(.05,(now-last)/1000);last=now;
  if(game.state==='paused')pollGamepad();
  if(game.state==='paused'||game.state==='boot'||game.state==='roster'||game.state==='results'){ if(game.state!=='boot'&&game.state!=='roster')(typeof renderRaceScene==='function'?renderRaceScene():renderer.render(scene,camera));if(game.state==='roster'){rosterOrbit(dt);(typeof renderRaceScene==='function'?renderRaceScene():renderer.render(scene,camera));renderSelectedPreview(dt);}audioUpdate(dt,game.player);return;}
  if(typeof updateMapScenery==='function')updateMapScenery(dt);
  pollGamepad();game.time+=dt;acc+=dt;let steps=0;
  while(acc>=STEP&&steps<6&&['countdown','race','finish'].includes(game.state)){simStep(STEP);acc-=STEP;steps++;}
  if(steps===6)acc=0;
  [sparksBlue,sparksOrange,sparksPink,boostFx,goldFx,smokeFx,hitFx].forEach(p=>p.update(dt));
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
    if(n!==simStep.lastN){simStep.lastN=n;hud.count.textContent=n;hud.count.className=n==='GO'?'go':'';hud.count.style.opacity=n?1:0;if(n&&n!=='GO')SFX.count();if(n==='GO'){SFX.go();setTimeout(()=>hud.count.style.opacity=0,700);
        // start boost / wheelspin judgment
        if(p.startHold>0&&p.startHold<.9){p.boost=1.0;p.boostMult=1.3;SFX.boost(2);setToast('ROCKET START','teal');}else if(p.startHold>=1.6){p.wheelspin=.9;setToast('WHEELSPIN','');}}}
    if(c<=0){game.state='race';game.racers.forEach(r=>{if(!r.isPlayer)r.ai.throttleHold=0;});}
    else{if(input.throttle)p.startHold+=dt;else p.startHold=0;game.racers.forEach(r=>{if(!r.isPlayer)stepAI(r,dt);r.throttle=false;stepRacer(r,dt);});return;}
  }
  game.raceTime+=dt;
  p.throttle=(input.throttle||game.touch||game.autoThrottle)&&!input.brake;p.brake=input.brake;
  if(p.finished){p.throttle=true;p.brake=false;stepAI(p,dt);}
  if(input.specialEdge){input.specialEdge=false;if(typeof useSpecial==='function')useSpecial(p);}
  if(typeof stepAbilities==='function')stepAbilities(dt);
  if(input.itemEdge){input.itemEdge=false;useItem(p);}
  game.racers.forEach(r=>{if(!r.isPlayer){stepAI(r,dt);}});
  game.racers.forEach(r=>{const save=r.maxSpeedBase;if(!r.isPlayer)r.maxSpeedBase*=r.rubber||1;stepRacer(r,dt);r.maxSpeedBase=save;});
  updateRanks(false);
  if(p.finished&&game.state==='race')onPlayerFinish();
  stepWorld(dt);
  if(game.state==='finish'){game.finishTimer-=dt;if(game.finishTimer<=0)showResults();}
}
// idle orbit while roster is open
let rosterAngle=0;
function rosterOrbit(dt){if(typeof updateMapScenery==='function')updateMapScenery(dt);rosterAngle+=dt*.08;const c=new THREE.Vector3(-40,20,-140);camera.position.set(c.x+Math.cos(rosterAngle)*230,70+Math.sin(rosterAngle*.7)*20,c.z+Math.sin(rosterAngle)*230);camera.up.set(0,1,0);camera.lookAt(c.x,30,c.z);camera.fov=60;camera.updateProjectionMatrix();game.time+=dt;if(game.skyMat)game.skyMat.uniforms.time.value=game.time;
  itemBoxes.forEach(b=>{b.star.rotation.y+=dt*1.6;orientOnTrack(b.mesh,b.u,b.lat,1.6,0);b.mesh.rotateY(b.star.rotation.y);});world.traverse(o=>{if(o.userData.spin)o.rotation.y+=o.userData.spin*dt;});}

// ---------- Input ----------
const KEYS={KeyW:'throttle',ArrowUp:'throttle',KeyS:'brake',ArrowDown:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'drift',ShiftRight:'drift',Space:'drift',KeyE:'item',ControlLeft:'item',ControlRight:'item',KeyQ:'special'};
const heldKeys=new Set(),touchHeld=new Set(),padHeld=new Set();let padSteer=0,padPause=false;
function syncInput(){for(const key of ['throttle','brake','left','right','drift','item','special']){const on=touchHeld.has(key)||padHeld.has(key)||[...heldKeys].some(code=>KEYS[code]===key);if(key==='item'&&on&&!input.item)input.itemEdge=true;if(key==='special'&&on&&!input.special)input.specialEdge=true;input[key]=on;}}
function resetInput(){heldKeys.clear();touchHeld.clear();padHeld.clear();padSteer=0;for(const k of Object.keys(input))input[k]=false;document.querySelectorAll('#touch .act').forEach(el=>el.classList.remove('act'));}
addEventListener('keydown',e=>{const k=KEYS[e.code];if(k&&['race','countdown','finish'].includes(game.state)){heldKeys.add(e.code);syncInput();e.preventDefault();audioInit();}
  if(e.code==='Escape'&&!e.repeat){if(game.state==='race'||game.state==='countdown')pause();else if(game.state==='paused')resume();}});
addEventListener('keyup',e=>{if(KEYS[e.code]){heldKeys.delete(e.code);syncInput();}});
addEventListener('blur',()=>{resetInput();pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();pause();}});
function pollGamepad(){const pad=navigator.getGamepads?.()[0];if(!pad){padHeld.clear();padSteer=0;padPause=false;syncInput();return;}
  const down=i=>!!pad.buttons[i]?.pressed;padSteer=Math.abs(pad.axes[0]||0)>.16?pad.axes[0]:0;
  padHeld.clear();if(down(7)||down(0))padHeld.add('throttle');if(down(6)||down(1))padHeld.add('brake');if(down(4)||down(5))padHeld.add('drift');if(down(2))padHeld.add('item');if(down(3))padHeld.add('special');if(down(14))padHeld.add('left');if(down(15))padHeld.add('right');
  if(down(9)&&!padPause){if(game.state==='paused')resume();else pause();}padPause=down(9);syncInput();}
const touchEl=document.getElementById('touch');
function bindTouch(id,key){const el=document.getElementById(id);if(!el)return;const pointers=new Set();
  el.addEventListener('pointerdown',e=>{e.preventDefault();audioInit();pointers.add(e.pointerId);el.setPointerCapture(e.pointerId);touchHeld.add(key);syncInput();el.classList.add('act');});
  const off=e=>{pointers.delete(e.pointerId);if(!pointers.size){touchHeld.delete(key);syncInput();el.classList.remove('act');}};
  el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('lostpointercapture',off);}
bindTouch('tL','left');bindTouch('tR','right');bindTouch('tD','drift');bindTouch('tI','item');bindTouch('tB','brake');bindTouch('tS','special');
game.touch=typeof saved.touchMode==='boolean'?saved.touchMode:matchMedia('(pointer:coarse)').matches;
function showTouch(){if(game.touch)touchEl.classList.add('on');}function hideTouch(){touchEl.classList.remove('on');}
// UI buttons
const touchModeToggle=document.getElementById('touchmode');
if(touchModeToggle){touchModeToggle.checked=game.touch;touchModeToggle.addEventListener('change',()=>{game.touch=touchModeToggle.checked;saved.touchMode=game.touch;persist();if(['race','countdown'].includes(game.state)){if(game.touch)showTouch();else hideTouch();}});}
const autoThrottleToggle=document.getElementById('autothrottle');
if(autoThrottleToggle){autoThrottleToggle.checked=game.autoThrottle;autoThrottleToggle.addEventListener('change',()=>{game.autoThrottle=autoThrottleToggle.checked;saved.autoThrottle=game.autoThrottle;persist();});}
const fullscreenButton=document.getElementById('fullscreen');
if(fullscreenButton){fullscreenButton.hidden=!document.documentElement?.requestFullscreen;fullscreenButton.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setToast('FULLSCREEN UNAVAILABLE');}};document.addEventListener('fullscreenchange',()=>{fullscreenButton.textContent=document.fullscreenElement?'EXIT FULLSCREEN':'FULLSCREEN';});}
function updateBestTime(){const el=document.getElementById('besttime');if(el&&selected)el.textContent=Number.isFinite(saved[raceRecordKey(selected.id,game.diff)])?'BEST '+fmtTime(saved[raceRecordKey(selected.id,game.diff)]):'SET YOUR FIRST RECORD';}
function pause(){if(game.state!=='race'&&game.state!=='countdown')return;game.prevState=game.state;game.state='paused';resetInput();acc=0;document.getElementById('pause').classList.remove('hidden');hideTouch();}
function resume(){if(game.state!=='paused')return;game.state=game.prevState;document.getElementById('pause').classList.add('hidden');last=performance.now();acc=0;showTouch();}
document.getElementById('pausebtn').onclick=()=>{if(game.state==='paused')resume();else pause();};
document.getElementById('resume').onclick=resume;
document.getElementById('mutebtn').onclick=e=>{audioInit();AUDIO.on=!AUDIO.on;e.target.textContent=AUDIO.on?'SOUND ON':'SOUND OFF';};
document.getElementById('quit').onclick=()=>{document.getElementById('pause').classList.add('hidden');openRoster();};
document.getElementById('again').onclick=()=>{document.getElementById('results').classList.add('hidden');openRoster();};
document.getElementById('rematch').onclick=()=>{document.getElementById('results').classList.add('hidden');audioInit();startRace();};
document.querySelectorAll('#diff button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#diff button').forEach(x=>x.classList.remove('on'));b.classList.add('on');game.diff=+b.dataset.d;SFX.ui();updateBestTime();});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

// ---------- Roster screen ----------
let selected=null;
function buildRosterUI(){
  const grid=document.getElementById('grid');
  grid.innerHTML=ROSTER.map((d,i)=>`<div class="card" role="button" tabindex="0" aria-pressed="false" aria-label="Select ${d.name}" data-i="${i}" style="--acc:${d.acc}"><div class="bar"></div><div class="nm">${d.name}</div><div class="rl">${d.code} · ${d.role}</div>
    <div class="st">${STAT_NAMES.map((s,k)=>`<span>${s}</span><i><b style="--w:${d.stats[k]*20}%"></b></i>`).join('')}</div></div>`).join('');
  grid.querySelectorAll('.card').forEach(c=>{const d=ROSTER[+c.dataset.i];const cv=texMark(d.mark,d.acc,d.acc2,96);cv.className='mark';c.appendChild(cv);
    c.onclick=()=>{if(game.state!=='boot'){audioInit();SFX.ui();}grid.querySelectorAll('.card').forEach(x=>{x.classList.remove('sel');x.setAttribute('aria-pressed','false');});c.classList.add('sel');c.setAttribute('aria-pressed','true');selected=d;document.getElementById('pick').innerHTML=`Selected: <b>${d.name}</b> · Division Director`;document.getElementById('go').disabled=false;saved.selected=d.id;persist();updateBestTime();updateSelectedPreview(d);};c.onkeydown=e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();c.click();}};});
  const initial=ROSTER.findIndex(d=>d.id===saved.selected);grid.querySelectorAll('.card')[Math.max(0,initial)]?.click();
  document.getElementById('go').onclick=()=>{if(!selected)return;audioInit();SFX.go();startRace();};
}
function openRoster(){clearProjectiles();if(typeof clearAbilities==='function')clearAbilities();resetInput();updateBestTime();game.state='roster';document.getElementById('roster').classList.remove('hidden');document.getElementById('hud').classList.add('hidden');hideTouch();game.racers.forEach(r=>{scene.remove(r.mesh);if(typeof disposeKart==='function')disposeKart(r.mesh);});game.racers=[];game.player=null;if(selected)updateSelectedPreview(selected);}
function startRace(){document.getElementById('roster').classList.add('hidden');document.getElementById('hud').classList.remove('hidden');spawnRace(selected);last=performance.now();}

// ---------- Boot ----------
function boot(){
  buildTextures();game.skyMat=buildSky();buildTrackFrames();buildTrackMeshes();buildEnvironment();kartGeos();buildPickups();buildParticles();
  renderer.setSize(innerWidth,innerHeight);buildRosterUI();
  document.getElementById('loading').classList.add('hidden');openRoster();
  requestAnimationFrame(frame);
}
if(document.fonts&&document.fonts.load){Promise.all([document.fonts.load('800 20px "Space Grotesk"'),document.fonts.load('400 12px "JetBrains Mono"')]).catch(()=>{}).then(()=>setTimeout(boot,30));}else setTimeout(boot,300);

// Isolated selection showroom: the same kart geometry used in the race, presented
// on a holographic turntable that completes full 360° turns and can be spun by hand.
let previewScene=null,previewCamera=null,previewKart=null,previewStage=null,previewAngle=-.55;
const previewSpin={velocity:0,dragging:false,lastX:0,pointer:null};
function disposePreview(){if(previewKart){previewScene.remove(previewKart);if(typeof disposeKart==='function')disposeKart(previewKart);previewKart=null;}}
function buildPreviewStage(){
 previewScene=new THREE.Scene();previewCamera=new THREE.PerspectiveCamera(30,1,.1,80);
 previewScene.add(new THREE.HemisphereLight(0xdff6ff,0x55688c,.72));
 const key=new THREE.DirectionalLight(0xfff3ea,1.05);key.position.set(-4,7,-6);previewScene.add(key);
 const fill=new THREE.DirectionalLight(0xbfe9ff,.35);fill.position.set(6,3,4);previewScene.add(fill);
 const rim=new THREE.DirectionalLight(0x9effff,.9);rim.position.set(2,4,8);previewScene.add(rim);
 previewStage=new THREE.Group();previewScene.add(previewStage);
 // Soft contact shadow keeps the chassis grounded on the pedestal.
 const c=mkCanvas(128,128),g=c.getContext('2d'),gr=g.createRadialGradient(64,64,4,64,64,64);gr.addColorStop(0,'rgba(8,18,40,.6)');gr.addColorStop(.55,'rgba(8,18,40,.2)');gr.addColorStop(1,'rgba(8,18,40,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(6.6,6.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.004;previewStage.add(shadow);
 const flat=(geometry,color,opacity,y)=>{const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.y=y;previewStage.add(mesh);return mesh;};
 const disc=flat(new THREE.CircleGeometry(2.6,64),0x7fe9ff,.14,.002);
 const ring=flat(new THREE.RingGeometry(2.55,2.72,96),0xa9ffff,.7,.01);
 const halo=flat(new THREE.RingGeometry(3.05,3.09,96),0xa9ffff,.28,.01);
 const ticks=new THREE.Group();ticks.rotation.x=-Math.PI/2;ticks.position.y=.012;previewStage.add(ticks);
 for(let i=0;i<24;i++){const tick=new THREE.Mesh(new THREE.PlaneGeometry(i%6?.05:.1,i%6?.14:.26),ring.material);const a=i/24*Math.PI*2;tick.position.set(Math.cos(a)*2.88,Math.sin(a)*2.88,0);tick.rotation.z=a+Math.PI/2;ticks.add(tick);}
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
 previewStage.userData.rim.color.copy(accent).lerp(new THREE.Color(0xffffff),.35);
 previewStage.userData.disc.material.color.copy(accent).lerp(new THREE.Color(0x7fe9ff),.5);
 previewSpin.velocity=0;
}
function spinPreview(delta){previewAngle+=delta;previewSpin.velocity=clamp(previewSpin.velocity+delta*6,-9,9);}
(()=>{const el=document.getElementById('kart-preview');if(!el||!el.addEventListener)return;
 el.addEventListener('pointerdown',e=>{if((e.button!==0&&e.pointerType==='mouse')||e.target?.closest?.('button'))return;previewSpin.dragging=true;previewSpin.pointer=e.pointerId;previewSpin.lastX=e.clientX;previewSpin.velocity=0;el.setPointerCapture?.(e.pointerId);el.classList.add('dragging');});
 el.addEventListener('pointermove',e=>{if(!previewSpin.dragging||e.pointerId!==previewSpin.pointer)return;const dx=e.clientX-previewSpin.lastX;previewSpin.lastX=e.clientX;spinPreview(dx*.011);});
 const release=e=>{if(e.pointerId!==previewSpin.pointer)return;previewSpin.dragging=false;previewSpin.pointer=null;el.classList.remove('dragging');};
 el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
})();
function renderSelectedPreview(dt){const el=document.getElementById('kart-preview');if(!el||!selected||!el.getBoundingClientRect)return;const rect=el.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
 // Full turntable rotation (about eleven seconds per 360°), plus hand-spun momentum.
 if(!previewSpin.dragging){previewAngle+=dt*(.58+previewSpin.velocity);previewSpin.velocity*=Math.exp(-dt*2.4);}
 if(typeof renderer.renderRosterPreview==='function'){renderer.renderRosterPreview(selected,rect,previewAngle);return;}
 if(!previewKart||!renderer.setScissor)return;
 previewKart.rotation.y=previewAngle;previewKart.position.y=.05+Math.sin(game.time*1.5)*.045;
 const stage=previewStage.userData;stage.ticks.rotation.z=-previewAngle;stage.ring.material.opacity=.58+Math.sin(game.time*2.2)*.14;stage.halo.rotation.z=game.time*.15;
 const ud=previewKart.userData;ud.wheels.forEach(w=>{w.glow.material.emissiveIntensity=1.2+Math.sin(game.time*3)*.4;});ud.exhaust.forEach(e=>e.material.emissiveIntensity=1.6);ud.under.material.emissiveIntensity=.9;
 previewCamera.aspect=rect.width/rect.height;const narrow=rect.width<rect.height*1.15;
 previewCamera.position.set(5.5,2.9,-7.3).multiplyScalar(narrow?1.45:1.08);previewCamera.lookAt(0,.55,0);previewCamera.updateProjectionMatrix();
 const y=innerHeight-rect.bottom;renderer.setViewport(rect.left,y,rect.width,rect.height);renderer.setScissor(rect.left,y,rect.width,rect.height);renderer.setScissorTest(true);const oldAuto=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(previewScene,previewCamera);renderer.autoClear=oldAuto;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
}
// Render authentic selection portraits once, reusing one small GPU context.
const directorPortraits=new Map();let portraitRenderer=null;
window.renderDirectorPortrait=function(d){
 if(directorPortraits.has(d.id))return directorPortraits.get(d.id);
 if(typeof renderer.renderDirectorPortrait==='function'){const out=renderer.renderDirectorPortrait(d);directorPortraits.set(d.id,out);return out;}
 try{
  if(!portraitRenderer){portraitRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});portraitRenderer.setSize(160,180);portraitRenderer.setClearColor(0xeff8fb,0);}
  const stage=new THREE.Scene(),cam=new THREE.PerspectiveCamera(32,160/180,.1,30),kart=buildKart(d);
  stage.add(kart);stage.add(new THREE.HemisphereLight(0xffffff,0x798cb0,1.8));const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(-2,5,-4);stage.add(key);
  cam.position.set(2.5,2.4,-5.5);cam.lookAt(0,1.15,0);portraitRenderer.render(stage,cam);
  const out=document.createElement('canvas');out.width=160;out.height=180;out.getContext('2d').drawImage(portraitRenderer.domElement,0,0);directorPortraits.set(d.id,out);disposeKart(kart);
  if(directorPortraits.size===ROSTER.length){portraitRenderer.dispose();portraitRenderer.forceContextLoss?.();portraitRenderer=null;}
  return out;
 }catch{return null;}
};
