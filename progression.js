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
  await economyTransaction(s=>{const result=Economy.settle(s,report);receipt=result.reward||(s.lastReward?.id===id?s.lastReward:null);return result.save;});
  if(game.rewardRaceId===id){game.reward=receipt;game.rewardError=receipt?'':'This race is no longer eligible for rewards (another race was started).';renderRewardSummary();}
 }catch(error){if(game.rewardRaceId===id){game.rewardError='Credits could not be saved: '+error.message;renderRewardSummary();}}
}
function applyKartBuild(r,gridIdx){
 const categories=Object.keys(Economy.BUILDS);
 const build=r.isPlayer?(saved.builds[r.div.id]||[]):[categories[gridIdx%categories.length]];
 r.build=build;
 for(const category of build)for(const [stat,multiplier] of Object.entries(Economy.BUILDS[category].stats))r[stat]=(r[stat]??1)*multiplier;
 r.addonLevel=r.isPlayer?(saved.addonUpgradeLevels[r.addonId]||1):1;
 applyKartBuildVisuals(r.mesh,build,r.isPlayer?saved.appearance[r.div.id]:'factory');
}
// Shared by the garage and live racers. Re-applying a build always starts at
// factory geometry and materials, so toggling never accumulates transformations.
function clearKartBuildVisuals(mesh){
 const state=mesh.userData.buildVisuals;if(!state)return;
 for(const [node,scale] of state.scales)node.scale.copy(scale);
 for(const [node,material] of state.paint)node.material=material;
 for(const group of state.groups)group.removeFromParent?group.removeFromParent():group.parent?.remove(group);
 for(const geometry of state.geometry)geometry.dispose();
 for(const material of state.materials)material.dispose();
 delete mesh.userData.buildVisuals;
}
function applyKartBuildVisuals(mesh,build=[],appearance='factory'){
 if(!mesh||typeof THREE==='undefined')return;
 const categories=[...new Set(build)].filter(category=>Object.hasOwn(Economy.BUILDS,category)).sort();
 const key=JSON.stringify([categories,appearance]);
 if(mesh.userData.buildVisuals?.key===key)return mesh.userData.buildVisuals;
 clearKartBuildVisuals(mesh);
 const state={key,categories,groups:[],scales:[],paint:[],geometry:new Set(),materials:new Set(),animated:[]};
 mesh.userData.buildVisuals=state;
 if(appearance==='satin'){
  const copies=new Map();
  const satin=material=>{
   if(material?.userData?.surface!=='paint')return material;
   if(!copies.has(material)){const copy=material.clone();copy.roughness=.65;copy.roughnessMap=null;
    if('clearcoat' in copy){copy.clearcoat=.25;copy.clearcoatRoughness=.65;}
    copies.set(material,copy);state.materials.add(copy);
   }return copies.get(material);
  };
  mesh.traverse(node=>{if(!node.material)return;const original=node.material;
   const next=Array.isArray(original)?original.map(satin):satin(original);
   if(Array.isArray(original)?next.some((m,i)=>m!==original[i]):next!==original){state.paint.push([node,original]);node.material=next;}
  });
 }
 const metal=new THREE.MeshStandardMaterial({color:0x404954,metalness:.8,roughness:.3});
 const carbon=new THREE.MeshStandardMaterial({color:0x131c25,metalness:.25,roughness:.65});
 const copper=new THREE.MeshStandardMaterial({color:0xcc7446,metalness:.78,roughness:.3});
 const energy=new THREE.MeshStandardMaterial({color:0x77d9ee,emissive:0x269dbd,emissiveIntensity:.7,metalness:.4,roughness:.22});
 for(const material of [metal,carbon,copper,energy])state.materials.add(material);
 const body=mesh.userData.body||mesh;
 const group=(category,parent=body)=>{const g=new THREE.Group();g.name='garage-upgrade-'+category.toLowerCase().replace(/ /g,'-');g.userData.upgrade=category;parent.add(g);state.groups.push(g);return g;};
 const part=(g,geometry,material,position,rotation)=>{state.geometry.add(geometry);const p=new THREE.Mesh(geometry,material);p.position.set(...position);if(rotation)p.rotation.set(...rotation);p.castShadow=p.receiveShadow=true;g.add(p);return p;};
 const box=(g,size,mat,pos)=>part(g,new THREE.BoxGeometry(...size),mat,pos);
 const cylinder=(g,radius,length,mat,pos,rotation)=>part(g,new THREE.CylinderGeometry(radius,radius,length,12),mat,pos,rotation);
 if(categories.includes('Tires'))for(const wheel of mesh.userData.wheels||[]){
  if(!wheel.spin)continue;state.scales.push([wheel.spin,wheel.spin.scale.clone()]);wheel.spin.scale.x*=1.12;
  const g=group('Tires',wheel.spin);
  // Axle-aligned bead-lock rings follow wheel spin and suspension, never the body.
  for(const side of [-1,1])part(g,new THREE.TorusGeometry(.5,.045,6,24),copper,[side*.29,0,0],[0,Math.PI/2,0]);
 }
 if(categories.includes('Motor')){
  const g=group('Motor');box(g,[.9,.38,.5],metal,[0,.65,1.47]);
  for(let i=0;i<6;i++)box(g,[1.04,.035,.055],copper,[0,.77,1.24+i*.08]);
  for(const side of [-1,1]){cylinder(g,.15,.48,metal,[side*.72,.68,1.62],[Math.PI/2,0,0]);const fan=part(g,new THREE.TorusGeometry(.12,.028,6,16),copper,[side*.72,.68,1.89]);part(fan,new THREE.BoxGeometry(.2,.04,.025),copper,[0,0,.012]);part(fan,new THREE.BoxGeometry(.04,.2,.025),copper,[0,0,.012]);state.animated.push({node:fan,type:'motor'});}
 }
 if(categories.includes('Aero')){
  const g=group('Aero');g.name='garage-stability-wing';
  for(const side of [-1,1])box(g,[.065,.62,.11],metal,[side*.68,.99,1.5]);
  const wing=box(g,[2.25,.1,.45],carbon,[0,1.3,1.5]);wing.rotation.x=-.1;
  for(const side of [-1,1])box(g,[.07,.31,.55],copper,[side*1.12,1.35,1.5]);
 }
 if(categories.includes('Suspension'))for(const wheel of mesh.userData.wheels||[]){
  const g=group('Suspension',wheel.pivot||body),side=wheel.side||1;
  cylinder(g,.048,.49,metal,[-side*.15,.25,0]);
  // A continuous coil, instead of disconnected rings, reads as actual hardware.
  const points=[];for(let i=0;i<=64;i++){const t=i/64;points.push(new THREE.Vector3(-side*.15+Math.cos(t*Math.PI*12)*.095,.03+t*.44,Math.sin(t*Math.PI*12)*.095));}
  part(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,.021,5,false),copper,[0,0,0]);
 }
 if(categories.includes('Energy Core')){
  const g=group('Energy Core');cylinder(g,.23,.62,metal,[0,.88,1.06],[0,0,Math.PI/2]);
  for(const x of [-.23,0,.23]){const ring=part(g,new THREE.TorusGeometry(.245,.038,6,20),energy,[x,.88,1.06],[0,Math.PI/2,0]);state.animated.push({node:ring,type:'core'});}
 }
 if(categories.includes('Armor')){
  const g=group('Armor');for(const side of [-1,1]){
   const plate=box(g,[.18,.34,1.52],metal,[side*1.03,.56,.03]);plate.rotation.z=side*.14;
   for(const z of [-.54,.54])cylinder(g,.045,.025,copper,[side*1.13,.61,z],[0,0,Math.PI/2]);
  }box(g,[1.35,.21,.17],carbon,[0,.43,-1.64]);
 }
 // Batch static hardware by material within each articulated attachment.
 const moving=new Set(state.animated.map(a=>a.node));
 for(const g of state.groups){
  const batches=new Map();for(const node of g.children){if(!node.isMesh||moving.has(node))continue;
   if(!batches.has(node.material))batches.set(node.material,[]);batches.get(node.material).push(node);
  }
  for(const [material,nodes] of batches){if(nodes.length<2)continue;
   const parts=nodes.map(node=>{node.updateMatrix();const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();return geometry.applyMatrix4(node.matrix);});
   const geometry=new THREE.BufferGeometry();
   for(const name of ['position','normal','uv']){const size=parts[0].attributes[name].itemSize;const data=new Float32Array(parts.reduce((n,p)=>n+p.attributes[name].array.length,0));let offset=0;
    for(const p of parts){data.set(p.attributes[name].array,offset);offset+=p.attributes[name].array.length;}
    geometry.setAttribute(name,new THREE.BufferAttribute(data,size));
   }
   for(const p of parts)p.dispose();for(const node of nodes){g.remove(node);state.geometry.delete(node.geometry);node.geometry.dispose();}
   part(g,geometry,material,[0,0,0]);
  }
 }
 return state;
}
function animateKartBuildVisuals(mesh,time,options={}){
 const speed=options.speed||0;
 const state=mesh?.userData?.buildVisuals;if(!state)return;
 for(const {node,type} of state.animated){
  if(type==='motor')node.rotation.z=time*(3+Math.min(30,Math.abs(speed)));
  else node.material.emissiveIntensity=.65+Math.sin(time*3)*.2;
 }
}

function renderRewardSummary(){
 const el=document.getElementById('reward-summary');if(!el||!game.player)return;
 if(!game.reward){el.textContent=game.rewardError||'Saving race rewards…';return;}
 const r=game.reward,c=saved.careerStats;
 el.replaceChildren();const title=document.createElement('h3');title.textContent='+'+r.total+' Zen Credits';el.append(title);
 const text=document.createElement('p');text.textContent=`Placement ${r.placement} · Difficulty ${r.difficulty} · Tokens ${r.tokens} · Personal best ${r.performance} · Clean race ${r.clean} · First circuit ${r.firstMap} · New racer ${r.diversity}`;el.append(text);
 const progress=document.createElement('p');progress.textContent=`${game.player.totalTokensCollected} tokens collected · ${c.races} career races · ${c.wins} wins · ${c.maps.length}/3 circuits · ${c.divisions.length}/20 racers · Wallet ${saved.wallet} Zen Credits`;el.append(progress);
 const next=ADDONS.find(a=>!saved.ownedAddons.includes(a.id));const unlock=document.createElement('p');unlock.textContent=next?`${saved.ownedAddons.length}/24 add-ons owned · ${next.name}: ${Math.min(saved.wallet,Economy.addonPrice(next.id,ADDONS.map(a=>a.id)))}/${Economy.addonPrice(next.id,ADDONS.map(a=>a.id))} credits`:'All 24 add-ons owned';el.append(unlock);
 const awards=[];if(r.firstMap)awards.push('First circuit completion');if(r.diversity)awards.push('First finish with '+game.player.div.name);if(r.performance)awards.push('New personal best');
 if(awards.length){const achieved=document.createElement('p');achieved.className='reward-achievements';achieved.textContent='ACHIEVED · '+awards.join(' · ');el.append(achieved);}
 const affordable=ADDONS.filter(a=>!saved.ownedAddons.includes(a.id)&&Economy.addonPrice(a.id,ADDONS.map(a=>a.id))<=saved.wallet);
 if(affordable.length){const available=document.createElement('p');available.textContent='READY TO UNLOCK · '+affordable.length+' add-ons within budget. Choose yours in the Garage.';el.append(available);}
 // Count once, when results actually become visible; settlement may finish earlier.
 if(game.state==='results'&&game.rewardAnimatedId!==game.rewardRaceId){
  game.rewardAnimatedId=game.rewardRaceId;
  if(window.anime?.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   const counter={value:0};title.setAttribute('aria-label','Earned '+r.total+' Zen Credits');
   window.anime.animate(counter,{value:r.total,duration:1000,ease:'outCubic',onUpdate:()=>{title.textContent='+'+Math.round(counter.value)+' Zen Credits';},onComplete:()=>{title.textContent='+'+r.total+' Zen Credits';}});
   window.anime.animate(title,{opacity:[0,1],translateY:[8,0],duration:500});
  }
 }

}
