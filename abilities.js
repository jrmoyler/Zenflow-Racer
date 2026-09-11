/* Division powers: deterministic gameplay, bounded simulation lifetimes. */
const ABILITIES={
 zenflow:{name:'TIME DILATION',description:'A 4-second field slows nearby rivals while you keep your momentum.',cooldown:19},
 collective:{name:'SHARED FORTUNE',description:'Siphon one token from up to three nearby rivals into your reserve.',cooldown:17},
 hybrid:{name:'PHASE WALK',description:'Become intangible for 3.5 seconds. Pass through karts, mines and missiles.',cooldown:20},
 nexus:{name:'HOLOGRAM DECOY',description:'Leave an 8-second hologram that intercepts hostile missiles in its lane.',cooldown:17},
 kinetic:{name:'IMPACT DRIVE',description:'Charge your chassis for 4 seconds. Contact spins rivals out.',cooldown:20},
 juris:{name:'VERDICT MIRROR',description:'For 4 seconds, reflect the next hostile hit back to its owner.',cooldown:18},
 signal:{name:'SONIC LANCE',description:'Fire a narrow sonic strike at the closest rival ahead, within 70 metres.',cooldown:16},
 loom:{name:'THREAD SNARE',description:'Lay a 5-second ribbon behind you that slows rivals crossing its lane.',cooldown:18},
 vector:{name:'SIDE STEP',description:'Blink into the adjacent lane with half a second of collision immunity.',cooldown:12},
 aether:{name:'ORBITAL MAGNET',description:'Pull available tokens from across the track within 24 metres for 5 seconds.',cooldown:20},
 animus:{name:'SENTINEL DRONE',description:'A 4-second escort fires up to three short-range pulses at rivals ahead.',cooldown:23},
 helix:{name:'REGENESIS',description:'Clear spin and slowing effects, recover lost tokens, and resist slows for 5 seconds.',cooldown:18},
 ledger:{name:'VAULT LOCK',description:'Freeze nearby rivals’ token gains and item use for up to 4 seconds.',cooldown:18},
 terra:{name:'ANCHOR SPAN',description:'Hold your mass and momentum for 3.5 seconds. Bumps cannot shove you.',cooldown:19},
 obsidian:{name:'HARD PERIMETER',description:'Block one hit and shove touching rivals with a 4-second perimeter.',cooldown:18},
 civic:{name:'SHARED LANE',description:'Give the nearest other racer within 14 metres your slipstream for 5 seconds.',cooldown:17},
 cognara:{name:'PREDICTIVE LINE',description:'Read a 4-second racing line with tighter steering and reduced corner scrub.',cooldown:16},
 gaia:{name:'ROOT NET',description:'Leave a 5-second root ribbon that slows crossings while improving your edge grip.',cooldown:18},
 nomad:{name:'WAYPOINT HOP',description:'Hop 6 metres forward with 0.6 seconds of collision immunity.',cooldown:13},
 eon:{name:'SECOND WIND',description:'Cleanse spin and slow, resist slows for 5 seconds, and surge back into motion.',cooldown:18}
};
const abilityZones=[];
function initAbility(r){
 for(const key of ['specialCooldown','specialActive','specialPulse','phase','slow','ram','reflect','regen','vault','anchor','perimeter','civicDraft','predict','lastLostTokens'])r[key]=0;
 r.specialSeen=new Set();r.specialElapsed=0;r.specialPulses=0;r.anchorSpeed=0;r.specialAI=1+rng()*4;
}
function clearAbilities(){abilityZones.length=0;if(typeof clearPowerEffects==='function')clearPowerEffects();}
function abilityFX(r,kind=r.div.id){if(typeof spawnPowerEffect==='function')spawnPowerEffect(kind,r.u,r.lat,r.div.acc,r);if(typeof raceFX!=='undefined')raceFX.onSpecial(r,kind);}
// Every activation reports what it actually did. A power the driver cannot read
// is a power the driver believes is broken, so the outcome rides the toast
// subtitle and the caster's status rail rather than staying in the simulation.
function powerOutcome(r,text){if(r.isPlayer)powerOutcome.last=text||'';return text||'';}
function powerLanded(count,singular,plural=singular+'S'){return count?count+' '+(count===1?singular:plural):'';}
function powerProtected(r,attacker,reflectable=true){
 if(r.finished||r.phase>0)return true;
 if(r.reflect>0&&reflectable){r.reflect=0;abilityFX(r,'juris');if(typeof spawnAddonContact==='function')spawnAddonContact('juris',r.u,r.lat,r);if(attacker&&attacker!==r)hitRacer(attacker,'reflection',null);return true;}
 return false;
}
// Mirrors answer hits only. A perimeter's shield is also reserved for hits.
function powerSlow(r,duration,attacker){if(r.regen>0||powerProtected(r,attacker,false))return false;if(r.shield>0&&!(r.perimeter>0)){r.shield=0;if(typeof raceFX!=='undefined')raceFX.onShieldBlock(r);return false;}
 const fresh=!(r.slow>0);r.slow=Math.max(r.slow||0,duration);
 // Being snared is a race-changing event; the driver hears about it once per
 // effect rather than on every step of a sustained field.
 if(fresh&&r.isPlayer&&typeof setToast==='function')setToast('SNARED','',(attacker&&attacker!==r&&attacker.div?attacker.div.name.toUpperCase()+' FIELD':'HOSTILE FIELD'),2);
 return true;}
function useSpecial(r){
 if(game.state!=='race'||r.finished||r.specialCooldown>0||r.spin>0&&!['helix','eon'].includes(r.div.id))return false;
 const power=ABILITIES[r.div.id];if(!power)return false;
 r.specialCooldown=power.cooldown*(r.powerCycle||1);abilityFX(r);powerOutcome.last='';
 switch(r.div.id){
 case 'zenflow':r.specialActive=4;r.specialSeen.clear();break;
 case 'collective':{
  const nearby=game.racers.filter(o=>o!==r&&!o.finished&&o.tokens>0&&!(o.vault>0)&&Math.abs(du_dist(r.u,o.u))<35).sort((a,b)=>Math.abs(du_dist(r.u,a.u))-Math.abs(du_dist(r.u,b.u)));
  let taken=0;for(const o of nearby){if(r.tokens>=10||r.vault>0||taken>=3)break;if(powerProtected(o,r,false))continue;if(o.shield>0&&!(o.perimeter>0)){o.shield=0;if(typeof raceFX!=='undefined')raceFX.onShieldBlock(o);continue;}o.tokens--;o.lastLostTokens=Math.max(o.lastLostTokens||0,1);r.tokens++;r.totalTokensCollected=(r.totalTokensCollected||0)+1;taken++;}
  // A siphon that finds nothing to take still converts the reserve into speed:
  // the cooldown is committed either way, so the activation must never be inert.
  if(taken)powerOutcome(r,'+'+taken+' TOKEN'+(taken===1?'':'S'));
  else {applyBoost(r,1,1.12,.4);powerOutcome(r,'NO RESERVES · SIPHON VENTED');}
  break;}
 case 'hybrid':r.phase=3.5;r.specialActive=3.5;break;
 case 'nexus':abilityZones.push({kind:'decoy',owner:r,u:r.u,lat:r.lat,life:8});r.specialActive=8;break;
 case 'kinetic':r.ram=4;r.specialActive=4;break;
 case 'juris':r.reflect=4;r.specialActive=4;break;
 case 'signal':{let target=null,best=70;for(const o of game.racers){const d=du_dist(r.u,o.u);if(o!==r&&!o.finished&&d>0&&d<best&&Math.abs(r.lat-o.lat)<3){target=o;best=d;}}
  // The cast stays committed on a miss, but the lance is never wasted: with no
  // rival in the lane the charge vents backwards as thrust.
  if(target){hitRacer(target,'sonic',r);abilityFX(target,'signal');powerOutcome(r,'DIRECT HIT · '+Math.round(best)+'M');}
  else {applyBoost(r,1.1,1.14,.5);powerOutcome(r,'NO TARGET · CHARGE VENTED');}
  break;}
 case 'loom':abilityZones.push({kind:'snare',owner:r,u:wrap01(r.u-5/track.len),lat:r.lat,life:5});r.specialActive=5;break;
 case 'vector':{
  powerOutcome(r,'LANE BLINK');
  const bound=TRACK_W/2-1,preferred=r.lat<=0?1:-1;
  const occupancy=side=>{const landing=clamp(r.lat+side*4,-bound,bound);let count=0;for(const o of game.racers)if(o!==r&&!o.finished&&!(o.phase>0)&&Math.abs(du_dist(r.u,o.u))<8&&Math.abs(o.lat-landing)<2)count++;return count;};
  const side=occupancy(preferred)>occupancy(-preferred)?-preferred:preferred;
  r.lat=clamp(r.lat+side*4,-bound,bound);r.phase=.5;r.specialActive=.5;r.theta=0;r.steer=0;break;}
 case 'aether':r.specialActive=5;break;
 case 'animus':r.specialActive=4;r.specialElapsed=0;r.specialPulses=0;r.specialPulse=0;break;
 case 'helix':{const recovered=r.vault>0?0:Math.min(10-r.tokens,r.lastLostTokens||0);r.spin=0;r.slow=0;r.wheelspin=0;r.hitCd=Math.max(r.hitCd,1);r.regen=5;r.specialActive=5;if(!(r.vault>0))r.tokens=Math.min(10,r.tokens+(r.lastLostTokens||0));r.lastLostTokens=0;powerOutcome(r,recovered?'CLEANSED · +'+recovered+' RECOVERED':'CLEANSED');break;}
 case 'ledger':r.specialActive=4;break;
 case 'terra':r.anchor=3.5;r.anchorSpeed=r.speed;r.specialActive=3.5;break;
 case 'obsidian':r.shield=Math.max(r.shield,4);r.perimeter=4;r.specialActive=4;powerOutcome(r,'PERIMETER UP');break;
 case 'civic':r.specialActive=5;break;
 case 'cognara':r.predict=4;r.specialActive=4;break;
 case 'gaia':r.specialActive=5;abilityZones.push({kind:'roots',owner:r,u:wrap01(r.u-4/track.len),lat:r.lat,life:5});break;
 case 'nomad':r.phase=.6;r.specialActive=.6;r.theta=0;r.steer=0;advanceRaceDistance(r,6/track.len,0);break;
 case 'eon':r.spin=0;r.slow=0;r.wheelspin=0;r.hitCd=Math.max(r.hitCd,1);r.regen=5;r.specialActive=5;applyBoost(r,1.2,1.18,.8);powerOutcome(r,'CLEANSED · SURGE');break;
 }
 if(r.isPlayer){setToast(power.name,'teal',powerOutcome.last||power.description,2);SFX.ui();}
 return true;
}
// Sustained fields fire every step; the driver only needs to be told when the
// tally actually changes, so repeats within an activation stay silent.
function powerReport(r,title,detail){
 const key=title+'|'+detail;if(powerReport.key===key&&game.raceTime<(powerReport.until||0))return;
 powerReport.key=key;powerReport.until=game.raceTime+1.2;if(typeof setToast==='function')setToast(title,'teal',detail,2);
}
function stepAbilities(dt){
 if(game.state!=='race'||!(dt>0))return;
 // Decay first for the entire field: application durations never depend on roster order.
 for(const r of game.racers)for(const key of ['specialCooldown','phase','slow','ram','reflect','regen','vault','anchor','perimeter','civicDraft','predict'])r[key]=Math.max(0,(r[key]||0)-dt);
 for(const r of game.racers){
  if(!r.isPlayer&&!r.finished){r.specialAI-=dt;if(r.specialAI<=0){if(typeof aiWantsSpecial!=='function'||aiWantsSpecial(r))useSpecial(r);r.specialAI=1.2+rng()*2.8;}}
  if(r.finished){r.specialActive=0;continue;}
  if(!(r.specialActive>0))continue;
  const activeDt=Math.min(dt,r.specialActive);r.specialActive=Math.max(0,r.specialActive-dt);
  if(r.div.id==='zenflow'){let caught=0;for(const o of game.racers){if(o!==r&&Math.abs(du_dist(r.u,o.u))<18){const first=!r.specialSeen.has(o);if(powerSlow(o,first?1.2:.6,r))caught++;r.specialSeen.add(o);}}
   if(caught&&r.isPlayer)powerReport(r,'DILATION FIELD',powerLanded(r.specialSeen.size,'RIVAL')+' CAUGHT');}
  if(r.div.id==='ledger'){let locked=0;for(const o of game.racers){if(o!==r&&Math.abs(du_dist(r.u,o.u))<16&&!powerProtected(o,r,false)){o.vault=Math.max(o.vault,r.specialActive);locked++;}}
   if(locked&&r.isPlayer)powerReport(r,'VAULT LOCK',powerLanded(locked,'RIVAL')+' LOCKED');}
  if(r.div.id==='civic'){let target=null,best=14;for(const o of game.racers){const d=Math.abs(du_dist(r.u,o.u));if(o!==r&&!o.finished&&!(o.phase>0)&&d<best&&Math.abs(r.lat-o.lat)<4){target=o;best=d;}}if(target)target.civicDraft=Math.max(target.civicDraft,.4);}
  if(r.div.id==='aether'&&r.spin<=0&&!(r.phase>0)&&!(r.vault>0))for(const t of tokens){if(t.t<=0&&r.tokens<10&&Math.abs(du_dist(r.u,t.u))<24){t.t=9;t.mesh.visible=false;r.tokens++;r.totalTokensCollected=(r.totalTokensCollected||0)+1;if(r.isPlayer)SFX.token(r.tokens);}}
  if(r.div.id==='animus'){
   r.specialElapsed+=activeDt;
   while(r.specialPulses<3&&r.specialPulses*1.5<=r.specialElapsed){r.specialPulses++;let target=null,best=32;for(const o of game.racers){const d=du_dist(r.u,o.u);if(o!==r&&!o.finished&&d>0&&d<best&&Math.abs(r.lat-o.lat)<6){target=o;best=d;}}if(target&&powerSlow(target,1.1,r)){target.speed*=.84;abilityFX(target,'animus-pulse');}}
   r.specialPulse=Math.max(0,r.specialPulses*1.5-r.specialElapsed);
  }
 }
 for(let i=abilityZones.length-1;i>=0;i--){const z=abilityZones[i];z.life-=dt;if(z.life<=0){abilityZones.splice(i,1);continue;}
  if(z.kind==='snare'||z.kind==='roots'){const roots=z.kind==='roots';for(const r of game.racers)if(r!==z.owner&&Math.abs(du_dist(z.u,r.u))<(roots?8:7)&&Math.abs(z.lat-r.lat)<(roots?2.6:2.4))powerSlow(r,.8,z.owner);}
  else if(z.kind==='decoy')for(let j=missiles.length-1;j>=0;j--){const m=missiles[j];if(m.owner!==z.owner&&Math.abs(du_dist(z.u,m.u))<10&&Math.abs(z.lat-m.lat)<3){if(typeof disposeProjectile==='function')disposeProjectile(m.mesh);else scene.remove(m.mesh);missiles.splice(j,1);abilityZones.splice(i,1);abilityFX(z.owner,'nexus');break;}}
 }
 if(typeof stepPowerEffects==='function')stepPowerEffects(dt);
}
