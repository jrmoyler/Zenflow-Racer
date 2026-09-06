// Export the exact game geometry for Blender review, not a second approximation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'.tools/kart-meshes'));
const THREE=require(path.join(root,'vendor/three.min.js'));
const ctx=vm.createContext({THREE,console,TEX:{},lerp:(a,b,t)=>a+(b-a)*t});
const source=fs.readFileSync(path.join(root,'vehicles.js'),'utf8').split('// ---------- Item / token pickups ----------')[0];
vm.runInContext(source+'\nkartGeos();',ctx);
const roster=vm.runInNewContext(fs.readFileSync(path.join(root,'core.js'),'utf8').match(/const ROSTER = (\[[\s\S]*?\n\]);/)[1]);
fs.mkdirSync(out,{recursive:true});const stats=[];
for(const div of roster){
 ctx.div=div;const kart=vm.runInContext('buildKart(div)',ctx);kart.updateMatrixWorld(true);const meshes=[];let triangles=0;
 kart.traverse(o=>{if(!o.isMesh||!o.visible||o.name==='aegis-shield')return;const g=o.geometry,p=g.attributes.position;const verts=[];for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);verts.push([v.x,-v.z,v.y]);}const indices=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i);const faces=[];for(let i=0;i<indices.length;i+=3)faces.push(indices.slice(i,i+3));triangles+=faces.length;meshes.push({name:o.name||'body',vertices:verts,faces,color:o.material.color.toArray(),metalness:o.material.metalness||0,roughness:o.material.roughness??.4,emissive:o.material.emissive?.toArray()||[0,0,0]});});
 fs.writeFileSync(path.join(out,div.id+'.json'),JSON.stringify({division:div.name,meshes}));stats.push({id:div.id,triangles,meshes:meshes.length});ctx.exportedKart=kart;vm.runInContext('disposeKart(exportedKart)',ctx);
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(stats,null,2));console.table(stats);
