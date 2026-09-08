/* Inventory portraits use the same manufactured devices as the playable items.
   One small offscreen WebGL context lights all six portraits, then releases it. */
(() => {
 const icons=new Map(),SIZE=192;
 window.itemIconSVG=key=>ITEMS[key]?`<span class="item-model" data-item-model="${key}" role="img" aria-label="${ITEMS[key].name}"></span>`:'';
 function bakeIcons(){
  if(icons.size)return;
  let renderer=null;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(SIZE,SIZE,false);renderer.setPixelRatio(1);renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;}catch(_){renderer=null;}
  try{for(const key of Object.keys(ITEMS)){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
   const object=buildInventoryModel(key),stage=new THREE.Scene(),cam=new THREE.PerspectiveCamera(35,1,.1,20);stage.add(object);
   stage.add(new THREE.HemisphereLight(0xddeaff,0x4b4340,1.05));
   const keyLight=new THREE.DirectionalLight(0xfff0d8,2.8);keyLight.position.set(-3,4,-5);stage.add(keyLight);
   const rim=new THREE.DirectionalLight(0xa4cdff,2.1);rim.position.set(3,2,3);stage.add(rim);
   const fill=new THREE.DirectionalLight(0xffffff,.65);fill.position.set(1,-1,-3);stage.add(fill);
   cam.position.set(2,1.6,-3.4);cam.lookAt(0,0,0);
   try{let rendered=false;if(renderer){try{renderer.render(stage,cam);canvas.getContext('2d').drawImage(renderer.domElement,0,0);rendered=true;}catch(_){renderer.dispose();renderer.forceContextLoss();renderer=null;}}
    if(!rendered){const software=new CanvasRaceRenderer({canvas,alpha:true});software.ratio=1;software.drawScene(stage,cam,{x:0,y:0,width:SIZE,height:SIZE},false);}
    icons.set(key,canvas);
   }finally{const gs=new Set(),ms=new Set();object.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));if(o.isInstancedMesh)o.dispose?.();});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
  }}finally{if(renderer){renderer.dispose();renderer.forceContextLoss();}}
 }
 let queued=false;
 function paint(){queued=false;const slots=document.querySelectorAll('[data-item-model]:empty');if(!slots.length)return;bakeIcons();slots.forEach(slot=>{const source=icons.get(slot.dataset.itemModel);if(!source)return;const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;canvas.setAttribute('aria-hidden','true');canvas.getContext('2d').drawImage(source,0,0);slot.append(canvas);});}
 const hud=document.getElementById('hud');if(hud)new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(paint);}}).observe(hud,{childList:true,subtree:true});
})();
