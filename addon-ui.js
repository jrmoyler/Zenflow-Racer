'use strict';
// Equipment is saved per division; race state only reads it when a new grid spawns.
(() => {
  const dialog=document.getElementById('loadout-dialog');
  if(!dialog||typeof ADDONS==='undefined')return;
  const list=document.getElementById('addon-list'),search=document.getElementById('addon-search');
  const status=document.getElementById('loadout-status'),launch=document.getElementById('open-loadout');
  const catalog=Array.isArray(ADDONS)?ADDONS:Object.values(ADDONS);
  // Keep equipment within reach before AND after circuit selection. Moving the
  // existing native button preserves keyboard semantics and its stable ID.
  const roster=document.getElementById('roster'),showroom=roster.querySelector?.('.showroom');
  if(showroom){const dock=document.createElement('div');dock.className='loadout-dock';dock.append(launch);roster.insertBefore(dock,showroom);}
  function canEquip(){return !!selected&&game.state==='roster'&&['character','map'].includes(raceSetup.step);}
  function equipped(){return catalog.find(a=>a.id===saved.addons?.[selected?.id])||null;}
  function sync(){const a=equipped();document.getElementById('equipped-addon').textContent=a?a.name:'Choose from 24 bonus powers';launch.setAttribute('aria-label',(a?'Change '+a.name:'Equip a bonus power')+' for '+(selected?.name||'your racer'));}
  function equip(id){
    if(!canEquip())return;
    if(!saved.addons||typeof saved.addons!=='object'||Array.isArray(saved.addons))saved.addons={};
    saved.addons[selected.id]=id;persist();sync();
    const a=equipped();status.textContent=a?a.name+' equipped · Press F or tap ADD-ON in your race.':'Add-on slot cleared.';
    list.querySelectorAll('button').forEach(b=>{const active=b.dataset.addon===(a?.id||'');b.setAttribute('aria-pressed',String(active));const badge=b.querySelector?.('.addon-cooldown');if(badge)badge.textContent=active?'EQUIPPED':b.dataset.addon?addonDefinition(b.dataset.addon).cooldown+'s CD':'EMPTY';});
    SFX.ui();
  }
  function render(){
    const query=search.value.trim().toLowerCase(),current=equipped()?.id||'';list.replaceChildren();
    const rows=[{id:'',name:'No add-on',description:'Race with your division’s signature power and track pickups.',cooldown:0},...catalog];
    const visible=rows.filter(a=>!query||[a.name,a.description,a.desc,a.id,a.type].join(' ').toLowerCase().includes(query));
    for(const a of visible){
      const button=document.createElement('button');button.type='button';button.className='addon-choice';button.dataset.addon=a.id;
      button.setAttribute('aria-pressed',String(a.id===current));button.style.setProperty('--addon-color',typeof a.color==='number'?'#'+a.color.toString(16).padStart(6,'0'):(a.color||'#bdc4cd'));
      const mark=document.createElement('span');mark.className='addon-number';mark.textContent=a.id?String(catalog.indexOf(a)+1).padStart(2,'0'):'—';mark.setAttribute('aria-hidden','true');
      const copy=document.createElement('span');copy.className='addon-copy';const name=document.createElement('strong');name.textContent=a.name;
      const desc=document.createElement('span');desc.textContent=a.description||a.desc||'';copy.append(name,desc);
      const cd=document.createElement('span');cd.className='addon-cooldown';cd.textContent=a.id===current?'EQUIPPED':a.cooldown?a.cooldown+'s CD':'EMPTY';
      button.append(mark,copy,cd);button.addEventListener('click',()=>equip(a.id||null));list.append(button);
    }
    if(!visible.length){const empty=document.createElement('p');empty.className='addon-empty';empty.textContent='No matching powers. Try fire, shield or portal.';list.append(empty);}
  }
  launch.addEventListener('click',()=>{
    if(!canEquip())return;
    document.getElementById('loadout-racer').textContent=selected.name;search.value='';render();status.textContent='24 powers · one equipment slot';
    if(!dialog.open)dialog.showModal();
    // Focusing search immediately summons the phone keyboard and conceals most
    // of the catalog. Focus the equipped row; search stays one tap away.
    (Array.from(list.querySelectorAll('button')).find(b=>b.getAttribute('aria-pressed')==='true')||document.getElementById('close-loadout')).focus({preventScroll:true});
  });
  const close=()=>{dialog.close();launch.focus({preventScroll:true});};
  document.getElementById('close-loadout').addEventListener('click',close);document.getElementById('done-loadout').addEventListener('click',close);
  dialog.addEventListener('cancel',()=>requestAnimationFrame(()=>launch.focus({preventScroll:true})));
  search.addEventListener('input',render);
  for(const id of ['addonHUD','tA'])document.getElementById(id)?.addEventListener('click',event=>{
    // Pointer activation is already routed through held input in game.js.
    // Native keyboard / assistive clicks have no pointerdown event.
    if(event.detail===0&&game.player&&game.state==='race')useAddon(game.player);
  });
  document.getElementById('grid').addEventListener('click',()=>requestAnimationFrame(sync));window.addEventListener('racerselect',sync);sync();
})();
function updateAddonHUD(r){
  const a=typeof addonDefinition==='function'?addonDefinition(r.addonId):(typeof ADDONS==='undefined'?null:(Array.isArray(ADDONS)?ADDONS:Object.values(ADDONS)).find(a=>a.id===r.addonId));
  const button=document.getElementById('addonHUD'),touch=document.getElementById('tA');if(!button)return;
  button.hidden=!a;if(touch)touch.hidden=!a;if(!a)return;
  const ready=!(r.addonCooldown>0),blocked=game.state!=='race'||r.finished||r.spin>0||r.vault>0;
  button.dataset.ready=String(ready);button.disabled=!ready||blocked;
  const state=r.finished?'FINISHED':r.vault>0?'LOCKED':r.spin>0?'RECOVERING':ready?'READY':Math.ceil(r.addonCooldown)+'s';
  document.getElementById('addonLabel').textContent=a.name+' · '+state;
  button.setAttribute('aria-label',a.name+' · '+state+' · F to activate');
  button.style.setProperty('--addon-charge',String(Math.max(0,1-(r.addonCooldown||0)/a.cooldown)*100)+'%');
  if(touch)touch.setAttribute('aria-label',a.name+' · '+state);
  if(touch){touch.disabled=button.disabled;touch.textContent=ready?'ADD-ON':Math.ceil(r.addonCooldown)+'s';touch.classList.toggle('ready',ready&&!blocked);}
}
