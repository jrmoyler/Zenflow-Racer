'use strict';
/* P1.1 — first-run coaching.
 *
 * The lesson happens inside the player's first real race instead of in a separate
 * sandbox: every step waits for the thing it is teaching to actually happen, then gets
 * out of the way. Nothing here changes the simulation — it only reads race state.
 *
 * It runs once. Completion (and an explicit skip) is persisted, so a returning player
 * never sees it again unless they ask for it from Race settings.
 */
const ONBOARDING_VERSION = 1;
// Each step names the thing it teaches, how to do it on all three control schemes, and
// the condition that proves the player did it. `patience` is the seconds after which the
// step moves on by itself, so a player who ignores the coach is never stuck behind it.
const ONBOARDING_STEPS = [
 {id:'accelerate',title:'Accelerate',keys:'W / ↑',touch:'Auto throttle is on',pad:'Right trigger',
  hint:'Get up to racing speed.',patience:9,done:s=>s.speed>14},
 {id:'steer',title:'Steer',keys:'A D / ← →',touch:'Drag the steering wheel',pad:'Left stick',
  hint:'Aim for the inside of the corner.',patience:9,done:s=>s.steering},
 {id:'drift',title:'Drift for a boost',keys:'Shift / Space',touch:'Hold DRIFT',pad:'LB / L1',
  hint:'Hold through the corner, release for a boost.',patience:16,done:s=>s.drifting||s.driftTier>0},
 {id:'item',title:'Use an item',keys:'E',touch:'ITEM',pad:'X',
  hint:'Drive through an item box, then fire what you pick up.',patience:22,done:s=>s.itemsUsed>0},
 {id:'special',title:'Your signature power',keys:'Q',touch:'POWER',pad:'Y',
  hint:'Every division has its own power on its own cooldown.',patience:20,done:s=>s.specialsUsed>0},
 {id:'addon',title:'Your add-on power',keys:'F',touch:'ADD-ON',pad:'RB / R1',
  hint:'A second power you equip yourself in the Garage.',patience:16,
  // Nothing to press when no add-on is equipped, so the step reads as information only.
  skipWhen:s=>!s.hasAddon,done:s=>s.addonsUsed>0},
 {id:'tokens',title:'Race tokens',keys:'',touch:'',pad:'',
  hint:'Tokens raise your top speed for this race only. You drop them when you are hit.',
  patience:20,done:s=>s.tokens>0},
 {id:'credits',title:'Zen Credits',keys:'',touch:'',pad:'',
  hint:'Finishing pays permanent credits. Placing well, clean laps and personal bests pay more.',
  patience:6,phase:'results',done:()=>false},
 {id:'garage',title:'The Garage',keys:'',touch:'',pad:'',
  hint:'Spend credits on add-ons, tuning and kart builds. Open it from the results screen.',
  patience:8,phase:'results',done:()=>false}
];
// Pure step machine. Given the current index and a snapshot of race state, it returns the
// next index and why it moved. Tests drive this directly; the DOM layer just renders it.
function onboardingAdvance(index,signals,heldFor){
 const steps=ONBOARDING_STEPS;
 if(index>=steps.length)return {index,reason:'complete'};
 const step=steps[index];
 const phase=step.phase||'race';
 if(phase!==signals.phase)return {index,reason:'waiting-for-phase'};
 if(step.skipWhen&&step.skipWhen(signals))return {index:index+1,reason:'not-applicable'};
 if(step.done(signals))return {index:index+1,reason:'performed'};
 if(heldFor>=step.patience)return {index:index+1,reason:'timed-out'};
 return {index,reason:'holding'};
}
function onboardingShouldRun(save){
 const t=save&&save.tutorial;
 return !(t&&t.version>=ONBOARDING_VERSION&&(t.done||t.skipped));
}
function onboardingRecord(save,outcome){
 return {...save,tutorial:{version:ONBOARDING_VERSION,done:outcome==='done',skipped:outcome==='skipped',at:Date.now()}};
}
if(typeof module!=='undefined')module.exports={ONBOARDING_STEPS,ONBOARDING_VERSION,onboardingAdvance,onboardingShouldRun,onboardingRecord};

// ---------- Browser layer ----------
if(typeof document!=='undefined'&&typeof window!=='undefined')(()=>{
 const panel=document.createElement('aside');
 panel.id='coach';panel.hidden=true;panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
 panel.innerHTML='<p class="coach-step"><span id="coach-count"></span> First race</p><h3 id="coach-title"></h3>'+
  '<p id="coach-hint"></p><p id="coach-control" class="mono"></p>'+
  '<div class="coach-actions"><button id="coach-skip" type="button" class="btn ghost">Skip tutorial</button></div>';
 document.body.append(panel);
 const el=id=>panel.querySelector('#'+id);
 const state={active:false,index:0,held:0,finished:false};

 function controlLine(step){
  if(!step.keys&&!step.touch&&!step.pad)return '';
  if(typeof game!=='undefined'&&game.touch)return step.touch||'';
  return [step.keys&&step.keys,step.pad&&('Gamepad: '+step.pad)].filter(Boolean).join('  ·  ');
 }
 function paint(){
  const step=ONBOARDING_STEPS[state.index];
  if(!state.active||!step){panel.hidden=true;return;}
  panel.hidden=false;
  el('coach-count').textContent=String(state.index+1).padStart(2,'0')+' / '+String(ONBOARDING_STEPS.length).padStart(2,'0');
  el('coach-title').textContent=step.title;
  el('coach-hint').textContent=step.hint;
  const control=controlLine(step);
  el('coach-control').textContent=control;el('coach-control').hidden=!control;
 }
 function finish(outcome){
  state.active=false;state.finished=true;panel.hidden=true;
  if(typeof saved!=='undefined'){saved.tutorial=onboardingRecord(saved,outcome).tutorial;if(typeof persist==='function')persist();}
 }
 el('coach-skip').onclick=()=>{finish('skipped');if(typeof SFX!=='undefined')SFX.ui();};

 // Called from the frame loop. Reads race state only; it never writes to the simulation.
 window.tickOnboarding=function(dt,signals){
  if(!state.active)return false;
  state.held+=dt;
  const before=state.index;
  const next=onboardingAdvance(state.index,signals,state.held);
  // A step parked waiting for the results screen must not burn its own patience while
  // the race is still running, or it would flash past the moment the screen appears.
  if(next.reason==='waiting-for-phase'){state.held=0;panel.hidden=true;return true;}
  if(next.index!==before){state.index=next.index;state.held=0;}
  if(state.index>=ONBOARDING_STEPS.length){finish('done');return false;}
  if(next.index!==before||panel.hidden)paint();
  return true;
 };
 window.startOnboarding=function(force){
  if(!force&&(typeof saved==='undefined'||!onboardingShouldRun(saved)))return false;
  state.active=true;state.index=0;state.held=0;state.finished=false;paint();return true;
 };
 window.stopOnboarding=function(){state.active=false;panel.hidden=true;};
 window.onboardingState=state;
})();
