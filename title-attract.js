/* The opening film uses the actual race rig and road frames, never reference art. */
const titleAttract={karts:[],racers:[],u:.025,time:0,started:false};
function clearTitleAttract(){for(const kart of titleAttract.karts)disposeKart(kart);titleAttract.karts.length=0;titleAttract.racers.length=0;titleAttract.started=false;}
function tickTitleAttract(dt){
 const showing=document.body.classList.contains('title-open')&&game.state==='roster';
 if(!showing){if(titleAttract.karts.length)clearTitleAttract();return false;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!titleAttract.karts.length){
  const ids=[selected?.id||'zenflow','collective','nexus'].filter((id,i,all)=>all.indexOf(id)===i);
  for(const id of ids){const racer=new Racer(ROSTER.find(d=>d.id===id),false,titleAttract.racers.length);titleAttract.racers.push(racer);titleAttract.karts.push(racer.mesh);}
 }
 const step=reduced?0:dt;titleAttract.time+=step;titleAttract.u=wrap01(titleAttract.u+step*13/track.len);
 for(let i=0;i<titleAttract.racers.length;i++){
  const r=titleAttract.racers[i];r.u=wrap01(titleAttract.u-i*.004);r.distance=r.u;r.lat=i===0?1:i===1?-3:4;
  r.speed=reduced?0:13;r.throttle=!reduced;r.steer=clamp(trackCurv(r.u)*8,-.5,.5);
  animateKart(r,step,trackAG(r.u));
 }
 const p=trackPoint(titleAttract.u,0,0,new THREE.Vector3()),forward=trackTan(titleAttract.u,new THREE.Vector3()),up=trackUp(titleAttract.u,new THREE.Vector3()),right=trackRight(titleAttract.u,new THREE.Vector3());
 // Keep the pack on the right of desktop copy, above the menu in portrait.
 const portrait=innerWidth<innerHeight,orbit=Math.sin(titleAttract.time*.075);
 const eye=p.clone().addScaledVector(forward,portrait?9:8.2+orbit).addScaledVector(right,portrait?6:10).addScaledVector(up,portrait?5.8:4.1);
 const target=p.clone().addScaledVector(right,portrait?0:6).addScaledVector(up,portrait?-2.1:.6);
 const blend=titleAttract.started?1-Math.exp(-dt*3):1;camera.position.lerp(eye,blend);camera.up.lerp(up,blend).normalize();camera.lookAt(target);camera.fov=portrait?58:50;camera.updateProjectionMatrix();titleAttract.started=true;
 sun.target.position.copy(p);sun.position.copy(p).addScaledVector(SOLAR_DIRECTION,180);
 game.time+=step;updateMapScenery(step);return true;
}

// Finish ceremony uses independent instances of the shipped race rigs. Race standings
// and transforms stay untouched; leaving the ceremony releases every owned resource.
const finishCeremony={root:null,karts:[],time:0};
function clearFinishCeremony(){
 for(const kart of finishCeremony.karts)disposeKart(kart);
 finishCeremony.karts.length=0;
 const root=finishCeremony.root;if(!root)return;
 const geometry=new Set(),materials=new Set();
 root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});
 geometry.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose();m.dispose();});
 scene.remove(root);finishCeremony.root=null;
 for(const racer of game.racers)racer.mesh.visible=true;
}
function buildFinishCeremony(){
 clearFinishCeremony();finishCeremony.time=0;
 const root=new THREE.Group();root.name='Circuit podium';finishCeremony.root=root;scene.add(root);
 orientOnTrack(root,.035,0,5,0);
 const top=game.racers.slice().sort(raceOrder).slice(0,3);
 for(const racer of game.racers)racer.mesh.visible=false;
 const heights=[1.25,.65,.35],places=[0,-4.2,4.2];
 top.forEach((r,i)=>{
  const stand=new THREE.Group();stand.position.x=places[i];root.add(stand);
  const height=heights[i],accent=new THREE.Color(r.div.acc);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(2.18,2.38,height,48),new THREE.MeshStandardMaterial({color:0x202633,metalness:.4,roughness:.62}));
  base.position.y=height/2;base.receiveShadow=true;base.castShadow=true;stand.add(base);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(2.13,.035,6,64),new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.12,metalness:.3,roughness:.4}));
  trim.rotation.x=Math.PI/2;trim.position.y=height+.02;stand.add(trim);
  const plaque=document.createElement('canvas');plaque.width=128;plaque.height=128;
  const ctx=plaque.getContext('2d');ctx.fillStyle='#202633';ctx.fillRect(0,0,128,128);ctx.fillStyle='#f3f0e7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 100px Rajdhani, sans-serif';ctx.fillText(String(i+1),64,70);
  const texture=new THREE.CanvasTexture(plaque);texture.encoding=THREE.sRGBEncoding;
  const number=new THREE.Mesh(new THREE.PlaneGeometry(.7,.7),new THREE.MeshBasicMaterial({map:texture}));number.position.set(0,height*.5,-2.39);number.rotation.y=Math.PI;stand.add(number);
  const mount=new THREE.Group();mount.position.y=height;stand.add(mount);
  const kart=buildKart(r.div);mount.add(kart);finishCeremony.karts.push(kart);
 });
 root.updateMatrixWorld(true);
}
function tickFinishCeremony(dt){
 if(game.state!=='results'){if(finishCeremony.root)clearFinishCeremony();return false;}
 if(!finishCeremony.root)buildFinishCeremony();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,step=reduced?0:dt;
 finishCeremony.time+=step;
 for(const kart of finishCeremony.karts)animateShowroomKart(kart,finishCeremony.time,step,0);
 const root=finishCeremony.root,portrait=innerWidth<700||(innerWidth<900&&innerHeight>560),phase=Math.sin(finishCeremony.time*.12);
 const eye=root.localToWorld(new THREE.Vector3(portrait?2:1.5+phase,portrait?8:7.5,portrait?-23:-23));
 const target=root.localToWorld(new THREE.Vector3(portrait?0:-5.5,portrait?-3:1.3,0));
 camera.position.copy(eye);camera.up.set(0,1,0).transformDirection(root.matrixWorld);camera.lookAt(target);camera.fov=portrait?53:48;camera.updateProjectionMatrix();
 const center=root.getWorldPosition(new THREE.Vector3());sun.target.position.copy(center);sun.position.copy(center).addScaledVector(SOLAR_DIRECTION,180);
 updateMapScenery(step);return true;
}

// Follow a gentle section of the chosen road instead of orbiting a fixed world origin.
function frameRosterCircuit(dt){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 rosterAngle+=dt*.045;
 const u=.065+(reduced?0:Math.sin(rosterAngle)*.012);
 const p=trackPoint(u,0,0,new THREE.Vector3()),f=trackTan(u,new THREE.Vector3()),up=trackUp(u,new THREE.Vector3()),right=trackRight(u,new THREE.Vector3());
 camera.position.copy(p).addScaledVector(f,-24).addScaledVector(right,17).addScaledVector(up,10);
 camera.up.copy(up);camera.lookAt(p.clone().addScaledVector(f,30).addScaledVector(up,5));camera.fov=57;camera.updateProjectionMatrix();
 sun.target.position.copy(p);sun.position.copy(p).addScaledVector(SOLAR_DIRECTION,180);
}
