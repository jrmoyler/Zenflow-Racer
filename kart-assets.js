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
   m.userData.surface='paint';
   m.roughness=.17;m.metalness=.28;m.clearcoat=1;m.clearcoatRoughness=.1;
   m.emissive.copy(m.color);m.emissiveIntensity=.16;
  }else if(/fairing-pearl/.test(m.name)||(roles.paint&&m.name===roles.paint)){
   m.userData.surface='paint';
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
 const identityBaked=!!(template.userData.zf_rider_identity_baked||find('division-rider-identity'));
 root.userData={zf_rider_identity_baked:identityBaked,wheels,body,pilot,head:find('head'),arms:[find('arm-l'),find('arm-r')],steeringWheel:find('steering-wheel'),exhaust:[find('exhaust-l'),find('exhaust-r')],under,shield,halo,star,glow:under.material,chassis:div.id,asset:'blender-glb',clipState:null,clipNodes:null,anim:null};
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

// ---------- Chassis tiers ----------
// Tier I is the Blender-authored factory kart above. Tiers II and III are
// reference-fitted chassis (tools/fit-scan-kart.py): one textured body with the
// pilot seated in it and four separable wheels. They are fetched on demand so
// the first load only carries the twenty factory karts.
// Bible accent per division, as painted into the tier reference art (tools/scan-karts.json).
const KART_TIER_ACCENT={"zenflow":"#7C3AED","collective":"#D4A843","hybrid":"#F59E0B","nexus":"#DC2626","kinetic":"#16A34A","juris":"#6366F1","signal":"#F43F5E","loom":"#00D9B5","vector":"#CBD5E1","aether":"#34D399","animus":"#22D3EE","helix":"#14B8A6","ledger":"#8B5CF6","terra":"#2563EB","obsidian":"#EA580C","civic":"#7DD3FC","cognara":"#E0267E","gaia":"#22C55E","nomad":"#FBBF24","eon":"#06B6D4"};
const KART_TIER_ASSETS={templates:new Map(),pending:new Map(),failed:new Set(),textures:new Set()};
const kartTierKey=(id,tier)=>id+'-'+tier;
function kartTierReady(id,tier){return tier==='factory'||KART_TIER_ASSETS.templates.has(kartTierKey(id,tier));}
function loadKartTier(id,tier){
 if(tier==='factory')return Promise.resolve(true);
 const key=kartTierKey(id,tier);
 if(KART_TIER_ASSETS.templates.has(key))return Promise.resolve(true);
 if(KART_TIER_ASSETS.pending.has(key))return KART_TIER_ASSETS.pending.get(key);
 if(typeof THREE==='undefined'||!THREE.GLTFLoader)return Promise.resolve(false);
 const job=new THREE.GLTFLoader().loadAsync('assets/models/tiers/'+key+'.glb').then(gltf=>{
  let root=null;gltf.scene.traverse(node=>{if(node.userData.zf_root)root=node;});root=root||gltf.scene;
  if(root.parent)root.parent.remove(root);
  root.traverse(node=>{
   if(node.geometry){node.geometry.userData.blenderShared=true;}
   if(!node.isMesh)return;
   node.castShadow=node.receiveShadow=true;
   const m=node.material;m.userData.tierShared=true;m.envMapIntensity=1.1;
   // The fitted emissive map carries only the division light; let it read in daylight too.
   if(m.emissiveMap)m.emissiveIntensity=1.35;
   for(const value of Object.values(m))if(value&&value.isTexture){value.anisotropy=4;KART_TIER_ASSETS.textures.add(value);}
  });
  if(!root.getObjectByName('chassis'))throw Error(key+': missing chassis');
  KART_TIER_ASSETS.templates.set(key,root);KART_TIER_ASSETS.pending.delete(key);
  if(typeof window!=='undefined'&&typeof Event!=='undefined')window.dispatchEvent(new Event('karttierready'));
  return true;
 }).catch(error=>{console.warn('Chassis tier unavailable',key,error);KART_TIER_ASSETS.pending.delete(key);KART_TIER_ASSETS.failed.add(key);return false;});
 KART_TIER_ASSETS.pending.set(key,job);return job;
}
// Assemble the runtime rig around a fitted chassis. Wheel meshes are authored
// about their own axle, so the shared spin/steer/fold animation drives them
// unchanged. The seated pilot is part of the sculpted body: pilot, head and arm
// pivots exist for the shared animation contract but carry no geometry.
function createTierKart(div,tier){
 const template=KART_TIER_ASSETS.templates.get(kartTierKey(div.id,tier));if(!template)return null;
 const size=template.userData.zf_size||[2.6,2,4.5];
 const root=new THREE.Group();root.name=div.name+' '+tier+' Chassis';
 const accent=new THREE.Color(KART_TIER_ACCENT[div.id]||div.acc);
 const glowMaterial=()=>new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.65,roughness:.3,metalness:.1,transparent:true,opacity:1});
 const group=(name,parent,position)=>{const g=new THREE.Group();g.name=name;if(position)g.position.set(...position);parent.add(g);return g;};
 const body=group('body',root);
 const chassis=template.getObjectByName('chassis').clone();body.add(chassis);
 const pilot=group('pilot',body,[0,1,.37]);group('torso',pilot);
 const head=group('head',pilot,[0,1.2,0]);group('head-mesh',head);
 const arms=[-1,1].map(s=>{const arm=group(s<0?'arm-l':'arm-r',pilot,[s*.34,.9,.02]);group(arm.name+'-mesh',arm);return arm;});
 const steeringWheel=group('steering-wheel',body,[0,1.45,-.34]);
 const halo=group('halo',pilot),star=group('star',pilot);halo.visible=star.visible=false;
 const names=['wheel-fl','wheel-fr','wheel-rl','wheel-rr'],wheels=[];
 const halfW=size[0]/2,halfL=size[2]/2;
 names.forEach((name,i)=>{
  const source=template.getObjectByName(name);
  const rest=source?source.position.clone():new THREE.Vector3((i%2?1:-1)*(halfW-.3),.45,(i<2?-1:1)*(halfL-.9));
  const pivot=group(name,root);pivot.position.copy(rest);const spin=group('spin',pivot);
  if(source){const mesh=source.clone();mesh.position.set(0,0,0);mesh.name='fitted-wheel';spin.add(mesh);}
  // The reference light ring is painted into the tyre texture; this node only keeps the glow contract.
  const ring=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.2,(source?.userData.zf_radius||.45)*.82),.012,4,32),glowMaterial());
  ring.name='wheel-light-ring';ring.rotation.y=Math.PI/2;ring.visible=false;pivot.add(ring);
  wheels.push({pivot,spin,glow:ring,side:i%2?1:-1,rest,static:!source});
 });
 const exhaust=[-.42,.42].map(x=>{const e=new THREE.Mesh(new THREE.CircleGeometry(.09,12),glowMaterial());e.name=x<0?'exhaust-l':'exhaust-r';e.position.set(x,.55,halfL-.05);e.visible=false;body.add(e);return e;});
 const under=new THREE.Mesh(new THREE.TorusGeometry(1,.035,8,48),glowMaterial());under.name='underbody-flow-ring';under.rotation.x=Math.PI/2;under.scale.set(halfW*.66,halfL*.72,1);under.position.y=.19;under.material.emissiveIntensity=0;root.add(under);
 const shield=new THREE.Mesh(new THREE.SphereGeometry(2.15,24,16),new THREE.MeshPhysicalMaterial({color:0x00d9b5,emissive:0x00d9b5,emissiveIntensity:.35,transparent:true,opacity:.16,roughness:.15,side:THREE.DoubleSide}));
 shield.name='aegis-shield';shield.position.y=.9;shield.visible=false;shield.scale.setScalar(Math.max(1,halfL/2.1));root.add(shield);
 root.userData={wheels,body,pilot,head,arms,steeringWheel,exhaust,under,shield,halo,star,glow:under.material,chassis:div.id,tier,asset:'fitted-glb',clipState:null,clipNodes:null,anim:null,cockpitFinished:true,fittedPilot:true};
 Object.defineProperty(root.userData,'toJSON',{value:()=>({chassis:div.id,tier,asset:'fitted-glb'}),enumerable:false});
 if(typeof TEX!=='undefined'&&TEX.contactShadow){
  if(!KART_GEO.contactFootprint)KART_GEO.contactFootprint=new THREE.PlaneGeometry(3.9,5.4);
  const contact=new THREE.Mesh(KART_GEO.contactFootprint,new THREE.MeshBasicMaterial({map:TEX.contactShadow,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
  contact.name='contact-shadow';contact.rotation.x=-Math.PI/2;contact.position.y=.035;contact.scale.set(size[0]/3.4,1,1);root.add(contact);
 }
 const parts=[];root.traverse(node=>{if(node.isMesh){node.userData.partId=node.name;parts.push(node);}});
 root.userData.sculptRuntime={parts,source:'reference-fitted',collider:{halfExtents:[1.53,1.38,2.25]},pick:raycaster=>raycaster.intersectObjects(parts,false),setExploded:()=>{}};
 resolveKartRig(root);return root;
}
