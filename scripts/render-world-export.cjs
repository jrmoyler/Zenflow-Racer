// Export actual authored Three.js geometry; no WebGL context is required.
// Usage: node scripts/render-world-export.cjs [cherry|stormforge|canopy] [output.json]
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),THREE=require(path.join(root,'vendor/three.min.js'));
const mapId=process.argv[2]||'cherry';
if(!['cherry','stormforge','canopy'].includes(mapId))throw new Error('Map must be cherry, stormforge, or canopy.');
const out=path.resolve(process.argv[3]||path.join(os.tmpdir(),`zenflow-${mapId}-geometry.json`));
const worldSource=fs.readFileSync(path.join(root,'world.js'),'utf8'),core=fs.readFileSync(path.join(root,'core.js'),'utf8');
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xffffff,180,780);
const context={THREE,console,FALLBACK_GRAPHICS:true,MOBILEFX:false,LOWFX:false,TEX:{finish:new THREE.Texture()},zenWorldTime:{value:0},scene,hemi:new THREE.HemisphereLight(),sun:new THREE.DirectionalLight(),document:{createElement:()=>({getContext:()=>null})},exportMapId:mapId,result:null};
vm.createContext(context);
vm.runInContext(core.slice(core.indexOf('const clamp='),core.indexOf('function hexToRgb')),context);
vm.runInContext(fs.readFileSync(path.join(root,'maps.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'world-motion-data.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'living-world.js'),'utf8'),context);
vm.runInContext(worldSource.slice(worldSource.indexOf('const CTRL=')),context);
vm.runInContext(`
selectMap(exportMapId);world.updateMatrixWorld(true);
const geometries={},materials={},objects=[];
world.traverse(m=>{if(!m.isMesh)return;const g=m.geometry,mat=m.material;
if(Array.isArray(mat))throw new Error('Exporter requires a single material per world mesh.');
if(!geometries[g.uuid])geometries[g.uuid]={positions:Array.from(g.attributes.position.array),normals:g.attributes.normal?Array.from(g.attributes.normal.array):null,indices:g.index?Array.from(g.index.array):null,colors:g.attributes.color?Array.from(g.attributes.color.array):null};
if(!materials[mat.uuid])materials[mat.uuid]={color:mat.color?mat.color.toArray():[.32,.68,.9],emissive:mat.emissive?mat.emissive.toArray():[0,0,0],emissiveIntensity:mat.emissiveIntensity||0,roughness:mat.roughness??.4,metalness:mat.metalness||0,opacity:mat.opacity??1,basic:!!mat.isMeshBasicMaterial,vertexColors:!!mat.vertexColors};
for(let i=0;i<(m.isInstancedMesh?m.count:1);i++){const matrix=m.matrixWorld.clone();if(m.isInstancedMesh){const instance=new THREE.Matrix4();m.getMatrixAt(i,instance);matrix.multiply(instance);}objects.push({geometry:g.uuid,material:mat.uuid,matrix:matrix.toArray()});}});
// Flag distant track sections with close horizontal centrelines at road elevation.
// This is a screening metric, not an exact banked-ribbon collision test.
const candidates=[];let minDistance=Infinity,nearest=null;
for(let i=0;i<N_SAMP;i+=3)for(let j=i+3;j<N_SAMP;j+=3){
  const arc=Math.min(j-i,N_SAMP-j+i)/N_SAMP*track.len;if(arc<45)continue;
  const a=track.pos[i],b=track.pos[j],vertical=Math.abs(a.y-b.y),horizontal=Math.hypot(a.x-b.x,a.z-b.z);
  if(vertical<4&&horizontal<minDistance){minDistance=horizontal;nearest={u:i/N_SAMP,v:j/N_SAMP,horizontal,vertical};}
  if(vertical<4&&horizontal<TRACK_W)candidates.push({u:i/N_SAMP,v:j/N_SAMP,horizontal,vertical});
}
const p=new THREE.Vector3(),f=new THREE.Vector3(),up=new THREE.Vector3();trackPoint(.035,0,1,p);trackTan(.035,f);trackUp(.035,up);
result={map:{id:activeMap.id,name:activeMap.name,skyTop:activeMap.skyTop,skyHorizon:activeMap.skyHorizon,sun:activeMap.sun},clearance:{sampleStride:3,excludedArcDistance:45,roadWidth:TRACK_W,verticalThreshold:4,candidateCount:candidates.length,nearest,candidates:candidates.slice(0,24)},geometries,materials,objects,cameras:[{name:'chase',position:p.clone().addScaledVector(f,-10).addScaledVector(up,5).toArray(),target:p.clone().addScaledVector(f,35).addScaledVector(up,3).toArray(),fov:72},{name:'overview',position:[255,165,165],target:[-40,5,-95],fov:55}]};`,context);
const result=context.result;
for(const [id,geometry] of Object.entries(result.geometries))for(const [attribute,values] of Object.entries(geometry))if(values&&!values.every(Number.isFinite))throw new Error(`Nonfinite ${attribute} in ${id}`);
for(const object of result.objects)if(!object.matrix.every(Number.isFinite))throw new Error('Nonfinite world transform');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result));
console.log(JSON.stringify({map:mapId,output:out,objects:result.objects.length,geometries:Object.keys(result.geometries).length,finite:true,clearance:result.clearance},null,2));
