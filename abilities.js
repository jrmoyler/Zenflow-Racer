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
 helix:{name:'REGENESIS',description:'Clear spin and slowing effects, recover lost tokens, and resist slows for 5 seconds.',cooldown:18}
};
const abilityZones=[];
function initAbility(r){r.specialCooldown=0;r.specialActive=0;r.specialPulse=0;r.phase=0;r.slow=0;r.ram=0;r.reflect=0;r.regen=0;r.lastLostTokens=0;r.specialAI=1+rng()*4;}
function clearAbilities(){abilityZones.length=0;if(typeof clearPowerEffects==='function')clearPowerEffects();}
function abilityFX(r,kind=r.div.id){if(typeof spawnPowerEffect==='function')spawnPowerEffect(kind,r.u,r.lat,r.div.acc,r);if(typeof raceFX!=='undefined')raceFX.onSpecial(r,kind);}
function powerProtected(r,attacker,reflectable=true){
 if(r.finished||r.phase>0)return true;
 if(r.reflect>0&&reflectable){r.reflect=0;abilityFX(r,'juris');if(attacker&&attacker!==r)hitRacer(attacker,'reflection',null);return true;}
 return false;
}
function powerSlow(r,duration,attacker){if(r.regen>0||powerProtected(r,attacker))return false;if(r.shield>0){r.shield=0;if(typeof raceFX!=='undefined')raceFX.onShieldBlock(r);return false;}r.slow=Math.max(r.slow||0,duration);return true;}
function useSpecial(r){
 if(game.state!=='race'||r.finished||r.specialCooldown>0||r.spin>0&&r.div.id!=='helix')return false;
 const power=ABILITIES[r.div.id];if(!power)return false;
 r.specialCooldown=power.cooldown;abilityFX(r);
 if(r.isPlayer){setToast(power.name,'teal');SFX.ui();}
 switch(r.div.id){
 case 'zenflow':r.specialActive=4;break;
 case 'collective':{let taken=0;for(const o of game.racers){if(o===r||!o.tokens||Math.abs(du_dist(r.u,o.u))>35||r.tokens>=10||taken>=3||powerProtected(o,r))continue;if(o.shield>0){o.shield=0;if(typeof raceFX!=='undefined')raceFX.onShieldBlock(o);continue;}o.tokens--;o.lastLostTokens=Math.max(o.lastLostTokens||0,1);r.tokens++;taken++;}break;}
 case 'hybrid':r.phase=3.5;r.specialActive=3.5;break;
 case 'nexus':abilityZones.push({kind:'decoy',owner:r,u:r.u,lat:r.lat,life:8});r.specialActive=8;break;
 case 'kinetic':r.ram=4;r.specialActive=4;break;
 case 'juris':r.reflect=4;r.specialActive=4;break;
 case 'signal':{let target=null,best=70;for(const o of game.racers){const d=du_dist(r.u,o.u);if(o!==r&&!o.finished&&d>0&&d<best&&Math.abs(r.lat-o.lat)<3){target=o;best=d;}}if(target){hitRacer(target,'sonic',r);abilityFX(target,'signal');}break;}
 case 'loom':abilityZones.push({kind:'snare',owner:r,u:wrap01(r.u-5/track.len),lat:r.lat,life:5});r.specialActive=5;break;
 case 'vector':r.lat=clamp(r.lat+(r.lat<=0?5:-5),-TRACK_W/2+1,TRACK_W/2-1);r.phase=.5;r.theta=0;r.steer=0;break;
 case 'aether':r.specialActive=5;break;
 case 'animus':r.specialActive=4;r.specialPulse=0;break;
 case 'helix':r.spin=0;r.slow=0;r.wheelspin=0;r.hitCd=Math.max(r.hitCd,1);r.regen=5;r.specialActive=5;r.tokens=Math.min(10,r.tokens+(r.lastLostTokens||0));r.lastLostTokens=0;break;
 }
 return true;
}
function stepAbilities(dt){
 for(const r of game.racers){
  for(const key of ['specialCooldown','phase','slow','ram','reflect','regen'])r[key]=Math.max(0,(r[key]||0)-dt);
  // AI decision timer; game.js supplies aiWantsSpecial (defensive powers when threatened, offensive when a rival is in range).
  if(!r.isPlayer&&!r.finished){r.specialAI-=dt;if(r.specialAI<=0){if(typeof aiWantsSpecial!=='function'||aiWantsSpecial(r))useSpecial(r);r.specialAI=1.2+rng()*2.8;}}
  if(r.finished||!(r.specialActive>0))continue;
  r.specialActive=Math.max(0,r.specialActive-dt);
  if(r.div.id==='zenflow')for(const o of game.racers){if(o!==r&&Math.abs(du_dist(r.u,o.u))<18&&!o.regen&&!o.phase&&!o.reflect&&!o.shield)o.slow=Math.max(o.slow||0,.18);}
  if(r.div.id==='aether')for(const t of tokens){if(t.t<=0&&r.tokens<10&&Math.abs(du_dist(r.u,t.u))<24){t.t=9;t.mesh.visible=false;r.tokens++;if(r.isPlayer)SFX.token(r.tokens);}}
  if(r.div.id==='animus'){r.specialPulse-=dt;if(r.specialPulse<=0){r.specialPulse=1.5;let target=null,best=32;for(const o of game.racers){const d=du_dist(r.u,o.u);if(o!==r&&!o.finished&&d>0&&d<best){target=o;best=d;}}if(target){if(powerSlow(target,1.1,r))target.speed*=.84;abilityFX(target,'animus-pulse');}}}
 }
 for(let i=abilityZones.length-1;i>=0;i--){const z=abilityZones[i];z.life-=dt;if(z.life<=0){abilityZones.splice(i,1);continue;}
  if(z.kind==='snare'){for(const r of game.racers)if(r!==z.owner&&Math.abs(du_dist(z.u,r.u))<7&&Math.abs(z.lat-r.lat)<2.4)powerSlow(r,.7,z.owner);}
  else for(let j=missiles.length-1;j>=0;j--){const m=missiles[j];if(m.owner!==z.owner&&Math.abs(du_dist(z.u,m.u))<10&&Math.abs(z.lat-m.lat)<3){if(typeof disposeProjectile==='function')disposeProjectile(m.mesh);else scene.remove(m.mesh);missiles.splice(j,1);z.life=0;abilityFX(z.owner,'nexus');break;}}
 }
 if(typeof stepPowerEffects==='function')stepPowerEffects(dt);
}
