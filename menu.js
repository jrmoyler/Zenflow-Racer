'use strict';
(() => {
  const grid=document.getElementById('grid');
  const animate=(target,props)=>{if(window.anime?.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)window.anime.animate(target,props);};
  function updateCardDetails(){
    const card=grid.querySelector('.sel');if(!card)return;
    const d=ROSTER[Number(card.dataset.i)];if(!d)return;
    document.getElementById('preview-name').textContent=d.name.toUpperCase();
    document.getElementById('selected-name').textContent=d.name;
    document.getElementById('selected-code').textContent=d.code+' · '+d.role;
    document.getElementById('selected-stats').innerHTML=d.stats.map((v,i)=>'<div class="selected-stat"><div class="stat-label"><span>'+STAT_NAMES[i]+'</span><span>'+v*2+'/10</span></div><i><b style="width:'+v*20+'%"></b></i></div>').join('');
    card.scrollIntoView?.({inline:'center',block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    animate('.director-panel',{opacity:[.55,1],translateX:[-8,0],duration:300,ease:'outQuad'});
    animate('.preview-caption',{opacity:[0,1],translateY:[7,0],duration:450,ease:'outQuad'});
  }
  function addPortraits(){
    grid.querySelectorAll('.card').forEach(card=>{
      let slot=card.querySelector('.portrait');if(!slot){slot=document.createElement('div');slot.className='portrait';slot.setAttribute('aria-hidden','true');card.prepend(slot);}
      if(slot.childElementCount)return;
      if(typeof window.renderDirectorPortrait==='function'){
        const result=window.renderDirectorPortrait(ROSTER[Number(card.dataset.i)],Number(card.dataset.i));
        if(result instanceof HTMLElement)slot.appendChild(result);
      }
    });
  }
  const step=(direction)=>{const cards=[...grid.querySelectorAll('.card')];if(!cards.length)return;const current=cards.findIndex(c=>c.classList.contains('sel'));const next=cards[(current+direction+cards.length)%cards.length];next.click();next.focus({preventScroll:true});};
  document.getElementById('dir-prev')?.addEventListener('click',()=>step(-1));
  document.getElementById('dir-next')?.addEventListener('click',()=>step(1));
  grid.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();step(1);}else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();step(-1);}});
  grid.addEventListener('click',()=>requestAnimationFrame(updateCardDetails));
  grid.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')requestAnimationFrame(updateCardDetails);});
  window.addEventListener('racerselect',()=>{updateCardDetails();addPortraits();});
  window.addEventListener('portraitsready',addPortraits);
  updateCardDetails();addPortraits();
  animate('#roster .head',{opacity:[0,1],translateY:[-12,0],duration:650,ease:'outQuad'});
  animate('.glass',{opacity:[0,1],translateY:[15,0],duration:700,ease:'outQuad'});
  animate('#grid',{opacity:[0,1],translateY:[20,0],duration:800,ease:'outQuad'});
})();

// The main menu overlays the live scene; controls and title are selectable DOM text.
(() => {
 const title=document.getElementById('title-screen'),roster=document.getElementById('roster');
 const ready=()=>{if(document.getElementById('go').disabled)return;title.querySelectorAll('button').forEach(b=>b.disabled=false);title.querySelector('.title-status').textContent='';};
 const observer=new MutationObserver(ready);observer.observe(document.getElementById('go'),{attributes:true,attributeFilter:['disabled']});ready();
 const dismiss=()=>{title.classList.add('hidden');document.body.classList.remove('title-open');roster.inert=false;};
 document.body.classList.add('title-open');
 roster.inert=true;
 document.getElementById('title-start').onclick=()=>{audioInit();SFX.go();transitionScene('ENTERING THE GRID',()=>{dismiss();startRace();});};
 document.getElementById('title-select').onclick=()=>{audioInit();SFX.ui();transitionScene('CHARACTER SELECT',()=>{dismiss();document.querySelector('#grid .sel')?.focus({preventScroll:true});});};
 const settings=document.getElementById('settings-panel');
 const openSettings=()=>{audioInit();transitionScene('RACE SETTINGS',()=>{title.inert=true;roster.inert=true;settings.classList.remove('hidden');document.getElementById('autothrottle').focus();});};
 document.getElementById('title-settings').onclick=openSettings;
 document.getElementById('menu-settings').onclick=openSettings;
 document.getElementById('settings-close').onclick=()=>transitionScene(document.body.classList.contains('title-open')?'ZENFLOW RACER':'CHARACTER SELECT',()=>{settings.classList.add('hidden');title.inert=false;roster.inert=document.body.classList.contains('title-open');document.getElementById(roster.inert?'title-settings':'menu-settings').focus();});
 settings.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();document.getElementById('settings-close').click();}});
 document.getElementById('title-return').onclick=()=>transitionScene('ZENFLOW RACER',()=>{title.classList.remove('hidden');document.body.classList.add('title-open');roster.inert=true;document.getElementById('title-start').focus();});
 const descriptions={cherry:'Floating pagodas, lantern avenues and a pale moon over cascading sky-islands.',stormforge:'Dive the ribbed forge portal — turbines, lightning and amber foundry glow.',canopy:'Race the living canopy: glass gardens, spore-light and a rolling turquoise sea.'};
 const syncMap=(id)=>{
   const button=document.querySelector('[data-map="'+id+'"]');if(!button)return;
   document.querySelectorAll('[data-map]').forEach(b=>{const selected=b===button;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
   document.getElementById('map-description').textContent=descriptions[id];
   document.getElementById('map-tag').textContent=button.textContent.trim().toUpperCase();
   document.getElementById('race-map-name').textContent=button.textContent.trim();
 };
 document.querySelectorAll('[data-map]').forEach(button=>button.addEventListener('click',()=>{
   if(typeof chooseMap!=='function'||button.dataset.map===chosenMapId)return;
   transitionScene(button.textContent.trim().toUpperCase(),()=>{if(chooseMap(button.dataset.map)!==false){if(selectMap(button.dataset.map))miniBounds=null;syncMap(button.dataset.map);}});
 }));
 window.addEventListener('mapselect',event=>syncMap(event.detail.id));
 syncMap(typeof chosenMapId==='string'?chosenMapId:'cherry');
 // Circuit cards trace the actual racing spline, including the authored route.
 document.querySelectorAll('[data-map]').forEach(button=>{
   const map=MAPS.find(m=>m.id===button.dataset.map),canvas=button.querySelector('canvas');if(!map||!canvas)return;
   const points=(map.control||CHERRY_CONTROL).map(p=>new THREE.Vector3(...p));
   const curve=new THREE.CatmullRomCurve3(points,true,'centripetal',.5),samples=curve.getPoints(180),ctx=canvas.getContext('2d');
   const xs=samples.map(p=>p.x),zs=samples.map(p=>p.z),minX=Math.min(...xs),minZ=Math.min(...zs);
   const scale=Math.min(156/(Math.max(...xs)-minX),76/(Math.max(...zs)-minZ));
   const cx=(180-(Math.max(...xs)-minX)*scale)/2,cy=(100-(Math.max(...zs)-minZ)*scale)/2;
   ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();samples.forEach((p,i)=>{const x=cx+(p.x-minX)*scale,y=cy+(p.z-minZ)*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();
   ctx.strokeStyle='#62788d';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle='#'+new THREE.Color(map.edge).getHexString();ctx.lineWidth=2;ctx.stroke();
   ctx.fillStyle='#fff';ctx.fillRect(cx+(samples[0].x-minX)*scale-3,cy+(samples[0].z-minZ)*scale-3,6,6);
 });
})();
