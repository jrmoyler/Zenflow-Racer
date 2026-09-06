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
