const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const THREE=require('../vendor/three.min.js'),read=p=>fs.readFileSync(p,'utf8');
const c={THREE,console,Math,FALLBACK_GRAPHICS:true,MOBILEFX:false,LOWFX:false,document:{createElement:()=>({getContext:()=>null})},TEX:{finish:new THREE.Texture()},zenWorldTime:{value:0},scene:new THREE.Scene(),hemi:new THREE.HemisphereLight(),sun:new THREE.DirectionalLight()};c.scene.fog=new THREE.Fog();vm.createContext(c);const run=s=>vm.runInContext(s,c);
run(read('core.js').slice(read('core.js').indexOf('const clamp='),read('core.js').indexOf('function hexToRgb')));
for(const f of ['maps.js','natural-stone-data.js','natural-world.js','audience-data.js','audience.js','immersion.js'])run(read(f));
run(read('world.js').slice(read('world.js').indexOf('const CTRL=')));
for(const mobile of [false,true]){
 c.MOBILEFX=mobile;
 for(const id of ['cherry','stormforge','canopy']){
 run(`selectMap('${id}')`);const world=run('world'),rocks=world.getObjectByName('blender-natural-stonework'),caps=[];
 if(id!=='cherry'){const districts=run('world.userData.circuitDistricts');assert.equal(districts.length,run('world.userData.islands.length'));assert.ok(districts.every(d=>d.type===(id==='canopy'?'terraced-orchard':'machine-yard')));}
 const crowd=world.getObjectByName('blender-animated-audience'),plants=world.getObjectByName('island-understory');assert.ok(crowd.userData.spectators>200);assert.equal(crowd.children.length,12);assert.equal(plants.children.length,3);assert.equal(plants.userData.instances,run('world.userData.islands.length')*(mobile?26:52));
 assert.equal(rocks.children.length,3,'three reusable Blender meshes');
 let sea=0;world.traverse(m=>{if(m.name==='immersion-sea')sea++;if(m.name==='continuous-island-cap')caps.push(m);if(m.geometry)assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));});assert.equal(sea,1,'one ocean per map');
 assert.equal(caps.length,run('world.userData.islands.length'));
 const cap=caps[0],island=run('world.userData.islands[0]'),seg=mobile?48:72,pos=cap.geometry.attributes.position;
 for(let k=0;k<=seg;k++){const a=k/seg*Math.PI*2,i=8*(seg+1)+k,r=run(`islandRimRadius(${island.r},${a},80)`);assert.ok(Math.abs(pos.getX(i)-Math.cos(a)*r)<.00001);assert.ok(Math.abs(pos.getZ(i)-Math.sin(a)*r*.83)<.00001);assert.ok(Math.abs(pos.getY(i))<.00001);}
 assert.ok(cap.geometry.attributes.normal.getY(seg+2)>.8,'cap faces upward');
 for(const mesh of rocks.children){assert.ok(mesh.isInstancedMesh);assert.equal(mesh.count,caps.length*(mobile?2:4));assert.equal(mesh.material.metalness,0);}
 const water=world.getObjectByName('immersion-sea').material;assert.equal(water.depthWrite,true);assert.equal(water.transparent,false);assert.equal(water.fog,true);assert.equal(water.uniforms.time,run('zenWorldTime'));assert.ok(water.uniforms.solarDirection.value.equals(run('SOLAR_DIRECTION')));
 console.log('PASS natural world',id,mobile?'mobile':'desktop',caps.length,'sealed terrain caps, three stone batches, one ocean');
 }
}
// Air-water Fresnel rises toward grazing incidence and retains nonzero head-on reflection.
const F=nv=>.0204+.9796*(1-nv)**5;assert.equal(F(1),.0204);assert.ok(F(.01)>.95);
