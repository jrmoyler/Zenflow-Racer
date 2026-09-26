/* Shared, deterministic surface resources. No remote textures or per-frame baking. */
function surfaceTexture(key, paint, srgb=true, size=256){
  if(TEX[key])return TEX[key];
  const c=document.createElement('canvas');c.width=c.height=size;
  const ctx=c.getContext('2d');if(!ctx?.createImageData)return null;
  const image=ctx.createImageData(size,size),d=image.data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const rgb=paint(x/size,y/size,x,y),i=(y*size+x)*4;
    d[i]=rgb[0];d[i+1]=rgb[1];d[i+2]=rgb[2];d[i+3]=rgb[3]??255;
  }
  ctx.putImageData(image,0,0);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.encoding=srgb?THREE.sRGBEncoding:THREE.LinearEncoding;t.anisotropy=4;
  TEX[key]=t;return t;
}
function buildSurfaceTextures(){
  // Periodic wave fields make both axes tile without a seam.
  const tau=Math.PI*2,noise=(u,v)=>Math.sin(u*tau*7+Math.sin(v*tau*3))*Math.cos(v*tau*9+Math.sin(u*tau*4));
  surfaceTexture('cliffColor',(u,v,x,y)=>{
    const vein=Math.pow(.5+.5*Math.sin(u*tau*31+noise(u,v)*2),7);
    const stratum=Math.sin(v*tau*17+Math.sin(u*tau*3)*.9),grain=hash2(x,y)*18;
    const k=110+noise(u,v)*28+stratum*12-vein*38+grain;
    return [k*1.12,k*1.08,k];
  });
  surfaceTexture('cliffHeight',(u,v)=>{const k=125+noise(u,v)*28+Math.sin(v*tau*17+Math.sin(u*tau*3))*22;return [k,k,k];},false);
  surfaceTexture('barkColor',(u,v)=>{const groove=Math.pow(.5+.5*Math.sin(u*tau*29+noise(u,v)*1.4),4);const k=80+noise(u,v)*18-groove*35;return [k*1.13,k*.89,k*.61];});
  // Road tile: u spans the full 14 m deck (left edge -> right edge), v spans 12 m of travel.
  // Graded aggregate, bitumen binder, polished wheel tracks, a centre paving joint and
  // a transverse construction joint. Macro variation is added in world space (applyRoadSurface)
  // so the 12 m repeat never reads as a pattern.
  const rs=typeof MOBILEFX!=='undefined'&&MOBILEFX?256:512,road=roadSurfaceField(rs);
  surfaceTexture('roadDetail',(u,v,x,y)=>{const f=road(x,y);const k=Math.max(0,Math.min(255,228+f.agg*26+f.chip*22-f.tar*46-f.track*20-f.oil*9-f.joint*120-f.crack*70));return [k,k*.995,k*.985];},true,rs);
  surfaceTexture('roadHeight',(u,v,x,y)=>{const f=road(x,y);const k=Math.max(0,Math.min(255,150+f.agg*52+f.chip*34-f.tar*30-f.track*18-f.joint*130-f.crack*95));return [k,k,k];},false,rs);
  surfaceTexture('roadRoughness',(u,v,x,y)=>{const f=road(x,y);const k=Math.max(40,Math.min(255,176+f.agg*22+f.chip*20-f.track*62-f.oil*30-f.tar*24+f.joint*30));return [k,k,k];},false,rs);
  // Sawtooth rumble ridges (4 per tile) with a bevelled cross-section for the kerbs.
  surfaceTexture('kerbRidge',(u,v)=>{const saw=(v*4)%1,ridge=saw<.62?Math.sin(saw/.62*Math.PI/2):Math.cos((saw-.62)/.38*Math.PI/2),bevel=Math.min(1,Math.min(u,1-u)*9);const k=40+ridge*bevel*200;return [k,k,k];},false,64);
  surfaceTexture('groundHeight',(u,v,x,y)=>{const k=128+noise(u,v)*30+hash2(x,y)*26;return [k,k,k];},false);
  surfaceTexture('plasterColor',(u,v,x,y)=>{const k=235+noise(u,v)*5-hash2(x,y)*10;return [k,k*.99,k*.97];});
  surfaceTexture('mossColor',(u,v,x,y)=>{const n=noise(u,v)*.5+.5,g=hash2(x,y);return [41+n*40+g*12,66+n*66+g*18,23+n*27];});
  surfaceTexture('fabricWeave',(u,v,x,y)=>{const k=225+((x%4<2)===(y%4<2)?12:-12);return [k,k,k];});
  surfaceTexture('metalGrain',(u,v,x,y)=>{const k=120+hash2(x,y)*20+Math.sin(v*600)*8;return [k,k,k];},false);
  surfaceTexture('contactShadow',(u,v)=>{const d=Math.hypot((u-.5)*2,(v-.5)*2);return [8,17,30,Math.max(0,1-d)*130];},false,64);
}

// Deterministic, seamlessly tiling road field shared by colour / height / roughness.
function roadSurfaceField(size){
  const tau=Math.PI*2;
  const lattice=(x,y,p)=>{const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),h=(i,j)=>hash2(((x0+i)%p+p)%p+p*97,((y0+j)%p+p)%p+p*31);
    return (h(0,0)*(1-sx)+h(1,0)*sx)*(1-sy)+(h(0,1)*(1-sx)+h(1,1)*sx)*sy;};
  // One pass fills packed channels; the three textures then read, never recompute.
  const channels=7,data=new Float32Array(size*size*channels),out={agg:0,chip:0,tar:0,track:0,oil:0,joint:0,crack:0};
  const evaluate=(x,y)=>{
    const u=x/size,v=y/size,n=hash2(x*3+11,y*5+7);
    // Two aggregate gradings plus binder-rich patches; all lattices divide the tile.
    const agg=(lattice(u*96,v*96,96)-.5)*.7+(lattice(u*24,v*24,24)-.5)*.5+(n-.5)*.45;
    const chip=n>.972?1:0,tar=hash2(x+913,y+37)<.018?1:0;
    const track=Math.exp(-Math.pow((u-.28)*15,2))+Math.exp(-Math.pow((u-.72)*15,2))+.45*(Math.exp(-Math.pow((u-.39)*22,2))+Math.exp(-Math.pow((u-.61)*22,2)));
    const oil=Math.exp(-Math.pow((u-.25)*30,2))+Math.exp(-Math.pow((u-.75)*30,2));
    const joint=Math.max(Math.exp(-Math.pow((v<.5?v:1-v)*size*.55,2)),Math.exp(-Math.pow((u-.5)*size*.8,2))*.7);
    // Hairline shrinkage cracks follow a warped periodic field and stay out of the wheel tracks.
    const w=Math.sin(u*tau*5+Math.sin(v*tau*3)*1.6)+Math.cos(v*tau*4+Math.sin(u*tau*2)*1.3);
    const crack=Math.pow(Math.max(0,1-Math.abs(w)*9),3)*(lattice(u*6,v*6,6)>.6?1:0)*(1-Math.min(1,track));
    const i=(y*size+x)*channels;data[i]=agg;data[i+1]=chip;data[i+2]=tar;data[i+3]=Math.min(1.3,track);data[i+4]=oil;data[i+5]=joint;data[i+6]=crack;
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)evaluate(x,y);
  return (x,y)=>{const i=(y*size+x)*channels;out.agg=data[i];out.chip=data[i+1];out.tar=data[i+2];out.track=data[i+3];out.oil=data[i+4];out.joint=data[i+5];out.crack=data[i+6];return out;};
}
// World-space macro variation, damp patches and a clear-coated wet film on the road deck.
// Runs only on the WebGL path; the software renderer keeps the plain physical material.
function applyRoadSurface(material,map){
  if(!material||(typeof FALLBACK_GRAPHICS!=='undefined'&&FALLBACK_GRAPHICS))return material;
  const wet=map.id==='canopy'?.62:map.id==='stormforge'?.42:.22,tint=new THREE.Color(map.id==='stormforge'?0x9aa6b4:map.id==='canopy'?0x9fbcb4:0xa39cc4);
  material.userData.roadSurface={wet};
  material.customProgramCacheKey=()=>'zen-road-surface-v2';
  material.onBeforeCompile=shader=>{
    shader.uniforms.roadWet={value:wet};shader.uniforms.roadSheen={value:tint};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRoadWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRoadWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vRoadWorld;uniform float roadWet;uniform vec3 roadSheen;
float roadHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float roadNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(roadHash(i),roadHash(i+vec2(1,0)),f.x),mix(roadHash(i+vec2(0,1)),roadHash(i+vec2(1,1)),f.x),f.y);}`)
    .replace('#include <map_fragment>',`#include <map_fragment>
vec2 roadP=vRoadWorld.xz;
float roadMacro=roadNoise(roadP*.031)*.62+roadNoise(roadP*.13+9.)*.38;
float roadDamp=smoothstep(.58,.82,roadNoise(roadP*.047+17.)*.75+roadNoise(roadP*.21)*.25)*roadWet;
diffuseColor.rgb*=mix(.88,1.07,roadMacro)*(1.-roadDamp*.26);
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*roadSheen*1.2,roadDamp*.35);`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor*mix(.92,1.08,roadMacro),.16,roadDamp*.8);`)
    .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
#ifdef CLEARCOAT
material.clearcoat=mix(material.clearcoat,1.,roadDamp);material.clearcoatRoughness=mix(material.clearcoatRoughness,.07,roadDamp);
#endif`);
  };
  return material;
}
// Coplanar decals (paint, glow, kerb stripes) resolve in favour of the overlay at any range.
function decalMaterial(material,bias=1){material.polygonOffset=true;material.polygonOffsetFactor=-bias;material.polygonOffsetUnits=-bias*2;return material;}

// A filtered reflection environment with visible softbox / sun highlights. The old
// low-resolution pastel cube had no bright features for clearcoat to reflect.
let surfaceEnvironmentTarget=null;
function createSurfaceEnvironmentTarget(renderer,map){
  if(typeof FALLBACK_GRAPHICS!=='undefined'&&FALLBACK_GRAPHICS)return null;
  const stage=new THREE.Scene();stage.background=new THREE.Color(map.skyHorizon).multiplyScalar(.5);
  const items=[];
  const dome=new THREE.Mesh(new THREE.SphereGeometry(10,24,12),new THREE.MeshBasicMaterial({color:new THREE.Color(map.skyTop).multiplyScalar(.6),side:THREE.BackSide}));stage.add(dome);items.push(dome);
  for(const [position,scale,color,power] of [
    [[-4,6,-3],[5,3,1],0xfff3df,5],[[5,3,1],[2,7,1],0xc0efff,3],[[0,5,5],[7,2,1],0xffffff,2]
  ]){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));m.position.set(...position);m.scale.set(...scale);m.lookAt(0,0,0);stage.add(m);items.push(m);}
  const pmrem=new THREE.PMREMGenerator(renderer);let next;
  // r128 PMREM blurs with at most 20 taps at this size; .038 is the widest sigma it
  // renders without clipping (and warning on every environment build).
  try{next=pmrem.fromScene(stage,.038,.1,30);}
  catch(error){console.warn('Reflection environment unavailable',error);return null;}
  finally{pmrem.dispose();for(const m of items){m.geometry.dispose();m.material.dispose();}}
  return next;
}

// Race renderer keeps its own target; showroom disposal cannot invalidate it.
function createSurfaceEnvironment(renderer,map){
  const next=createSurfaceEnvironmentTarget(renderer,map);
  if(!next)return surfaceEnvironmentTarget?.texture||null;
  surfaceEnvironmentTarget?.dispose();surfaceEnvironmentTarget=next;
  return next.texture;
}

// Bezier leaf blades, vertex shaded along the midrib. Shared instanced tree crowns
// retain individual foliage silhouettes at trackside instead of solid ellipsoids.
function foliageGeometry(seed,tint){
  const random=mulberry(seed),p=[],colors=[],uv=[],c=new THREE.Color();
  const lo=new THREE.Color(tint[0]),hi=new THREE.Color(tint[1]);
  const count=typeof MOBILEFX!=='undefined'&&MOBILEFX?260:440;
  const v=new THREE.Vector3(),q=new THREE.Quaternion();
  for(let i=0;i<count;i++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*3.3;
    const center=new THREE.Vector3(Math.cos(a)*r,1.7+random()*2.2+(1-r/3.3),Math.sin(a)*r*.8);
    q.setFromEuler(new THREE.Euler(random()*2.4-.8,a,random()*.8));
    const length=.65+random()*.65,width=length*.36;
    const points=[[0,0,0],[-width,.08,length*.48],[0,.17,length],[width,.08,length*.48],[0,.2,length*.48]];
    for(const n of[0,1,4,1,2,4,2,3,4,3,0,4]){
      v.set(...points[n]).applyQuaternion(q).add(center);p.push(v.x,v.y,v.z);
      c.copy(lo).lerp(hi,.22+random()*.35+(n===4?.3:0));colors.push(c.r,c.g,c.b);uv.push(n===1?0:n===3?1:.5,n===2?1:n===0?0:.5);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}

// Frame-cost adaptation only changes resolution; input / physics stay at 120 Hz.
const renderBudget={mean:16.7,samples:0,cooldown:240,ratio:0};
function resetRenderBudget(){renderBudget.mean=16.7;renderBudget.cooldown=240;}
function updateRenderBudget(milliseconds){
  if(typeof FALLBACK_GRAPHICS==='undefined'||FALLBACK_GRAPHICS||LOWFX||!MOBILEFX||!renderer.setPixelRatio)return;
  if(!Number.isFinite(milliseconds)||milliseconds<4||milliseconds>150)return;
  renderBudget.mean+=(milliseconds-renderBudget.mean)*.035;
  if(--renderBudget.cooldown>0)return;
  const current=renderBudget.ratio||Math.min(devicePixelRatio,1.15);
  const next=renderBudget.mean>25?Math.max(.7,current-.15):renderBudget.mean<17?Math.min(devicePixelRatio,1.15,current+.1):current;
  renderBudget.cooldown=180;
  if(Math.abs(next-current)>.01){renderBudget.ratio=next;renderer.setPixelRatio(next);renderer.setSize(innerWidth,innerHeight);}
}
