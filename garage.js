'use strict';
(()=>{
 const dialog=document.createElement('dialog');dialog.id='garage';dialog.setAttribute('aria-label','Garage');
 dialog.innerHTML='<header><p>PADDOCK / PROGRESSION</p><h2>Garage</h2><strong id="garage-wallet"></strong><button id="garage-close" class="btn">Back</button></header><label>Racer <select id="garage-racer"></select></label><nav aria-label="Garage categories"></nav><p id="garage-status" role="status"></p><div id="garage-inventory"></div>';
 document.body.append(dialog);let padFrame=0,padHeld=false;
 let category='Add-Ons',racerId=selected?.id||ROSTER[0].id,opener=null,busy=false;
 const select=dialog.querySelector('select'),list=dialog.querySelector('#garage-inventory'),status=dialog.querySelector('#garage-status');
 for(const racer of ROSTER){const option=document.createElement('option');option.value=racer.id;option.textContent=racer.name;select.append(option);}
 for(const name of ['Add-Ons','Kart Upgrades','Appearance','Owned / Locked']){const b=document.createElement('button');b.className='btn ghost';b.textContent=name;b.onclick=()=>{category=name;render();};dialog.querySelector('nav').append(b);}
 select.onchange=()=>{racerId=select.value;render();};
 function close(){cancelAnimationFrame(padFrame);dialog.close();opener?.focus();}
 function pollPad(){if(!dialog.open)return;const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);if(pad){const pressed=i=>pad.buttons[i]?.pressed;const direction=pressed(13)||pressed(15)?1:pressed(12)||pressed(14)?-1:0;const active=direction||pressed(0)||pressed(1);if(active&&!padHeld){if(pressed(1)){close();return;}if(pressed(0)&&dialog.contains(document.activeElement))document.activeElement.click();if(direction&&document.activeElement===select&&(pressed(14)||pressed(15))){select.selectedIndex=(select.selectedIndex+direction+select.options.length)%select.options.length;select.onchange();}else if(direction){const controls=[...dialog.querySelectorAll('button:not(:disabled),select')];const at=controls.indexOf(document.activeElement);controls[(at+direction+controls.length)%controls.length]?.focus();}}padHeld=!!active;}padFrame=requestAnimationFrame(pollPad);}
 dialog.addEventListener('close',()=>{cancelAnimationFrame(padFrame);opener?.focus();});dialog.querySelector('#garage-close').onclick=close;
 function render(restoreFocus){
  const buildRacerId=racerId,focusKey=restoreFocus||document.activeElement?.dataset?.garageKey;
  select.value=buildRacerId;dialog.querySelector('#garage-wallet').textContent=saved.wallet+' Zen Credits';list.replaceChildren();
  dialog.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===category)));
  const ids=ADDONS.map(a=>a.id);
  function card(name,type,effect,state,level,cost,action,callback){
   const article=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),meta=document.createElement('p'),button=document.createElement('button');
   h.textContent=name;p.textContent=effect;meta.textContent=`${type} · ${state} · Level ${level} · ${cost?cost+' Zen Credits':'No cost'}`;
   button.className='btn';button.dataset.garageKey=type+':'+name;button.textContent=action;button.disabled=busy||!callback||(cost>saved.wallet);
   button.onclick=async()=>{if(busy)return;busy=true;render();try{await economyTransaction(callback);status.textContent=name+' · saved';SFX.ui();window.dispatchEvent(new Event('garagechange'));}catch(error){status.textContent=error.message;}finally{busy=false;render(type+':'+name);}};
   article.append(h,p,meta,button);list.append(article);
  }
  if(category==='Add-Ons'||category==='Owned / Locked')for(const a of ADDONS){
   const owned=saved.ownedAddons.includes(a.id),level=saved.addonUpgradeLevels[a.id]||0,equipped=saved.addons[buildRacerId]===a.id;
   card(a.name,a.type,a.description+` · ${a.cooldown*(1-Math.max(0,level-1)*.02)}s cooldown.`,owned?(equipped?'Equipped':'Owned'):'Locked',level,owned?0:Economy.addonPrice(a.id,ids),owned?(equipped?'EQUIPPED':'EQUIP'):'BUY',equipped?null:s=>owned?{...s,addons:{...s.addons,[buildRacerId]:s.ownedAddons.includes(a.id)?a.id:null}}:Economy.purchase(s,'addon',a.id,ids));
   if(owned)card(a.name+' tuning','Add-on upgrade',level===1?'Next: cooldown −2% from base. Requires ownership.':level===2?'Next: cooldown −4% from base. Requires level 2.':'Maximum: cooldown −4%. Damage, radius and duration unchanged.','Owned',level,level<3?level*180:0,level<3?'UPGRADE':'MAX LEVEL',level<3?s=>Economy.purchase(s,'level',a.id,ids):null);
  }
  if(category==='Kart Upgrades'||category==='Owned / Locked')for(const [id,b] of Object.entries(Economy.BUILDS)){
   const owned=saved.kartUpgrades[id],equipped=(saved.builds[buildRacerId]||[]).includes(id);
   card(b.name,id,b.effect+' · Factory setup is always available.',equipped?'Equipped':owned?'Owned':'Locked',owned?1:0,owned?0:b.price,owned?(equipped?'RESTORE FACTORY':'EQUIP'):'BUY',s=>{if(!owned)return Economy.purchase(s,'kart',id,ids);const build=s.builds[buildRacerId]||[];return {...s,builds:{...s.builds,[buildRacerId]:build.includes(id)?build.filter(x=>x!==id):s.kartUpgrades[id]?[...build,id]:build}};});
  }
  if(category==='Appearance'||category==='Owned / Locked')for(const id of ['factory','satin']){
   const owned=saved.cosmetics.includes(id),equipped=(saved.appearance[buildRacerId]||'factory')===id;
   card(id==='factory'?'Factory livery':'Satin paint','Appearance','Material finish only. Original division colors preserved.',equipped?'Equipped':owned?'Owned':'Locked',owned?1:0,owned?0:200,owned?(equipped?'EQUIPPED':'EQUIP'):'BUY',equipped?null:s=>owned?{...s,appearance:{...s.appearance,[buildRacerId]:id}}:Economy.purchase(s,'cosmetic',id,ids));
  }
  if(focusKey&&dialog.open){const target=[...list.querySelectorAll('button')].find(b=>b.dataset.garageKey===focusKey&&!b.disabled);(target||dialog.querySelector('#garage-close')).focus({preventScroll:true});}
 }
 function entry(parent){if(!parent)return;const button=document.createElement('button');button.className='btn ghost';button.textContent='Garage';button.onclick=()=>{opener=button;racerId=selected?.id||racerId;status.textContent='Build changes apply on the next grid. Earn credits by finishing three-lap races.';render();dialog.showModal();padHeld=false;padFrame=requestAnimationFrame(pollPad);};parent.append(button);}
 entry(document.querySelector('.title-actions'));entry(document.querySelector('.loadout-dock'));entry(document.querySelector('#results .row'));
 const main=document.createElement('button');main.className='btn ghost';main.textContent='Main Menu';main.onclick=()=>{document.getElementById('results').classList.add('hidden');transitionScene('ZENFLOW RACER',()=>{openRoster();document.getElementById('title-screen').classList.remove('hidden');document.body.classList.add('title-open');raceSetup.step='title';document.getElementById('roster').inert=true;document.getElementById('title-start').focus();});};document.querySelector('#results .row').append(main);
 window.addEventListener('storage',e=>{if(e.key===SAVE_KEY){try{saved=Economy.migrate(JSON.parse(e.newValue||'{}'),ADDONS.map(a=>a.id));if(dialog.open)render();}catch{}}});
})();
