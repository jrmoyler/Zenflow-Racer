const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),THREE=require('../vendor/three.min.js');
const c={THREE,console,Math,MOBILEFX:false,TEX:{},world:new THREE.Group(),matchMedia:()=>({matches:false})};vm.createContext(c);const run=s=>vm.runInContext(s,c);
for(const file of ['audience-data.js','audience.js'])run(fs.readFileSync(file,'utf8'));
run('resetAudience();for(let i=0;i<24;i++)addAudienceSeat(new THREE.Matrix4(),i*1.1,1,0,1,0xcf6451,i);buildAudience()');
const state=run('AUDIENCE'),data=run('AUDIENCE_DATA');assert.equal(state.batches.length,12);assert.equal(state.seats.length,24);assert.deepEqual(Object.keys(data.clips),['wave','clap','watch']);assert.match(data.source,/Blender 4.5/);
for(const part of data.parts){assert.ok(part.positions.every(Number.isFinite));assert.equal(part.positions.length,part.normals.length);assert.equal(part.uv.length,part.positions.length/3*2);}
const matrices=()=>state.batches.map(m=>Array.from(m.instanceMatrix.array));const before=matrices();run('updateAudience(.1)');assert.notDeepEqual(matrices(),before,'cheering actually moves joint matrices');
const moving=matrices();run('updateAudience(0)');assert.deepEqual(matrices(),moving,'pause freezes all joints');run('updateAudience(NaN)');assert.deepEqual(matrices(),moving);
c.matchMedia=()=>({matches:true});run('updateAudience(.1)');assert.deepEqual(matrices(),moving,'reduced motion freezes audience');
for(const mesh of state.batches){assert.ok(mesh.instanceMatrix.array.every(Number.isFinite));assert.equal(mesh.count,24);assert.equal(mesh.material.metalness,0);assert.ok(mesh.material.roughness>=.7);}
// A forearm origin must equal its shoulder transform times its declared elbow pivot.
const elbow=data.parts.findIndex(p=>p.name==='forearm-hand--1'),parent=data.parts[elbow].parent,a=new THREE.Matrix4(),b=new THREE.Matrix4();state.batches[parent].getMatrixAt(0,a);state.batches[elbow].getMatrixAt(0,b);
const expected=new THREE.Vector3(...data.parts[elbow].pivot).applyMatrix4(a),actual=new THREE.Vector3().setFromMatrixPosition(b);assert.ok(expected.distanceTo(actual)<1e-5,'elbow remains attached during animation');
run('resetAudience()');assert.equal(run('AUDIENCE.seats.length'),0);assert.equal(run('AUDIENCE.batches.length'),0);
run('addAudienceSeat(new THREE.Matrix4(),0,.84,0,1,0xc96a55,3,true);buildAudience()');
const bounds=new THREE.Box3();for(const mesh of state.batches){const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix));}assert.ok(bounds.min.y>-.04&&bounds.max.y>1.6,'standing visitors remain grounded and upright');
console.log('PASS Blender audience: exported mesh channels, 12 batched parts, 3 moving clips, attached elbows, pause, reduced motion and lifecycle');
