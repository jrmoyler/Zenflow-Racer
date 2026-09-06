// ---------- Kart material factory ----------
// Procedural PBR liveries for the twelve division chassis. Every map is a canvas drawn at
// runtime (no external assets) and cached ONCE per division in the global TEX store, so
// disposeKart() keeps the maps alive across races while the 12-kart grid shares them.
// Materials themselves are fresh instances per call (disposeKart disposes them).
// Every generator degrades to plain untextured materials when no drawable 2D canvas exists
// (Node regression contexts with stub canvases, or no document at all).
//
// UV conventions (see vehicles.js): coachwork/ribbon/limb surfaces put u around the
// cross-section (0 top, .25 right flank, .5 underside, .75 left flank) and v along the
// length (0 front, 1 rear). Canvas x = u, canvas y = (1-v) because CanvasTexture flips Y.
const KART_ORDER=['zenflow','collective','hybrid','nexus','kinetic','juris','signal','loom','vector','aether','animus','helix'];
const KM_CTX_API=['fillRect','fillText','getImageData','putImageData','createImageData','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','save','restore','translate','rotate','scale','setTransform','drawImage','createLinearGradient','createRadialGradient'];
const KM_LOCAL_TEX={};
let KM_NOISE=null;
function kmStore(){return typeof TEX!=='undefined'&&TEX?TEX:KM_LOCAL_TEX;}
function kmMobile(){return typeof MOBILEFX!=='undefined'&&!!MOBILEFX;}
function kmSize(px){return kmMobile()?px>>1:px;}
function kmHash(x,y){let h=(x|0)*374761393+(y|0)*668265263;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967295;}
function kmRng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function kmRgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function kmMix(a,b,t){const x=kmRgb(a),y=kmRgb(b);return `rgb(${Math.round(x[0]+(y[0]-x[0])*t)},${Math.round(x[1]+(y[1]-x[1])*t)},${Math.round(x[2]+(y[2]-x[2])*t)})`;}
function kmAlpha(h,a){const c=kmRgb(h);return `rgba(${c[0]},${c[1]},${c[2]},${a})`;}
// A drawable 2D canvas, or null when the host cannot draw (stub canvases, no document).
function kmCanvas(w,h){
  try{
    if(typeof document==='undefined'||!document||typeof document.createElement!=='function')return null;
    const c=document.createElement('canvas');if(!c||typeof c.getContext!=='function')return null;
    c.width=w;c.height=h;const g=c.getContext('2d');if(!g)return null;
    for(const k of KM_CTX_API)if(typeof g[k]!=='function')return null;
    return {c,g,w,h};
  }catch(e){return null;}
}
function kmTex(c,srgb,repeat){
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;
  if(repeat)t.repeat.set(repeat[0],repeat[1]);if(srgb)t.encoding=THREE.sRGBEncoding;
  t.anisotropy=kmMobile()?4:8;t.needsUpdate=true;return t;
}
// Textures are generated once per key; failures cache null so no kart retries them.
function kmCached(key,make){
  const store=kmStore();if(Object.prototype.hasOwnProperty.call(store,key))return store[key];
  let t=null;try{t=make()||null;}catch(e){t=null;}store[key]=t;return t;
}
function kmNoise(){ // shared 128px fleck tile used for pearl/rubber micro-variation
  if(KM_NOISE!==null)return KM_NOISE||null;
  const n=kmCanvas(128,128);if(!n){KM_NOISE=false;return null;}
  const img=n.g.createImageData(128,128),d=img.data;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){const v=90+kmHash(x*3+1,y*5+7)*150;const i=(y*128+x)*4;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}
  n.g.putImageData(img,0,0);KM_NOISE=n.c;return n.c;
}
function kmFleck(g,w,h,alpha){const n=kmNoise();if(!n)return;g.save();g.globalAlpha=alpha;for(let y=0;y<h;y+=128)for(let x=0;x<w;x+=128)g.drawImage(n,x,y);g.restore();}
// Tangent-space normal map from a grey height canvas (green = +v, matching flipY upload).
function kmNormalFromHeight(hc,strength){
  const {w,h}=hc,src=hc.g.getImageData(0,0,w,h).data,out=kmCanvas(w,h);if(!out)return null;
  const img=out.g.createImageData(w,h),d=img.data,H=(x,y)=>src[(((y+h)%h)*w+((x+w)%w))*4];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const dx=(H(x+1,y)-H(x-1,y))*strength/255,dy=(H(x,y+1)-H(x,y-1))*strength/255,l=Math.sqrt(dx*dx+dy*dy+1);
    const i=(y*w+x)*4;d[i]=(-dx/l*.5+.5)*255;d[i+1]=(dy/l*.5+.5)*255;d[i+2]=(1/l*.5+.5)*255;d[i+3]=255;}
  out.g.putImageData(img,0,0);return out.c;
}

// ---------- Division livery (colour / roughness / height modes share one layout) ----------
function kmLivery(div,mode,S){
  const cv=kmCanvas(S,S);if(!cv)return null;const {g}=cv;
  const color=mode==='color',rough=mode==='rough',id=div.id;
  g.fillStyle=color?'#F1F5FA':rough?'#484848':'#808080';g.fillRect(0,0,S,S);
  if(color)kmFleck(g,S,S,.025);
  // The approved skins show pearl shells and continuous colored inlays, not an
  // all-over sponsor wrap. These UV panels stay subordinate to sculpted coachwork.
  const accent=color?div.acc:rough?'#505050':'#848484';
  const trim=color?(['collective','juris','aether','hybrid','helix'].includes(id)?div.acc2:'#DCEBF6'):rough?'#454545':'#838383';
  const widths={zenflow:.055,collective:.10,hybrid:.035,nexus:.04,kinetic:.045,juris:.065,signal:.07,loom:.028,vector:.08,aether:.04,animus:.022,helix:.026};
  const width=widths[id]||.04;
  g.fillStyle=accent;g.fillRect(0,0,S*width,S);g.fillRect(S*(1-width),0,S*width,S);
  for(const x of[.17,.83]){g.strokeStyle=trim;g.lineWidth=S*.012;g.beginPath();g.moveTo(S*x,0);g.lineTo(S*(x+.035),S*.35);g.lineTo(S*x,S);g.stroke();}
  // Subtle panel seams give a physical scale cue without striping every fender.
  g.strokeStyle=color?'rgba(35,55,75,.18)':rough?'#656565':'#686868';g.lineWidth=Math.max(1,S/512);
  for(const y of[.12,.88]){g.beginPath();g.moveTo(S*.1,S*y);g.lineTo(S*.4,S*y);g.moveTo(S*.6,S*y);g.lineTo(S*.9,S*y);g.stroke();}
  g.fillStyle=color?'#52657B':rough?'#777777':'#808080';g.textAlign='center';g.font=`600 ${S*.022}px sans-serif`;
  g.fillText(String(KART_ORDER.indexOf(id)+1).padStart(2,'0'),S*.25,S*.74);g.fillText(div.code,S*.75,S*.74);
  g.font=`500 ${S*.012}px sans-serif`;g.fillText('COLLECTIVE AI',S*.75,S*.77);
  return cv;
}

// ---------- Tyre: tread blocks + sipes, sidewall lettering, accent pinstripe ----------
function kmTyre(div,mode,W,H){
  const cv=kmCanvas(W,H);if(!cv)return null;const {g}=cv,color=mode==='color';
  const P=color?{base:'#1A1B1E',groove:'#0B0B0D',sipe:'#26272B',block:'#202126',wall:'#1E1F23',letter:'#4C4E55',pin:div.acc}:{base:'#8c8c8c',groove:'#303030',sipe:'#666666',block:'#969696',wall:'#7e7e7e',letter:'#b4b4b4',pin:'#8e8e8e'};
  g.fillStyle=P.base;g.fillRect(0,0,W,H);if(color)kmFleck(g,W,H,.12);
  const N=28,bw=W/N,ribs=[[.25,.36],[.36,.5],[.5,.64],[.64,.75]];
  ribs.forEach(([a,b],r)=>{const y0=a*H,y1=b*H,off=(r%2)*bw*.5;
    for(let k=-1;k<=N;k++){const x=k*bw+off;g.fillStyle=P.block;g.fillRect(x+bw*.1,y0,bw*.8,y1-y0);
      g.fillStyle=P.groove;g.fillRect(x-bw*.09,y0,bw*.18,y1-y0);
      g.strokeStyle=P.sipe;g.lineWidth=1;for(const t of [.38,.62]){g.beginPath();g.moveTo(x+bw*t-bw*.06,y0+(y1-y0)*.15);g.lineTo(x+bw*t+bw*.06,y1-(y1-y0)*.15);g.stroke();}}});
  g.fillStyle=P.groove;for(const v of [.36,.5,.64])g.fillRect(0,v*H-H*.014,W,H*.028);
  for(const [a,b] of [[.125,.25],[.75,.875]]){const y0=a*H,y1=b*H;for(let k=-1;k<=N;k++){const x=k*bw+bw*.25;g.fillStyle=P.block;g.fillRect(x,y0,bw*.55,y1-y0);g.fillStyle=P.groove;g.fillRect(x+bw*.55,y0+(y1-y0)*.2,bw*.12,(y1-y0)*.6);}}
  g.fillStyle=P.wall;g.fillRect(0,0,W,H*.125);g.fillRect(0,H*.875,W,H*.125);
  // Sidewall lettering: two repeats per circumference; the far sidewall reads the other way round.
  const label=`${div.name.toUpperCase()} · ZENFLOW ·`;g.font=`700 ${H*.062}px "Space Grotesk",system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=P.letter;
  for(let k=-1;k<=2;k++){g.fillText(label,(k+.5)*W/2,H*.062);g.save();g.setTransform(-1,0,0,-1,W,H);g.fillText(label,(k+.5)*W/2,H*.062);g.restore();}
  g.fillStyle=P.pin;g.fillRect(0,H*.012,W,Math.max(1,H*.014));g.fillRect(0,H*.974,W,Math.max(1,H*.014));
  return cv;
}
// ---------- Carbon-fibre twill (shared) ----------
function kmCarbon(mode,S){
  const cv=kmCanvas(S,S);if(!cv)return null;const {g}=cv,cell=S/32,color=mode==='color';
  g.fillStyle=color?'#141A26':'#808080';g.fillRect(0,0,S,S);
  for(let j=0;j<32;j++)for(let i=0;i<32;i++){const warp=((i+j)%4)<2,x=i*cell,y=j*cell;
    const gr=warp?g.createLinearGradient(x,y,x+cell,y):g.createLinearGradient(x,y,x,y+cell);
    if(color){gr.addColorStop(0,'#2C3446');gr.addColorStop(.5,warp?'#3B4458':'#222A3A');gr.addColorStop(1,'#151B28');}
    else{gr.addColorStop(0,'#9a9a9a');gr.addColorStop(.5,'#8a8a8a');gr.addColorStop(1,'#6a6a6a');}
    g.fillStyle=gr;g.fillRect(x+.5,y+.5,cell-1,cell-1);}
  return cv;
}
// ---------- Brushed metal (shared; tinted by material colour) ----------
function kmMetal(mode,S){
  const cv=kmCanvas(S,S);if(!cv)return null;const {g}=cv,color=mode==='color';
  g.fillStyle=color?'#DDE1E6':'#404040';g.fillRect(0,0,S,S);
  for(let x=0;x<S;x++){const a=kmHash(x,3),b=kmHash(x,9);g.fillStyle=a<.5?`rgba(255,255,255,${b*.22})`:`rgba(0,0,0,${b*.2})`;g.fillRect(x,0,1,S);}
  const r=kmRng(77);for(let k=0;k<60;k++){const x=r()*S,y=r()*S,l=S*.15+r()*S*.5;g.fillStyle=color?`rgba(255,255,255,${.15+r()*.3})`:`rgba(0,0,0,${.2+r()*.3})`;g.fillRect(x,y,1,l);}
  return cv;
}
// ---------- Accent panel hex micro-pattern (shared): colour + emissive ----------
function kmPanel(mode,S){
  const cv=kmCanvas(S,S);if(!cv)return null;const {g}=cv,em=mode==='emissive',r=S/14;
  g.fillStyle=em?'#000000':'#F4F4F4';g.fillRect(0,0,S,S);
  if(em){const gr=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S*.5);gr.addColorStop(0,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,S,S);}
  g.strokeStyle=em?'rgba(255,255,255,.15)':'#E5E5E5';g.lineWidth=Math.max(1,S/170);
  for(let y=0;y<S+r;y+=r*1.5)for(let x=0;x<S+r;x+=r*1.732){const ox=(Math.round(y/(r*1.5))%2)*r*.866;g.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2+Math.PI/6;const px=x+ox+Math.cos(a)*r*.9,py=y+Math.sin(a)*r*.9;i?g.lineTo(px,py):g.moveTo(px,py);}g.closePath();g.stroke();
    g.fillStyle=em?'rgba(255,255,255,.9)':'#D0D0D0';g.beginPath();g.arc(x+ox,y,Math.max(1,S/120),0,Math.PI*2);g.fill();}
  return cv;
}
// ---------- Glow emissive gradient (shared): hot core across the tube, edge falloff ----------
function kmGlowEm(S){
  const cv=kmCanvas(S,S);if(!cv)return null;const {g}=cv,img=g.createImageData(S,S),d=img.data;
  for(let y=0;y<S;y++){const v=1-y/S,e=.38+.62*Math.pow(Math.abs(Math.sin(v*Math.PI*2)),.7);for(let x=0;x<S;x++){const s=e*(.92+.08*kmHash(x,1)),i=(y*S+x)*4;d[i]=d[i+1]=d[i+2]=Math.min(255,s*255);d[i+3]=255;}}
  g.putImageData(img,0,0);return cv;
}
// ---------- Pilot skin: energy circuit traces (shared, tinted by division emissive) ----------
function kmSkinEm(S){
  const cv=kmCanvas(S,S);if(!cv)return null;const {g}=cv,r=kmRng(4242),q=S/16;
  g.fillStyle='#262626';g.fillRect(0,0,S,S);g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=Math.max(1,S/128);g.lineCap='round';
  for(let k=0;k<44;k++){let x=Math.floor(r()*16)*q,y=Math.floor(r()*16)*q;g.beginPath();g.moveTo(x,y);for(let s=0;s<4;s++){if(s%2)y+=(Math.floor(r()*5)-2)*q;else x+=(Math.floor(r()*5)-2)*q;g.lineTo(x,y);}g.stroke();
    g.fillStyle='#FFFFFF';g.beginPath();g.arc(x,y,Math.max(1.5,S/90),0,Math.PI*2);g.fill();}
  return cv;
}

// One shared texture set per division (plus shared surface tiles); any entry may be null.
function kartTextures(div){
  const id=div.id,S=kmSize(512),s=kmSize(256),tw=kmSize(256),th=kmSize(128);
  return {
    livery:kmCached(`kart-${id}-livery`,()=>{const c=kmLivery(div,'color',S);return c&&kmTex(c.c,true);}),
    liveryRough:kmCached(`kart-${id}-livery-rough`,()=>{const c=kmLivery(div,'rough',s);return c&&kmTex(c.c,false);}),
    liveryNormal:kmCached(`kart-${id}-livery-normal`,()=>{const h=kmLivery(div,'height',s),n=h&&kmNormalFromHeight(h,2.4);return n&&kmTex(n,false);}),
    tyre:kmCached(`kart-${id}-tyre`,()=>{const c=kmTyre(div,'color',tw,th);return c&&kmTex(c.c,true);}),
    tyreNormal:kmCached('kart-tyre-normal',()=>{const h=kmTyre(div,'height',tw,th),n=h&&kmNormalFromHeight(h,2.2);return n&&kmTex(n,false);}),
    carbon:kmCached('kart-carbon',()=>{const c=kmCarbon('color',s);return c&&kmTex(c.c,true,[4,4]);}),
    carbonNormal:kmCached('kart-carbon-normal',()=>{const h=kmCarbon('height',s),n=h&&kmNormalFromHeight(h,1.6);return n&&kmTex(n,false,[4,4]);}),
    metal:kmCached('kart-metal',()=>{const c=kmMetal('color',s);return c&&kmTex(c.c,true,[1,2]);}),
    metalRough:kmCached('kart-metal-rough',()=>{const c=kmMetal('rough',s);return c&&kmTex(c.c,false,[1,2]);}),
    panel:kmCached('kart-panel',()=>{const c=kmPanel('color',s);return c&&kmTex(c.c,true);}),
    panelEm:kmCached('kart-panel-em',()=>{const c=kmPanel('emissive',s);return c&&kmTex(c.c,true);}),
    glowEm:kmCached('kart-glow-em',()=>{const c=kmGlowEm(kmSize(128));return c&&kmTex(c.c,true);}),
    skinEm:kmCached('kart-skin-em',()=>{const c=kmSkinEm(s);return c&&kmTex(c.c,true,[2,2]);}),
  };
}

function kartMaterials(div){
  const color=new THREE.Color(div.id==='vector'?'#309DFF':div.acc),light=color.clone().lerp(new THREE.Color(0xc8ffff),.38);
  const T=kartTextures(div),side=THREE.DoubleSide,v2=(x)=>new THREE.Vector2(x,x);
  const metalTint=['collective','juris','aether','helix','hybrid'].includes(div.id)?(div.id==='juris'?'#C9A84C':div.id==='collective'?'#BE813B':'#EE8B36'):'#708CA3';
  const white=new THREE.MeshPhysicalMaterial({color:T.livery?0xffffff:0xeaf5ff,map:T.livery,roughnessMap:T.liveryRough,roughness:T.liveryRough?1:.2,normalMap:T.liveryNormal,normalScale:v2(.18),metalness:.22,envMapIntensity:1.1,clearcoat:1,clearcoatRoughness:.12,side});
  const dark=new THREE.MeshStandardMaterial({color:T.carbon?0xffffff:0x142943,map:T.carbon,normalMap:T.carbonNormal,normalScale:v2(.5),metalness:.15,roughness:.35,side});
  const panel=new THREE.MeshPhysicalMaterial({color:color.clone(),map:T.panel,emissive:color,emissiveMap:T.panelEm,emissiveIntensity:.08,roughness:.19,metalness:.38,envMapIntensity:1.2,clearcoat:1,side});
  const glow=new THREE.MeshStandardMaterial({color:light,emissive:light,emissiveMap:T.glowEm,emissiveIntensity:1.7,roughness:.2,side});
  const skin=new THREE.MeshPhysicalMaterial({color,emissive:color,emissiveMap:T.skinEm,emissiveIntensity:.055,roughness:.12,metalness:.42,envMapIntensity:1.35,clearcoat:1,clearcoatRoughness:.08,transparent:false,opacity:1,side});
  const metal=new THREE.MeshPhysicalMaterial({color:metalTint,map:T.metal,roughnessMap:T.metalRough,metalness:.85,roughness:T.metalRough?1:.22,clearcoat:1});
  const tyre=new THREE.MeshStandardMaterial({color:T.tyre?0xffffff:0x1c1d20,map:T.tyre,normalMap:T.tyreNormal,normalScale:v2(.8),roughness:.85,metalness:0});
  return {white,dark,panel,glow,skin,metal,tyre,color,light};
}
