const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const THREE=require('../vendor/three.min.js');
const scene=new THREE.Scene(),racers=[3,1,2].map(rank=>({rank,div:{id:String(rank),acc:'#8beeff'},mesh:new THREE.Group(),finishTime:100+rank}));
racers.forEach(r=>{r.mesh.position.set(r.rank,2,3);scene.add(r.mesh);});
let reduced=false,disposed=0,animated=0;
const c={THREE,scene,game:{state:'results',racers},camera:new THREE.PerspectiveCamera(),sun:new THREE.DirectionalLight(),innerWidth:1400,innerHeight:900,
 document:{createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})},matchMedia:()=>({matches:reduced}),raceOrder:(a,b)=>a.rank-b.rank,
 orientOnTrack:o=>o.position.set(20,4,0),buildKart:d=>{const k=new THREE.Group();k.name=d.id;return k;},disposeKart:k=>{disposed++;k.parent?.remove(k);},animateShowroomKart:()=>animated++,updateMapScenery(){}};
vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../title-attract.js'),'utf8'),c);
const run=s=>vm.runInContext(s,c),before=racers.map(r=>r.mesh.position.toArray());
assert.equal(run('tickFinishCeremony(.016)'),true);
assert.equal(run('finishCeremony.karts.map(k=>k.name).join()'),'1,2,3');
assert.deepEqual(racers.map(r=>r.mesh.position.toArray()),before,'ceremony preserves racing transforms');
assert.ok(racers.every(r=>!r.mesh.visible));assert.equal(scene.children.length,4);
for(const [w,h] of [[390,844],[844,390],[1400,900]]){c.innerWidth=w;c.innerHeight=h;c.camera.aspect=w/h;run('tickFinishCeremony(.016)');assert.ok(c.camera.position.toArray().every(Number.isFinite));assert.ok(c.camera.quaternion.toArray().every(Number.isFinite));c.camera.updateMatrixWorld();if(w>=900){const center=run('finishCeremony.root').localToWorld(new THREE.Vector3(0,1.5,0)).project(c.camera);assert.ok(center.x<-.25,'podium is left of the desktop standings');}}
reduced=true;const time=run('finishCeremony.time');run('tickFinishCeremony(1)');assert.equal(run('finishCeremony.time'),time);
let releases=0;run('finishCeremony.root').traverse(o=>{o.geometry?.addEventListener('dispose',()=>releases++);o.material?.addEventListener('dispose',()=>releases++);o.material?.map?.addEventListener('dispose',()=>releases++);});
c.game.state='roster';assert.equal(run('tickFinishCeremony(.016)'),false);assert.equal(disposed,3);assert.equal(releases,21);assert.equal(scene.children.length,3);assert.ok(racers.every(r=>r.mesh.visible));
run('clearFinishCeremony()');assert.equal(disposed,3,'cleanup is idempotent');
c.game.state='results';run('tickFinishCeremony(0)');assert.equal(scene.children.length,4);run('clearFinishCeremony()');assert.equal(scene.children.length,3);
console.log('PASS finish ceremony: ranked independent karts, finite responsive cameras, reduced motion, exact resource cleanup and replay');
