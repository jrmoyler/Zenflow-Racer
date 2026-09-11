'use strict';
// Each opening owns a gpu/canvas and a PMREM target. Shared race resources
// remain owned by the race; buildKart/disposeKart honor shared geometry/textures.
function createGaragePreview(host){
 let gpu=null,view=null,camera=null,kart=null,environment=null,canvas=null,frame=0,observer=null,last=0,time=0,yaw=.35,signature='',drag=null,lights=[];
 const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const note=host.querySelector('.garage-preview-note');
 function draw(){if(!gpu||!view||!camera||document.hidden)return;
  if(typeof renderer!=='undefined'){gpu.outputEncoding=renderer.outputEncoding;gpu.toneMapping=renderer.toneMapping;gpu.toneMappingExposure=renderer.toneMappingExposure;}
  if(lights.length&&typeof syncCircuitLights==='function')syncCircuitLights(view,lights);
  // Never use a PMREM texture uploaded to another WebGL context.
  view.environment=environment?.texture||null;gpu.render(view,camera);
 }
 function resize(){if(!gpu)return;const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);gpu.setSize(width,height,false);camera.aspect=width/height;camera.position.set(...KART_SHOWROOM_CAMERA).multiplyScalar(width<height*1.15?1.45:1.08);camera.lookAt(0,.55,0);camera.updateProjectionMatrix();draw();}
 function tick(now){if(!gpu)return;if(document.hidden){last=now;frame=requestAnimationFrame(tick);return;}const dt=Math.min(.04,(now-(last||now))/1000);last=now;time+=dt;
  if(kart&&!motion?.matches){if(!drag)yaw+=dt*.12;animateShowroomKart(kart,time,dt,yaw);}draw();frame=requestAnimationFrame(tick);
 }
 function dispose(){cancelAnimationFrame(frame);frame=0;observer?.disconnect();observer=null;drag=null;
  if(kart){if(typeof clearKartBuildVisuals==='function')clearKartBuildVisuals(kart);disposeKart(kart);}kart=null;environment?.dispose();environment=null;
  const old=gpu;gpu=null;view=null;camera=null;lights=[];signature='';last=0;
  if(canvas){canvas.remove();canvas=null;}old?.dispose();old?.forceContextLoss?.();
 }
 function open(){if(gpu)return true;if(typeof THREE==='undefined'||typeof buildKart!=='function'){if(note)note.textContent='3D preview is unavailable. Your garage controls remain ready.';return false;}
  try{canvas=document.createElement('canvas');canvas.className='garage-preview-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','3D kart preview. Drag or use left and right arrow keys to rotate.');host.prepend(canvas);
   const ownCanvas=canvas;
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(canvas!==ownCanvas)return;dispose();if(note)note.textContent='Preview paused. Reopen the Garage to reload 3D.';});
   gpu=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});gpu.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));gpu.outputEncoding=THREE.sRGBEncoding;gpu.toneMapping=THREE.ACESFilmicToneMapping;gpu.toneMappingExposure=typeof renderer!=='undefined'?renderer.toneMappingExposure:.82;
   view=new THREE.Scene();view.background=new THREE.Color(0x101824);camera=new THREE.PerspectiveCamera(35,1,.1,60);camera.position.set(...KART_SHOWROOM_CAMERA);camera.lookAt(0,1.25,0);
   if(typeof copyCircuitLights==='function')lights=copyCircuitLights(view);else{view.add(new THREE.HemisphereLight(0xdcefff,0x574333,1.15));const key=new THREE.DirectionalLight(0xffeedb,2);key.position.set(-3,7,-5);view.add(key);}
   view.environment=null;
   if(typeof createSurfaceEnvironmentTarget==='function'){environment=createSurfaceEnvironmentTarget(gpu,typeof activeMap!=='undefined'?activeMap:{skyHorizon:0x73899f,skyTop:0x233747});view.environment=environment?.texture||null;}
   canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX};canvas.setPointerCapture?.(e.pointerId);});
   canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;yaw+=(e.clientX-drag.x)*.012;drag.x=e.clientX;if(kart)kart.rotation.y=yaw;draw();});
   const release=e=>{if(drag?.id===e.pointerId)drag=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
   canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();yaw=e.key==='Home'?.35:yaw+(e.key==='ArrowLeft'?-.2:.2);if(kart)kart.rotation.y=yaw;draw();});
   if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(resize);observer.observe(host);}resize();frame=requestAnimationFrame(tick);if(note)note.textContent='Drag to rotate · Arrow keys to inspect';return true;
  }catch(error){dispose();if(note)note.textContent='3D preview is unavailable. Your garage controls remain ready.';return false;}
 }
 function update(racer,save){if(!gpu)return;const build=save.builds[racer.id]||[],appearance=save.appearance[racer.id]||'factory',addon=save.addons[racer.id]||null,level=save.addonUpgradeLevels[addon]||1;
  const next=JSON.stringify([racer.id,build,appearance,addon,level]);if(next===signature)return;
  if(kart){if(typeof clearKartBuildVisuals==='function')clearKartBuildVisuals(kart);disposeKart(kart);}kart=buildKart(racer);
  if(typeof applyKartBuildVisuals==='function')applyKartBuildVisuals(kart,build,appearance,addon,level);
  kart.rotation.y=yaw;view.add(kart);signature=next;draw();
 }
 return {open,update,dispose};
}
