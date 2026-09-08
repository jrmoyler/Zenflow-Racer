// Kart livery/material contract tests with the actual bundled Three.js: stub-canvas degradation,
// procedural map generation through a recording fake 2D canvas, TEX caching, and disposal safety.
module.exports=function registerKartMaterialTests({test,assert}){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const THREE=require('../vendor/three.min.js'),root=path.resolve(__dirname,'..');
 const read=f=>fs.readFileSync(path.join(root,f),'utf8');
 const coreSource=read('core.js'),materialSource=read('kart-materials.js'),vehicleSource=read('vehicles.js');
 const roster=vm.runInNewContext(coreSource.match(/const ROSTER = (\[[\s\S]*?\n\]);/)[1]);
 const KEYS=['white','dark','panel','glow','skin','metal','tyre','color','light'];
 // Same stub the headless runtime gate uses: a canvas whose context cannot draw.
 const stubDocument=()=>{const doc={created:0,createElement:()=>{doc.created++;return {width:128,height:128,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};}};return doc;};
 // Minimal fake 2D canvas: records draw calls, returns plausible pixel data.
 function fakeDocument(){
  const doc={canvases:[],texts:[]};
  doc.createElement=tag=>{assert.equal(tag,'canvas');const canvas={width:0,height:0};const noop=()=>{};
   const ctx={canvas,globalAlpha:1,fillStyle:'#000',strokeStyle:'#000',lineWidth:1,font:'',textAlign:'',textBaseline:'',lineCap:'',lineJoin:'',
    fillRect:noop,strokeRect:noop,fillText:(t)=>doc.texts.push(String(t)),strokeText:noop,measureText:t=>({width:String(t).length*6}),
    getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(128)}),putImageData:noop,createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
    beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,fill:noop,stroke:noop,arc:noop,ellipse:noop,rect:noop,clip:noop,quadraticCurveTo:noop,
    save:noop,restore:noop,translate:noop,rotate:noop,scale:noop,setTransform:noop,drawImage:noop,
    createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),createPattern:()=>({})};
   canvas.getContext=()=>ctx;doc.canvases.push(canvas);return canvas;};
  return doc;
 }
 function fixture({document,mobile=false,core=true,vehicles=false}={}){
  const c={THREE,console,MOBILEFX:mobile,LOWFX:false,lerp:(a,b,t)=>a+(b-a)*t,TEX:{}};if(document)c.document=document;
  vm.createContext(c);if(core)vm.runInContext(coreSource,c);vm.runInContext(materialSource,c);
  if(vehicles){vm.runInContext(read('kart-clips.js'),c);vm.runInContext(vehicleSource.slice(0,vehicleSource.indexOf('// ---------- Item / token pickups')),c);vm.runInContext('kartGeos()',c);}
  const run=s=>vm.runInContext(s,c);const materials=div=>{c.div=div;return run('kartMaterials(div)');};
  return {c,run,materials,TEX:run('TEX')};
 }
 const materialTextures=m=>Object.values(m).filter(v=>v&&v.isTexture);
 test('Stub canvas contexts yield plain materials for all twelve divisions without retrying textures',()=>{
  for(const document of [stubDocument(),undefined]){
   const f=fixture({document,core:!!document});
   for(const div of roster){
    const a=f.materials(div),b=f.materials(div);
    for(const key of KEYS)assert.ok(a[key],`${div.id} exposes ${key}`);
    assert.ok(a.white.isMaterial&&a.dark.isMaterial&&a.tyre.isMaterial&&a.color.isColor&&a.light.isColor);
    assert.notEqual(a.tyre,a.white,'tyre is its own rubber material');assert.equal(a.tyre.map,null);assert.equal(a.white.map,null);
    assert.ok(a.tyre.color.getHex()<0x303030,'untextured tyre is rubber black');assert.ok(a.tyre.roughness>=.8);assert.equal(a.tyre.metalness,0);
    for(const key of ['white','dark','panel','glow','skin','metal','tyre'])assert.notEqual(a[key],b[key],'fresh material instances per call');
   }
   assert.ok(Object.keys(f.TEX).some(k=>k.startsWith('kart-')),'failed textures are cached as null');
   assert.ok(Object.keys(f.TEX).filter(k=>k.startsWith('kart-')).every(k=>f.TEX[k]===null));
   if(document){const before=document.created;f.materials(roster[0]);assert.equal(document.created,before,'no canvas retried once a texture failed');}
  }
 });
 test('Fake 2D canvas produces livery, carbon, tyre and detail maps shared through TEX',()=>{
  const document=fakeDocument(),f=fixture({document});
  const first=f.materials(roster[0]),second=f.materials(roster[0]);
  for(const key of ['map','normalMap','roughnessMap'])assert.ok(first.white[key]?.isTexture,'white.'+key);
  assert.ok(first.dark.map?.isTexture&&first.dark.normalMap?.isTexture,'carbon colour + normal');
  assert.ok(first.tyre.map?.isTexture&&first.tyre.normalMap?.isTexture,'tyre colour + normal');
  assert.ok(first.metal.map?.isTexture&&first.metal.roughnessMap?.isTexture,'brushed metal colour + roughness');
  assert.ok(first.panel.map?.isTexture&&first.panel.emissiveMap?.isTexture,'panel pattern + emissive');
  assert.ok(first.glow.emissiveMap?.isTexture,'effect glow emissive map');
  assert.ok(first.skin.roughness>=.7&&first.skin.metalness<.05&&!first.skin.emissiveMap,'race suit is matte woven fabric, not glowing metal');
  assert.equal(first.white.map.encoding,THREE.sRGBEncoding);assert.equal(first.white.normalMap.encoding,THREE.LinearEncoding);assert.equal(first.white.roughnessMap.encoding,THREE.LinearEncoding);
  assert.equal(first.white.map.anisotropy,8);assert.equal(first.white.map.wrapS,THREE.RepeatWrapping);
  assert.equal(first.tyre.color.getHex(),0xffffff,'textured tyre lets the rubber map carry its colour');
  for(const key of ['white','dark','panel','glow','skin','metal','tyre']){assert.notEqual(first[key],second[key]);
   for(const slot of ['map','normalMap','roughnessMap','emissiveMap'])if(first[key][slot])assert.equal(first[key][slot],second[key][slot],`${key}.${slot} reused from TEX`);}
  const textures=materialTextures(first.white).concat(materialTextures(first.dark),materialTextures(first.tyre),materialTextures(first.glow));
  const shared=new Set(Object.values(f.TEX));for(const t of textures)assert.ok(shared.has(t),'every kart texture lives in TEX');
  assert.equal(f.TEX['kart-zenflow-livery'],first.white.map);assert.equal(f.TEX['kart-zenflow-tyre'],first.tyre.map);assert.equal(f.TEX['kart-carbon'],first.dark.map);
  assert.ok(document.canvases.every(c=>c.width<=512&&c.height<=512),'desktop canvases stay within 512px');
  assert.ok(document.texts.includes('01')&&document.texts.includes('ZF-01')&&document.texts.includes('ZENFLOW RACER'),'livery carries racing number, code and sponsor text');
  const created=document.canvases.length;f.materials(roster[0]);assert.equal(document.canvases.length,created,'repeat calls draw nothing new');
 });
 test('Twelve divisions get twelve distinct livery and tyre textures at a shared detail set',()=>{
  const document=fakeDocument(),f=fixture({document});
  const sets=roster.map(div=>f.materials(div));
  assert.equal(new Set(sets.map(m=>m.white.map)).size,12,'distinct livery colour maps');
  assert.equal(new Set(sets.map(m=>m.white.normalMap)).size,12);assert.equal(new Set(sets.map(m=>m.tyre.map)).size,12,'distinct sidewall lettering');
  assert.equal(new Set(sets.map(m=>m.dark.map)).size,1,'carbon weave is shared');assert.equal(new Set(sets.map(m=>m.tyre.normalMap)).size,1,'tread relief is shared');
  assert.equal(new Set(sets.map(m=>m.metal.map)).size,1);assert.equal(new Set(sets.map(m=>m.glow.emissiveMap)).size,1);
  assert.ok(document.texts.includes('12')&&document.texts.includes('VH-01'),'last roster entry is numbered 12');
  assert.equal(Object.keys(f.TEX).filter(k=>k.startsWith('kart-')).length,12*4+9,'one cached texture per division map plus shared tiles');
  const mobile=fixture({document:fakeDocument(),mobile:true});mobile.materials(roster[3]);
  assert.ok(mobile.c.document.canvases.every(c=>c.width<=256&&c.height<=256),'mobile canvases stay within 256px');
  assert.equal(mobile.TEX['kart-nexus-livery'].anisotropy,4);
 });
 test('Kart disposal releases materials but never the shared livery textures',()=>{
  const f=fixture({document:fakeDocument(),vehicles:true});
  const div=roster.find(d=>d.id==='juris');f.c.div=div;const kart=f.run('buildKart(div)');
  const materials=new Set(),textures=new Set();kart.traverse(o=>{if(o.material){materials.add(o.material);for(const t of materialTextures(o.material))textures.add(t);}});
  assert.ok(textures.size>=8,'built kart references procedural maps');let textureDisposals=0,materialDisposals=0;
  for(const t of textures)t.addEventListener('dispose',()=>textureDisposals++);for(const m of materials)m.addEventListener('dispose',()=>materialDisposals++);
  f.c.kart=kart;f.run('disposeKart(kart)');
  assert.equal(materialDisposals,materials.size,'materials released once');assert.equal(textureDisposals,0,'TEX-cached textures survive kart disposal');
  const again=f.materials(div);assert.equal(again.white.map,f.TEX['kart-juris-livery'],'next race reuses the cached livery');
 });
};
