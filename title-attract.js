/* Live attract scene built from the same playable GLBs, circuit and wheel rigs. */
const titleAttract={karts:[],u:.02,time:0};
function clearTitleAttract(){for(const kart of titleAttract.karts)disposeKart(kart);titleAttract.karts.length=0;}
function tickTitleAttract(dt){
 const showing=document.body.classList.contains('title-open')&&game.state==='roster';
 if(!showing){if(titleAttract.karts.length)clearTitleAttract();return false;}
 if(!titleAttract.karts.length){for(const id of ['zenflow','collective','signal']){const kart=buildKart(ROSTER.find(d=>d.id===id));scene.add(kart);titleAttract.karts.push(kart);}}
 titleAttract.time+=dt;titleAttract.u=wrap01(titleAttract.u+dt*15/track.len);
 for(let i=0;i<titleAttract.karts.length;i++){const kart=titleAttract.karts[i];animateShowroomKart(kart,titleAttract.time,dt);orientOnTrack(kart,wrap01(titleAttract.u-i*.005),i===0?1.5:i===1?-2:4,.04,0);for(const w of kart.userData.wheels)w.spin.rotation.x=titleAttract.time*18;}
 const p=trackPoint(titleAttract.u,0,1,new THREE.Vector3()),forward=trackTan(titleAttract.u,new THREE.Vector3()),up=trackUp(titleAttract.u,new THREE.Vector3()),right=trackRight(titleAttract.u,new THREE.Vector3());
 camera.position.copy(p).addScaledVector(forward,6).addScaledVector(right,3).addScaledVector(up,8);camera.up.copy(up);camera.lookAt(p.clone().addScaledVector(right,-2));camera.fov=52;camera.updateProjectionMatrix();
 game.time+=dt;updateMapScenery(dt);return true;
}
