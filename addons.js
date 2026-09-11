/*
MIT License

Copyright (c) 2026 mohamedachrefelouafi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 *
 * Attribution applies to the upstream Elemental Sandbox adaptations.
 */
/* Racer add-ons adapted from achrefelouafi's MIT Elemental Sandboxes.
 * Attribution and exact source inventory: references/upstream/manifest.json.
 * Track-space gameplay is original; no upstream flat-floor/camera assumptions.
 */
const ADDONS=Object.freeze([
 ['ward','Volcanic Horror Ward','Guard','Raise a rear lava ward that catches missiles; gain one shield.',21,0xe96b37],
 ['acid','Caustic Bloom','Zone','Place a boiling acid pool ahead; crossing it slows rivals for 1.6s.',19,0xafe33c],
 ['growth',"Arborist’s Growth",'Summon','Plant a bloom ahead that aims and fires three slowing lances.',23,0x77cb65],
 ['cyber','Cyber Serpent','Projectile','Launch a serpent that steers toward the nearest racer ahead.',19,0x52dbea],
 ['venom','Crystallized Venom Surge','Pierce','A crystal seam pierces up to three rivals and leaves a venom bed.',22,0xa47ddd],
 ['monolith','Brutalist Earth Blast','Rupture','A rupture travels ahead and explodes into a broad rock shockwave.',24,0xaa9680],
 ['ink','Sumi Tide','Vortex','An ink tide slows rivals and draws them toward its center lane.',21,0x537585],
 ['astral','Astral Void Blast','Collapse','A visible singularity draws rivals inward, then collapses after 1.6s.',25,0xbb85e1],
 ['cascade','Baleful Cascade Mark','Volley','A stationary crown launches a staggered three-blade homing volley.',23,0x71daca],
 ['rend','Celestial Rend','Detonate','Mark the road ahead; after 1.1s a pillar strikes the marked footprint.',24,0xf0d19c],
 ['pyre','Pyre Crown','Ring','Raise an annular wall of fire; its open center stays safe.',21,0xf1793d],
 ['kraken','Kraken Crown','Slam','Tentacles slam alternating sides of a pool, then its whole center.',24,0xa981b4],
 ['electrical','Electrical Sphere','Chain','An anchored sphere arcs through up to three nearby rivals.',22,0x90bcf5],
 ['earth-spire','Earthen Spire','Blockade','A fracture wave leaves a tall stone roadblock in its terminal lane.',22,0xb19b78],
 ['verdant-gate','Verdant Gate','Gate','Drive through your gate to gain a shield and a strong acceleration surge.',20,0x8ece70],
 ['tide-ring','Tidewrought Ring','Ring gate','Cross the raised ring to cleanse slowing and surf a speed boost.',18,0x78d4e0],
 ['fire-portal','Fire Portal','Portal','Cross your fire portal to phase and surge; its exit leaves a burning patch.',22,0xfc9946],
 ['electric-boost','Electric Boost','Self buff','An instant charged surge sends one slowing arc into a nearby rival.',18,0x8cbfff],
 ['magic-boost','Magic Boost','Self buff','Clear slowing, resist slows and channel a smooth four-second boost.',22,0xc296e8],
 ['fire-boost','Fire Boost','Self buff','Accelerate for three seconds while laying a trail of burning gas.',21,0xffaa64],
 ['fire','Elemental Fire','Projectile','A straight fireball bursts into a splash blast on first contact.',18,0xf78b45],
 ['water','Elemental Water','Wave','A broad piercing water jet washes rivals sideways and slows them.',18,0x70bed9],
 ['earth','Elemental Earth','Trail','Lay heaving crust plates behind you that slow and deflect pursuers.',19,0xb19a74],
 ['wind','Elemental Wind','Vortex','Ride a short tailwind and send a drifting tornado along your lane.',20,0xc0d7c7]
].map(([id,name,type,description,cooldown,color])=>Object.freeze({id,name,type,description,cooldown,color})));
const addonEntities=[];
const ADDON_ENTITY_LIMIT=72;
function addonDefinition(id){return ADDONS.find(a=>a.id===id)||null;}
function initAddons(r,id=''){
 r.addonId=addonDefinition(id)?id:'';r.addonCooldown=0;r.addonActive=0;r.addonPulse=0;r.addonAI=2+(typeof rng==='function'?rng():.5)*5;
}
function clearAddons(){for(const e of addonEntities)e.life=0;addonEntities.length=0;if(typeof clearAddonEffects==='function')clearAddonEffects();}
function addonEffect(id,u,lat,owner,options){if(typeof spawnAddonEffect==='function')spawnAddonEffect(id,u,lat,owner,options);}
function addonContact(id,r,owner){if(typeof spawnAddonContact==='function')spawnAddonContact(id,r.u,r.lat,owner);}
function addonNear(u,lat,r,radius){return Math.hypot(du_dist(u,r.u),r.lat-lat)<radius;}
function addonTarget(owner,u,lat,range=55,lane=TRACK_W){
 let target=null,best=range;
 for(const r of game.racers){if(r===owner||r.finished||r.phase>0)continue;const d=du_dist(u,r.u);if(d>0&&d<best&&Math.abs(r.lat-lat)<lane){target=r;best=d;}}
 return target;
}
function addonSpawn(id,owner,phase,u,lat,life,extra={}){
 if(addonEntities.length>=ADDON_ENTITY_LIMIT){addonEntities[0].life=0;addonEntities.shift();}
 const e={id,owner,phase,u:wrap01(u),lat,life,age:0,radius:3,pulse:0,contacts:new Map(),...extra};
 addonEntities.push(e);addonEffect(id,e.u,e.lat,owner,{duration:life,phase,radius:e.radius,entity:e});return e;
}
function addonZone(id,r,distance,life,extra={}){return addonSpawn(id,r,'zone',r.u+distance/track.len,r.lat,life,extra);}
function addonProjectile(id,r,extra={}){return addonSpawn(id,r,'projectile',r.u+2/track.len,r.lat,3,{speed:92,range:100,travel:0,radius:2,...extra});}
function addonBuff(r,duration){r.addonActive=duration;r.addonPulse=0;addonEffect(r.addonId,r.u,r.lat,r,{duration,phase:'buff',follow:true});}
// Side effects only follow an accepted hit/slow: shields, reflection and phase
// use the same authoritative protection gates as division powers and items.
function addonSlow(e,r,duration,push=0){
 if(!powerSlow(r,duration,e.owner))return false;
 if(push)r.lat=clamp(r.lat+push,-TRACK_W/2+1,TRACK_W/2-1);
 addonContact(e.id,r,e.owner);return true;
}
function addonHit(e,r){
 const before=r.spin||0;hitRacer(r,'addon-'+e.id,e.owner);
 const accepted=(r.spin||0)>before;if(accepted)addonContact(e.id,r,e.owner);return accepted;
}
function addonOnce(e,r,fn,interval=Infinity){
 if(e.age<(e.contacts.get(r)??-Infinity)+interval)return false;
 e.contacts.set(r,e.age);return fn();
}
function addonBlast(e,radius=e.radius){for(const r of game.racers)if(r!==e.owner&&!r.finished&&addonNear(e.u,e.lat,r,radius))addonOnce(e,r,()=>addonHit(e,r));}
function useAddon(r){
 const a=addonDefinition(r.addonId);
 if(!a||game.state!=='race'||r.finished||r.vault>0||r.spin>0||r.addonCooldown>0)return false;
 r.addonCooldown=a.cooldown*(1-(Math.min(3,r.addonLevel||1)-1)*.02);
 if(r.isPlayer&&typeof setToast==='function'){setToast(a.name.toUpperCase(),'teal');if(typeof SFX!=='undefined')SFX.ui();}
 switch(a.id){
 case 'ward':r.shield=Math.max(r.shield||0,6);addonZone(a.id,r,-5,6,{radius:4});addonBuff(r,1);break;
 case 'acid':addonZone(a.id,r,24,5,{radius:5.5,arm:.35});break;
 case 'growth':addonZone(a.id,r,22,5.5,{radius:4,shots:3,arm:.45});break;
 case 'cyber':addonProjectile(a.id,r,{homing:true,speed:105});break;
 case 'venom':addonProjectile(a.id,r,{radius:2.6,range:62,pierce:3,speed:110});break;
 case 'monolith':addonProjectile(a.id,r,{range:42,speed:85});break;
 case 'ink':addonZone(a.id,r,25,4,{radius:7,arm:.4});break;
 case 'astral':addonZone(a.id,r,30,2.2,{radius:8,arm:.35,detonate:1.6});break;
 case 'cascade':addonZone(a.id,r,18,4,{radius:4,shots:3,arm:.45});break;
 case 'rend':addonZone(a.id,r,32,1.7,{radius:7,arm:1.1});break;
 case 'pyre':addonZone(a.id,r,25,4.5,{radius:7,inner:3.5,arm:.4});break;
 case 'kraken':addonZone(a.id,r,26,4.5,{radius:7,arm:.6,slams:0});break;
 case 'electrical':addonZone(a.id,r,20,4,{radius:8,arm:.45});break;
 case 'earth-spire':addonProjectile(a.id,r,{range:35,speed:72,radius:2.5});break;
 case 'verdant-gate':case 'tide-ring':case 'fire-portal':addonZone(a.id,r,12,7,{radius:3,arm:.2});break;
 case 'electric-boost':applyBoost(r,1.4,1.38,.95);addonBuff(r,1.4);{const o=addonTarget(r,r.u,r.lat,12,6);if(o)addonSlow({id:a.id,owner:r},o,1);}break;
 case 'magic-boost':r.slow=0;r.regen=Math.max(r.regen||0,4);applyBoost(r,4,1.16,.3);addonBuff(r,4);break;
 case 'fire-boost':applyBoost(r,3,1.23,.65);addonBuff(r,3);break;
 case 'fire':addonProjectile(a.id,r,{speed:102,range:90});break;
 case 'water':addonProjectile(a.id,r,{speed:82,range:75,radius:3.5,pierce:8});break;
 case 'earth':for(let n=0;n<4;n++)addonZone(a.id,r,-5-n*4,5,{radius:3,arm:n*.12});break;
 case 'wind':applyBoost(r,1.2,1.15,.3);addonProjectile(a.id,r,{speed:65,range:65,radius:4,pierce:8});break;
 }
 return true;
}
function addonFinishProjectile(e){
 if(e.ended)return;e.ended=true;
 if(e.id==='venom')addonSpawn('venom',e.owner,'zone',e.u,e.lat,3,{radius:4,arm:.1});
 if(e.id==='earth-spire')addonSpawn('earth-spire',e.owner,'zone',e.u,e.lat,4,{radius:3,arm:.15});
 if(e.id==='monolith'){e.contacts.clear();addonBlast(e,7);addonSpawn('monolith',e.owner,'zone',e.u,e.lat,1.2,{radius:7,visualOnly:true});}
 if(e.id==='fire'){addonBlast(e,5);addonEffect(e.id,e.u,e.lat,e.owner,{duration:.7,phase:'burst',radius:5});}
 e.life=0;
}
function stepAddonProjectile(e,dt){
 const previousU=e.u,previousLat=e.lat;
 if(e.homing){const target=e.target&&!e.target.finished&&e.target.phase<=0?e.target:addonTarget(e.owner,e.u,e.lat,65);if(target)e.lat+=clamp(target.lat-e.lat,-dt*12,dt*12);}
 const distance=Math.min(e.speed*dt,e.range-e.travel);e.travel+=distance;e.u=wrap01(e.u+distance/track.len);
 // Swept segment collision prevents fast casts tunneling between fixed steps,
 // including across the finish-line seam. Rivals' lateral distance is interpolated.
 const candidates=[];
 for(const r of game.racers){if(r===e.owner||r.finished||r.phase>0)continue;const along=du_dist(previousU,r.u);if(along< -e.radius||along>distance+e.radius)continue;const t=clamp(along/Math.max(distance,.001),0,1),lat=previousLat+(e.lat-previousLat)*t;if(Math.abs(lat-r.lat)<e.radius)candidates.push({r,along});}
 candidates.sort((a,b)=>a.along-b.along);
 for(const {r} of candidates){
  if(e.contacts.has(r))continue;e.contacts.set(r,e.age);
  if(e.id==='venom')addonSlow(e,r,2.4);
  else if(e.id==='water')addonSlow(e,r,1.1,(r.lat>=e.lat?1:-1)*1.4);
  else if(e.id==='wind')addonSlow(e,r,.75,(r.lat>=e.lat?1:-1)*2.2);
  else if(e.id==='growth')addonSlow(e,r,1.3);
  else if(e.id==='cascade'&&e.shot<2)addonSlow(e,r,.55);
  else if(e.id==='monolith'||e.id==='earth-spire')addonSlow(e,r,.65);
  else addonHit(e,r);
  if(e.id==='monolith'||e.id==='earth-spire')continue;
  if(!e.pierce||--e.pierce<=0){e.u=r.u;e.lat=r.lat;addonFinishProjectile(e);break;}
 }
 if(e.travel>=e.range||e.life<=0)addonFinishProjectile(e);
}
function addonCrossedGate(e,r,dt){const d=du_dist(e.u,r.u);return Math.abs(r.lat-e.lat)<e.radius&&d>=-1.5&&d<=Math.max(2.5,(r.speed||0)*dt+1.5);}
function stepAddonZone(e,dt){
 if(e.visualOnly||e.age<(e.arm||0))return;
 if(e.id==='growth'||e.id==='cascade'){
  e.pulse-=dt;if(e.pulse>0||e.shots<=0)return;
  let t=e.id==='cascade'?e.target:null;if(!t||t.finished||t.phase>0||Math.abs(du_dist(e.u,t.u))>65)t=addonTarget(e.owner,e.u,e.lat,65);
  if(t){e.target=t;const shot=3-e.shots--;addonSpawn(e.id,e.owner,'projectile',e.u,e.lat,2,{speed:e.id==='growth'?130:115,range:110,travel:0,radius:1.7,homing:true,target:t,shot});e.pulse=e.id==='growth'?1.35:.18;}
  else e.pulse=.2;return;
 }
 if(e.id==='ward'){
  if(typeof missiles==='undefined')return;
  for(let i=missiles.length-1;i>=0;i--){const m=missiles[i];if(m.owner===e.owner||!addonNear(e.u,e.lat,m,e.radius+2))continue;if(typeof disposeProjectile==='function')disposeProjectile(m.mesh);missiles.splice(i,1);addonContact(e.id,m,e.owner);e.life=0;break;}return;
 }
 if(e.id==='verdant-gate'||e.id==='tide-ring'||e.id==='fire-portal'){
  for(const r of game.racers){if(r.finished||(e.id!=='tide-ring'&&r!==e.owner)||!addonCrossedGate(e,r,dt))continue;
   addonOnce(e,r,()=>{if(e.id==='verdant-gate'){r.shield=Math.max(r.shield||0,4);applyBoost(r,1.6,1.31,.7);}
    else if(e.id==='tide-ring'){r.slow=0;applyBoost(r,1.7,r===e.owner?1.3:1.13,.55);}
    else {r.phase=Math.max(r.phase||0,.9);applyBoost(r,2,1.36,.8);addonSpawn('fire-boost',r,'zone',e.u+18/track.len,e.lat,3,{radius:3});}
    addonContact(e.id,r,e.owner);return true;});
  }return;
 }
 if(e.id==='rend'){if(!e.detonated){e.detonated=true;addonBlast(e);addonEffect(e.id,e.u,e.lat,e.owner,{duration:.6,phase:'burst',radius:e.radius});}return;}
 if(e.id==='astral'&&e.age>=e.detonate){if(!e.detonated){e.detonated=true;e.contacts.clear();addonBlast(e);addonEffect(e.id,e.u,e.lat,e.owner,{duration:.6,phase:'burst',radius:e.radius});}return;}
 e.pulse-=dt;if(e.pulse>0)return;e.pulse=e.id==='kraken'?.85:e.id==='electrical'?.9:.55;
 if(e.id==='electrical'){
  let u=e.u,lat=e.lat;const struck=new Set();
  for(let n=0;n<3;n++){let target=null,best=n?8:e.radius;for(const r of game.racers){if(r===e.owner||r.finished||r.phase>0||struck.has(r))continue;const dist=Math.hypot(du_dist(u,r.u),r.lat-lat);if(dist<best){target=r;best=dist;}}if(!target)break;struck.add(target);addonSlow(e,target,1.1-n*.15);u=target.u;lat=target.lat;}
  return;
 }
 if(e.id==='kraken')e.slams++;
 for(const r of game.racers){
  if(r===e.owner||r.finished||r.phase>0||!addonNear(e.u,e.lat,r,e.radius))continue;
  const radial=Math.hypot(du_dist(e.u,r.u),r.lat-e.lat);
  if(e.id==='pyre'&&radial<e.inner)continue;
  if(e.id==='kraken'&&e.life>.9&&((e.slams%2===0&&r.lat<e.lat)||(e.slams%2===1&&r.lat>=e.lat)))continue;
  if(e.id==='earth-spire'||e.id==='kraken'){addonOnce(e,r,()=>addonHit(e,r),e.id==='kraken'?1.65:Infinity);continue;}
  const pull=e.id==='ink'||e.id==='astral'?clamp((e.lat-r.lat)*.24,-.8,.8):e.id==='earth'?(r.lat>=e.lat?.65:-.65):0;
  addonOnce(e,r,()=>addonSlow(e,r,e.id==='acid'?1.6:e.id==='venom'?1.8:e.id==='pyre'?1.2:.8,pull),.54);
 }
}
function addonAIWants(r){
 if(!r.addonId||r.addonCooldown>0)return false;
 if(['ward','magic-boost'].includes(r.addonId))return r.slow>0||typeof aiIncomingMissile==='function'&&!!aiIncomingMissile(r,35);
 if(['verdant-gate','tide-ring','fire-portal','electric-boost','fire-boost','wind'].includes(r.addonId))return r.speed>12;
 if(r.addonId==='earth')return game.racers.some(o=>o!==r&&!o.finished&&du_dist(o.u,r.u)>0&&du_dist(o.u,r.u)<25);
 return !!addonTarget(r,r.u,r.lat,55,10);
}
function stepAddons(dt){
 if(game.state!=='race'||!(dt>0)||!Number.isFinite(dt))return;
 for(const r of game.racers){
  r.addonCooldown=Math.max(0,(r.addonCooldown||0)-dt);r.addonActive=Math.max(0,(r.addonActive||0)-dt);
  if(!r.finished&&r.addonId==='fire-boost'&&r.addonActive>0){r.addonPulse-=dt;if(r.addonPulse<=0){addonZone('fire-boost',r,-4,2,{radius:2.7});r.addonPulse=.35;}}
  if(!r.isPlayer&&!r.finished){r.addonAI-=dt;if(r.addonAI<=0){if(addonAIWants(r))useAddon(r);r.addonAI=1.8+(typeof rng==='function'?rng():.5)*2;}}
 }
 // New entities are visible immediately but start simulating on the next step.
 const active=addonEntities.slice();
 for(const e of active){if(e.owner.finished){e.life=0;continue;}if(e.life<=0)continue;const step=Math.min(dt,e.life);e.life-=step;e.age+=step;if(e.phase==='projectile')stepAddonProjectile(e,step);else stepAddonZone(e,step);}
 for(let i=addonEntities.length-1;i>=0;i--)if(addonEntities[i].life<=0)addonEntities.splice(i,1);
}
