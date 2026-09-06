'use strict';
/* =========================================================
   ZENFLOW RACER — Collective AI Inc.
   Modular Three.js kart racer. Authored track, authored karts,
   procedural textures, procedural audio. No external assets.
   ========================================================= */

// ---------- Roster: division identity with reference-driven racing liveries ----------
const ROSTER = [
  {id:'zenflow',   name:'ZenFlow',        role:'Central Nervous System', code:'ZF-01', acc:'#20CFF5', acc2:'#AEF8FF', base:'#050810', stats:[4,4,4,3], mark:'lattice'},
  {id:'collective',name:'The Collective', role:'Revenue Engine',         code:'TC-01', acc:'#065F46', acc2:'#B45309', base:'#0B0F1C', stats:[3,4,5,2], mark:'arc'},
  {id:'hybrid',    name:'Hybrid Living',  role:'Education Platform',     code:'HL-01', acc:'#0EA5E9', acc2:'#FB923C', base:'#0B1120', stats:[3,5,4,2], mark:'crest'},
  {id:'nexus',     name:'Nexus Labs',     role:'Storyteller',            code:'NL-01', acc:'#FF9E32', acc2:'#FFE3A6', base:'#080A10', stats:[5,3,3,3], mark:'compass'},
  {id:'kinetic',   name:'Kinetic Edge',   role:'Human Performance',      code:'KE-01', acc:'#16A34A', acc2:'#F5F5F5', base:'#0A0F0A', stats:[4,5,3,3], mark:'poly'},
  {id:'juris',     name:'Juris Guard',    role:'AI Governance',          code:'JG-01', acc:'#C9A84C', acc2:'#8A9BB0', base:'#1C2333', stats:[3,2,5,5], mark:'shield'},
  {id:'signal',    name:'Signal Velocity',role:'Growth Intelligence',    code:'SV-01', acc:'#F43F5E', acc2:'#F5F5F5', base:'#08090F', stats:[5,4,2,2], mark:'arrow'},
  {id:'loom',      name:'Binary Loom',    role:'Digital Infrastructure', code:'BL-01', acc:'#B869F3', acc2:'#F2D6FF', base:'#050505', stats:[4,3,4,3], mark:'hex'},
  {id:'vector',    name:'Vector Shift',   role:'Autonomous Logistics',   code:'VS-01', acc:'#CBD5E1', acc2:'#0A1628', base:'#0A1628', stats:[5,2,3,4], mark:'eagle'},
  {id:'aether',    name:'Aether Link',    role:'Connectivity',           code:'AL-01', acc:'#B5451B', acc2:'#F0E6D3', base:'#1A0A05', stats:[3,4,4,3], mark:'orbit'},
  {id:'animus',    name:'Animus Prime',   role:'Robotics',               code:'AP-01', acc:'#22D3EE', acc2:'#F5F5F5', base:'#0C1018', stats:[4,3,3,5], mark:'bolt'},
  {id:'helix',     name:'Vital Helix',    role:'Health Intelligence',    code:'VH-01', acc:'#14B8A6', acc2:'#F97316', base:'#061414', stats:[3,4,5,2], mark:'helix'},
];
const STAT_NAMES = ['Speed','Accel','Handling','Weight'];

// ---------- Small utils ----------
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, smooth=(t)=>t*t*(3-2*t);
const wrap01=v=>((v%1)+1)%1;
const ordinal=n=>{const s=['th','st','nd','rd'],v=n%100;return s[(v-20)%10]||s[v]||s[0];};
function hash2(x,y){let h=x*374761393+y*668265263;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967295;}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=smooth(xf),v=smooth(yf);
  return lerp(lerp(hash2(xi,yi),hash2(xi+1,yi),u),lerp(hash2(xi,yi+1),hash2(xi+1,yi+1),u),v);}
function fbm(x,y,o=4){let a=0,s=1,n=0;for(let i=0;i<o;i++){a+=vnoise(x,y)*s;n+=s;x*=2.03;y*=2.11;s*=.5;}return a/n;}
function mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const rng=mulberry(20260904);
function hexToRgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}

// ---------- Procedural texture factory (canvas -> THREE.Texture) ----------
const TEX = {};
function mkCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function toTex(c,rep=true,srgb=true){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=rep?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t;}

function texAsphalt(){
  const s=512,c=mkCanvas(s,s),g=c.getContext('2d'),img=g.createImageData(s,s),d=img.data;
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){
    const n=fbm(x/38,y/38,4), f=hash2(x*7,y*11), crack=Math.pow(Math.abs(fbm(x/90,y/90,3)-0.5)*2,6);
    let v=36+n*24+f*14-crack*40; v=clamp(v,14,80);
    const i=(y*s+x)*4; d[i]=v*0.96; d[i+1]=v; d[i+2]=v*1.08; d[i+3]=255;}
  g.putImageData(img,0,0);
  // subtle tire-wear lanes
  g.globalAlpha=.16;g.fillStyle='#000';g.fillRect(s*.28,0,s*.09,s);g.fillRect(s*.63,0,s*.09,s);g.globalAlpha=1;
  const t=toTex(c);t.repeat.set(1,1);return t;
}
function texAsphaltRough(){
  const s=256,c=mkCanvas(s,s),g=c.getContext('2d'),img=g.createImageData(s,s),d=img.data;
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){const v=170+fbm(x/20,y/20,3)*60+hash2(x,y)*20;const i=(y*s+x)*4;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}
  g.putImageData(img,0,0);return toTex(c,true,false);
}
function texCurb(){
  const w=256,h=64,c=mkCanvas(w,h),g=c.getContext('2d');
  for(let i=0;i<4;i++){g.fillStyle=i%2?'#E9EEF5':'#C4232E';g.fillRect(i*64,0,64,h);}
  // grime + edge shading
  const img=g.getImageData(0,0,w,h),d=img.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,n=0.72+fbm(x/14,y/14,3)*.38,e=y<6||y>h-6?.72:1;d[i]*=n*e;d[i+1]*=n*e;d[i+2]*=n*e;}
  g.putImageData(img,0,0);return toTex(c);
}
function texChecker(cols=4,a='#F8FAFC',b='#0A0F1E'){
  const s=128,c=mkCanvas(s,s),g=c.getContext('2d'),q=s/cols;
  for(let y=0;y<cols;y++)for(let x=0;x<cols;x++){g.fillStyle=(x+y)%2?a:b;g.fillRect(x*q,y*q,q,q);}
  return toTex(c);
}
function texRailGlow(){ // glowing checker rail (emissive map) — teal/white on navy
  const w=256,h=64,c=mkCanvas(w,h),g=c.getContext('2d');
  for(let i=0;i<8;i++){const gr=g.createLinearGradient(0,0,0,h);if(i%2){gr.addColorStop(0,'#0AFFE4');gr.addColorStop(1,'#00A88C');}else{gr.addColorStop(0,'#0D1326');gr.addColorStop(1,'#050A18');}g.fillStyle=gr;g.fillRect(i*32,0,32,h);}
  g.fillStyle='rgba(255,255,255,.55)';g.fillRect(0,0,w,3);g.fillRect(0,h-3,w,3);
  return toTex(c);
}
function texGrass(){
  const s=512,c=mkCanvas(s,s),g=c.getContext('2d'),img=g.createImageData(s,s),d=img.data;
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){
    const n=fbm(x/26,y/26,4),m=fbm(x/110+9,y/110+3,3),f=hash2(x*3,y*5);
    const i=(y*s+x)*4; const r=30+n*26+m*14, gg=52+n*40+f*14+m*16, b=30+n*18+m*10;
    d[i]=r;d[i+1]=gg;d[i+2]=b;d[i+3]=255;}
  g.putImageData(img,0,0);return toTex(c);
}
function texDirt(){
  const s=256,c=mkCanvas(s,s),g=c.getContext('2d'),img=g.createImageData(s,s),d=img.data;
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){const n=fbm(x/22,y/22,4),f=hash2(x,y);const i=(y*s+x)*4;d[i]=78+n*40+f*10;d[i+1]=62+n*30;d[i+2]=44+n*18;d[i+3]=255;}
  g.putImageData(img,0,0);return toTex(c);
}
function texCrowd(){
  const w=512,h=128,c=mkCanvas(w,h),g=c.getContext('2d');
  g.fillStyle='#0d1326';g.fillRect(0,0,w,h);
  const pal=['#D4A843','#F5F5F5','#00D9B5','#DC2626','#8B9BAE','#7C3AED','#F97316','#0EA5E9'];
  for(let r=0;r<4;r++)for(let i=0;i<48;i++){
    const x=i*10.6+(r%2)*5+rng()*3,y=r*32+8+rng()*4,col=pal[Math.floor(rng()*pal.length)];
    g.fillStyle='#1a1410';g.beginPath();g.ellipse(x+5,y+4,3.6,3.6,0,0,7);g.fill(); // head
    g.fillStyle=col;g.beginPath();g.moveTo(x,y+30);g.quadraticCurveTo(x+5,y+2,x+10,y+30);g.fill(); // body
  }
  return toTex(c);
}
function texBanner(text,acc='#D4A843',sub='COLLECTIVE AI'){
  const w=1024,h=256,c=mkCanvas(w,h),g=c.getContext('2d');
  g.fillStyle='#0A0F1E';g.fillRect(0,0,w,h);
  g.strokeStyle='rgba(212,168,67,.25)';g.lineWidth=2;for(let i=0;i<w;i+=64){g.beginPath();g.moveTo(i,0);g.lineTo(i+40,h);g.stroke();}
  g.fillStyle=acc;g.fillRect(0,0,w,10);g.fillRect(0,h-10,w,10);
  g.font='800 120px "Space Grotesk",system-ui,sans-serif';g.fillStyle='#F5F5F5';g.textAlign='center';g.textBaseline='middle';g.fillText(text,w/2,h/2-14);
  g.font='500 34px "JetBrains Mono",monospace';g.fillStyle=acc;g.fillText(sub,w/2,h/2+78);
  // diamond star marks
  g.fillStyle=acc;[60,w-60].forEach(x=>{g.beginPath();g.moveTo(x,h/2-40);g.lineTo(x+12,h/2);g.lineTo(x,h/2+40);g.lineTo(x-12,h/2);g.closePath();g.fill();});
  return toTex(c,false);
}
function texWindows(){
  const w=256,h=512,c=mkCanvas(w,h),g=c.getContext('2d');
  g.fillStyle='#0b1020';g.fillRect(0,0,w,h);
  for(let y=8;y<h;y+=22)for(let x=8;x<w;x+=18){const lit=rng()<.62;g.fillStyle=lit?(rng()<.8?'#D4A843':'#00D9B5'):'#141a2c';g.globalAlpha=lit?.55+rng()*.45:1;g.fillRect(x,y,10,14);}
  g.globalAlpha=1;return toTex(c);
}
function texTread(){
  const w=128,h=128,c=mkCanvas(w,h),g=c.getContext('2d');
  g.fillStyle='#16171a';g.fillRect(0,0,w,h);g.fillStyle='#2a2c30';
  for(let y=0;y<h;y+=16){g.fillRect(0,y,w,6);g.fillRect(24,y+8,14,6);g.fillRect(72,y+8,14,6);}
  return toTex(c,true,false);
}
function texMark(mark,acc,acc2,size=256){ // division logo mark, drawn abstractly
  const c=mkCanvas(size,size),g=c.getContext('2d'),s=size,cx=s/2,cy=s/2;
  g.fillStyle=acc;g.strokeStyle=acc;g.lineWidth=s*.06;g.lineCap='round';g.lineJoin='round';
  const R=s*.34;
  switch(mark){
    case 'lattice':{const pts=[];for(let i=0;i<6;i++){const a=i/6*Math.PI*2;pts.push([cx+Math.cos(a)*R,cy+Math.sin(a)*R]);}
      g.lineWidth=s*.03;g.beginPath();for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){g.moveTo(pts[i][0],pts[i][1]);g.lineTo(pts[j][0],pts[j][1]);}g.stroke();
      pts.forEach(p=>{g.beginPath();g.arc(p[0],p[1],s*.06,0,7);g.fill();});g.fillStyle=acc2;g.beginPath();g.arc(cx,cy,s*.08,0,7);g.fill();break;}
    case 'arc':{g.beginPath();g.arc(cx,cy,R,Math.PI*.25,Math.PI*1.75);g.stroke();g.fillStyle=acc2;g.beginPath();g.moveTo(cx-R*.5,cy+R*.5);g.lineTo(cx,cy);g.lineTo(cx+R*.3,cy+R*.25);g.lineTo(cx+R*.75,cy-R*.4);g.lineTo(cx+R*.75,cy-R*.2);g.lineTo(cx+R*.62,cy-R*.4);g.stroke();break;}
    case 'crest':{g.beginPath();g.moveTo(cx,cy-R);g.lineTo(cx+R,cy-R*.5);g.lineTo(cx+R*.8,cy+R*.4);g.lineTo(cx,cy+R);g.lineTo(cx-R*.8,cy+R*.4);g.lineTo(cx-R,cy-R*.5);g.closePath();g.fill();g.fillStyle=acc2;g.font=`800 ${s*.34}px "Space Grotesk",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText('HL',cx,cy+s*.02);break;}
    case 'compass':{g.beginPath();g.arc(cx,cy,R,0,7);g.stroke();g.fillStyle=acc2;for(let i=0;i<4;i++){const a=i*Math.PI/2;g.beginPath();g.moveTo(cx+Math.cos(a)*R*.85,cy+Math.sin(a)*R*.85);g.lineTo(cx+Math.cos(a+1.2)*R*.18,cy+Math.sin(a+1.2)*R*.18);g.lineTo(cx+Math.cos(a-1.2)*R*.18,cy+Math.sin(a-1.2)*R*.18);g.closePath();g.fill();}break;}
    case 'poly':{const pts=[];for(let i=0;i<7;i++){const a=i/7*Math.PI*2-1.2;const rr=R*(0.55+hash2(i,3)*.45);pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);}g.lineWidth=s*.035;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.stroke();g.beginPath();g.moveTo(pts[0][0],pts[0][1]);g.lineTo(pts[3][0],pts[3][1]);g.lineTo(pts[5][0],pts[5][1]);g.stroke();pts.forEach(p=>{g.beginPath();g.arc(p[0],p[1],s*.035,0,7);g.fill();});break;}
    case 'shield':{g.beginPath();g.moveTo(cx-R,cy-R*.7);g.lineTo(cx+R,cy-R*.7);g.lineTo(cx+R*.9,cy+R*.2);g.quadraticCurveTo(cx,cy+R*1.1,cx-R*.9,cy+R*.2);g.closePath();g.fill();g.fillStyle=acc2;g.beginPath();g.arc(cx-R*.3,cy-R*.15,s*.07,0,7);g.arc(cx+R*.3,cy-R*.15,s*.07,0,7);g.fill();g.fillStyle='#1C2333';g.beginPath();g.arc(cx-R*.3,cy-R*.15,s*.03,0,7);g.arc(cx+R*.3,cy-R*.15,s*.03,0,7);g.fill();break;}
    case 'arrow':{g.beginPath();g.moveTo(cx-R,cy+R*.6);g.lineTo(cx+R*.2,cy+R*.6);g.lineTo(cx+R*.2,cy+R);g.lineTo(cx+R,cy);g.lineTo(cx+R*.2,cy-R);g.lineTo(cx+R*.2,cy-R*.6);g.lineTo(cx-R,cy-R*.6);g.closePath();g.fill();g.strokeStyle=acc2;g.lineWidth=s*.035;g.beginPath();g.moveTo(cx-R*.9,cy);for(let x=-R*.9;x<R*.1;x+=8)g.lineTo(cx+x,cy+Math.sin(x*.12)*R*.25);g.stroke();break;}
    case 'hex':{g.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2+Math.PI/6;const x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R;i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();g.stroke();g.fillStyle=acc2;g.font=`700 ${s*.22}px "JetBrains Mono",monospace`;g.textAlign='center';g.textBaseline='middle';g.fillText('</>',cx,cy+s*.01);break;}
    case 'eagle':{g.beginPath();g.moveTo(cx,cy+R*.2);g.quadraticCurveTo(cx-R*.5,cy-R*.9,cx-R*1.05,cy-R*.3);g.quadraticCurveTo(cx-R*.55,cy-R*.35,cx-R*.25,cy+R*.1);g.lineTo(cx,cy+R*.7);g.lineTo(cx+R*.25,cy+R*.1);g.quadraticCurveTo(cx+R*.55,cy-R*.35,cx+R*1.05,cy-R*.3);g.quadraticCurveTo(cx+R*.5,cy-R*.9,cx,cy+R*.2);g.fill();break;}
    case 'orbit':{g.beginPath();g.arc(cx,cy,R*.42,0,7);g.fill();g.lineWidth=s*.035;g.beginPath();g.ellipse(cx,cy,R*1.05,R*.4,-.5,0,7);g.stroke();g.fillStyle=acc2;g.beginPath();g.arc(cx+R*.8,cy-R*.35,s*.05,0,7);g.fill();break;}
    case 'bolt':{g.beginPath();g.moveTo(cx+R*.15,cy-R);g.lineTo(cx-R*.55,cy+R*.15);g.lineTo(cx-R*.05,cy+R*.15);g.lineTo(cx-R*.2,cy+R);g.lineTo(cx+R*.6,cy-R*.2);g.lineTo(cx+R*.1,cy-R*.2);g.closePath();g.fill();g.strokeStyle=acc2;g.lineWidth=s*.025;g.beginPath();g.moveTo(cx-R*1.05,cy);g.lineTo(cx-R*.7,cy);g.moveTo(cx+R*.7,cy);g.lineTo(cx+R*1.05,cy);g.stroke();break;}
    case 'helix':{g.lineWidth=s*.05;for(let k=0;k<2;k++){g.strokeStyle=k?acc2:acc;g.beginPath();for(let y=-R;y<=R;y+=4){const x=Math.sin((y/R)*Math.PI*1.5+k*Math.PI)*R*.55;y===-R?g.moveTo(cx+x,cy+y):g.lineTo(cx+x,cy+y);}g.stroke();}g.strokeStyle=acc;g.lineWidth=s*.02;for(let y=-R*.8;y<=R*.8;y+=R*.32){const x=Math.sin((y/R)*Math.PI*1.5)*R*.55;g.beginPath();g.moveTo(cx+x,cy+y);g.lineTo(cx-x,cy+y);g.stroke();}break;}
  }
  // parent diamond star, bottom-right — signals Collective AI parentage
  g.fillStyle='#D4A843';const dx=s*.86,dy=s*.86,dr=s*.05;g.beginPath();g.moveTo(dx,dy-dr);g.lineTo(dx+dr*.35,dy);g.lineTo(dx,dy+dr);g.lineTo(dx-dr*.35,dy);g.closePath();g.fill();
  return c;
}
function texSparkle(){ // additive particle sprite
  const s=64,c=mkCanvas(s,s),g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.7)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);return toTex(c,false);
}
function texFinishLine(){const c=mkCanvas(256,64),g=c.getContext('2d');for(let y=0;y<2;y++)for(let x=0;x<8;x++){g.fillStyle=(x+y)%2?'#F5F5F5':'#0A0F1E';g.fillRect(x*32,y*32,32,32);}return toTex(c);}
function texSkyStars(){const s=1024,c=mkCanvas(s,s/2),g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,s,s/2);for(let i=0;i<900;i++){const x=rng()*s,y=rng()*s/2,r=rng()<.9?.7:1.6;g.fillStyle=`rgba(${220+rng()*35},${220+rng()*35},255,${.25+rng()*.75})`;g.beginPath();g.arc(x,y,r,0,7);g.fill();}return toTex(c,false);}
function texHexPanel(){const s=256,c=mkCanvas(s,s),g=c.getContext('2d');g.fillStyle='#0d1326';g.fillRect(0,0,s,s);g.strokeStyle='rgba(212,168,67,.35)';g.lineWidth=2;const r=22;for(let y=0;y<s+r;y+=r*1.5)for(let x=0;x<s+r;x+=r*1.732){const ox=((y/(r*1.5))%2)*r*.866;g.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2+Math.PI/6;const px=x+ox+Math.cos(a)*r*.9,py=y+Math.sin(a)*r*.9;i?g.lineTo(px,py):g.moveTo(px,py);}g.closePath();g.stroke();}return toTex(c);}
function buildTextures(){
  TEX.asphalt=texAsphalt();TEX.asphaltR=texAsphaltRough();TEX.curb=texCurb();TEX.rail=texRailGlow();TEX.grass=texGrass();TEX.dirt=texDirt();
  TEX.crowd=texCrowd();TEX.windows=texWindows();TEX.tread=texTread();TEX.spark=texSparkle();TEX.finish=texFinishLine();TEX.stars=texSkyStars();TEX.hex=texHexPanel();
  TEX.checker=texChecker();TEX.bannerMain=texBanner('ZENFLOW RACER','#D4A843','SYNERGY CIRCUIT · COLUMBUS');TEX.bannerZF=texBanner('ZENITH OS','#7C3AED','WHERE AGENTS ARE BORN');TEX.bannerNL=texBanner('NEXUS LABS','#DC2626','THE STORYTELLER');TEX.bannerAG=texBanner('AEGIS PROTOCOL','#00D9B5','ETHICAL AI, BY ARCHITECTURE');
  TEX.grass.repeat.set(60,60);TEX.dirt.repeat.set(1,8);
}
