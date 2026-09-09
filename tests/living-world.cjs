/* Execute Blender exports, real Anime.js envelopes and all map scenery with Three r128. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const THREE=require('../vendor/three.min.js'),anime=require('../vendor/anime.umd.min.js');
const read=p=>fs.readFileSync(p,'utf8');
const c={THREE,anime,console,Math,FALLBACK_GRAPHICS:true,MOBILEFX:false,LOWFX:false,matchMedia:()=>({matches:false}),document:{createElement:()=>({getContext:()=>null})},TEX:{finish:new THREE.Texture()},zenWorldTime:{value:0},scene:new THREE.Scene(),hemi:new THREE.HemisphereLight(),sun:new THREE.DirectionalLight()};c.scene.fog=new THREE.Fog();vm.createContext(c);const run=s=>vm.runInContext(s,c);
run(read('core.js').slice(read('core.js').indexOf('const clamp='),read('core.js').indexOf('function hexToRgb')));
for(const f of ['maps.js','world-motion-data.js','living-world.js'])run(read(f));
run(read('world.js').slice(read('world.js').indexOf('const CTRL=')));
assert.match(run('WORLD_MOTION_DATA.source'),/Blender 4.5/);
assert.equal(run('WORLD_MOTION_DATA.hinge[0]'),run('WORLD_MOTION_DATA.hinge.at(-1)'));
let oldTimeline;
for(const id of ['cherry','stormforge','canopy']){
 run(`selectMap('${id}')`);const s=run('LIVING_WORLD');
 assert.ok(s.rigs.length>=10,id+' near and distant island rigs');assert.ok(s.leaves.length>0,id+' foliage deforms');
 assert.ok(s.timeline,'real Anime.js timeline created');if(oldTimeline)assert.notEqual(oldTimeline,s.timeline);
 oldTimeline=s.timeline;
 const rig=s.rigs[0],base=rig.base.slice(),leaf=s.leaves[0],leafBase=leaf.base.slice();
 run('for(let i=0;i<120;i++)updateLivingWorld(1/60)');
 assert.ok(s.gust.value>0,'Anime.js advances on simulation time');
 assert.notDeepEqual(Array.from(rig.flag.geometry.attributes.position.array),Array.from(base),'fabric deforms');
 assert.notDeepEqual(Array.from(leaf.g.attributes.position.array),Array.from(leafBase),'foliage deforms');
 for(let i=0;i<base.length;i+=3)if(base[i]===0)assert.equal(rig.flag.geometry.attributes.position.array[i+2],base[i+2],'mast seam stays fixed');
 const before=rig.hinge.rotation.z,time=s.time;run('updateLivingWorld(0);updateLivingWorld(NaN)');assert.equal(s.time,time);assert.equal(rig.hinge.rotation.z,before);
 run('world.updateMatrixWorld(true)');run('world').traverse(m=>{assert.ok(m.matrixWorld.elements.every(Number.isFinite));if(m.geometry)assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));});
 assert.ok(Math.abs(run('SOLAR_DIRECTION.length()')-1)<1e-6);
 console.log('PASS',id,s.rigs.length,'anchored rigs;',s.leaves.length,'shared foliage geometries');
}
run('LIVING_WORLD.timeline.cancel()');
