'use strict';
/* Power impact kit: the shared staging every signature power, add-on and hit lands through.
 *
 *  cast(r,color)        anticipation (energy converges on the kart), release (flare, colour
 *                       halo, ground shockwave, scorch, streak sparks, light pulse), embers.
 *  impact(target,color) contact flash, spark fountain, shock ring and light for a landed hit.
 *  sustain(key,follow)  a pooled light that rides an active field or buff and lights the road.
 *
 * Readability on every map is a design rule, not an afterthought: additive flares and sparks
 * carry the dark circuits, while the colour halo and ground decals are drawn with normal
 * blending in saturated colour so the same cast still reads on Cherry Blossom's pale road.
 *
 *  blast(at,color,r)   area detonation sized to the gameplay radius; telegraph(at,color,r,t) arm pulses.
 *
 * Budgets are fixed at init: one Points, one LineSegments, one sprite pool, a decal pool and a
 * light pool that never changes size (adding lights mid-race would recompile every shader).
 * Everything is presentation only and a no-op in stub/test contexts.
 */
const powerVFX=(()=>{
 let S=null;
 const low=()=>(typeof MOBILEFX!=='undefined'&&!!MOBILEFX)||(typeof LOWFX!=='undefined'&&!!LOWFX)||(typeof powerLow!=='undefined'&&!!powerLow);
 const reduced=()=>typeof powerReduced!=='undefined'&&!!powerReduced;
 function hostOK(){return typeof THREE!=='undefined'&&typeof THREE.Points==='function'&&typeof THREE.LineSegments==='function'&&typeof THREE.PointLight==='function'&&typeof scene!=='undefined'&&scene&&typeof scene.add==='function'&&typeof document!=='undefined';}
 function glowTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext&&c.getContext('2d');if(!g)return null;
  const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.16,'rgba(255,255,255,.9)');gr.addColorStop(.42,'rgba(255,255,255,.32)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
 }
 // Ground decal: kind 0 = expanding shock ring, 1 = scorch that cools from its accent to soot,
 // 2 = telegraph: a solid footprint rim with pulses converging on the centre until the hazard arms.
 const DECAL_VERT=`varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const DECAL_FRAG=`uniform vec3 color;uniform float t;uniform float kind;uniform float alpha;uniform float seed;uniform float beats;varying vec2 vP;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){float r=length(vP),ang=atan(vP.y,vP.x);float wob=n(vec2(ang*3.,t*4.))*.08;
 if(kind<.5){float front=t,band=smoothstep(.16,0.,abs(r-front-wob))*(1.-t);float inner=smoothstep(front,front*.4,r)*(1.-t)*.35;float a=(band+inner)*alpha;if(r>1.)discard;
  vec3 c=mix(color,vec3(1.),band*.55);gl_FragColor=vec4(c,a);}
 else if(kind>1.5){if(r>1.02)discard;float ph=fract(t*beats),front=1.-ph,band=smoothstep(.08,0.,abs(r-front-wob*.5))*(.3+.7*ph);float rim=smoothstep(.045,0.,abs(r-.965));float fill=smoothstep(1.,.2,r)*.1;
  gl_FragColor=vec4(mix(color,vec3(1.),band*.45),(band+rim*.9+fill)*alpha*(1.-t*t*t));}
 else{float edge=smoothstep(1.,.55,r+n(vP*5.)*.25);float soot=edge*(.55+.45*n(vP*9.));float glow=smoothstep(.5,0.,abs(r-.62+n(vP*7.)*.12))*(1.-t);
  vec3 c=mix(color*.22,color*1.2,glow);gl_FragColor=vec4(c,(soot*.6+glow*.8)*alpha*(1.-t*t));}}`;
 function init(){
  if(S||!hostOK())return;
  const lo=low(),cap=lo?260:640,streakCap=lo?140:320,spriteCap=lo?14:28,decalCap=lo?8:16,lightCap=lo?1:3;
  const tex=glowTexture();
  S={t:0,events:[],sustains:new Map(),v:new THREE.Vector3(),w:new THREE.Vector3(),c:new THREE.Color(),lo};
  // Motes: soft additive glow points (converging charge, embers).
  const mp=new Float32Array(cap*3),mc=new Float32Array(cap*3),ms=new Float32Array(cap);
  const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.BufferAttribute(mp,3));mg.setAttribute('color',new THREE.BufferAttribute(mc,3));mg.setAttribute('size',new THREE.BufferAttribute(ms,1));
  const mm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{map:{value:tex}},
   vertexShader:`attribute float size;varying vec3 vC;void main(){vC=color;vec4 v=modelViewMatrix*vec4(position,1.);gl_PointSize=size*300./max(1.,-v.z);gl_Position=projectionMatrix*v;}`,
   fragmentShader:`uniform sampler2D map;varying vec3 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC*t.a*2.4,t.a);}`});
  S.motes={mesh:new THREE.Points(mg,mm),cap,p:new Float32Array(cap*3),vel:new Float32Array(cap*3),col:new Float32Array(cap*3),life:new Float32Array(cap),max:new Float32Array(cap),size:new Float32Array(cap),drag:new Float32Array(cap),grav:new Float32Array(cap),next:0};
  S.motes.mesh.frustumCulled=false;S.motes.mesh.renderOrder=1200;S.motes.mesh.name='power-vfx-motes';
  // Streak sparks: velocity-stretched line segments with a hot head fading to the accent tail.
  const sp=new Float32Array(streakCap*6),sc=new Float32Array(streakCap*6);
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));sg.setAttribute('color',new THREE.BufferAttribute(sc,3));
  const sm=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  S.streaks={mesh:new THREE.LineSegments(sg,sm),cap:streakCap,p:new Float32Array(streakCap*3),vel:new Float32Array(streakCap*3),col:new Float32Array(streakCap*3),life:new Float32Array(streakCap),max:new Float32Array(streakCap),next:0};
  S.streaks.mesh.frustumCulled=false;S.streaks.mesh.renderOrder=1201;S.streaks.mesh.name='power-vfx-streaks';
  // Sprites: additive flares for heat, normal-blended halos for colour on bright maps.
  S.sprites=[];
  for(let i=0;i<spriteCap;i++){const additive=i%2===0;const m=new THREE.SpriteMaterial({map:tex,color:0xffffff,transparent:true,depthWrite:false,opacity:0,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
   const s=new THREE.Sprite(m);s.visible=false;s.renderOrder=additive?1203:1202;s.name='power-vfx-flare';S.sprites.push({s,additive,life:0,max:1,from:1,to:1,alpha:1,follow:null});}
  // Ground decals.
  const plane=new THREE.PlaneGeometry(2,2);S.decals=[];
  for(let i=0;i<decalCap;i++){const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,uniforms:{color:{value:new THREE.Color()},t:{value:0},kind:{value:0},alpha:{value:1},seed:{value:i*7.3},beats:{value:1}},vertexShader:DECAL_VERT,fragmentShader:DECAL_FRAG});
   const g=new THREE.Group(),mesh=new THREE.Mesh(plane,m);mesh.rotation.x=-Math.PI/2;g.add(mesh);g.visible=false;g.renderOrder=1150;mesh.renderOrder=1150;g.name='power-vfx-decal';S.decals.push({g,mesh,life:0,max:1,radius:1,grow:0,u:0,lat:0});}
  // Fixed light pool, parked dark until needed.
  S.lights=[];for(let i=0;i<lightCap;i++){const l=new THREE.PointLight(0xffffff,0,16,2);l.name='power-vfx-light';l.userData.dynamic=true;S.lights.push({l,life:0,max:1,peak:0,key:null,follow:null});}
  attach();
 }
 function attach(){if(!S)return;const add=o=>{if(o.parent!==scene)scene.add(o);};add(S.motes.mesh);add(S.streaks.mesh);S.sprites.forEach(x=>add(x.s));S.decals.forEach(x=>add(x.g));S.lights.forEach(x=>add(x.l));}
 function racerPos(r,h,out){if(r&&r.mesh&&r.mesh.position){out.copy(r.mesh.position);if(typeof trackUp==='function'&&typeof r.u==='number'){trackUp(r.u,S.w);out.addScaledVector(S.w,h);}else out.y+=h;return out;}
  if(r&&typeof r.u==='number'&&typeof trackPoint==='function')return trackPoint(r.u,r.lat||0,h,out);return out.set(0,h,0);}
 function mote(x,y,z,vx,vy,vz,color,life,size,drag=1.5,grav=0){const M=S.motes,i=M.next;M.next=(i+1)%M.cap;
  M.p.set([x,y,z],i*3);M.vel.set([vx,vy,vz],i*3);M.col.set([color.r,color.g,color.b],i*3);M.life[i]=M.max[i]=life;M.size[i]=size;M.drag[i]=drag;M.grav[i]=grav;}
 function streak(x,y,z,vx,vy,vz,color,life){const T=S.streaks,i=T.next;T.next=(i+1)%T.cap;T.p.set([x,y,z],i*3);T.vel.set([vx,vy,vz],i*3);T.col.set([color.r,color.g,color.b],i*3);T.life[i]=T.max[i]=life;}
 function sprite(pos,color,additive,from,to,life,alpha=1,follow=null){
  let best=null;for(const x of S.sprites)if(x.additive===additive&&(!best||x.life<best.life))best=x;if(!best)return;
  best.s.position.copy(pos);best.s.material.color.copy(color);best.life=best.max=life;best.from=from;best.to=to;best.alpha=alpha;best.follow=follow;best.s.visible=true;
 }
 function decal(u,lat,color,kind,radius,life,grow=0){
  let best=null;for(const x of S.decals)if(!best||x.life<best.life)best=x;if(!best||typeof orientOnTrack!=='function')return;
  best.u=u;best.lat=lat;best.life=best.max=life;best.radius=radius;best.grow=grow;best.kind=kind;
  const m=best.mesh.material.uniforms;m.color.value.copy(color);m.kind.value=kind;m.t.value=0;m.alpha.value=kind===1?.85:1;m.beats.value=Math.max(1,Math.round(life*2.4));
  orientOnTrack(best.g,u,lat,.06,0);best.g.scale.setScalar(kind?radius:.01);best.g.visible=true;
 }
 function light(pos,color,peak,life,range=16,key=null,follow=null){
  let slot=key?S.lights.find(x=>x.key===key):null;
  if(!slot){slot=S.lights.reduce((a,b)=>(a.life*a.peak<=b.life*b.peak?a:b));}
  slot.l.position.copy(pos);slot.l.color.copy(color);slot.l.distance=range;slot.peak=peak;slot.life=slot.max=life;slot.key=key;slot.follow=follow;
 }
 // Pale division colours are deepened for halos and decals so they read on pale roads.
 const toColor=c=>{const col=S.c.clone().set(c),hsl={};col.getHSL(hsl);return col.setHSL(hsl.h,Math.min(1,hsl.s*1.25+.1),Math.min(hsl.l,.58));};
 function whiteHot(color,k){return color.clone().lerp(new THREE.Color(1,1,1),k);}
 // ---- choreography ------------------------------------------------------------------------
 function cast(r,color,opts={}){
  if(!S||!r)return;attach();const col=toColor(color),scale=opts.scale||1,p=racerPos(r,.9,new THREE.Vector3());
  // Anticipation: energy streams in from a shell around the kart.
  const n=S.lo?8:18;for(let i=0;i<n;i++){const a=i/n*Math.PI*2,e=(Math.random()-.3)*1.2,R=2.6*scale;
   const x=Math.cos(a)*Math.cos(e)*R,y=Math.sin(e)*R*.6+.4,z=Math.sin(a)*Math.cos(e)*R;mote(p.x+x,p.y+y,p.z+z,-x/.16,-y/.16,-z/.16,whiteHot(col,.35),.16,.55*scale,0,0);}
  sprite(p,whiteHot(col,.5),true,.6*scale,1.6*scale,.16,.8,r);
  S.events.push({at:S.t+(reduced()?0:.12),fn:()=>release(r,col,scale,opts)});
 }
 function release(r,col,scale,opts){
  const p=racerPos(r,.9,new THREE.Vector3()),u=r.u||0,lat=r.lat||0;
  sprite(p,whiteHot(col,.35),true,.8*scale,3.6*scale,.18,.9,r);sprite(p,whiteHot(col,.85),true,.4*scale,1.8*scale,.1,1,r);
  sprite(p,col,false,1.6*scale,5*scale,.34,.55,r);
  decal(u,lat,whiteHot(col,.2),0,6.5*scale,.5);
  if(!opts.noScorch)decal(u,lat,col,1,2.6*scale,2.4);
  const n=S.lo?14:40;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=(14+Math.random()*20)*scale,up=2+Math.random()*9;streak(p.x,p.y-.3,p.z,Math.cos(a)*s,up,Math.sin(a)*s,whiteHot(col,.2+Math.random()*.5),.32+Math.random()*.28);}
  const e=S.lo?6:16;for(let i=0;i<e;i++){const a=Math.random()*Math.PI*2,s=1+Math.random()*3;mote(p.x+Math.cos(a)*1.4,p.y-.4,p.z+Math.sin(a)*1.4,Math.cos(a)*s,2+Math.random()*3,Math.sin(a)*s,col,.9+Math.random()*.7,.35+Math.random()*.3,1.8,-2.5);}
  light(p,col,6*scale,.45,16*scale);
  if(r.isPlayer&&typeof game!=='undefined')game.trauma=Math.min(1,(game.trauma||0)+.12*scale);
 }
 function impact(target,color,strength=1){
  if(!S||!target)return;attach();const col=toColor(color),p=target.isVector3?target.clone():racerPos(target,.8,new THREE.Vector3());
  sprite(p,whiteHot(col,.85),true,.8*strength,4*strength,.2,1);
  sprite(p,col,false,1.4*strength,4.6*strength,.32,.6);
  if(!target.isVector3)decal(target.u||0,target.lat||0,whiteHot(col,.3),0,4.5*strength,.4);
  const n=Math.round((S.lo?12:34)*strength);for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=8+Math.random()*14,up=3+Math.random()*8;streak(p.x,p.y,p.z,Math.cos(a)*s,up,Math.sin(a)*s,whiteHot(col,.3+Math.random()*.6),.22+Math.random()*.2);}
  light(p,col,6*strength,.35,14);
 }
 // Small, cheap confirmation for sustained fields landing on a rival (no light, no decal).
 function touch(target,color){if(!S||!target)return;const col=toColor(color),p=racerPos(target,.9,new THREE.Vector3());sprite(p,whiteHot(col,.6),true,.7,3.2,.22,.85);sprite(p,col,false,1,3,.26,.45);
  for(let i=0;i<(S.lo?4:10);i++){const a=Math.random()*Math.PI*2;streak(p.x,p.y,p.z,Math.cos(a)*8,2+Math.random()*5,Math.sin(a)*8,whiteHot(col,.5),.22);}}
 // Area detonation: the shock front, scorch and spark fan reach the true gameplay radius, and a
 // tall flare column marks the strike from the back of the pack.
 function blast(target,color,radius=5){
  if(!S||!target)return;attach();const col=toColor(color),u=target.u||0,lat=target.lat||0,p=racerPos(target,.6,new THREE.Vector3()),k=Math.max(1,radius/4);
  sprite(p,whiteHot(col,.85),true,1.2*k,radius*1.25,.24,1);sprite(p,col,false,radius*.5,radius*1.35,.4,.6);
  const top=p.clone();if(typeof trackUp==='function'){trackUp(u,S.w);top.addScaledVector(S.w,radius*.6);}else top.y+=radius*.6;sprite(top,whiteHot(col,.5),true,.8*k,radius*.9,.3,.8);
  decal(u,lat,whiteHot(col,.25),0,radius*1.05,.6);decal(u,lat,col,1,radius*.72,3.2);
  const n=Math.round((S.lo?16:46)*Math.min(1.6,k));for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=(10+Math.random()*12)*k,up=4+Math.random()*10;streak(p.x,p.y,p.z,Math.cos(a)*s,up,Math.sin(a)*s,whiteHot(col,.2+Math.random()*.6),.3+Math.random()*.25);}
  const e=S.lo?6:18;for(let i=0;i<e;i++){const a=Math.random()*Math.PI*2,r=Math.random()*radius*.7,s=1+Math.random()*2;mote(p.x+Math.cos(a)*r,p.y,p.z+Math.sin(a)*r,Math.cos(a)*s,2.5+Math.random()*3,Math.sin(a)*s,col,1+Math.random()*.8,.4+Math.random()*.4,1.6,-2.2);}
  light(p,col,8*Math.min(1.5,k),.5,radius*3.2);
 }
 // Telegraph a hazard's footprint for the arm window so it can be read, and dodged, before it bites.
 function telegraph(target,color,radius=3,life=.5){if(!S||!target||typeof target.u!=='number')return;attach();decal(target.u,target.lat||0,toColor(color),2,radius,Math.max(.3,life));}
 function sustain(key,follow,color,intensity=3,range=14){if(!S)return;const p=follow(new THREE.Vector3());if(!p)return;
  const slot=S.lights.find(x=>x.key===key);if(slot){slot.life=Math.max(slot.life,.25);slot.follow=follow;return;}
  // Sustains never evict a fresh cast or impact pulse: they only take a dark or dimmer slot.
  const free=S.lights.find(x=>x.life<=0)||S.lights.find(x=>!x.key&&x.peak*x.life/x.max<intensity*.5);if(!free)return;
  light(p,toColor(color),intensity,.25,range,key,follow);
 }
 function update(dt){
  if(!S||!(dt>0))return;S.t+=dt;
  for(let i=S.events.length-1;i>=0;i--)if(S.events[i].at<=S.t){const e=S.events[i];S.events.splice(i,1);try{e.fn();}catch(err){}}
  const M=S.motes,mp=M.mesh.geometry.attributes.position.array,mc=M.mesh.geometry.attributes.color.array,ms=M.mesh.geometry.attributes.size.array;
  for(let i=0;i<M.cap;i++){const k=i*3;if(M.life[i]<=0){ms[i]=0;continue;}M.life[i]-=dt;const d=Math.exp(-M.drag[i]*dt);
   M.vel[k]*=d;M.vel[k+1]=M.vel[k+1]*d-M.grav[i]*dt;M.vel[k+2]*=d;M.p[k]+=M.vel[k]*dt;M.p[k+1]+=M.vel[k+1]*dt;M.p[k+2]+=M.vel[k+2]*dt;
   const f=Math.max(0,M.life[i]/M.max[i]);mp[k]=M.p[k];mp[k+1]=M.p[k+1];mp[k+2]=M.p[k+2];mc[k]=M.col[k]*f;mc[k+1]=M.col[k+1]*f;mc[k+2]=M.col[k+2]*f;ms[i]=M.size[i]*(.4+.6*f);}
  M.mesh.geometry.attributes.position.needsUpdate=M.mesh.geometry.attributes.color.needsUpdate=M.mesh.geometry.attributes.size.needsUpdate=true;
  const T=S.streaks,tp=T.mesh.geometry.attributes.position.array,tc=T.mesh.geometry.attributes.color.array;
  for(let i=0;i<T.cap;i++){const k=i*3,o=i*6;if(T.life[i]<=0){tp.fill(0,o,o+6);tc.fill(0,o,o+6);continue;}T.life[i]-=dt;const d=Math.exp(-3.2*dt);
   T.vel[k]*=d;T.vel[k+1]=T.vel[k+1]*d-14*dt;T.vel[k+2]*=d;T.p[k]+=T.vel[k]*dt;T.p[k+1]+=T.vel[k+1]*dt;T.p[k+2]+=T.vel[k+2]*dt;
   const f=Math.max(0,T.life[i]/T.max[i]),len=.07;
   tp[o]=T.p[k];tp[o+1]=T.p[k+1];tp[o+2]=T.p[k+2];tp[o+3]=T.p[k]-T.vel[k]*len;tp[o+4]=T.p[k+1]-T.vel[k+1]*len;tp[o+5]=T.p[k+2]-T.vel[k+2]*len;
   const hot=Math.min(1,f*1.6);tc[o]=(T.col[k]+(1-T.col[k])*hot*.6)*f*1.4;tc[o+1]=(T.col[k+1]+(1-T.col[k+1])*hot*.6)*f*1.4;tc[o+2]=(T.col[k+2]+(1-T.col[k+2])*hot*.6)*f*1.4;tc[o+3]=T.col[k]*f*.5;tc[o+4]=T.col[k+1]*f*.5;tc[o+5]=T.col[k+2]*f*.5;}
  T.mesh.geometry.attributes.position.needsUpdate=T.mesh.geometry.attributes.color.needsUpdate=true;
  for(const x of S.sprites){if(x.life<=0){if(x.s.visible)x.s.visible=false;continue;}x.life-=dt;const f=1-Math.max(0,x.life/x.max),ease=1-Math.pow(1-f,3);
   if(x.follow&&x.follow.mesh)racerPos(x.follow,.9,x.s.position);x.s.scale.setScalar(x.from+(x.to-x.from)*ease);x.s.material.opacity=x.alpha*(1-f)*(1-f);}
  for(const x of S.decals){if(x.life<=0){if(x.g.visible)x.g.visible=false;continue;}x.life-=dt;const f=1-Math.max(0,x.life/x.max),m=x.mesh.material.uniforms;
   if(x.kind===0){m.t.value=1-Math.pow(1-f,2.2);x.g.scale.setScalar(Math.max(.01,x.radius));}else{m.t.value=f;}}
  for(const x of S.lights){if(x.life<=0){x.l.intensity=0;x.key=null;x.follow=null;continue;}x.life-=dt;if(x.follow){const p=x.follow(S.v);if(p)x.l.position.copy(p);}
   const f=Math.max(0,x.life/x.max);x.l.intensity=x.key?x.peak*(.85+.15*Math.sin(S.t*23+x.peak)):x.peak*f*f;}
 }
 function clear(){if(!S)return;S.events.length=0;S.sustains.clear();for(const x of S.sprites){x.life=0;x.s.visible=false;}for(const x of S.decals){x.life=0;x.g.visible=false;}for(const x of S.lights){x.life=0;x.l.intensity=0;x.key=null;x.follow=null;}S.motes.life.fill(0);S.streaks.life.fill(0);}
 return {init,update,clear,cast,impact,touch,blast,telegraph,sustain,ready:()=>!!S,get state(){return S;}};
})();
if(typeof module!=='undefined')module.exports=powerVFX;
