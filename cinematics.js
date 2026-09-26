/* In-engine cutscenes. Every shot is rendered live through the race renderer: real circuit,
   real karts and drivers, real lighting, bloom and grade. No stills, no illustrated plates.
   A cutscene owns the camera only; the race simulation never steps while one is playing. */
const cinematics=(()=>{
 const V=()=>new THREE.Vector3();
 // One MediaQueryList, read per frame: no per-frame matchMedia() allocation.
 let RMQ=null;const reducedMotion=()=>{try{return (RMQ||(RMQ=matchMedia('(prefers-reduced-motion: reduce)'))).matches;}catch{return false;}};
 const reviewMode=()=>{try{return /[?&]review=/.test(location.search||'');}catch{return false;}};
 const E={
  inOut:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  out:t=>1-Math.pow(1-t,3),
  expo:t=>t>=1?1:1-Math.pow(2,-10*t),
  smooth:t=>t*t*t*(t*(t*6-15)+10),
  linear:t=>t
 };
 const clamp01=v=>v<0?0:v>1?1:v,mix=(a,b,t)=>a+(b-a)*t,W=u=>((u%1)+1)%1;
 const pose=()=>({pos:V(),look:V(),up:new THREE.Vector3(0,1,0),fov:50,roll:0});
 function copyPose(out,a){out.pos.copy(a.pos);out.look.copy(a.look);out.up.copy(a.up);out.fov=a.fov;out.roll=a.roll||0;return out;}
 function lerpPose(out,a,b,t,arc=0){out.pos.lerpVectors(a.pos,b.pos,t);if(arc)out.pos.addScaledVector(WORLD_UP,Math.sin(Math.PI*t)*arc);out.look.lerpVectors(a.look,b.look,t);out.up.lerpVectors(a.up,b.up,t).normalize();out.fov=mix(a.fov,b.fov,t);out.roll=mix(a.roll||0,b.roll||0,t);return out;}
 function cameraPose(out){out.pos.copy(camera.position);camera.getWorldDirection(out.look);out.look.multiplyScalar(30).add(camera.position);out.up.copy(camera.up);out.fov=camera.fov;out.roll=0;return out;}
 const WORLD_UP=new THREE.Vector3(0,1,0);
 // Track frames: two independent records so camera and subject can be sampled together.
 const frame=()=>({p:V(),f:V(),u:V(),r:V()});
 const FA=frame(),FB=frame(),T1=V(),T2=V(),T3=V();
 function at(u,lat=0,h=0,o=FA){u=W(u);trackPoint(u,lat,h,o.p);trackTan(u,o.f);trackUp(u,o.u);trackRight(u,o.r);return o;}
 // Circuit bounds from the live spline, for establishing and aerial shots.
 function bounds(){
  const box=new THREE.Box3(),p=V();for(let i=0;i<72;i++){trackPoint(i/72,0,0,p);box.expandByPoint(p);}
  const size=box.getSize(V());return {center:box.getCenter(V()),radius:Math.max(12,Math.max(size.x,size.z)*.5),low:box.min.y};
 }
 const portrait=()=>innerWidth<innerHeight;
 const mapName=()=>typeof activeMap!=='undefined'&&activeMap?activeMap.name:'Synergy Circuit';
 const mapTheme=()=>typeof activeMap!=='undefined'&&activeMap?[activeMap.theme,activeMap.difficulty].filter(Boolean).join(' · '):'';
 const diffName=()=>['SIMULATION','STANDARD','OVERSEER'][typeof game!=='undefined'?game.diff:1]||'STANDARD';
 const ord=n=>n+(typeof ordinal==='function'?ordinal(n):'th').toUpperCase();
 const powerName=d=>typeof ABILITIES!=='undefined'&&ABILITIES[d.id]?ABILITIES[d.id].name:'';

 // ---- shot rigs -------------------------------------------------------------------------
 // Orbit a world point: angles in radians, radius and height in metres.
 function orbit(out,center,a,radius,height,look=center){out.pos.set(center.x+Math.cos(a)*radius,center.y+height,center.z+Math.sin(a)*radius);out.look.copy(look);out.up.copy(WORLD_UP);return out;}
 // Orbit in a kart's local frame (a=0 dead ahead, positive swings to the kart's right).
 function kartOrbit(out,obj,a,radius,height,lookUp=.8){
  obj.updateMatrixWorld(true);const m=obj.matrixWorld;
  out.pos.set(Math.sin(a)*radius,height,-Math.cos(a)*radius).applyMatrix4(m);
  out.look.set(0,lookUp,0).applyMatrix4(m);out.up.set(0,1,0).transformDirection(m);return out;
 }
 // Spline dolly/crane: world-space control points, centripetal Catmull-Rom.
 function spline(points){return new THREE.CatmullRomCurve3(points,false,'centripetal',.5);}

 // ---- cutscene definitions ---------------------------------------------------------------
 const SCENES={
  // (1) Game introduction: establishing flyover, swoop onto the pack, hero reveal, title lockup.
  intro(){
   if(typeof stepTitleAttractPack!=='function')return null;
   ensureTitleAttractPack();const b=bounds(),lead=()=>titleAttract.racers[0];
   const a0=Math.atan2(at(titleAttract.u).p.z-b.center.z,at(titleAttract.u).p.x-b.center.x)+.9;
   return {name:'intro',hideUi:true,fadeIn:1.1,focusOnEnd:'#title-start',
    update:dt=>stepTitleAttractPack(dt),
    endPose:out=>titleAttractPose(out),
    onEnd(){titleAttract.started=true;},
    shots:[
     {dur:3.6,ease:E.smooth,cue:'swell',card:{eyebrow:'SKY RACING CHAMPIONSHIP',title:mapName(),sub:mapTheme(),align:'left'},
      pose:(e,o)=>{const a=a0+e*.62;orbit(o,b.center,a,b.radius*mix(1.05,.82,e),b.radius*mix(.62,.4,e),T1.copy(b.center).setY(b.low));o.fov=mix(52,44,e);return o;}},
     {dur:2.8,ease:E.inOut,cue:'whoosh',focus:()=>at(titleAttract.u,0,1,FB).p,dof:.55,
      pose:(e,o)=>{const u=titleAttract.u,c=at(u+mix(.05,.011,e),mix(14,5,e),0,FA),t=at(u-.002,0,1,FB);o.pos.copy(c.p).addScaledVector(c.u,mix(26,2.2,E.out(e)));o.look.copy(t.p);o.up.copy(c.u);o.fov=mix(46,36,e);o.roll=mix(-.06,0,e);return o;}},
     {dur:2.8,ease:E.inOut,focus:()=>lead().mesh.getWorldPosition(T3).addScaledVector(WORLD_UP,.9),dof:1,
      lower:()=>{const d=lead().div;return {tag:'HERO',name:d.name,meta:[d.code,d.role,powerName(d)].filter(Boolean).join(' · '),acc:d.acc};},
      pose:(e,o)=>{kartOrbit(o,lead().mesh,mix(Math.PI*.55,Math.PI*.2,e),mix(5.4,4.3,e),mix(.75,1.25,e),.85);o.fov=mix(31,26,e);return o;}},
     {dur:3.2,ease:E.inOut,settle:true,arc:2,lockup:true,flash:.55,cue:'impact'}
    ]};
  },
  // Back to the title: a low pass on the attract pack, then a crane onto the title framing.
  title(){
   if(typeof stepTitleAttractPack!=='function')return null;
   ensureTitleAttractPack();const lead=()=>titleAttract.racers[0];
   return {name:'title',hideUi:true,focusOnEnd:'#title-start',update:dt=>stepTitleAttractPack(dt),endPose:out=>titleAttractPose(out),onEnd(){titleAttract.started=true;},
    shots:[
     {dur:1.5,ease:E.inOut,cue:'whoosh',dof:.8,focus:()=>lead().mesh.getWorldPosition(T3).addScaledVector(WORLD_UP,.9),
      pose:(e,o)=>{kartOrbit(o,lead().mesh,mix(Math.PI*.12,-Math.PI*.08,e),mix(8,6,e),mix(.9,1.3,e),.9);o.fov=mix(34,30,e);return o;}},
     {dur:1.7,ease:E.inOut,settle:true,arc:3,lockup:true,flash:.3,cue:'impact'}
    ]};
  },
  // (2) Menu reveals after a covered cut: a low whip down the start straight, then a crane onto the setup framing.
  roster(opts={}){
   if(typeof rosterCameraPose!=='function')return null;
   // Title -> Start: the attract pack is parked mid-lap on this straight; clear it before the whip.
   if(!document.body.classList.contains('title-open')&&typeof clearTitleAttract==='function')clearTitleAttract();
   return {name:'roster',hideUi:true,endPose:out=>rosterCameraPose(out),
    shots:[
     {dur:1.15,ease:E.out,card:{eyebrow:'RACE SETUP',title:opts.label||'CHOOSE YOUR RACER',sub:mapName().toUpperCase(),align:'left'},
      pose:(e,o)=>{const c=at(mix(.03,.045,e),mix(6.5,5.5,e),mix(1.1,1.5,e),FA),t=at(.075,-1,1.4,FB);o.pos.copy(c.p);o.look.copy(t.p);o.up.copy(c.u);o.fov=mix(30,34,e);o.roll=mix(.04,0,e);return o;}},
     {dur:1.45,ease:E.inOut,settle:true,arc:4}
    ]};
  },
  // Racer confirmed: the chosen kart and driver get a turntable-free hero orbit on the live road.
  hero(opts={}){
   if(typeof selected==='undefined'||!selected||typeof buildKart!=='function'||typeof rosterCameraPose!=='function')return null;
   const d=selected,rig=new THREE.Group();rig.name='Cutscene hero rig';
   const tier=typeof equippedKartTier==='function'?equippedKartTier(d.id):'factory';
   const kart=buildKart(d,tier);
   if(typeof applyKartBuildVisuals==='function'&&typeof saved!=='undefined')applyKartBuildVisuals(kart,saved.builds?.[d.id]||[],saved.appearance?.[d.id]||'factory');
   rig.add(kart);orientOnTrack(rig,.52,0,0,0);scene.add(rig);let time=0;
   return {name:'hero',hideUi:true,endPose:out=>rosterCameraPose(out),
    update:dt=>{time+=dt;animateShowroomKart(kart,time,dt,0);if(typeof updateMapScenery==='function')updateMapScenery(dt);},
    teardown(){disposeKart(kart);scene.remove(rig);},
    shots:[
     {dur:1.9,ease:E.inOut,focus:()=>kart.getWorldPosition(T3).addScaledVector(WORLD_UP,1),dof:1,cue:'whoosh',
      lower:()=>({tag:'RACER CONFIRMED',name:d.name,meta:[d.code,d.role,powerName(d)].filter(Boolean).join(' · '),acc:d.acc}),
      pose:(e,o)=>{kartOrbit(o,rig,mix(-Math.PI*.3,Math.PI*.42,e),mix(5.6,4.4,e),mix(.7,1.2,e),.8);o.fov=mix(32,27,e);return o;}},
     {dur:1.2,ease:E.inOut,focus:()=>kart.getWorldPosition(T3).addScaledVector(WORLD_UP,1.2),dof:1.2,
      pose:(e,o)=>{kartOrbit(o,rig,Math.PI*.85,mix(3.2,2.4,e),mix(1.9,1.7,e),1.15);o.fov=mix(26,22,e);return o;}},
     {dur:1.1,ease:E.inOut,settle:true,from:(o)=>{rosterCameraPose(o);o.pos.addScaledVector(o.up,9);o.fov=64;return o;},
      card:{eyebrow:'NEXT',title:opts.label||'CHOOSE YOUR CIRCUIT',sub:d.name.toUpperCase(),align:'left'}}
    ]};
  },
  // Circuit chosen: the rebuilt map is revealed with an aerial run, a road-level sweep and its name card.
  circuit(opts={}){
   if(typeof rosterCameraPose!=='function')return null;
   const b=bounds();
   return {name:'circuit',hideUi:true,endPose:out=>rosterCameraPose(out),
    shots:[
     {dur:2,ease:E.inOut,cue:'swell',card:{eyebrow:'CIRCUIT',title:mapName(),sub:opts.sub||mapTheme(),align:'left'},
      pose:(e,o)=>{const c=at(mix(.9,.97,e),mix(-26,-12,e),0,FA),t=at(mix(.96,1.03,e),0,0,FB);o.pos.copy(c.p).addScaledVector(WORLD_UP,mix(38,24,e));o.look.copy(t.p);o.up.copy(WORLD_UP);o.fov=mix(54,46,e);return o;}},
     {dur:1.2,ease:E.linear,cue:'whoosh',
      pose:(e,o)=>{const c=at(mix(.005,.03,e),5.5,1,FA),t=at(mix(.03,.055,e),-2,1.2,FB);o.pos.copy(c.p);o.look.copy(t.p);o.up.copy(c.u);o.fov=33;o.roll=.035;return o;}},
     {dur:1.3,ease:E.inOut,settle:true,from:(o)=>{orbit(o,b.center,-.6,b.radius*.7,b.radius*.45,T1.copy(b.center).setY(b.low));o.fov=48;return o;}}
    ]};
  },
  // (3) Pre-race grid: circuit flyover, pan down the grid past the rivals, push-in on the player, hand-off to the countdown.
  grid(opts={}){
   if(typeof game==='undefined'||!game.player||!game.racers.length)return null;
   const p=game.player,order=game.racers.slice().sort((a,b)=>b.u-a.u),quick=!!opts.quick;
   const front=order[0].u,idx=p.rank||game.racers.indexOf(p)+1;
   const shots=[];
   if(!quick)shots.push({dur:2.8,ease:E.inOut,cue:'swell',card:{eyebrow:diffName()+' · ROUND START',title:mapName(),sub:game.racers.length+' RACERS · '+game.laps+' LAPS',align:'left'},
    pose:(e,o)=>{const c=at(front+mix(.07,.018,e),mix(-20,-9,e),0,FA),t=at(front-.004,0,0,FB);o.pos.copy(c.p).addScaledVector(c.u,mix(36,14,E.out(e)));o.look.copy(t.p);o.up.copy(c.u);o.fov=mix(50,42,e);return o;}});
   // The dolly runs from the front row back to the player's row; the lower third names whoever is abreast.
   shots.push({dur:quick?2:3.1,ease:E.inOut,cue:quick?'whoosh':null,dof:.7,
    focus:()=>abreast.mesh.getWorldPosition(T3).addScaledVector(WORLD_UP,.9),
    lowerBy:()=>abreast,lower:()=>{const r=abreast,rank=r.rank||order.indexOf(r)+1;return {tag:'P'+rank,name:r.div.name+(r.isPlayer?' · YOU':''),meta:[r.div.code,r.div.role].filter(Boolean).join(' · '),acc:r.div.acc};},
    pose:(e,o)=>{const u=mix(front+.003,p.u-.001,e);abreast=nearest(u);const c=at(u,6.4,1.2,FA),t=at(u+.005,-.5,.9,FB);o.pos.copy(c.p);o.look.copy(t.p);o.up.copy(c.u);o.fov=mix(34,30,e);return o;}});
   shots.push({dur:quick?1.6:2.4,ease:E.inOut,dof:1.1,focus:()=>p.mesh.getWorldPosition(T3).addScaledVector(WORLD_UP,1.15),
    lower:()=>({tag:'P'+idx,name:p.div.name,meta:['YOUR GRID SLOT',powerName(p.div)].filter(Boolean).join(' · '),acc:p.div.acc}),
    pose:(e,o)=>{kartOrbit(o,p.mesh,mix(Math.PI*.22,Math.PI*.06,e),mix(6.2,3,E.out(e)),mix(1.6,1.45,e),mix(.9,1.2,e));o.fov=mix(36,28,e);return o;}});
   shots.push({dur:1.1,ease:E.inOut,settle:true,arc:.6});
   let abreast=p;const nearest=u=>{let best=p,d=1e9;for(const r of game.racers){const x=Math.abs(r.u-u);if(x<d-1e-6||(x<d+1e-6&&r.isPlayer)){d=Math.min(d,x);best=r;}}return best;};
   return {name:'grid',hideUi:true,focusOnEnd:null,
    update:dt=>{for(const r of game.racers)try{animateKart(r,dt,trackAG(W(r.u)));}catch{}if(typeof updateMapScenery==='function')updateMapScenery(dt);},
    endPose:out=>countdownPose(out),
    onEnd(){if(typeof camState!=='undefined'){camState.init=false;camState.fov=camera.fov;}if(typeof showTouch==='function')showTouch();},
    shots};
  },
  // (4) Finish: winner orbit, podium reveal, results hand-off. Built on the live finish ceremony.
  podium(){
   if(typeof finishCeremony==='undefined'||!finishCeremony.root||!finishCeremony.karts.length)return null;
   const root=finishCeremony.root,winner=finishCeremony.karts[0],top=game.racers.slice().sort(raceOrder).slice(0,3),w=top[0];
   const local=(x,y,z,out)=>out.set(x,y,z).applyMatrix4(root.matrixWorld);
   return {name:'podium',hideUi:true,focusOnEnd:'#rematch',
    update:dt=>animateFinishCeremony(dt),
    endPose:out=>finishCeremonyPose(out),
    shots:[
     {dur:2.7,ease:E.inOut,cue:'impact',flash:.35,dof:1,focus:()=>winner.getWorldPosition(T3).addScaledVector(WORLD_UP,1),
      lower:()=>w?{tag:w.dnf?'CLASSIFIED':'WINNER',name:w.div.name+(w.isPlayer?' · YOU':''),meta:w.finished&&typeof fmtTime==='function'?fmtTime(w.finishTime):'',acc:w.div.acc}:null,
      pose:(e,o)=>{kartOrbit(o,winner,mix(-Math.PI*.35,Math.PI*.3,e),mix(5.2,4.2,e),mix(.9,1.6,e),.9);o.fov=mix(32,27,e);return o;}},
     {dur:2.2,ease:E.inOut,card:{eyebrow:mapName().toUpperCase(),title:'PODIUM',sub:top.map((r,i)=>ord(i+1)+' '+r.div.name).join('  ·  '),align:'left'},
      pose:(e,o)=>{root.updateMatrixWorld(true);local(mix(1.2,-.8,e),mix(2.4,5,e),mix(-8,-15.5,e),o.pos);local(0,mix(2,1.3,e),0,o.look);o.up.set(0,1,0).transformDirection(root.matrixWorld);o.fov=mix(40,46,e);return o;}},
     {dur:1.2,ease:E.inOut,settle:true}
    ]};
  }
 };
 // The countdown rig's first frame, so the chase camera takes over without a jump.
 function countdownPose(out){
  const p=game.player,f=at(p.u,p.lat,.9,FB),a=Math.PI*.75,dist=9;
  out.pos.copy(f.p).addScaledVector(f.f,Math.cos(a)*-dist).addScaledVector(f.r,Math.sin(a)*dist).addScaledVector(f.u,1.6);
  out.look.copy(f.p).addScaledVector(f.f,1.5).addScaledVector(f.u,.6);out.up.copy(f.u);out.fov=62;out.roll=0;return out;
 }

 // ---- overlay ----------------------------------------------------------------------------
 let ui=null;
 function el(tag,cls,parent,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;parent?.appendChild(n);return n;}
 function overlay(){
  if(ui)return ui;
  const root=el('div','cinematic',document.body);root.id='cinematic';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Cutscene');root.hidden=true;
  const top=el('div','cine-bar cine-top',root),bottom=el('div','cine-bar cine-bottom',root);
  const card=el('div','cine-card',root);card.setAttribute('aria-live','polite');
  const eyebrow=el('span','cine-eyebrow',card),rule=el('i','cine-rule',card),title=el('strong','cine-title',card),sub=el('span','cine-sub',card);
  const lower=el('div','cine-lower',root);lower.setAttribute('aria-live','polite');const tag=el('b','cine-lower-tag',lower),name=el('strong','cine-lower-name',lower),meta=el('span','cine-lower-meta',lower);
  const lockup=el('div','cine-lockup',root);lockup.setAttribute('aria-hidden','true');
  el('span','cine-lockup-eyebrow',lockup,'SKY RACING CHAMPIONSHIP');const word=el('strong','cine-lockup-word',lockup,'ZENFLOW');el('span','cine-lockup-racer',lockup,'RACER');el('i','cine-lockup-rule',lockup);
  const fade=el('div','cine-fade',root),progress=el('div','cine-progress',bottom),bar=el('i','',progress);
  const skip=el('button','cine-skip',bottom);skip.type='button';skip.setAttribute('aria-label','Skip cutscene');let coarse=false;try{coarse=matchMedia('(pointer:coarse)').matches;}catch{}skip.innerHTML='<span>SKIP</span><kbd>'+(coarse?'TAP':'ANY KEY')+'</kbd>';
  root.addEventListener('click',e=>{if(!state.active)return;e.preventDefault();e.stopPropagation();skipCinematic();});
  ui={root,top,bottom,card,eyebrow,rule,title,sub,lower,tag,name,meta,lockup,word,fade,bar,skip,cardKey:'',lowerKey:''};
  return ui;
 }
 function showCard(c){
  const o=overlay(),key=c?c.eyebrow+'|'+c.title+'|'+c.sub:'';if(key===o.cardKey)return;o.cardKey=key;
  o.card.classList.remove('on');if(!c)return;
  o.eyebrow.textContent=c.eyebrow||'';o.title.textContent=c.title||'';o.sub.textContent=c.sub||'';o.card.dataset.align=c.align||'left';
  void o.card.offsetWidth;o.card.classList.add('on');
 }
 function showLower(l){
  const o=overlay(),key=l?l.tag+'|'+l.name+'|'+l.meta:'';if(key===o.lowerKey)return;o.lowerKey=key;
  if(!l){o.lower.classList.remove('on');return;}
  o.tag.textContent=l.tag||'';o.lower.dataset.long=String((l.tag||'').length>4);o.name.textContent=l.name||'';o.meta.textContent=l.meta||'';o.lower.style.setProperty('--acc',l.acc||'#ef765e');
  o.lower.classList.remove('on');void o.lower.offsetWidth;o.lower.classList.add('on');
 }

 // ---- lens: screen-space focus falloff with highlight-weighted bokeh, in the HDR chain ----
 const FocusShader={
  uniforms:{tDiffuse:{value:null},focus:{value:new THREE.Vector2(.5,.5)},radius:{value:.22},amount:{value:0},aspect:{value:1.5}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 focus;uniform float radius,amount,aspect;varying vec2 vUv;
void main(){vec2 d=(vUv-focus)*vec2(aspect,1.);float coc=smoothstep(radius,radius+.55,length(d))*amount;vec4 base=texture2D(tDiffuse,vUv);
if(coc<.0004){gl_FragColor=base;return;}vec4 acc=vec4(0.);float ws=0.;
for(int i=0;i<18;i++){float fi=float(i);float r=sqrt((fi+.5)/18.);float a=fi*2.39996;vec4 s=texture2D(tDiffuse,vUv+vec2(cos(a)/aspect,sin(a))*r*coc);float w=1.+max(0.,dot(s.rgb,vec3(.3,.55,.15))-.6)*1.4;acc+=s*w;ws+=w;}
gl_FragColor=acc/ws;}`
 };
 let lens=null;
 function lensPass(){
  if(lens||typeof raceComposer==='undefined'||!raceComposer||typeof raceGrade==='undefined'||!raceGrade||!THREE.ShaderPass)return lens;
  try{lens=new THREE.ShaderPass(FocusShader);lens.enabled=false;const i=raceComposer.passes.indexOf(raceGrade);raceComposer.insertPass(lens,i<0?raceComposer.passes.length-1:i);}catch(error){lens=null;console.warn('Cutscene lens unavailable',error);}
  return lens;
 }
 function disposeLens(){if(!lens)return;try{const i=raceComposer?.passes.indexOf(lens);if(i>=0)raceComposer.passes.splice(i,1);lens.material?.dispose();lens.fsQuad?.dispose?.();}catch{}lens=null;}
 addEventListener('pagehide',disposeLens);
 const NDC=V();
 function applyLens(shot,e){
  const pass=lensPass();if(!pass)return;
  const amount=shot&&shot.focus&&shot.dof&&!reducedMotion()?shot.dof*.011*Math.sin(Math.PI*clamp01(e*1.6+.2)):0;
  if(amount<=0){pass.enabled=false;return;}
  NDC.copy(shot.focus()).project(camera);if(NDC.z>1){pass.enabled=false;return;}
  const u=pass.uniforms;u.focus.value.set(NDC.x*.5+.5,NDC.y*.5+.5);u.amount.value=amount;u.aspect.value=innerHeight>0?innerWidth/innerHeight:1.5;pass.enabled=true;
 }

 // ---- audio cue hooks ----------------------------------------------------------------------
 function cue(kind){
  if(!kind||typeof AUDIO==='undefined'||!AUDIO.ctx||!AUDIO.on)return;
  try{
   if(kind==='swell'){tone(55,2.8,'sine',.16,55);tone(110,2.4,'triangle',.05,110,.25);}
   else if(kind==='whoosh')noiseHit(.9,.2,1500);
   else if(kind==='impact'){noiseHit(.6,.32,420);tone(73,1.6,'sine',.28,-18);tone(293,1.2,'triangle',.07,0,.05);}
   else if(kind==='sting'){[0,7,12].forEach((s,i)=>tone(392*Math.pow(2,s/12),.32,'triangle',.14,0,i*.07));}
  }catch{}
 }

 // ---- playback -----------------------------------------------------------------------------
 const state={active:null,held:false,pad:new Set()};
 const P0=pose(),P1=pose(),OUT=pose();
 const POST_KEYS=['bloom','vignette','chroma','hit','flash'];
 function post(){return typeof raceFX!=='undefined'&&raceFX&&raceFX.post||null;}
 function play(name,opts={}){
  if(reviewMode()||!SCENES[name])return false;
  stop();
  let seq=null;try{seq=SCENES[name](opts);}catch(error){console.error('Cutscene unavailable',name,error);seq=null;}
  if(!seq||!seq.shots.length)return false;
  const reduced=reducedMotion();
  if(reduced){
   // Reduced motion: a short, static hold on the hand-off framing with the scene's title card.
   const card=seq.shots.find(s=>s.card)?.card,lower=seq.shots.find(s=>s.lower)?.lower,lockup=seq.shots.some(s=>s.lockup),last=seq.shots[seq.shots.length-1];
   seq.shots=[{dur:1.4,ease:E.linear,card,lower,lockup,settle:!!seq.endPose,pose:seq.endPose?null:last.pose,static:true}];
  }
  seq.total=seq.shots.reduce((t,s)=>t+s.dur,0);seq.t=0;seq.index=-1;seq.reduced=reduced;seq.returnFocus=document.activeElement;if(opts.focusOnEnd!==undefined)seq.focusOnEnd=opts.focusOnEnd;
  state.active=seq;state.held=false;state.pad=padButtons();
  const o=overlay();o.root.hidden=false;o.root.style.pointerEvents='';o.root.dataset.scene=seq.name;
  // The curtain already announced a transition label; the card stays silent so it is not read twice.
  o.card.setAttribute('aria-live',opts.label?'off':'polite');
  // Menus and HUD leave the tab order and the accessibility tree while the film owns the screen.
  seq.inert=[];for(const id of INERT){const n=document.getElementById(id);if(n){seq.inert.push([n,n.inert]);n.inert=true;}}o.root.classList.toggle('reduced',reduced);o.cardKey=o.lowerKey='';o.card.classList.remove('on');o.lower.classList.remove('on');o.lockup.classList.remove('on');
  o.fade.style.opacity=seq.fadeIn?'1':'0';o.bar.style.transform='scaleX(0)';o.barQ=0;
  requestAnimationFrame(()=>{if(state.active===seq)o.root.classList.add('on');});
  document.body.classList.add('cinematic-playing');document.body.classList.remove('cine-reveal');
  if(typeof resetInput==='function')resetInput();
  if(typeof hideTouch==='function')hideTouch();
  o.skip.focus({preventScroll:true});
  return true;
 }
 // Two reusable sets swapped per poll: no per-frame Set allocation.
 const PADS=[new Set(),new Set()];let padFlip=0;
 function padButtons(){const on=PADS[padFlip^=1];on.clear();try{for(const pad of navigator.getGamepads?.()||[])if(pad)for(let i=0;i<pad.buttons.length;i++)if(pad.buttons[i]?.pressed)on.add(pad.index+':'+i);}catch{}return on;}
 // A pad skip hands the still-held buttons to the game as already held, so Start/A cannot
 // pause the countdown or press Rematch on the frame the film ends.
 function latchPad(){try{const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p&&p.connected!==false);if(!pad)return;if(typeof padPause!=='undefined')padPause=!!pad.buttons[9]?.pressed;if(typeof menuPad!=='undefined')menuPad.prev=pad.buttons.map(b=>!!b?.pressed);}catch{}}
 const INERT=['title-screen','roster','hud','results','touch','settings-panel'];
 function enterShot(seq,i){
  const shot=seq.shots[i];seq.index=i;
  if(shot.settle){(shot.from?shot.from(P0):cameraPose(P0));}
  const o=overlay();showCard(shot.card||null);
  if(!shot.lower)showLower(null);
  o.lockup.classList.toggle('on',!!shot.lockup);
  if(!seq.reduced)cue(shot.cue);
  shot.flashT=shot.flash||0;shot.lowerK=undefined;shot.lowerShown=false;
 }
 function evaluate(seq,shot,e,out){
  if(shot.settle){
   if(seq.endPose)seq.endPose(P1);else copyPose(P1,P0);
   if(shot.static)return copyPose(out,P1);
   return lerpPose(out,P0,P1,e,shot.arc||0);
  }
  shot.pose(e,out);
  // Authored lenses are landscape; portrait widens them so the subject survives the crop.
  if(portrait())out.fov=Math.min(75,out.fov*1.18);
  return out;
 }
 function tick(dt){
  const seq=state.active;if(!seq)return false;
  if(typeof game!=='undefined'&&game.state==='paused'){if(!state.held){state.held=true;overlay().root.classList.add('held');}return false;}
  if(state.held){state.held=false;overlay().root.classList.remove('held');}
  dt=Math.min(.1,Math.max(0,dt));
  // Any freshly pressed gamepad button skips, as keys and taps do.
  const pad=padButtons();for(const b of pad)if(!state.pad.has(b)){state.pad=pad;latchPad();skip();return state.active!=null;}state.pad=pad;
  seq.t+=dt;
  if(seq.update)seq.update(seq.reduced?0:dt);
  if(typeof game!=='undefined'&&game.skyMat)game.skyMat.uniforms.time.value=game.time;
  let start=0,i=0;while(i<seq.shots.length-1&&seq.t>=start+seq.shots[i].dur){start+=seq.shots[i].dur;i++;}
  if(i!==seq.index)enterShot(seq,i);
  const shot=seq.shots[i],local=clamp01((seq.t-start)/shot.dur),e=(shot.ease||E.inOut)(local);
  evaluate(seq,shot,e,OUT);apply(OUT);applyLens(shot,local);
  // Lower thirds are rebuilt only when their subject changes (the grid dolly's abreast racer).
  if(shot.lower){const k=shot.lowerBy?shot.lowerBy():0;if(!shot.lowerShown||k!==shot.lowerK){shot.lowerShown=true;shot.lowerK=k;showLower(shot.lower(e));}}
  const o=overlay(),q=Math.round(clamp01(seq.t/seq.total)*1000);if(q!==o.barQ){o.barQ=q;o.bar.style.transform='scaleX('+q/1000+')';}
  if(seq.fadeIn)o.fade.style.opacity=String(1-clamp01(seq.t/seq.fadeIn));
  const p=post();if(p){p.flash=shot.flashT>0?shot.flashT*(1-E.out(local)):0;p.vignette=seq.reduced?0:.22;p.bloom=.18;p.chroma=0;p.hit=0;}
  if(seq.t>=seq.total)finish(false);
  return true;
 }
 function apply(p){
  camera.position.copy(p.pos);camera.up.copy(p.up);camera.lookAt(p.look);if(p.roll)camera.rotateZ(p.roll);
  camera.fov=p.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  if(typeof sun!=='undefined'&&typeof SOLAR_DIRECTION!=='undefined'){sun.target.position.copy(p.look);sun.position.copy(p.look).addScaledVector(SOLAR_DIRECTION,180);}
 }
 function finish(skipped){
  const seq=state.active;if(!seq)return;
  state.active=null;state.held=false;
  // A skip lands on exactly the frame the natural ending would have handed off.
  if(seq.endPose){seq.endPose(OUT);apply(OUT);}
  try{seq.teardown?.();}catch(error){console.error('Cutscene teardown failed',error);}
  // The race grade recomputes these every racing frame; menus and results expect them neutral.
  const p=post();if(p)POST_KEYS.forEach(k=>p[k]=0);
  if(lens)lens.enabled=false;
  try{seq.onEnd?.(skipped);}catch(error){console.error(error);}
  for(const [n,was] of seq.inert||[])n.inert=was;
  const o=overlay();o.root.style.pointerEvents='none';o.root.classList.remove('on','held');o.lockup.classList.remove('on');o.card.classList.remove('on');o.lower.classList.remove('on');o.fade.style.opacity='0';
  document.body.classList.remove('cinematic-playing');document.body.classList.add('cine-reveal');
  clearTimeout(finish.timer);finish.timer=setTimeout(()=>{if(!state.active){o.root.hidden=true;document.body.classList.remove('cine-reveal');}},520);
  // Focus lands on the scene's control, or back where the commit left it when that control is unavailable.
  const usable=n=>n&&n!==document.body&&n!==o.skip&&n.isConnected!==false&&!n.disabled&&typeof n.focus==='function'&&!n.closest?.('.hidden,[inert]');
  const want=seq.focusOnEnd?document.querySelector(seq.focusOnEnd):null,target=usable(want)?want:usable(seq.returnFocus)?seq.returnFocus:null;
  if(target)target.focus({preventScroll:true});
  else if(document.activeElement===o.skip)o.skip.blur();
  if(typeof staticFrameDirty!=='undefined')staticFrameDirty=true;
 }
 function skip(){if(!state.active)return false;finish(true);return true;}
 function stop(){if(state.active)finish(true);}
 // Any fresh key skips; Tab still moves focus to the Skip button. Held/repeated keys never skip.
 const PASS=new Set(['Tab','Shift','Control','Alt','Meta','CapsLock']);
 document.addEventListener('keydown',e=>{
  if(!state.active||state.held||e.repeat||PASS.has(e.key))return;
  e.preventDefault();e.stopImmediatePropagation();skip();
 },true);

 // (5) Final-lap sting: typographic flourish over the live race. It never takes the camera.
 function sting(title,sub=''){
  if(reviewMode())return false;
  let s=document.getElementById('cine-sting');
  // Thin letterbox bars carry the label, framing the race toast rather than repeating it.
  if(!s){s=el('div','cine-sting',document.body);s.id='cine-sting';s.setAttribute('aria-hidden','true');el('strong','cine-sting-title',el('div','cine-sting-bar cine-sting-top',s));el('span','cine-sting-sub',el('div','cine-sting-bar cine-sting-bottom',s));}
  s.querySelector('.cine-sting-title').textContent=title;s.querySelector('.cine-sting-sub').textContent=sub;
  s.classList.remove('on');void s.offsetWidth;s.classList.add('on');
  const p=post();if(p&&!reducedMotion())p.flash=Math.max(p.flash||0,.4);
  cue('sting');clearTimeout(sting.timer);sting.timer=setTimeout(()=>s.classList.remove('on'),2200);return true;
 }
 return {state,scenes:SCENES,play,tick,skip,stop,sting,countdownPose,ease:E,disposeLens,get active(){return state.active;}};
})();
function playCinematic(name,opts){return cinematics.play(name,opts);}
function tickCinematic(dt){return cinematics.tick(dt);}
function skipCinematic(){return cinematics.skip();}
function stopCinematic(){return cinematics.stop();}
function cinematicActive(){return !!cinematics.state.active;}
function cinematicSting(title,sub){return cinematics.sting(title,sub);}
