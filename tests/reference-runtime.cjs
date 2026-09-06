/* Headless geometry/resource gate: executes the authored runtime with real Three r128.
   No pixel-match claim: browser shader compilation and image review remain separate. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),THREE=require(path.join(root,'vendor/three.min.js'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const core=read('core.js'),worldSource=read('world.js'),vehicleSource=read('vehicles.js'),materialSource=read('kart-materials.js');
const canvas=()=>({width:128,height:128,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})});
function geometryCheck(group){
 const hash=crypto.createHash('sha256'),bounds=new THREE.Box3(),geos=new Set();let meshes=0;
 group.updateMatrixWorld(true);
 group.traverseVisible(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite),'finite world transform');if(!o.isMesh)return;meshes++;
 const g=o.geometry;assert.ok(g?.attributes.position?.count>0,'nonempty geometry');
 if(!geos.has(g)){geos.add(g);for(const attr of Object.values(g.attributes)){assert.ok(attr.array.every(Number.isFinite),'finite vertex attribute');hash.update(Buffer.from(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength));}if(g.index){assert.ok(g.index.array.every(i=>i<g.attributes.position.count),'valid indices');hash.update(Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength));}}
 g.computeBoundingBox();if(o.isInstancedMesh){const mat=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,mat);assert.ok(mat.elements.every(Number.isFinite),'finite instance transform');bounds.union(g.boundingBox.clone().applyMatrix4(mat).applyMatrix4(o.matrixWorld));}}else bounds.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld));
 });assert.ok(meshes>0);assert.ok(bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite));return {hash:hash.digest('hex'),bounds:bounds.getSize(new THREE.Vector3()),meshes};
}
for(const mobile of [false,true]){
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xffffff,180,780);
 const c={THREE,console,document:{createElement:canvas},FALLBACK_GRAPHICS:true,MOBILEFX:mobile,LOWFX:false,TEX:{finish:new THREE.Texture()},zenWorldTime:{value:0},scene,sun:new THREE.DirectionalLight(),hemi:new THREE.HemisphereLight()};
 vm.createContext(c);const run=code=>vm.runInContext(code,c);
 run(core.slice(0,core.indexOf('function hexToRgb')));run(read('maps.js'));run(worldSource.slice(worldSource.indexOf('const CTRL=')));
 const counts={},signatures=new Set();let priorSceneCount;
 for(const id of ['cherry','stormforge','canopy','cherry']){
  let geometryDisposals=0,materialDisposals=0,textureDisposals=0,ownedGeos=new Set(),ownedMats=new Set(),ownedTextures=new Set();
  const previous=run('world');previous.traverse(o=>{if(o.geometry)ownedGeos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ownedMats.add(m));});
  for(const m of ownedMats)if(m.userData?.mapTexture)ownedTextures.add(m.userData.mapTexture);for(const t of ownedTextures)t.addEventListener('dispose',()=>textureDisposals++);
  for(const g of ownedGeos)g.addEventListener('dispose',()=>geometryDisposals++);for(const m of ownedMats)m.addEventListener('dispose',()=>materialDisposals++);
  assert.equal(run(`selectMap('${id}')`),true);
  assert.equal(geometryDisposals,ownedGeos.size,'map switch releases old geometry once');assert.equal(materialDisposals,ownedMats.size,'map switch releases old material once');assert.equal(textureDisposals,ownedTextures.size,'cloud textures released exactly once');
  const track=run('track'),n=run('N_SAMP');assert.ok(track.len>500&&track.len<5000,'usable circuit length');
  for(const key of ['pos','tan','up','right']){assert.equal(track[key].length,n+1,'map samples reset');for(const v of track[key])assert.ok(v.toArray().every(Number.isFinite),key+' finite');assert.ok(track[key][0].distanceTo(track[key][n])<1e-5,key+' seam closure');}
  for(let i=0;i<=n;i+=17){for(const key of ['tan','up','right'])assert.ok(Math.abs(track[key][i].length()-1)<1e-5,key+' normalized');assert.ok(Math.abs(track.tan[i].dot(track.up[i]))<1e-5,'orthogonal road frame');}
  for(const key of ['curv','ag','roll','u']){assert.equal(track[key].length,n+1);assert.ok(track[key].every(Number.isFinite));}
  const check=geometryCheck(run('world'));signatures.add(check.hash);const count=run('world.children.length');if(counts[id])assert.equal(count,counts[id],'returning to map does not accumulate scenery');counts[id]=count;
  if(priorSceneCount!==undefined)assert.equal(scene.children.length,priorSceneCount,'scene root count stable');priorSceneCount=scene.children.length;
  assert.equal(run(`selectMap('${id}')`),false,'selecting active circuit is idempotent');
  console.log(`PASS ${mobile?'mobile':'desktop'} ${id}: ${check.meshes} meshes, ${Math.round(track.len)}m closed circuit`);
 }
 assert.equal(signatures.size,3,'three distinct modeled circuits');assert.throws(()=>run("selectMap('missing')"),/Unknown circuit/);
 if(!mobile){
  run(materialSource);run(vehicleSource.slice(0,vehicleSource.indexOf('// ---------- Item / token pickups')));run('kartGeos()');const roster=run('ROSTER');assert.equal(roster.length,12);const hashes=new Set(),sizes=new Set();
  for(const div of roster){c.div=div;const kart=run('buildKart(div)'),check=geometryCheck(kart);hashes.add(check.hash);sizes.add(check.bounds.toArray().map(v=>v.toFixed(3)).join(','));
   assert.ok(check.bounds.x>2&&check.bounds.x<12&&check.bounds.y>1&&check.bounds.y<8&&check.bounds.z>2&&check.bounds.z<12,'playable chassis bounds');assert.equal(kart.userData.wheels.length,4);
   const corners=new Set();for(const w of kart.userData.wheels){assert.equal(w.pivot.parent,kart);assert.equal(w.spin.parent,w.pivot);assert.ok(w.spin.children.length>=2);assert.ok(w.glow.isMesh);corners.add(`${Math.sign(w.pivot.position.x)},${Math.sign(w.pivot.position.z)}`);}assert.equal(corners.size,4,'one wheel per corner');assert.ok(kart.userData.pilot.parent===kart);
   let sharedDisposals=0;const shared=Object.values(run('KART_GEO'));const onSharedDispose=()=>sharedDisposals++;for(const g of shared)g.addEventListener('dispose',onSharedDispose);c.kart=kart;run('disposeKart(kart)');assert.equal(sharedDisposals,0,'kart disposal preserves cached geometry');for(const g of shared)g.removeEventListener('dispose',onSharedDispose);console.log(`PASS kart ${div.id}: ${check.meshes} meshes; ${check.bounds.toArray().map(v=>v.toFixed(2)).join(' × ')}`);
  }
  assert.equal(hashes.size,12,'all divisions have different actual geometry');assert.ok(sizes.size>=6,'division silhouettes have materially distinct bounds');
 }
}
// Resolve actual UI art and script dependencies against the source or built release.
const base=fs.existsSync(path.join(root,'dist/index.html'))?path.join(root,'dist'):root;
const index=fs.readFileSync(path.join(base,'index.html'),'utf8');
const resources=[...index.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(x=>!/^https?:|^#|^data:/.test(x));
for(const resource of resources)assert.ok(fs.statSync(path.join(base,resource.split('?')[0])).size>0,'nonempty UI resource '+resource);
const scripts=[...index.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);
for(const [a,b] of [['maps.js','world.js'],['core.js','kart-materials.js'],['kart-materials.js','vehicles.js'],['world.js','vehicles.js'],['vehicles.js','item-art.js'],['item-art.js','game.js']])assert.ok(scripts.includes(a)&&scripts.includes(b)&&scripts.indexOf(a)<scripts.indexOf(b),'runtime dependency '+a+' before '+b);
const css=fs.readFileSync(path.join(base,'polish.css'),'utf8');for(const match of css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)){if(!/^(?:data:|https?:)/.test(match[1]))assert.ok(fs.statSync(path.join(base,match[1])).size>0,'CSS artwork '+match[1]);}
console.log('PASS UI resource resolution and runtime script order');
