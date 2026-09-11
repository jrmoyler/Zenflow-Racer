// Deterministic, single-kart simulation. Uses actual physics/AI; no rendering,
// opponents, pickups or ability casts. Not a competent-human timing substitute.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),file=path.join(root,'tests/game-regression.cjs');
const fixture=fs.readFileSync(file,'utf8').split('const cases=[];')[0];
const tail=`
context.THREE=require('../vendor/three.min.js');context.smooth=t=>t*t*(3-2*t);
const worldText=readFileSync(path.join(__dirname,'../world.js'),'utf8');
run(readFileSync(path.join(__dirname,'../circuit-extensions.js'),'utf8'));
run(readFileSync(path.join(__dirname,'../maps.js'),'utf8'));
run(worldText.slice(worldText.indexOf('const CTRL='),worldText.indexOf('// ---------- Ribbon builder')));
run('animateKart=()=>{};raceFX.step=()=>{};raceFX.onDriftTier=()=>{};raceFX.onWall=()=>{}');
const result=[];
for(const map of run('MAPS'))for(const extended of [false,true]){
 context.map=map;context.extended=extended;
 run(\"activeMap=map;constBase=map.control||CHERRY_CONTROL;rollBase=map.id==='cherry'?CHERRY_ROLL:[[0,0],[3,0],[4,-12],[6,0],[9,9],[12,0],[16,-8],[18,0],[20,0]];agBase=map.id==='cherry'?CHERRY_AG:[[0,0],[20,0]]\");
 run(\"CTRL.splice(0,CTRL.length,...(extended?extendedCircuitControls(map.id,constBase):constBase));ROLL_KEYS.splice(0,ROLL_KEYS.length,...(extended?extendedCircuitKeys(map.id,rollBase):rollBase));AG_KEYS.splice(0,AG_KEYS.length,...(extended?extendedCircuitKeys(map.id,agBase):agBase));buildTrackFrames();\");
 run(\"globalThis.r=new Racer(ROSTER[0],false,0);r.specialAI=Infinity;game.racers=[r];game.player=r;game.diff=1;game.state='race';game.raceTime=0;r.u=0;r.distance=0;for(let tick=0;tick<120*400&&!r.finished;tick++){game.raceTime+=1/120;stepAI(r,1/120);stepRacer(r,1/120);}\");
 const times=run('r.lapTimes');assert.equal(times.length,3,map.id+' three completed laps');result.push({map:map.id,extended,lapSeconds:Array.from(times),meanLapSeconds:times.reduce((a,b)=>a+b,0)/3});
}
require('node:fs').writeFileSync(path.join(__dirname,'../docs/p0-finalization/ai-timing.json'),JSON.stringify({method:'Deterministic ZenFlow / Standard / solo / no items / authored banking and anti-gravity; actual stepAI and stepRacer, 120Hz. Not physical-device or human evidence.',runs:result},null,2)+'\\n');console.log(JSON.stringify(result,null,2));
`;
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(fixture+tail,file);
