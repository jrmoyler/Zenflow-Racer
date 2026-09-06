// ---------- Kart factory ----------
function mergeKartGeometry(parts){
  const result=new THREE.BufferGeometry();
  const flat=parts.map(g=>g.index?g.toNonIndexed():g.clone());
  for(const key of ['position','normal','uv']){
    const length=flat.reduce((n,g)=>n+(g.attributes[key]?.array.length||0),0);
    if(!length||flat.some(g=>!g.attributes[key]))continue;
    const values=new Float32Array(length);let offset=0;
    flat.forEach(g=>{values.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length;});
    result.setAttribute(key,new THREE.BufferAttribute(values,key==='uv'?2:3));
  }
  flat.forEach(g=>g.dispose());result.computeBoundingSphere();return result;
}
function batchKartBody(group){
  const batches=new Map();
  for(const mesh of group.children){
    // Transparent effects and dynamically animated materials must remain addressable.
    if(!mesh.isMesh||mesh.material.transparent||(mesh.material.emissiveIntensity>0&&mesh.material.emissive?.getHex()!==0))continue;
    const key=mesh.material;const batch=batches.get(key)||[];batch.push(mesh);batches.set(key,batch);
  }
  for(const [material,meshes] of batches){
    if(meshes.length<2)continue;
    const parts=meshes.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});
    const merged=new THREE.Mesh(mergeKartGeometry(parts),material);merged.castShadow=true;
    parts.forEach(g=>g.dispose());const shared=new Set(Object.values(KART_GEO));meshes.forEach(mesh=>{group.remove(mesh);if(!shared.has(mesh.geometry))mesh.geometry.dispose();});group.add(merged);
  }
}
function disposeKart(root){
  if(!root)return;
  const sharedGeometry=new Set(Object.values(KART_GEO));
  const sharedTextures=new Set(Object.values(TEX));
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(obj=>{if(obj.geometry&&!sharedGeometry.has(obj.geometry))geometries.add(obj.geometry);
    if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>materials.add(m));});
  materials.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture&&!sharedTextures.has(v))textures.add(v);});m.dispose();});
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());if(root.parent)root.parent.remove(root);
}
const KART_GEO={};
function kartGeos(){
  // Hull: authored arrow-hull silhouette, extruded with bevel (top-down shape in XZ, extruded in Y)
  const hull=new THREE.Shape();
  hull.moveTo(0,2.35);hull.bezierCurveTo(.55,2.3,.85,1.9,.95,1.4);hull.lineTo(1.05,.3);hull.lineTo(1.0,-.6);hull.bezierCurveTo(1.05,-1.2,1.1,-1.6,.95,-1.75);hull.lineTo(.5,-1.9);hull.lineTo(-.5,-1.9);hull.lineTo(-.95,-1.75);hull.bezierCurveTo(-1.1,-1.6,-1.05,-1.2,-1.0,-.6);hull.lineTo(-1.05,.3);hull.lineTo(-.95,1.4);hull.bezierCurveTo(-.85,1.9,-.55,2.3,0,2.35);
  const hullG=new THREE.ExtrudeGeometry(hull,{depth:.3,bevelEnabled:true,bevelThickness:.12,bevelSize:.16,bevelSegments:4,steps:1});hullG.rotateX(-Math.PI/2);hullG.translate(0,0.26,0);hullG.scale(1.15,1,1);hullG.rotateY(Math.PI);
  // Front wing (extruded airfoil, low)
  const fw=new THREE.Shape();fw.moveTo(-1.5,0);fw.lineTo(1.5,0);fw.lineTo(1.5,.09);fw.bezierCurveTo(.5,.2,-.5,.2,-1.5,.09);fw.closePath();
  const fwingG=new THREE.ExtrudeGeometry(fw,{depth:.5,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:1});fwingG.translate(0,.18,2.0);
  // Wheel arches (half-torus over each wheel)
  const archG=new THREE.TorusGeometry(.62,.09,6,16,Math.PI);archG.rotateY(Math.PI/2);
  // Suspension arms
  const armG=new THREE.CylinderGeometry(.045,.045,.9,6);armG.rotateZ(Math.PI/2);
  const discG=new THREE.CylinderGeometry(.24,.24,.04,18);discG.rotateZ(Math.PI/2);
  // Nose cone (lathe)
  const noseG=new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.22,.02),new THREE.Vector2(.38,.3),new THREE.Vector2(.5,.9),new THREE.Vector2(.42,1.15),new THREE.Vector2(0,1.2)],14);noseG.rotateX(Math.PI/2);noseG.translate(0,.62,1.9);
  // Cockpit pod
  const podG=new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.62,0),new THREE.Vector2(.7,.22),new THREE.Vector2(.66,.55),new THREE.Vector2(.5,.85),new THREE.Vector2(.25,1.0),new THREE.Vector2(0,1.02)],16);podG.scale(1,1,1.35);podG.translate(0,.5,-.2);
  // Side pods (extruded teardrop)
  const sp=new THREE.Shape();sp.moveTo(0,.9);sp.bezierCurveTo(.5,.9,.62,.4,.6,-.3);sp.bezierCurveTo(.58,-.8,.4,-1.0,0,-1.0);sp.lineTo(0,.9);
  const sideG=new THREE.ExtrudeGeometry(sp,{depth:.48,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:2});sideG.rotateX(-Math.PI/2);
  // Rear wing (extruded airfoil) + endplates
  const wing=new THREE.Shape();wing.moveTo(-1.35,0);wing.lineTo(1.35,0);wing.lineTo(1.35,.16);wing.bezierCurveTo(.6,.34,-.6,.34,-1.35,.16);wing.closePath();
  const wingG=new THREE.ExtrudeGeometry(wing,{depth:.55,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:1});wingG.translate(0,1.25,-1.95);
  const plate=new THREE.Shape();plate.moveTo(0,0);plate.lineTo(.7,0);plate.lineTo(.8,.55);plate.lineTo(.15,.7);plate.lineTo(0,.5);plate.closePath();
  const plateG=new THREE.ExtrudeGeometry(plate,{depth:.06,bevelEnabled:false});plateG.rotateY(Math.PI/2);
  // Wheel: tyre (torus-ish lathe with tread) + rim + hub
  const tyreG=new THREE.LatheGeometry([new THREE.Vector2(.28,-.24),new THREE.Vector2(.42,-.22),new THREE.Vector2(.48,-.12),new THREE.Vector2(.49,.12),new THREE.Vector2(.42,.22),new THREE.Vector2(.28,.24)],20);tyreG.rotateZ(Math.PI/2);
  const rimG=new THREE.LatheGeometry([new THREE.Vector2(0,-.27),new THREE.Vector2(.16,-.27),new THREE.Vector2(.22,-.16),new THREE.Vector2(.36,-.12),new THREE.Vector2(.36,.12),new THREE.Vector2(.22,.16),new THREE.Vector2(.16,.27),new THREE.Vector2(0,.27)],12);rimG.rotateZ(Math.PI/2);
  // Five machined spokes in one geometry, shared by every wheel.
  const spokeParts=[];for(let s=0;s<5;s++){const spoke=new THREE.BoxGeometry(.055,.58,.07);spoke.rotateX(s/5*Math.PI*2);spokeParts.push(spoke);}
  const spokeG=mergeKartGeometry(spokeParts);spokeParts.forEach(g=>g.dispose());
  // Anti-grav glow ring on wheel face
  const glowG=new THREE.TorusGeometry(.34,.05,6,24);glowG.rotateY(Math.PI/2);
  // Agent core (pilot): helmet lathe + visor + halo
  const helmG=new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.36,0),new THREE.Vector2(.4,.2),new THREE.Vector2(.36,.5),new THREE.Vector2(.2,.64),new THREE.Vector2(0,.66)],18);
  const visorG=new THREE.SphereGeometry(.41,20,10,Math.PI*.62,Math.PI*.76,Math.PI*.36,Math.PI*.3);
  const haloG=new THREE.TorusGeometry(.5,.035,6,32);haloG.rotateX(Math.PI/2);
  const bodyG=new THREE.LatheGeometry([new THREE.Vector2(.12,0),new THREE.Vector2(.42,0),new THREE.Vector2(.48,.25),new THREE.Vector2(.36,.55),new THREE.Vector2(.18,.62)],14);
  const exhaustG=new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.16,0),new THREE.Vector2(.14,.5),new THREE.Vector2(.19,.55),new THREE.Vector2(0,.55)],10);exhaustG.rotateX(-Math.PI/2);
  const starG=starGeo(.32,.06);
  Object.assign(KART_GEO,{hullG,noseG,podG,sideG,wingG,plateG,tyreG,rimG,spokeG,glowG,helmG,visorG,haloG,bodyG,exhaustG,starG,fwingG,archG,armG,discG});
}
function buildKart(div){
  const G=KART_GEO,root=new THREE.Group(),grp=new THREE.Group();grp.rotation.y=Math.PI;root.add(grp);
  const acc=new THREE.Color(div.acc),acc2=new THREE.Color(div.acc2),base=new THREE.Color(div.base).lerp(new THREE.Color(0x222a3a),.4);
  const paint=new THREE.MeshPhysicalMaterial({color:acc,metalness:.55,roughness:.28,clearcoat:.9,clearcoatRoughness:.15});
  const dark=new THREE.MeshStandardMaterial({color:base,metalness:.7,roughness:.4});
  const trim=new THREE.MeshStandardMaterial({color:acc2,metalness:.6,roughness:.35});
  const glow=new THREE.MeshStandardMaterial({color:0x000,emissive:acc,emissiveIntensity:2.2});
  const tyre=new THREE.MeshStandardMaterial({map:TEX.tread,color:0x2a2c33,roughness:.9});
  const rimM=new THREE.MeshStandardMaterial({color:0xe6ebf3,metalness:.95,roughness:.18});
  const brakeM=new THREE.MeshStandardMaterial({color:0x9a6a3a,metalness:.9,roughness:.35});
  const add=(g,m,x=0,y=0,z=0,sx=1,sy=1,sz=1,cast=true)=>{const me=new THREE.Mesh(g,m);me.position.set(x,y,z);me.scale.set(sx,sy,sz);me.castShadow=cast;grp.add(me);return me;};
  add(G.hullG,paint);add(G.noseG,trim);const pod=add(G.podG,dark,0,-.12,.05,.95,.8,.95);add(G.fwingG,trim);
  [-1,1].forEach(s=>{[1.35,-1.4].forEach(z=>{const ar=add(G.archG,paint,s*1.15,.5,z);ar.rotation.z=0;add(G.armG,rimM,s*.75,.45,z,.9,1,1);add(G.discG,brakeM,s*.95,.48,z);});});
  const spL=add(G.sideG,dark,-1.05,.3,-.25,1,1,1);spL.rotation.y=Math.PI;const spR=add(G.sideG,dark,1.05,.3,-.25);spR.scale.x=-1;
  add(G.wingG,paint,0,0,0);[-1.4,1.34].forEach(x=>add(G.plateG,trim,x,1.15,-2.35));
  add(G.exhaustG,rimM,-.55,.55,-2.3);add(G.exhaustG,rimM,.55,.55,-2.3);
  const exhaustMat=glow.clone();
  const exL=add(G.glowG,exhaustMat,-.55,.55,-2.86,.35,.35,.35,false);exL.rotation.y=Math.PI/2;const exR=add(G.glowG,exhaustMat,.55,.55,-2.86,.35,.35,.35,false);exR.rotation.y=Math.PI/2;
  // livery accent strip via emissive-free plane decal on hull sides
  const stripe=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.22),new THREE.MeshStandardMaterial({color:acc2,roughness:.5,polygonOffset:true,polygonOffsetFactor:-1}));stripe.rotation.y=Math.PI/2;stripe.position.set(-1.07,.55,-.1);stripe.rotation.z=.08;grp.add(stripe);
  const stripe2=stripe.clone();stripe2.rotation.y=-Math.PI/2;stripe2.position.x=1.07;grp.add(stripe2);
  // number/mark plate on nose
  const markTex=toTex(texMark(div.mark,div.acc2,'#F5F5F5',128),false);
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(.7,.7),new THREE.MeshStandardMaterial({map:markTex,transparent:true,roughness:.5,polygonOffset:true,polygonOffsetFactor:-1}));plate.position.set(0,.98,1.45);plate.rotation.x=-1.05;grp.add(plate);
  // Agent core pilot
  const pilot=new THREE.Group();pilot.position.set(0,.7,-.35);pilot.scale.set(.74,.74,.74);
  const body=new THREE.Mesh(G.bodyG,dark);pilot.add(body);
  const helm=new THREE.Mesh(G.helmG,new THREE.MeshPhysicalMaterial({color:acc,metalness:.5,roughness:.25,clearcoat:1}));helm.position.y=.62;helm.castShadow=true;pilot.add(helm);
  const visor=new THREE.Mesh(G.visorG,new THREE.MeshStandardMaterial({color:0x0a0f1e,emissive:acc2,emissiveIntensity:.9,metalness:.4,roughness:.15,side:THREE.DoubleSide}));visor.position.set(0,.62,0);pilot.add(visor);
  const halo=new THREE.Mesh(G.haloG,glow);halo.position.y=1.42;halo.userData.halo=true;pilot.add(halo);
  const star=new THREE.Mesh(G.starG,new THREE.MeshStandardMaterial({color:0x000,emissive:0xd4a843,emissiveIntensity:2.5}));star.position.set(0,1.42,0);star.userData.star=true;pilot.add(star);
  grp.add(pilot);
  // Wheels (with fold pivot for anti-grav)
  const wheels=[];const wpos=[[-1.15,.48,1.35],[1.15,.48,1.35],[-1.2,.5,-1.4],[1.2,.5,-1.4]];
  wpos.forEach((p,i)=>{const pivot=new THREE.Group();pivot.position.set(p[0],p[1],p[2]);const spin=new THREE.Group();
    const t=new THREE.Mesh(G.tyreG,tyre);t.castShadow=true;spin.add(t);spin.add(new THREE.Mesh(G.rimG,rimM));
    const spokes=new THREE.Mesh(G.spokeG,rimM);spokes.position.x=(i%2?.24:-.24);spin.add(spokes);
    const gl=new THREE.Mesh(G.glowG,glow.clone());gl.position.x=(i%2?.5:-.5);gl.material.emissiveIntensity=0;gl.material.transparent=true;pivot.add(gl);
    pivot.add(spin);grp.add(pivot);wheels.push({pivot,spin,glow:gl,side:i%2?1:-1});});
  // underglow ring for anti-grav
  const under=new THREE.Mesh(new THREE.TorusGeometry(1.5,.08,6,40),new THREE.MeshStandardMaterial({color:0x000,emissive:acc,emissiveIntensity:0,transparent:true,opacity:.8}));under.rotation.x=Math.PI/2;under.position.y=.15;under.scale.set(1,1,1.4);grp.add(under);
  // Shield bubble (item)
  const shield=new THREE.Mesh(new THREE.IcosahedronGeometry(2.4,2),new THREE.MeshPhysicalMaterial({color:0x00d9b5,transparent:true,opacity:.22,roughness:.1,metalness:.1,transmission:0,side:THREE.DoubleSide,emissive:0x00d9b5,emissiveIntensity:.6}));shield.position.y=.9;shield.visible=false;grp.add(shield);
  // Consolidate stationary bodywork by material. Moving wheels and pilot stay articulated.
  batchKartBody(grp);
  root.userData={wheels,pilot,halo,star,under,shield,exhaust:[exL,exR],glow};
  return root;
}

// ---------- Item / token pickups ----------
const ITEMS={
  burst:{name:'Signal Burst',color:'#F43F5E',desc:'Speed boost'},
  shield:{name:'Aegis Shield',color:'#00D9B5',desc:'Blocks one hit'},
  mine:{name:'Loom Mine',color:'#A3E635',desc:'Drop behind'},
  missile:{name:'Vector Missile',color:'#CBD5E1',desc:'Homing forward'},
  pulse:{name:'Overseer Pulse',color:'#D4A843',desc:'Spins everyone ahead'},
  triple:{name:'Node Cluster',color:'#7C3AED',desc:'Three bursts'},
};
function itemIconSVG(key){
  const c=ITEMS[key].color;
  switch(key){
    case 'burst':return `<svg viewBox="0 0 64 64"><path d="M14 34h22l-6 16 22-24H30l6-16z" fill="${c}"/></svg>`;
    case 'shield':return `<svg viewBox="0 0 64 64"><path d="M32 8l20 8v16c0 12-8 20-20 24-12-4-20-12-20-24V16z" fill="none" stroke="${c}" stroke-width="5"/><circle cx="32" cy="30" r="5" fill="${c}"/></svg>`;
    case 'mine':return `<svg viewBox="0 0 64 64"><polygon points="32,6 55,19 55,45 32,58 9,45 9,19" fill="none" stroke="${c}" stroke-width="5"/><circle cx="32" cy="32" r="7" fill="${c}"/></svg>`;
    case 'missile':return `<svg viewBox="0 0 64 64"><path d="M10 34c10-12 24-18 44-18l-8 10 8 10c-20 0-34-6-44-18z" fill="${c}" transform="rotate(0 32 32)"/><path d="M30 16l6-10 4 10M30 48l6 10 4-10" fill="${c}"/></svg>`;
    case 'pulse':return `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="7" fill="${c}"/><circle cx="32" cy="32" r="16" fill="none" stroke="${c}" stroke-width="3"/><circle cx="32" cy="32" r="25" fill="none" stroke="${c}" stroke-width="3" opacity=".6"/></svg>`;
    case 'triple':return `<svg viewBox="0 0 64 64"><g fill="${c}"><path d="M8 30h12l-4 10 14-16H18l4-10z"/><path d="M24 30h12l-4 10 14-16H34l4-10z"/><path d="M40 30h12l-4 10 14-16H50l4-10z"/></g></svg>`;
  }
}
let itemBoxes=[],tokens=[],mines=[],missiles=[];
const pickupGroup=new THREE.Group();scene.add(pickupGroup);
function buildPickups(){
  const boxG=starGeo(1.1,.5);const boxMat=new THREE.MeshPhysicalMaterial({color:0xd4a843,metalness:.85,roughness:.18,emissive:0xd4a843,emissiveIntensity:.18,clearcoat:1});
  const coreG=new THREE.IcosahedronGeometry(.42,1);const coreMat=new THREE.MeshStandardMaterial({color:0x000,emissive:0x00d9b5,emissiveIntensity:3});
  const rows=[0.11,0.30,0.47,0.64,0.80,0.93];
  rows.forEach(u=>{[-5,-1.7,1.7,5].forEach(lat=>{const g=new THREE.Group();const m=new THREE.Mesh(boxG,boxMat);m.castShadow=true;g.add(m);const cc=new THREE.Mesh(coreG,coreMat);g.add(cc);pickupGroup.add(g);itemBoxes.push({u,lat,mesh:g,star:m,core:cc,t:0});});});
  // tokens: gold hex coins in arcs
  const tokG=new THREE.CylinderGeometry(.5,.5,.12,6);tokG.rotateX(Math.PI/2);const tokMat=new THREE.MeshPhysicalMaterial({color:0xd4a843,metalness:.9,roughness:.2,emissive:0xd4a843,emissiveIntensity:.35,clearcoat:.8});
  const embG=starGeo(.24,.06);const embMat=new THREE.MeshStandardMaterial({color:0x2a1a04,roughness:.5,metalness:.4});
  const arcs=[[0.06,-3,1],[0.2,3,-1],[0.38,-4,.5],[0.55,0,0],[0.72,4,-.5],[0.86,-2,1]];
  arcs.forEach(([u0,lat0,dir])=>{for(let k=0;k<6;k++){const u=u0+k*0.0045,lat=lat0+Math.sin(k*.9)*dir*2.2;const g=new THREE.Group();g.add(new THREE.Mesh(tokG,tokMat));const e=new THREE.Mesh(embG,embMat);e.position.z=.07;g.add(e);const e2=e.clone();e2.position.z=-.07;g.add(e2);pickupGroup.add(g);tokens.push({u,lat,mesh:g,t:0});}});
}
const _p=new THREE.Vector3(),_q=new THREE.Quaternion(),_m=new THREE.Matrix4();
function orientOnTrack(obj,u,lat,h,yaw=0){trackPoint(u,lat,h,obj.position);trackTan(u,_v1);trackUp(u,_v2);trackRight(u,_v3);
  if(yaw){_v1.applyAxisAngle(_v2,yaw);_v3.crossVectors(_v1,_v2);}
  _p.copy(_v1).negate();_m.makeBasis(_v3,_v2,_p);obj.quaternion.setFromRotationMatrix(_m);}

// ---------- Particles (sparks, boost trail, token bursts) ----------
class ParticlePool{
  constructor(n,color,size,additive=true){this.n=n;this.pos=new Float32Array(n*3);this.vel=new Float32Array(n*3);this.life=new Float32Array(n);this.maxl=new Float32Array(n);this.head=0;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));this.alpha=new Float32Array(n);g.setAttribute('alpha',new THREE.BufferAttribute(this.alpha,1));
    const m=new THREE.PointsMaterial({size,map:TEX.spark,color,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,sizeAttenuation:true});
    m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float alpha;varying float vA;').replace('#include <fog_vertex>','#include <fog_vertex>\nvA=alpha;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vA;').replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( diffuse, opacity*vA );');};
    this.mesh=new THREE.Points(g,m);this.mesh.frustumCulled=false;scene.add(this.mesh);this.gravity=0;this.color=m;
  }
  emit(p,v,life,spread=0){const i=this.head;this.head=(i+1)%this.n;this.pos[i*3]=p.x+(rng()-.5)*spread;this.pos[i*3+1]=p.y+(rng()-.5)*spread;this.pos[i*3+2]=p.z+(rng()-.5)*spread;this.vel[i*3]=v.x;this.vel[i*3+1]=v.y;this.vel[i*3+2]=v.z;this.life[i]=Math.max(.001,life);this.maxl[i]=this.life[i];this.alpha[i]=1;}
  clear(){this.life.fill(0);this.alpha.fill(0);this.mesh.geometry.attributes.alpha.needsUpdate=true;}
  update(dt){let active=false;for(let i=0;i<this.n;i++){if(this.life[i]<=0){this.alpha[i]=0;continue;}active=true;this.life[i]-=dt;this.vel[i*3+1]+=this.gravity*dt;this.pos[i*3]+=this.vel[i*3]*dt;this.pos[i*3+1]+=this.vel[i*3+1]*dt;this.pos[i*3+2]+=this.vel[i*3+2]*dt;this.alpha[i]=clamp(this.life[i]/this.maxl[i],0,1);}
    this.mesh.visible=active;this.mesh.geometry.attributes.position.needsUpdate=active;this.mesh.geometry.attributes.alpha.needsUpdate=true;}
}
let sparksBlue,sparksOrange,sparksPink,boostFx,goldFx,smokeFx,hitFx;
function buildParticles(){sparksBlue=new ParticlePool(600,0x66aaff,1.1);sparksOrange=new ParticlePool(600,0xffa040,1.25);sparksPink=new ParticlePool(600,0xff5fd0,1.5);boostFx=new ParticlePool(900,0x00d9b5,2.2);goldFx=new ParticlePool(300,0xffd77a,1.6);smokeFx=new ParticlePool(500,0x7a8090,2.4,false);hitFx=new ParticlePool(300,0xff5a3a,2);sparksBlue.gravity=sparksOrange.gravity=sparksPink.gravity=-14;goldFx.gravity=-8;smokeFx.gravity=1.5;smokeFx.color.opacity=.35;}

// ---------- Procedural audio (Web Audio) ----------
const AUDIO={ctx:null,on:true,master:null,voices:0,failed:false};
function audioInit(){
  if(AUDIO.failed)return;
  if(AUDIO.ctx){if(AUDIO.ctx.state==='suspended')AUDIO.ctx.resume().catch(()=>{});return;}
  const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor){AUDIO.failed=true;return;}
  let C;
  try{
    C=new AudioCtor();
    const master=C.createGain();master.gain.value=AUDIO.on?.42:0;
    // A safety limiter keeps stacked pickups, engine and collisions comfortable.
    const limiter=C.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.18;
    master.connect(limiter);limiter.connect(C.destination);
    const eng=C.createGain();eng.gain.value=0;eng.connect(master);
    const lp=C.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;lp.Q.value=.75;lp.connect(eng);
    const mk=(type,det)=>{const o=C.createOscillator();o.type=type;o.detune.value=det;o.connect(lp);o.start();return o;};
    const osc=[mk('sawtooth',0),mk('sawtooth',-9),mk('sine',0)];
    const buf=C.createBuffer(1,Math.floor(C.sampleRate*2),C.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const noise=(type,frequency,volume,rate=1)=>{
      const source=C.createBufferSource();source.buffer=buf;source.loop=true;source.playbackRate.value=rate;
      const filter=C.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=.7;
      const gain=C.createGain();gain.gain.value=volume;source.connect(filter);filter.connect(gain);gain.connect(master);source.start();return {gain,filter};
    };
    const drift=noise('bandpass',1800,0),wind=noise('lowpass',400,0);
    noise('bandpass',600,.015,.5);
    Object.assign(AUDIO,{ctx:C,master,osc,engGain:eng,lp,noiseGain:drift.gain,noiseBP:drift.filter,windGain:wind.gain});
    if(C.state==='suspended')C.resume().catch(()=>{});
  }catch(error){if(C)C.close().catch(()=>{});AUDIO.ctx=null;AUDIO.failed=true;}
}
function audioAllowed(){return AUDIO.ctx&&AUDIO.ctx.state!=='closed'&&AUDIO.on&&!document.hidden&&game.state!=='paused'&&AUDIO.voices<32;}
function tone(f,dur,type='sine',vol=.25,slide=0,delay=0){
  if(!audioAllowed())return;
  const C=AUDIO.ctx,o=C.createOscillator(),g=C.createGain(),start=C.currentTime+Math.max(0,delay);dur=Math.max(.03,dur);
  o.type=type;o.frequency.setValueAtTime(Math.max(20,f),start);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),start+dur);
  g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(vol,start+.012);g.gain.exponentialRampToValueAtTime(.0001,start+dur);
  o.connect(g);g.connect(AUDIO.master);AUDIO.voices++;
  o.onended=()=>{o.disconnect();g.disconnect();AUDIO.voices=Math.max(0,AUDIO.voices-1);};
  o.start(start);o.stop(start+dur+.03);
}
function noiseHit(dur=.25,vol=.5,f=300){
  if(!audioAllowed())return;
  const C=AUDIO.ctx,b=C.createBuffer(1,Math.max(1,Math.floor(C.sampleRate*dur)),C.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  const source=C.createBufferSource();source.buffer=b;
  const filter=C.createBiquadFilter();filter.type='lowpass';filter.frequency.value=f;
  const gain=C.createGain();gain.gain.value=vol;source.connect(filter);filter.connect(gain);gain.connect(AUDIO.master);AUDIO.voices++;
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();AUDIO.voices=Math.max(0,AUDIO.voices-1);};source.start();
}
// Visibility events are synchronous even when animation frames stop in a hidden tab.
document.addEventListener('visibilitychange',()=>{if(!AUDIO.master)return;const t=AUDIO.ctx.currentTime;AUDIO.master.gain.cancelScheduledValues(t);AUDIO.master.gain.setValueAtTime(0,t);});
const SFX={
  count:()=>tone(660,.18,'square',.22),go:()=>{tone(880,.5,'square',.25);tone(1320,.5,'square',.15,0,.02);},
  token:(n)=>{tone(1200+n*60,.09,'sine',.2,600);tone(1800+n*60,.12,'sine',.12,900,.05);},
  box:()=>{[0,1,2,3].forEach(i=>tone(520*Math.pow(1.26,i),.1,'triangle',.18,0,i*.06));},
  boost:(lvl=1)=>{noiseHit(.5,.35,1600);tone(220,.55,'sawtooth',.18,700+lvl*200);},
  driftTier:(lvl)=>tone(700+lvl*250,.12,'square',.14,300),
  hit:()=>{noiseHit(.35,.7,500);tone(160,.4,'sawtooth',.3,-100);},
  shieldBlock:()=>{tone(1500,.2,'sine',.3,-400);tone(2200,.3,'sine',.15,-1000,.05);},
  fire:()=>{noiseHit(.3,.4,3000);tone(400,.3,'sawtooth',.2,1200);},
  pulse:()=>{tone(90,1.2,'sine',.5,900);noiseHit(.9,.3,800);},
  lap:()=>{[0,4,7,12].forEach((s,i)=>tone(440*Math.pow(2,s/12),.25,'triangle',.2,0,i*.09));},
  finish:()=>{[0,4,7,12,16,19,24].forEach((s,i)=>tone(330*Math.pow(2,s/12),.5,'triangle',.22,0,i*.11));},
  wall:()=>noiseHit(.15,.35,900),
  ui:()=>tone(1000,.06,'square',.08),
};
function audioUpdate(dt,player,rms){ if(!AUDIO.ctx||AUDIO.ctx.state==='closed')return;const C=AUDIO.ctx;const t=C.currentTime;
  const on=AUDIO.on&&!document.hidden&&game.state!=='paused';AUDIO.master.gain.setTargetAtTime(on?.42:0,t,.04);
  const racing=game.state==='race'||game.state==='countdown'||game.state==='finish';
  const spd=player?player.speed:0,max=player?player.maxSpeed:40;const r=clamp(spd/Math.max(1,max),0,1.3);
  const gear=Math.floor(r*3.999),gr=(r*4)%1;const f=70+gr*95+gear*18+(player&&player.boost>0?40:0);
  AUDIO.osc[0].frequency.setTargetAtTime(f,t,.05);AUDIO.osc[1].frequency.setTargetAtTime(f*1.005,t,.05);AUDIO.osc[2].frequency.setTargetAtTime(f*.5,t,.05);
  AUDIO.lp.frequency.setTargetAtTime(500+r*1800+(player&&player.throttle?300:0),t,.08);
  AUDIO.engGain.gain.setTargetAtTime(racing?.09+r*.05:0,t,.1);
  AUDIO.noiseGain.gain.setTargetAtTime(racing&&player&&player.drifting?.10+player.driftTier*.03:0,t,.06);AUDIO.noiseBP.frequency.setTargetAtTime(1200+r*1200,t,.1);
  AUDIO.windGain.gain.setTargetAtTime(racing?r*r*.10+(player&&player.boost>0?.12:0):0,t,.15);
}
