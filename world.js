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
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=!LOWFX&&!MOBILEFX;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x0b1224,160,700);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.3,1400);
const hemi=new THREE.HemisphereLight(0x3a4a7a,0x1a1408,0.55);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffd9a0,1.55);sun.position.set(-180,220,-120);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.near=20;sun.shadow.camera.far=700;
sun.shadow.camera.left=-120;sun.shadow.camera.right=120;sun.shadow.camera.top=120;sun.shadow.camera.bottom=-120;sun.shadow.bias=-0.0008;sun.shadow.normalBias=0.03;
scene.add(sun);scene.add(sun.target);
const rim=new THREE.DirectionalLight(0x00d9b5,0.35);rim.position.set(160,80,200);scene.add(rim);

// Sky dome: dusk gradient (deep navy -> amber horizon) + star field + sun disc
function buildSky(){
  const geo=new THREE.SphereGeometry(1000,48,24);
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{stars:{value:TEX.stars},sunDir:{value:new THREE.Vector3(-180,120,-120).normalize()},time:{value:0}},
    vertexShader:`varying vec3 vP;varying vec2 vUv;void main(){vP=normalize(position);vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D stars;uniform vec3 sunDir;uniform float time;varying vec3 vP;varying vec2 vUv;
      void main(){float h=vP.y;vec3 zen=vec3(.02,.04,.10);vec3 mid=vec3(.09,.13,.27);vec3 hor=vec3(.72,.42,.16);vec3 hor2=vec3(.95,.72,.36);
      float sd=max(dot(vP,sunDir),0.);
      vec3 c=mix(mid,zen,smoothstep(.08,.7,h));c=mix(hor,c,smoothstep(-.02,.22,h));
      c+=hor2*pow(sd,6.)*.55*smoothstep(-.05,.25,h);c+=vec3(1.,.9,.7)*pow(sd,420.)*1.2;
      vec3 st=texture2D(stars,vUv*vec2(2.,1.)).rgb*smoothstep(.12,.5,h)*(.8+.2*sin(time*.7+vUv.x*40.));
      c+=st*.9;c=mix(c,vec3(.03,.05,.09),1.-smoothstep(-.4,-.02,h));
      gl_FragColor=vec4(c,1.);}`});
  const m=new THREE.Mesh(geo,mat);scene.add(m);return mat;
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
const TRACK_W=14, N_SAMP=1800;
const track={pos:[],tan:[],up:[],right:[],curv:[],ag:[],roll:[],len:0,u:[]};

function buildTrackFrames(){
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
  TEX.asphalt.repeat.set(1,1);
  const road=new THREE.MeshStandardMaterial({map:TEX.asphalt,roughnessMap:TEX.asphaltR,roughness:.92,metalness:.05,color:0xc9ccd4});
  const roadM=buildRibbon([[-W,0],[-W*.5,0],[0,0],[W*.5,0],[W,0]],road,null,14,1);roadM.receiveShadow=true;world.add(roadM);
  const lineM=new THREE.MeshStandardMaterial({color:0xf5f5f5,roughness:.8,polygonOffset:true,polygonOffsetFactor:-1});
  world.add(buildRibbon([[-W+.25,0.012],[-W+.5,0.012]],lineM));world.add(buildRibbon([[W-.5,0.012],[W-.25,0.012]],lineM));
  // curbs (raised, red/white)
  const curb=new THREE.MeshStandardMaterial({map:TEX.curb,roughness:.7,metalness:.1});
  world.add(buildRibbon([[-W-1.2,-0.05],[-W-1.0,0.16],[-W,0.16],[-W,0.02]],curb,null,3,1));
  world.add(buildRibbon([[W,0.02],[W,0.16],[W+1.0,0.16],[W+1.2,-0.05]],curb,null,3,1));
  // grass verges + dirt shoulders (non-antigrav)
  const notAG=i=>track.ag[i]<0.5, isAG=i=>track.ag[i]>=0.5;
  const dirt=new THREE.MeshStandardMaterial({map:TEX.dirt,roughness:1});
  world.add(buildRibbon([[-W-3.2,-0.4],[-W-1.2,-0.05]],dirt,notAG,6,1));
  world.add(buildRibbon([[W+1.2,-0.05],[W+3.2,-0.4]],dirt,notAG,6,1));
  const grassV=new THREE.MeshStandardMaterial({map:TEX.grass,roughness:1});
  const gv=[[-W-18,-2.6],[-W-9,-1.2],[-W-3.2,-0.4]];world.add(buildRibbon(gv,grassV,notAG,20,3));
  world.add(buildRibbon(gv.map(p=>[-p[0],p[1]]).reverse(),grassV,notAG,20,3));
  // Low guardrail on normal sections (dark steel, teal light strip on top)
  const rail=new THREE.MeshStandardMaterial({color:0x2a3142,roughness:.55,metalness:.7,side:THREE.DoubleSide});
  const railLight=new THREE.MeshStandardMaterial({color:0x0a1a1a,emissive:0x00d9b5,emissiveIntensity:1.4,roughness:.4});
  world.add(buildWall(-W-1.4,0,0.9,rail,notAG));world.add(buildWall(W+1.4,0,0.9,rail,notAG));
  world.add(buildRibbon([[-W-1.5,0.9],[-W-1.3,0.9]],railLight,notAG));world.add(buildRibbon([[W+1.3,0.9],[W+1.5,0.9]],railLight,notAG));
  // Anti-gravity glowing checker rails (tall, emissive) + deck underside
  TEX.rail.repeat.set(1,1);
  const agRail=new THREE.MeshStandardMaterial({map:TEX.rail,emissiveMap:TEX.rail,emissive:0xffffff,emissiveIntensity:1.1,roughness:.35,metalness:.2,side:THREE.DoubleSide});
  world.add(buildWall(-W-1.3,0,2.4,agRail,isAG,10));world.add(buildWall(W+1.3,0,2.4,agRail,isAG,10));
  const agDeck=new THREE.MeshStandardMaterial({map:TEX.hex,emissiveMap:TEX.hex,emissive:0x00d9b5,emissiveIntensity:.35,roughness:.6,metalness:.5,color:0x9aa3b8,side:THREE.DoubleSide});
  world.add(buildRibbon([[-W-1.4,-0.05],[-W-1.4,-1.6],[W+1.4,-1.6],[W+1.4,-0.05]],agDeck,isAG,12,4));
  const agTrim=new THREE.MeshStandardMaterial({color:0x101418,emissive:0x00d9b5,emissiveIntensity:2,roughness:.3});
  world.add(buildRibbon([[-W-1.6,-1.6],[-W-1.2,-1.6]],agTrim,isAG));world.add(buildRibbon([[W+1.2,-1.6],[W+1.6,-1.6]],agTrim,isAG));
  // Normal-section deck underside so elevated bridge segments read as structure
  const bridgeDeck=new THREE.MeshStandardMaterial({color:0x2a3040,roughness:.8,metalness:.4,side:THREE.DoubleSide});
  world.add(buildRibbon([[-W-3.3,-0.42],[-W-3.3,-1.4],[W+3.3,-1.4],[W+3.3,-0.42]],bridgeDeck,i=>notAG(i)&&track.pos[i%N_SAMP].y>2.2,12,4));
  // Finish line decal + centre lane dash
  const fin=new THREE.MeshStandardMaterial({map:TEX.finish,roughness:.8,polygonOffset:true,polygonOffsetFactor:-2});
  TEX.finish.repeat.set(1,1);
  world.add(buildRibbon([[-W,0.02],[W,0.02]],fin,i=>i<9,2,1));
  // Start grid slots
  const gridM=new THREE.MeshStandardMaterial({color:0xf5f5f5,roughness:.9,polygonOffset:true,polygonOffsetFactor:-1,transparent:true,opacity:.75});
  for(let k=0;k<12;k++){const u=-(0.006+Math.floor(k/2)*0.0065),lat=(k%2?2.2:-2.2)+(Math.floor(k/2)%2?1.4:-1.4)*0;const m=buildRibbon([[lat-1.4,0.015],[lat-1.25,0.015]],gridM,i=>Math.abs(((i/N_SAMP)-wrap01(u)+0.5)%1-0.5)<0.0025);world.add(m);
    const m2=buildRibbon([[lat+1.25,0.015],[lat+1.4,0.015]],gridM,i=>Math.abs(((i/N_SAMP)-wrap01(u)+0.5)%1-0.5)<0.0025);world.add(m2);}
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
  m.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return m;
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
  // Terrain height is shared by hills and distant foliage so trees never sink into hills.
  const terrainHeight=(x,z)=>{const d=Math.hypot(x+10,z+110),ring=smooth(clamp((d-250)/220,0,1));return ring*(fbm(x/90,z/90,4)*60+10)+fbm(x/30,z/30,2)*ring*8;};
  const groundTexture=TEX.grass.clone();groundTexture.needsUpdate=true;groundTexture.repeat.set(70,70);
  const grassMat=new THREE.MeshStandardMaterial({map:groundTexture,roughness:1});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400,1,1),grassMat);ground.rotation.x=-Math.PI/2;ground.position.y=-0.6;ground.receiveShadow=true;world.add(ground);
  const hillG=new THREE.PlaneGeometry(1400,1400,MOBILEFX?72:110,MOBILEFX?72:110);const hp=hillG.attributes.position;
  for(let i=0;i<hp.count;i++){const x=hp.getX(i),z=-hp.getY(i);hp.setZ(i,terrainHeight(x,z));}
  hillG.computeVertexNormals();const hillMat=new THREE.MeshStandardMaterial({color:0x2a3f2e,roughness:1,map:groundTexture});
  const hills=new THREE.Mesh(hillG,hillMat);hills.rotation.x=-Math.PI/2;hills.position.y=-0.7;world.add(hills);

  // Trees (two canopy palettes), instanced
  const canopyA=treeCanopyGeo(11,[0x1a3a22,0x5a9a48]),canopyB=treeCanopyGeo(37,[0x142e2c,0x3f8a6a]),cypG=cypressGeo(5),trunkG=treeTrunkGeo();
  const canMatA=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92});
  const canMatB=canMatA;
  const trunkMat=new THREE.MeshStandardMaterial({color:0x4a3222,roughness:.9});
  const spots=[];const tmp=new THREE.Vector3(),tr=new THREE.Vector3();
  for(let i=0;i<N_SAMP;i+=7){ if(track.ag[i]>0.2||track.pos[i].y>4)continue;
    for(const side of [-1,1]){ if(rng()<.45)continue;const lat=side*(TRACK_W/2+8+rng()*22);trackPoint(i/N_SAMP,lat,0,tmp);
      // keep clear of other track passes
      let ok=true;for(let j=0;j<N_SAMP;j+=12){if(tmp.distanceTo(track.pos[j])<12){ok=false;break;}} if(!ok)continue;
      spots.push({x:tmp.x,z:tmp.z,s:.8+rng()*.7,r:rng()*6.3,k:rng()<.25?2:rng()<.5?0:1});}
  }
  for(let i=0;i<(MOBILEFX?95:160);i++){const a=rng()*6.3,d=260+rng()*160;spots.push({x:-10+Math.cos(a)*d,z:-110+Math.sin(a)*d,s:1.4+rng()*1.2,r:rng()*6.3,k:rng()<.3?2:rng()<.5?0:1});}
  const mk=(geo,mat,list,yoff)=>{const im=new THREE.InstancedMesh(geo,mat,list.length);const M=new THREE.Matrix4(),q=new THREE.Quaternion(),sv=new THREE.Vector3();list.forEach((sp,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),sp.r);sv.set(sp.s,sp.s,sp.s);M.compose(new THREE.Vector3(sp.x,yoff-0.5+terrainHeight(sp.x,sp.z),sp.z),q,sv);im.setMatrixAt(i,M);});im.castShadow=true;im.receiveShadow=true;world.add(im);return im;};
  mk(canopyA,canMatA,spots.filter(s=>s.k===0),0);mk(canopyB,canMatB,spots.filter(s=>s.k===1),0);mk(cypG,canMatA,spots.filter(s=>s.k===2),0);mk(trunkG,trunkMat,spots.filter(s=>s.k!==2),0);
  // Rocks
  const rocks=[];for(let c=0;c<9;c++){const a=rng()*6.3,d=230+rng()*90;for(let i=0;i<5;i++){rocks.push({x:-10+Math.cos(a)*d+(rng()-.5)*14,z:-110+Math.sin(a)*d+(rng()-.5)*14,s:.8+rng()*2.4,r:rng()*6.3});}}
  mk(rockGeo(5),new THREE.MeshStandardMaterial({color:0x4a4550,roughness:.95}),rocks,0.2);

  // Lamp posts (gold sodium glow) along non-AG track
  const lampG=lampGeo();const lamps=[];const lampHeads=[];
  for(let i=40;i<N_SAMP;i+=95){ if(track.ag[i]>0.2)continue; const side=Math.floor(i/95)%2?1:-1;trackPoint(i/N_SAMP,side*(TRACK_W/2+4.2),0,tmp);lamps.push({x:tmp.x,z:tmp.z,y:tmp.y,s:1,r:0});lampHeads.push(tmp.clone().add(new THREE.Vector3(0,7.1,0)));}
  const lampMat=new THREE.MeshStandardMaterial({color:0x1b2130,metalness:.8,roughness:.4});
  const li=new THREE.InstancedMesh(lampG,lampMat,lamps.length);{const M=new THREE.Matrix4();lamps.forEach((l,i)=>{M.makeTranslation(l.x,l.y,l.z);li.setMatrixAt(i,M);});li.castShadow=true;world.add(li);}
  const headG=new THREE.SphereGeometry(.42,10,8);const headMat=new THREE.MeshStandardMaterial({color:0xfff2c8,emissive:0xd4a843,emissiveIntensity:3});
  const hi=new THREE.InstancedMesh(headG,headMat,lampHeads.length);{const M=new THREE.Matrix4();lampHeads.forEach((p,i)=>{M.makeTranslation(p.x,p.y,p.z);hi.setMatrixAt(i,M);});world.add(hi);}

  // Pennant strings between consecutive lamp heads
  {const tri=[];const pal=[0xd4a843,0xf5f5f5,0x00d9b5,0xdc2626];const cols=[];
    for(let i=0;i<lampHeads.length-1;i++){const a=lampHeads[i],b=lampHeads[i+1];if(a.distanceTo(b)>70)continue;const n=Math.floor(a.distanceTo(b)/2.2);
      for(let k=0;k<n;k++){const t=(k+.5)/n;const p=a.clone().lerp(b,t);p.y-=Math.sin(t*Math.PI)*2.6;const d=b.clone().sub(a).normalize().multiplyScalar(.45);
        tri.push(p.x-d.x,p.y,p.z-d.z, p.x+d.x,p.y,p.z+d.z, p.x,p.y-1.1,p.z);const c=new THREE.Color(pal[k%4]);for(let q=0;q<3;q++)cols.push(c.r,c.g,c.b);}}
    const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(tri,3));pg.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));pg.computeVertexNormals();
    world.add(new THREE.Mesh(pg,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.9})));}
  // Structural pillars under elevated track
  const pilG=pillarGeo();const pils=[];
  for(let i=0;i<N_SAMP;i+=22){const p=track.pos[i];if(p.y<3)continue;const up=track.up[i];if(up.y<0.2)continue;pils.push({x:p.x,z:p.z,h:p.y-1.4});}
  const pilMat=new THREE.MeshStandardMaterial({color:0x3b4356,roughness:.7,metalness:.5});
  const pi=new THREE.InstancedMesh(pilG,pilMat,pils.length);{const M=new THREE.Matrix4();pils.forEach((p,i)=>{M.makeScale(1,p.h/10,1);M.setPosition(p.x,-0.5,p.z);pi.setMatrixAt(i,M);});pi.castShadow=true;pi.receiveShadow=true;world.add(pi);}

  // Anti-gravity gantry arches spanning the track
  const archMat=new THREE.MeshStandardMaterial({color:0xb9c2d3,metalness:.85,roughness:.35});
  const archLight=new THREE.MeshStandardMaterial({color:0x061a1a,emissive:0x00d9b5,emissiveIntensity:2.2});
  const arcCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-TRACK_W/2-2.2,0,0),new THREE.Vector3(-TRACK_W/2-1,6,0),new THREE.Vector3(0,8.5,0),new THREE.Vector3(TRACK_W/2+1,6,0),new THREE.Vector3(TRACK_W/2+2.2,0,0)]);
  const archG=new THREE.TubeGeometry(arcCurve,24,.55,8,false);const archLG=new THREE.TubeGeometry(arcCurve,24,.62,6,false);archLG.scale(1,.985,1);
  for(let i=0;i<N_SAMP;i+=70){ if(track.ag[i]<0.5)continue;const g=new THREE.Group();g.position.copy(track.pos[i]);
    const m=new THREE.Matrix4().makeBasis(track.right[i],track.up[i],track.tan[i].clone().negate());g.quaternion.setFromRotationMatrix(m);
    const a=new THREE.Mesh(archG,archMat);a.castShadow=true;g.add(a);const l=new THREE.Mesh(archLG,archLight);l.scale.set(.92,.92,.6);l.position.y=.3;g.add(l);world.add(g);}

  // Banner gantries over normal sections
  const gantry=(i,tex)=>{const g=new THREE.Group();g.position.copy(track.pos[i]);const m=new THREE.Matrix4().makeBasis(track.right[i],track.up[i],track.tan[i].clone().negate());g.quaternion.setFromRotationMatrix(m);
    const postG=new THREE.LatheGeometry([new THREE.Vector2(.9,0),new THREE.Vector2(.7,.5),new THREE.Vector2(.35,.8),new THREE.Vector2(.35,9),new THREE.Vector2(.7,9.4),new THREE.Vector2(.7,10)],10);
    const pm=new THREE.MeshStandardMaterial({color:0x2a3142,metalness:.8,roughness:.4});
    [-1,1].forEach(s=>{const p=new THREE.Mesh(postG,pm);p.position.set(s*(TRACK_W/2+2.6),-0.2,0);p.castShadow=true;g.add(p);});
    const beam=new THREE.Mesh(new THREE.BoxGeometry(TRACK_W+7,1.1,1.1),pm);beam.position.y=9.8;g.add(beam);
    const ban=new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W+4,4.4),new THREE.MeshStandardMaterial({map:tex,roughness:.6,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:.35,side:THREE.DoubleSide}));ban.position.y=7;g.add(ban);
    const trim=new THREE.Mesh(new THREE.BoxGeometry(TRACK_W+7,.18,1.3),new THREE.MeshStandardMaterial({color:0x111,emissive:0xd4a843,emissiveIntensity:2}));trim.position.y=9.2;g.add(trim);
    world.add(g);};
  gantry(4,TEX.bannerMain);gantry(430,TEX.bannerZF);gantry(1240,TEX.bannerNL);gantry(1560,TEX.bannerAG);

  // Grandstand at the start straight (right side) with crowd
  const gs=new THREE.Group();trackPoint(0.045,TRACK_W/2+10,0,tmp);gs.position.set(tmp.x,-0.5,tmp.z);gs.rotation.y=Math.PI;
  const stepMat=new THREE.MeshStandardMaterial({color:0x1c2338,roughness:.8});const crowdMat=new THREE.MeshStandardMaterial({map:TEX.crowd,roughness:1,transparent:false});
  for(let r=0;r<5;r++){const step=new THREE.Mesh(new THREE.BoxGeometry(70,1.6,3.2),stepMat);step.position.set(0,r*1.6+.8,-r*3.2);step.receiveShadow=true;step.castShadow=true;gs.add(step);
    const crowd=new THREE.Mesh(new THREE.PlaneGeometry(68,2.6),crowdMat);crowd.position.set(0,r*1.6+2.9,-r*3.2-1.0);gs.add(crowd);crowd.userData.crowd=true;}
  const roof=new THREE.Mesh(new THREE.BoxGeometry(74,.5,20),new THREE.MeshStandardMaterial({color:0x0d1326,metalness:.6,roughness:.5}));roof.position.set(0,12,-8);roof.castShadow=true;gs.add(roof);
  const roofTrim=new THREE.Mesh(new THREE.BoxGeometry(74,.3,.4),new THREE.MeshStandardMaterial({color:0x111,emissive:0xd4a843,emissiveIntensity:2.5}));roofTrim.position.set(0,11.8,2);gs.add(roofTrim);
  for(let x=-30;x<=30;x+=15){const post=new THREE.Mesh(new THREE.CylinderGeometry(.35,.45,12,8),stepMat);post.position.set(x,6,-17);gs.add(post);}
  world.add(gs);

  // The Synergy Spire — central landmark: tiered spire, orbital rings, gold windows
  const spire=new THREE.Group();spire.position.set(-102,-0.5,-126);
  const prof=[];for(let i=0;i<=24;i++){const t=i/24;const r=22*(1-t)*(1-t*.55)+2.2+Math.max(0,Math.sin(t*22))*1.2;prof.push(new THREE.Vector2(r,t*120));}prof.push(new THREE.Vector2(0,128));
  const spireMat=new THREE.MeshStandardMaterial({map:TEX.windows,emissiveMap:TEX.windows,emissive:0xffffff,emissiveIntensity:.6,color:0x9aa8c4,roughness:.4,metalness:.6});
  TEX.windows.repeat.set(4,3);
  const body=new THREE.Mesh(new THREE.LatheGeometry(prof,28),spireMat);body.castShadow=true;spire.add(body);
  const ringMat=new THREE.MeshStandardMaterial({color:0x2a2a30,emissive:0x00d9b5,emissiveIntensity:1.6,metalness:.8,roughness:.3});
  [[40,26],[78,18],[108,11]].forEach(([y,r])=>{const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.7,8,64),ringMat);ring.rotation.x=Math.PI/2;ring.position.y=y;ring.userData.spin=1/r;spire.add(ring);});
  const beacon=new THREE.Mesh(starGeo(5,1.2),new THREE.MeshStandardMaterial({color:0xfff2c8,emissive:0xd4a843,emissiveIntensity:3}));beacon.position.y=134;beacon.userData.spin=.5;spire.add(beacon);
  const beaconLight=new THREE.PointLight(0xd4a843,3,220);beaconLight.position.y=130;spire.add(beaconLight);
  world.add(spire);

  // Orbital ring in the sky (parent-brand motif)
  const orb=new THREE.Mesh(new THREE.TorusGeometry(420,3.5,8,120),new THREE.MeshBasicMaterial({color:0x00d9b5,transparent:true,opacity:.35,fog:false}));
  orb.position.set(-10,330,-110);orb.rotation.x=Math.PI/2.4;orb.userData.spin=.02;world.add(orb);

  // Distant city blocks (skyline) — lathe/box mix w/ windows
  const cityMat=new THREE.MeshStandardMaterial({map:TEX.windows,emissiveMap:TEX.windows,emissive:0xffffff,emissiveIntensity:.5,color:0x3a4356,roughness:.6});
  const cityGeometries=[],crownGeometries=[];
  const crownMat=new THREE.MeshStandardMaterial({color:0x2a3142,emissive:0xd4a843,emissiveIntensity:.6});
  for(let i=0;i<40;i++){const a=rng()*6.3,d=420+rng()*120;const g=new THREE.Group();g.position.set(-10+Math.cos(a)*d,-1,-110+Math.sin(a)*d);g.rotation.y=rng()*6.3;let y=0,w=16+rng()*14;
    const tiers=2+Math.floor(rng()*3);for(let t=0;t<tiers;t++){const h=18+rng()*40;const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,w*(.7+rng()*.3)),cityMat);b.position.y=y+h/2;b.rotation.y=(rng()-.5)*.3;g.add(b);y+=h;w*=.72;}
    if(rng()<.5){const sp=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(w*.5,0),new THREE.Vector2(w*.2,6),new THREE.Vector2(w*.08,18),new THREE.Vector2(0,26)],8),crownMat);sp.position.y=y;g.add(sp);}
    g.updateMatrixWorld(true);g.children.forEach(mesh=>{mesh.geometry.applyMatrix4(mesh.matrixWorld);(mesh.material===cityMat?cityGeometries:crownGeometries).push(mesh.geometry);});}
  // The skyline is static: two draws instead of a draw for every tower tier.
  for(const [geometries,material] of [[cityGeometries,cityMat],[crownGeometries,crownMat]]){if(!geometries.length)continue;world.add(new THREE.Mesh(mergeGeos(geometries),material));geometries.forEach(g=>g.dispose());}

  // Floating agent-node buoys along anti-grav (teal orbs on stalks)
  const buoyMat=new THREE.MeshStandardMaterial({color:0x081818,emissive:0x00d9b5,emissiveIntensity:2.6});
  const buoyG=new THREE.IcosahedronGeometry(.8,1);const buoys=[];
  for(let i=0;i<N_SAMP;i+=28){if(track.ag[i]<.5)continue;for(const s of[-1,1]){trackPoint(i/N_SAMP,s*(TRACK_W/2+4.5),3.5+Math.sin(i*.2)*1.2,tmp);buoys.push(tmp.clone());}}
  const bi=new THREE.InstancedMesh(buoyG,buoyMat,buoys.length);{const M=new THREE.Matrix4();buoys.forEach((p,i)=>{M.makeTranslation(p.x,p.y,p.z);bi.setMatrixAt(i,M);});world.add(bi);}
}
