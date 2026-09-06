// Export the actual authored Three.js world, including instanced transforms.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),THREE=require(path.join(root,'vendor/three.min.js'));
const world=fs.readFileSync(path.join(root,'world.js'),'utf8'),core=fs.readFileSync(path.join(root,'core.js'),'utf8');
const context={THREE,console,FALLBACK_GRAPHICS:true,MOBILEFX:false,LOWFX:false,TEX:{finish:new THREE.Texture()},zenWorldTime:{value:0},scene:new THREE.Scene(),result:null};
vm.createContext(context);vm.runInContext(core.slice(core.indexOf('const clamp='),core.indexOf('function hexToRgb'))+world.slice(world.indexOf('const CTRL='))+`
buildTrackFrames();buildTrackMeshes();buildEnvironment();world.updateMatrixWorld(true);
const geometries={},materials={},objects=[];
world.traverse(m=>{if(!m.isMesh)return;const g=m.geometry,mat=m.material;
if(!geometries[g.uuid])geometries[g.uuid]={positions:Array.from(g.attributes.position.array),normals:g.attributes.normal?Array.from(g.attributes.normal.array):null,indices:g.index?Array.from(g.index.array):null,colors:g.attributes.color?Array.from(g.attributes.color.array):null};
if(!materials[mat.uuid])materials[mat.uuid]={color:mat.color?mat.color.toArray():[.32,.68,.9],emissive:mat.emissive?mat.emissive.toArray():[0,0,0],emissiveIntensity:mat.emissiveIntensity||0,roughness:mat.roughness??.4,metalness:mat.metalness||0,opacity:mat.opacity??1,basic:!!mat.isMeshBasicMaterial,vertexColors:!!mat.vertexColors};
for(let i=0;i<(m.isInstancedMesh?m.count:1);i++){const matrix=m.matrixWorld.clone();if(m.isInstancedMesh){const instance=new THREE.Matrix4();m.getMatrixAt(i,instance);matrix.multiply(instance);}objects.push({geometry:g.uuid,material:mat.uuid,matrix:matrix.toArray()});}});
const p=new THREE.Vector3(),f=new THREE.Vector3(),up=new THREE.Vector3();trackPoint(.035,0,1,p);trackTan(.035,f);trackUp(.035,up);
result={geometries,materials,objects,cameras:[{name:'chase',position:p.clone().addScaledVector(f,-10).addScaledVector(up,5).toArray(),target:p.clone().addScaledVector(f,35).addScaledVector(up,3).toArray(),fov:72},{name:'overview',position:[255,165,165],target:[-40,5,-95],fov:55}]};`,context);
const out=path.join(root,'docs/world-review/world-geometry.json');fs.writeFileSync(out,JSON.stringify(context.result));console.log(out,context.result.objects.length+' world objects');
