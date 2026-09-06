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
  const cv=kmCanvas(S,S);if(!cv)return null;const {g}=cv,W=S,H=S,color=mode==='color',rough=mode==='rough';
  const acc=div.acc,acc2=div.acc2,id=div.id;
  const idx=(typeof ROSTER!=='undefined'&&ROSTER.findIndex?ROSTER.findIndex(d=>d.id===id):-1),order=idx>=0?idx:KART_ORDER.indexOf(id);
  const number=String((order>=0?order:0)+1).padStart(2,'0');
  // Mode palettes: colour is the livery; rough stores roughness in grey (G channel); height stores relief.
  const P=color?{base:kmMix('#F1F5F9',acc2,id==='aether'?.3:.1),acc,acc2,dark:'#1B2230',under:'rgba(38,44,54,.85)',seam:'rgba(18,26,40,.42)',rivet:'rgba(24,32,46,.6)',rivetHi:'rgba(255,255,255,.7)',badge:id==='vector'?acc2:'#F8FAFC',ring:'rgba(20,28,40,.5)',text:id==='vector'?acc:'#111827'}
    :rough?{base:'#333333',acc:'#4f4f4f',acc2:'#4b4b4b',dark:'#5c5c5c',under:'#8c8c8c',seam:'#7a7a7a',rivet:'#6c6c6c',rivetHi:'#6c6c6c',badge:'#585858',ring:'#707070',text:'#606060'}
    :{base:'#808080',acc:'#878787',acc2:'#878787',dark:'#858585',under:'#7c7c7c',seam:'#3c3c3c',rivet:'#b0b0b0',rivetHi:'#b0b0b0',badge:'#8a8a8a',ring:'#5a5a5a',text:'#8e8e8e'};
  const X=u=>u*W,Y=v=>(1-v)*H;
  const rectUV=(u0,v0,u1,v1,fill)=>{const a=Math.min(u0,u1),b=Math.max(u0,u1);g.fillStyle=fill;g.fillRect(X(a),Y(v1),X(b)-X(a),Y(v0)-Y(v1));};
  const polyUV=(pts,fill,stroke,lw)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=lw||2;g.stroke();}};
  const lineUV=(pts,stroke,lw)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.strokeStyle=stroke;g.lineWidth=lw;g.stroke();};
  const dot=(u,v,r,fill)=>{g.fillStyle=fill;g.beginPath();g.arc(X(u),Y(v),r,0,Math.PI*2);g.fill();};
  const wrap=fn=>{for(const dx of [-2,-1,0,1]){g.save();g.translate(dx*W,0);fn();g.restore();}};
  const mirror=fn=>{fn(u=>u);fn(u=>1-u);};
  g.lineCap='round';g.lineJoin='round';
  g.fillStyle=P.base;g.fillRect(0,0,W,H);
  if(color)kmFleck(g,W,H,.09);else if(rough)kmFleck(g,W,H,.14);
  // ---- Authored stripe language per division ----
  wrap(()=>{switch(id){
    case 'zenflow':{ // cyan lattice over pearl, pale rear wedge
      rectUV(-.035,0,.035,1,P.acc);
      mirror(m=>{polyUV([[m(.05),.78],[m(.45),.7],[m(.45),1],[m(.05),1]],color?kmAlpha(acc2,.7):P.acc2);
        g.lineWidth=Math.max(1.2,S/220);g.strokeStyle=color?kmAlpha(acc,.42):P.acc;
        for(let k=-4;k<12;k++){const v=k*.085;lineUV([[m(.07),v],[m(.43),v+.36]],g.strokeStyle,g.lineWidth);lineUV([[m(.43),v],[m(.07),v+.36]],g.strokeStyle,g.lineWidth);}
        for(let k=0;k<11;k++)for(let j=0;j<3;j++)dot(m(.11+j*.14),.08+k*.085,S*.006,color?acc2:P.acc2);});
      break;}
    case 'collective':{ // bronze tourer pinstripes on emerald
      rectUV(-.07,0,.07,1,P.acc);rectUV(-.082,0,-.07,1,P.acc2);rectUV(.07,0,.082,1,P.acc2);
      rectUV(.36,0,.64,1,color?kmMix(acc,'#000000',.25):P.acc);
      mirror(m=>{rectUV(m(.19),0,m(.197),1,P.acc2);rectUV(m(.31),0,m(.317),1,P.acc2);polyUV([[m(.1),0],[m(.4),0],[m(.4),.13],[m(.1),.07]],P.acc2);});
      break;}
    case 'hybrid':{ // sky-blue / orange split with a pearl spine
      rectUV(.07,0,.44,1,P.acc2);rectUV(.56,0,.93,1,P.acc);
      rectUV(.44,0,.56,1,P.dark);
      mirror(m=>{rectUV(m(.055),0,m(.07),1,color?'#0B1120':P.dark);polyUV([[m(.07),.6],[m(.44),.52],[m(.44),.56],[m(.07),.65]],color?'#F8FAFC':P.base);});
      break;}
    case 'nexus':{ // amber turbine hazard bands front and rear
      rectUV(-.05,0,.05,1,P.acc);
      for(const [v0,v1] of [[.06,.2],[.72,.86]])for(let k=0;k<10;k++){const u=k*.1;polyUV([[u,v0],[u+.05,v0],[u+.11,v1],[u+.06,v1]],k%2?P.dark:P.acc);}
      mirror(m=>{rectUV(m(.3),0,m(.36),1,color?kmAlpha(acc2,.8):P.acc2);});
      break;}
    case 'kinetic':{ // twin green racing stripes, dark sills, forward swoosh
      rectUV(-.075,0,-.02,1,P.acc);rectUV(.02,0,.075,1,P.acc);
      rectUV(.33,0,.67,1,P.dark);
      mirror(m=>{rectUV(m(.325),0,m(.335),1,color?acc2:P.acc2);polyUV([[m(.1),.55],[m(.42),.3],[m(.42),.42],[m(.1),.68]],P.acc);});
      break;}
    case 'juris':{ // gold armour bands with riveted steel edges
      if(color){g.fillStyle=kmAlpha(acc,.08);g.fillRect(0,0,W,H);}
      rectUV(.34,0,.66,1,P.acc2);rectUV(-.03,0,.03,1,P.acc);
      for(const v0 of [.14,.46,.78]){rectUV(0,v0,1,v0+.09,P.acc);rectUV(0,v0-.009,1,v0,color?'#5C4A1E':P.dark);rectUV(0,v0+.09,1,v0+.099,color?'#5C4A1E':P.dark);
        for(let k=0;k<20;k++){dot(k*.05+.025,v0+.02,S*.006,color?'#6B5525':P.rivet);dot(k*.05+.025,v0+.07,S*.006,color?'#6B5525':P.rivet);}}
      break;}
    case 'signal':{ // red speed chevrons pointing forward, red nose ring
      rectUV(0,0,1,.1,P.acc);polyUV([[-.06,1],[.06,1],[.015,.1],[-.015,.1]],P.acc);rectUV(.38,0,.62,1,P.dark);
      mirror(m=>{for(let k=0;k<5;k++){const v=.2+k*.12;polyUV([[m(.08),v+.06],[m(.25),v],[m(.42),v+.06],[m(.42),v+.1],[m(.25),v+.04],[m(.08),v+.1]],k%2?P.acc:P.dark);}});
      break;}
    case 'loom':{ // woven purple lattice on the flanks, pale spine
      rectUV(-.05,0,.05,1,P.acc2);rectUV(-.058,0,-.05,1,P.acc);rectUV(.05,0,.058,1,P.acc);rectUV(.4,0,.6,1,P.dark);
      mirror(m=>{for(let i=0;i<6;i++)for(let j=0;j<14;j++){const u0=.1+i*.05,v0=.15+j*.05,warp=(i+j)%2;rectUV(m(u0)+(m(1)-m(0))*.002,v0+.002,m(u0+.05)-(m(1)-m(0))*.002,v0+.048,warp?P.acc:P.acc2);
        if(color){g.strokeStyle=warp?kmAlpha(acc2,.5):kmAlpha(acc,.5);g.lineWidth=1;for(let k=1;k<4;k++){const t=k/4;g.beginPath();if(warp){g.moveTo(X(m(u0)),Y(v0+t*.05));g.lineTo(X(m(u0+.05)),Y(v0+t*.05));}else{g.moveTo(X(m(u0+t*.05)),Y(v0));g.lineTo(X(m(u0+t*.05)),Y(v0+.05));}g.stroke();}}}});
      break;}
    case 'vector':{ // navy aircraft belly, steel top, cheat line and stencil ticks
      rectUV(.28,0,.72,1,P.acc2);rectUV(-.12,0,.12,1,P.acc);
      mirror(m=>{rectUV(m(.272),0,m(.283),1,color?'#309DFF':P.acc);for(let k=0;k<12;k++)rectUV(m(.13),.06+k*.08,m(.15),.068+k*.08,P.acc2);});
      break;}
    case 'aether':{ // copper orbit rings on cream, copper spine
      rectUV(-.04,0,.04,1,P.acc);rectUV(.4,0,.6,1,color?kmMix(acc,'#000000',.3):P.acc);
      mirror(m=>{const cx=X(m(.25)),cy=Y(.5),R=S*.21;[-.55,.25,1.05].forEach((a,k)=>{g.save();g.translate(cx,cy);g.rotate(a);g.scale(1,.36);g.beginPath();g.arc(0,0,R,0,Math.PI*2);g.restore();g.strokeStyle=P.acc;g.lineWidth=Math.max(2,S/130);g.stroke();
          const th=.9+k*2.1,lx=Math.cos(th)*R,ly=Math.sin(th)*R*.36; // satellite node sitting on its ring
          g.fillStyle=color?acc2:P.acc2;g.beginPath();g.arc(cx+lx*Math.cos(a)-ly*Math.sin(a),cy+lx*Math.sin(a)+ly*Math.cos(a),S*.011,0,Math.PI*2);g.fill();});});
      break;}
    case 'animus':{ // robotic panel lines with cyan light seams
      rectUV(-.012,0,.012,1,P.acc);
      mirror(m=>{rectUV(m(.21),0,m(.216),1,P.acc);const panels=[[.04,.05,.2,.35],[.04,.4,.2,.7],[.04,.75,.2,.95],[.23,.05,.44,.3],[.23,.35,.44,.62],[.23,.66,.44,.95]];
        panels.forEach(([u0,v0,u1,v1],k)=>{rectUV(m(u0),v0,m(u1),v1,color?(k%2?'#DDE4EC':'#EDF1F5'):P.acc2);polyUV([[m(u0),v0],[m(u1),v0],[m(u1),v1],[m(u0),v1]],null,color?'#3A4250':P.seam,Math.max(1,S/256));
          polyUV([[m(u0)+.006*(m(1)-m(0)),v0+.006],[m(u1)-.006*(m(1)-m(0)),v0+.006],[m(u1)-.006*(m(1)-m(0)),v1-.006],[m(u0)+.006*(m(1)-m(0)),v1-.006]],null,color?kmAlpha(acc,.75):P.acc,Math.max(1,S/300));});});
      break;}
    case 'helix':{ // teal/orange helix ribbons winding around the body
      rectUV(.4,0,.6,1,color?kmMix(acc,'#000000',.35):P.dark);
      [[P.acc,0],[P.acc2,.5]].forEach(([col,ph])=>{const pts=[];for(let t=0;t<=1.0001;t+=.02)pts.push([t*2+ph,t]);lineUV(pts,col,S*.05);if(color){const pts2=[];for(let t=0;t<=1.0001;t+=.02)pts2.push([t*2+ph,t]);lineUV(pts2,'rgba(255,255,255,.35)',S*.008);}});
      break;}
  }});
  // ---- Shared coachwork detail: underbody, seams, rivets ----
  rectUV(.455,0,.545,1,P.under);
  g.lineWidth=Math.max(1,S/300);
  for(const v of [.1,.42,.58,.9])lineUV([[0,v],[1,v]],P.seam,g.lineWidth);
  wrap(()=>mirror(m=>{lineUV([[m(.11),0],[m(.11),1]],P.seam,g.lineWidth);lineUV([[m(.39),0],[m(.39),1]],P.seam,g.lineWidth);lineUV([[m(.05),.19],[m(.45),.22]],P.seam,g.lineWidth);lineUV([[m(.05),.81],[m(.45),.78]],P.seam,g.lineWidth);
    for(let k=0;k<20;k++){const v=.025+k*.05;for(const u of [.115,.385]){dot(m(u),v,S*.0055,P.rivet);if(color)dot(m(u)-(m(1)-m(0))*.0018,v+.0018,S*.002,P.rivetHi);}}}));
  // ---- Division mark, racing number, code and sponsor text on both flanks ----
  let mark=null;if(color&&typeof texMark==='function'){try{mark=texMark(div.mark,acc,acc2,Math.min(256,S/2));}catch(e){mark=null;}}
  const ms=S*.15,font=(w,px,mono)=>`${w} ${px}px ${mono?'"JetBrains Mono",monospace':'"Space Grotesk",system-ui,sans-serif'}`;
  g.textAlign='center';g.textBaseline='middle';
  for(const side of [1,-1]){ // right flank reads forward; left flank is the mirror of that frame
    const cx=X(side>0?.25:.75),cy=Y(.5);g.save();g.setTransform(0,side,side,0,cx,cy);
    g.fillStyle=P.badge;g.beginPath();g.arc(0,0,ms*.6,0,Math.PI*2);g.fill();g.strokeStyle=P.ring;g.lineWidth=Math.max(1,S/200);g.stroke();
    if(mark)g.drawImage(mark,-ms/2,-ms/2,ms,ms);else if(color){g.fillStyle=acc;g.beginPath();g.arc(0,0,ms*.3,0,Math.PI*2);g.fill();}
    g.fillStyle=color?acc:P.text;g.font=font(800,S*.11);g.fillText(number,S*.19,0);
    if(color){g.strokeStyle=P.text;g.lineWidth=Math.max(1,S/400);g.strokeText?g.strokeText(number,S*.19,0):0;}
    g.fillStyle=P.text;g.font=font(700,S*.03,true);g.fillText(div.code,-S*.17,-S*.02);
    g.font=font(600,S*.019);g.fillText('COLLECTIVE AI',-S*.17,S*.02);g.fillText('COLLECTIVE AI',S*.19,S*.07);
    g.restore();
  }
  // Nose top: number and code read correctly from the chase camera (upside-down in canvas space).
  for(const dx of [0,W]){g.save();g.setTransform(1,0,0,-1,dx,Y(.58));g.fillStyle=P.text;g.font=font(800,S*.085);g.fillText(number,0,0);g.font=font(700,S*.026,true);g.fillText(div.code,0,-S*.075);g.restore();}
  if(color)kmFleck(g,W,H,.04);
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
  g.strokeStyle=em?'rgba(255,255,255,.55)':'#B9B9B9';g.lineWidth=Math.max(1,S/170);
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
  const white=new THREE.MeshPhysicalMaterial({color:T.livery?0xffffff:0xeaf5ff,map:T.livery,roughnessMap:T.liveryRough,roughness:T.liveryRough?1:.2,normalMap:T.liveryNormal,normalScale:v2(.55),metalness:.08,clearcoat:1,clearcoatRoughness:.12,side});
  const dark=new THREE.MeshStandardMaterial({color:T.carbon?0xffffff:0x142943,map:T.carbon,normalMap:T.carbonNormal,normalScale:v2(.5),metalness:.15,roughness:.35,side});
  const panel=new THREE.MeshPhysicalMaterial({color:color.clone(),map:T.panel,emissive:color,emissiveMap:T.panelEm,emissiveIntensity:T.panelEm?.5:.15,roughness:.2,metalness:.25,clearcoat:1,side});
  const glow=new THREE.MeshStandardMaterial({color:light,emissive:light,emissiveMap:T.glowEm,emissiveIntensity:1.7,roughness:.2,side});
  const skin=new THREE.MeshPhysicalMaterial({color,emissive:color,emissiveMap:T.skinEm,emissiveIntensity:T.skinEm?.5:.18,roughness:.18,metalness:.3,clearcoat:1,transparent:true,opacity:.91,depthWrite:true,side});
  const metal=new THREE.MeshPhysicalMaterial({color:metalTint,map:T.metal,roughnessMap:T.metalRough,metalness:.85,roughness:T.metalRough?1:.22,clearcoat:1});
  const tyre=new THREE.MeshStandardMaterial({color:T.tyre?0xffffff:0x1c1d20,map:T.tyre,normalMap:T.tyreNormal,normalScale:v2(.8),roughness:.85,metalness:0});
  return {white,dark,panel,glow,skin,metal,tyre,color,light};
}
