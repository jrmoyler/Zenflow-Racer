// Full-field physics/navigation regression. No renderer, pickups, items or power
// casts: this is NOT a human lap benchmark or physical-device certification.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),file=path.join(root,'tests/game-regression.cjs');
const fixture=fs.readFileSync(file,'utf8').split('const cases=[];')[0];
const tail=`
context.THREE=require('../vendor/three.min.js');context.smooth=t=>t*t*(3-2*t);
const worldText=readFileSync(path.join(__dirname,'../world.js'),'utf8');
for(const name of ['economy.js','progression.js','circuit-extensions.js','maps.js'])run(readFileSync(path.join(__dirname,'../'+name),'utf8'));
run(worldText.slice(worldText.indexOf('const CTRL='),worldText.indexOf('// ---------- Ribbon builder')));
run('saved=Economy.migrate({},[]);animateKart=()=>{};raceFX.step=()=>{};raceFX.onDriftTier=()=>{};raceFX.onWall=()=>{}');
const runs=[];
for(const map of run('MAPS'))for(const difficulty of [0,1,2]){
 context.map=map;context.difficulty=difficulty;let seed=7812+difficulty;context.rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 run("activeMap=map;constBase=map.control||CHERRY_CONTROL;rollBase=map.id==='cherry'?CHERRY_ROLL:[[0,0],[3,0],[4,-12],[6,0],[9,9],[12,0],[16,-8],[18,0],[20,0]];agBase=map.id==='cherry'?CHERRY_AG:[[0,0],[20,0]];CTRL.splice(0,CTRL.length,...extendedCircuitControls(map.id,constBase));ROLL_KEYS.splice(0,ROLL_KEYS.length,...extendedCircuitKeys(map.id,rollBase));AG_KEYS.splice(0,AG_KEYS.length,...extendedCircuitKeys(map.id,agBase));buildTrackFrames();");
 run("game.racers=[];game.diff=difficulty;game.state='race';game.raceTime=0;for(let i=0;i<12;i++){const racer=new Racer(ROSTER[(i+difficulty*4)%20],false,i);racer.specialAI=Infinity;game.racers.push(racer);}game.player=game.racers[0];for(let tick=0;tick<120*360&&game.racers.some(r=>!r.finished);tick++){game.raceTime+=1/120;for(const r of game.racers){if(r.finished)continue;stepAI(r,1/120);stepRacer(r,1/120);}stepWorld(1/120);}");
 const racers=run('game.racers.map(r=>({division:r.div.id,finished:r.finished,laps:r.lapTimes.slice(),time:r.finishTime,build:r.build,rubber:r.rubber,serviceLineMetres:r.serviceLineMetres}))');
 for(const r of racers){assert.equal(r.finished,true,map.id+' '+difficulty+' '+r.division+' completes');assert.equal(r.laps.length,3);assert.equal(r.rubber,1);assert.ok(r.build.every(k=>run('Object.keys(Economy.BUILDS)').includes(k)));assert.ok(r.laps.every(t=>Number.isFinite(t)&&t>0));}
 runs.push({map:map.id,difficulty,racers});console.log('PASS full field',map.id,difficulty,Math.max(...racers.map(r=>r.time)).toFixed(2)+'s last finisher');
}
require('node:fs').writeFileSync(path.join(__dirname,'../docs/p0-finalization/field-balance.json'),JSON.stringify({method:'Seeded 120Hz actual AI/physics/collisions; 12 legal builds, 3 laps; no pickups/items/power casts/rendering; not a human/device benchmark.',runs},null,2)+'\\n');
`;
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(fixture+tail,file);
