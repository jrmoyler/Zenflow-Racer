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
  prepareTierPilotSkin(key,root);
  KART_TIER_ASSETS.templates.set(key,root);KART_TIER_ASSETS.pending.delete(key);
  if(typeof window!=='undefined'&&typeof Event!=='undefined')window.dispatchEvent(new Event('karttierready'));
  return true;
 }).catch(error=>{console.warn('Chassis tier unavailable',key,error);KART_TIER_ASSETS.pending.delete(key);KART_TIER_ASSETS.failed.add(key);return false;});
 KART_TIER_ASSETS.pending.set(key,job);return job;
}
// Seated pilot of every fitted scan: helmet centre [x,y,z] and shell radius in chassis space,
// measured by a 3D sphere-shell search over each GLB surface and checked against side/front renders.
// Neck, shoulders, hips, grips and steering wheel follow from these by seated-driver proportions.
const KART_TIER_PILOT={"aether-dark":[0,1.58,.4,.28],"aether-final":[0,1.52,.46,.22],"animus-dark":[0,1.73,.43,.24],"animus-final":[0,1.61,.46,.26],"civic-dark":[0,2.3,.73,.32],"civic-final":[0,1.79,.76,.32],"cognara-dark":[0,1.88,.85,.32],"cognara-final":[-.03,1.49,.52,.24],"collective-dark":[0,1.43,.61,.24],"collective-final":[-.03,1.85,.76,.28],"eon-dark":[0,1.34,.52,.18],"eon-final":[-.03,1.52,.67,.24],"gaia-dark":[0,2.3,.82,.32],"gaia-final":[-.03,1.49,.7,.24],"helix-dark":[0,2.06,.76,.28],"helix-final":[0,1.64,.64,.26],"hybrid-dark":[0,2.82,1.34,.3],"hybrid-final":[0,1.58,.43,.28],"juris-dark":[0,2.12,.7,.28],"juris-final":[0,1.64,.67,.28],"kinetic-dark":[0,1.28,.58,.22],"kinetic-final":[0,1.37,.46,.22],"ledger-dark":[0,1.52,.73,.32],"ledger-final":[0,1.64,.64,.28],"loom-dark":[0,2.03,.85,.26],"loom-final":[0,1.55,.61,.24],"nexus-dark":[0,1.66,.96,.26],"nexus-final":[0,1.43,.31,.26],"nomad-dark":[0,2.09,.43,.28],"nomad-final":[-.03,1.34,.76,.24],"obsidian-dark":[0,1.67,.61,.26],"obsidian-final":[0,1.67,.64,.28],"signal-dark":[-.03,1.34,.46,.18],"signal-final":[0,1.37,.46,.22],"terra-dark":[0,1.94,.46,.26],"terra-final":[-.03,1.58,.64,.24],"vector-dark":[0,1.66,.14,.18],"vector-final":[-.03,1.46,.46,.24],"zenflow-dark":[0,1.46,.55,.24],"zenflow-final":[0,1.58,.58,.28]};
// Joint landmarks (chassis space) derived from the helmet: s is the helmet shell radius.
function tierPilotJoints(fit){
 const [x,y,z,s]=fit,neck=[x,y-1.05*s,z+.15*s],hip=[0,y-4*s,z+.2*s],wheel=[0,y-2.3*s,z-2.9*s];
 return {s,helmet:[x,y,z],neck,hip,wheel,shoulders:[-1,1].map(k=>[k*1.5*s,y-1.6*s,z+.3*s]),grips:[-1,1].map(k=>[k*1.1*s,wheel[1],wheel[2]+.1*s]),tilt:-.5};
}
// Soft skin weights that separate the sculpted pilot from the fused scan without cutting it:
// helmet -> head, chest -> torso, upper arms -> shoulders, gloves and rim -> steering wheel,
// everything else (seat, legs in the footwell, coachwork) -> sprung body. Smooth falloffs let the
// suit stretch across each joint instead of tearing. Bones: 0 body,1 torso,2 head,3 arm-l,4 arm-r,5 steering-wheel.
function tierPilotSkin(position,joints){
 const n=position.count,index=new Uint16Array(n*4),weight=new Float32Array(n*4),{s,helmet,neck,hip,wheel,shoulders,grips,tilt}=joints;
 const ramp=(v,a,b)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 // Distance from p to segment a-b; the segment parameter is left in segT.
 let segT=0;const seg=(p,a,b)=>{const abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2];segT=Math.max(0,Math.min(1,((p[0]-a[0])*abx+(p[1]-a[1])*aby+(p[2]-a[2])*abz)/(abx*abx+aby*aby+abz*abz||1)));const x=p[0]-a[0]-abx*segT,y=p[1]-a[1]-aby*segT,z=p[2]-a[2]-abz*segT;return Math.sqrt(x*x+y*y+z*z);};
 const ny=Math.sin(-tilt),nz=Math.cos(-tilt),elbows=shoulders.map((sh,i)=>[(sh[0]+grips[i][0])/2+(i?1:-1)*.35*s,(sh[1]+grips[i][1])/2-.5*s,(sh[2]+grips[i][2])/2]);
 const p=[0,0,0],w=new Float32Array(6),order=[0,1,2,3,4,5];
 for(let i=0;i<n;i++){
  p[0]=position.getX(i);p[1]=position.getY(i);p[2]=position.getZ(i);w.fill(0);
  // Helmet: tight shell so roll hoops, headrests and fins beside it stay on the chassis.
  const hx=p[0]-helmet[0],hy=(p[1]-helmet[1])*1.1,hz=p[2]-helmet[2],dh=Math.sqrt(hx*hx+hy*hy+hz*hz);
  w[2]=(1-ramp(dh,1.1*s,1.35*s))*ramp(p[1],neck[1]-.1*s,neck[1]+.3*s);
  // Chest and shoulders: capsule hip->neck, fading in above the seat cushion.
  w[1]=(1-ramp(seg(p,hip,neck),1.6*s,2.2*s))*ramp(p[1],hip[1]+.2*s,hip[1]+1.4*s);
  // Arms: shoulder->elbow->grip chains; the forearm hands over to the steering wheel toward the glove.
  for(let k=0;k<2;k++){const d1=seg(p,shoulders[k],elbows[k]),t1=segT,d2=seg(p,elbows[k],grips[k]),t2=segT,along=d1<d2?t1*.5:.5+t2*.5,d=Math.min(d1,d2);
   const arm=1-ramp(d,.5*s,.8*s),grip=ramp(along,.45,.95);if(arm>0){w[3+k]=Math.max(w[3+k],arm*(1-grip));w[5]=Math.max(w[5],arm*grip);}}
  // Wheel rim: a disc around the column axis, thin along it so the dash behind never turns.
  const ox=p[0]-wheel[0],oy=p[1]-wheel[1],oz=p[2]-wheel[2],ax=oy*ny+oz*nz,ry=oy-ax*ny,rz=oz-ax*nz,rad=Math.sqrt(ox*ox+ry*ry+rz*rz);
  w[5]=Math.max(w[5],(1-ramp(rad,1.15*s,1.45*s))*(1-ramp(Math.abs(ax),.25*s,.45*s)));
  // The helmet owns its shell; limbs own their sleeves; the torso keeps the rest of the suit.
  const free=1-w[2];for(let k=3;k<6;k++)w[k]*=free;w[1]*=Math.max(0,free-Math.max(w[3],w[4],w[5]));
  let sum=w[1]+w[2]+w[3]+w[4]+w[5];if(sum>1){for(let k=1;k<6;k++)w[k]/=sum;sum=1;}w[0]=1-sum;
  // Keep the four strongest influences (insertion sort over six bones, allocation-free).
  for(let k=0;k<6;k++)order[k]=k;
  for(let a=1;a<6;a++){const v=order[a];let b=a-1;while(b>=0&&w[order[b]]<w[v]){order[b+1]=order[b];b--;}order[b+1]=v;}
  const total=w[order[0]]+w[order[1]]+w[order[2]]+w[order[3]];
  for(let k=0;k<4;k++){index[i*4+k]=order[k];weight[i*4+k]=total>0?w[order[k]]/total:(k?0:1);}
 }
 return {index,weight};
}
// Weights are solved once per template (at load, ~35 ms) onto the shared chassis geometry.
function prepareTierPilotSkin(key,template){
 const source=template.getObjectByName('chassis'),fit=KART_TIER_PILOT[key],g=source?.geometry;
 if(!fit||!g?.attributes.position||g.userData.zfPilotSkin)return;
 const skin=tierPilotSkin(g.attributes.position,tierPilotJoints(fit));
 g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skin.index,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skin.weight,4));g.userData.zfPilotSkin=true;
 // r128 compiles the skinning chunk from the material flag; the flag is inert on unskinned meshes.
 (Array.isArray(source.material)?source.material:[source.material]).forEach(m=>{m.skinning=true;});
}
// Motion gains keep the shared factory choreography inside what a fused sculpt can stretch to.
const KART_TIER_RIG_GAIN={torso:.7,head:.75,arm:.32,wheel:.6};
// Assemble the runtime rig around a fitted chassis. Wheel meshes are authored
// about their own axle, so the shared spin/steer/fold animation drives them
// unchanged. The seated pilot is sculpted into the body, so the chassis is
// skinned to a pilot skeleton (see tierPilotSkin) that the shared animation drives.
function createTierKart(div,tier){
 const key=kartTierKey(div.id,tier),template=KART_TIER_ASSETS.templates.get(key);if(!template)return null;
 const size=template.userData.zf_size||[2.6,2,4.5];
 const root=new THREE.Group();root.name=div.name+' '+tier+' Chassis';
 const accent=new THREE.Color(KART_TIER_ACCENT[div.id]||div.acc);
 const glowMaterial=()=>new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.65,roughness:.3,metalness:.1,transparent:true,opacity:1});
 const group=(name,parent,position)=>{const g=new THREE.Group();g.name=name;if(position)g.position.set(...position);parent.add(g);return g;};
 const body=group('body',root);
 const source=template.getObjectByName('chassis'),fit=KART_TIER_PILOT[key];
 const joints=tierPilotJoints(fit||[0,size[1]*.72,.5,.25]),{hip,neck,shoulders,wheel}=joints,local=p=>[p[0]-hip[0],p[1]-hip[1],p[2]-hip[2]];
 // Pilot pivots at the hips; the seat mount keeps pilot.position.y===1 for the shared animation.
 const seat=group('pilot-seat',body,[hip[0],hip[1]-1,hip[2]]);
 const pilot=group('pilot',seat,[0,1,0]),torso=group('torso',pilot);
 const head=group('head',torso,local(neck));group('head-mesh',head);
 const arms=shoulders.map((sh,i)=>{const arm=group(i?'arm-r':'arm-l',torso,local(sh));group(arm.name+'-mesh',arm);return arm;});
 const steeringWheel=group('steering-wheel',body,wheel);steeringWheel.rotation.x=joints.tilt;
 const halo=group('halo',pilot),star=group('star',pilot);halo.visible=star.visible=false;
 let chassis;
 if(fit&&source.geometry?.attributes.position){
  const g=source.geometry;
  prepareTierPilotSkin(key,template);
  chassis=new THREE.SkinnedMesh(g,source.material);chassis.name='chassis';chassis.position.copy(source.position);chassis.quaternion.copy(source.quaternion);chassis.scale.copy(source.scale);
  chassis.castShadow=chassis.receiveShadow=true;chassis.frustumCulled=source.frustumCulled;body.add(chassis);
  root.updateMatrixWorld(true);chassis.bind(new THREE.Skeleton([body,torso,head,arms[0],arms[1],steeringWheel]),chassis.matrixWorld);
 }else{chassis=source.clone();body.add(chassis);}
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
 root.userData={wheels,body,pilot,head,arms,steeringWheel,exhaust,under,shield,halo,star,glow:under.material,chassis:div.id,tier,asset:'fitted-glb',clipState:null,clipNodes:null,anim:null,cockpitFinished:true,fittedPilot:chassis.isSkinnedMesh?'skinned':true,pilotJoints:joints,rigGain:chassis.isSkinnedMesh?KART_TIER_RIG_GAIN:null};
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
