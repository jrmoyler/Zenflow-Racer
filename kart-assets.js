/* Blender-authored playable assets. Artwork is never used as geometry or a backdrop. */
const KART_ASSETS={templates:new Map(),geometry:new Set(),promise:null,ready:false};
function validateKartAsset(root,id){
 const required=['body','pilot','torso','head','head-mesh','arm-l','arm-r','arm-l-mesh','arm-r-mesh','steering-wheel','exhaust-l','exhaust-r','underbody-flow-ring','aegis-shield','halo','star','wheel-fl','wheel-fr','wheel-rl','wheel-rr'];
 for(const name of required)if(!root.getObjectByName(name))throw Error(id+': missing Blender rig node '+name);
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
 if(!bounds.toArray().every(Number.isFinite)||bounds.y>12||bounds.x>12)throw Error(id+': invalid model scale');
 for(const name of ['wheel-fl','wheel-fr','wheel-rl','wheel-rr']){const wheel=root.getObjectByName(name);if(!wheel.getObjectByName('spin')||!wheel.getObjectByName('wheel-light-ring'))throw Error(id+': incomplete wheel rig');}
}
async function loadKartAssets(onProgress=()=>{}){
 if(KART_ASSETS.promise)return KART_ASSETS.promise;
 KART_ASSETS.promise=(async()=>{
  if(!THREE.GLTFLoader)throw Error('The 3D model loader is missing.');
  const loader=new THREE.GLTFLoader();let next=0,done=0;
  async function worker(){while(next<ROSTER.length){const div=ROSTER[next++];
   const gltf=await loader.loadAsync('assets/models/'+div.id+'.glb');
   gltf.scene.traverse(node=>{const name=node.userData.zf_runtime_name||node.userData.zf_node;if(name)node.name=name;if(node.userData.zf_visible!==undefined)node.visible=!!node.userData.zf_visible;});
   let root;gltf.scene.traverse(node=>{if(node.userData.zf_root)root=node;});root=root||gltf.scene.children[0];
   if(!root)throw Error(div.id+': empty Blender asset');if(root.parent)root.parent.remove(root);
   root.position.set(0,0,0);root.name=div.name+' Playable Chassis';validateKartAsset(root,div.id);
   root.traverse(node=>{if(node.geometry){KART_ASSETS.geometry.add(node.geometry);node.geometry.userData.blenderShared=true;}if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
   KART_ASSETS.templates.set(div.id,root);onProgress(++done,ROSTER.length);
  }}
  await Promise.all([worker(),worker(),worker()]);KART_ASSETS.ready=true;return KART_ASSETS;
 })();
 return KART_ASSETS.promise;
}
// Tune cloned shipping materials; template materials stay immutable across previews/races.
function lightPlayableMaterial(material,div,roles={}){
 const m=material.clone();
 if(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial){
  m.envMapIntensity=1.15;
  if(/anatomical-enamel/.test(m.name)){
   m.roughness=.17;m.metalness=.28;m.clearcoat=1;m.clearcoatRoughness=.1;
   m.emissive.copy(m.color);m.emissiveIntensity=.16;
  }else if(/fairing-pearl/.test(m.name)||m.name===roles.paint){
   if(div)m.color.set(div.acc).convertSRGBToLinear();
   m.roughness=.28;m.metalness=.18;m.clearcoat=1;m.clearcoatRoughness=.12;
  }else if(div&&/woven-race-suit/.test(m.name)){
   m.color.set(div.acc).convertSRGBToLinear().multiplyScalar(.42);m.roughness=.92;m.metalness=0;
  }else if(div&&m.name===roles.trim){
   m.color.set(div.acc2).convertSRGBToLinear();
  }else if(/luminous-rim/.test(m.name)){
   m.emissive.copy(m.color);m.emissiveIntensity=.65;m.roughness=.2;
  }
 }
 return m;
}
function createLoadedKart(div){
 const template=KART_ASSETS.templates.get(div.id);if(!template)return null;
 const root=template.clone(true),materials=new Map();
 const roles={paint:template.getObjectByName('helmet-shell')?.material?.name,trim:template.getObjectByName('helmet-crown-stripe')?.material?.name};
 root.traverse(node=>{
  if(!node.isMesh)return;
  const own=/^(wheel-light-ring|exhaust-[lr]|underbody-flow-ring|aegis-shield)$/.test(node.name);
  const copy=source=>{if(own)return lightPlayableMaterial(source,div,roles);if(!materials.has(source))materials.set(source,lightPlayableMaterial(source,div,roles));return materials.get(source);};
  node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);
 });
 const find=name=>root.getObjectByName(name),body=find('body'),pilot=find('pilot');
 const wheels=['wheel-fl','wheel-fr','wheel-rl','wheel-rr'].map((name,i)=>{const pivot=find(name);return {pivot,spin:pivot.getObjectByName('spin'),glow:pivot.getObjectByName('wheel-light-ring'),side:i%2?1:-1,rest:pivot.position.clone()};});
 const under=find('underbody-flow-ring'),shield=find('aegis-shield'),halo=find('halo'),star=find('star');shield.visible=halo.visible=star.visible=false;
 root.userData={wheels,body,pilot,head:find('head'),arms:[find('arm-l'),find('arm-r')],steeringWheel:find('steering-wheel'),exhaust:[find('exhaust-l'),find('exhaust-r')],under,shield,halo,star,glow:under.material,chassis:div.id,asset:'blender-glb',clipState:null,clipNodes:null,anim:null};
 Object.defineProperty(root.userData,'toJSON',{value:()=>({chassis:div.id,asset:'blender-glb'}),enumerable:false});
 // An inspectable, articulated hierarchy also supports scene picking and exploded review.
 const parts=[];root.traverse(node=>{if(node.isMesh){node.userData.partId=node.name;parts.push(node);}});
 root.updateMatrixWorld(true);
 const restParts=parts.map(node=>({node,position:node.position.clone(),center:new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3())}));
 const center=new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
 root.userData.sculptRuntime={parts,source:'Blender 4.5',collider:{halfExtents:[1.53,1.38,2.25]},pick:raycaster=>raycaster.intersectObjects(parts,false),setExploded:amount=>{
  const k=Math.max(0,Math.min(1,amount));for(const part of restParts){part.node.position.copy(part.position);if(k){const direction=part.center.clone().sub(center).multiplyScalar(k);const worldOrigin=part.node.parent.getWorldPosition(new THREE.Vector3());const offset=part.node.parent.worldToLocal(worldOrigin.add(direction));part.node.position.add(offset);}}
 }};
 finishKartCockpit(root);resolveKartRig(root);return root;
}
