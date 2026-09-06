/* Inventory thumbnails are rendered from the same modeled objects used by gameplay. */
(() => {
 const icons=new Map();
 window.itemIconSVG=key=>ITEMS[key]?`<span class="item-model" data-item-model="${key}" role="img" aria-label="${ITEMS[key].name}"></span>`:'';
 function renderIcon(key){
  if(icons.has(key))return icons.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const object=buildInventoryModel(key),stage=new THREE.Scene(),cam=new THREE.PerspectiveCamera(35,1,.1,20);stage.add(object);
  cam.position.set(2,2,-3.4);cam.lookAt(0,0,0);
  const software=new CanvasRaceRenderer({canvas,alpha:true});software.ratio=1;software.drawScene(stage,cam,{x:0,y:0,width:96,height:96},false);
  const gs=new Set(),ms=new Set();object.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());
  icons.set(key,canvas);return canvas;
 }
 let queued=false;
 function paint(){queued=false;document.querySelectorAll('[data-item-model]:empty').forEach(slot=>{const source=renderIcon(slot.dataset.itemModel),canvas=document.createElement('canvas');canvas.width=canvas.height=96;canvas.setAttribute('aria-hidden','true');canvas.getContext('2d').drawImage(source,0,0);slot.append(canvas);});}
 new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(paint);}}).observe(document.getElementById('hud'),{childList:true,subtree:true});
})();
