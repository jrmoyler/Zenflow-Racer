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
    animate('#selected-stats b',{scaleX:[.65,1],duration:240,ease:'outQuad'});
    animate('.preview-caption',{translateY:[6,0],duration:240,ease:'outQuad'});
  }
  function addPortraits(){
    grid.querySelectorAll('.card').forEach(card=>{
      let slot=card.querySelector('.portrait');if(!slot){slot=document.createElement('div');slot.className='portrait';slot.setAttribute('aria-hidden','true');card.prepend(slot);}
      const mapId=typeof activeMap!=='undefined'?activeMap.id:'';
      if(slot.childElementCount&&slot.dataset.map===mapId)return;
      slot.replaceChildren();slot.dataset.map=mapId;
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
  window.addEventListener('mapselect',addPortraits);
  updateCardDetails();addPortraits();
  // Animate on actual entry, rather than spending the animation behind loading.
  const rosterScreen=document.getElementById('roster');
  let visible=false;
  const enter=()=>{
    const next=!document.body.classList.contains('title-open')&&!rosterScreen.classList.contains('hidden');
    if(next&&!visible){
      animate('#roster .head',{translateY:[-10,0],duration:250,ease:'outQuad'});
      animate('.race-panel',{translateY:[12,0],duration:300,ease:'outQuad'});
      animate('#grid',{translateY:[16,0],duration:350,ease:'outQuad'});
    }
    visible=next;
  };
  const entryObserver=new MutationObserver(enter);
  entryObserver.observe(rosterScreen,{attributes:true,attributeFilter:['class']});
  entryObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  enter();
})();

// The main menu overlays the live scene; controls and title are selectable DOM text.
(() => {
 const title=document.getElementById('title-screen'),roster=document.getElementById('roster');
 const ready=()=>{if(!document.getElementById('loading').classList.contains('hidden'))return;title.querySelectorAll('button').forEach(b=>b.disabled=false);title.querySelector('.title-status').textContent='';};
 const observer=new MutationObserver(ready);observer.observe(document.getElementById('loading'),{attributes:true,attributeFilter:['class']});ready();
 const dismiss=()=>{title.classList.add('hidden');document.body.classList.remove('title-open');roster.inert=false;};
 document.body.classList.add('title-open');
 roster.inert=true;
 const trackPanel=roster.querySelector('.track-panel'),grid=document.getElementById('grid');
 function showStep(step){
   raceSetup.step=step;roster.dataset.step=step;
   const map=step==='map';trackPanel.hidden=!map;
   for(const el of [roster.querySelector('.director-panel'),document.getElementById('kart-preview'),grid,roster.querySelector('.selector-heading')])el.hidden=map;
   document.getElementById('setup-step').textContent=map?'01 / '+selected.name.toUpperCase()+' ✓':'01 / CHARACTER';
   document.getElementById('go').disabled=!map||!raceSetup.mapConfirmed;
   if(map)document.querySelector('[data-map]')?.focus({preventScroll:true});
   else document.querySelector('#grid .sel')?.focus({preventScroll:true});
 }
 window.resetRaceSetup=()=>{
   raceSetup.racerConfirmed=false;raceSetup.mapConfirmed=false;
   document.querySelectorAll('[data-map]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});
   document.getElementById('map-prompt').textContent='Select a circuit to continue.';
   showStep('character');
 };
 document.getElementById('title-start').onclick=()=>{audioInit();SFX.ui();transitionScene('CHOOSE YOUR RACER',()=>{dismiss();window.resetRaceSetup();});};
 document.getElementById('confirm-racer').onclick=()=>{
   if(!selected||raceSetup.step!=='character')return;
   audioInit();SFX.ui();transitionScene('CHOOSE YOUR CIRCUIT',()=>{raceSetup.racerConfirmed=true;showStep('map');});
 };
 document.getElementById('back-racer').onclick=()=>transitionScene('CHOOSE YOUR RACER',window.resetRaceSetup);
 const settings=document.getElementById('settings-panel');
 const openSettings=()=>{audioInit();transitionScene('RACE SETTINGS',()=>{title.inert=true;roster.inert=true;settings.classList.remove('hidden');document.getElementById('autothrottle').focus();});};
 document.getElementById('title-settings').onclick=openSettings;
 document.getElementById('menu-settings').onclick=openSettings;
 document.getElementById('settings-close').onclick=()=>transitionScene(document.body.classList.contains('title-open')?'ZENFLOW RACER':'CHARACTER SELECT',()=>{settings.classList.add('hidden');title.inert=false;roster.inert=document.body.classList.contains('title-open');document.getElementById(roster.inert?'title-settings':'menu-settings').focus();});
 settings.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();document.getElementById('settings-close').click();}});
 document.getElementById('title-return').onclick=()=>transitionScene('ZENFLOW RACER',()=>{title.classList.remove('hidden');document.body.classList.add('title-open');raceSetup.step='title';raceSetup.racerConfirmed=false;raceSetup.mapConfirmed=false;roster.inert=true;document.getElementById('title-start').focus();});
 const descriptions={cherry:'Floating pagodas, lantern avenues and a pale moon over cascading sky-islands.',stormforge:'Dive the ribbed forge portal — turbines, lightning and amber foundry glow.',canopy:'Race the living canopy: botanical gardens, spore-light and a rolling turquoise sea.'};
 const mapName=button=>MAPS.find(map=>map.id===button.dataset.map)?.name||button.textContent.trim();
 const syncMap=(id)=>{
   const button=document.querySelector('[data-map="'+id+'"]');if(!button)return;
   document.querySelectorAll('[data-map]').forEach(b=>{const selected=raceSetup.mapConfirmed&&b===button;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
   document.getElementById('map-description').textContent=descriptions[id];
   document.getElementById('map-tag').textContent=mapName(button).toUpperCase();
   document.getElementById('race-map-name').textContent=mapName(button);
 };
 document.querySelectorAll('[data-map]').forEach(button=>button.addEventListener('click',()=>{
   if(typeof chooseMap!=='function'||raceSetup.step!=='map'||!raceSetup.racerConfirmed)return;
   transitionScene(mapName(button).toUpperCase(),()=>{if(chooseMap(button.dataset.map)!==false){if(selectMap(button.dataset.map))miniBounds=null;raceSetup.mapConfirmed=true;syncMap(button.dataset.map);document.getElementById('go').disabled=false;document.getElementById('map-prompt').textContent=selected.name+' · '+mapName(button)+' · Ready';document.getElementById('go').focus({preventScroll:true});}});
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
