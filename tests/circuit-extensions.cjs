const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),THREE=require('../vendor/three.min.js');
const c={THREE};vm.createContext(c);const run=s=>vm.runInContext(s,c);
run(fs.readFileSync('circuit-extensions.js','utf8'));run(fs.readFileSync('maps.js','utf8'));
const w=fs.readFileSync('world.js','utf8');run(w.slice(w.indexOf('const CTRL='),w.indexOf('const TRACK_W')));
const curve=points=>{const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),true,'centripetal',.5);c.arcLengthDivisions=4000;return c;};
const report=[];
for(const map of run('MAPS')){
 const base=map.control||run('CHERRY_CONTROL'),after=run(`extendedCircuitControls('${map.id}',${JSON.stringify(base)})`),a=curve(base),b=curve(after);
 const beforeLength=a.getLength(),afterLength=b.getLength();
 assert.deepEqual(Array.from(after[0]),Array.from(base[0]));assert.ok(afterLength>beforeLength+600);
 // Reject close nonadjacent road centers (the new sections have no crossover).
 const n=500;let clearance=Infinity;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const separation=Math.min(j-i,n-j+i)*afterLength/n;if(separation<35)continue;clearance=Math.min(clearance,b.getPointAt(i/n).distanceTo(b.getPointAt(j/n)));}
 assert.ok(clearance>14,map.id+' nonadjacent track clearance '+clearance);
 report.push({map:map.id,beforeMetres:beforeLength,afterMetres:afterLength,addedMetres:afterLength-beforeLength,referenceSpeed:47,geometricSeconds:(afterLength-beforeLength)/47,minCenterClearance:clearance,humanLapSeconds:null,aiLapSeconds:null,certified:false});
}
console.log(JSON.stringify(report,null,2));fs.writeFileSync('docs/p0-finalization/track-estimates.json',JSON.stringify({method:'Arc length / 47m/s. Geometry estimate only; not a human timing certification.',circuits:report},null,2)+'\n');
