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
  grid.addEventListener('click',()=>requestAnimationFrame(updateCardDetails));
  grid.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')requestAnimationFrame(updateCardDetails);});
  window.addEventListener('racerselect',()=>{updateCardDetails();addPortraits();});
  window.addEventListener('portraitsready',addPortraits);
  updateCardDetails();addPortraits();
  animate('#roster .head',{opacity:[0,1],translateY:[-12,0],duration:650,ease:'outQuad'});
  animate('.glass',{opacity:[0,1],translateY:[15,0],duration:700,ease:'outQuad'});
  animate('#grid',{opacity:[0,1],translateY:[20,0],duration:800,ease:'outQuad'});
})();

// Main-menu artwork is kept intact, with real keyboard/touch buttons aligned
// precisely to the labels in its fixed-aspect composition.
(() => {
 const title=document.getElementById('title-screen'),roster=document.getElementById('roster');
 const ready=()=>{if(document.getElementById('go').disabled)return;title.querySelectorAll('button').forEach(b=>b.disabled=false);title.querySelector('.title-status').textContent='';};
 const observer=new MutationObserver(ready);observer.observe(document.getElementById('go'),{attributes:true,attributeFilter:['disabled']});ready();
 const dismiss=()=>{title.classList.add('hidden');roster.inert=false;};
 roster.inert=true;
 document.getElementById('title-start').onclick=()=>{dismiss();document.getElementById('go').click();};
 document.getElementById('title-select').onclick=()=>{dismiss();document.querySelector('#grid .sel')?.focus();};
 document.getElementById('title-settings').onclick=()=>{dismiss();document.getElementById('autothrottle').focus();document.querySelector('.race-options').scrollIntoView({block:'nearest'});};
 document.getElementById('title-return').onclick=()=>{title.classList.remove('hidden');roster.inert=true;document.getElementById('title-start').focus();};
 const descriptions={cherry:'Floating gardens, cascading waterfalls, and sweeping sky bridges.',stormforge:'Race through colossal turbines and the amber-lit floating foundry.',canopy:'Climb the living canopy through glass gardens and tropical skyways.'};
 const syncMap=(id)=>{
   const button=document.querySelector('[data-map="'+id+'"]');if(!button)return;
   document.querySelectorAll('[data-map]').forEach(b=>{const selected=b===button;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
   document.getElementById('map-description').textContent=descriptions[id];
   document.getElementById('map-tag').textContent=button.textContent.trim().toUpperCase();
   document.getElementById('race-map-name').textContent=button.textContent.trim();
 };
 document.querySelectorAll('[data-map]').forEach(button=>button.addEventListener('click',()=>{
   if(typeof chooseMap!=='function'||chooseMap(button.dataset.map)===false)return;
   syncMap(button.dataset.map);
 }));
 window.addEventListener('mapselect',event=>syncMap(event.detail.id));
 syncMap(typeof chosenMapId==='string'?chosenMapId:'cherry');
 const gallery=document.getElementById('art-gallery');
 document.getElementById('open-art').onclick=()=>gallery.showModal();
 document.getElementById('close-art').onclick=()=>gallery.close();
 gallery.addEventListener('click',e=>{if(e.target===gallery)gallery.close();});
})();
