'use strict';
// Pure, versioned progression rules. Race tokens remain simulation state.
const Economy=(()=>{
 const integer=(v,max=10000000)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const BUILDS=Object.freeze({
  Tires:{price:240,name:'Grip tires',effect:'+5% steering authority · −5% drift charge',stats:{handling:1.05,driftCharge:.95}},
  Motor:{price:280,name:'Launch motor',effect:'+5% acceleration · −2% top speed',stats:{accel:1.05,maxSpeedBase:.98}},
  Aero:{price:260,name:'Stability wing',effect:'−8% corner scrub · −3% steering authority',stats:{cornerScrub:.92,handling:.97}},
  Suspension:{price:220,name:'Touring suspension',effect:'−8% wall impact loss · −5% steering response',stats:{wallLoss:.92,steerResponse:.95}},
  'Energy Core':{price:300,name:'Cycle core',effect:'−4% signature cooldown · +5% item roulette time',stats:{powerCycle:.96,itemCycle:1.05}},
  Armor:{price:260,name:'Impact panels',effect:'−8% spin duration · +5% weight · −3% acceleration',stats:{spinDuration:.92,weight:1.05,accel:.97}}
 });
 const FIELDS=['addons','wallet','ownedAddons','addonUpgradeLevels','kartUpgrades','cosmetics','careerStats','rewardHistoryVersion','economyVersion','activeRewardRace','lastReward','builds','appearance'];
 function migrate(raw,ids){
  const s={...object(raw)},legacy=!s.economyVersion;
  s.wallet=integer(s.wallet);s.ownedAddons=[...new Set([ids[0],...(Array.isArray(s.ownedAddons)?s.ownedAddons:[]),...(legacy?Object.values(object(s.addons)):[])].filter(id=>ids.includes(id)))];
  s.addons=Object.fromEntries(Object.entries(object(s.addons)).filter(([k,id])=>s.ownedAddons.includes(id)));
  s.addonUpgradeLevels=Object.fromEntries(s.ownedAddons.map(id=>[id,Math.max(1,integer(object(s.addonUpgradeLevels)[id],3))]));
  s.kartUpgrades=Object.fromEntries(Object.keys(BUILDS).filter(k=>object(s.kartUpgrades)[k]===true).map(k=>[k,true]));
  s.builds=Object.fromEntries(Object.entries(object(s.builds)).map(([id,build])=>[id,Array.isArray(build)?[...new Set(build.filter(k=>s.kartUpgrades[k]))]:[]]));
  s.cosmetics=['factory',...(Array.isArray(s.cosmetics)&&s.cosmetics.includes('satin')?['satin']:[])];
  s.appearance=Object.fromEntries(Object.entries(object(s.appearance)).filter(([id,v])=>s.cosmetics.includes(v)));
  const c=object(s.careerStats);s.careerStats={races:integer(c.races),wins:integer(c.wins),credits:integer(c.credits),tokens:integer(c.tokens),maps:[...new Set((Array.isArray(c.maps)?c.maps:[]).filter(x=>['cherry','stormforge','canopy'].includes(x)))],divisions:[...new Set((Array.isArray(c.divisions)?c.divisions:[]).filter(x=>typeof x==='string'))]};
  s.rewardHistoryVersion=1;s.economyVersion=1;s.activeRewardRace=typeof s.activeRewardRace==='string'?s.activeRewardRace:null;
  s.lastReward=object(s.lastReward);return s;
 }
 function reward(r,s){
  const placement=[120,100,85,75,65,55,50,45,40,35,30,25][Math.max(0,Math.min(11,integer(r.position,12)-1))];
  const difficulty=Math.round(placement*[0,.2,.4][integer(r.difficulty,2)]);
  const tokens=integer(r.tokens,60)*2,performance=r.personalBest?25:0,clean=integer(r.hits)===0?25:integer(r.hits)<=2?10:0;
  const firstMap=s.careerStats.maps.includes(r.map)?0:60,diversity=s.careerStats.divisions.includes(r.division)?0:25;
  return {placement,difficulty,tokens,performance,clean,firstMap,diversity,total:placement+difficulty+tokens+performance+clean+firstMap+diversity};
 }
 function begin(s,id){return {...s,activeRewardRace:id};}
 function settle(s,r){
  if(!Number.isInteger(r.position)||r.position<1||r.position>12||!Number.isInteger(r.difficulty)||r.difficulty<0||r.difficulty>2||!['cherry','stormforge','canopy'].includes(r.map)||typeof r.division!=='string'||!r.id||s.activeRewardRace!==r.id||!r.finished||r.completedLaps!==r.laps||r.laps!==3||!Number.isFinite(r.time)||r.time<=0||!Number.isFinite(r.bestLap)||r.bestLap<=0)return {save:s,reward:null};
  const earned=reward(r,s),c=s.careerStats;
  const save={...s,wallet:integer(s.wallet+earned.total),activeRewardRace:null,lastReward:{id:r.id,...earned},careerStats:{races:c.races+1,wins:c.wins+(r.position===1?1:0),credits:integer(c.credits+earned.total),tokens:integer(c.tokens+integer(r.tokens,10000)),maps:[...new Set([...c.maps,r.map])],divisions:[...new Set([...c.divisions,r.division])]}};
  return {save,reward:earned};
 }
 const addonPrice=(id,ids)=>ids.includes(id)?180+(ids.indexOf(id)%6)*35:Infinity;
 function purchase(s,type,id,ids){
  let price=Infinity,change={};
  if(type==='addon'&&ids.includes(id)&&!s.ownedAddons.includes(id)){price=addonPrice(id,ids);change={ownedAddons:[...s.ownedAddons,id],addonUpgradeLevels:{...s.addonUpgradeLevels,[id]:1}};}
  if(type==='level'&&s.ownedAddons.includes(id)&&s.addonUpgradeLevels[id]<3){price=s.addonUpgradeLevels[id]*180;change={addonUpgradeLevels:{...s.addonUpgradeLevels,[id]:s.addonUpgradeLevels[id]+1}};}
  if(type==='kart'&&Object.hasOwn(BUILDS,id)&&!s.kartUpgrades[id]){price=BUILDS[id].price;change={kartUpgrades:{...s.kartUpgrades,[id]:true}};}
  if(type==='cosmetic'&&id==='satin'&&!s.cosmetics.includes(id)){price=200;change={cosmetics:[...s.cosmetics,id]};}
  return s.wallet>=price?{...s,...change,wallet:s.wallet-price}:s;
 }
 return {migrate,reward,begin,settle,purchase,addonPrice,BUILDS,FIELDS,integer};
})();
if(typeof module!=='undefined')module.exports=Economy;
