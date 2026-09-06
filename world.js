// ---------- Renderer / scene ----------
let canvas=document.getElementById('gl');
var FALLBACK_GRAPHICS=false;
const LOWFX=/lowfx/.test(location.search);
const MOBILEFX=matchMedia('(pointer: coarse)').matches||((navigator.deviceMemory||8)<4);
function graphicsNotice(message,retry){
  let panel=document.getElementById('graphics-notice');
  if(!panel){panel=document.createElement('div');panel.id='graphics-notice';panel.setAttribute('role','alert');panel.style.cssText='position:fixed;inset:0;z-index:10000;background:#050a18;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:32px;text-align:center;color:#f5f5f5;font:18px/1.6 system-ui';document.body.append(panel);}
  panel.replaceChildren();const copy=document.createElement('p');copy.textContent=message;panel.append(copy);
  if(retry){const button=document.createElement('button');button.textContent='Reload circuit';button.style.cssText='padding:14px 24px;background:#d4a843;border:0;border-radius:8px;color:#050a18;font:700 16px system-ui;cursor:pointer';button.onclick=()=>location.reload();panel.append(button);}
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
canvas.addEventListener('webglcontextrestored',()=>{document.getElementById('graphics-notice')?.remove();});
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
const rim=new THREE.DirectionalLight(0x00d9b5,0.35);rim.position.set(160,80,200);scene.add(rim);

// Soft atmosphere is real scene lighting; every island remains dimensional geometry.
const zenWorldTime={value:0};
let refreshMapEnvironment=null;
function buildSky(){
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{time:zenWorldTime,skyTop:{value:new THREE.Color(activeMap.skyTop)},skyHorizon:{value:new THREE.Color(activeMap.skyHorizon)}},vertexShader:`varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 direction;uniform float time;uniform vec3 skyTop;uniform vec3 skyHorizon;void main(){vec3 d=normalize(direction);vec3 sky=mix(skyHorizon,skyTop,smoothstep(-.05,.75,d.y));sky=mix(vec3(.63,.78,.94),sky,smoothstep(-.7,-.03,d.y));float cloud=sin(d.x*15.+d.z*8.)*.5+sin(d.x*33.-d.z*19.)*.2;sky+=vec3(.09,.075,.085)*smoothstep(.33,.68,cloud)*exp(-pow((d.y-.14)*5.,2.));gl_FragColor=vec4(sky,1.);}`});
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1100,36,18),mat));
  // Small cubemap supplies pastel specular reflections on the road and vehicles.
  if(!FALLBACK_GRAPHICS){const envScene=new THREE.Scene();envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10,24,12),mat));const target=new THREE.WebGLCubeRenderTarget(64,{generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});target.texture.encoding=THREE.sRGBEncoding;const envCamera=new THREE.CubeCamera(.1,30,target);refreshMapEnvironment=()=>envCamera.update(renderer,envScene);refreshMapEnvironment();scene.environment=target.texture;}
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
  const road=new THREE.MeshPhysicalMaterial({color:activeMap.road,roughness:.34,metalness:.1,clearcoat:.5,clearcoatRoughness:.22,envMapIntensity:.4,side:THREE.DoubleSide});
  world.add(buildRibbon([[-W,0],[-W*.5,.015],[0,.025],[W*.5,.015],[W,0]],road));
  const under=new THREE.MeshStandardMaterial({color:activeMap.id==='canopy'?0xd3dfd9:0x697087,roughness:.34,metalness:.5,side:THREE.DoubleSide});
  world.add(buildRibbon([[-W-.5,-.12],[-W-.3,-.85],[W+.3,-.85],[W+.5,-.12]],under));
  const cyan=new THREE.MeshBasicMaterial({color:activeMap.edge}),pink=new THREE.MeshBasicMaterial({color:activeMap.trim});
  for(const side of[-1,1]){
    world.add(buildRibbon([[side*(W-.25),.035],[side*(W-.05),.035]].sort((a,b)=>a[0]-b[0]),cyan));
    world.add(buildRibbon([[side*(W+.02),-.08],[side*(W+.48),-.08]].sort((a,b)=>a[0]-b[0]),pink));
    world.add(buildRibbon([[side*2.1,.042],[side*2.27,.042]].sort((a,b)=>a[0]-b[0]),cyan));
    const glow=new THREE.MeshBasicMaterial({color:0x26e9ff,transparent:true,opacity:.1,depthWrite:false});
    world.add(buildRibbon([[side*1.8,.047],[side*2.6,.047]].sort((a,b)=>a[0]-b[0]),glow));
    world.add(buildWall(side*(W+.32),.1,1.05,new THREE.MeshPhysicalMaterial({color:0x5fffea,transparent:true,opacity:.2,roughness:.08,metalness:.2,side:THREE.DoubleSide,depthWrite:false})));
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

function treeCanopyGeo(seed,tint){ // organic lobed canopy: 8 merged lobes, noise-displaced, vertex-colour gradient (shade at the base, sunlit crown)
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
function cypressGeo(seed){const prof=[];const r=mulberry(seed);for(let i=0;i<=22;i++){const t=i/22;const w=Math.sin(t*Math.PI)*1.6*(1-t*.35)+Math.sin(t*19)*.18+.05;prof.push(new THREE.Vector2(w,t*9.5+.3));}prof.push(new THREE.Vector2(0,10));
  const g=new THREE.LatheGeometry(prof,14);displace(g,.5,1.4,seed);const p=g.attributes.position,col=new Float32Array(p.count*3);const c1=new THREE.Color(0x14301f),c2=new THREE.Color(0x3d7a3a),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const t=clamp(p.getY(i)/10,0,1);c.copy(c1).lerp(c2,t*.7+fbm(p.getX(i),p.getZ(i),2)*.4);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;}
function treeTrunkGeo(){const prof=[];for(let i=0;i<=10;i++){const t=i/10;prof.push(new THREE.Vector2(0.55*(1-t*.55)+Math.sin(t*9)*.04,t*3.4-.4));}return new THREE.LatheGeometry(prof,9);}
function rockGeo(seed){const g=new THREE.IcosahedronGeometry(1.6,1);return displace(g,.7,.9,seed);}
function lampGeo(){const prof=[new THREE.Vector2(.5,0),new THREE.Vector2(.42,.4),new THREE.Vector2(.16,.6),new THREE.Vector2(.14,6.6),new THREE.Vector2(.3,6.9),new THREE.Vector2(.3,7.2),new THREE.Vector2(.1,7.3),new THREE.Vector2(0,7.35)];return new THREE.LatheGeometry(prof,10);}
function pillarGeo(){const prof=[new THREE.Vector2(2.4,0),new THREE.Vector2(2.0,.6),new THREE.Vector2(1.3,1.2),new THREE.Vector2(1.15,8),new THREE.Vector2(1.6,9.2),new THREE.Vector2(1.6,10)];return new THREE.LatheGeometry(prof,12);}
function starGeo(size=1,depth=.25){ // Collective 4-point diamond star
  const s=new THREE.Shape();s.moveTo(0,size);s.lineTo(size*.28,size*.28);s.lineTo(size,0);s.lineTo(size*.28,-size*.28);s.lineTo(0,-size);s.lineTo(-size*.28,-size*.28);s.lineTo(-size,0);s.lineTo(-size*.28,size*.28);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.05,bevelSize:.04,bevelSegments:2});g.center();return g;}

function buildEnvironment(){
  const random=mulberry(7943),cliffMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.03,flatShading:true});
  const grassMat=new THREE.MeshStandardMaterial({color:activeMap.id==='canopy'?0x4b8841:0x4f9a5e,roughness:.88});
  const barkMat=new THREE.MeshStandardMaterial({color:0x4a354f,roughness:.86});
  const pinkMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});
  const stoneMat=new THREE.MeshStandardMaterial({color:0xbfc0d6,roughness:.78});
  const islands=[];
  function clearance(x,z){let d=Infinity;for(let i=0;i<N_SAMP;i+=3)d=Math.min(d,Math.hypot(x-track.pos[i].x,z-track.pos[i].z));return d;}
  islands.push({x:-102,y:-5,z:-126,r:36,depth:58,temple:true});
  for(let k=0;k<26;k++){const u=k/26+.008,i=sampleIdx(u);if(track.ag[i]>.3)continue;for(const side of[-1,1]){const r=18+random()*9,p=new THREE.Vector3();trackPoint(u,side*(r+19),-4,p);if(clearance(p.x,p.z)<r+11||islands.some(a=>Math.hypot(a.x-p.x,a.z-p.z)<a.r+r+6))continue;islands.push({x:p.x,y:p.y,z:p.z,r,depth:30+random()*35,temple:islands.length%3===0});}}
  // Outer sanctuary islands make the floating world visible from every racing sector.
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2,r=22+random()*18,x=-20+Math.cos(a)*290,z=-120+Math.sin(a)*290;islands.push({x,y:20+random()*60,z,r,depth:40+random()*70,temple:k%3===0});}
  world.userData.islands=islands;
  function islandGeometry(r,depth,seed){
    const rnd=mulberry(seed),segments=32,rings=[{y:0,s:1},{y:-depth*.035,s:.99},{y:-depth*.12,s:.84},{y:-depth*.15,s:.96},{y:-depth*.29,s:.7},{y:-depth*.33,s:.84},{y:-depth*.49,s:.53},{y:-depth*.54,s:.66},{y:-depth*.73,s:.31},{y:-depth*.78,s:.37},{y:-depth,s:.035}],p=[],colors=[],idx=[],angles=[];
    for(let k=0;k<segments;k++)angles.push(.89+rnd()*.16);
    rings.forEach((ring,j)=>{for(let k=0;k<segments;k++){const a=k/segments*Math.PI*2,rr=r*ring.s*angles[k]*(j>1?.92+rnd()*.17:1),shade=.72+rnd()*.35; p.push(Math.cos(a)*rr+(j>1?Math.sin(j*1.5)*r*.12:0),ring.y+(j>0?(rnd()-.5)*2:0),Math.sin(a)*rr*.83);const c=new THREE.Color(j===0?0x637c73:j===1?0x5b6470:j%2?0x66687e:0x3e425c).multiplyScalar(shade);colors.push(c.r,c.g,c.b);if(j<rings.length-1){const n=(k+1)%segments,a0=j*segments+k,b0=j*segments+n,c0=(j+1)*segments+k,d0=(j+1)*segments+n;idx.push(a0,b0,c0,b0,d0,c0);}}});
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();return g;
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
      const radius=.095+rnd()*.085;color.setHex(palette[Math.floor(rnd()*palette.length)]);
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
  const pondMat=new THREE.MeshPhysicalMaterial({color:0x83d6e5,roughness:.09,metalness:.5,clearcoat:1,transparent:true,opacity:.85,side:THREE.DoubleSide});
  const waterfallMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{time:zenWorldTime},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time;void main(){float strand=pow(.5+.5*sin(vUv.x*79.+sin(vUv.y*14.+time*2.)*.3),7.);float rush=.5+.5*sin(vUv.y*100.+time*7.+vUv.x*13.);vec3 c=mix(vec3(.26,.61,.89),vec3(.84,.96,1.),strand*.8+rush*.16);float edge=smoothstep(0.,.08,vUv.x)*smoothstep(0.,.08,1.-vUv.x);float fade=smoothstep(0.,.15,vUv.y);gl_FragColor=vec4(c,edge*fade*.82);}`});
  function waterfall(island,width,angle){
    const length=island.depth+40,seg=20,p=[],uv=[],idx=[];for(let j=0;j<=seg;j++){const t=j/seg;for(let k=0;k<=8;k++){const q=k/8,x=(q-.5)*width,z=island.r*.8+Math.sin(Math.min(t*5,Math.PI/2))*2.5;const ca=Math.cos(angle),sa=Math.sin(angle);p.push(island.x+x*ca-z*sa,island.y+.08-t*length,island.z+x*sa+z*ca);uv.push(q,1-t);if(j<seg&&k<8){const a=j*9+k;idx.push(a,a+9,a+1,a+1,a+9,a+10);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();world.add(new THREE.Mesh(g,waterfallMat));
  }
  const roofMat=new THREE.MeshStandardMaterial({color:0x38354e,roughness:.58,metalness:.15,side:THREE.DoubleSide});
  const woodMat=new THREE.MeshStandardMaterial({color:0x725062,roughness:.8});
  const plasterMat=new THREE.MeshStandardMaterial({color:0xe7d6df,roughness:.8});
  function roofGeometry(width,depth){const p=[],idx=[];for(let z=0;z<=16;z++){const zz=(z/16-.5)*2;for(let x=0;x<=16;x++){const xx=(x/16-.5)*2;const y=(1-Math.abs(zz))*2.5+Math.pow(Math.abs(xx),6)*1.5+Math.pow(Math.abs(zz),8)*.6;p.push(xx*width/2,y,zz*depth/2);if(x<16&&z<16){const a=z*17+x;idx.push(a,a+17,a+1,a+1,a+17,a+18);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;}
  function temple(island){const group=new THREE.Group();group.position.set(island.x-island.r*.12,island.y+.35,island.z-island.r*.16);const levels=3;for(let j=0;j<levels;j++){const scale=1-j*.2,y=j*5;const floor=new THREE.Mesh(new THREE.BoxGeometry(12*scale,3.7,8*scale),plasterMat);floor.position.y=y+2;group.add(floor);for(const x of[-1,1])for(const z of[-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.22,.27,4.6,8),woodMat);post.position.set(x*6.2*scale,y+2,z*4.2*scale);group.add(post);}const roof=new THREE.Mesh(roofGeometry(18*scale,13*scale),roofMat);roof.position.y=y+3.7;roof.castShadow=true;group.add(roof);for(let k=-2;k<=2;k++){const window=new THREE.Mesh(new THREE.PlaneGeometry(.6,2),woodMat);window.position.set(k*1.5*scale,y+2,4*scale+.02);group.add(window);}const deck=new THREE.Mesh(new THREE.BoxGeometry(15*scale,.35,10.5*scale),stoneMat);deck.position.y=y+.2;group.add(deck);}world.add(group);}
  islands.forEach((island,n)=>{
    const cliff=new THREE.Mesh(islandGeometry(island.r,island.depth,n+80),cliffMat);cliff.position.set(island.x,island.y,island.z);cliff.castShadow=true;cliff.receiveShadow=true;world.add(cliff);
    const shape=new THREE.Shape(),rimRandom=mulberry(n+80);for(let k=0;k<32;k++){const a=k/32*Math.PI*2,r=island.r*(.89+rimRandom()*.16)+.08;if(k===0)shape.moveTo(Math.cos(a)*r,-Math.sin(a)*r*.83);else shape.lineTo(Math.cos(a)*r,-Math.sin(a)*r*.83);}shape.closePath();const cap=new THREE.Mesh(new THREE.ShapeGeometry(shape),grassMat);cap.rotation.x=-Math.PI/2;cap.position.set(island.x,island.y+.02,island.z);cap.receiveShadow=true;world.add(cap);
    const pond=new THREE.Mesh(new THREE.CircleGeometry(island.r*.36,40),pondMat);pond.rotation.x=-Math.PI/2;pond.scale.y=.68;pond.position.set(island.x+island.r*.12,island.y+.09,island.z+island.r*.23);world.add(pond);
    // A continuous stream bridges the pond to the visible waterfall lip.
    const stream=new THREE.Mesh(new THREE.PlaneGeometry(island.r*.29,island.r*.53),pondMat);stream.rotation.x=-Math.PI/2;stream.position.set(island.x,island.y+.1,island.z+island.r*.55);world.add(stream);
    waterfall(island,island.r*.29,0);if(n%3===0)waterfall(island,island.r*.18,-.9);
    if(island.temple){if(activeMap.id==='cherry')temple(island);else if(!(activeMap.id==='canopy'&&n===0))buildMapLandmark(island,n);}
    const count=Math.floor(island.r/4);for(let j=0;j<count;j++){const a=j/count*Math.PI*2+random()*.2,d=island.r*(.56+random()*.2),spot={x:island.x+Math.cos(a)*d,y:island.y+.06,z:island.z+Math.sin(a)*d*.78,s:1+random()*.6,rot:random()*6.3};(activeMap.id!=='cherry'||j%3===0?bonsaiSpots:cherrySpots).push(spot);}
    // Irregular pale stepping stones on the moss, grouped around the pond.
    const stones=[];for(let k=0;k<8;k++){const g=rockGeo(n*19+k);g.scale(.8,.18,.65);g.translate(island.x+Math.cos(k*.4)*island.r*.5,island.y+.15,island.z+Math.sin(k*.4)*island.r*.38);stones.push(g);}const stoneGeo=mergeGeos(stones);stones.forEach(g=>g.dispose());world.add(new THREE.Mesh(stoneGeo,stoneMat));
  });
  function instanceTrees(spots,isBonsai){if(!spots.length)return;const can=new THREE.InstancedMesh(isBonsai?greenGeo:pinkGeo,isBonsai?pinkMat:blossomMat,spots.length),tr=new THREE.InstancedMesh(trunk,barkMat,spots.length),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);spots.forEach((s,i)=>{q.setFromAxisAngle(axis,s.rot);matrix.compose(new THREE.Vector3(s.x,s.y,s.z),q,new THREE.Vector3(s.s,s.s*(isBonsai?.72:1),s.s));tr.setMatrixAt(i,matrix);matrix.compose(new THREE.Vector3(s.x,s.y+s.s*(isBonsai?2.6:3.6),s.z),q,new THREE.Vector3(s.s*(isBonsai?1.25:1),s.s*(isBonsai?.38:1),s.s));can.setMatrixAt(i,matrix);});can.castShadow=true;tr.castShadow=true;world.add(can,tr);}
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
    const leaf=new THREE.MeshStandardMaterial({color:0x519248,roughness:.85});
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
    // Track passes through the illuminated ribbed hangar; all ribs clear its width.
    for(let k=0;k<9;k++){
      const g=putAt(.325+k*.008);const pts=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI;pts.push([Math.cos(a)*10,Math.sin(a)*12,0]);}mapTube(pts,.65,metal,g,24);mapTube(pts,.13,glow,g,24).position.z=.7;
      if(k%2===0)for(const x of[-10.5,10.5])mapMesh(new THREE.BoxGeometry(2.2,5,1.4),dark,g,x,2.5,0);
    }
    for(const u of[.13,.57,.78]){const g=putAt(u),housing=new THREE.Group();housing.position.set(26,10,-6);g.add(housing);buildTurbine(housing,16,dark,metal,glow);mapMesh(new THREE.BoxGeometry(12,3,12),metal,g,26,-5,-6);}
  }
  if(activeMap.id==='canopy'){
    // Glass garden tunnel with curved ribs, trailing vines and luminous blossoms.
    const bark=new THREE.MeshStandardMaterial({color:0x685e3b,roughness:.96});
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
      const crown=mapMesh(treeCanopyGeo(800+j,[0x25482b,0x82a84b]),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}),tree,Math.cos(a)*23,y+7,Math.sin(a)*23);crown.scale.set(3.5,1.6,3.5);
    }
    for(const y of[26,39,52]){mapMesh(new THREE.CylinderGeometry(11.5,7.5,2.2,40),metal,tree,0,y,0);const rail=mapMesh(new THREE.TorusGeometry(11.4,.15,6,48),cyan,tree,0,y+1.8,0);rail.rotation.x=Math.PI/2;}
    // Far below the circuit: a rippled turquoise sea instead of an empty void.
    const sea=new THREE.MeshPhysicalMaterial({color:0x26b7c2,roughness:.2,metalness:.38,transparent:true,opacity:.9});
    const ocean=mapMesh(new THREE.CircleGeometry(850,64),sea,world,-20,-100,-120);ocean.rotation.x=-Math.PI/2;ocean.receiveShadow=false;
  }
  buildMapClouds();
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
