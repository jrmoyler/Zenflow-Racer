/* P1.1 — first-run coaching: the step machine, its persistence, and the browser layer
   driven through the real DOM. The lesson must teach every listed subject exactly once,
   never block a player who ignores it, and never come back after it is finished. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const {ONBOARDING_STEPS,ONBOARDING_VERSION,onboardingAdvance,onboardingShouldRun,onboardingRecord}=require(path.join(root,'onboarding.js'));

// Every subject P1.1 lists has a step, and every step explains all three control schemes
// or is deliberately informational.
const subjects=['accelerate','steer','drift','item','special','addon','tokens','credits','garage'];
assert.deepEqual(ONBOARDING_STEPS.map(s=>s.id),subjects,'one step per required subject, in order');
for(const step of ONBOARDING_STEPS){
 assert.ok(step.title&&step.hint,step.id+': has a title and a hint');
 assert.ok(step.patience>0&&step.patience<=25,step.id+': moves on by itself within seconds');
 const informational=!step.keys&&!step.touch&&!step.pad;
 assert.ok(informational||(step.keys&&step.touch&&step.pad),step.id+': names keyboard, touch and gamepad');
}
assert.ok(ONBOARDING_STEPS.filter(s=>s.phase==='results').length===2,'only the economy steps wait for results');
console.log('PASS coaching covers every required subject on every control scheme');

const base={phase:'race',speed:0,steering:false,drifting:false,driftTier:0,itemsUsed:0,specialsUsed:0,addonsUsed:0,tokens:0,hasAddon:true};
// Doing the thing advances the step; not doing it holds, then times out.
assert.equal(onboardingAdvance(0,{...base,speed:3},0).index,0,'slow start holds on accelerate');
assert.equal(onboardingAdvance(0,{...base,speed:22},0).reason,'performed','reaching speed clears accelerate');
assert.equal(onboardingAdvance(0,{...base,speed:3},9.1).reason,'timed-out','an ignored step steps aside');
assert.equal(onboardingAdvance(1,{...base,steering:true},0).index,2,'steering clears the steering step');
assert.equal(onboardingAdvance(2,{...base,driftTier:1},0).index,3,'a charged drift counts even after release');
assert.equal(onboardingAdvance(3,{...base,itemsUsed:1},0).index,4,'firing an item clears the item step');
assert.equal(onboardingAdvance(4,{...base,specialsUsed:1},0).index,5,'the signature power clears its step');
console.log('PASS each step waits for the action it teaches');

// With no add-on equipped there is nothing to press, so that step must not stall the run.
assert.equal(onboardingAdvance(5,{...base,hasAddon:false},0).reason,'not-applicable','no add-on equipped skips the add-on step');
assert.equal(onboardingAdvance(5,{...base,addonsUsed:1},0).index,6,'using the add-on clears it');

// Leaving the race parks the lesson entirely: the panel must never sit over the pause
// dialog, the roster or the title card.
assert.equal(onboardingAdvance(2,{...base,phase:'away',drifting:true},99).index,2,'a step away from the race does not advance');
assert.equal(onboardingAdvance(2,{...base,phase:'away'},99).reason,'waiting-for-phase');

// Results-phase steps must not burn their patience during the race.
const parked=onboardingAdvance(7,{...base,phase:'race'},99);
assert.equal(parked.index,7,'the credits step waits for the results screen');
assert.equal(parked.reason,'waiting-for-phase');
assert.equal(onboardingAdvance(7,{...base,phase:'results'},6.1).reason,'timed-out','on results it reads and moves on');
assert.equal(onboardingAdvance(ONBOARDING_STEPS.length,{...base},0).reason,'complete');
console.log('PASS optional and results-phase steps behave');

// Persistence: once finished or skipped it never runs again; a cleared record brings it back.
assert.equal(onboardingShouldRun({}),true,'a fresh save gets the tutorial');
assert.equal(onboardingShouldRun({tutorial:{version:ONBOARDING_VERSION,done:true}}),false,'a completed tutorial stays done');
assert.equal(onboardingShouldRun({tutorial:{version:ONBOARDING_VERSION,skipped:true}}),false,'skipping is respected');
assert.equal(onboardingShouldRun({tutorial:{version:0,done:true}}),true,'a newer lesson may run again');
const recorded=onboardingRecord({wallet:120},'done');
assert.equal(recorded.wallet,120,'recording the tutorial leaves the rest of the save alone');
assert.equal(recorded.tutorial.done,true);assert.equal(recorded.tutorial.version,ONBOARDING_VERSION);
assert.equal(onboardingRecord({},'skipped').tutorial.skipped,true);
console.log('PASS completion is persisted and not repeated');

// Browser layer: the real panel, driven through jsdom with the real module source.
const {JSDOM}=require(path.join(root,'node_modules','jsdom'));
const dom=new JSDOM('<!doctype html><html><body></body></html>');
const context=vm.createContext({window:dom.window,document:dom.window.document,console,Date,
 game:{touch:false},saved:{},persist(){context.persisted=(context.persisted||0)+1;},SFX:{ui(){}}});
context.globalThis=context;
vm.runInContext(fs.readFileSync(path.join(root,'onboarding.js'),'utf8'),context);
const panel=dom.window.document.getElementById('coach');
assert.ok(panel,'the coach panel is created');
assert.equal(panel.hidden,true,'it stays hidden until a race starts');
assert.equal(panel.getAttribute('role'),'status','announced politely, not as a dialog trap');
assert.equal(context.window.startOnboarding(),true,'a fresh save starts the lesson');
assert.equal(panel.hidden,false);
assert.equal(dom.window.document.getElementById('coach-title').textContent,'Accelerate');
assert.match(dom.window.document.getElementById('coach-control').textContent,/W \/ ↑/,'keyboard hints by default');
context.game.touch=true;context.window.startOnboarding(true);
assert.equal(dom.window.document.getElementById('coach-control').textContent,'Auto throttle is on','touch players get touch hints');
context.game.touch=false;

// Walk the whole lesson by performing every action, and confirm it saves itself once.
context.window.startOnboarding(true);
const signals={...base};
const perform=[['speed',30],['steering',true],['driftTier',2],['itemsUsed',1],['specialsUsed',1],['addonsUsed',1],['tokens',3]];
for(const [key,value] of perform){signals[key]=value;context.window.tickOnboarding(0.1,signals);}
assert.equal(context.window.onboardingState.index,7,'the race steps clear as the player acts');
signals.phase='results';
context.window.tickOnboarding(7,signals);context.window.tickOnboarding(9,signals);
assert.equal(panel.hidden,true,'the panel closes when the lesson ends');
assert.equal(context.saved.tutorial.done,true,'finishing writes the save');
assert.ok(context.persisted>=1,'and persists it');
assert.equal(context.window.startOnboarding(),false,'a finished lesson does not restart');

// The panel hides whenever the player is not racing, and comes back where it left off.
context.saved={};
assert.equal(context.window.startOnboarding(),true);
assert.equal(panel.hidden,false);
context.window.tickOnboarding(0.1,{...base,phase:'away'});
assert.equal(panel.hidden,true,'leaving the race hides the coach');
assert.equal(context.window.onboardingState.index,0,'without losing the lesson');
context.window.tickOnboarding(0.1,{...base});
assert.equal(panel.hidden,false,'returning to the race brings it back');

// Skipping is one click away and is equally final.
context.saved={};
assert.equal(context.window.startOnboarding(),true);
dom.window.document.getElementById('coach-skip').dispatchEvent(new dom.window.Event('click'));
assert.equal(panel.hidden,true,'skip closes the panel immediately');
assert.equal(context.saved.tutorial.skipped,true,'skip is remembered');
assert.equal(context.window.tickOnboarding(1,{...base}),false,'a skipped lesson stops ticking');
console.log('PASS coach panel: shows, teaches, closes, saves, and can be skipped');
console.log('onboarding tests passed');
