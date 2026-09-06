/* Division VFX. Analytic ribbon shaders and bounded instancing follow the
   Zukan Arena ElementalVfx architecture: one emitter owns materials, shared
   immutable meshes, deterministic motion, explicit expiry and mobile caps. */
const powerEffects=[],powerShapes={};
const powerLow=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
const powerReduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion:reduce)').matches;
const POWER_CAP=powerLow?12:24;
const powerDummy=new THREE.Object3D();
// Reference colors remain readable and consistent regardless of chassis paint.
const referencePowerColors={zenflow:'#69dcff',collective:'#70ff9a',hybrid:'#68cfff',nexus:'#ffc369',kinetic:'#74ffac',juris:'#ffcf68',signal:'#ff508f',loom:'#b45aff',vector:'#c8efff',aether:'#ffd27a',animus:'#66edff',helix:'#6affcb'};
function cachedPowerGeometry(key,build){return powerShapes[key]||(powerShapes[key]=build());}
function ribbonGeometry(key,turns=2,radius=1,length=8,width=.22){return cachedPowerGeometry(key,()=>{const points=[],uv=[],indices=[],segments=64;for(let i=0;i<=segments;i++){const t=i/segments,a=t*turns*Math.PI*2,r=radius*(.5+.5*Math.sin(t*Math.PI));for(const side of [-1,1]){points.push(Math.cos(a)*(r+side*width),Math.sin(a)*(r+side*width),t*length);uv.push(t,(side+1)/2);}if(i<segments){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;});}
function powerShader(color,mode=0){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:mode===3?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{time:{value:0},fade:{value:1},tint:{value:new THREE.Color(color)},mode:{value:mode}},vertexShader:`varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;uniform float time;uniform float mode;
void main(){vUv=uv;vec3 p=position;if(mode==3.)p.x+=sin(p.z*4.-time*12.)*.12*(1.+p.z*.1);if(mode==7.)p.y+=sin(p.z*2.-time*4.)*.15;vec4 local=vec4(p,1.);
#ifdef USE_INSTANCING
local=instanceMatrix*local;
#endif
vec4 view=modelViewMatrix*local;vNormal=normalize(normalMatrix*normal);vView=normalize(-view.xyz);gl_Position=projectionMatrix*view;}`,fragmentShader:`uniform vec3 tint;uniform float time;uniform float fade;uniform float mode;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.);float a=.7;vec3 color=tint;
if(mode==0.){float lines=pow(.5+.5*sin(vUv.y*95.-time*3.),8.);a=.08+lines*.35+rim*.35;}
else if(mode==1.){a=.1+rim*.65;color=mix(tint,vec3(.8,1.,1.),rim);}
else if(mode==2.){float scan=step(.45,fract(vUv.y*65.-time*1.5));a=(.15+scan*.6)*(.7+.3*sin(time*7.));color=mix(tint,vec3(1.),scan*.4);}
else if(mode==3.){float edge=pow(max(0.,sin(vUv.y*3.14159)),.7);float tongues=.55+.45*sin(vUv.x*38.-time*13.+sin(vUv.y*12.));a=edge*tongues*(1.-vUv.x);color=mix(vec3(1.,.9,.65),tint,vUv.x);}
else if(mode==4.){a=.18+rim*.6;color=mix(tint,vec3(1.),rim*.7);}
else if(mode==5.){a=pow(max(0.,sin(vUv.y*3.14159)),2.)*(.4+.6*pow(.5+.5*sin(vUv.x*28.-time*12.),4.));color=mix(tint,vec3(1.),.4);}
else if(mode==6.){a=.8*(.6+.4*sin(time*5.+vUv.x*8.));}
else if(mode==7.){a=sin(vUv.y*3.14159)*.8;}
else if(mode==9.){float r=length(vUv-.5);a=.95;color=mix(tint,vec3(1.,.96,.7),rim*.6);}
else{a=.7+rim*.25;}gl_FragColor=vec4(color,a*fade);}`});}
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
function removePowerEffect(fx){scene.remove(fx.mesh);const mats=new Set();fx.mesh.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);if(o.isInstancedMesh)o.dispose?.();});mats.forEach(m=>m.dispose());}
function clearPowerEffects(){while(powerEffects.length)removePowerEffect(powerEffects.pop());}
function spawnPowerEffect(kind,u,lat,color,owner){
 if(powerEffects.length>=POWER_CAP)removePowerEffect(powerEffects.shift());
 color=referencePowerColors[kind]||color;
 const mesh=new THREE.Group(),duration={zenflow:4,hybrid:3.5,nexus:8,kinetic:4,juris:4,loom:5,aether:5,animus:4,helix:5}[kind]||1.2;
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
 else if(kind==='helix'){for(let i=0;i<2;i++){const strand=addPowerPart(mesh,ribbonGeometry('dna-strand',2,1.25,4,.11),i?'#eeffff':color,7,'dna-strand');strand.rotation.x=-Math.PI/2;strand.rotation.z=i*Math.PI;strand.position.y=-1;}addPowerInstances(mesh,'#ffb4e3','healing-petals',powerLow?16:30);const ring=powerRing(mesh,2,color);ring.rotation.x=Math.PI/2;ring.position.y=-.8;}
 scene.add(mesh);powerEffects.push({kind,u,lat,owner,mesh,life:duration,duration});
}
function stepPowerEffects(dt){for(let i=powerEffects.length-1;i>=0;i--){const f=powerEffects[i];f.life-=dt;if(f.life<=0){removePowerEffect(f);powerEffects.splice(i,1);continue;}
 const age=f.duration-f.life,motion=powerReduced?.25:1,clock=age*motion,follow=!['nexus','loom','signal','collective','vector'].includes(f.kind);if(follow&&f.owner){f.u=f.owner.u;f.lat=f.owner.lat;}
 orientOnTrack(f.mesh,f.u,f.lat,1.1,0);
 f.mesh.traverse(p=>{if(p.material?.uniforms){p.material.uniforms.time.value=clock;p.material.uniforms.fade.value=Math.min(1,f.life*2,age*5+.2);}
  if(p.isInstancedMesh){for(let n=0;n<p.count;n++){const t=n/p.count,a=t*Math.PI*2+clock*1.6;let radius=2,up=0;powerDummy.rotation.set(clock+n,clock*.7+n,0);powerDummy.scale.setScalar(.16);
   if(f.kind==='helix'){radius=1.4;up=((clock+n*.19)%3.8)-.8;powerDummy.scale.set(.14,.3,.14);}
   else if(f.kind==='collective'){radius=Math.max(.15,6*(1-(age*.9+t)%1));up=.3+Math.sin(a)*.5;powerDummy.scale.setScalar(.25+t*.12);}
   else if(f.kind==='aether'){radius=1+((1-t-clock*.35)%1+1)%1*6;up=Math.sin(a*2)*.65;powerDummy.scale.setScalar(.25+t*.15);powerDummy.rotation.z=-a;}
   else if(f.kind==='zenflow'){radius=6+Math.sin(n*3)*2;up=-.6+((n*.41+clock*.2)%2.2);powerDummy.scale.set(.09,.22,.09);}
   else{radius=1.4;up=2.1+Math.sin(a)*.3;powerDummy.scale.setScalar(.12);}
   powerDummy.position.set(Math.cos(a)*radius,up,Math.sin(a)*radius);powerDummy.updateMatrix();p.setMatrixAt(n,powerDummy.matrix);}p.instanceMatrix.needsUpdate=true;
  }
  if(p.name==='sonic-wavefront'){p.position.z=-3-p.userData.wave*3-(clock*9)%3;}
  if(p.name==='phase-echo'){p.position.z=3+Math.sin(clock*2)*.4;}
  if(p.name==='phase-ghost')p.position.x=Math.sin(clock*5)*.12;
  if(p.name==='hologram-human')p.position.y=.1+Math.sin(clock*2)*.08;
  if(p.name==='scan-sheet')p.rotation.y=Math.sin(clock)*.2;
  if(p.name==='shield-facet')p.position.y=Math.sin(clock*2+p.rotation.y)*.08;
  if(p.name==='portal-crescent')p.rotation.z+=dt*motion*1.5;
  if(p.name==='fortune-stream')p.scale.setScalar(Math.max(.1,1-age*.65));
  if(p.name==='magnet-orbit')p.rotation.z+=dt*motion;
  if(p.name==='sentinel-drone'||p.name==='drone-wing')p.position.y=2.3+Math.sin(clock*3)*.18;
 });}}
