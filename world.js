// ---------- Renderer / scene ----------
let canvas=document.getElementById('gl');
var FALLBACK_GRAPHICS=false;
const LOWFX=/lowfx/.test(location.search);
const MOBILEFX=matchMedia('(pointer: coarse)').matches||((navigator.deviceMemory||8)<4);
function graphicsNotice(message,retry){
  let panel=document.getElementById('graphics-notice');
  if(!panel){panel=document.createElement('div');panel.id='graphics-notice';panel.setAttribute('role','alert');panel.style.cssText='position:fixed;inset:0;z-index:10000;background:#203952;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:32px;text-align:center;color:#f5f5f5;font:18px/1.6 system-ui';document.body.append(panel);}
  panel.replaceChildren();const copy=document.createElement('p');copy.textContent=message;panel.append(copy);
  if(retry){const button=document.createElement('button');button.textContent='Reload circuit';button.style.cssText='padding:14px 24px;background:#a8f8ff;border:0;border-radius:8px;color:#050a18;font:700 16px system-ui;cursor:pointer';button.onclick=()=>location.reload();panel.append(button);}
}
let renderer;
try{
  const contextOptions={alpha:false,depth:true,stencil:true,antialias:!MOBILEFX&&!LOWFX,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'};
  const context=canvas.getContext('webgl2',contextOptions)||canvas.getContext('webgl',contextOptions)||canvas.getContext('experimental-webgl',contextOptions);
  if(!context)throw new Error('WebGL unavailable');
  renderer=new THREE.WebGLRenderer({canvas,context,antialias:contextOptions.antialias,powerPreference:'high-performance'});
}
catch(error){const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;FALLBACK_GRAPHICS=true;renderer=new CanvasRaceRenderer({canvas});document.documentElement.dataset.renderer='canvas';}
renderer.setPixelRatio(LOWFX?0.7:Math.min(devicePixelRatio,MOBILEFX?1.15:1.6));
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(typeof game!=='undefined'&&['race','countdown'].includes(game.state)&&typeof pause==='function')pause();graphicsNotice('The graphics connection was interrupted. Restoring the circuit…',true);});
canvas.addEventListener('webglcontextrestored',()=>{
  // Render-target contents do not survive context loss. Re-bake the environment;
  // retaining its old Texture object would leave metallic drivers black.
  if(typeof refreshMapEnvironment==='function')refreshMapEnvironment();
  if(typeof staticFrameDirty!=='undefined')staticFrameDirty=true;
  document.getElementById('graphics-notice')?.remove();
});
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.82;
renderer.shadowMap.enabled=!LOWFX&&!MOBILEFX;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xc5c8ec,320,980);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.3,1400);
const hemi=new THREE.HemisphereLight(0xc7eaff,0x8272a0,.38);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe5ef,1.25);sun.position.set(-180,220,-120);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.near=20;sun.shadow.camera.far=700;
sun.shadow.camera.left=-120;sun.shadow.camera.right=120;sun.shadow.camera.top=120;sun.shadow.camera.bottom=-120;sun.shadow.bias=-0.0008;sun.shadow.normalBias=0.03;
scene.add(sun);scene.add(sun.target);
const rim=new THREE.DirectionalLight(0xaecaff,0.55);rim.position.set(160,80,200);scene.add(rim);

// Soft atmosphere is real scene lighting; every island remains dimensional geometry.
const zenWorldTime={value:0};
let refreshMapEnvironment=null;
function buildSky(){
  // Fixed at renderer creation: map changes only update uniforms. Phones use
  // 16 noise hashes/pixel and LOWFX 4, versus 48 on desktop; the lighting probe
  // is compiled out on constrained GPUs rather than paid for behind a uniform.
  const octaves=LOWFX?1:MOBILEFX?2:4;
  const noiseScale=(1.-Math.pow(.48,4))/(1.-Math.pow(.48,octaves));
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    defines:{SKY_CLOUD_OCTAVES:octaves,SKY_NOISE_SCALE:noiseScale.toFixed(6),SKY_CLOUD_LIGHT_PROBE:(!LOWFX&&!MOBILEFX)?1:0,SKY_SECOND_DECK:LOWFX?0:1},
    uniforms:{time:zenWorldTime,skyTop:{value:new THREE.Color(activeMap.skyTop)},skyHorizon:{value:new THREE.Color(activeMap.skyHorizon)},storm:{value:activeMap.id==='stormforge'?1:0},cloudCover:{value:activeMap.id==='canopy'?.54:.63},solarDirection:{value:typeof SOLAR_DIRECTION!=='undefined'?SOLAR_DIRECTION:new THREE.Vector3(-90,140,-60).normalize()}},
    vertexShader:`varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 direction;uniform float time;uniform vec3 skyTop;uniform vec3 skyHorizon;uniform float storm;uniform float cloudCover;uniform vec3 solarDirection;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float cloud(vec2 p){float n=0.;float a=.55;for(int i=0;i<SKY_CLOUD_OCTAVES;i++){n+=a*noise(p);p=mat2(1.6,-1.2,1.2,1.6)*p+vec2(13.2,7.8);a*=.48;}return n*SKY_NOISE_SCALE;}
void main(){
vec3 d=normalize(direction),sunDir=normalize(solarDirection);
float h=smoothstep(-.10,.85,d.y);vec3 sky=mix(skyHorizon,skyTop,h);
sky=mix(skyHorizon*.76,sky,smoothstep(-.55,.04,d.y));
float mu=max(0.,dot(d,sunDir));
// Finite solar disc, limb darkening and forward Mie scattering. Angular radius
// is art-directed to .55 degrees to remain legible on phones; no camera-facing mesh.
float angle=acos(clamp(mu,0.,1.));
float disc=1.-smoothstep(.0088,.0104,angle);
float limb=.45+.55*sqrt(max(0.,1.-pow(angle/.0104,2.)));
float mie=.012/pow(max(.025,1.-.975*mu),1.35);
sky+=vec3(1.,.88,.68)*(disc*limb*12.+mie)*(1.-storm*.48);
// Perspective-projected cloud decks: distant banks compress naturally into haze.
vec2 plane=d.xz/max(.11,d.y+.14);vec2 wind=vec2(time*.007,time*.003);
float lower=cloud(plane*1.3+wind);
#if SKY_SECOND_DECK == 1
float upper=cloud(plane*2.8-wind*.6+31.);
#else
float upper=0.;
#endif
float density=smoothstep(1.-cloudCover-.10,1.-cloudCover+.18,lower);
float high=smoothstep(.5,.72,upper)*.42;
float mask=smoothstep(-.01,.10,d.y)*(1.-smoothstep(.72,.99,d.y));
#if SKY_CLOUD_LIGHT_PROBE == 1
float illumination=clamp((lower-cloud(plane*1.3+wind+sunDir.xz*.12))*5.+.58,.08,1.);
#else
float illumination=clamp(.82-density*.32+mu*.12,.08,1.);
#endif
vec3 shadow=mix(vec3(.59,.65,.79),vec3(.24,.30,.41),storm);
vec3 lit=mix(vec3(1.,.94,.89),vec3(.72,.75,.80),storm);
vec3 clouds=mix(shadow,lit,illumination);
float lining=pow(max(0.,1.-abs(density-.42)*2.),3.)*pow(mu,5.);
clouds+=vec3(1.,.82,.60)*lining*.48*(1.-storm*.7);
float opticalDepth=(density*3.2+high*1.4)*mask*(1.+storm);
float transmission=exp(-opticalDepth);
sky=sky*transmission+clouds*(1.-transmission);
// Atmospheric scattering unifies the cloud banks and modeled horizon.
sky=mix(sky,skyHorizon,(1.-smoothstep(-.08,.15,d.y))*.38);
gl_FragColor=vec4(sky,1.);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1100,36,18),mat);dome.name="solar-atmosphere";dome.frustumCulled=false;
  dome.onBeforeRender=(_renderer,_scene,view)=>{dome.position.copy(view.position);dome.updateMatrixWorld();};scene.add(dome);
  if(!FALLBACK_GRAPHICS){refreshMapEnvironment=()=>{scene.environment=createSurfaceEnvironment(renderer,activeMap);};refreshMapEnvironment();}
  return mat;
}

// ---------- Track definition: the Synergy Circuit ----------
// Control points (x, y, z). Anti-gravity barrel roll from P8 -> P14.
const CTRL=[
  [ 20,  0,   0],[ 90,  0,   0],[150,  0, -40],[150,  3,-110],[100,  6,-150],[ 30, 10,-140],[-15, 15, -95],[-60, 16, -40],
  [-120,20, -20],[-170,32,-70],[-180,50,-150],[-140,58,-215],[-70,46,-240],[  0,32,-235],[ 50,20,-210],[  0, 8,-195],
  [-45,  2,-150],[-30,  0, -70],[-25,  0, -45],[-20, 0, -15]
];
const ROLL_KEYS  =[[0,0],[8,0],[9,35],[10,110],[11,200],[12,290],[13,340],[14,360],[19,360],[20,360]]; // [ctrl index, degrees]
const AG_KEYS    =[[0,0],[7.6,0],[8.6,1],[13.6,1],[14.8,0],[20,0]];
const CHERRY_CONTROL=CTRL.map(p=>p.slice()),CHERRY_ROLL=ROLL_KEYS.map(p=>p.slice()),CHERRY_AG=AG_KEYS.map(p=>p.slice());
const TRACK_W=14, N_SAMP=1800;
const track={pos:[],tan:[],up:[],right:[],curv:[],ag:[],roll:[],len:0,u:[]};

function buildTrackFrames(){
  for(const key of ['pos','tan','up','right','curv','ag','roll','u'])track[key].length=0;
  const pts=CTRL.map(p=>new THREE.Vector3(p[0],p[1],p[2]));
  const curve=new THREE.CatmullRomCurve3(pts,true,'centripetal',0.5);
  curve.arcLengthDivisions=4000;curve.updateArcLengths();
  track.curve=curve; track.len=curve.getLength();
  // map control-point index -> arc-length u
  const lens=curve.getLengths(4000), total=lens[lens.length-1];
  const ctrlU=CTRL.map((_,i)=>lens[Math.round(i/CTRL.length*4000)]/total); ctrlU.push(1);
  const keyAt=(keys,u)=>{ // interpolate keys given in ctrl-index space
    const idx=(()=>{ // convert u -> fractional ctrl index
      for(let i=0;i<CTRL.length;i++){const a=ctrlU[i],b=ctrlU[i+1];if(u>=a&&u<=b)return i+(u-a)/(b-a);}return 0;})();
    for(let k=0;k<keys.length-1;k++){const [ia,va]=keys[k],[ib,vb]=keys[k+1];if(idx>=ia&&idx<=ib){return lerp(va,vb,smooth((idx-ia)/(ib-ia)));}}
    return keys[keys.length-1][1];
  };
  const T0=curve.getTangentAt(0).normalize();
  let n=new THREE.Vector3(0,1,0);n.sub(T0.clone().multiplyScalar(n.dot(T0))).normalize();
  const nArr=[];
  for(let i=0;i<=N_SAMP;i++){
    const u=(i%N_SAMP)/N_SAMP;
    const T=curve.getTangentAt(u).normalize();
    n.sub(T.clone().multiplyScalar(n.dot(T))).normalize();
    nArr.push(n.clone());track.tan.push(T);track.pos.push(curve.getPointAt(u));track.u.push(u);
    track.ag.push(keyAt(AG_KEYS,u));track.roll.push(keyAt(ROLL_KEYS,u)*Math.PI/180);
  }
  // close the frame: distribute angular drift so sample N == sample 0
  const nEnd=nArr[N_SAMP], nStart=nArr[0], T=track.tan[0];
  let err=Math.atan2(nEnd.clone().cross(nStart).dot(T),nEnd.dot(nStart));
  for(let i=0;i<=N_SAMP;i++){
    const q=new THREE.Quaternion().setFromAxisAngle(track.tan[i],err*(i/N_SAMP)+track.roll[i]);
    const up=nArr[i].clone().applyQuaternion(q).normalize();
    const right=new THREE.Vector3().crossVectors(track.tan[i],up).normalize();
    track.up.push(up);track.right.push(right);
  }
  // signed curvature (1/units): positive = turning right
  const ds=track.len/N_SAMP;
  for(let i=0;i<=N_SAMP;i++){const a=track.tan[(i+N_SAMP-3)%N_SAMP],b=track.tan[(i+3)%N_SAMP];const d=b.clone().sub(a).divideScalar(6*ds);track.curv.push(d.dot(track.right[i]));}
}
// sample helpers (u in 0..1) — allocation-light
const _v1=new THREE.Vector3(),_v2=new THREE.Vector3(),_v3=new THREE.Vector3();
function sampleIdx(u){return Math.floor(wrap01(u)*N_SAMP);}
function trackPoint(u,lat,h,out){const i=sampleIdx(u),j=(i+1)%N_SAMP,f=wrap01(u)*N_SAMP-i;
  out.copy(track.pos[i]).lerp(track.pos[j],f);_v1.copy(track.right[i]).lerp(track.right[j],f);_v2.copy(track.up[i]).lerp(track.up[j],f);
  out.addScaledVector(_v1,lat).addScaledVector(_v2,h);return out;}
function trackTan(u,out){const i=sampleIdx(u),j=(i+1)%N_SAMP,f=wrap01(u)*N_SAMP-i;return out.copy(track.tan[i]).lerp(track.tan[j],f).normalize();}
function trackUp(u,out){const i=sampleIdx(u),j=(i+1)%N_SAMP,f=wrap01(u)*N_SAMP-i;return out.copy(track.up[i]).lerp(track.up[j],f).normalize();}
function trackRight(u,out){const i=sampleIdx(u),j=(i+1)%N_SAMP,f=wrap01(u)*N_SAMP-i;return out.copy(track.right[i]).lerp(track.right[j],f).normalize();}
function trackCurv(u){return track.curv[sampleIdx(u)];}
function trackAG(u){return track.ag[sampleIdx(u)];}

// ---------- Ribbon builder ----------
// profile: array of [lat, height] pairs (cross-section from left to right); pred(i) chooses which samples are emitted
function buildRibbon(profile,mat,pred,uvScale=1,vScale=1){
  const P=profile.length,pos=[],nor=[],uv=[],idx=[];let seg=0,prevOn=false,vbase=0;
  const ds=track.len/N_SAMP;
  for(let i=0;i<=N_SAMP;i++){
    const on=pred?pred(i):true; if(!on){prevOn=false;continue;}
    const p=track.pos[i%N_SAMP],r=track.right[i],u=track.up[i];
    for(let k=0;k<P;k++){const [lat,h]=profile[k];pos.push(p.x+r.x*lat+u.x*h,p.y+r.y*lat+u.y*h,p.z+r.z*lat+u.z*h);nor.push(u.x,u.y,u.z);uv.push(k/(P-1)*vScale,i*ds/uvScale);}
    if(prevOn){const b=vbase-P,c=vbase;for(let k=0;k<P-1;k++){idx.push(b+k,b+k+1,c+k, b+k+1,c+k+1,c+k);}}
    vbase+=P;prevOn=true;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.receiveShadow=true;return m;
}
// vertical wall ribbon at lateral `lat`, from h0 to h1
function buildWall(lat,h0,h1,mat,pred,uvScale=8){
  return buildRibbon([[lat,h0],[lat,h1]],mat,pred,uvScale,1);
}

const world=new THREE.Group();scene.add(world);
function buildTrackMeshes(){
  const W=TRACK_W/2;
  // Lighting is balanced so the lavender road, grass and liveries keep their saturation after ACES.
  const road=new THREE.MeshPhysicalMaterial({color:activeMap.road,map:TEX.roadDetail||null,roughnessMap:TEX.roadRoughness||null,bumpMap:TEX.roadDetail||null,bumpScale:.03,roughness:.83,metalness:.06,clearcoat:.18,clearcoatRoughness:.55,envMapIntensity:.85,side:THREE.DoubleSide});
  world.add(buildRibbon([[-W,0],[-W*.5,.015],[0,.025],[W*.5,.015],[W,0]],road,null,12));
  const under=new THREE.MeshStandardMaterial({color:activeMap.id==='canopy'?0xd3dfd9:0x697087,roughness:.34,metalness:.5,side:THREE.DoubleSide});
  world.add(buildRibbon([[-W-.5,-.12],[-W-.3,-.85],[W+.3,-.85],[W+.5,-.12]],under));
  const cyan=new THREE.MeshBasicMaterial({color:activeMap.edge}),pink=new THREE.MeshBasicMaterial({color:activeMap.trim});
  for(const side of[-1,1]){
    world.add(buildRibbon([[side*(W-.25),.035],[side*(W-.05),.035]].sort((a,b)=>a[0]-b[0]),cyan));
    world.add(buildRibbon([[side*(W+.02),-.08],[side*(W+.48),-.08]].sort((a,b)=>a[0]-b[0]),pink));
    world.add(buildRibbon([[side*2.1,.042],[side*2.27,.042]].sort((a,b)=>a[0]-b[0]),cyan));
    const glow=new THREE.MeshBasicMaterial({color:0x26e9ff,transparent:true,opacity:.1,depthWrite:false});
    world.add(buildRibbon([[side*1.8,.047],[side*2.6,.047]].sort((a,b)=>a[0]-b[0]),glow));
    world.add(buildWall(side*(W+.32),.1,1.05,new THREE.MeshStandardMaterial({color:activeMap.id==='cherry'?0xe9dce1:activeMap.id==='canopy'?0xd2dfc8:0x788496,roughness:.67,metalness:.24,side:THREE.DoubleSide})));
    world.add(buildRibbon([[side*(W+.22),1.05],[side*(W+.43),1.05]].sort((a,b)=>a[0]-b[0]),cyan));
  }
  const finish=new THREE.MeshStandardMaterial({map:TEX.finish,roughness:.5,emissive:0x8899cc,emissiveIntensity:.3});
  world.add(buildRibbon([[-W,.052],[W,.052]],finish,i=>i<8,2));
  // Flush luminous flow pads are outside the center driving lane and are not barriers.
  const pad=new THREE.MeshBasicMaterial({color:0xa9ffff});
  for(let k=0;k<15;k++){const u=k/15+.02,side=k%2?1:-1;world.add(buildRibbon([[side*3.5,.055],[side*5.2,.055]].sort((a,b)=>a[0]-b[0]),pad,i=>Math.abs(i/N_SAMP-u)<.0018));}
}

// ---------- Environment kit ----------
function mergeGeos(list){ // Typed-array assembly avoids argument limits on detailed scenery.
  const expanded=list.map(g=>g.index?g.toNonIndexed():g);
  const count=expanded.reduce((sum,g)=>sum+g.attributes.position.count,0);
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);
  let offset=0;
  expanded.forEach((g,i)=>{positions.set(g.attributes.position.array,offset*3);if(g.attributes.normal)normals.set(g.attributes.normal.array,offset*3);if(g.attributes.uv)uvs.set(g.attributes.uv.array,offset*2);offset+=g.attributes.position.count;if(g!==list[i])g.dispose();});
  const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.BufferAttribute(positions,3));merged.setAttribute('normal',new THREE.BufferAttribute(normals,3));merged.setAttribute('uv',new THREE.BufferAttribute(uvs,2));merged.computeBoundingSphere();return merged;
}
function displace(geo,amp,freq,seed=0){const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=fbm(x*freq+seed,y*freq+z*freq*.7+seed,3)-0.5;const l=Math.hypot(x,y,z)||1;p.setXYZ(i,x+x/l*n*amp,y+y/l*n*amp,z+z/l*n*amp);}p.needsUpdate=true;geo.computeVertexNormals();return geo;}

function treeCanopyGeo(seed,tint){
  if(typeof foliageGeometry==='function')return foliageGeometry(seed,tint); // organic lobed canopy: 8 merged lobes, noise-displaced, vertex-colour gradient (shade at the base, sunlit crown)
  const lobes=[];const r=mulberry(seed);
  for(let i=0;i<8;i++){const s=1.3+r()*1.5;const g=new THREE.IcosahedronGeometry(s,LOWFX?1:2);const a=r()*6.3,d=r()*1.9;g.translate(Math.cos(a)*d,r()*2.8+1.0+(i<2?1.2:0),Math.sin(a)*d);lobes.push(g);}
  const m=mergeGeos(lobes);lobes.forEach(g=>g.dispose());displace(m,.75,.9,seed*3.1);
  const p=m.attributes.position,col=new Float32Array(p.count*3);const c1=new THREE.Color(tint[0]),c2=new THREE.Color(tint[1]),c=new THREE.Color();
  let ymin=1e9,ymax=-1e9;for(let i=0;i<p.count;i++){ymin=Math.min(ymin,p.getY(i));ymax=Math.max(ymax,p.getY(i));}
  for(let i=0;i<p.count;i++){const t=clamp((p.getY(i)-ymin)/(ymax-ymin),0,1);const n=fbm(p.getX(i)*.7+seed,p.getZ(i)*.7,2);c.copy(c1).lerp(c2,smooth(t)*.85+n*.3);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  m.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  // Noise displacement keeps shared lobe vertices coincident; average their normals.
  const normals=m.attributes.normal,buckets=new Map(),keys=[];
  for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(',');keys.push(key);const sum=buckets.get(key)||new THREE.Vector3();sum.x+=normals.getX(i);sum.y+=normals.getY(i);sum.z+=normals.getZ(i);buckets.set(key,sum);}
  buckets.forEach(v=>v.normalize());for(let i=0;i<p.count;i++){const v=buckets.get(keys[i]);normals.setXYZ(i,v.x,v.y,v.z);}return m;
}
function rockGeo(seed){const g=new THREE.IcosahedronGeometry(1.6,1);return displace(g,.7,.9,seed);}
function starGeo(size=1,depth=.25){ // Collective 4-point diamond star
  const s=new THREE.Shape();s.moveTo(0,size);s.lineTo(size*.28,size*.28);s.lineTo(size,0);s.lineTo(size*.28,-size*.28);s.lineTo(0,-size);s.lineTo(-size*.28,-size*.28);s.lineTo(-size,0);s.lineTo(-size*.28,size*.28);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.05,bevelSize:.04,bevelSegments:2});g.center();return g;}

function buildEnvironment(){
  const random=mulberry(7943),cliffMat=new THREE.MeshStandardMaterial({vertexColors:true,map:TEX.cliffColor||null,bumpMap:TEX.cliffHeight||null,bumpScale:.26,roughness:.93,metalness:0,flatShading:false});
  const grassMat=new THREE.MeshStandardMaterial({color:0xc8e2ac,map:TEX.mossColor||null,bumpMap:TEX.groundHeight||null,bumpScale:.07,vertexColors:true,roughness:.94});
  const barkMat=new THREE.MeshStandardMaterial({color:0xbba59b,map:TEX.barkColor||null,bumpMap:TEX.barkColor||null,bumpScale:.12,roughness:.86});
  const pinkMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,side:THREE.DoubleSide});
  const stoneMat=new THREE.MeshStandardMaterial({color:0xc5bdad,map:TEX.cliffColor||null,bumpMap:TEX.cliffHeight||null,bumpScale:.08,roughness:.9});
  const islands=[];
  function clearance(x,z){let d=Infinity;for(let i=0;i<N_SAMP;i+=3)d=Math.min(d,Math.hypot(x-track.pos[i].x,z-track.pos[i].z));return d;}
  islands.push({x:-102,y:-5,z:-126,r:36,depth:58,temple:true});
  for(let k=0;k<26;k++){const u=k/26+.008,i=sampleIdx(u);if(track.ag[i]>.3)continue;for(const side of[-1,1]){const r=18+random()*9,p=new THREE.Vector3();trackPoint(u,side*(r+19),-4,p);if(clearance(p.x,p.z)<r+11||islands.some(a=>Math.hypot(a.x-p.x,a.z-p.z)<a.r+r+6))continue;islands.push({x:p.x,y:p.y,z:p.z,r,depth:30+random()*35,temple:islands.length%3===0});}}
  // Outer sanctuary islands make the floating world visible from every racing sector.
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2,r=22+random()*18,x=-20+Math.cos(a)*290,z=-120+Math.sin(a)*290;islands.push({x,y:20+random()*60,z,r,depth:40+random()*70,temple:k%3===0});}
  world.userData.islands=islands;
  function islandGeometry(r,depth,seed){
    const segments=MOBILEFX?48:72,levels=24,p=[],colors=[],uv=[],idx=[],c=new THREE.Color();
    for(let j=0;j<=levels;j++)for(let k=0;k<=segments;k++){
      const t=j/levels,a=k/segments*Math.PI*2;
      const rim=.95+.035*Math.sin(a*7+seed)+.025*Math.sin(a*13+seed);
      const taper=Math.pow(1-t,.64);
      const flute=Math.sin(a*19+Math.sin(t*8+seed))*.055+Math.sin(a*31+seed)*.022;
      const strata=(Math.sin(t*45+a*2+seed)*.028+Math.sin(t*83+a*5)*.012+Math.sin(t*17+seed)*.055)*Math.sin(t*Math.PI);
      const rr=r*(.025+taper*(rim+flute*Math.sin(t*Math.PI)+strata));
      p.push(Math.cos(a)*rr+Math.sin(t*4)*r*.08,-depth*t,Math.sin(a)*rr*.83);
      c.setHex(j<2?0x728c67:activeMap.id==='canopy'?0xb5b6a1:0xabb0c3).multiplyScalar(.8+.2*(1-t));colors.push(c.r,c.g,c.b);uv.push(k/segments*4,t*3);
      if(j<levels&&k<segments){const n=j*(segments+1)+k,m=n+segments+1;idx.push(n,n+1,m,n+1,m+1,m);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
  }
  // Each flower is five individually modeled, irregular petals. The sprays retain
  // open space between branch tips instead of obscuring the tree with solid crowns.
  function blossomSprayGeometry(){
    const rnd=mulberry(8841),positions=[],colors=[],color=new THREE.Color(),v=new THREE.Vector3();
    const count=MOBILEFX?330:590,palette=[0xffd5f3,0xf79cdc,0xe77bc8,0xffedf9];
    for(let i=0;i<count;i++){
      const branch=i%6,a=branch*Math.PI/3,az=rnd()*Math.PI*2,rad=Math.pow(rnd(),.45);
      const center=new THREE.Vector3(Math.cos(a)*2.65+Math.cos(az)*rad*1.55,2.35+branch*.14+(rnd()-.5)*1.6,Math.sin(a)*2.05+Math.sin(az)*rad*1.3);
      const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd()-.5)*2,az,(rnd()-.5)*2));
      const radius=.15+rnd()*.11;color.setHex(palette[Math.floor(rnd()*palette.length)]);
      for(let petal=0;petal<5;petal++){
        const angle=petal*Math.PI*.4,cs=Math.cos(angle),sn=Math.sin(angle),length=radius*(.85+rnd()*.35),width=length*.62;
        const base=[0,0,0],left=[cs*length*.58-sn*width,sn*length*.58+cs*width,.018],tip=[cs*length*1.5,sn*length*1.5,.045],right=[cs*length*.58+sn*width,sn*length*.58-cs*width,.018];
        for(const point of[base,left,tip,base,tip,right]){v.set(...point).applyQuaternion(rotation).add(center);positions.push(v.x,v.y,v.z);colors.push(color.r,color.g,color.b);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
  }
  const pinkGeo=blossomSprayGeometry(),greenGeo=treeCanopyGeo(37,[0x28584e,0x79a988]);
  const blossomMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75,side:THREE.DoubleSide});
  // Bending branch network, shared across trees; blossom canopies sit on branch tips.
  const branchGeos=[];
  function branch(points,radius){branchGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),radius<.09?4:9,radius,radius<.09?4:6,false));}
  branch([[0,0,0],[.4,2,.1],[-.1,4,.1],[.5,6,0]],.3);
  for(let j=0;j<6;j++){const a=j*Math.PI/3;branch([[.1,2.2+j*.25,0],[Math.cos(a)*1.3,4+j*.18,Math.sin(a)],[Math.cos(a)*2.6,5.5+j*.2,Math.sin(a)*2]],.12);
    for(let k=0;k<5;k++){const b=a+(k-2)*.35;const start=[Math.cos(a)*1.8,4.8+j*.15,Math.sin(a)*1.4],end=[Math.cos(b)*(2.7+k*.17),5.5+j*.14+(k%3)*.45,Math.sin(b)*(2.25+k*.12)];branch([start,[(start[0]+end[0])*.5,(start[1]+end[1])*.5+.25,(start[2]+end[2])*.5],end],.038+k*.005);}
  }
  const trunk=mergeGeos(branchGeos);branchGeos.forEach(g=>g.dispose());
  const cherrySpots=[],bonsaiSpots=[];
  const pondMat=(typeof createImmersionWater==='function')?createImmersionWater(activeMap,'pond'):new THREE.MeshPhysicalMaterial({color:0x83d6e5,roughness:.09,metalness:.5,clearcoat:1,transparent:true,opacity:.85,side:THREE.DoubleSide});
  const waterfallMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{time:zenWorldTime},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time;void main(){float strand=pow(.5+.5*sin(vUv.x*79.+sin(vUv.y*14.+time*2.)*.3),7.);float rush=.5+.5*sin(vUv.y*100.+time*7.+vUv.x*13.);float broken=smoothstep(.15,.8,.5+.5*sin(vUv.x*143.+sin(vUv.y*21.+time*3.)));vec3 c=mix(vec3(.22,.43,.48),vec3(.84,.91,.91),strand*.56+rush*.12);float edge=smoothstep(0.,.08,vUv.x)*smoothstep(0.,.08,1.-vUv.x);float fade=smoothstep(0.,.15,vUv.y);gl_FragColor=vec4(c,edge*fade*(.28+strand*.33+broken*.21));
#include <tonemapping_fragment>
#include <encodings_fragment>
}`});
  waterfallMat.userData.softwareSurface=true;waterfallMat.color=new THREE.Color(0x85afb4);waterfallMat.opacity=.55;waterfallMat.roughness=.24;waterfallMat.metalness=0;
  function waterfall(island,width,angle){
    const length=island.depth+40,seg=20,p=[],uv=[],idx=[];for(let j=0;j<=seg;j++){const t=j/seg;for(let k=0;k<=8;k++){const q=k/8,x=(q-.5)*width,z=island.r*.8+Math.sin(Math.min(t*5,Math.PI/2))*2.5;const ca=Math.cos(angle),sa=Math.sin(angle);p.push(island.x+x*ca-z*sa,island.y+.08-t*length,island.z+x*sa+z*ca);uv.push(q,1-t);if(j<seg&&k<8){const a=j*9+k;idx.push(a,a+9,a+1,a+1,a+9,a+10);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();world.add(new THREE.Mesh(g,waterfallMat));
  }
  const roofMat=new THREE.MeshStandardMaterial({color:0x38354e,roughness:.58,metalness:.15,side:THREE.DoubleSide});
  const woodMat=new THREE.MeshStandardMaterial({color:0x86594b,map:TEX.barkColor||null,bumpMap:TEX.barkColor||null,bumpScale:.045,roughness:.79});
  const plasterMat=new THREE.MeshStandardMaterial({color:0xe7ded2,map:TEX.plasterColor||null,bumpMap:TEX.groundHeight||null,bumpScale:.018,roughness:.88});
  function roofGeometry(width,depth){const p=[],idx=[];for(let z=0;z<=16;z++){const zz=(z/16-.5)*2;for(let x=0;x<=16;x++){const xx=(x/16-.5)*2;const y=(1-Math.abs(zz))*2.5+Math.pow(Math.abs(xx),6)*1.5+Math.pow(Math.abs(zz),8)*.6;p.push(xx*width/2,y,zz*depth/2);if(x<16&&z<16){const a=z*17+x;idx.push(a,a+17,a+1,a+1,a+17,a+18);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;}
  function temple(island){const group=new THREE.Group();group.position.set(island.x-island.r*.12,island.y+.35,island.z-island.r*.16);const levels=3;for(let j=0;j<levels;j++){const scale=1-j*.2,y=j*5;const floor=new THREE.Mesh(new THREE.BoxGeometry(12*scale,3.7,8*scale),plasterMat);floor.position.y=y+2;group.add(floor);for(const x of[-1,1])for(const z of[-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.22,.27,4.6,8),woodMat);post.position.set(x*6.2*scale,y+2,z*4.2*scale);group.add(post);}const roof=new THREE.Mesh(roofGeometry(18*scale,13*scale),roofMat);roof.position.y=y+3.7;roof.castShadow=true;group.add(roof);for(let k=-2;k<=2;k++){const window=new THREE.Mesh(new THREE.PlaneGeometry(.6,2),woodMat);window.position.set(k*1.5*scale,y+2,4*scale+.02);group.add(window);}const deck=new THREE.Mesh(new THREE.BoxGeometry(15*scale,.35,10.5*scale),stoneMat);deck.position.y=y+.2;group.add(deck);
      // Balcony rails, tiled eave lines and warm recessed windows establish temple scale.
      const light=new THREE.MeshStandardMaterial({color:0xffd28a,emissive:0xffa34e,emissiveIntensity:.7,roughness:.5});
      for(const side of [-1,1]){
        mapMesh(new THREE.BoxGeometry(14*scale,.12,.13),woodMat,group,0,y+1.05,side*5*scale);
        for(let k=-5;k<=5;k++)mapMesh(new THREE.BoxGeometry(.10,.88,.10),woodMat,group,k*1.25*scale,y+.65,side*5*scale);
        for(let k=-2;k<=2;k++)mapMesh(new THREE.PlaneGeometry(.42,1.4),light,group,k*1.5*scale,y+2,side*(4*scale+.04)).rotation.y=side<0?Math.PI:0;
        for(let k=-7;k<=7;k++){
          const x=k*1.1*scale;
          mapTube([[x,y+6.22,0],[x,y+4.6,side*3*scale],[x,y+4.15+Math.pow(Math.abs(x)/(9*scale),6)*1.5,side*6.5*scale]],.055,roofMat,group,6);
        }
      }
    }world.add(group);}
  islands.forEach((island,n)=>{
    const cliff=new THREE.Mesh(islandGeometry(island.r,island.depth,n+80),cliffMat);cliff.position.set(island.x,island.y,island.z);cliff.castShadow=true;cliff.receiveShadow=true;world.add(cliff);
    const cap=new THREE.Mesh(typeof islandCapGeometry==='function'?islandCapGeometry(island.r,n+80):new THREE.CircleGeometry(island.r,48).rotateX(-Math.PI/2),grassMat);cap.name='continuous-island-cap';cap.position.set(island.x,island.y,island.z);cap.receiveShadow=true;world.add(cap);
    const pond=new THREE.Mesh(new THREE.CircleGeometry(island.r*.36,40),pondMat);pond.rotation.x=-Math.PI/2;pond.scale.y=.68;pond.position.set(island.x+island.r*.12,island.y+.09,island.z+island.r*.23);world.add(pond);
    // A continuous stream bridges the pond to the visible waterfall lip.
    const stream=new THREE.Mesh(new THREE.PlaneGeometry(island.r*.29,island.r*.53),pondMat);stream.rotation.x=-Math.PI/2;stream.position.set(island.x,island.y+.1,island.z+island.r*.55);world.add(stream);
    waterfall(island,island.r*.29,0);if(n%3===0)waterfall(island,island.r*.18,-.9);
    if(island.temple){if(activeMap.id==='cherry')temple(island);else if(!(activeMap.id==='canopy'&&n===0))buildMapLandmark(island,n);}
    const count=Math.floor(island.r/2.4);for(let j=0;j<count;j++){const a=j/count*Math.PI*2+random()*.2,d=island.r*(.56+random()*.2),spot={x:island.x+Math.cos(a)*d,y:island.y+.06,z:island.z+Math.sin(a)*d*.78,s:1+random()*.6,rot:random()*6.3};(activeMap.id!=='cherry'||j%3===0?bonsaiSpots:cherrySpots).push(spot);}
    // Irregular pale stepping stones on the moss, grouped around the pond.
    const stones=[];for(let k=0;k<8;k++){const g=rockGeo(n*19+k);g.scale(.8,.18,.65);g.translate(island.x+Math.cos(k*.4)*island.r*.5,island.y+.15,island.z+Math.sin(k*.4)*island.r*.38);stones.push(g);}const stoneGeo=mergeGeos(stones);stones.forEach(g=>g.dispose());world.add(new THREE.Mesh(stoneGeo,stoneMat));
  });
  function instanceTrees(spots,isBonsai){if(!spots.length)return;const can=new THREE.InstancedMesh(isBonsai?greenGeo:pinkGeo,isBonsai?pinkMat:blossomMat,spots.length),tr=new THREE.InstancedMesh(trunk,barkMat,spots.length),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);spots.forEach((s,i)=>{q.setFromAxisAngle(axis,s.rot);matrix.compose(new THREE.Vector3(s.x,s.y,s.z),q,new THREE.Vector3(s.s,s.s*(isBonsai?.72:1),s.s));tr.setMatrixAt(i,matrix);matrix.compose(new THREE.Vector3(s.x,s.y+s.s*(isBonsai?2.6:3.6),s.z),q,new THREE.Vector3(s.s*(isBonsai?1.25:1),s.s*(isBonsai?.38:1),s.s));can.setMatrixAt(i,matrix);});can.geometry.userData.wind=true;can.castShadow=true;tr.castShadow=true;world.add(can,tr);}
  // Planted terraces frame the road at driver height. No vegetation enters the lanes.
  for(let k=0;k<50;k++){
    const u=k/50+.009;if(trackAG(u)>.15)continue;
    const side=k%2?1:-1,p=new THREE.Vector3();trackPoint(u,side*12.8,-.6,p);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(3.7,2.6,1.8,12),stoneMat);base.position.copy(p);base.position.y-=.9;world.add(base);
    const soil=new THREE.Mesh(new THREE.CircleGeometry(3.6,16),grassMat);soil.rotation.x=-Math.PI/2;soil.position.copy(p);soil.position.y+=.02;world.add(soil);
    const spot={x:p.x,y:p.y+.03,z:p.z,s:.8+random()*.35,rot:random()*6.28};
    (activeMap.id==='cherry'?cherrySpots:bonsaiSpots).push(spot);
  }
  instanceTrees(cherrySpots,false);instanceTrees(bonsaiSpots,true);
  if(!cherrySpots.length){pinkGeo.dispose();blossomMat.dispose();}
  if(!bonsaiSpots.length){greenGeo.dispose();pinkMat.dispose();}
  // Small uninhabited fragments hang beneath the large islands, never in driving space.
  for(let k=0;k<14;k++){const host=islands[k%islands.length],g=islandGeometry(3+random()*3,10+random()*9,k+600),m=new THREE.Mesh(g,cliffMat);m.position.set(host.x+host.r*1.4,host.y-35-random()*30,host.z+host.r);world.add(m);}
  buildCircuitArchitecture();
  // Static architecture shares material batches; transparent water remains separate.
  world.updateMatrixWorld(true);const batches=new Map();
  world.traverse(mesh=>{if(!mesh.isMesh||mesh.userData.dynamic||mesh.isInstancedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.vertexColors)return;const list=batches.get(mesh.material)||[];list.push(mesh);batches.set(mesh.material,list);});
  for(const [material,meshes] of batches){if(meshes.length<3)continue;const geometries=meshes.map(mesh=>mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));const merged=new THREE.Mesh(mergeGeos(geometries),material);merged.castShadow=meshes.some(m=>m.castShadow);merged.receiveShadow=meshes.some(m=>m.receiveShadow);const originals=new Set(meshes.map(mesh=>mesh.geometry));meshes.forEach(mesh=>mesh.parent.remove(mesh));originals.forEach(g=>g.dispose());geometries.forEach(g=>g.dispose());world.add(merged);}
  buildRaceVenue();
  if(typeof buildImmersion==='function')buildImmersion();
  if(typeof buildNaturalStonework==='function')buildNaturalStonework();
  if(typeof buildTerrainPlanting==='function')buildTerrainPlanting();
  if(typeof buildLivingWorld==='function')buildLivingWorld();
  if(typeof buildAudience==='function')buildAudience();

}

// Authored landmark kit: modeled ribs, blades, roots and galleries remain world
// geometry so the camera can race through and around the reference architecture.
function mapMesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function mapTube(points,radius,material,parent,segments=28){return mapMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,7,false),material,parent);}
function buildMapLandmark(island,index){
  const g=new THREE.Group();g.position.set(island.x,island.y,island.z);world.add(g);
  const ivory=new THREE.MeshStandardMaterial({color:0xe7e7d7,roughness:.34,metalness:.38});
  const dark=new THREE.MeshStandardMaterial({color:0x434e60,roughness:.42,metalness:.7});
  const amber=new THREE.MeshBasicMaterial({color:0xffbd61});
  if(activeMap.id==='stormforge'){
    // Riveted foundry towers: stepped roof, inset louvres, light seams, service pipes.
    const w=island.r*.43,h=20+(index%4)*8;
    mapMesh(new THREE.CylinderGeometry(w,w+2,3,8),dark,g,0,1.5,0);
    mapMesh(new THREE.CylinderGeometry(w*.86,w,h,8),dark,g,0,h/2+3,0);
    mapMesh(new THREE.CylinderGeometry(w,w*.86,2,8),ivory,g,0,h+3,0);
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4,x=Math.sin(a)*w*.96,z=Math.cos(a)*w*.96;
      mapMesh(new THREE.CylinderGeometry(.19,.19,h*.8,6),amber,g,x,h*.53+2,z);
      const vent=mapMesh(new THREE.BoxGeometry(2.8,3,.35),dark,g,x,h-1,z);vent.rotation.y=a;
      for(let k=0;k<5;k++){const slat=mapMesh(new THREE.BoxGeometry(2.5,.12,.45),ivory,g,x,h-2+k*.45,z);slat.rotation.y=a;}
      if(j%2===0){mapTube([[x*.8,2,z*.8],[x*1.25,2,z*1.25],[x*1.25,h*.65,z*1.25],[x,h*.7,z]],.35,ivory,g);}
    }
    if(index%2===0){
      const housing=new THREE.Group();housing.position.set(0,14,-w-3);g.add(housing);buildTurbine(housing,13,dark,ivory,amber);
    }else{
      // Rotating-joint crane and lattice boom above the industrial garden.
      mapMesh(new THREE.CylinderGeometry(.8,1,19,10),ivory,g,w*.8,12,0);
      for(const y of[6,18])mapMesh(new THREE.CylinderGeometry(1.4,1.4,.8,12),dark,g,w*.8,y,0);
      for(const z of[-.65,.65])mapTube([[w*.8,20,z],[w*.8+3,26,z],[w*.8+19,26,z]],.3,ivory,g);
      for(let k=0;k<8;k++)mapTube([[w*.8+3+k*2,26,-.65],[w*.8+5+k*2,26,.65]],.1,amber,g,1);
      mapMesh(new THREE.CylinderGeometry(.045,.045,12,5),dark,g,w*.8+18,20,0);
      mapMesh(new THREE.BoxGeometry(3,3,3),dark,g,w*.8+18,12.5,0);
    }
  }else{
    // Conservatory: actual hemisphere glass shell with meridian ribs and rings.
    const radius=Math.min(island.r*.46,18),glass=new THREE.MeshPhysicalMaterial({color:0x9fe6df,roughness:.12,metalness:.14,transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false});
    mapMesh(new THREE.CylinderGeometry(radius+1,radius+1.6,1.5,40),ivory,g,0,.6,0);
    mapMesh(new THREE.SphereGeometry(radius,32,16,0,Math.PI*2,0,Math.PI/2),glass,g,0,1.3,0);
    for(let j=0;j<12;j++){
      const a=j*Math.PI/6,points=[];for(let k=0;k<=18;k++){const t=k/18*Math.PI/2;points.push([Math.cos(a)*Math.cos(t)*radius,1.3+Math.sin(t)*radius,Math.sin(a)*Math.cos(t)*radius]);}mapTube(points,.17,ivory,g,18);
    }
    for(const t of[.25,.6,1]){const ring=mapMesh(new THREE.TorusGeometry(Math.cos(t)*radius,.14,6,48),ivory,g,0,1.3+Math.sin(t)*radius,0);ring.rotation.x=Math.PI/2;}
    const leaf=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.85,side:THREE.DoubleSide});
    for(let j=0;j<7;j++){const a=j*2.4,d=radius*.62*Math.sqrt(j/7);const plant=mapMesh(treeCanopyGeo(150+j,[0x244b31,0x6eac47]),leaf,g,Math.cos(a)*d,2,Math.sin(a)*d);plant.scale.setScalar(.65);}
  }
}
function buildTurbine(parent,radius,dark,metal,light){
  mapMesh(new THREE.TorusGeometry(radius,.95,10,52),dark,parent);
  mapMesh(new THREE.TorusGeometry(radius*.88,.19,6,52),light,parent,0,0,.5);
  const rotor=new THREE.Group();parent.add(rotor);mapSceneryAnimations.push(rotor);
  const hub=mapMesh(new THREE.CylinderGeometry(radius*.17,radius*.24,3,16),metal,rotor);hub.rotation.x=Math.PI/2;
  for(let j=0;j<10;j++){
    const shape=new THREE.Shape();shape.moveTo(radius*.15,-.4);shape.bezierCurveTo(radius*.5,-radius*.22,radius*.85,-radius*.2,radius*.9,-radius*.04);shape.lineTo(radius*.85,radius*.1);shape.bezierCurveTo(radius*.6,0,radius*.4,radius*.1,radius*.15,.4);shape.closePath();
    const blade=mapMesh(new THREE.ExtrudeGeometry(shape,{depth:.35,bevelEnabled:true,bevelThickness:.15,bevelSize:.13,bevelSegments:2,curveSegments:8}),metal,rotor);blade.rotation.z=j*Math.PI/5;
  }
  rotor.updateMatrixWorld(true);
  const rotorParts=rotor.children.map(m=>m.geometry.clone().applyMatrix4(m.matrix));
  const mergedRotor=mergeGeos(rotorParts);rotorParts.forEach(g=>g.dispose());
  rotor.children.forEach(m=>m.geometry.dispose());rotor.clear();mapMesh(mergedRotor,metal,rotor);
  rotor.traverse(o=>{o.userData.dynamic=true;});
  for(let j=0;j<16;j++){const a=j*Math.PI/8;mapMesh(new THREE.SphereGeometry(.2,5,4),metal,parent,Math.cos(a)*radius,Math.sin(a)*radius,1);}
}
function buildCircuitArchitecture(){
  const metal=new THREE.MeshStandardMaterial({color:activeMap.id==='stormforge'?0x8994a3:0xe7e5dd,roughness:.38,metalness:.45});
  const dark=new THREE.MeshStandardMaterial({color:0x3e4859,roughness:.42,metalness:.62});
  const glow=new THREE.MeshBasicMaterial({color:activeMap.trim});
  const cyan=new THREE.MeshBasicMaterial({color:activeMap.edge});
  const putAt=(u)=>{const g=new THREE.Group(),p=new THREE.Vector3(),t=new THREE.Vector3(),up=new THREE.Vector3(),r=new THREE.Vector3();trackPoint(u,0,0,p);trackTan(u,t);trackUp(u,up);trackRight(u,r);g.position.copy(p);g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r,up,t.clone().negate()));world.add(g);return g;};
  // Repeating structural piers follow the road vertically without entering lanes.
  for(let k=0;k<28;k++){
    const u=k/28;if(trackAG(u)>.2)continue;const g=putAt(u);
    for(const side of[-1,1]){
      mapTube([[side*6.8,-.7,0],[side*5,-2,0],[side*1.2,-8,0],[side*.8,-19,0]],.6,metal,g,12);
      if(activeMap.id==='stormforge')mapTube([[side*6.5,-1,-3],[side*3,-6,0],[side*6.5,-1,3]],.22,dark,g,4);
    }
  }
  for(let k=0;k<100;k++){
    const u=k/100;if(trackAG(u)>.15)continue;const g=putAt(u);
    for(const side of [-1,1]){
      mapMesh(new THREE.BoxGeometry(.16,1.05,.16),metal,g,side*7.35,.53,0);
      if(k%4===0){
        mapMesh(new THREE.CylinderGeometry(.15,.30,1.7,8),metal,g,side*8.3,.85,0);
        mapMesh(new THREE.BoxGeometry(.64,.62,.64),dark,g,side*8.3,1.96,0);
        mapMesh(new THREE.BoxGeometry(.49,.46,.66),glow,g,side*8.3,1.96,0);
        const cap=mapMesh(new THREE.ConeGeometry(.68,.35,4),metal,g,side*8.3,2.44,0);cap.rotation.y=Math.PI/4;
      }
    }
  }
  // Start gate is a full-width traversable arch; the hanging banner clears racers.
  const gate=putAt(.007);
  if(activeMap.id==='cherry'){
    const vermilion=new THREE.MeshStandardMaterial({color:0x8c3e50,roughness:.58});
    for(const x of[-8.7,8.7]){mapMesh(new THREE.CylinderGeometry(.52,.68,11,12),vermilion,gate,x,5,0);mapMesh(new THREE.CylinderGeometry(.9,.9,1.1,12),dark,gate,x,.3,0);}
    mapTube([[-10.8,12.4,0],[-8.8,11.5,0],[0,11,0],[8.8,11.5,0],[10.8,12.4,0]],.55,dark,gate);
    mapMesh(new THREE.BoxGeometry(20,.6,.7),vermilion,gate,0,9.5,0);
  }else{
    for(const x of[-8.8,8.8]){mapMesh(new THREE.BoxGeometry(1.6,10,2),metal,gate,x,5,0);mapMesh(new THREE.BoxGeometry(.22,8,2.06),cyan,gate,x,5,0);}
    mapMesh(new THREE.BoxGeometry(20,2,2.3),metal,gate,0,10,0);
    mapMesh(new THREE.BoxGeometry(17,.16,2.36),glow,gate,0,10.5,0);
  }
  const flagMat=new THREE.MeshStandardMaterial({map:TEX.finish,emissive:0x7ca2cd,emissiveIntensity:.25,side:THREE.DoubleSide});
  mapMesh(new THREE.PlaneGeometry(6,1.3),flagMat,gate,0,8.5,0);
  if(activeMap.id==='stormforge'){
    const portal=new THREE.Group();portal.position.set(-100,32,-302);world.add(portal);
    const archMat=new THREE.MeshStandardMaterial({color:0x778391,metalness:.68,roughness:.3});
    const portalLight=new THREE.MeshStandardMaterial({color:0xffb64b,emissive:0xff8a20,emissiveIntensity:2.3,roughness:.3});
    for(let ring=0;ring<4;ring++){
      const z=-ring*6,r=37-ring*1.6;
      mapMesh(new THREE.TorusGeometry(r,2.1,8,72),archMat,portal,0,0,z);
      mapMesh(new THREE.TorusGeometry(r-2.2,.32,6,72),portalLight,portal,0,0,z+.8);
      for(let j=0;j<24;j++){
        const a=j*Math.PI/12,m=mapMesh(new THREE.BoxGeometry(2.8,4.8,3.2),dark,portal,Math.sin(a)*r,Math.cos(a)*r,z);m.rotation.z=-a;
        if(j%2===0){const l=mapMesh(new THREE.BoxGeometry(1.3,3.6,.5),portalLight,portal,Math.sin(a)*(r-1),Math.cos(a)*(r-1),z+1.9);l.rotation.z=-a;}
      }
    }
    for(const side of [-1,1]){
      mapMesh(new THREE.BoxGeometry(9,82,17),dark,portal,side*43,3,-8);
      mapMesh(new THREE.BoxGeometry(.7,66,17.1),portalLight,portal,side*43,3,-8);
      mapMesh(new THREE.BoxGeometry(13,3,21),archMat,portal,side*43,43,-8);
    }
    // Track passes through the illuminated ribbed hangar; all ribs clear its width.
    for(let k=0;k<9;k++){
      const g=putAt(.325+k*.008);const pts=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI;pts.push([Math.cos(a)*10,Math.sin(a)*12,0]);}mapTube(pts,.65,metal,g,24);mapTube(pts,.13,glow,g,24).position.z=.7;
      if(k%2===0)for(const x of[-10.5,10.5])mapMesh(new THREE.BoxGeometry(2.2,5,1.4),dark,g,x,2.5,0);
    }
    for(const u of[.13,.57,.78]){const g=putAt(u),housing=new THREE.Group();housing.position.set(26,10,-6);g.add(housing);buildTurbine(housing,16,dark,metal,glow);mapMesh(new THREE.BoxGeometry(12,3,12),metal,g,26,-5,-6);}
  }
  if(activeMap.id==='canopy'){
    // Glass garden tunnel with curved ribs, trailing vines and luminous blossoms.
    const bark=new THREE.MeshStandardMaterial({color:0xc3b494,map:TEX.barkColor||null,bumpMap:TEX.barkColor||null,bumpScale:.2,roughness:.96});
    const leaf=new THREE.MeshStandardMaterial({color:0x56983e,roughness:.83,side:THREE.DoubleSide});
    const glass=new THREE.MeshPhysicalMaterial({color:0xadddf2,transparent:true,opacity:.11,roughness:.08,side:THREE.DoubleSide,depthWrite:false});
    for(let k=0;k<12;k++){
      const g=putAt(.67+k*.007);const pts=[];for(let j=0;j<=20;j++){const a=j/20*Math.PI;pts.push([Math.cos(a)*8.7,Math.sin(a)*8.7,0]);}mapTube(pts,.16,metal,g,20);
      const shell=mapMesh(new THREE.CylinderGeometry(8.7,8.7,5.8,20,1,true,0,Math.PI),glass,g);shell.rotation.set(0,0,Math.PI/2);shell.rotation.y=Math.PI/2;
      // Vines stay beyond the track boundary; leaves are merged by material below.
      for(const side of[-1,1]){mapTube([[side*8.4,1,0],[side*8.1,3,.3],[side*6.8,5.2,0],[side*5.4,6.9,.2]],.075,bark,g,10);for(let j=0;j<9;j++){const l=mapMesh(new THREE.SphereGeometry(.4,5,4),leaf,g,side*(8.3-j*.33),1+j*.64,.18);l.scale.set(.5,1,.23);l.rotation.z=side*(.7+(j%2)*.7);}}
    }
    // Ancient central tree with buttress roots, winding branches, canopy terraces.
    const tree=new THREE.Group();tree.position.set(-103,-5,-130);world.add(tree);
    const trunkPoints=[];for(let j=0;j<=16;j++){const t=j/16;trunkPoints.push(new THREE.Vector2(9*(1-t*.69)+Math.sin(t*16)*.65,t*72));}
    mapMesh(displace(new THREE.LatheGeometry(trunkPoints,24),1.3,.32,891),bark,tree);
    for(let j=0;j<12;j++){
      const a=j*Math.PI/6;mapTube([[Math.cos(a)*19,-1,Math.sin(a)*19],[Math.cos(a)*9,5,Math.sin(a)*9],[Math.cos(a)*5,21,Math.sin(a)*5]],1.6,bark,tree,14);
      const y=40+j%4*7,points=[[0,y-10,0],[Math.cos(a)*11,y,Math.sin(a)*11],[Math.cos(a)*28,y+8,Math.sin(a)*28]];mapTube(points,1.4,bark,tree,18);
      const crown=mapMesh(treeCanopyGeo(800+j,[0x25482b,0x82a84b]),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,side:THREE.DoubleSide}),tree,Math.cos(a)*23,y+7,Math.sin(a)*23);crown.scale.set(3.5,1.6,3.5);crown.geometry.userData.wind=true;
    }
    for(const y of[26,39,52]){mapMesh(new THREE.CylinderGeometry(11.5,7.5,2.2,40),metal,tree,0,y,0);const rail=mapMesh(new THREE.TorusGeometry(11.4,.15,6,48),cyan,tree,0,y+1.8,0);rail.rotation.x=Math.PI/2;}
    // Far below the circuit: a rippled turquoise sea instead of an empty void.

  }
  buildHorizonLandscape();
  buildMapClouds();
}
// Three concentric mountain ranges have sloping faces and light response. One mesh per
// layer, no alpha overdraw, no shadows and no runtime geometry allocation.
function buildHorizonLandscape(){
  const garden=activeMap.id==='canopy',industrial=activeMap.id==='stormforge';
  const group=new THREE.Group();group.name='horizon-landscape';
  for(let layer=0;layer<3;layer++){
    const radius=490+layer*170,segments=MOBILEFX?72:120,rows=6,positions=[],indices=[];
    for(let row=0;row<=rows;row++)for(let i=0;i<=segments;i++){
      const a=i/segments*Math.PI*2,t=row/rows;
      const ridge=Math.sin(a*5+layer)*.5+Math.sin(a*11+1.2)*.26+Math.sin(a*23+layer*2)*.12;
      const top=(garden?20:industrial?44:12)+layer*15+Math.pow(Math.abs(ridge),1.3)*(garden?115:industrial?100:145);
      const r=radius+(t-.5)*140,profile=Math.pow(Math.sin(t*Math.PI),1.7);
      const y=-125+(top+125)*profile+Math.sin(a*37+row)*profile*(1-profile)*12;
      positions.push(-20+Math.cos(a)*r,y,-120+Math.sin(a)*r);
      if(row<rows&&i<segments){const k=row*(segments+1)+i,m=k+segments+1;indices.push(k,k+1,m,k+1,m+1,m);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const color=new THREE.Color(garden?0x527b78:industrial?0x59677c:0x7d7799).lerp(new THREE.Color(activeMap.fog),layer*.24);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,side:THREE.DoubleSide,fog:true}));mesh.name='horizon-ridge-'+layer;group.add(mesh);
  }
  world.add(group);
}
function buildMapClouds(){
  // Soft alpha billboards below the road preserve clear racing sightlines.
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');if(!ctx)return;
  const gradient=ctx.createRadialGradient(64,64,5,64,64,63);gradient.addColorStop(0,'rgba(255,255,255,.75)');gradient.addColorStop(.38,'rgba(255,255,255,.5)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex,color:activeMap.id==='canopy'?0xe8f7fa:0xe9dcf3,transparent:true,opacity:.72,depthWrite:false,fog:true});
  // Owned texture is explicitly released alongside map scenery on a map switch.
  mat.userData.mapTexture=tex;
  const rnd=mulberry(270);for(let k=0;k<(MOBILEFX?42:76);k++){const sprite=new THREE.Sprite(mat);sprite.position.set((rnd()-.5)*850,-36-rnd()*65,-120+(rnd()-.5)*850);const s=60+rnd()*100;sprite.scale.set(s,s*.5,1);world.add(sprite);}
}

// A race venue is more than a ribbon in a landscape. Every repeated component is
// instanced by geometry/material, with opaque surfaces and deterministic crowds.
// All placements use the real transported track frame, including elevated bends.
function buildRaceVenue(){
  if(typeof resetAudience==='function')resetAudience();
  const root=new THREE.Group();root.name='race-venue';world.add(root);
  const industrial=activeMap.id==='stormforge',garden=activeMap.id==='canopy';
  const materials={
    structure:new THREE.MeshStandardMaterial({color:industrial?0x657486:garden?0xd5dbc5:0xe6d9ce,roughness:.74,metalness:industrial?.55:.12}),
    dark:new THREE.MeshStandardMaterial({color:0x26313b,roughness:.66,metalness:.32}),
    paint:new THREE.MeshStandardMaterial({color:industrial?0xe9a33e:garden?0x3f735b:0xa94054,roughness:.63,metalness:.12}),
    white:new THREE.MeshStandardMaterial({color:0xe9e8dc,roughness:.8}),
    people:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.93}),
    light:new THREE.MeshStandardMaterial({color:0xffedc7,emissive:0xffda92,emissiveIntensity:.7,roughness:.38})
  };
  const geos={box:new THREE.BoxGeometry(1,1,1),head:new THREE.SphereGeometry(.5,7,5),post:new THREE.CylinderGeometry(.5,.5,1,7)};
  const batches=new Map(),matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3();
  const random=mulberry(991+activeMap.id.length),placements=[];
  function frame(u,side=0){
    const p=new THREE.Vector3(),r=new THREE.Vector3(),up=new THREE.Vector3(),t=new THREE.Vector3();
    trackPoint(u,side,0,p);trackRight(u,r);trackUp(u,up);trackTan(u,t);
    return new THREE.Matrix4().makeBasis(r,up,t.negate()).setPosition(p);
  }
  function part(base,type,mat,x,y,z,sx,sy,sz,rz=0,color=null){
    rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),rz);position.set(x,y,z);scale.set(sx,sy,sz);
    local.compose(position,rotation,scale);matrix.multiplyMatrices(base,local);
    const key=type+':'+mat,list=batches.get(key)||[];list.push({matrix:matrix.clone(),color});batches.set(key,list);
  }
  // Test the complete building envelope, not just its origin. A different sector
  // can pass behind or above a candidate stand on these compact folded circuits.
  function clearBuilding(base,halfX,halfZ,height){
    const inv=base.clone().invert(),p=new THREE.Vector3();
    for(let i=0;i<N_SAMP;i+=3){p.copy(track.pos[i]).applyMatrix4(inv);if(Math.abs(p.x)<halfX+TRACK_W/2+1.5&&Math.abs(p.z)<halfZ+TRACK_W/2+1.5&&p.y>-12&&p.y<height+3)return false;}
    return true;
  }
  let stands=0,garages=0,spectators=0;
  for(let k=0;k<30&&stands<6;k++){
    const u=(k*.137+.035)%1;if(trackAG(u)>.1)continue;
    const side=k%2?-1:1,base=frame(u,side*22);
    if(!clearBuilding(base,6,13,10))continue;
    placements.push({kind:'grandstand',u,side,matrix:base.elements.slice(),halfX:6,halfZ:13,height:10});stands++;
    part(base,'box','dark',0,-1,0,12,1.8,26);
    for(let row=0;row<5;row++){
      const x=side*(-4.5+row*1.9),y=.3+row*1.15;
      part(base,'box','structure',x,y-.25,0,1.9,.55,25);
      part(base,'box','paint',x,y+.23,0,.8,.18,24);
      for(let seat=0;seat<(MOBILEFX?14:22);seat++){
        if(random()<.17)continue;
        const z=-11.5+seat*(MOBILEFX?1.7:1.1),h=.8+random()*.28;
        const palette=[0xc94849,0xebb657,0x498ab0,0xede5d0,0x46644c,0x9478ac];
        const color=palette[Math.floor(random()*palette.length)];
        if(typeof addAudienceSeat==='function')addAudienceSeat(base,x,y+.36,z,side,color,stands*200+row*24+seat);
        else {part(base,'box','people',x,y+.65,z,.43,h,.38,0,color);part(base,'head','people',x,y+1.27,z,.36,.43,.36,0,[0xd6a27c,0x956447,0x613d2d][seat%3]);}
        spectators++;
      }
    }
    for(const z of[-12,12])for(const x of[-5.6,5.6])part(base,'post','structure',x,4.2,z,.24,9,.24);
    part(base,'box','paint',0,9,0,13,.3,27,side*.06);
    part(base,'box','dark',side*5.9,7.7,0,.2,2.4,25);
    for(const z of[-12,12])part(base,'box','structure',0,5.6,z,12,.2,.2);
    // Cantilever piers and bracing make stands read as built skyway structures.
    for(const z of[-9,9])for(const x of[-4,4])part(base,'post','dark',x,-5,z,.6,8,.6);
  }
  for(let k=0;k<16&&garages<3;k++){
    const u=(.055+k*.063)%1;if(trackAG(u)>.1)continue;
    const base=frame(u,-24);if(!clearBuilding(base,6,15,8))continue;
    garages++;placements.push({kind:'pit-garage',u,matrix:base.elements.slice(),halfX:6,halfZ:15,height:8});
    part(base,'box','structure',0,-.5,0,12,1,30);
    part(base,'box','dark',-4,3,0,3,6,29);
    part(base,'box','paint',0,6.3,0,12,.65,31);
    part(base,'box','structure',0,7.3,0,10,1.4,28);
    for(let bay=0;bay<5;bay++){
      const z=-12+bay*6;
      part(base,'box','structure',1,3,z-2.8,8,6,.28);
      part(base,'box','light',4.9,5.7,z,.15,.22,4.8);
      part(base,'box','paint',-1,.8,z,2,1.6,2.6);
      for(let shelf=0;shelf<3;shelf++)part(base,'box','dark',-2,1.8+shelf*.52,z,1,.13,3.8);
      // Physical stacked spare tyres and tool chests inside each open garage.
      for(let tyre=0;tyre<3;tyre++)part(base,'post','dark',2,.28+tyre*.46,z+1.6,1.3,.4,1.3);
    }
  }
  // Painted starting boxes sit flush with the road and describe a racing grid.
  for(let row=0;row<6;row++)for(const lane of[-1,1]){
    const base=frame(1-.004-row*.006-(lane===1?.002:0));
    part(base,'box','white',lane*2.6,.058,0,2.2,.008,.11);
    for(const edge of[-1,1])part(base,'box','white',lane*2.6+edge*1.05,.058,.5,.11,.008,1);
  }
  // Sector trusses: posts outside the barrier; lowest overhead point 7.4 m.
  for(const u of[.23,.51,.79]){
    const base=frame(u);if(trackAG(u)>.1)continue;
    for(const side of[-1,1]){
      part(base,'box','dark',side*9,4.2,0,.55,8.4,.7);
      part(base,'box','paint',side*9,1.5,0,1.15,3,1.2);
    }
    for(const h of[7.7,9.1])part(base,'box','structure',0,h,0,18.5,.22,.5);
    for(let j=0;j<12;j++)part(base,'box','structure',-8.4+j*1.5,8.4,0,.12,2.02,.2,j%2?.8:-.8);
    part(base,'box','dark',0,8.3,.35,6,1.5,.25);
    for(let j=0;j<5;j++)part(base,'head','light',-1.8+j*.9,8.3,.54,.42,.42,.16);
  }
  // Kerbs and rubber marks follow the complete spline; no new collision bodies.
  const stripe=Math.max(2,Math.round(N_SAMP/(track.len/2.3)));
  for(const side of[-1,1]){
    const profile=[[side*6.45,.065],[side*6.92,.065]].sort((a,b)=>a[0]-b[0]);
    const kerb=buildRibbon(profile,materials.white);kerb.name='race-kerb';root.add(kerb);
    const red=buildRibbon(profile.map(([x,y])=>[x,y+.004]),materials.paint,i=>Math.floor(i/stripe)%2===0);root.add(red);
    const wearMat=new THREE.MeshStandardMaterial({color:0x25282d,roughness:.97,transparent:true,opacity:.24,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const wear=buildRibbon([[side*3.4,.059],[side*3.77,.059]].sort((a,b)=>a[0]-b[0]),wearMat,i=>Math.abs(track.curv[i])>.009);wear.name='racing-line-rubber';root.add(wear);
  }
  // Closely spaced physical chevrons on outer bends, readable at racing speed.
  let markers=0;
  for(let k=0;k<72;k++){
    const u=k/72,c=trackCurv(u);if(Math.abs(c)<.011||trackAG(u)>.1)continue;
    const side=c>0?-1:1,base=frame(u);
    part(base,'post','structure',side*8.2,1.7,0,.15,3.4,.15);
    part(base,'box','dark',side*8.2,2.7,0,1.8,1.5,.16);
    for(const h of[-1,1])part(base,'box','white',side*8.2,2.7+h*.26,.1,.75,.17,.06,h*side*.68);
    markers++;
  }
  // Inhabited outer promenades connect the otherwise isolated race buildings.
  // The entire footprint is tested against every section of the folded road.
  let districts=0,lamps=0;
  const occupied=placements.map(p=>({center:new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(p.matrix)),radius:Math.hypot(p.halfX,p.halfZ)}));
  for(let k=0;k<100&&districts<(MOBILEFX?16:24);k++){
    const u=(.018+k*.0618)%1,side=k%2?1:-1;
    if(trackAG(u)>.08)continue;
    const base=frame(u,side*(36+(k%3)*9)),center=new THREE.Vector3().setFromMatrixPosition(base);
    if(!clearBuilding(base,8,10,13)||occupied.some(p=>p.center.distanceTo(center)<p.radius+14))continue;
    occupied.push({center,radius:13});districts++;
    placements.push({kind:industrial?'service-foundry':garden?'botanical-promenade':'festival-court',u,matrix:base.elements.slice(),halfX:8,halfZ:10,height:13});
    // Cantilever deck, perimeter balustrade, piers and underside cross braces.
    part(base,'box','structure',0,-.7,0,16,1.4,20);
    part(base,'box','dark',0,-1.5,0,14,.3,18);
    for(const x of[-7.5,7.5]){
      part(base,'box','paint',x,1.8,0,.16,.18,19);
      for(let z=-9;z<=9;z+=3)part(base,'post','structure',x,.9,z,.12,1.8,.12);
      for(const z of[-7,7]){part(base,'post','dark',x,-5,z,.5,9,.5);part(base,'box','structure',x*.55,-3.6,z,.22,7,.3,x>0?-.8:.8);}
    }
    // Inlaid promenade paving and edge lights give the deck a human scale.
    for(let z=-8;z<=8;z+=2){part(base,'box','white',0,.018,z,3,.018,.12);for(const x of[-6.8,6.8])part(base,'box','light',x,.04,z,.22,.08,.55);}
    if(industrial){
      // Service plant: vessels with collars, pipe manifolds, stairs and vents.
      for(const z of[-5,0,5]){
        part(base,'post','structure',-3.8,3,z,3.2,6,3.2);
        for(const y of[.4,2.3,4.5,5.8])part(base,'post','dark',-3.8,y,z,3.4,.16,3.4);
        part(base,'head','people',-3.8,6,z,3.2,1,3.2,0,0x657486);
        part(base,'box','paint',-3.8,3.2,z+1.62,.6,2,.08);
        part(base,'post','dark',-1.9,2,z,.35,4,.35);
        part(base,'box','structure',-1,4,z,2.1,.3,.3);
        part(base,'box','dark',4,1.4,z,3,2.8,3.5);
        for(let vent=0;vent<6;vent++)part(base,'box','structure',4,1.5,z-1.4+vent*.5,3.06,.13,.18);
      }
      for(let stair=0;stair<6;stair++)part(base,'box','paint',3,stair*.3,7+stair*.35,3,.18,.38);
    }else{
      // Open tea stalls or conservatory pergolas, with counters and roof slats.
      for(const z of[-5,5]){
        for(const x of[-5.8,-2.2])for(const dz of[-2,2])part(base,'post','structure',x,2.4,z+dz,.17,4.8,.17);
        part(base,'box','paint',-4,1,z,3.8,2,3.8);
        part(base,'box','white',-4,2.1,z,4.2,.2,4.2);
        for(let slat=0;slat<8;slat++)part(base,'box',garden?'structure':'paint',-4,4.8+Math.sin(slat/7*Math.PI)*.5,z-2.5+slat*.7,5.2,.18,.48);
        for(let shelf=0;shelf<3;shelf++)part(base,'box','people',-4.8+shelf*.8,2.4,z,.35,.5,.35,0,garden?0x6c9461:0xb37559);
        part(base,'box','structure',4,.5,z,4,1,3);
        // Layered shrubs in raised planters; vertex silhouette remains 3D.
        for(let leaf=0;leaf<7;leaf++)part(base,'head','people',4+Math.sin(leaf*2.4)*1.3,1.4+(leaf%3)*.36,z+Math.cos(leaf*2.4)*.8,1.9,1.6,1.6,0,garden?[0x527f50,0x80a65e,0xacc485][leaf%3]:[0xe7a9ba,0xf2ccd4,0xba748e][leaf%3]);
      }
      for(const z of[-1.5,1.5]){part(base,'box','paint',4,.65,z,3,.18,.6);for(const x of[2.8,5.2])part(base,'box','dark',x,.3,z,.16,.6,.4);}
    }
    // Warm lantern posts and visitors keep the peripheral world inhabited.
    for(const z of[-8,8]){
      part(base,'post','dark',-6,3,z,.14,6,.14);
      part(base,'box','paint',-6,6.2,z,1,.18,1);
      part(base,'box','light',-6,5.6,z,.6,.9,.6);lamps++;
    }
    for(let visitor=0;visitor<5;visitor++){
      const z=-7+visitor*3.1,x=.8+random();
      if(typeof addAudienceSeat==='function')addAudienceSeat(base,x,.84,z,side,[0xc96a55,0x567795,0xe1ba72][visitor%3],1000+districts*5+visitor,true);
      else {part(base,'box','people',x,.95,z,.48,.9,.36,0,[0xc96a55,0x567795,0xe1ba72][visitor%3]);part(base,'head','people',x,1.6,z,.38,.44,.38,0,0xb78464);for(const leg of[-1,1])part(base,'post','dark',x+leg*.13,.32,z,.15,.65,.15);}
      spectators++;
    }
  }
  // Repeated trackside light standards stitch long empty straights together.
  for(let k=0;k<96;k++){
    const u=k/96;if(trackAG(u)>.1)continue;
    const side=k%2?1:-1,base=frame(u,side*9.1);
    if(!clearBuilding(base,.5,.5,5))continue;
    part(base,'post','dark',0,2.3,0,.12,4.6,.12);
    part(base,'box','structure',0,4.7,0,.8,.16,.8);
    part(base,'box','light',0,4.45,0,.46,.38,.46);lamps++;
  }
  for(const [key,instances] of batches){
    const [type,mat]=key.split(':'),mesh=new THREE.InstancedMesh(geos[type],materials[mat],instances.length);
    mesh.name='venue-'+key;instances.forEach((item,i)=>{mesh.setMatrixAt(i,item.matrix);if(mat==='people')mesh.setColorAt(i,new THREE.Color(item.color||0xffffff));});
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=mat!=='people'&&!MOBILEFX;mesh.receiveShadow=true;root.add(mesh);
  }
  // Empty resources must also be released on unusual/custom circuits.
  for(const [type,geo] of Object.entries(geos))if(![...batches.keys()].some(k=>k.startsWith(type+':')))geo.dispose();
  root.userData={stands,garages,spectators,markers,districts,lamps,placements,instanceBatches:batches.size};
}
