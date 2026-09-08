/* Division VFX. Analytic ribbon shaders and bounded instancing follow the
   Zukan Arena ElementalVfx architecture: one emitter owns materials, shared
   immutable meshes, deterministic motion, explicit expiry and mobile caps. */
const powerEffects=[],powerShapes={};
const powerLow=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
const powerReduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion:reduce)').matches;
const POWER_CAP=powerLow?12:24;
const powerDummy=new THREE.Object3D();
// Reference colors remain readable and consistent regardless of chassis paint.
const referencePowerColors={zenflow:'#69dcff',collective:'#70ff9a',hybrid:'#68cfff',nexus:'#ffc369',kinetic:'#74ffac',juris:'#ffcf68',signal:'#ff508f',loom:'#b45aff',vector:'#c8efff',aether:'#ffd27a',animus:'#66edff',helix:'#6affcb','animus-pulse':'#8ff4ff',ledger:'#b794f6',terra:'#60a5fa',obsidian:'#fb923c',civic:'#7dd3fc',cognara:'#f472b6',gaia:'#4ade80',nomad:'#fbbf24',eon:'#67e8f9'};
function cachedPowerGeometry(key,build){return powerShapes[key]||(powerShapes[key]=build());}
function ribbonGeometry(key,turns=2,radius=1,length=8,width=.22){return cachedPowerGeometry(key,()=>{const points=[],uv=[],indices=[],segments=64;for(let i=0;i<=segments;i++){const t=i/segments,a=t*turns*Math.PI*2,r=radius*(.5+.5*Math.sin(t*Math.PI));for(const side of [-1,1]){points.push(Math.cos(a)*(r+side*width),Math.sin(a)*(r+side*width),t*length);uv.push(t,(side+1)/2);}if(i<segments){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;});}
function powerShader(color,mode=0){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:mode===3?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{time:{value:0},fade:{value:1},tint:{value:new THREE.Color(color)},mode:{value:mode}},vertexShader:`varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;uniform float time;uniform float mode;
void main(){vUv=uv;vec3 p=position;if(mode==3.)p.x+=sin(p.z*4.-time*12.)*.12*(1.+p.z*.1);if(mode==7.)p.y+=sin(p.z*2.-time*4.)*.15;vec4 local=vec4(p,1.);
#ifdef USE_INSTANCING
local=instanceMatrix*local;
#endif
vec4 view=modelViewMatrix*local;vec3 surfaceNormal=normal;
#ifdef USE_INSTANCING
surfaceNormal=mat3(instanceMatrix)*surfaceNormal;
#endif
vNormal=normalize(normalMatrix*surfaceNormal);vView=normalize(-view.xyz);gl_Position=projectionMatrix*view;}`,fragmentShader:`uniform vec3 tint;uniform float time;uniform float fade;uniform float mode;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.);float a=.7;vec3 color=tint;
if(mode==0.){float lines=pow(.5+.5*sin(vUv.y*95.-time*3.),8.);float currents=pow(noise(vUv*vec2(48.,22.)-vec2(time*.3,time)),5.);a=.025+lines*.16+rim*.35+currents*.45;}
else if(mode==1.){float flow=noise(vUv*vec2(18.,8.)-vec2(time*2.,0.));a=.035+rim*.55+pow(flow,5.)*.3;color=mix(tint,vec3(.8,1.,1.),rim);}
else if(mode==2.){float scan=step(.83,fract(vUv.y*110.-time*1.5));float grain=noise(vUv*120.);a=(.11+scan*.4+rim*.22)*(.85+grain*.15);color=mix(tint,vec3(1.),scan*.4);}
else if(mode==3.){float edge=pow(max(0.,sin(vUv.y*3.14159)),.7);float flow=noise(vec2(vUv.x*13.-time*9.,vUv.y*7.));float tongues=smoothstep(.15,.8,flow);float shock=pow(max(0.,cos(vUv.x*42.)),10.);a=edge*(.2+tongues*.8)*(1.-vUv.x);color=mix(vec3(1.,.95,.78),tint,vUv.x)+shock*(1.-vUv.x)*.45;}
else if(mode==4.){float scan=pow(.5+.5*sin(vUv.y*100.+time*4.),18.);float fracture=noise(vUv*32.);a=.10+rim*.58+scan*.09;color=mix(tint,vec3(1.),rim*.7)*(.8+fracture*.2);}
else if(mode==5.){a=pow(max(0.,sin(vUv.y*3.14159)),2.)*(.4+.6*pow(.5+.5*sin(vUv.x*28.-time*12.),4.));color=mix(tint,vec3(1.),.4);}
else if(mode==6.){float charge=noise(vUv*vec2(24.,4.)-vec2(time*3.,0.));a=(.28+charge*.5)*sin(vUv.y*3.14159);}
else if(mode==7.){float filament=pow(.5+.5*cos(vUv.y*28.+sin(vUv.x*21.-time*4.)),5.);a=sin(vUv.y*3.14159)*(.3+filament*.6);color=mix(tint,vec3(1.),filament*.45);}
else if(mode==9.){float light=max(0.,dot(normalize(vNormal),normalize(vec3(-.4,.8,.6))));a=.98;color=mix(tint*.4,tint,light)+vec3(1.,.86,.55)*pow(rim,3.)*.6;}
else{float light=.5+.5*abs(dot(normalize(vNormal),normalize(vec3(-.4,.8,.6))));a=.85;color=tint*light+vec3(.2)*rim;}gl_FragColor=vec4(color,a*fade);}`});}
function addPowerPart(root,geometry,color,mode,name){const mesh=new THREE.Mesh(geometry,powerShader(color,mode));mesh.name=name;root.add(mesh);return mesh;}
function silhouetteGeometry(){return cachedPowerGeometry('human',()=>{const s=new THREE.Shape();const pts=[[-.18,1.65],[-.3,1.48],[-.55,1.38],[-.83,.65],[-.66,.58],[-.39,1.04],[-.3,.55],[-.4,-.3],[-.16,-.3],[0,.38],[.16,-.3],[.4,-.3],[.3,.55],[.39,1.04],[.66,.58],[.83,.65],[.55,1.38],[.3,1.48],[.18,1.65]];s.moveTo(...pts[0]);pts.slice(1).forEach(p=>s.lineTo(...p));s.absellipse(0,1.89,.27,.31,-Math.PI/2,Math.PI*1.5,false);return new THREE.ExtrudeGeometry(s,{depth:.16,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.05,bevelThickness:.05});});}
function addPowerInstances(root,color,kind,count){const geo=cachedPowerGeometry('petal',()=>{const shape=new THREE.Shape();shape.moveTo(0,-.6);shape.bezierCurveTo(.42,-.1,.3,.4,0,.65);shape.bezierCurveTo(-.3,.4,-.42,-.1,0,-.6);return new THREE.ShapeGeometry(shape,6);});const mesh=new THREE.InstancedMesh(geo,powerShader(color,8),count);mesh.name=kind;mesh.frustumCulled=false;root.add(mesh);return mesh;}
// Detailed signatures share immutable geometry; each emitter owns its materials.
function powerCurve(key,points,radius=.045){return cachedPowerGeometry(key,()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),powerLow?24:48,radius,5,false));}
function powerRing(root,radius,color,name='energy-ring'){const ring=addPowerPart(root,cachedPowerGeometry('ring-'+radius,()=>new THREE.TorusGeometry(radius,.028,5,powerLow?32:64)),color,8,name);return ring;}
function addClock(root,index){const g=new THREE.Group();g.name='temporal-clock';const a=index*Math.PI*2/3;g.position.set(Math.cos(a)*5,1+index*.6,Math.sin(a)*5);g.rotation.y=-a+Math.PI/2;root.add(g);powerRing(g,.83,'#aff4ff');for(let n=0;n<12;n++){const t=n*Math.PI/6;const tick=addPowerPart(g,cachedPowerGeometry('clock-tick',()=>new THREE.BoxGeometry(.035,.13,.025)),'#b7f6ff',8,'clock-tick');tick.position.set(Math.sin(t)*.7,Math.cos(t)*.7,0);tick.rotation.z=-t;}for(let n=0;n<2;n++){const hand=addPowerPart(g,cachedPowerGeometry('clock-hand-'+n,()=>new THREE.BoxGeometry(.035,n?.6:.4,.025)),'#e8ffff',8,'clock-hand');hand.position.y=n?.3:.2;hand.rotation.z=n?-.5:1.1;}}
function addTokenInstances(root,count){const geo=cachedPowerGeometry('fortune-token',()=>{const shape=new THREE.Shape();for(let i=0;i<8;i++){const a=i*Math.PI/4;const x=Math.cos(a),y=Math.sin(a);i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();return new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelSegments:1,bevelSize:.09,bevelThickness:.05,steps:1});});const tokens=new THREE.InstancedMesh(geo,powerShader('#ffd27a',9),count);tokens.name='gold-tokens';tokens.frustumCulled=false;root.add(tokens);return tokens;}
function kartProjection(root,owner,color,mode,name,z=0){if(!owner?.mesh)return null;const ghost=owner.mesh.clone(true),mat=powerShader(color,mode);ghost.traverse(o=>{if(o.isMesh){o.material=mat;o.castShadow=false;o.receiveShadow=false;}});ghost.name=name;ghost.position.set(0,-1.1,z);ghost.rotation.set(0,0,0);root.add(ghost);return ghost;}
function mirrorGeometry(){return cachedPowerGeometry('verdict-crystal',()=>{const sh=new THREE.Shape();sh.moveTo(0,-1.2);sh.lineTo(-.73,-.28);sh.lineTo(-.57,.9);sh.lineTo(.43,1.12);sh.lineTo(.78,.18);sh.closePath();return new THREE.ExtrudeGeometry(sh,{depth:.1,bevelEnabled:true,bevelSegments:1,bevelSize:.09,bevelThickness:.09,steps:1});});}
function removePowerEffect(fx){scene.remove(fx.mesh);const mats=new Set();fx.mesh.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);if(o.userData.ownedGeometry)o.geometry?.dispose();if(o.isInstancedMesh)o.dispose?.();});mats.forEach(m=>m.dispose());}
function clearPowerEffects(){while(powerEffects.length)removePowerEffect(powerEffects.pop());}
function spawnPowerEffect(kind,u,lat,color,owner){
 if(powerEffects.length>=POWER_CAP)removePowerEffect(powerEffects.shift());
 color=referencePowerColors[kind]||color;
 const mesh=new THREE.Group(),duration={zenflow:4,hybrid:3.5,nexus:8,kinetic:4,juris:4,loom:5,aether:5,animus:4,helix:5,'animus-pulse':.9,ledger:4,terra:3.5,obsidian:4,civic:5,cognara:4,gaia:5,nomad:1.2,eon:5}[kind]||1.2;
 if(kind==='zenflow'){const dome=addPowerPart(mesh,cachedPowerGeometry('dome',()=>new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*.62)),color,0,'time-dome');dome.scale.set(8,3,8);dome.position.y=-1;addPowerInstances(mesh,color,'clock-fragments',powerLow?12:24);for(let n=0;n<3;n++)addClock(mesh,n);for(let n=0;n<3;n++){const ring=powerRing(mesh,7-n*.6,color);ring.rotation.x=Math.PI/2;ring.position.y=n*.85-.6;}}
 else if(kind==='hybrid'){kartProjection(mesh,owner,color,1,'phase-ghost');kartProjection(mesh,owner,'#ffc67e',1,'phase-echo',3);for(let i=0;i<3;i++){const veil=addPowerPart(mesh,ribbonGeometry('phase-veil-'+i,.4,1.3+i*.25,7,.24),color,1,'veil');veil.rotation.z=i*2.1;}}
 else if(kind==='nexus'){if(!kartProjection(mesh,owner,color,2,'hologram-kart'))addPowerPart(mesh,silhouetteGeometry(),color,2,'hologram-human');const sheet=addPowerPart(mesh,cachedPowerGeometry('scan-sheet',()=>new THREE.PlaneGeometry(4,4,1,24)),color,2,'scan-sheet');sheet.position.z=.5;sheet.position.y=1;const ring=powerRing(mesh,2.2,color);ring.rotation.x=Math.PI/2;ring.position.y=-.9;}
 else if(kind==='kinetic'){for(let i=0;i<3;i++){const flame=addPowerPart(mesh,ribbonGeometry('flame-'+i,.25+i*.15,.35+i*.1,6+i*1.5,.42),i===1?'#fff1ba':color,3,'flame');flame.position.set((i-1)*.7,-.5,1.3);}}
 else if(kind==='juris'){for(let i=0;i<6;i++){const group=new THREE.Group(),a=i*Math.PI/3;group.name='shield-facet';group.position.set(Math.sin(a)*2.8,.5,Math.cos(a)*2.8);group.rotation.y=a;mesh.add(group);addPowerPart(group,mirrorGeometry(),'#dce9ff',4,'mirror-face');const edge=new THREE.LineSegments(cachedPowerGeometry('mirror-edges',()=>new THREE.EdgesGeometry(mirrorGeometry())),new THREE.LineBasicMaterial({color,transparent:true,opacity:.95}));group.add(edge);}}
 else if(kind==='signal'){for(let i=0;i<2;i++){const beam=addPowerPart(mesh,ribbonGeometry('sonic-'+i,.02,.12,34,.14),color,5,'sonic-beam');beam.rotation.y=Math.PI;beam.rotation.z=i*Math.PI/2;}for(let n=0;n<(powerLow?6:10);n++){const ring=powerRing(mesh,1.75,color,'sonic-wavefront');ring.position.z=-3-n*3;ring.scale.setScalar(1-n*.075);ring.userData.wave=n;}}
 else if(kind==='loom'){for(let i=0;i<3;i++){const braid=addPowerPart(mesh,ribbonGeometry('braid',2,1.25,14,.19),i===1?'#efffc9':color,7,'braided-thread');braid.rotation.z=i*Math.PI*2/3;braid.position.y=-.5;}}
 else if(kind==='vector'){const arc=cachedPowerGeometry('portal-crescent',()=>new THREE.TorusGeometry(1.9,.16,6,36,Math.PI*1.35));for(let i=0;i<2;i++){const portal=addPowerPart(mesh,arc,color,5,'portal-crescent');portal.position.x=(i-.5)*5;portal.rotation.z=i*Math.PI;}}
 else if(kind==='collective'){addTokenInstances(mesh,powerLow?12:24);for(let side=0;side<2;side++){const stream=addPowerPart(mesh,powerCurve('siphon-'+side,[[0,0,0],[(side?1:-1)*2,1,0],[(side?1:-1)*4,3,1],[(side?1:-1)*6,3.6,3]],.065),color,8,'siphon-arc');}const funnel=addPowerPart(mesh,ribbonGeometry('fortune-funnel',1.5,4,1,.24),color,6,'fortune-stream');funnel.rotation.x=Math.PI/2;}
 else if(kind==='aether'){addTokenInstances(mesh,powerLow?12:24);for(let i=0;i<2;i++){const orbit=addPowerPart(mesh,ribbonGeometry('magnet-orbit',.85,4,1,.065),color,5,'magnet-orbit');orbit.rotation.x=Math.PI/2;orbit.rotation.z=i*Math.PI;}}
 else if(kind==='animus'){const body=cachedPowerGeometry('drone-body',()=>new THREE.LatheGeometry([new THREE.Vector2(0,-.55),new THREE.Vector2(.2,-.48),new THREE.Vector2(.65,-.1),new THREE.Vector2(.72,.08),new THREE.Vector2(.4,.26),new THREE.Vector2(0,.4)],16));const drone=new THREE.Group();drone.name='sentinel-drone';drone.position.y=2.3;mesh.add(drone);const armor=new THREE.Mesh(body,new THREE.MeshStandardMaterial({color:'#e1f3ff',metalness:.7,roughness:.22}));armor.rotation.x=Math.PI/2;drone.add(armor);const eye=addPowerPart(drone,cachedPowerGeometry('sentinel-eye',()=>new THREE.SphereGeometry(.25,16,10)),color,8,'sentinel-eye');eye.position.z=-.48;const iris=powerRing(drone,.36,color);iris.position.z=-.42;for(let side=0;side<2;side++)for(let feather=0;feather<3;feather++){const sign=side?1:-1;addPowerPart(drone,powerCurve('sentinel-feather-'+side+'-'+feather,[[sign*.5,0,0],[sign*.85,.05+feather*.13,.12],[sign*(1.7-feather*.18),.55+feather*.12,.5]],.075),color,8,'sentinel-feather');}for(let i=0;i<2;i++){const wing=addPowerPart(mesh,ribbonGeometry('drone-wing',.3,.7,1.6,.16),color,5,'drone-wing');wing.position.y=2.3;wing.rotation.y=i*Math.PI+Math.PI/2;}addPowerInstances(mesh,color,'drone-motes',10);}
 else if(kind==='animus-pulse'){const ring=powerRing(mesh,1.3,color,'pulse-ring');ring.rotation.x=Math.PI/2;ring.position.y=-.55;addPowerInstances(mesh,color,'pulse-motes',powerLow?6:10);}
 else if(kind==='helix'){for(let i=0;i<2;i++){const strand=addPowerPart(mesh,ribbonGeometry('dna-strand',2,1.25,4,.11),i?'#eeffff':color,7,'dna-strand');strand.rotation.x=-Math.PI/2;strand.rotation.z=i*Math.PI;strand.position.y=-1;}addPowerInstances(mesh,'#ffb4e3','healing-petals',powerLow?16:30);const ring=powerRing(mesh,2,color);ring.rotation.x=Math.PI/2;ring.position.y=-.8;}
 addWaveTwoPower(mesh,kind,color,owner);
 addPowerMechanism(mesh,kind,color);
 scene.add(mesh);powerEffects.push({kind,u,lat,owner,mesh,life:duration,duration});
}
function stepPowerEffects(dt){for(let i=powerEffects.length-1;i>=0;i--){const f=powerEffects[i];
 const zoneKind={nexus:'decoy',loom:'snare',gaia:'roots'}[f.kind];
 if(zoneKind&&f.owner&&typeof abilityZones!=='undefined'){const zone=abilityZones.find(z=>z.kind===zoneKind&&z.owner===f.owner&&z.life>0);if(!zone){removePowerEffect(f);powerEffects.splice(i,1);continue;}f.u=zone.u;f.lat=zone.lat;f.life=Math.min(f.life,zone.life+dt);}
 f.life-=dt;if(f.life<=0){removePowerEffect(f);powerEffects.splice(i,1);continue;}
 const age=f.duration-f.life,motion=powerReduced?.25:1,clock=age*motion,follow=!['nexus','loom','signal','collective','vector','gaia','nomad'].includes(f.kind);if(follow&&f.owner){f.u=f.owner.u;f.lat=f.owner.lat;}
 orientOnTrack(f.mesh,f.u,f.lat,1.1,0);
 stepWaveTwoGeometry(f,dt,clock);
 f.mesh.traverse(p=>{if(p.material?.uniforms){p.material.uniforms.time.value=clock;p.material.uniforms.fade.value=Math.min(1,f.life*2,age*5+.2);}
  if(p.isInstancedMesh&&!p.userData.staticPowerDetail){for(let n=0;n<p.count;n++){const t=n/p.count,a=t*Math.PI*2+clock*1.6;let radius=2,up=0;powerDummy.rotation.set(clock+n,clock*.7+n,0);powerDummy.scale.setScalar(.16);
   if(f.kind==='helix'||f.kind==='eon'){radius=1.4;up=((clock+n*.19)%3.8)-.8;powerDummy.scale.set(.14,.3,.14);}
   else if(f.kind==='collective'){radius=Math.max(.15,6*(1-(age*.9+t)%1));up=.3+Math.sin(a)*.5;powerDummy.scale.setScalar(.25+t*.12);}
   else if(f.kind==='ledger'){radius=2.8;up=.35+Math.sin(a*3)*.18;powerDummy.scale.setScalar(.25);powerDummy.rotation.z=0;}
   else if(f.kind==='gaia'){radius=2;up=-.7+Math.sin(a)*.2;powerDummy.scale.set(.2,.4,.2);}
   else if(f.kind==='aether'){radius=1+((1-t-clock*.35)%1+1)%1*6;up=Math.sin(a*2)*.65;powerDummy.scale.setScalar(.25+t*.15);powerDummy.rotation.z=-a;}
   else if(f.kind==='zenflow'){radius=6+Math.sin(n*3)*2;up=-.6+((n*.41+clock*.2)%2.2);powerDummy.scale.set(.09,.22,.09);}
   else{radius=1.4;up=2.1+Math.sin(a)*.3;powerDummy.scale.setScalar(.12);}
   powerDummy.position.set(Math.cos(a)*radius,up,Math.sin(a)*radius);powerDummy.updateMatrix();p.setMatrixAt(n,powerDummy.matrix);}p.instanceMatrix.needsUpdate=true;
  }
  if(p.name==='sentinel-rotor')p.rotation.y=clock*22;
  if(p.name==='sonic-wavefront'){p.position.z=-3-p.userData.wave*3-(clock*9)%3;}
  if(p.name==='phase-echo'){p.position.z=3+Math.sin(clock*2)*.4;}
  if(p.name==='phase-ghost')p.position.x=Math.sin(clock*5)*.12;
  if(p.name==='hologram-human')p.position.y=.1+Math.sin(clock*2)*.08;
  if(p.name==='scan-sheet')p.rotation.y=Math.sin(clock)*.2;
  if(p.name==='shield-facet')p.position.y=Math.sin(clock*2+p.rotation.y)*.08;
  if(p.name==='portal-crescent')p.rotation.z+=dt*motion*1.5;
  if(p.name==='fortune-stream')p.scale.setScalar(Math.max(.1,1-age*.65));
  if(p.name==='magnet-orbit')p.rotation.z+=dt*motion;
  if(p.name==='pulse-ring'){const grow=1+age*3.2;p.scale.set(grow,grow,1);}
  if(p.name==='sentinel-drone'||p.name==='drone-wing')p.position.y=2.3+Math.sin(clock*3)*.18;
 });}}

// Readable source hardware and cross-bracing ground the signature effects in 3D.
// These meshes reuse immutable geometry and participate in the emitter's teardown.
function addPowerMechanism(root,kind,color){
 if(kind==='helix'){
  const rungs=new THREE.InstancedMesh(cachedPowerGeometry('dna-crosslinks',()=>new THREE.CylinderGeometry(.035,.035,2.5,5)),powerShader('#e5fff4',7),12);
  rungs.name='dna-base-pairs';rungs.userData.staticPowerDetail=true;
  for(let i=0;i<12;i++){const t=(i+.5)/12,a=t*Math.PI*4;powerDummy.position.set(0,-1+t*4,0);powerDummy.rotation.set(Math.PI/2,0,a);powerDummy.scale.set(1,Math.sin(t*Math.PI)*.5+.5,1);powerDummy.updateMatrix();rungs.setMatrixAt(i,powerDummy.matrix);}root.add(rungs);
 }else if(kind==='animus'){
  const drone=root.getObjectByName('sentinel-drone');if(!drone)return;
  for(const side of [-1,1]){
   const nacelle=new THREE.Mesh(cachedPowerGeometry('sentinel-nacelle',()=>new THREE.TorusGeometry(.42,.085,6,20)),new THREE.MeshStandardMaterial({color:0x364553,metalness:.8,roughness:.36}));nacelle.rotation.x=Math.PI/2;nacelle.position.set(side*.86,.12,.1);drone.add(nacelle);
   const rotor=new THREE.Group();rotor.name='sentinel-rotor';rotor.position.copy(nacelle.position);drone.add(rotor);
   for(let i=0;i<3;i++){const blade=new THREE.Mesh(cachedPowerGeometry('sentinel-rotor-blade',()=>new THREE.BoxGeometry(.055,.018,.68)),new THREE.MeshStandardMaterial({color:0x8da0aa,metalness:.7,roughness:.38}));blade.rotation.y=i*Math.PI/3;rotor.add(blade);}
  }
 }else if(kind==='signal'){
  for(let i=0;i<3;i++){
   const arc=addPowerPart(root,powerCurve('sonic-ion-branch-'+i,[[0,0,-2],[.25-i*.18,.1,-5],[.6-i*.3,.35,-8],[.15,-.1,-10],[.45-i*.35,.25,-14],[0,0,-20]],.023),i===1?'#fff4e7':color,5,'sonic-ion-filament');arc.rotation.z=i*Math.PI*2/3;
  }
 }
}

// Wave 2 signatures use the exact spec durations and retain a distinct silhouette.
function addWaveTwoPower(root,kind,color,owner){
 const solid=(geo,c,name)=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:c,metalness:.62,roughness:.3,transparent:true}));m.name=name;root.add(m);return m;};
 if(kind==='ledger'){
  addTokenInstances(root,powerLow?8:12);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,g=new THREE.Group();g.name='vault-lock';g.position.set(Math.sin(a)*3,.15,Math.cos(a)*3);g.rotation.y=a;root.add(g);
   const shackle=powerRing(g,.21,color,'vault-shackle');shackle.position.y=.44;
   const lock=addPowerPart(g,cachedPowerGeometry('vault-lock',()=>new THREE.BoxGeometry(.56,.45,.16)),color,4,'locked-token');lock.position.y=.14;
   const rib=addPowerPart(root,powerCurve('vault-rib-'+i,[[Math.sin(a)*3,-1,Math.cos(a)*3],[Math.sin(a)*3,1.8,Math.cos(a)*3],[Math.sin(a)*1.4,2.4,Math.cos(a)*1.4]],.07),color,4,'hex-vault-cage');
  }for(const y of [-.8,1.8]){const ring=addPowerPart(root,cachedPowerGeometry('hex-vault-ring',()=>new THREE.TorusGeometry(3,.065,5,6)),color,4,'vault-hex');ring.rotation.x=Math.PI/2;ring.position.y=y;}
 }else if(kind==='terra'){
  for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2,x=Math.sin(a)*2,z=Math.cos(a)*2;
   const column=solid(cachedPowerGeometry('anchor-column',()=>new THREE.CylinderGeometry(.13,.24,2.7,8)),'#334b68','anchor-pylon');column.position.set(x,.2,z);
   const foot=solid(cachedPowerGeometry('anchor-foot',()=>new THREE.CylinderGeometry(.34,.46,.3,8)),'#889cae','anchor-foot');foot.position.set(x,-1,z);
   for(let n=0;n<3;n++){const ring=powerRing(root,.3,color,'pylon-ring');ring.rotation.x=Math.PI/2;ring.position.set(x,-.5+n*.65,z);}
  }
 }else if(kind==='obsidian'){
  const shape=new THREE.Shape();shape.moveTo(0,1.65);shape.lineTo(-.9,.6);shape.lineTo(-.6,-.85);shape.lineTo(0,-1.15);shape.lineTo(.6,-.85);shape.lineTo(.9,.6);shape.closePath();
  const geo=cachedPowerGeometry('perimeter-chevron',()=>new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:1,steps:1}));
  for(let i=0;i<6;i++){const a=i*Math.PI/3,g=new THREE.Group();g.position.set(Math.sin(a)*2.7,.15,Math.cos(a)*2.7);g.rotation.y=a;g.name='shield-facet';root.add(g);
   const panel=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#1d2633',metalness:.8,roughness:.24,transparent:true,opacity:.96}));g.add(panel);
   const edge=new THREE.LineSegments(cachedPowerGeometry('perimeter-chevron-edge',()=>new THREE.EdgesGeometry(geo)),new THREE.LineBasicMaterial({color,transparent:true}));g.add(edge);
   const slash=addPowerPart(g,powerCurve('perimeter-v',[[ -.65,.6,-.07],[0,.02,-.1],[.65,.6,-.07]],.065),color,4,'perimeter-edge');
  }
 }else if(kind==='civic'){
  // Dynamic line vertices are owned by this emitter (not the immutable cache).
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(33*3),3));
  const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));line.name='civic-beneficiary';line.userData.ownedGeometry=true;line.frustumCulled=false;root.add(line);
  for(let i=0;i<2;i++){const ribbon=addPowerPart(root,ribbonGeometry('shared-slip-'+i,.18,.7,9,.12),color,1,'shared-slip');ribbon.position.set(i?1.2:-1.2,-.7,1);}
 }else if(kind==='cognara'){
  for(let i=0;i<2;i++){const orb=addPowerPart(root,cachedPowerGeometry('predict-sensor',()=>new THREE.SphereGeometry(.13,12,8)),color,8,'neural-sensor');orb.position.set(i?.48:-.48,1.2,-.3);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(49*3),3));
  const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.85}));line.name='predictive-road-line';line.userData.ownedGeometry=true;line.frustumCulled=false;root.add(line);
 }else if(kind==='gaia'){
  for(let i=0;i<5;i++){const pts=[];for(let n=0;n<=18;n++){const z=-7+n*14/18;pts.push([(i-2)*.8+Math.sin(n*.85+i)*.4,-.91+Math.sin(n+i)*.08,z]);}
   const vine=addPowerPart(root,powerCurve('root-braid-'+i,pts,.065),i%2?'#205c30':color,7,'root-net-vine');}
  addPowerInstances(root,'#c4ffa0','root-leaves',powerLow?12:22);
 }else if(kind==='nomad'){
  for(const z of [0,-6]){const ring=addPowerPart(root,cachedPowerGeometry('waypoint-disc',()=>new THREE.TorusGeometry(1.8,.12,8,48)),color,5,'waypoint-portal');ring.position.z=z;
   for(let i=0;i<8;i++){const a=i*Math.PI/4;const tick=addPowerPart(root,cachedPowerGeometry('waypoint-marker',()=>new THREE.BoxGeometry(.12,.3,.1)),color,9,'waypoint-marker');tick.position.set(Math.sin(a)*2,Math.cos(a)*2,z);tick.rotation.z=-a;}}
 }else if(kind==='eon'){
  const pts=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;pts.push([Math.sin(a)*2.2,Math.sin(a*2)*.75+.45,Math.cos(a)*.25]);}
  addPowerPart(root,powerCurve('infinity-loop',pts,.065),color,7,'infinity-ring');addPowerInstances(root,'#b9fff8','second-wind-petals',powerLow?16:28);
 }
}
function stepWaveTwoGeometry(f,dt,clock){
 const fade=Math.min(1,f.life*2,(f.duration-f.life)*5+.2);
 f.mesh.traverse(p=>{if(p.material&&!p.material.uniforms&&p.material.transparent)p.material.opacity=fade;
  if(p.name==='pylon-ring')p.scale.setScalar(1+Math.sin(clock*4+p.position.y)*.06);
  if(p.name==='waypoint-portal')p.rotation.z=clock*2;
 });
 if((f.kind!=='cognara'&&f.kind!=='civic')||!f.owner)return;
 const line=f.mesh.getObjectByName(f.kind==='civic'?'civic-beneficiary':'predictive-road-line');if(!line)return;
 if(typeof track==='undefined'||!track||typeof trackPoint!=='function')return;
 let target=null;
 if(f.kind==='civic'&&typeof game!=='undefined')target=game.racers.filter(r=>r!==f.owner&&!r.finished&&Math.abs(du_dist(f.owner.u,r.u))<14&&Math.abs(r.lat-f.owner.lat)<4).sort((a,b)=>Math.abs(du_dist(f.owner.u,a.u))-Math.abs(du_dist(f.owner.u,b.u)))[0];
 line.visible=f.kind==='cognara'||!!target;if(!line.visible)return;
 f.mesh.updateMatrixWorld(true);const inverse=new THREE.Matrix4().copy(f.mesh.matrixWorld).invert(),v=new THREE.Vector3(),a=line.geometry.attributes.position;
 const distance=target?du_dist(f.owner.u,target.u):24;
 for(let i=0;i<a.count;i++){const t=i/(a.count-1),u=((f.owner.u+distance*t/track.len)%1+1)%1,lat=target?f.owner.lat+(target.lat-f.owner.lat)*t:f.owner.lat*(1-t*.7);
  trackPoint(u,lat,target?.7+Math.sin(t*Math.PI):.13,v);v.applyMatrix4(inverse);a.setXYZ(i,v.x,v.y,v.z);}
 a.needsUpdate=true;
}
