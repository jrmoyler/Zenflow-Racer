'use strict';
// Equipment is saved per division; race state only reads it when a new grid spawns.
(() => {
  const dialog=document.getElementById('loadout-dialog');
  if(!dialog||typeof ADDONS==='undefined')return;
  const list=document.getElementById('addon-list'),search=document.getElementById('addon-search');
  const status=document.getElementById('loadout-status'),launch=document.getElementById('open-loadout');
  const catalog=Array.isArray(ADDONS)?ADDONS:Object.values(ADDONS);
  function equipped(){return catalog.find(a=>a.id===saved.addons?.[selected?.id])||null;}
  function sync(){const a=equipped();document.getElementById('equipped-addon').textContent=a?a.name:'None equipped';}
  function equip(id){
    if(!selected||game.state!=='roster'||raceSetup.step!=='character')return;
    if(!saved.addons||typeof saved.addons!=='object'||Array.isArray(saved.addons))saved.addons={};
    saved.addons[selected.id]=id;persist();sync();
    const a=equipped();status.textContent=a?a.name+' equipped for '+selected.name+'.':'Add-on slot cleared.';
    list.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.addon===(a?.id||''))));
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
      const cd=document.createElement('span');cd.className='addon-cooldown';cd.textContent=a.cooldown?a.cooldown+'s CD':'EMPTY';
      button.append(mark,copy,cd);button.addEventListener('click',()=>equip(a.id||null));list.append(button);
    }
    if(!visible.length){const empty=document.createElement('p');empty.className='addon-empty';empty.textContent='No matching powers. Try fire, shield or portal.';list.append(empty);}
  }
  launch.addEventListener('click',()=>{
    if(game.state!=='roster'||raceSetup.step!=='character')return;
    document.getElementById('loadout-racer').textContent=selected.name;search.value='';render();status.textContent='24 powers · one equipment slot';
    dialog.showModal();search.focus();
  });
  const close=()=>{dialog.close();launch.focus({preventScroll:true});};
  document.getElementById('close-loadout').addEventListener('click',close);document.getElementById('done-loadout').addEventListener('click',close);
  dialog.addEventListener('cancel',()=>requestAnimationFrame(()=>launch.focus({preventScroll:true})));
  search.addEventListener('input',render);
  document.getElementById('grid').addEventListener('click',()=>requestAnimationFrame(sync));window.addEventListener('racerselect',sync);sync();
})();
function updateAddonHUD(r){
  const a=typeof addonDefinition==='function'?addonDefinition(r.addonId):(typeof ADDONS==='undefined'?null:(Array.isArray(ADDONS)?ADDONS:Object.values(ADDONS)).find(a=>a.id===r.addonId));
  const button=document.getElementById('addonHUD'),touch=document.getElementById('tA');if(!button)return;
  button.hidden=!a;if(touch)touch.hidden=!a;if(!a)return;
  const ready=!(r.addonCooldown>0),blocked=game.state!=='race'||r.finished||r.spin>0||r.vault>0;
  button.dataset.ready=String(ready);button.disabled=!ready||blocked;
  document.getElementById('addonLabel').textContent=a.name+' · '+(r.vault>0?'LOCKED':ready?'READY':Math.ceil(r.addonCooldown)+'s');
  if(touch){touch.disabled=button.disabled;touch.textContent=ready?'ADD-ON':Math.ceil(r.addonCooldown)+'s';touch.classList.toggle('ready',ready&&!blocked);}
}
