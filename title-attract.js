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
 sun.target.position.copy(p);sun.position.copy(p).addScaledVector(up,140).addScaledVector(right,-90).addScaledVector(forward,60);
 game.time+=step;updateMapScenery(step);return true;
}
