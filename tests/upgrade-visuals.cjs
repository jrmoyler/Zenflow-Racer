const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three.min.js'),Economy=require('../economy.js');
const c={THREE,Economy};vm.createContext(c);vm.runInContext(fs.readFileSync('progression.js','utf8'),c);
const paint=new THREE.MeshPhysicalMaterial({roughness:.2,clearcoat:1});paint.userData.surface='paint';
const make=()=>{const root=new THREE.Group(),body=new THREE.Group();root.add(body);body.add(new THREE.Mesh(new THREE.BoxGeometry(2,.5,3),paint));
const wheels=[-1,1,-1,1].map((side,i)=>{const pivot=new THREE.Group(),spin=new THREE.Group();pivot.add(spin);root.add(pivot);pivot.position.set(side,.5,i<2?-1:1);return {pivot,spin,side};});root.userData={body,wheels};return root;};
const a=make(),b=make(),categories=Object.keys(Economy.BUILDS);
for(const category of categories){const state=c.applyKartBuildVisuals(a,[category]);assert.ok(state.groups.length,category+' has visible hardware');assert.ok(state.groups.every(g=>g.children.some(n=>n.isMesh)),category+' has real geometry');}
const state=c.applyKartBuildVisuals(a,categories,'satin');assert.equal(new Set(state.groups.map(g=>g.userData.upgrade)).size,6);
assert.equal(a.userData.body.children[0].material.roughness,.65);assert.equal(b.userData.body.children[0].material.roughness,.2,'satin cannot leak across racers');
assert.equal(c.applyKartBuildVisuals(a,categories,'satin'),state,'repeated updates reuse hardware');assert.equal(a.userData.wheels[0].spin.scale.x,1.12,'tires never accumulate scale');
assert.ok(state.groups.reduce((n,g)=>n+g.children.length,0)<=30,'static geometry is batched');
const motor=state.animated.find(n=>n.type==='motor').node;c.animateKartBuildVisuals(a,1,{speed:10});assert.equal(motor.rotation.z,13,'motor animates');
let disposed=0;for(const geometry of state.geometry)geometry.addEventListener('dispose',()=>disposed++);const count=state.geometry.size;
c.applyKartBuildVisuals(a,[],'factory');assert.equal(disposed,count,'removed hardware geometry disposed');assert.equal(a.userData.wheels[0].spin.scale.x,1);assert.equal(a.userData.body.children[0].material,paint,'original paint restored');assert.ok(state.groups.every(g=>!g.parent),'all hardware detached');
c.clearKartBuildVisuals(a);assert.equal(a.userData.buildVisuals,undefined);
console.log('PASS all six hardware builds, animation, batching, reversible idempotence, isolated paint and resource disposal');
