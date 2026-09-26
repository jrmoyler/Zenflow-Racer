/* Shared solar direction and anchored environmental motion. All clocks follow simulation dt. */
const LIVING_WORLD={rigs:[],leaves:[],fx:null,time:0,timeline:null,gust:{value:0},lastLeaf:-1,batches:[],matrix:new THREE.Matrix4()};
function buildLivingWorld(){
  const state=LIVING_WORLD;
  state.timeline?.cancel();state.rigs=[];state.leaves=[];state.batches=[];state.time=0;state.lastLeaf=-1;state.gust.value=0;
  // A paused Anime.js envelope is advanced only by the game clock; pause cannot drift.
  state.timeline=globalThis.anime?.animate?globalThis.anime.animate(state.gust,{value:[0,1,0],duration:8000,ease:'inOutSine',autoplay:false}):null;
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.reduced=reduced;
  const seen=new Set();world.traverse(m=>{
    if(!m.isMesh)return;
    if(m.material?.isMeshStandardMaterial){m.receiveShadow=true;}
    if(m.geometry?.userData.wind&&!seen.has(m.geometry)){
      seen.add(m.geometry);const g=m.geometry;g.computeBoundingBox();
      state.leaves.push({g,base:g.attributes.position.array.slice(),min:g.boundingBox.min.y,height:Math.max(1,g.boundingBox.max.y-g.boundingBox.min.y)});
      g.computeBoundingSphere();g.boundingSphere.radius+=.6;
    }
  });
  const root=new THREE.Group();root.name='living-world-rigs';world.add(root);
  const fabric=new THREE.MeshStandardMaterial({color:activeMap.id==='cherry'?0xcf647e:activeMap.id==='stormforge'?0xe6a540:0x5aa88c,roughness:.92,side:THREE.DoubleSide,map:TEX.fabricWeave||null});
  const metal=new THREE.MeshStandardMaterial({color:0x6c6558,metalness:.72,roughness:.42,bumpMap:TEX.metalGrain||null,bumpScale:.025});
  const paper=new THREE.MeshStandardMaterial({color:0xffe1a5,emissive:0xffad48,emissiveIntensity:.48,roughness:.84,map:TEX.fabricWeave||null});
  const poleGeo=new THREE.CylinderGeometry(.09,.13,6,8),armGeo=new THREE.CylinderGeometry(.07,.07,1.7,8),cordGeo=new THREE.CylinderGeometry(.025,.025,.8,5),shadeGeo=new THREE.SphereGeometry(.44,12,8),capGeo=new THREE.CylinderGeometry(.28,.28,.09,10);
  for(const [i,island] of (world.userData.islands||[]).entries()){
    const mount=new THREE.Group();mount.name='island-wind-mount-'+i;mount.position.set(island.x+island.r*.55,island.y+.4,island.z);root.add(mount);
    const pole=new THREE.Mesh(poleGeo,metal);pole.position.y=3;mount.add(pole);
    const arm=new THREE.Mesh(armGeo,metal);arm.rotation.z=Math.PI/2;arm.position.set(.75,5.8,0);mount.add(arm);
    const hinge=new THREE.Group();hinge.name='suspension-hinge';hinge.position.set(1.5,5.8,0);mount.add(hinge);
    const cord=new THREE.Mesh(cordGeo,metal);cord.position.y=-.4;hinge.add(cord);
    const shade=new THREE.Mesh(shadeGeo,paper);shade.scale.y=1.28;shade.position.y=-1.3;hinge.add(shade);
    for(const y of[-.78,-1.83]){const cap=new THREE.Mesh(capGeo,metal);cap.position.y=y;hinge.add(cap);}
    const g=new THREE.BufferGeometry(),data=WORLD_MOTION_DATA.fabric;
    g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.setIndex(data.indices);g.computeVertexNormals();
    const flag=new THREE.Mesh(g,fabric);flag.position.set(.07,5.45,0);flag.castShadow=true;mount.add(flag);
    g.computeBoundingSphere();g.boundingSphere.radius+=.4;
    state.rigs.push({hinge,flag,base:g.attributes.position.array.slice(),phase:i*.71});
  }
  root.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
  // Instance repeated rigid pieces, including moving lantern parts. Pivot groups
  // remain the transform authority without paying one draw call per small mesh.
  root.updateMatrixWorld(true);const batches=new Map();
  root.traverse(m=>{if(!m.isMesh||m.geometry.attributes.position.count===WORLD_MOTION_DATA.fabric.positions.length/3)return;const key=m.geometry.uuid+':'+m.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(m);});
  for(const list of batches.values()){
    const mesh=new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    const sources=list.map(m=>{m.updateMatrix();const source={parent:m.parent,local:m.matrix.clone()};m.parent.remove(m);return source;});
    root.add(mesh);state.batches.push({mesh,sources});
  }
  syncLivingInstances();
  buildLivingAtmosphere();
  root.userData={rigCount:state.rigs.length,leafGeometries:state.leaves.length,source:WORLD_MOTION_DATA.source};
}
function syncLivingInstances(){
  for(const batch of LIVING_WORLD.batches){for(let i=0;i<batch.sources.length;i++){
    const src=batch.sources[i];src.parent.updateWorldMatrix(true,false);
    LIVING_WORLD.matrix.multiplyMatrices(src.parent.matrixWorld,src.local);batch.mesh.setMatrixAt(i,LIVING_WORLD.matrix);
  }batch.mesh.instanceMatrix.needsUpdate=true;}
}
function updateLivingWorld(dt){
  const s=LIVING_WORLD;if(!Number.isFinite(dt)||dt<=0)return;
  s.dt=Math.min(dt,.1);s.time+=s.dt;s.timeline?.seek((s.time*1000)%8000);
  const strength=s.reduced?.18:1,wind=(.65+s.gust.value*.35)*strength*(activeMap.id==='stormforge'?1.4:1);
  const clip=WORLD_MOTION_DATA.hinge;
  for(const r of s.rigs){
    const phase=((s.time+r.phase)%4)/4*(clip.length-1),i=Math.floor(phase);
    r.hinge.rotation.z=(clip[i]+(clip[Math.min(i+1,clip.length-1)]-clip[i])*(phase-i))*wind;
  }
  syncLivingInstances();
  updateLivingAtmosphere(s,wind);
  // Bounded 15/10 Hz deformation shared by every instance of each leaf geometry.
  const frame=Math.floor(s.time*(MOBILEFX||LOWFX?10:15));if(frame===s.lastLeaf)return;s.lastLeaf=frame;
  for(const r of s.rigs){const p=r.flag.geometry.attributes.position;
    for(let i=0;i<p.count;i++){const k=i*3,u=r.base[k]/2.8;p.array[k+2]=r.base[k+2]+u*u*.22*wind*Math.sin(u*8-s.time*3+r.phase);}
    p.needsUpdate=true;r.flag.geometry.computeVertexNormals();
  }
  for(const leaf of s.leaves){const p=leaf.g.attributes.position;
    for(let i=0;i<p.count;i++){const k=i*3,x=leaf.base[k],y=leaf.base[k+1],z=leaf.base[k+2],weight=Math.max(0,(y-leaf.min)/leaf.height);p.array[k]=x+weight*weight*.16*wind*Math.sin(s.time*1.7+y*.7+z*.4);}
    p.needsUpdate=true;
  }
}


// ---------- Atmosphere: foundry sparks, heat shimmer, steam, spray and seabirds ----------
// Particles are evaluated on the GPU from one simulation-time uniform: no per-frame buffer
// uploads. Every resource lives under `world`, so a map switch disposes it with the scenery.
const LIVING_FX_SHADER={
 sparkVertex:`attribute vec4 seed;attribute float burst;uniform float time;uniform float pixelScale;varying float vHeat;varying float vAlpha;
void main(){float life=.7+seed.w*.9,t=mod(time+seed.w*11.7,life),k=t/life;
vec3 p=position+seed.xyz*t+vec3(0.,-4.905*t*t,0.);
// Sparks skitter on the yard floor instead of falling through it.
p.y=max(p.y,position.y-1.05);
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
float gate=pow(.5+.5*sin(time*1.3+burst),4.);
vHeat=1.-k;vAlpha=smoothstep(0.,.04,k)*(1.-k)*gate;
gl_PointSize=clamp((.05+.13*vHeat)*pixelScale/max(1.,-mv.z),1.,14.);}`,
 sparkFragment:`varying float vHeat;varying float vAlpha;
void main(){float r=length(gl_PointCoord-.5);float a=1.-smoothstep(.05,.5,r);
// Blackbody cooling: white-yellow at ejection, deep orange as the droplet cools.
vec3 c=mix(vec3(1.,.26,.04),vec3(1.,.92,.68),vHeat*vHeat);gl_FragColor=vec4(c*(1.2+2.6*vHeat),a*vAlpha);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`,
 plumeVertex:`attribute vec4 seed;uniform float time;uniform float pixelScale;uniform vec3 drift;uniform float rise;uniform float life;uniform float grow;varying float vAlpha;varying float vShade;
#include <fog_pars_vertex>
void main(){float t=mod(time+seed.w*life,life),k=t/life;
vec3 p=position+vec3(seed.x,0.,seed.z)*seed.y*(.3+k)+vec3(0.,rise*t*(1.-.35*k),0.)+drift*t*t*.5;
vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
vAlpha=smoothstep(0.,.12,k)*(1.-smoothstep(.55,1.,k));vShade=.82+.18*seed.x;
gl_PointSize=clamp(seed.y*(1.+k*grow)*pixelScale/max(1.,-mvPosition.z),1.,220.);
#include <fog_vertex>
}`,
 plumeFragment:`uniform vec3 tint;uniform float opacity;varying float vAlpha;varying float vShade;
#include <fog_pars_fragment>
void main(){vec2 d=gl_PointCoord-.5;float r=length(d);
// Soft, self-shadowed puff: brighter crown, denser core, feathered rim.
float a=(1.-smoothstep(0.,.5,r))*(.75+.25*sin(d.x*9.+d.y*7.));vec3 c=tint*vShade*(1.05-.3*d.y);
gl_FragColor=vec4(c,a*vAlpha*opacity);
#include <tonemapping_fragment>
#include <encodings_fragment>
#include <fog_fragment>
}`,
 petalVertex:`attribute vec4 seed;uniform float time;uniform float pixelScale;varying float vAlpha;varying float vSpin;varying float vShade;
#include <fog_pars_vertex>
void main(){float life=7.+seed.w*6.,t=mod(time+seed.x*life,life),k=t/life;
// Downwind drift with a slow fall, a pendulum sway and a helical flutter.
vec3 p=position+vec3(1.6,0.,.7)*t*(.8+seed.y*.5)+vec3(0.,-.55*t,0.);
float sw=sin(t*(1.6+seed.z*1.4)+seed.y*6.28);p.x+=sw*.8;p.z+=cos(t*1.9+seed.z*6.28)*.6;p.y+=abs(sw)*.25;
vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
vAlpha=smoothstep(0.,.08,k)*(1.-smoothstep(.8,1.,k));vSpin=t*(2.+seed.z*3.)+seed.w*6.28;
// Edge-on petals catch less light: shade by the flutter phase.
vShade=.72+.28*abs(cos(t*3.1+seed.y*9.));
gl_PointSize=clamp((.16+.07*seed.z)*pixelScale/max(1.,-mvPosition.z),1.,34.);
#include <fog_vertex>
}`,
 petalFragment:`varying float vAlpha;varying float vSpin;varying float vShade;
#include <fog_pars_fragment>
void main(){vec2 d=gl_PointCoord-.5;float c=cos(vSpin),s=sin(vSpin);d=vec2(c*d.x-s*d.y,s*d.x+c*d.y);
// Cherry petal: a foreshortened ellipse with the notched tip, flushed toward the base.
vec2 q=d*vec2(2.6,1.7);float body=1.-smoothstep(.34,.46,length(q));float notch=smoothstep(.02,.09,length(vec2(d.x,d.y-.2)*vec2(3.2,1.)));float a=body*notch;
if(a<.02)discard;vec3 col=mix(vec3(.96,.8,.86),vec3(.78,.33,.5),smoothstep(.2,-.25,d.y))*vShade;
gl_FragColor=vec4(col,a*vAlpha*.92);
#include <tonemapping_fragment>
#include <encodings_fragment>
#include <fog_fragment>
}`,
 hazeVertex:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 hazeFragment:`varying vec2 vUv;uniform float time;
void main(){float y=vUv.y;float n=sin(vUv.x*25.+time*2.1+sin(y*9.-time*3.7)*2.)*.5+.5;
float shimmer=.55+.45*sin(y*31.-time*6.+n*3.);float a=pow(1.-y,2.2)*(.35+.65*n)*shimmer*.28;
gl_FragColor=vec4(vec3(1.,.55,.22)*(.8+1.2*(1.-y)),a);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`
};
function livingParticles(name,count,fill,material){
 const pos=new Float32Array(count*3),seed=new Float32Array(count*4),burst=new Float32Array(count);
 for(let i=0;i<count;i++)fill(i,pos,seed,burst);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('seed',new THREE.BufferAttribute(seed,4));g.setAttribute('burst',new THREE.BufferAttribute(burst,1));
 const points=new THREE.Points(g,material);points.name=name;points.frustumCulled=false;points.userData.dynamic=true;return points;
}
function buildLivingAtmosphere(){
 const s=LIVING_WORLD;s.fx=null;
 if(typeof world==='undefined')return;
 const root=new THREE.Group();root.name='living-world-atmosphere';world.add(root);
 const fx={root,uniforms:[],time:{value:0},pixelScale:{value:400},gulls:null,beacon:null,beaconClock:0};s.fx=fx;
 const rnd=mulberry(5519),mobile=typeof MOBILEFX!=='undefined'&&MOBILEFX,fog=typeof scene!=='undefined'&&scene.fog;
 const plume=(name,sources,perSource,params)=>{
  if(!sources.length)return null;
  const uniforms={...(THREE.UniformsUtils?THREE.UniformsUtils.clone(THREE.UniformsLib.fog):{}),time:fx.time,pixelScale:fx.pixelScale,drift:{value:new THREE.Vector3(...params.drift)},rise:{value:params.rise},life:{value:params.life},grow:{value:params.grow},tint:{value:new THREE.Color(params.tint)},opacity:{value:params.opacity}};
  const mat=new THREE.ShaderMaterial({name,uniforms,vertexShader:LIVING_FX_SHADER.plumeVertex,fragmentShader:LIVING_FX_SHADER.plumeFragment,transparent:true,depthWrite:false,fog:!!fog});
  const count=sources.length*perSource;
  const points=livingParticles(name,count,(i,pos,seed)=>{const src=sources[Math.floor(i/perSource)],a=rnd()*Math.PI*2;pos[i*3]=src.x;pos[i*3+1]=src.y;pos[i*3+2]=src.z;seed[i*4]=Math.cos(a);seed[i*4+1]=src.r*(.7+rnd()*.6);seed[i*4+2]=Math.sin(a);seed[i*4+3]=rnd();},mat);
  root.add(points);return points;
 };
 // Spray at the foot of each island waterfall: tall falls atomise before they reach the sea.
 const falls=(world.userData.islands||[]).slice(0,mobile?10:24).map(island=>({x:island.x,y:island.y-island.depth-34,z:island.z+island.r*.8+2.5,r:island.r*.22}));
 plume('waterfall-spray',falls,mobile?4:7,{drift:[.25,0,.12],rise:1.6,life:9,grow:1.4,tint:activeMap.id==='canopy'?0xeef8fb:activeMap.id==='cherry'?0xe4d8e6:0xd9dfe8,opacity:.42});
 const vista=world.userData.vista;
 if(activeMap.id==='stormforge'){
  // Cooling-tower steam drifts downwind and billows; chimneys trail thin smoke.
  if(vista?.vents?.length)plume('cooling-tower-steam',vista.vents,mobile?7:12,{drift:[1.1,0,.45],rise:7.5,life:16,grow:2.2,tint:0xe9ecef,opacity:.5});
  if(vista?.stacks?.length)plume('chimney-smoke',vista.stacks.map(p=>({...p,r:4})),mobile?4:7,{drift:[1.4,0,.5],rise:4,life:14,grow:2.8,tint:0x7d8088,opacity:.34});
  const emitters=world.userData.sparkEmitters||[],per=mobile?28:56;
  if(emitters.length){
   const mat=new THREE.ShaderMaterial({name:'foundry-sparks',uniforms:{time:fx.time,pixelScale:fx.pixelScale},vertexShader:LIVING_FX_SHADER.sparkVertex,fragmentShader:LIVING_FX_SHADER.sparkFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
   root.add(livingParticles('foundry-sparks',emitters.length*per,(i,pos,seed,burst)=>{const e=emitters[Math.floor(i/per)],sp=2.5+rnd()*4.5,lat=(rnd()-.5)*3;pos[i*3]=e.x;pos[i*3+1]=e.y;pos[i*3+2]=e.z;seed[i*4]=e.dx*sp-e.dz*lat;seed[i*4+1]=1.5+rnd()*4.2;seed[i*4+2]=e.dz*sp+e.dx*lat;seed[i*4+3]=rnd();burst[i]=Math.floor(i/per)*2.39;},mat));
  }
  const vents=world.userData.heatVents||[];
  if(vents.length){
   const hazeMat=new THREE.ShaderMaterial({name:'furnace-heat-shimmer',uniforms:{time:fx.time},vertexShader:LIVING_FX_SHADER.hazeVertex,fragmentShader:LIVING_FX_SHADER.hazeFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
   // All shimmer columns share one draw: the template is baked at each chimney mouth.
   const parts=vents.map(v=>new THREE.CylinderGeometry(1.5,.6,7,16,1,true).translate(v.x,v.y+3.5,v.z));
   const g=typeof mergeGeos==='function'?mergeGeos(parts):parts[0];if(g!==parts[0])parts.forEach(p=>p.dispose());
   const m=new THREE.Mesh(g,hazeMat);m.name='furnace-heat-shimmer';m.userData.dynamic=true;root.add(m);
  }
  if(vista?.beaconMaterial)fx.beacon=vista.beaconMaterial;
 }else if(activeMap.id==='cherry'){
  // Blossom gusts: petals shed from the road-side canopies, tumble on the wind and flutter
  // down across the racing line. Each petal is a GPU point with its own spin and sway.
  const per=mobile?5:11,sources=[];if(typeof track!=='undefined'&&track.pos)for(let i=0;i<N_SAMP;i+=Math.max(1,Math.floor(N_SAMP/(mobile?40:64)))){const p=track.pos[i];sources.push({x:p.x,y:p.y,z:p.z});}
  if(sources.length){
   const mat=new THREE.ShaderMaterial({name:'cherry-petal-drift',uniforms:{...(THREE.UniformsUtils?THREE.UniformsUtils.clone(THREE.UniformsLib.fog):{}),time:fx.time,pixelScale:fx.pixelScale},vertexShader:LIVING_FX_SHADER.petalVertex,fragmentShader:LIVING_FX_SHADER.petalFragment,transparent:true,depthWrite:false,fog:!!fog});
   root.add(livingParticles('cherry-petal-drift',sources.length*per,(i,pos,seed)=>{const src=sources[Math.floor(i/per)],a=rnd()*Math.PI*2,d=4+rnd()*16;pos[i*3]=src.x+Math.cos(a)*d;pos[i*3+1]=src.y+3+rnd()*9;pos[i*3+2]=src.z+Math.sin(a)*d;seed[i*4]=rnd();seed[i*4+1]=rnd();seed[i*4+2]=rnd();seed[i*4+3]=rnd();},mat));
  }
 }else if(activeMap.id==='canopy'){
  // Gulls ride the updraft around the garden islands; wings flap then glide.
  const count=mobile?18:36,geo=gullGeometry(),mat=new THREE.MeshStandardMaterial({color:0xeef1f2,roughness:.7,side:THREE.DoubleSide});
  const flap={value:0};mat.onBeforeCompile=shader=>{shader.uniforms.flapTime=flap;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float flapTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
float ph=instanceMatrix[3].x*.37+instanceMatrix[3].z*.21;float glide=smoothstep(-.2,.6,sin(flapTime*.45+ph));
transformed.y+=sin(flapTime*8.5+ph)*abs(transformed.x)*.55*glide;
#endif`);};
  mat.customProgramCacheKey=()=>'zen-gull-flap';
  const mesh=new THREE.InstancedMesh(geo,mat,count);mesh.name='canopy-gulls';mesh.frustumCulled=false;mesh.castShadow=false;mesh.userData.dynamic=true;root.add(mesh);
  const islands=world.userData.islands||[],birds=[];
  for(let i=0;i<count;i++){const host=islands[(i*7)%Math.max(1,islands.length)]||{x:0,y:0,z:0,r:30};birds.push({cx:host.x,cz:host.z,y:host.y+14+rnd()*26,r:host.r+10+rnd()*30,w:(rnd()<.5?-1:1)*(7+rnd()*5),a:rnd()*Math.PI*2,s:1.6+rnd()*.8});}
  fx.gulls={mesh,birds,flap,m:new THREE.Matrix4(),q:new THREE.Quaternion(),e:new THREE.Euler(0,0,0,'YXZ'),p:new THREE.Vector3(),sc:new THREE.Vector3()};
  updateGulls(fx,0);
 }
}
// Gull: cranked, swept wings with a tapered body (span 1 m before instance scale).
function gullGeometry(){
 const p=[],tri=(...v)=>{for(const q of v)p.push(...q);};
 for(const side of [-1,1]){const root=[side*.06,0,.1],rootT=[side*.06,0,-.16],elbow=[side*.36,.07,.06],elbowT=[side*.36,.07,-.14],tip=[side*.5,.02,-.18];
  tri(root,elbow,rootT);tri(rootT,elbow,elbowT);tri(elbow,tip,elbowT);}
 const nose=[0,0,.34],tail=[0,.01,-.3],l=[-.06,0,0],r=[.06,0,0],top=[0,.07,0],bot=[0,-.06,.02];
 tri(nose,l,top);tri(nose,top,r);tri(nose,r,bot);tri(nose,bot,l);tri(tail,top,l);tri(tail,r,top);tri(tail,bot,r);tri(tail,l,bot);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;
}
function updateGulls(fx,dt){
 const G=fx.gulls;if(!G)return;
 for(let i=0;i<G.birds.length;i++){const b=G.birds[i];b.a+=dt*b.w/b.r;
  G.p.set(b.cx+Math.cos(b.a)*b.r,b.y+Math.sin(b.a*2+i)*1.5,b.cz+Math.sin(b.a)*b.r);
  // Heading is the circle tangent; bank into the turn like a real soaring bird.
  G.e.set(0,-b.a+(b.w>0?Math.PI:0),b.w>0?-.35:.35);G.q.setFromEuler(G.e);G.sc.setScalar(b.s);G.m.compose(G.p,G.q,G.sc);G.mesh.setMatrixAt(i,G.m);}
 G.mesh.instanceMatrix.needsUpdate=true;
}
function updateLivingAtmosphere(s,wind){
 const fx=s.fx;if(!fx)return;
 fx.time.value=s.time*(s.reduced?.35:1);
 // gl_PointSize is in framebuffer pixels: half-height over tan(fov/2), times the device ratio.
 if(typeof innerHeight!=='undefined'){const fov=typeof camera!=='undefined'&&camera.fov?camera.fov:70,ratio=typeof renderer!=='undefined'&&renderer?.getPixelRatio?renderer.getPixelRatio():1;fx.pixelScale.value=innerHeight*.5*ratio/Math.tan(fov*Math.PI/360);}
 if(fx.gulls){fx.gulls.flap.value=fx.time.value;updateGulls(fx,s.reduced?0:Math.min(.1,s.dt||0));}
 // Aviation obstruction lights flash ~40 per minute.
 if(fx.beacon)fx.beacon.emissiveIntensity=(s.time%1.5)<.35?2.6:.18;
}
