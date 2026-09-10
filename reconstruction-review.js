/* Reproducible inspection of shipping assets and live circuits.
   Opt-in only: ?review=kart|item|map&asset=zenflow&view=front
   Every view uses the real loader/materials/world. No reference imagery is loaded. */
const reconstructionReview=(()=>{
 const q=new URLSearchParams(location.search),mode=q.get('review');
 if(!['kart','item','map','podium'].includes(mode))return null;
 return {mode,asset:q.get('asset')||(mode==='map'?'cherry':mode==='item'?'burst':'zenflow'),view:q.get('view')||'front',ready:false,scene:null,object:null};
})();
function renderReconstructionReview(){
 const r=reconstructionReview;if(!r||game.state==='boot')return false;
 if(!r.ready){
  if(typeof clearTitleAttract==='function')clearTitleAttract();
  document.body.classList.remove('title-open');
  for(const id of ['roster','hud','title-screen','pause','results'])document.getElementById(id)?.classList.add('hidden');
  const info=document.createElement('output');info.id='reconstruction-evidence';info.style.cssText='position:fixed;left:16px;top:16px;z-index:9999;background:#172b3e;color:white;padding:12px 16px;font:13px monospace;white-space:pre-line;max-width:90vw';document.body.append(info);
  game.state='paused';r.ready=true;
  if(r.mode==='podium'){
   // Explicit inspection fixture: never write records or claim a completed race.
   game.racers=ROSTER.slice(0,3).map((d,i)=>{const racer=new Racer(d,i===0,i);racer.rank=i+1;racer.finished=true;racer.finishTime=90+i*2;racer.bestLap=30;racer.lap=3;return racer;});
   game.player=game.racers[0];game.newBest=false;game.pbDelta=null;showResults();r.scene=scene;
  }else if(r.mode==='map'){
   if(!MAPS.some(m=>m.id===r.asset))r.asset='cherry';selectMap(r.asset);buildPickups();
   const u=r.view==='rear'?.55:r.view==='side'?.32:.045;
   trackPoint(u,0,4,camera.position);const target=trackPoint(u+.025,0,2,new THREE.Vector3());camera.lookAt(target);if(r.view==='sun'){camera.position.set(25,25,20);camera.lookAt(camera.position.clone().addScaledVector(SOLAR_DIRECTION,100));}
   camera.fov=r.view==='sun'?48:65;camera.updateProjectionMatrix();
   r.scene=scene;
  }else{
   r.scene=new THREE.Scene();r.scene.background=new THREE.Color(0xc7daeb);r.scene.environment=scene.environment;
   copyCircuitLights(r.scene);
   const fill=new THREE.DirectionalLight(0xb2eaff,.7);fill.position.set(5,3,1);r.scene.add(fill);
   r.object=r.mode==='kart'?buildKart(ROSTER.find(d=>d.id===r.asset)||ROSTER[0]):buildInventoryModel(r.asset);r.scene.add(r.object);
   const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xc4d8e9,roughness:.28,metalness:.18}));ground.rotation.x=-Math.PI/2;ground.position.y=r.mode==='kart'?-.025:-1;ground.receiveShadow=true;r.scene.add(ground);
   const pos=r.view==='side'?[8,3,0]:r.view==='rear'?[5.6,4.5,7]:[-5.6,4.5,-7];
   camera.position.set(...pos).multiplyScalar(r.mode==='kart'?.88:.31);camera.lookAt(0,r.mode==='kart'?1.0:0,0);camera.fov=35;camera.updateProjectionMatrix();
  }
  const gl=renderer.getContext?.(),debug=gl?.getExtension('WEBGL_debug_renderer_info');
  r.renderer=FALLBACK_GRAPHICS?'Canvas software rasterizer':debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'WebGL';
  r.info=info;
 }
 renderer.setViewport?.(0,0,innerWidth,innerHeight);renderer.setScissorTest?.(false);
 if(r.mode==='podium')tickFinishCeremony(0);
 renderer.render(r.scene,camera);
 r.info.textContent=`${r.mode==='podium'?'STAGED INSPECTION · SAMPLE STANDINGS\n':''}ACTUAL ${r.mode.toUpperCase()} · ${r.asset} · ${r.view}\n${r.renderer}\n${renderer.info?.render?.triangles||0} triangles · ${renderer.info?.render?.calls||0} draws\nCamera: ${camera.position.toArray().map(n=>n.toFixed(2)).join(', ')} · FOV ${camera.fov}`;
 return true;
}
