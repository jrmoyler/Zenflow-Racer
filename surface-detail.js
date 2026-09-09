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
  surfaceTexture('roadDetail',(u,v,x,y)=>{const seam=(v<.004||u<.002)?145:0;const k=244-seam-hash2(x,y)*9;return [k,k,k];});
  surfaceTexture('roadRoughness',(u,v,x,y)=>{const wear=Math.exp(-Math.pow((u-.28)*17,2))+Math.exp(-Math.pow((u-.72)*17,2));const k=140-wear*30+hash2(x,y)*15;return [k,k,k];},false);
  surfaceTexture('groundHeight',(u,v,x,y)=>{const k=128+noise(u,v)*30+hash2(x,y)*26;return [k,k,k];},false);
  surfaceTexture('plasterColor',(u,v,x,y)=>{const k=235+noise(u,v)*5-hash2(x,y)*10;return [k,k*.99,k*.97];});
  surfaceTexture('mossColor',(u,v,x,y)=>{const n=noise(u,v)*.5+.5,g=hash2(x,y);return [41+n*40+g*12,66+n*66+g*18,23+n*27];});
  surfaceTexture('fabricWeave',(u,v,x,y)=>{const k=225+((x%4<2)===(y%4<2)?12:-12);return [k,k,k];});
  surfaceTexture('metalGrain',(u,v,x,y)=>{const k=120+hash2(x,y)*20+Math.sin(v*600)*8;return [k,k,k];},false);
  surfaceTexture('contactShadow',(u,v)=>{const d=Math.hypot((u-.5)*2,(v-.5)*2);return [8,17,30,Math.max(0,1-d)*130];},false,64);
}

// A filtered reflection environment with visible softbox / sun highlights. The old
// low-resolution pastel cube had no bright features for clearcoat to reflect.
let surfaceEnvironmentTarget=null;
function createSurfaceEnvironment(renderer,map){
  if(typeof FALLBACK_GRAPHICS!=='undefined'&&FALLBACK_GRAPHICS)return null;
  const stage=new THREE.Scene();stage.background=new THREE.Color(map.skyHorizon).multiplyScalar(.5);
  const items=[];
  const dome=new THREE.Mesh(new THREE.SphereGeometry(10,24,12),new THREE.MeshBasicMaterial({color:new THREE.Color(map.skyTop).multiplyScalar(.6),side:THREE.BackSide}));stage.add(dome);items.push(dome);
  for(const [position,scale,color,power] of [
    [[-4,6,-3],[5,3,1],0xfff3df,5],[[5,3,1],[2,7,1],0xc0efff,3],[[0,5,5],[7,2,1],0xffffff,2]
  ]){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));m.position.set(...position);m.scale.set(...scale);m.lookAt(0,0,0);stage.add(m);items.push(m);}
  const pmrem=new THREE.PMREMGenerator(renderer);let next;
  try{next=pmrem.fromScene(stage,.06,.1,30);}
  catch(error){console.warn('Reflection environment unavailable',error);return surfaceEnvironmentTarget?.texture||null;}
  finally{pmrem.dispose();for(const m of items){m.geometry.dispose();m.material.dispose();}}
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
