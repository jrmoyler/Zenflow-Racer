#!/usr/bin/env node
// Export the runtime kart RIG (node hierarchy + local-space meshes + PBR material parameters)
// for every ROSTER division so Blender can rebuild it 1:1, author animation on the named
// nodes and hand keyframed clips back to kart-clips.js.
//
//   node tools/export-kart-rig.cjs [outDir=.tools/kart-rig] [division-id ...]
//
// The exporter is generic: it walks whatever hierarchy buildKart() currently produces, so it
// works with both the legacy single-group chassis and the animation rig contract
// ('body' > 'pilot' > 'torso'/'head'/'arm-l'/'arm-r', 'steering-wheel', 'exhaust-l/r',
// 'wheel-*' > 'spin', ...). Every transform and vertex is written in the node's LOCAL space.
//
// Coordinate convention: Three (x, y, z) -> Blender (x, -z, y). Positions, quaternions and
// vertices are emitted in Blender space ("space":"blender"); the original Three-space
// transform is kept alongside ("three") so the Blender side can self-check the round trip.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'.tools/kart-rig'));
const THREE=require(path.join(root,'vendor/three.min.js'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const toBlender=([x,y,z])=>[x,-z,y];
const quatToBlender=([x,y,z,w])=>[w,x,-z,y]; // Blender quaternions are (w,x,y,z); axis (x,y,z)->(x,-z,y)
const round=v=>Math.round(v*1e5)/1e5;
const r3=a=>a.map(round);

// Minimal browser-free context: kart-materials.js degrades to plain materials without a 2D
// canvas, and vehicles.js above the pickups marker only needs THREE + shared helpers.
const canvas=()=>({width:0,height:0,getContext:()=>null,toDataURL:()=>''});
const ctx=vm.createContext({THREE,console,TEX:{},FALLBACK_GRAPHICS:true,MOBILEFX:false,LOWFX:false,zenWorldTime:{value:0},
 document:{createElement:canvas},lerp:(a,b,t)=>a+(b-a)*t,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),wrap01:v=>((v%1)+1)%1,
 performance:{now:()=>0},window:{}});
vm.runInContext(read('kart-clips.js'),ctx);
const coreSource=read('core.js');vm.runInContext(coreSource.slice(0,coreSource.indexOf('function hexToRgb')),ctx);
vm.runInContext(read('kart-materials.js'),ctx);
const vehicles=read('vehicles.js');const marker='// ---------- Item / token pickups ----------';
vm.runInContext(vehicles.includes(marker)?vehicles.split(marker)[0]:vehicles,ctx);
vm.runInContext('kartGeos()',ctx);
const roster=vm.runInContext('ROSTER',ctx);
const hasAnimateKart=/function\s+animateKart\b/.test(vehicles)||/animateKart\s*=/.test(vehicles);
const hasSampleKartClip=/function\s+sampleKartClip\b/.test(vehicles)||/sampleKartClip\s*=/.test(vehicles);

fs.mkdirSync(out,{recursive:true});
const manifest={version:1,space:'blender',convention:'three (x,y,z) -> blender (x,-z,y)',generatedBy:'tools/export-kart-rig.cjs',
 rig:{animateKart:hasAnimateKart,sampleKartClip:hasSampleKartClip},karts:[]};
const material=m=>{if(!m)return null;const c=k=>m[k]?.isColor?r3(m[k].toArray()):undefined;
 return {type:m.type,color:c('color')||[1,1,1],emissive:c('emissive')||[0,0,0],emissiveIntensity:round(m.emissiveIntensity??0),
  metalness:round(m.metalness??0),roughness:round(m.roughness??.5),opacity:round(m.opacity??1),transparent:!!m.transparent,
  clearcoat:round(m.clearcoat??0),wireframe:!!m.wireframe};};
const selected=process.argv.slice(3);
for(const div of roster.filter(div=>!selected.length||selected.includes(div.id))){
 ctx.div=div;const kart=vm.runInContext('buildKart(div)',ctx);kart.updateMatrixWorld(true);
 const geometries={},nodes=[],ids=new Map();let triangles=0;
 kart.traverse(o=>{
  const id='n'+nodes.length;ids.set(o,id);
  const node={id,name:o.name||'',kind:o.isMesh?'mesh':'group',parent:o.parent&&ids.has(o.parent)?ids.get(o.parent):null,visible:o.visible,
   position:r3(toBlender(o.position.toArray())),quaternion:r3(quatToBlender(o.quaternion.toArray())),scale:r3([o.scale.x,o.scale.z,o.scale.y]),
   three:{position:r3(o.position.toArray()),quaternion:r3(o.quaternion.toArray()),scale:r3(o.scale.toArray()),rotation:r3(o.rotation.toArray().slice(0,3))}};
  if(o.isMesh){const g=o.geometry;const gid=g.uuid;
   if(!geometries[gid]){const p=g.attributes.position;const vertices=[];for(let i=0;i<p.count;i++)vertices.push(r3(toBlender([p.getX(i),p.getY(i),p.getZ(i)])));
    const index=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i);const faces=[];for(let i=0;i+2<index.length;i+=3)faces.push([index[i],index[i+1],index[i+2]]);
    geometries[gid]={type:g.type,vertices,faces};}
   triangles+=geometries[gid].faces.length;node.geometry=gid;node.material=material(Array.isArray(o.material)?o.material[0]:o.material);node.castShadow=!!o.castShadow;}
  nodes.push(node);
 });
 for(const [id,g] of Object.entries(geometries))for(const v of g.vertices)if(!v.every(Number.isFinite))throw new Error(div.id+': non-finite vertex in '+id);
 for(const n of nodes)if(![...n.position,...n.quaternion,...n.scale].every(Number.isFinite))throw new Error(div.id+': non-finite transform on '+n.name);
 const file=div.id+'.json';
 fs.writeFileSync(path.join(out,file),JSON.stringify({division:div.name,id:div.id,accent:div.acc,accent2:div.acc2,base:div.base,root:nodes[0].id,nodes,geometries}));
 manifest.karts.push({id:div.id,name:div.name,file,nodes:nodes.length,meshes:nodes.filter(n=>n.kind==='mesh').length,triangles,
  named:[...new Set(nodes.map(n=>n.name).filter(Boolean))]});
 ctx.exportedKart=kart;vm.runInContext('disposeKart(exportedKart)',ctx);
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,1));
console.table(manifest.karts.map(({id,nodes,meshes,triangles})=>({id,nodes,meshes,triangles})));
console.log('rig contract in vehicles.js: animateKart='+hasAnimateKart+' sampleKartClip='+hasSampleKartClip);
console.log('wrote '+out);
