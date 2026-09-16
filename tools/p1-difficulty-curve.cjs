// P1.3 — difficulty curve, measured on the shipping AI after the economy, build and
// circuit-extension changes. Deterministic, solo, 120 Hz, no rendering and no items:
// the point is to isolate what difficulty is allowed to change.
//
// Difficulty must move decision quality, consistency and recovery — never raw stats.
// This run therefore reports three things per level:
//   pace     — mean lap on a clean solo run (line choice, drift commitment, braking)
//   recovery — seconds to get back on line after an identical scripted spin
//   spread   — lap-to-lap variation within a run (standing start, not noise consistency)
// It also asserts that top speed, acceleration, handling and the catch-up multiplier are
// identical at every level. Not a human benchmark and not device evidence.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = path.resolve(__dirname, '..'), file = path.join(root, 'tests/game-regression.cjs');
const fixture = fs.readFileSync(file, 'utf8').split('const cases=[];')[0];
const tail = `
context.THREE=require('../vendor/three.min.js');context.smooth=t=>t*t*(3-2*t);
const worldText=readFileSync(path.join(__dirname,'../world.js'),'utf8');
run(readFileSync(path.join(__dirname,'../circuit-extensions.js'),'utf8'));
run(readFileSync(path.join(__dirname,'../maps.js'),'utf8'));
run(worldText.slice(worldText.indexOf('const CTRL='),worldText.indexOf('// ---------- Ribbon builder')));
run('animateKart=()=>{};raceFX.step=()=>{};raceFX.onDriftTier=()=>{};raceFX.onWall=()=>{}');

const runs=[];
for(const map of run('MAPS')){
 context.map=map;
 run("activeMap=map;constBase=map.control||CHERRY_CONTROL;rollBase=map.id==='cherry'?CHERRY_ROLL:[[0,0],[3,0],[4,-12],[6,0],[9,9],[12,0],[16,-8],[18,0],[20,0]];agBase=map.id==='cherry'?CHERRY_AG:[[0,0],[20,0]]");
 run("CTRL.splice(0,CTRL.length,...extendedCircuitControls(map.id,constBase));ROLL_KEYS.splice(0,ROLL_KEYS.length,...extendedCircuitKeys(map.id,rollBase));AG_KEYS.splice(0,AG_KEYS.length,...extendedCircuitKeys(map.id,agBase));buildTrackFrames();");
 if(typeof context.configureCircuitRoutes==='function')run('configureCircuitRoutes()');
 for(const diff of [0,1,2]){
  context.diff=diff;
  // Clean pace. The seed is reset per level so the three levels drive the same circuit
  // with the same random stream; only the difficulty constants differ.
  run("globalThis.r=new Racer(ROSTER[0],false,0);r.ai.skill=.85;r.ai.offset=0;r.specialAI=Infinity;game.racers=[r];game.player=r;game.diff=diff;game.state='race';game.raceTime=0;r.u=0;r.distance=0;for(let tick=0;tick<120*400&&!r.finished;tick++){game.raceTime+=1/120;stepAI(r,1/120);stepRacer(r,1/120);}");
  const laps=Array.from(run('r.lapTimes'));
  assert.equal(laps.length,3,map.id+' diff '+diff+': three completed laps');
  const stats=run("({maxSpeedBase:r.maxSpeedBase,accel:r.accel,handling:r.handling,rubber:r.rubber})");

  // Recovery. Two identical karts run the same opening stint; one is then given an
  // identical spin. The metre deficit it still carries eight seconds later is what
  // "recovery" means to a player — ground lost after being knocked about.
  run("globalThis.q=new Racer(ROSTER[0],false,0);globalThis.twin=new Racer(ROSTER[0],false,0);for(const k of [q,twin]){k.ai.skill=.85;k.ai.offset=0;k.specialAI=Infinity;k.u=0;k.distance=0;}game.diff=diff;game.state='race';game.raceTime=0;");
  run("for(let tick=0;tick<120*12;tick++){game.raceTime+=1/120;for(const k of [q,twin]){game.racers=[k];game.player=k;stepAI(k,1/120);stepRacer(k,1/120);}}");
  run("q.spin=1.1;q.theta=.55;q.speed*=.45;for(let tick=0;tick<120*8;tick++){game.raceTime+=1/120;for(const k of [q,twin]){game.racers=[k];game.player=k;stepAI(k,1/120);stepRacer(k,1/120);}}");
  const recovery=run('(twin.distance-q.distance)*track.len');
  const mean=laps.reduce((a,b)=>a+b,0)/laps.length;
  runs.push({map:map.id,difficulty:diff,
   meanLapSeconds:+mean.toFixed(3),bestLapSeconds:+Math.min(...laps).toFixed(3),
   lapSpreadSeconds:+(Math.max(...laps)-Math.min(...laps)).toFixed(3),
   metresLostAfterSpin:recovery===null?null:+recovery.toFixed(2),
   stats});
 }
}
module.exports=runs;
`;
const m = new Module(file, module);
m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
m._compile(fixture + tail, file);
const runs = m.exports;

// Difficulty may only change how well the car is driven, never what the car is.
const assert = require('node:assert/strict');
const byMap = {};
for (const run of runs) (byMap[run.map] ||= []).push(run);
const failures = [];
for (const [map, levels] of Object.entries(byMap)) {
  const base = levels[0].stats;
  for (const level of levels) {
    for (const key of ['maxSpeedBase', 'accel', 'handling', 'rubber']) {
      if (level.stats[key] !== base[key]) failures.push(`${map} diff ${level.difficulty}: ${key} differs between difficulties`);
    }
  }
  const pace = levels.map(l => l.meanLapSeconds);
  if (!(pace[0] >= pace[1] && pace[1] >= pace[2])) failures.push(`${map}: pace is not ordered by difficulty (${pace.join(' → ')})`);
  const recovery = levels.map(l => l.metresLostAfterSpin);
  if (recovery.some(v => v === null || !Number.isFinite(v))) failures.push(`${map}: recovery after a spin was not measurable`);
  else if (!(recovery[0] >= recovery[1] && recovery[1] >= recovery[2])) failures.push(`${map}: recovery is not ordered by difficulty (${recovery.join(' → ')})`);
}

const out = {
  method: 'Solo deterministic AI on the extended circuits at 120 Hz. Pace is a clean three-lap run; recovery is the ground still lost to an unperturbed twin eight seconds after an identical scripted spin. No items, powers, opponents or rendering. The random stream is a constant in this harness, so lapSpreadSeconds records standing-start variation within a run and is NOT a measure of consistency under noise; the full-field run in tools/p0-field-balance.cjs covers contested racing. Not a human benchmark and not device evidence.',
  cadence: { note: 'Difficulty-scaled decision timing, from the shipping code.', signaturePowerReview: [1.5, 1, 0.7], addonReview: [1.5, 1, 0.7], itemReaction: [1.6, 1, 0.7], opportunisticPowerIdleSeconds: [22, 14, 9], lineRecoveryGain: [0, 0.18, 0.36], postSpinThrottleHesitationSeconds: [1.1, 0.5, 0] },
  runs, failures
};
fs.writeFileSync(path.join(root, 'docs/p0-finalization/difficulty-curve.json'), JSON.stringify(out, null, 1) + '\n');
console.log('map         diff   mean lap   best lap   spread   metres lost');
for (const run of runs) {
  console.log(`${run.map.padEnd(11)} ${String(run.difficulty).padStart(4)} ${String(run.meanLapSeconds).padStart(10)} ${String(run.bestLapSeconds).padStart(10)} ${String(run.lapSpreadSeconds).padStart(8)} ${String(run.metresLostAfterSpin).padStart(13)}`);
}
if (failures.length) { console.error('\nFAIL'); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log('\nPASS difficulty changes pace and recovery only; speed, acceleration, handling and catch-up are identical at every level');
assert.equal(failures.length, 0);
