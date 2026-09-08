/* Headless immersion layer: weather, heroes, rails and finite particle updates. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),THREE=require(path.join(root,'vendor/three.min.js'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const canvas=()=>({width:128,height:128,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData(){}})});
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xffffff,180,780);
const c={THREE,console,Math,document:{createElement:canvas},FALLBACK_GRAPHICS:true,MOBILEFX:false,LOWFX:false,
 TEX:{finish:new THREE.Texture(),roadDetail:null,roadRoughness:null,cliffColor:null,cliffHeight:null,barkColor:null,mossColor:null},
 zenWorldTime:{value:0},scene,sun:new THREE.DirectionalLight(),hemi:new THREE.HemisphereLight(),
 clamp:(v,a,b)=>v<a?a:v>b?b:v,lerp:(a,b,t)=>a+(b-a)*t,smooth:t=>t*t*(3-2*t),wrap01:v=>((v%1)+1)%1,
 game:{player:null,state:'roster'}};
vm.createContext(c);const run=code=>vm.runInContext(code,c);
run(read('core.js').slice(0,read('core.js').indexOf('function hexToRgb')));
run(read('surface-detail.js'));run(read('maps.js'));run(read('world.js').slice(read('world.js').indexOf('const CTRL=')));run(read('immersion.js'));
assert.equal(typeof c.buildImmersion,'function');assert.equal(typeof c.updateImmersion,'function');assert.equal(typeof c.createImmersionWater,'function');
const heroes=new Set();
for(const id of ['cherry','stormforge','canopy']){
  assert.equal(run(`selectMap('${id}')`),true,id+' builds');
  const world=run('world');
  const venue=world.getObjectByName('race-venue');
  assert.ok(venue,id+': authored race venue');
  assert.ok(venue.userData.stands>=3,id+': grandstands distributed around circuit');
  assert.ok(venue.userData.garages>=1,id+': open pit garage');
  assert.ok(venue.userData.spectators>=200,id+': populated spectator terraces');
  assert.ok(venue.userData.instanceBatches<=12,id+': infrastructure draw-call budget');
  const samples=run('track.pos');
  for(const placement of venue.userData.placements){
    const inv=new THREE.Matrix4().fromArray(placement.matrix).invert();
    for(let i=0;i<samples.length;i++){
      const p=samples[i].clone().applyMatrix4(inv);
      assert.ok(!(Math.abs(p.x)<placement.halfX+7&&Math.abs(p.z)<placement.halfZ+7&&p.y>-11&&p.y<placement.height+2),id+': building clears complete road envelope');
    }
  }
  venue.traverse(o=>{if(o.isInstancedMesh){const m=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite),'finite venue transform');}}});
  console.log('PASS race venue',id,JSON.stringify({...venue.userData,placements:undefined}));
  const weather=world.getObjectByName('immersion-weather');
  const hero=world.getObjectByName('immersion-hero');
  const rail=world.getObjectByName('immersion-rail');
  assert.ok(weather&&weather.isPoints,id+': weather field');
  assert.ok(hero,id+': signature landmark');
  assert.ok(rail,id+': pulsing rails');
  heroes.add(hero.children.length+':'+id);
  run('for(let i=0;i<24;i++)updateImmersion(1/60)');
  const pos=weather.geometry.attributes.position.array;
  assert.ok(Array.from(pos).every(Number.isFinite),id+': weather stays finite');
  console.log('PASS immersion',id,'hero parts',hero.children.length,'particles',pos.length/3);
}
assert.equal(heroes.size,3,'three distinct circuit heroes');
assert.equal(run("selectMap('cherry')"),true);
const before=run('world.children.length');
assert.equal(run("selectMap('stormforge')"),true);
assert.equal(run("selectMap('cherry')"),true);
assert.equal(run('world.children.length'),before,'returning to a map does not accumulate immersion');
console.log('PASS immersion layer: weather, heroes, rails, finite updates, map-switch disposal');

const venue=run('world').getObjectByName('race-venue'),ownedGeometries=new Set(),ownedMaterials=new Set();
venue.traverse(o=>{if(o.geometry)ownedGeometries.add(o.geometry);if(o.material)ownedMaterials.add(o.material);});
let geoDisposals=0,materialDisposals=0;
ownedGeometries.forEach(g=>g.addEventListener('dispose',()=>geoDisposals++));
ownedMaterials.forEach(m=>m.addEventListener('dispose',()=>materialDisposals++));
run("selectMap('canopy')");
assert.equal(geoDisposals,ownedGeometries.size,'venue shared geometries disposed exactly once');
assert.equal(materialDisposals,ownedMaterials.size,'venue shared materials disposed exactly once');
console.log('PASS race venue GPU resource disposal');

run('MOBILEFX=true');
for(const id of ['cherry','stormforge','canopy']){
  run(`selectMap('${id}')`);
  const mobileVenue=run('world').getObjectByName('race-venue');
  assert.ok(mobileVenue.userData.spectators>=250&&mobileVenue.userData.spectators<450,'mobile density retains lively crowd at reduced instance count');
  assert.equal(mobileVenue.userData.instanceBatches,10,'mobile venue batch budget');
}
console.log('PASS mobile venue density and batch budget');
