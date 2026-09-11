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
// Exercise the actual vehicle animation/disposal entrypoints, not only the helper.
Object.assign(c,{TEX:{},MOBILEFX:false,LOWFX:false,FALLBACK_GRAPHICS:true,window:{},document:{createElement:()=>({getContext:()=>null})},orientOnTrack(){}});
for(const file of ['core.js','kart-clips.js','kart-materials.js','vehicles.js']){
 let source=fs.readFileSync(file,'utf8');if(file==='core.js')source=source.split('function hexToRgb')[0];if(file==='vehicles.js')source=source.split('// ---------- Item / token pickups ----------')[0];vm.runInContext(source,c);
}
vm.runInContext('kartGeos();globalThis.integrationKart=buildKart(ROSTER[0])',c);
const live=c.integrationKart,liveState=c.applyKartBuildVisuals(live,['Motor'],'satin'),liveMotor=liveState.animated.find(n=>n.type==='motor').node;
c.animateShowroomKart(live,2,1/60);assert.equal(liveMotor.rotation.z,6,'showroom entrypoint animates equipped motor');
const racer={mesh:live,speed:10,wheelRot:0,visualYaw:0,steer:0,theta:0,hop:0,u:0,lat:0,drifting:false,spin:0,wheelspin:0,boost:0,brake:false,finished:false,hitCd:0,shield:0};
c.animateKart(racer,1/60);assert.equal(liveMotor.rotation.z,live.userData.anim.t*13,'race entrypoint animates equipped motor at race speed');
const disposalCounts=new Map();for(const resource of [...liveState.geometry,...liveState.materials]){disposalCounts.set(resource,0);resource.addEventListener('dispose',()=>disposalCounts.set(resource,disposalCounts.get(resource)+1));}
c.disposeKart(live);assert.ok([...disposalCounts.values()].every(n=>n===1),'kart disposal clears upgrade geometry and material copies exactly once');assert.equal(live.userData.buildVisuals,undefined);
console.log('PASS real showroom/race upgrade animation hooks and one-time disposal');
