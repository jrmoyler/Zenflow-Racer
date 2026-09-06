// ---------- Race presentation FX ----------
// Skid marks, drift ribbons, boost flames, speed lines, impact bursts, pickups, race moments
// and dynamic post-processing hints (raceFX.post, read by postfx.js).
// Pure presentation: never touches race rules. Every hook is safe to call from tests and is a
// no-op before init(), after clear(), or when the host lacks a real Three.js (stub contexts).
// Architecture: one mesh per effect family (11 draw calls total), every buffer preallocated in
// init(), advanced in update() with zero per-frame allocation, and torn down by clear().
const raceFX=(()=>{
  const TAU=Math.PI*2;
  const TIER_COLORS=[0x66aaff,0x66aaff,0xffa040,0xff5fd0]; // matches sparksBlue/Orange/Pink pools
  const BOOST_COLOR=0x00d9b5,SHIELD_COLOR=0x00d9b5,GOLD=0xffd77a,HOT=0xff7a3a,DUST=0xb9a98a,SMOKE=0x6f7684;
  const HUD_CLASSES=['fx-tier1','fx-tier2','fx-tier3','fx-hit','fx-boost','fx-lap','fx-finish'];
  let S=null; // live state, allocated by init()
  const post={bloom:0,vignette:0,chroma:0,hit:0,flash:0};
  const budget={};
  const glsl=(s)=>s;
  const has=(name)=>typeof globalThis[name]!=='undefined';
  function ready(){return !!S;}
  function hostOK(){
    return typeof THREE!=='undefined'&&typeof THREE.BufferGeometry==='function'&&typeof THREE.ShaderMaterial==='function'&&typeof THREE.InstancedMesh==='function'
      &&typeof THREE.Points==='function'&&typeof scene!=='undefined'&&scene&&typeof scene.add==='function';
  }
  const low=()=>(typeof MOBILEFX!=='undefined'&&!!MOBILEFX)||(typeof LOWFX!=='undefined'&&!!LOWFX);
  const clamp01=(v)=>v<0?0:v>1?1:v;
  const lerpN=(a,b,t)=>a+(b-a)*t;
  const trackW=()=>typeof TRACK_W==='number'?TRACK_W:14;
  const rnd=()=>S.rng();

  // ---- shared shader fragments -------------------------------------------------------------
  const INST_VERT=glsl(`attribute vec3 aColor;attribute float aFade;varying vec3 vC;varying float vF;varying vec2 vUv;varying vec3 vN;varying vec3 vV;varying vec3 vP;uniform float time;
void main(){vUv=uv;vC=aColor;vF=aFade;vP=position;vec4 local=vec4(position,1.);vec3 n=normal;
#ifdef USE_INSTANCING
local=instanceMatrix*local;n=mat3(instanceMatrix)*n;
#endif
vec4 view=modelViewMatrix*local;vN=normalize(normalMatrix*n);vV=normalize(-view.xyz);gl_Position=projectionMatrix*view;}`);
  const RING_FRAG=glsl(`uniform float time;varying vec3 vC;varying float vF;varying vec3 vP;
void main(){float r=length(vP.xy);float band=clamp((r-.72)/.28,0.,1.);float a=sin(band*3.14159);float ang=atan(vP.y,vP.x);a*=.72+.28*sin(ang*14.+time*11.);a*=vF;gl_FragColor=vec4(vC*a,a);}`);
  const SHELL_FRAG=glsl(`uniform float time;varying vec3 vC;varying float vF;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
float hexDist(vec2 p){p=abs(p);return max(dot(p,normalize(vec2(1.,1.7320508))),p.x);}
float hexLine(vec2 p){vec2 r=vec2(1.,1.7320508),h=r*.5;vec2 a=mod(p,r)-h,b=mod(p-h,r)-h;vec2 g=dot(a,a)<dot(b,b)?a:b;return smoothstep(.36,.46,hexDist(g));}
void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.2);float hex=hexLine(vUv*vec2(16.,8.)+vec2(time*.2,0.));float a=(rim*.85+hex*.45+.06)*vF;vec3 c=mix(vC,vec3(1.),rim*.5+hex*.2);gl_FragColor=vec4(c*a,a);}`);
  const STRIP_FRAG=glsl(`uniform float time;varying vec3 vC;varying float vF;varying vec2 vUv;
void main(){float a=sin(vUv.x*3.14159)*pow(sin(vUv.y*3.14159),.7)*(.8+.2*sin(vUv.x*34.-time*42.))*vF;vec3 c=mix(vC,vec3(1.),pow(sin(vUv.y*3.14159),3.)*.55);gl_FragColor=vec4(c*a,a);}`);
  const SHARD_FRAG=glsl(`varying vec3 vC;varying float vF;varying vec3 vN;
void main(){float shade=.55+.45*abs(dot(normalize(vN),vec3(0.,0.,1.)));gl_FragColor=vec4(vC*shade*vF,vF);}`);
  const PETAL_FRAG=glsl(`varying vec3 vC;varying float vF;varying vec2 vUv;varying vec3 vN;
void main(){float shade=.7+.3*abs(dot(normalize(vN),vec3(.3,.8,.5)));float edge=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x)*smoothstep(0.,.2,vUv.y)*smoothstep(1.,.8,vUv.y);gl_FragColor=vec4(vC*shade,edge*vF);}`);
  const FLAME_VERT=glsl(`varying vec3 vC;varying float vF;varying vec2 vUv;attribute vec3 aColor;attribute float aFade;uniform float time;
void main(){vUv=uv;vC=aColor;vF=aFade;vec3 p=position;float w=1.+.32*uv.y*sin(uv.y*7.-time*42.+uv.x*12.566);p.xy*=w;vec4 local=vec4(p,1.);
#ifdef USE_INSTANCING
local=instanceMatrix*local;
#endif
gl_Position=projectionMatrix*modelViewMatrix*local;}`);
  const FLAME_FRAG=glsl(`uniform float time;varying vec3 vC;varying float vF;varying vec2 vUv;
void main(){float t=vUv.y;float streak=.62+.38*sin(vUv.x*25.13+t*14.-time*38.);float a=pow(1.-t,1.7)*streak*vF;vec3 hot=vec3(1.,.97,.86);vec3 c=mix(hot,vC,smoothstep(0.,.42,t));c=mix(c,vC*.35,smoothstep(.5,1.,t));gl_FragColor=vec4(c*a,a);}`);
  const SKID_VERT=glsl(`attribute float aSide;attribute float aBorn;attribute float aStr;uniform float time;varying float vA;
void main(){float age=time-aBorn;float life=clamp(1.-age/6.,0.,1.);vA=aStr*life*(.4+.6*life)*sin(aSide*3.14159);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`);
  const SKID_FRAG=glsl(`uniform vec3 color;varying float vA;void main(){gl_FragColor=vec4(color,vA*.62);}`);
  const RIBBON_VERT=glsl(`attribute vec3 aColor;attribute float aAlpha;varying vec2 vUv;varying vec3 vC;varying float vA;
void main(){vUv=uv;vC=aColor;vA=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`);
  const RIBBON_FRAG=glsl(`uniform float time;varying vec2 vUv;varying vec3 vC;varying float vA;
void main(){float t=vUv.x;float edge=pow(sin(vUv.y*3.14159),.6);float head=smoothstep(0.,.35,t);float energy=.55+.45*sin(t*28.-time*22.+vUv.y*4.);float core=pow(1.-abs(vUv.y-.5)*2.,3.);vec3 c=mix(vC,vec3(1.),core*.5+pow(t,4.)*.4);float a=head*edge*energy*vA*(.6+.4*t*t);gl_FragColor=vec4(c*a,a);}`);
  const POINT_VERT=glsl(`attribute float aSize;attribute float aAlpha;attribute vec3 aColor;uniform float uScale;varying float vA;varying vec3 vC;
void main(){vA=aAlpha;vC=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*(uScale/max(1.,-mv.z));gl_Position=projectionMatrix*mv;}`);
  const POINT_FRAG=glsl(`uniform float additive;varying float vA;varying vec3 vC;
void main(){vec2 q=gl_PointCoord-.5;float d=length(q);float a=smoothstep(.5,.18,d)*vA;if(a<.003)discard;gl_FragColor=additive>.5?vec4(vC*a,a):vec4(vC,a);}`);
  const SPEED_VERT=glsl(`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`);
  const SPEED_FRAG=glsl(`uniform float time,intensity,flash,aspect;uniform vec3 tint,flashColor;varying vec2 vUv;
void main(){vec2 p=(vUv-.5)*vec2(aspect,1.);float r=length(p);float a=atan(p.y,p.x);float bins=72.;float fb=a/6.2831853*bins;float bin=floor(fb+.5);float rnd=fract(sin(bin*12.9898)*43758.5453);float rnd2=fract(sin(bin*78.233)*12345.678);
float line=pow(max(0.,sin(fract(fb+.5)*3.14159)),16.);float start=.22+rnd*.38;float len=fract(r*2.4-time*(7.+rnd2*5.)+rnd);float seg=smoothstep(0.,.3,len)*smoothstep(.95,.55,len);
float s=line*seg*smoothstep(start,start+.32,r)*intensity*(.35+.65*rnd2);vec3 c=tint*s+flashColor*flash*(.35+.65*smoothstep(.1,.85,r));gl_FragColor=vec4(c,1.);}`);

  // ---- helpers ----------------------------------------------------------------------------
  function shader(vert,frag,uniforms,opts){
    return new THREE.ShaderMaterial(Object.assign({vertexShader:vert,fragmentShader:frag,uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending},opts||{}));
  }
  function attachMesh(mesh,order){mesh.frustumCulled=false;mesh.renderOrder=order;mesh.matrixAutoUpdate=false;mesh.updateMatrix();scene.add(mesh);S.meshes.push(mesh);return mesh;}
  function setColor(arr,i,hex){S.color.set(hex);arr[i*3]=S.color.r;arr[i*3+1]=S.color.g;arr[i*3+2]=S.color.b;}
  function basisQuat(u,out){ // road frame at u: X=right, Y=up, Z=-tangent (same convention as orientOnTrack)
    trackTan(u,S.t);trackUp(u,S.up);trackRight(u,S.rt);if(S.t.lengthSq()<1e-6)S.t.set(0,0,-1);if(S.up.lengthSq()<1e-6)S.up.set(0,1,0);if(S.rt.lengthSq()<1e-6)S.rt.crossVectors(S.t,S.up);
    S.tmp.copy(S.t).negate();S.m.makeBasis(S.rt,S.up,S.tmp);return out.setFromRotationMatrix(S.m);
  }
  function kartPos(r,h,out){ // world position of the kart origin (+h along track up)
    if(r&&r.mesh&&r.mesh.position&&typeof r.mesh.position.x==='number'){out.copy(r.mesh.position);trackUp(r.u||0,S.up);if(S.up.lengthSq()<1e-6)S.up.set(0,1,0);return out.addScaledVector(S.up,h);}
    trackPoint(r?r.u||0:0,r?r.lat||0:0,h,out);return out;
  }
  function wheelPos(r,idx,out){ // world position of wheel pivot idx (2=rear-left,3=rear-right), fallback to track math
    const w=r&&r.mesh&&r.mesh.userData&&r.mesh.userData.wheels&&r.mesh.userData.wheels[idx];
    if(w&&w.pivot&&typeof w.pivot.getWorldPosition==='function'){w.pivot.getWorldPosition(out);return out;}
    trackPoint(r.u||0,(r.lat||0)+(idx%2?1.23:-1.23),.6,out);return out;
  }
  function exhaustMatrix(r,i,out){ // world matrix of exhaust i (0 left,1 right); local +Z points behind the kart
    const e=r.mesh&&r.mesh.userData&&r.mesh.userData.exhaust&&r.mesh.userData.exhaust[i];
    if(e&&typeof e.updateWorldMatrix==='function'){e.updateWorldMatrix(true,false);return out.copy(e.matrixWorld);}
    if(r.mesh&&typeof r.mesh.updateWorldMatrix==='function'){r.mesh.updateWorldMatrix(true,false);S.p.set(i?.48:-.48,.37,1.89);return out.copy(r.mesh.matrixWorld).multiply(S.m2.makeTranslation(S.p.x,S.p.y,S.p.z));}
    kartPos(r,.4,S.p);return out.makeTranslation(S.p.x,S.p.y,S.p.z);
  }
  function powerColor(r,kind){
    const ref=typeof referencePowerColors!=='undefined'&&referencePowerColors;const id=kind||(r&&r.div&&r.div.id);
    if(ref&&id&&ref[id])return ref[id];if(r&&r.div&&r.div.acc)return r.div.acc;return BOOST_COLOR;
  }
  function hudClass(cls,seconds){S.hudTimers[cls]=Math.max(S.hudTimers[cls]||0,seconds);if(S.hud&&S.hud.classList&&!S.hudOn[cls]){S.hud.classList.add(cls);S.hudOn[cls]=true;}}

  // ---- instanced transform pool (rings, shells, strips): lerped pose + scale, fade curve ----
  class InstPool{
    constructor(geometry,material,n,name){
      this.n=n;this.life=new Float32Array(n);this.max=new Float32Array(n);this.p0=new Float32Array(n*3);this.p1=new Float32Array(n*3);this.q=new Float32Array(n*4);this.s0=new Float32Array(n*3);this.s1=new Float32Array(n*3);this.pow=new Float32Array(n);this.head=0;this.active=0;
      this.color=new Float32Array(n*3);this.fade=new Float32Array(n);
      geometry.setAttribute('aColor',new THREE.InstancedBufferAttribute(this.color,3));geometry.setAttribute('aFade',new THREE.InstancedBufferAttribute(this.fade,1));
      this.mesh=new THREE.InstancedMesh(geometry,material,n);this.mesh.name=name;for(let i=0;i<n;i++)this.mesh.setMatrixAt(i,S.zero);this.mesh.count=n;
    }
    spawn(pos,quat,scaleFrom,scaleTo,life,hex,fadePow,pos1){
      const i=this.head;this.head=(i+1)%this.n;this.life[i]=this.max[i]=Math.max(.01,life);this.pow[i]=fadePow||1;
      this.p0[i*3]=pos.x;this.p0[i*3+1]=pos.y;this.p0[i*3+2]=pos.z;const e=pos1||pos;this.p1[i*3]=e.x;this.p1[i*3+1]=e.y;this.p1[i*3+2]=e.z;
      this.q[i*4]=quat.x;this.q[i*4+1]=quat.y;this.q[i*4+2]=quat.z;this.q[i*4+3]=quat.w;
      this.s0[i*3]=scaleFrom.x;this.s0[i*3+1]=scaleFrom.y;this.s0[i*3+2]=scaleFrom.z;this.s1[i*3]=scaleTo.x;this.s1[i*3+1]=scaleTo.y;this.s1[i*3+2]=scaleTo.z;
      setColor(this.color,i,hex);this.fade[i]=1;
    }
    update(dt){
      let active=0;
      for(let i=0;i<this.n;i++){
        if(this.life[i]<=0){if(this.fade[i]!==0){this.fade[i]=0;this.mesh.setMatrixAt(i,S.zero);this.mesh.instanceMatrix.needsUpdate=true;this.mesh.geometry.attributes.aFade.needsUpdate=true;}continue;}
        active++;this.life[i]-=dt;const t=clamp01(1-this.life[i]/this.max[i]),e=1-(1-t)*(1-t);
        S.p.set(lerpN(this.p0[i*3],this.p1[i*3],e),lerpN(this.p0[i*3+1],this.p1[i*3+1],e),lerpN(this.p0[i*3+2],this.p1[i*3+2],e));
        S.q.set(this.q[i*4],this.q[i*4+1],this.q[i*4+2],this.q[i*4+3]);
        S.s.set(lerpN(this.s0[i*3],this.s1[i*3],e),lerpN(this.s0[i*3+1],this.s1[i*3+1],e),lerpN(this.s0[i*3+2],this.s1[i*3+2],e));
        S.m.compose(S.p,S.q,S.s);this.mesh.setMatrixAt(i,S.m);this.fade[i]=Math.pow(1-t,this.pow[i]);
      }
      this.active=active;this.mesh.visible=active>0;if(active){this.mesh.instanceMatrix.needsUpdate=true;this.mesh.geometry.attributes.aFade.needsUpdate=true;this.mesh.geometry.attributes.aColor.needsUpdate=true;}
    }
    clear(){this.life.fill(0);this.fade.fill(0);for(let i=0;i<this.n;i++)this.mesh.setMatrixAt(i,S.zero);this.mesh.instanceMatrix.needsUpdate=true;this.mesh.visible=false;}
  }
  // ---- instanced debris pool (shards, petals): ballistic + tumble ---------------------------
  class DebrisPool{
    constructor(geometry,material,n,name,gravity,drag,flutter){
      this.n=n;this.gravity=gravity;this.drag=drag;this.flutter=flutter;this.pos=new Float32Array(n*3);this.vel=new Float32Array(n*3);this.axis=new Float32Array(n*3);this.ang=new Float32Array(n);this.angV=new Float32Array(n);this.life=new Float32Array(n);this.max=new Float32Array(n);this.size=new Float32Array(n);this.head=0;this.active=0;
      this.color=new Float32Array(n*3);this.fade=new Float32Array(n);
      geometry.setAttribute('aColor',new THREE.InstancedBufferAttribute(this.color,3));geometry.setAttribute('aFade',new THREE.InstancedBufferAttribute(this.fade,1));
      this.mesh=new THREE.InstancedMesh(geometry,material,n);this.mesh.name=name;for(let i=0;i<n;i++)this.mesh.setMatrixAt(i,S.zero);this.mesh.count=n;
    }
    emit(pos,vel,life,hex,size,spread){
      const i=this.head;this.head=(i+1)%this.n;const sp=spread||0;
      this.pos[i*3]=pos.x+(rnd()-.5)*sp;this.pos[i*3+1]=pos.y+(rnd()-.5)*sp;this.pos[i*3+2]=pos.z+(rnd()-.5)*sp;this.vel[i*3]=vel.x;this.vel[i*3+1]=vel.y;this.vel[i*3+2]=vel.z;
      const ax=rnd()-.5,ay=rnd()-.5,az=rnd()-.5,l=Math.hypot(ax,ay,az)||1;this.axis[i*3]=ax/l;this.axis[i*3+1]=ay/l;this.axis[i*3+2]=az/l;this.ang[i]=rnd()*TAU;this.angV[i]=(rnd()-.5)*18;
      this.life[i]=this.max[i]=Math.max(.05,life);this.size[i]=size||1;setColor(this.color,i,hex);this.fade[i]=1;
    }
    update(dt,time){
      let active=0;const g=this.gravity,d=Math.pow(this.drag,dt*60);
      for(let i=0;i<this.n;i++){
        if(this.life[i]<=0){if(this.fade[i]!==0){this.fade[i]=0;this.mesh.setMatrixAt(i,S.zero);this.mesh.instanceMatrix.needsUpdate=true;this.mesh.geometry.attributes.aFade.needsUpdate=true;}continue;}
        active++;this.life[i]-=dt;const k=clamp01(this.life[i]/this.max[i]);
        this.vel[i*3+1]+=g*dt;this.vel[i*3]*=d;this.vel[i*3+1]*=d;this.vel[i*3+2]*=d;
        if(this.flutter){this.vel[i*3]+=Math.sin(time*5.5+i*1.7)*this.flutter*dt;this.vel[i*3+2]+=Math.cos(time*4.3+i*2.3)*this.flutter*dt;}
        this.pos[i*3]+=this.vel[i*3]*dt;this.pos[i*3+1]+=this.vel[i*3+1]*dt;this.pos[i*3+2]+=this.vel[i*3+2]*dt;this.ang[i]+=this.angV[i]*dt;
        S.p.set(this.pos[i*3],this.pos[i*3+1],this.pos[i*3+2]);S.tmp.set(this.axis[i*3],this.axis[i*3+1],this.axis[i*3+2]);S.q.setFromAxisAngle(S.tmp,this.ang[i]);const sz=this.size[i]*(this.flutter?1:.4+.6*k);S.s.set(sz,sz,sz);
        S.m.compose(S.p,S.q,S.s);this.mesh.setMatrixAt(i,S.m);this.fade[i]=this.flutter?Math.min(1,k*4):k;
      }
      this.active=active;this.mesh.visible=active>0;if(active){this.mesh.instanceMatrix.needsUpdate=true;this.mesh.geometry.attributes.aFade.needsUpdate=true;this.mesh.geometry.attributes.aColor.needsUpdate=true;}
    }
    clear(){this.life.fill(0);this.fade.fill(0);for(let i=0;i<this.n;i++)this.mesh.setMatrixAt(i,S.zero);this.mesh.instanceMatrix.needsUpdate=true;this.mesh.visible=false;}
  }
  // ---- soft point pool (dust, smoke, shimmer, gold glints): grows, fades, optional spiral ----
  class PointPool{
    constructor(n,additive,name){
      this.n=n;this.pos=new Float32Array(n*3);this.vel=new Float32Array(n*3);this.life=new Float32Array(n);this.max=new Float32Array(n);this.size=new Float32Array(n);this.grow=new Float32Array(n);this.alpha=new Float32Array(n);this.peak=new Float32Array(n);this.color=new Float32Array(n*3);
      this.spiral=new Float32Array(n*4); // cx,cz,radius,angle (radius 0 = ballistic)
      this.head=0;this.active=0;this.buoy=0;this.drag=.96;
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));g.setAttribute('aSize',new THREE.BufferAttribute(this.size,1));g.setAttribute('aAlpha',new THREE.BufferAttribute(this.alpha,1));g.setAttribute('aColor',new THREE.BufferAttribute(this.color,3));
      const m=shader(POINT_VERT,POINT_FRAG,{uScale:S.uScale,additive:{value:additive?1:0}},{blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,depthTest:true});
      this.mesh=new THREE.Points(g,m);this.mesh.name=name;this.mesh.visible=false;
    }
    emit(pos,vel,life,hex,size,grow,peak,spread,spiralR,spiralA){
      const i=this.head;this.head=(i+1)%this.n;const sp=spread||0;
      this.pos[i*3]=pos.x+(rnd()-.5)*sp;this.pos[i*3+1]=pos.y+(rnd()-.5)*sp;this.pos[i*3+2]=pos.z+(rnd()-.5)*sp;this.vel[i*3]=vel.x;this.vel[i*3+1]=vel.y;this.vel[i*3+2]=vel.z;
      this.life[i]=this.max[i]=Math.max(.05,life);this.size[i]=size;this.grow[i]=grow||0;this.peak[i]=peak===undefined?1:peak;this.alpha[i]=0;setColor(this.color,i,hex);
      this.spiral[i*4]=pos.x;this.spiral[i*4+1]=pos.z;this.spiral[i*4+2]=spiralR||0;this.spiral[i*4+3]=spiralA||0;
    }
    update(dt){
      let active=0;const d=Math.pow(this.drag,dt*60);
      for(let i=0;i<this.n;i++){
        if(this.life[i]<=0){this.alpha[i]=0;continue;}
        active++;this.life[i]-=dt;const k=clamp01(this.life[i]/this.max[i]);
        this.vel[i*3+1]+=this.buoy*dt;this.vel[i*3]*=d;this.vel[i*3+1]*=d;this.vel[i*3+2]*=d;this.size[i]+=this.grow[i]*dt;
        const sr=this.spiral[i*4+2];
        if(sr>0){const a=this.spiral[i*4+3]+=this.vel[i*3]*dt;const rr=sr*(1-k)*.3+sr*k;this.pos[i*3]=this.spiral[i*4]+Math.cos(a)*rr;this.pos[i*3+2]=this.spiral[i*4+1]+Math.sin(a)*rr;this.pos[i*3+1]+=this.vel[i*3+1]*dt;}
        else{this.pos[i*3]+=this.vel[i*3]*dt;this.pos[i*3+1]+=this.vel[i*3+1]*dt;this.pos[i*3+2]+=this.vel[i*3+2]*dt;}
        this.alpha[i]=this.peak[i]*Math.min(1,(1-k)*6)*k;
      }
      this.active=active;this.mesh.visible=active>0;const at=this.mesh.geometry.attributes;
      if(active){at.position.needsUpdate=true;at.aSize.needsUpdate=true;at.aColor.needsUpdate=true;}at.aAlpha.needsUpdate=true;
    }
    clear(){this.life.fill(0);this.alpha.fill(0);this.mesh.geometry.attributes.aAlpha.needsUpdate=true;this.mesh.visible=false;}
  }

  // ---- per-racer state --------------------------------------------------------------------
  function racerState(r){
    if(!r||typeof r!=='object')return null;let st=S.stateOf.get(r);if(st)return st;
    if(S.tracked.length>=S.maxRacers)return null;
    const slot=S.tracked.length;S.tracked.push(r);
    st={slot,flame:0,tierFlash:0,dustT:0,smokeT:0,shimT:0,skid:[{on:false,lx:0,ly:0,lz:0,rx:0,ry:0,rz:0},{on:false,lx:0,ly:0,lz:0,rx:0,ry:0,rz:0}],
      rib:[{head:0,count:0,fade:0,lastX:0,lastY:0,lastZ:0,pts:new Float32Array(S.ribN*9)},{head:0,count:0,fade:0,lastX:0,lastY:0,lastZ:0,pts:new Float32Array(S.ribN*9)}]};
    S.stateOf.set(r,st);return st;
  }

  // ---- skid marks -------------------------------------------------------------------------
  function skidPoint(r,idx,out){ // contact patch under a rear wheel, lifted slightly above the road crown
    const w=r.mesh&&r.mesh.userData&&r.mesh.userData.wheels&&r.mesh.userData.wheels[idx];
    if(w&&w.pivot&&typeof w.pivot.getWorldPosition==='function'){w.pivot.getWorldPosition(out);trackUp(r.u||0,S.up);if(S.up.lengthSq()<1e-6)S.up.set(0,1,0);const hop=r.hop>0?Math.sin((r.hop/.28)*Math.PI)*.5:0;const localY=typeof w.pivot.position?.y==='number'?w.pivot.position.y:.6;out.addScaledVector(S.up,-(localY+hop)+.055);return out;}
    trackPoint(r.u||0,(r.lat||0)+(idx%2?1.23:-1.23),.055,out);return out;
  }
  function feedSkid(r,st,w,strength){
    const sk=st.skid[w];skidPoint(r,w+2,S.p);
    if(!sk.on){sk.on=true;trackTan(r.u||0,S.t);if(S.t.lengthSq()<1e-6)S.t.set(0,0,-1);trackUp(r.u||0,S.up);if(S.up.lengthSq()<1e-6)S.up.set(0,1,0);S.rt.crossVectors(S.t,S.up).normalize().multiplyScalar(.16);
      sk.lx=S.p.x-S.rt.x;sk.ly=S.p.y-S.rt.y;sk.lz=S.p.z-S.rt.z;sk.rx=S.p.x+S.rt.x;sk.ry=S.p.y+S.rt.y;sk.rz=S.p.z+S.rt.z;return;}
    const mx=(sk.lx+sk.rx)*.5,my=(sk.ly+sk.ry)*.5,mz=(sk.lz+sk.rz)*.5;const dx=S.p.x-mx,dy=S.p.y-my,dz=S.p.z-mz;const dist=Math.hypot(dx,dy,dz);
    if(dist<S.skidSpacing)return;if(dist>4){sk.on=false;return;}
    trackUp(r.u||0,S.up);if(S.up.lengthSq()<1e-6)S.up.set(0,1,0);S.t.set(dx,dy,dz).multiplyScalar(1/dist);S.rt.crossVectors(S.t,S.up).normalize().multiplyScalar(.16);
    const i=S.skidHead;S.skidHead=(i+1)%S.skidN;const P=S.skidPos,b=i*12;
    P[b]=sk.lx;P[b+1]=sk.ly;P[b+2]=sk.lz;P[b+3]=sk.rx;P[b+4]=sk.ry;P[b+5]=sk.rz;
    sk.lx=S.p.x-S.rt.x;sk.ly=S.p.y-S.rt.y;sk.lz=S.p.z-S.rt.z;sk.rx=S.p.x+S.rt.x;sk.ry=S.p.y+S.rt.y;sk.rz=S.p.z+S.rt.z;
    P[b+6]=sk.lx;P[b+7]=sk.ly;P[b+8]=sk.lz;P[b+9]=sk.rx;P[b+10]=sk.ry;P[b+11]=sk.rz;
    const q=i*4;S.skidBorn[q]=S.skidBorn[q+1]=S.skidBorn[q+2]=S.skidBorn[q+3]=S.time;S.skidStr[q]=S.skidStr[q+1]=S.skidStr[q+2]=S.skidStr[q+3]=strength;S.skidDirty=true;
  }
  // ---- drift ribbons ----------------------------------------------------------------------
  function feedRibbon(r,st,w,tier){
    const rb=st.rib[w];wheelPos(r,w+2,S.p);trackUp(r.u||0,S.up);if(S.up.lengthSq()<1e-6)S.up.set(0,1,0);
    if(rb.count===0){rb.count=1;rb.head=0;rb.lastX=S.p.x;rb.lastY=S.p.y;rb.lastZ=S.p.z;}
    else{const d=Math.hypot(S.p.x-rb.lastX,S.p.y-rb.lastY,S.p.z-rb.lastZ);if(d>6){rb.count=1;rb.head=0;}else if(d>S.ribSpacing){rb.head=(rb.head+1)%S.ribN;rb.count=Math.min(rb.count+1,S.ribN);rb.lastX=S.p.x;rb.lastY=S.p.y;rb.lastZ=S.p.z;}}
    const b=rb.head*9,P=rb.pts;P[b]=S.p.x;P[b+1]=S.p.y+.02;P[b+2]=S.p.z;P[b+3]=S.p.x+S.up.x*.62;P[b+4]=S.p.y+S.up.y*.62;P[b+5]=S.p.z+S.up.z*.62;
    S.color.set(TIER_COLORS[Math.max(0,Math.min(3,tier|0))]);P[b+6]=S.color.r;P[b+7]=S.color.g;P[b+8]=S.color.b;rb.fade=1;
  }
  function rebuildRibbons(){
    const N=S.ribN,P=S.ribPos,C=S.ribCol,A=S.ribAlpha,U=S.ribUv;let any=false;
    for(let s=0;s<S.maxRacers;s++){const r=S.tracked[s],st=r&&S.stateOf.get(r);
      for(let w=0;w<2;w++){const base=(s*2+w)*N*2;const rb=st&&st.rib[w];
        if(!rb||rb.count<2||rb.fade<=0){for(let k=0;k<N*2;k++){A[base+k]=0;const o=(base+k)*3;P[o]=P[o+1]=P[o+2]=0;}continue;}
        any=true;const flash=1+st.tierFlash*.9;
        for(let k=0;k<N;k++){const j=Math.max(0,k-(N-rb.count));const idx=((rb.head-(rb.count-1)+j)%N+N)%N;const t=rb.count>1?j/(rb.count-1):1;const src=idx*9;
          const v0=base+k*2,v1=v0+1;P[v0*3]=rb.pts[src];P[v0*3+1]=rb.pts[src+1];P[v0*3+2]=rb.pts[src+2];P[v1*3]=rb.pts[src+3];P[v1*3+1]=rb.pts[src+4];P[v1*3+2]=rb.pts[src+5];
          C[v0*3]=C[v1*3]=rb.pts[src+6];C[v0*3+1]=C[v1*3+1]=rb.pts[src+7];C[v0*3+2]=C[v1*3+2]=rb.pts[src+8];U[v0*2]=U[v1*2]=t;A[v0]=A[v1]=rb.fade*flash;}
      }}
    S.ribbon.visible=any;const at=S.ribbon.geometry.attributes;if(any){at.position.needsUpdate=true;at.aColor.needsUpdate=true;at.uv.needsUpdate=true;}at.aAlpha.needsUpdate=true;
  }

  // ---- construction -----------------------------------------------------------------------
  function build(){
    const isLow=low();
    S={meshes:[],tracked:[],stateOf:new WeakMap(),maxRacers:12,time:0,rng:typeof rng==='function'?rng:Math.random,low:isLow,
      p:new THREE.Vector3(),p2:new THREE.Vector3(),v:new THREE.Vector3(),t:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),rt:new THREE.Vector3(),tmp:new THREE.Vector3(),s:new THREE.Vector3(1,1,1),s2:new THREE.Vector3(1,1,1),
      q:new THREE.Quaternion(),q2:new THREE.Quaternion(),m:new THREE.Matrix4(),m2:new THREE.Matrix4(),zero:new THREE.Matrix4().makeScale(0,0,0),color:new THREE.Color(),
      uTime:{value:0},uScale:{value:(typeof innerHeight==='number'?innerHeight:900)*.5},
      hud:(typeof document!=='undefined'&&document&&typeof document.getElementById==='function')?document.getElementById('hud'):null,hudTimers:{},hudOn:{},
      speedI:0,flash:0,hit:0,boostK:0,tier:0,fountains:[],sweepT:0};
    for(const c of HUD_CLASSES){S.hudTimers[c]=0;S.hudOn[c]=false;}
    for(let i=0;i<6;i++)S.fountains.push({r:null,t:0,color:0xffffff,acc:0});
    // 1. skid marks: ring buffer of quads, age-faded in the vertex shader (no per-frame CPU work)
    S.skidN=isLow?300:600;S.skidSpacing=.7;S.skidHead=0;S.skidDirty=false;S.skidPos=new Float32Array(S.skidN*12);S.skidBorn=new Float32Array(S.skidN*4).fill(-1e4);S.skidStr=new Float32Array(S.skidN*4);const side=new Float32Array(S.skidN*4);const si=new Uint16Array(S.skidN*6);
    for(let i=0;i<S.skidN;i++){side[i*4]=0;side[i*4+1]=1;side[i*4+2]=0;side[i*4+3]=1;const v=i*4,o=i*6;si[o]=v;si[o+1]=v+1;si[o+2]=v+2;si[o+3]=v+1;si[o+4]=v+3;si[o+5]=v+2;}
    {const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(S.skidPos,3));g.setAttribute('aSide',new THREE.BufferAttribute(side,1));g.setAttribute('aBorn',new THREE.BufferAttribute(S.skidBorn,1));g.setAttribute('aStr',new THREE.BufferAttribute(S.skidStr,1));g.setIndex(new THREE.BufferAttribute(si,1));
      const m=shader(SKID_VERT,SKID_FRAG,{time:S.uTime,color:{value:new THREE.Color(0x0b0d12)}},{blending:THREE.NormalBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      S.skid=attachMesh(new THREE.Mesh(g,m),2);S.skid.name='fx-skid-marks';}
    // 2. drift ribbons: 12 racers x 2 rear wheels, rebuilt from per-racer ring buffers each frame
    S.ribN=isLow?14:24;S.ribSpacing=.55;const rv=S.maxRacers*2*S.ribN*2;S.ribPos=new Float32Array(rv*3);S.ribCol=new Float32Array(rv*3);S.ribAlpha=new Float32Array(rv);S.ribUv=new Float32Array(rv*2);
    for(let i=0;i<rv;i++)S.ribUv[i*2+1]=i%2;const ri=new Uint16Array(S.maxRacers*2*(S.ribN-1)*6);let o=0;
    for(let rb=0;rb<S.maxRacers*2;rb++)for(let i=0;i<S.ribN-1;i++){const b=rb*S.ribN*2+i*2;ri[o++]=b;ri[o++]=b+1;ri[o++]=b+2;ri[o++]=b+1;ri[o++]=b+3;ri[o++]=b+2;}
    {const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(S.ribPos,3));g.setAttribute('uv',new THREE.BufferAttribute(S.ribUv,2));g.setAttribute('aColor',new THREE.BufferAttribute(S.ribCol,3));g.setAttribute('aAlpha',new THREE.BufferAttribute(S.ribAlpha,1));g.setIndex(new THREE.BufferAttribute(ri,1));
      S.ribbon=attachMesh(new THREE.Mesh(g,shader(RIBBON_VERT,RIBBON_FRAG,{time:S.uTime},{side:THREE.DoubleSide})),5);S.ribbon.name='fx-drift-ribbons';S.ribbon.visible=false;}
    // 3. boost flames: one instanced cone per exhaust (12 x 2)
    {const g=new THREE.CylinderGeometry(.05,.24,1,isLow?8:12,3,true);g.rotateX(Math.PI/2);g.translate(0,0,.5);const n=S.maxRacers*2;S.flameCol=new Float32Array(n*3);S.flameFade=new Float32Array(n);
      g.setAttribute('aColor',new THREE.InstancedBufferAttribute(S.flameCol,3));g.setAttribute('aFade',new THREE.InstancedBufferAttribute(S.flameFade,1));
      S.flames=attachMesh(new THREE.InstancedMesh(g,shader(FLAME_VERT,FLAME_FRAG,{time:S.uTime},{side:THREE.DoubleSide}),n),6);S.flames.name='fx-boost-flames';for(let i=0;i<n;i++){S.flames.setMatrixAt(i,S.zero);setColor(S.flameCol,i,BOOST_COLOR);}S.flames.visible=false;}
    // 4. camera-space speed lines + flash quad
    {const g=new THREE.PlaneGeometry(2,2);const m=shader(SPEED_VERT,SPEED_FRAG,{time:S.uTime,intensity:{value:0},flash:{value:0},aspect:{value:1.5},tint:{value:new THREE.Color(0x9ffff0)},flashColor:{value:new THREE.Color(0xffffff)}},{depthTest:false});
      S.speed=attachMesh(new THREE.Mesh(g,m),1000);S.speed.name='fx-speed-lines';S.speed.visible=false;}
    // 5-7. burst pools
    S.rings=new InstPool(new THREE.RingGeometry(.72,1,isLow?32:48,1),shader(INST_VERT,RING_FRAG,{time:S.uTime},{side:THREE.DoubleSide}),10,'fx-shock-rings');attachMesh(S.rings.mesh,7);
    S.shells=new InstPool(new THREE.SphereGeometry(1,isLow?16:22,isLow?10:14),shader(INST_VERT,SHELL_FRAG,{time:S.uTime},{side:THREE.DoubleSide}),4,'fx-shield-shells');attachMesh(S.shells.mesh,8);
    S.strips=new InstPool(new THREE.PlaneGeometry(1,1),shader(INST_VERT,STRIP_FRAG,{time:S.uTime},{side:THREE.DoubleSide}),6,'fx-flash-strips');attachMesh(S.strips.mesh,9);
    S.shards=new DebrisPool(new THREE.OctahedronGeometry(.13,0),shader(INST_VERT,SHARD_FRAG,{time:S.uTime}),isLow?80:160,'fx-shards',-16,.985,0);attachMesh(S.shards.mesh,10);
    S.petals=new DebrisPool(new THREE.PlaneGeometry(.28,.17),shader(INST_VERT,PETAL_FRAG,{time:S.uTime},{blending:THREE.NormalBlending,side:THREE.DoubleSide}),isLow?90:200,'fx-confetti',-3.2,.93,2.4);attachMesh(S.petals.mesh,11);
    S.puffs=new PointPool(isLow?100:220,false,'fx-smoke-dust');S.puffs.buoy=1.4;attachMesh(S.puffs.mesh,3);
    S.glints=new PointPool(isLow?80:160,true,'fx-glints');S.glints.buoy=0;S.glints.drag=.985;attachMesh(S.glints.mesh,12);
    budget.low=isLow;budget.meshes=S.meshes.length;budget.skidQuads=S.skidN;budget.ribbonSamples=S.ribN;budget.flames=S.maxRacers*2;budget.rings=10;budget.shells=4;budget.strips=6;budget.shards=S.shards.n;budget.petals=S.petals.n;budget.puffs=S.puffs.n;budget.glints=S.glints.n;
  }
  function resetState(){
    S.tracked.length=0;S.stateOf=new WeakMap();S.skidHead=0;S.skidBorn.fill(-1e4);S.skidStr.fill(0);S.skidPos.fill(0);S.skidDirty=true;S.ribAlpha.fill(0);S.ribbon.visible=false;
    S.flameFade.fill(0);for(let i=0;i<S.maxRacers*2;i++)S.flames.setMatrixAt(i,S.zero);S.flames.instanceMatrix.needsUpdate=true;S.flames.visible=false;
    S.rings.clear();S.shells.clear();S.strips.clear();S.shards.clear();S.petals.clear();S.puffs.clear();S.glints.clear();
    for(const f of S.fountains){f.r=null;f.t=0;}S.speedI=0;S.flash=0;S.hit=0;S.boostK=0;S.tier=0;S.speed.visible=false;S.speed.material.uniforms.intensity.value=0;S.speed.material.uniforms.flash.value=0;
    for(const c of HUD_CLASSES){S.hudTimers[c]=0;if(S.hudOn[c]&&S.hud&&S.hud.classList)S.hud.classList.remove(c);S.hudOn[c]=false;}
    post.bloom=post.vignette=post.chroma=post.hit=post.flash=0;
  }
  function teardown(){
    const geos=new Set(),mats=new Set();
    for(const mesh of S.meshes){scene.remove(mesh);if(mesh.geometry)geos.add(mesh.geometry);if(mesh.material)mats.add(mesh.material);if(mesh.isInstancedMesh&&typeof mesh.dispose==='function')mesh.dispose();}
    geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
    for(const c of HUD_CLASSES)if(S.hudOn[c]&&S.hud&&S.hud.classList)S.hud.classList.remove(c);
    post.bloom=post.vignette=post.chroma=post.hit=post.flash=0;S=null;
  }

  // ---- burst helpers ----------------------------------------------------------------------
  function groundRing(u,pos,from,to,life,hex,pow){basisQuat(u,S.q2);S.q.copy(S.q2).multiply(S.q2.setFromAxisAngle(S.tmp.set(1,0,0),-Math.PI/2));S.s.set(from,from,from);S.s2.set(to,to,to);S.rings.spawn(pos,S.q,S.s,S.s2,life,hex,pow||1.2);}
  function wallRing(u,pos,from,to,life,hex){basisQuat(u,S.q);S.s.set(from,from,from);S.s2.set(to,to,to);S.rings.spawn(pos,S.q,S.s,S.s2,life,hex,1.4);}
  function sparks(pos,count,hex,speed,upV,spread,life,size){for(let i=0;i<count;i++){S.v.set((rnd()-.5)*speed,upV*(.5+rnd()),(rnd()-.5)*speed);S.shards.emit(pos,S.v,life*(.6+rnd()*.7),hex,size||1,spread);}}
  function puff(pos,hex,count,size,grow,peak,life,spread,vy){for(let i=0;i<count;i++){S.v.set((rnd()-.5)*2.4,vy+rnd()*1.2,(rnd()-.5)*2.4);S.puffs.emit(pos,S.v,life*(.7+rnd()*.6),hex,size*(.7+rnd()*.6),grow,peak,spread);}}

  // ---- public API -------------------------------------------------------------------------
  const api={
    post,budget,
    get ready(){return ready();},
    init(){
      if(!hostOK())return false;
      if(S){resetState();return true;}
      try{build();resetState();}catch(e){if(S){try{teardown();}catch(_){}}S=null;if(typeof console!=='undefined')console.warn('raceFX disabled:',e&&e.message);return false;}
      return true;
    },
    reset(){if(S)resetState();},
    clear(){if(!S)return;teardown();},
    dispose(){api.clear();},
    update(dt,player){
      if(!S)return;dt=Math.max(0,Math.min(.1,+dt||0));S.time+=dt;S.uTime.value=S.time;
      if(typeof innerHeight==='number')S.uScale.value=innerHeight*.5;if(typeof innerWidth==='number'&&typeof innerHeight==='number'&&innerHeight>0)S.speed.material.uniforms.aspect.value=innerWidth/innerHeight;
      // racer-attached pieces: flames and ribbons
      let flameAny=false;
      for(let s=0;s<S.tracked.length;s++){const r=S.tracked[s],st=S.stateOf.get(r);if(!st)continue;
        if(st.tierFlash>0)st.tierFlash=Math.max(0,st.tierFlash-dt*3.2);
        for(let w=0;w<2;w++){const rb=st.rib[w];if(rb.count&&!(r.drifting&&r.speed>8)){rb.fade=Math.max(0,rb.fade-dt*2.6);if(rb.fade<=0)rb.count=0;}}
        for(let i=0;i<2;i++){const idx=st.slot*2+i;if(st.flame>.02){flameAny=true;exhaustMatrix(r,i,S.m);const wsc=.75+st.flame*.55,len=1.2+st.flame*2.3+(r.speed>0?Math.min(1,r.speed/60)*.6:0);S.m.scale(S.s.set(wsc,wsc,len));S.flames.setMatrixAt(idx,S.m);S.flameFade[idx]=Math.min(1,st.flame*1.2);}
          else if(S.flameFade[idx]!==0){S.flameFade[idx]=0;S.flames.setMatrixAt(idx,S.zero);}}
        st.flame=Math.max(0,st.flame-dt*1.6); // decays unless step() keeps feeding it
      }
      S.flames.visible=flameAny;if(flameAny){S.flames.instanceMatrix.needsUpdate=true;S.flames.geometry.attributes.aFade.needsUpdate=true;}
      else if(S.flames.instanceMatrix.needsUpdate!==true&&S.tracked.length){S.flames.instanceMatrix.needsUpdate=true;S.flames.geometry.attributes.aFade.needsUpdate=true;}
      rebuildRibbons();
      if(S.skidDirty){const at=S.skid.geometry.attributes;at.position.needsUpdate=true;at.aBorn.needsUpdate=true;at.aStr.needsUpdate=true;S.skidDirty=false;}
      // confetti fountains
      for(const f of S.fountains){if(!f.r||f.t<=0)continue;f.t-=dt;f.acc+=dt*(S.low?30:60);kartPos(f.r,2.2,S.p);
        while(f.acc>=1){f.acc-=1;S.v.set((rnd()-.5)*7,7+rnd()*7,(rnd()-.5)*7);S.petals.emit(S.p,S.v,1.6+rnd()*1.4,rnd()<.4?GOLD:rnd()<.5?f.color:0xffffff,.8+rnd()*.7,.6);}
        if(f.t<=0)f.r=null;}
      S.rings.update(dt);S.shells.update(dt);S.strips.update(dt);S.shards.update(dt,S.time);S.petals.update(dt,S.time);S.puffs.update(dt);S.glints.update(dt);
      // player-driven overlay + post hints
      let boostK=0,speedK=0,tier=0;
      if(player&&typeof player==='object'){const base=player.maxSpeedBase>0?player.maxSpeedBase:40;boostK=player.boost>0?clamp01(player.boost/1.2)*.7+.3:0;speedK=clamp01(((player.speed||0)/base-1)/.4);tier=player.drifting?(player.driftTier|0):0;}
      S.boostK=lerpN(S.boostK,boostK,1-Math.exp(-dt*6));S.speedI=lerpN(S.speedI,Math.max(boostK,speedK*.7),1-Math.exp(-dt*5));S.flash=Math.max(0,S.flash-dt*3.4);S.hit=Math.max(0,S.hit-dt*1.9);S.tier=lerpN(S.tier,tier,1-Math.exp(-dt*4));
      const su=S.speed.material.uniforms;su.intensity.value=S.speedI;su.flash.value=S.flash*.55+S.hit*.15;su.flashColor.value.setHex(S.hit>S.flash?0xff5a3a:0xffffff);S.speed.visible=S.speedI>.01||S.flash>.01||S.hit>.01;
      post.bloom=clamp01(S.boostK*.85+S.tier*.12+S.hit*.55+S.flash*.4);post.vignette=clamp01(S.speedI*.85+S.hit*.7);post.chroma=clamp01(S.boostK*.45+S.hit*.9+S.flash*.5);post.hit=clamp01(S.hit);post.flash=clamp01(S.flash);
      if(S.hud&&S.hud.classList){const boostOn=S.boostK>.2;if(boostOn!==S.hudOn['fx-boost']){S.hudOn['fx-boost']=boostOn;if(boostOn)S.hud.classList.add('fx-boost');else S.hud.classList.remove('fx-boost');}
        for(const c of HUD_CLASSES){if(c==='fx-boost')continue;if(S.hudTimers[c]>0){S.hudTimers[c]-=dt;if(S.hudTimers[c]<=0&&S.hudOn[c]){S.hud.classList.remove(c);S.hudOn[c]=false;}}}}
    },
    step(r,dt){
      if(!S||!r||typeof r!=='object')return;const st=racerState(r);if(!st)return;dt=Math.max(0,Math.min(.1,+dt||0));
      const speed=+r.speed||0,base=r.maxSpeedBase>0?r.maxSpeedBase:40,tier=r.driftTier|0;
      // skid marks under both rear wheels while sliding
      const sliding=(r.drifting&&speed>6)||r.wheelspin>0||(r.spin>0&&speed>3);
      if(sliding){const strength=r.spin>0?1:r.wheelspin>0?.9:.45+tier*.18;feedSkid(r,st,0,strength);feedSkid(r,st,1,strength);}else{st.skid[0].on=false;st.skid[1].on=false;}
      // drift ribbons
      if(r.drifting&&speed>8){feedRibbon(r,st,0,tier);feedRibbon(r,st,1,tier);}
      // boost flame strength (decays in update)
      const target=r.boost>0?Math.max(.45,Math.min(1,r.boost/1.4)):speed>base*1.02?.3:0;if(target>st.flame)st.flame=Math.min(1,st.flame+dt*9);
      // off-line dust
      const W=trackW()/2;if(Math.abs(r.lat||0)>W-1.6&&speed>6&&r.spin<=0){st.dustT-=dt;if(st.dustT<=0){st.dustT=S.low?.1:.05;const side=(r.lat||0)>0?3:2;skidPoint(r,side,S.p);S.v.set((rnd()-.5)*1.5,.9+rnd(),(rnd()-.5)*1.5);S.puffs.emit(S.p,S.v,.7+rnd()*.4,DUST,1.1,2.4,.55,.5);}}
      // tyre smoke on wheelspin or spin-outs
      if(r.wheelspin>0||(r.spin>0&&speed>3)){st.smokeT-=dt;if(st.smokeT<=0){st.smokeT=S.low?.09:.045;skidPoint(r,2+(rnd()<.5?1:0),S.p);S.v.set((rnd()-.5)*2,1.6+rnd(),(rnd()-.5)*2);S.puffs.emit(S.p,S.v,.9+rnd()*.5,0x8b93a3,1.4,3.2,.5,.5);}}
      // heat shimmer behind boosting exhausts (desktop only)
      if(!S.low&&r.boost>0){st.shimT-=dt;if(st.shimT<=0){st.shimT=.035;exhaustMatrix(r,rnd()<.5?0:1,S.m);S.p.setFromMatrixPosition(S.m);trackTan(r.u||0,S.t);if(S.t.lengthSq()<1e-6)S.t.set(0,0,-1);S.v.copy(S.t).multiplyScalar(-4-rnd()*4);S.v.y+=.6+rnd();S.glints.emit(S.p,S.v,.35+rnd()*.2,BOOST_COLOR,.9,3.5,.14,.3);}}
    },
    onDriftTier(r,tier){
      if(!S||!r)return;const st=racerState(r);if(!st)return;st.tierFlash=1;const hex=TIER_COLORS[Math.max(0,Math.min(3,tier|0))];
      for(let w=0;w<2;w++){wheelPos(r,w+2,S.p);wallRing(r.u||0,S.p,.2,1.1+tier*.25,.32,hex);}
      if(r.isPlayer){S.flash=Math.max(S.flash,.12*tier);hudClass('fx-tier'+Math.max(1,Math.min(3,tier|0)),.45);}
    },
    onBoost(r,strength){
      if(!S||!r)return;const st=racerState(r);if(!st)return;const k=clamp01(strength===undefined?1:+strength||0);st.flame=1;
      kartPos(r,.55,S.p);trackTan(r.u||0,S.t);if(S.t.lengthSq()<1e-6)S.t.set(0,0,-1);S.p.addScaledVector(S.t,-2.1);
      wallRing(r.u||0,S.p,.5,2.4+k*2.2,.45,BOOST_COLOR);S.p.addScaledVector(S.t,-.6);wallRing(r.u||0,S.p,.3,1.6+k*1.2,.3,0xffffff);
      for(let i=0;i<(S.low?6:12);i++){S.v.copy(S.t).multiplyScalar(-9-rnd()*10);S.v.y+=rnd()*3;S.glints.emit(S.p,S.v,.35+rnd()*.3,i%3?BOOST_COLOR:0xffffff,1.3,1.5,.8,.5);}
      if(r.isPlayer){S.flash=Math.max(S.flash,.35+k*.45);S.boostK=Math.max(S.boostK,.6);}
    },
    onHit(r,source){
      if(!S||!r)return;kartPos(r,.35,S.p);groundRing(r.u||0,S.p,.6,7.5,.55,HOT,1.3);S.p2.copy(S.p);kartPos(r,1.1,S.p);
      sparks(S.p,S.low?10:22,HOT,13,7,.7,.8,1.1);sparks(S.p,S.low?4:8,0xffd0a0,9,9,.5,.6,.7);
      puff(S.p,SMOKE,S.low?4:7,2.2,3.6,.55,1.1,1.2,1.4);
      S.s.set(.4,.4,.4);S.s2.set(2.6,2.6,2.6);S.q.identity();S.shells.spawn(S.p,S.q,S.s,S.s2,.28,0xffb070,1.6);
      if(r.isPlayer){S.hit=1;S.flash=Math.max(S.flash,.5);hudClass('fx-hit',.4);}
    },
    onShieldBlock(r){
      if(!S||!r)return;kartPos(r,.9,S.p);S.s.set(2.2,2.2,2.2);S.s2.set(3.6,3.6,3.6);S.q.identity();S.shells.spawn(S.p,S.q,S.s,S.s2,.5,SHIELD_COLOR,1.1);
      kartPos(r,.3,S.p);groundRing(r.u||0,S.p,1.5,5,.4,SHIELD_COLOR,1.2);sparks(S.p,S.low?6:12,SHIELD_COLOR,8,6,1.2,.5,.8);
      if(r.isPlayer)S.flash=Math.max(S.flash,.3);
    },
    onWall(r,side){
      if(!S||!r)return;const sg=side<0?-1:1,W=trackW()/2,u=r.u||0;trackPoint(u,sg*(W+.28),.55,S.p);trackTan(u,S.t);if(S.t.lengthSq()<1e-6)S.t.set(0,0,-1);trackRight(u,S.rt);if(S.rt.lengthSq()<1e-6)S.rt.set(sg,0,0);
      for(let i=0;i<(S.low?8:16);i++){S.v.copy(S.t).multiplyScalar(-7-rnd()*11).addScaledVector(S.rt,-sg*(1+rnd()*3));S.v.y+=2+rnd()*5;S.shards.emit(S.p,S.v,.3+rnd()*.35,i%4?0xffa040:0xfff0c0,.8,.5);}
      basisQuat(u,S.q);S.p2.copy(S.p).addScaledVector(S.t,-2.6);S.s.set(1.5,.7,1);S.s2.set(6.5,1,1);S.strips.spawn(S.p2,S.q,S.s,S.s2,.32,0xffc070,1.5);
      puff(S.p,0xb8a89a,S.low?2:4,1.2,2.2,.4,.7,.6,1);
    },
    onToken(pos,count){
      if(!S||!pos||typeof pos.x!=='number')return;const n=S.low?6:11;
      for(let i=0;i<n;i++){const a=rnd()*TAU;S.v.set(4+rnd()*4,2.2+rnd()*2.4,0);S.p.copy(pos);S.glints.emit(S.p,S.v,.55+rnd()*.35,i%3?GOLD:0xfff4c8,.9+rnd()*.5,.4,1,.1,.5+rnd()*.5,a);}
      S.q.identity();S.s.set(.25,.25,.25);S.s2.set(1.6+Math.min(10,count|0)*.05,1.6,1.6);S.rings.spawn(pos,S.q,S.s,S.s2,.28,GOLD,1.5);
    },
    onItemBox(pos){
      if(!S||!pos||typeof pos.x!=='number')return;S.p.copy(pos);
      for(let i=0;i<(S.low?12:24);i++){S.v.set((rnd()-.5)*12,3+rnd()*8,(rnd()-.5)*12);S.shards.emit(S.p,S.v,.6+rnd()*.5,i%2?BOOST_COLOR:GOLD,1.2+rnd()*.6,.6);}
      S.q.identity();S.s.set(.8,.8,.8);S.s2.set(2.8,2.8,2.8);S.shells.spawn(S.p,S.q,S.s,S.s2,.3,BOOST_COLOR,1.4);
      puff(S.p,0xcffff5,S.low?2:4,1.6,2,.35,.5,.8,.5);
    },
    onLap(r,lap){
      if(!S||!r)return;if(!r.isPlayer)return;const W=trackW()/2,u=.005;
      trackPoint(u,-W-1,6.5,S.p);trackPoint(u,W+1,6.5,S.p2);basisQuat(u,S.q);S.s.set(1.6,13,1);S.s2.set(2.4,13,1);S.strips.spawn(S.p,S.q,S.s,S.s2,.6,0xfff1c0,1,S.p2);
      trackPoint(u,0,.3,S.p);groundRing(u,S.p,2,W*1.6,.6,GOLD,1.2);hudClass('fx-lap',.6);
      const laps=typeof game!=='undefined'&&game&&game.laps>0?game.laps:3;
      if((lap|0)>=laps){trackPoint(u,0,7,S.p);for(let i=0;i<(S.low?30:70);i++){S.p2.copy(S.p);S.p2.x+=(rnd()-.5)*W*2;S.v.set((rnd()-.5)*5,-1+rnd()*4,(rnd()-.5)*5);S.petals.emit(S.p2,S.v,2+rnd()*1.5,i%3?GOLD:0xffffff,.9+rnd()*.6,1.5);}S.flash=Math.max(S.flash,.25);}
    },
    onFinish(r){
      if(!S||!r)return;let slot=S.fountains.find(f=>f.r===r)||S.fountains.find(f=>!f.r)||S.fountains[0];slot.r=r;slot.t=3;slot.acc=0;S.color.set(r.div&&r.div.acc?r.div.acc:'#ffffff');slot.color=S.color.getHex();
      kartPos(r,.3,S.p);groundRing(r.u||0,S.p,1,9,.7,GOLD,1.1);if(r.isPlayer){S.flash=Math.max(S.flash,.5);hudClass('fx-finish',1.2);}
    },
    onSpecial(r,kind){
      if(!S||!r)return;const hex=powerColor(r,kind);S.color.set(hex);const h=S.color.getHex();kartPos(r,.3,S.p);groundRing(r.u||0,S.p,.8,9.5,.62,h,1.1);
      kartPos(r,.8,S.p2);S.q.identity();S.s.set(.6,.6,.6);S.s2.set(3.2,3.2,3.2);S.shells.spawn(S.p2,S.q,S.s,S.s2,.35,h,1.4);sparks(S.p2,S.low?6:12,h,7,6,1,.55,.9);
      if(r.isPlayer)S.flash=Math.max(S.flash,.22);
    },
  };
  return api;
})();
