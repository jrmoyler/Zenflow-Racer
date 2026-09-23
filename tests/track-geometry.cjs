// Every shipping circuit (extended layout, as raced) keeps a drivable centre line: no
// corner tighter than 12 m, no road edge that runs backwards, and a continuous road frame.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),THREE=require('../vendor/three.min.js');
const c={THREE,lerp:(a,b,t)=>a+(b-a)*t,smooth:t=>t*t*(3-2*t),wrap01:v=>((v%1)+1)%1};vm.createContext(c);const run=s=>vm.runInContext(s,c);
run(fs.readFileSync('circuit-extensions.js','utf8'));run(fs.readFileSync('maps.js','utf8'));
const w=fs.readFileSync('world.js','utf8');run(w.slice(w.indexOf('const CTRL='),w.indexOf('// ---------- Ribbon builder')));
const report=[];
for(const map of run('MAPS')){
 c.map=map;
 run(`activeMap=map;{const base=map.control||CHERRY_CONTROL,adapt=keys=>extendedCircuitKeys(map.id,keys);
  CTRL.splice(0,CTRL.length,...extendedCircuitControls(map.id,base));
  ROLL_KEYS.splice(0,ROLL_KEYS.length,...adapt(map.id==='cherry'?CHERRY_ROLL:[[0,0],[3,0],[4,-12],[6,0],[9,9],[12,0],[16,-8],[18,0],[20,0]]));
  AG_KEYS.splice(0,AG_KEYS.length,...adapt(map.id==='cherry'?CHERRY_AG:[[0,0],[20,0]]));buildTrackFrames();}`);
 const r=run(`(()=>{const N=N_SAMP,ds=track.len/N,p=new THREE.Vector3(),q=new THREE.Vector3();let minR=Infinity,minU=0,back=0,backU=-1,upJump=0,upU=0;
  for(let i=0;i<N;i++){
   const k=track.tan[(i+3)%N].clone().sub(track.tan[(i+N-3)%N]).length()/(6*ds);if(1/k<minR){minR=1/k;minU=i/N;}
   for(const side of [-1,1]){trackPoint(i/N,side*TRACK_W/2,0,p);trackPoint((i+1)/N,side*TRACK_W/2,0,q);if(q.sub(p).dot(track.tan[i])<=0){back++;if(backU<0)backU=i/N;}}
   const a=Math.acos(Math.min(1,track.up[i].dot(track.up[(i+1)%N])))*180/Math.PI;if(a>upJump){upJump=a;upU=i/N;}
  }
  return {minR,minU,back,backU,upJump,upU};})()`);
 assert.ok(r.minR>=12,`${map.id}: centre-line radius ${r.minR.toFixed(1)} m at u=${r.minU.toFixed(3)} is under 12 m`);
 assert.equal(r.back,0,`${map.id}: road edge runs backwards at u=${r.backU.toFixed(3)}`);
 assert.ok(r.upJump<3,`${map.id}: road frame twists ${r.upJump.toFixed(2)} deg in one sample at u=${r.upU.toFixed(3)}`);
 // Pickups stay off hairpins and out of the anti-gravity transitions.
 const pickups=run(`(()=>{const p=map.pickups,bad=[];const check=(u0,span,what)=>{for(let d=-30;d<=span*track.len+30;d++){const u=u0+d/track.len,a=trackAG(u);if(Math.abs(trackCurv(u))>.06||a>.005&&a<.995){bad.push(what+' '+u0);return;}}};
  p.rows.forEach(u=>check(u,0,'item row'));p.arcs.forEach(u=>check(u,.0225,'token arc'));return {bad,rows:p.rows.length,arcs:p.arcs.length};})()`);
 assert.deepEqual(Array.from(pickups.bad),[],map.id+': pickups near a hairpin or anti-gravity transition');assert.equal(pickups.rows,6);assert.equal(pickups.arcs,6);
 report.push(`${map.id} minRadius ${r.minR.toFixed(1)}m upStep ${r.upJump.toFixed(2)}deg`);
}
console.log('PASS track geometry: '+report.join('; '));
