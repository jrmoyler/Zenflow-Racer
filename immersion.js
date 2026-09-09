// Premium immersion layer: weather, water, landmarks, pulsing rails, mist.
// Built into `world` so selectMap() disposes GPU resources with the rest of the circuit.
const IMMERSION={weather:null,hero:null,flash:0,sea:null,birds:null,lanterns:null,mist:null};
const _imM=new THREE.Matrix4(),_imE=new THREE.Euler(),_imQ=new THREE.Quaternion(),_imP=new THREE.Vector3(),_imS=new THREE.Vector3(1,1,1);
function createImmersionWater(map,kind){
  const sea=kind==='sea',storm=map.id==='stormforge';
  const tint=new THREE.Color(sea?(map.id==='canopy'?0x17505b:storm?0x263b4a:0x31576a):(storm?0x486773:0x427e78));
  const material=new THREE.ShaderMaterial({
    name:'natural-water-'+kind,side:THREE.DoubleSide,transparent:!sea,depthWrite:sea,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),time:zenWorldTime,tint:{value:tint},gain:{value:sea?1:.25},
      skyTop:{value:new THREE.Color(map.skyTop||0x6f86d6)},skyHorizon:{value:new THREE.Color(map.skyHorizon||0xf4bcd6)},
      solarDirection:{value:typeof SOLAR_DIRECTION!=='undefined'?SOLAR_DIRECTION:new THREE.Vector3(-90,140,-60).normalize()},sunTint:{value:new THREE.Color(map.sun||0xffe5df)},storm:{value:storm?1:0}},
    vertexShader:`varying vec3 waterPosition;
#include <fog_pars_vertex>
void main(){vec4 worldPosition=modelMatrix*vec4(position,1.);waterPosition=worldPosition.xyz;
vec4 viewPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewPosition;
vec4 mvPosition=viewPosition;
#include <fog_vertex>
}`,
    fragmentShader:`varying vec3 waterPosition;
uniform float time;uniform vec3 tint;uniform float gain;uniform vec3 skyTop;uniform vec3 skyHorizon;uniform vec3 solarDirection;uniform vec3 sunTint;uniform float storm;
#include <fog_pars_fragment>
void main(){
// World-space wave gradients: adjacent pond/stream meshes share one phase.
vec2 p=waterPosition.xz;float t=time;
vec2 slope=vec2(0.);
float a=dot(p,vec2(.32,.18))-t*1.1;
float b=dot(p,vec2(-.22,.41))-t*.8;
float c=dot(p,vec2(.91,-.68))-t*1.9;
slope+=cos(a)*vec2(.32,.18)*.19;
slope+=cos(b)*vec2(-.22,.41)*.12;
slope+=cos(c)*vec2(.91,-.68)*.025;
slope*=mix(.55,1.3,gain)*(1.+storm*.5);
vec3 N=normalize(vec3(-slope.x,1.,-slope.y));
vec3 V=normalize(cameraPosition-waterPosition),L=normalize(solarDirection),H=normalize(V+L);
float nv=max(.001,abs(dot(N,V))),nl=max(.001,dot(N,L)),nh=max(0.,dot(N,H));
float fres=.0204+.9796*pow(1.-nv,5.);
vec3 R=reflect(-V,N);vec3 reflection=mix(skyHorizon,skyTop,smoothstep(0.,.85,R.y));
// GGX microfacet highlight. Roughness broadens the reflected solar path in wind.
float rough=mix(.09,.19,storm),alpha=rough*rough,a2=alpha*alpha;
float denom=nh*nh*(a2-1.)+1.;float D=a2/(3.14159265*denom*denom);
float k=(rough+1.)*(rough+1.)/8.;float G=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));
float F=.0204+.9796*pow(1.-max(0.,dot(H,V)),5.);
vec3 specular=sunTint*min(18.,D*G*F/max(.004,4.*nv*nl))*nl*(1.-storm*.65);
float shallow=.5+.5*sin(a)*sin(b);vec3 body=tint*mix(.68,1.12,shallow);
float crest=smoothstep(.91,1.,sin(a)*.6+sin(b)*.4)*gain*.10;
vec3 col=mix(body,reflection,fres)+specular+crest*vec3(.70,.79,.77);
gl_FragColor=vec4(col,mix(.86,1.,gain));
#include <tonemapping_fragment>
#include <encodings_fragment>
#include <fog_fragment>
}`
  });
  // The software renderer cannot execute GLSL. Keep the same real water mesh
  // visible using its explicitly provided diffuse/specular material parameters.
  material.userData.softwareSurface=true;material.color=tint;material.roughness=.16;material.metalness=0;material.opacity=sea?1:.86;
  return material;
}
function immersionBudget(n){return (typeof MOBILEFX!=='undefined'&&MOBILEFX)?Math.max(8,n>>1):n;}
function immersionAlongTrack(u,lat,h,out){if(typeof trackPoint==='function')return trackPoint(u,lat,h,out);out.set(0,h,0);return out;}
function immersionRand(seed){let s=seed|0;return()=>{s=s+0x6d2b79f5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function buildImmersionWeather(){
  const count=immersionBudget(activeMap.id==='canopy'?100:activeMap.id==='stormforge'?120:180);
  const pos=new Float32Array(count*3),col=new Float32Array(count*3),vel=new Float32Array(count*3);
  const color=new THREE.Color(),rnd=typeof mulberry==='function'?mulberry(910+activeMap.id.length):immersionRand(910);
  const palette=activeMap.id==='stormforge'?[0xff7a32,0xffc56a,0xffe7a3,0x6ec8ff]:activeMap.id==='canopy'?[0x7dff9a,0xc6ff7a,0xfff4a8,0x7ef0ff]:[0xffd5f3,0xf79cdc,0xffedf9,0xe77bc8];
  const p=new THREE.Vector3();
  for(let i=0;i<count;i++){
    const u=rnd(),lat=(rnd()-.5)*80,h=4+rnd()*28;
    immersionAlongTrack(u,lat,h,p);pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z;
    color.setHex(palette[i%palette.length]);col[i*3]=color.r;col[i*3+1]=color.g;col[i*3+2]=color.b;
    vel[i*3]=(rnd()-.5)*.8;vel[i*3+1]=activeMap.id==='stormforge'?1.6+rnd()*2.2:-(.6+rnd()*1.4);vel[i*3+2]=(rnd()-.5)*.8;
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const mat=new THREE.PointsMaterial({size:activeMap.id==='stormforge'?.28:.42,vertexColors:true,transparent:true,opacity:.92,depthWrite:false,sizeAttenuation:true,blending:THREE.NormalBlending});
  const points=new THREE.Points(geo,mat);points.name='immersion-weather';points.userData.dynamic=true;points.frustumCulled=false;
  world.add(points);
  IMMERSION.weather={points,pos,vel,count,floor:activeMap.id==='stormforge'?-8:2,ceil:activeMap.id==='stormforge'?48:36,rnd:immersionRand(4401)};
}
function buildImmersionRails(){
  if(typeof buildRibbon!=='function')return;
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:zenWorldTime,color:{value:new THREE.Color(activeMap.edge)}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float time;uniform vec3 color;
void main(){float pulse=.35+.65*sin(vUv.y*14.-time*3.2);float edge=smoothstep(0.,.25,vUv.x)*smoothstep(0.,.25,1.-vUv.x);
gl_FragColor=vec4(color,pulse*edge*.55);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`});
  const W=typeof TRACK_W==='number'?TRACK_W/2:7;
  for(const side of[-1,1]){
    const mesh=buildRibbon([[side*(W-.55),.058],[side*(W-.18),.058]].sort((a,b)=>a[0]-b[0]),mat);
    mesh.userData.dynamic=true;mesh.name='immersion-rail';world.add(mesh);
  }
}
function buildImmersionMist(){
  try{
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');if(!ctx)return;
  const g=ctx.createRadialGradient(64,64,6,64,64,62);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(.5,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex,color:activeMap.id==='stormforge'?0xc9d4e6:activeMap.id==='canopy'?0xd7f4ea:0xf3e4f4,transparent:true,opacity:.55,depthWrite:false,fog:true});
  mat.userData.mapTexture=tex;
  const rnd=typeof mulberry==='function'?mulberry(441):immersionRand(441),n=immersionBudget(28);
  const group=new THREE.Group();group.name='immersion-mist';
  for(let i=0;i<n;i++){
    const s=new THREE.Sprite(mat);const a=i/n*Math.PI*2,r=90+rnd()*220;
    s.position.set(-20+Math.cos(a)*r,-8-rnd()*22,-120+Math.sin(a)*r);const sc=40+rnd()*70;s.scale.set(sc,sc*.42,1);s.userData.dynamic=true;s.userData.drift=0.6+rnd()*1.2;group.add(s);
  }
  world.add(group);IMMERSION.mist=group;
  }catch(error){/* canvas-less review hosts skip mist sprites */}
}
function buildImmersionLanterns(){
  const count=immersionBudget(activeMap.id==='cherry'?36:18);
  const geo=new THREE.SphereGeometry(.28,8,6),mat=new THREE.MeshBasicMaterial({color:activeMap.id==='stormforge'?0xff9a3a:activeMap.trim});
  const mesh=new THREE.InstancedMesh(geo,mat,count),m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
  mesh.name='immersion-lanterns';mesh.userData.dynamic=true;
  for(let i=0;i<count;i++){
    const u=(i+.5)/count,side=i%2?1:-1;
    immersionAlongTrack(u,side*(TRACK_W/2+1.6),2.4+Math.sin(i)*0.4,p);
    s.set(1,1.4,1);m.compose(p,q,s);mesh.setMatrixAt(i,m);
  }
  world.add(mesh);IMMERSION.lanterns={mesh,mat,base:mat.color.clone()};
  if(!(typeof MOBILEFX!=='undefined'&&MOBILEFX)&&!(typeof FALLBACK_GRAPHICS!=='undefined'&&FALLBACK_GRAPHICS)){
    const light=new THREE.PointLight(activeMap.edge,1.1,42,2);immersionAlongTrack(.02,0,6,light.position);light.userData.dynamic=true;world.add(light);
  }
}
function buildCherryHero(){
  const g=new THREE.Group();g.name='immersion-hero';g.position.set(-40,38,-40);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(16,32,24),new THREE.MeshBasicMaterial({color:0xffe8d2}));moon.position.set(-80,70,-160);g.add(moon);

  const vermilion=new THREE.MeshStandardMaterial({color:0x8c3e50,roughness:.55,metalness:.08}),dark=new THREE.MeshStandardMaterial({color:0x2a2438,roughness:.5}),gold=new THREE.MeshStandardMaterial({color:0xd4a843,roughness:.35,metalness:.45});
  for(let k=0;k<5;k++){
    const gate=new THREE.Group();const x=-70+k*28;gate.position.set(x,8,-240);
    for(const s of[-4.2,4.2]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.28,.34,9,10),vermilion);post.position.set(s,4.5,0);gate.add(post);}
    const beam=new THREE.Mesh(new THREE.BoxGeometry(10,.45,.5),dark);beam.position.y=8.6;gate.add(beam);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(11.4,.35,.7),vermilion);cap.position.y=9.3;gate.add(cap);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.42,8,6),new THREE.MeshBasicMaterial({color:0xffc56a}));lamp.position.set(0,7.2,0);gate.add(lamp);
    // Each gate belongs to a continuous stone causeway, with a deep cliff footing.
    g.add(gate);
  }
  const terraceMat=new THREE.MeshStandardMaterial({color:0x8c839b,roughness:.93});
  const causeway=new THREE.Mesh(new THREE.BoxGeometry(132,3,14),terraceMat);causeway.position.set(-14,6.5,-240);causeway.receiveShadow=true;g.add(causeway);
  const foundation=new THREE.Mesh(new THREE.CylinderGeometry(75,43,70,32),terraceMat);foundation.scale.z=.22;foundation.position.set(-14,-30,-240);foundation.receiveShadow=true;g.add(foundation);
  const pagodaBase=new THREE.Mesh(new THREE.CylinderGeometry(15,9,54,20),terraceMat);pagodaBase.position.set(80,-21,-190);g.add(pagodaBase);
  const pagoda=new THREE.Group();pagoda.position.set(80,6,-190);
  const plaster=new THREE.MeshStandardMaterial({color:0xe7d6df,roughness:.78});
  for(let j=0;j<3;j++){
    const sc=1-j*.22,y=j*5.2;
    const floor=new THREE.Mesh(new THREE.BoxGeometry(14*sc,3.4,10*sc),plaster);floor.position.y=y+1.8;pagoda.add(floor);
    const eave=new THREE.Mesh(new THREE.ConeGeometry(11*sc,2.4,4),vermilion);eave.position.y=y+4.2;eave.rotation.y=Math.PI/4;pagoda.add(eave);
    const trim=new THREE.Mesh(new THREE.TorusGeometry(8.4*sc,.16,6,4),gold);trim.position.y=y+3.5;trim.rotation.x=Math.PI/2;trim.rotation.z=Math.PI/4;pagoda.add(trim);
  }
  const finial=new THREE.Mesh(new THREE.SphereGeometry(.7,10,8),gold);finial.position.y=16.4;pagoda.add(finial);
  g.add(pagoda);
  world.add(g);IMMERSION.hero=g;
}
function buildStormHero(){
  const g=new THREE.Group();g.name='immersion-hero';g.position.set(90,18,-70);
  const dark=new THREE.MeshStandardMaterial({color:0x3a4558,roughness:.38,metalness:.72});
  const glow=new THREE.MeshBasicMaterial({color:0xff9a3a});
  const ivory=new THREE.MeshStandardMaterial({color:0x8994a3,roughness:.4,metalness:.55});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(22,1.4,10,64),dark);ring.rotation.y=Math.PI*.18;g.add(ring);
  const inner=new THREE.Mesh(new THREE.TorusGeometry(18.6,.35,8,64),glow);inner.rotation.copy(ring.rotation);g.add(inner);
  const core=new THREE.Mesh(new THREE.CircleGeometry(16.8,48),new THREE.MeshBasicMaterial({color:0xff7a28,transparent:true,opacity:.22,side:THREE.DoubleSide}));core.rotation.copy(ring.rotation);g.add(core);
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2,rib=new THREE.Mesh(new THREE.BoxGeometry(.55,9,.4),dark);
    rib.position.set(Math.cos(a)*22,0,Math.sin(a)*22);rib.lookAt(0,0,0);g.add(rib);
  }
  const rotor=new THREE.Group();rotor.userData.dynamic=true;g.add(rotor);
  for(let i=0;i<6;i++){
    const blade=new THREE.Mesh(new THREE.BoxGeometry(1.1,18,.18),glow);blade.rotation.z=i*Math.PI/3;rotor.add(blade);
  }
  if(typeof mapSceneryAnimations!=='undefined'){rotor.userData.spinRate=1.4;mapSceneryAnimations.push(rotor);}
  for(const side of[-1,1]){
    const crane=new THREE.Group();crane.position.set(side*38,-8,-18);g.add(crane);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.7,1.1,28,8),ivory);mast.position.y=14;crane.add(mast);
    const boom=new THREE.Mesh(new THREE.BoxGeometry(26,.55,.55),dark);boom.position.set(10,27,0);crane.add(boom);
    const hook=new THREE.Mesh(new THREE.BoxGeometry(2.4,2.4,2.4),dark);hook.position.set(20,16,0);crane.add(hook);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.5,8,6),glow);lamp.position.set(20,18.2,0);crane.add(lamp);
  }
  // Reactor and crane loads terminate in the same service deck and bedrock.
  const deck=new THREE.Mesh(new THREE.BoxGeometry(102,3,42),ivory);deck.position.set(0,-10,-10);deck.receiveShadow=true;g.add(deck);
  for(const x of[-36,0,36]){const footing=new THREE.Mesh(new THREE.CylinderGeometry(9,14,62,12),dark);footing.position.set(x,-42,-10);g.add(footing);}
  world.add(g);IMMERSION.hero=g;
}
function buildCanopyHero(){
  const g=new THREE.Group();g.name='immersion-hero';g.position.set(-20,-4,-20);
  const bark=new THREE.MeshStandardMaterial({color:0x9a8464,roughness:.95});
  const glow=new THREE.MeshBasicMaterial({color:0x7ef0ff,transparent:true,opacity:.55});
  const moss=new THREE.MeshStandardMaterial({color:0x3d7a3a,roughness:.82});
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(3.2,5.4,22,12),bark);trunk.position.set(-48,10,-110);g.add(trunk);
  for(let b=0;b<5;b++){
    const a=b/5*Math.PI*2,arm=new THREE.Mesh(new THREE.CylinderGeometry(.45,.9,14,8),bark);
    arm.position.set(-48+Math.cos(a)*8,20, -110+Math.sin(a)*8);arm.rotation.z=Math.cos(a)*.8;arm.rotation.x=Math.sin(a)*.8;g.add(arm);
    const crown=new THREE.Mesh(new THREE.SphereGeometry(4.2,10,8),moss);crown.position.set(-48+Math.cos(a)*14,26,-110+Math.sin(a)*14);crown.scale.set(1,.55,1);g.add(crown);
  }
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2,cap=new THREE.Mesh(new THREE.SphereGeometry(1.1+i%3*.4,10,8),glow);
    cap.position.set(Math.cos(a)*18,2.2,Math.sin(a)*18);cap.scale.set(1,.45,1);g.add(cap);
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,2.2,6),bark);stem.position.set(Math.cos(a)*18,1.1,Math.sin(a)*18);g.add(stem);
  }
  const earth=new THREE.Mesh(new THREE.CylinderGeometry(24,15,50,24),bark);earth.position.set(-48,-26,-110);g.add(earth);
  const count=immersionBudget(24),geo=new THREE.ConeGeometry(.35,1.1,5),mat=new THREE.MeshStandardMaterial({color:0x2f6a3a,roughness:.8});
  const birds=new THREE.InstancedMesh(geo,mat,count);
  birds.name='immersion-birds';birds.userData.dynamic=true;
  for(let i=0;i<count;i++){_imM.makeTranslation(-40+(i%8)*12,18+i%5, -80-(i%6)*10);birds.setMatrixAt(i,_imM);}
  g.add(birds);IMMERSION.birds={mesh:birds,count,t:0};
  world.add(g);IMMERSION.hero=g;
}
function buildImmersionSeaOverlay(){
  const mat=createImmersionWater(activeMap,'sea');
  const sea=new THREE.Mesh(new THREE.CircleGeometry(1200,64),mat);sea.rotation.x=-Math.PI/2;sea.position.set(-20,-99.6,-120);
  sea.name='immersion-sea';sea.userData.dynamic=true;world.add(sea);IMMERSION.sea=sea;
}
function buildImmersion(){
  IMMERSION.weather=null;IMMERSION.hero=null;IMMERSION.flash=0;IMMERSION.sea=null;IMMERSION.birds=null;IMMERSION.lanterns=null;IMMERSION.mist=null;
  if(typeof world==='undefined'||!world)return;
  buildImmersionRails();
  buildImmersionWeather();
  buildImmersionMist();
  buildImmersionLanterns();
  buildImmersionSeaOverlay();
  if(activeMap.id==='cherry')buildCherryHero();
  else if(activeMap.id==='stormforge')buildStormHero();
  else buildCanopyHero();
}
function updateImmersion(dt){
  const w=IMMERSION.weather;
  if(w){
    const pos=w.pos,vel=w.vel,rnd=w.rnd||Math.random;
    for(let i=0;i<w.count;i++){
      const i3=i*3;pos[i3]+=vel[i3]*dt;pos[i3+1]+=vel[i3+1]*dt;pos[i3+2]+=vel[i3+2]*dt;
      if(activeMap.id==='stormforge'){if(pos[i3+1]>w.ceil){pos[i3+1]=w.floor;pos[i3]+=(rnd()-.5)*8;pos[i3+2]+=(rnd()-.5)*8;}}
      else if(pos[i3+1]<w.floor){pos[i3+1]=w.ceil;pos[i3]+=(rnd()-.5)*10;pos[i3+2]+=(rnd()-.5)*10;}
    }
    w.points.geometry.attributes.position.needsUpdate=true;
  }
  if(activeMap.id==='stormforge'&&typeof hemi!=='undefined'){
    IMMERSION.flash=Math.max(0,IMMERSION.flash-dt*2.2);
    if((w&&w.rnd?w.rnd():Math.random())<dt*.12)IMMERSION.flash=1;
    hemi.intensity=.58+IMMERSION.flash*.65;
  }
  const lanterns=IMMERSION.lanterns;
  if(lanterns&&typeof zenWorldTime!=='undefined'){
    const pulse=.72+.28*Math.sin((zenWorldTime.value||0)*2.4);
    lanterns.mat.color.copy(lanterns.base).multiplyScalar(pulse);
  }
  const mist=IMMERSION.mist;
  if(mist){
    const t=typeof zenWorldTime!=='undefined'?zenWorldTime.value||0:0;
    for(const s of mist.children){s.position.x+=Math.sin(t*.12+s.position.z*.01)*(s.userData.drift||1)*dt*.4;}
  }
  const birds=IMMERSION.birds;
  if(birds){
    birds.t+=dt;
    for(let i=0;i<birds.count;i++){
      const a=birds.t*.35+i*.7,r=22+i%5*3;
      _imP.set(-20+Math.cos(a)*r,16+Math.sin(i+birds.t)*.8,-90+Math.sin(a)*r);
      _imE.set(.4, -a+Math.PI/2, .2);_imQ.setFromEuler(_imE);_imM.compose(_imP,_imQ,_imS);birds.mesh.setMatrixAt(i,_imM);
    }
    birds.mesh.instanceMatrix.needsUpdate=true;
  }
  if(typeof scene!=='undefined'&&scene.fog){
    const spd=(typeof game!=='undefined'&&game.player)?clamp(game.player.speed/46,0,1):0;
    const near=activeMap.id==='canopy'?300:activeMap.id==='stormforge'?200:260;
    scene.fog.near=lerp(scene.fog.near||near,near-spd*35,1.-Math.exp(-dt*4));
  }
}
