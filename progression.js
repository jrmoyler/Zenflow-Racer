'use strict';
// Every economic write is serialized across tabs, then persisted atomically with
// its receipt. Storage failure leaves the previous in-memory wallet untouched.
async function economyTransaction(change){
 if(!navigator.locks?.request)throw new Error('Progression needs a secure browser with Web Locks.');
 return navigator.locks.request(SAVE_KEY,()=>{
  let raw={};try{raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');}catch{}
  const fresh=Economy.migrate(raw,ADDONS.map(a=>a.id));
  const next=change(fresh);localStorage.setItem(SAVE_KEY,JSON.stringify(next));saved={...saved,...Object.fromEntries(Economy.FIELDS.map(key=>[key,next[key]]))};return next;
 });
}
function beginRewardRace(){
 const id=crypto.randomUUID();game.rewardRaceId=id;game.reward=null;game.rewardError='';
 game.rewardReady=economyTransaction(s=>Economy.begin(s,id)).catch(error=>{game.rewardError=error.message;return null;});
}
async function settleRewardRace(){
 const p=game.player,id=game.rewardRaceId;
 const report={id,finished:p.finished,laps:game.laps,completedLaps:p.lapTimes.length,position:p.rank,difficulty:game.diff,tokens:p.totalTokensCollected,hits:p.hitsTaken,time:p.finishTime,bestLap:p.bestLap,map:chosenMapId,division:p.div.id,personalBest:game.newBest};
 try{
  if(!await game.rewardReady)return;
  let receipt=null;
  await economyTransaction(s=>{const result=Economy.settle(s,report);receipt=result.reward;return result.save;});
  if(game.rewardRaceId===id){game.reward=receipt;renderRewardSummary();}
 }catch(error){game.rewardError='Credits could not be saved: '+error.message;renderRewardSummary();}
}
function applyKartBuild(r,gridIdx){
 const categories=Object.keys(Economy.BUILDS);
 const build=r.isPlayer?(saved.builds[r.div.id]||[]):[categories[gridIdx%categories.length]];
 r.build=build;
 for(const category of build)for(const [stat,multiplier] of Object.entries(Economy.BUILDS[category].stats))r[stat]=(r[stat]??1)*multiplier;
 r.addonLevel=r.isPlayer?(saved.addonUpgradeLevels[r.addonId]||1):1;
 const ud=r.mesh.userData;
 if(build.includes('Tires'))ud.wheels?.forEach(w=>{w.spin.scale.x*=1.08;});
 if(build.includes('Aero')&&typeof THREE!=='undefined'&&THREE.BoxGeometry){
  const wing=new THREE.Mesh(new THREE.BoxGeometry(2.05,.09,.42),new THREE.MeshStandardMaterial({color:0x252b32,roughness:.7,metalness:.25}));wing.name='garage-stability-wing';wing.position.set(0,1.05,1.65);ud.body.add(wing);
 }
 if(r.isPlayer&&saved.appearance[r.div.id]==='satin')r.mesh.traverse(o=>{if(o.material?.userData?.surface==='paint'||o.material?.name===r.mesh.getObjectByName('helmet-shell')?.material?.name){o.material.roughness=.65;}});
}
function renderRewardSummary(){
 const el=document.getElementById('reward-summary');if(!el||!game.player)return;
 if(!game.reward){el.textContent=game.rewardError||'Saving race rewards…';return;}
 const r=game.reward,c=saved.careerStats;
 el.replaceChildren();const title=document.createElement('h3');title.textContent='+'+r.total+' Zen Credits';el.append(title);
 const text=document.createElement('p');text.textContent=`Placement ${r.placement} · Difficulty ${r.difficulty} · Tokens ${r.tokens} · Personal best ${r.performance} · Clean race ${r.clean} · First circuit ${r.firstMap} · New racer ${r.diversity}`;el.append(text);
 const progress=document.createElement('p');progress.textContent=`${game.player.totalTokensCollected} tokens collected · ${c.races} career races · ${c.wins} wins · ${c.maps.length}/3 circuits · ${c.divisions.length}/20 racers · Wallet ${saved.wallet} Zen Credits`;el.append(progress);
 const next=ADDONS.find(a=>!saved.ownedAddons.includes(a.id));const unlock=document.createElement('p');unlock.textContent=next?`${saved.ownedAddons.length}/24 add-ons owned · ${next.name}: ${Math.min(saved.wallet,Economy.addonPrice(next.id,ADDONS.map(a=>a.id)))}/${Economy.addonPrice(next.id,ADDONS.map(a=>a.id))} credits`:'All 24 add-ons owned';el.append(unlock);
 if(window.anime?.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)window.anime.animate(title,{opacity:[0,1],translateY:[8,0],duration:500});
}
