/* Racing-scale reconstructions of the two Achref El Ouafi ability collections.
 * Source anatomy/provenance: docs/addon-vfx.md. No screenshots or flat VFX cards.
 * Cast meshes follow the SAME entity as collision; contacts use paused anime.js
 * timelines advanced exclusively from simulation dt (no wall-clock callbacks).
 */
const addonEffects=[];
const ADDON_FX_CAP=powerLow?12:24;
const ADDON_FX_COLORS={ward:'#ff9854',acid:'#baff36',growth:'#ff92c5',cyber:'#41eeeb',venom:'#aa57ff',monolith:'#b9a891',ink:'#859aa8',astral:'#8c83ff',cascade:'#cb6eff',rend:'#ffe4a3',pyre:'#ff642a',kraken:'#41bbb3',electrical:'#a7c8ff','earth-spire':'#c1a082','verdant-gate':'#8bdfa8','tide-ring':'#65d9e5','fire-portal':'#ff7331','electric-boost':'#9faaff','magic-boost':'#c695ff','fire-boost':'#ff7d2d',fire:'#ff792b',water:'#67d9ff',earth:'#a28b72',wind:'#e0f7ef',missile:'#6ec9ff',mine:'#bef277',pulse:'#ffd981',ram:'#ffbd75'};
function addonSurface(color,mode=0){
 return new THREE.ShaderMaterial({transparent:mode!==1&&mode!==3,depthWrite:mode===1||mode===3,side:THREE.DoubleSide,uniforms:{time:{value:0},fade:{value:1},tint:{value:new THREE.Color(color)},mode:{value:mode}},vertexShader:`varying vec3 vP;varying vec3 vN;varying vec3 vV;varying vec2 vUv;uniform float time;uniform float mode;
 void main(){vP=position;vUv=uv;vec3 p=position;if(mode==2.)p+=normal*sin(position.y*5.+position.z*4.-time*4.)*.045;vec4 q=vec4(p,1.);vec3 n=normal;
 #ifdef USE_INSTANCING
 mat3 im=mat3(instanceMatrix);n=im*(n/vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2])));q=instanceMatrix*q;
 #endif
 vec4 v=modelViewMatrix*q;vN=normalize(normalMatrix*n);vV=normalize(-v.xyz);gl_Position=projectionMatrix*v;}`,
 fragmentShader:`varying vec3 vP;varying vec3 vN;varying vec3 vV;varying vec2 vUv;uniform vec3 tint;uniform float time;uniform float fade;uniform float mode;
 float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm(vec3 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.13)*.15;}
 void main(){float facing=abs(dot(normalize(vN),normalize(vV))),rim=pow(1.-facing,2.);vec3 p=vP*3.;float n=fbm(p-vec3(0,time*2.,time*.5));float a=.72;vec3 c=tint;
 if(mode==1.){float heat=fbm(p*vec3(2.1,.48,2.1)-vec3(0,time*3.5,0)+n*2.);c=mix(vec3(.07,.013,.009),tint,smoothstep(.22,.54,heat));c=mix(c,vec3(1.,.94,.7),smoothstep(.53,.76,heat)+rim*.18);a=1.;}
 else if(mode==2.){float foam=pow(noise(p*2.-vec3(0,time,0)),5.);c=mix(tint*.26,tint,.4+rim*.6)+foam*1.4;a=.42+rim*.45+foam;}
 else if(mode==3.){float light=max(0.,dot(normalize(vN),normalize(vec3(-.5,.8,.3))));c=mix(vec3(.008,.013,.025),tint*.13,light)+tint*rim*.35;float cracks=pow(1.-abs(sin(vP.y*24.+n*8.)),18.);c+=tint*cracks*.4;a=1.;}
 else if(mode==4.){float filament=pow(.5+.5*sin(vUv.x*60.+n*9.-time*7.),14.);c=tint*(.6+filament)+vec3(.8)*filament;a=.03+rim*.5+filament*.5;}
 else if(mode==5.){c=mix(tint*.12,tint,n);a=pow(n,2.)*facing*.45;}
 else{c=mix(tint*.25,tint,rim)+tint*pow(n,5.)*3.;a=.08+rim*.7;}
 if(fade<.98&&noise(vP*20.)>fade)discard;gl_FragColor=vec4(c,a*fade);}`});
}
function addonPart(root,geometry,material,name,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);root.add(m);return m;}
function addonStone(color='#474950'){return new THREE.MeshStandardMaterial({color,roughness:.89,metalness:.09,transparent:true});}
function addonCrystalGeometry(){return cachedPowerGeometry('addon-crystal',()=>{const shape=new THREE.Shape();shape.moveTo(-.35,0);shape.lineTo(-.48,.5);shape.lineTo(-.13,1.8);shape.lineTo(.14,2.1);shape.lineTo(.4,.65);shape.lineTo(.27,0);shape.closePath();return new THREE.ExtrudeGeometry(shape,{depth:.38,bevelEnabled:true,bevelThickness:.05,bevelSize:.04,bevelSegments:1,steps:1});});}
function addonSlabGeometry(){return cachedPowerGeometry('addon-slab',()=>{const geo=new THREE.BoxGeometry(1,2,1,1,2,1),a=geo.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);a.setXYZ(i,x*(1+.12*Math.sin(y*5+z*3)),y+.08*Math.sin(x*12+z*8),z*(1+.14*Math.sin(y*8+x*4)));}geo.computeVertexNormals();return geo;});}
function addonCluster(root,color,type='crystal',count=12,radius=2.5){const geo=type==='stone'?addonSlabGeometry():addonCrystalGeometry(),mat=type==='stone'?addonStone(color):addonSurface(color,type==='fire'?1:0),m=new THREE.InstancedMesh(geo,mat,count);m.name=type+'-crown';m.frustumCulled=false;const placements=[];
 for(let i=0;i<count;i++){const a=i/count*Math.PI*2,r=radius*(.88+.14*Math.sin(i*12.3)),s=.6+.35*Math.sin(i*5.7);powerDummy.position.set(Math.sin(a)*r,-.7,Math.cos(a)*r);powerDummy.rotation.set(Math.cos(a)*.28,a,Math.sin(a)*-.28);powerDummy.scale.set(.6,s+.55,.6);powerDummy.updateMatrix();m.setMatrixAt(i,powerDummy.matrix);placements.push({a,r,s});}root.add(m);return m;}
function addonFloor(root,color,radius=3,mode=4,name='ground-current'){const disc=addonPart(root,cachedPowerGeometry('addon-disc',()=>new THREE.CircleGeometry(1,powerLow?32:64)),addonSurface(color,mode),name,0,-.87,0);disc.rotation.x=-Math.PI/2;disc.scale.setScalar(radius);return disc;}
function addonRing(root,color,radius,y=-.72,name='pressure-ring'){const ring=powerRing(root,radius,color,name);ring.rotation.x=Math.PI/2;ring.position.y=y;return ring;}
function addonFilaments(root,color,name,count=3,length=7,radius=.6){for(let i=0;i<count;i++){const ribbon=addPowerPart(root,ribbonGeometry('addon-'+name+'-'+i,1+i*.2,radius,length,.055),color,5,name);ribbon.rotation.z=i*Math.PI*2/count;}}
function addonArms(root,color,count=6){for(let i=0;i<count;i++){const a=i/count*Math.PI*2,pts=[];for(let n=0;n<=18;n++){const t=n/18,r=1.6+t*1.8;pts.push([Math.cos(a)*r+Math.sin(t*5)*.2,-.8+Math.sin(t*Math.PI)*2.5+t*.7,Math.sin(a)*r]);}const arm=addonPart(root,powerCurve('kraken-arm-'+i,pts,.13),addonSurface(color,2),'kraken-tentacle');arm.userData.arm=i;
 for(let n=0;n<5;n++){const t=.1+n*.16,p=pts[Math.round(t*18)];const cup=powerRing(root,.1,'#bfe4d3','kraken-sucker');cup.position.set(p[0],p[1]-.08,p[2]);cup.rotation.x=Math.PI/2;}}
}
function buildAddonSignature(root,id,color){
 const sphere=cachedPowerGeometry('addon-sphere',()=>new THREE.SphereGeometry(1,powerLow?16:24,powerLow?10:16));
 if(id==='ward'){
  addonCluster(root,'#292333','stone',powerLow?8:12,2.8);const cage=addonPart(root,cachedPowerGeometry('ward-cylinder',()=>new THREE.CylinderGeometry(2.65,2.65,2.7,48,1,true)),addonSurface(color,4),'ward-rune-barrier',0,.3);addonFloor(root,color,3.1);addonRing(root,color,2.8);
 }else if(id==='acid'){
  addonFloor(root,color,3.8,2,'acid-pool');for(let i=0;i<5;i++){const bubble=addonPart(root,sphere,addonSurface(color,2),'acid-boil',Math.sin(i*2.4)*2,-.65,Math.cos(i*2.4)*2);bubble.scale.setScalar(.22+i*.045);bubble.userData.seed=i;}
  const mist=addonPart(root,sphere,addonSurface(color,5),'toxic-mist');mist.scale.set(3.3,1.6,3.3);addonRing(root,color,3.6);
 }else if(id==='growth'){
  for(let i=0;i<6;i++){const a=i*Math.PI/3;addPowerPart(root,powerCurve('bloom-vine-'+i,[[Math.cos(a)*2,-.85,Math.sin(a)*2],[Math.cos(a)*1.4,.9,Math.sin(a)*1.4],[Math.cos(a)*.7,2,Math.sin(a)*.7],[0,2.7,0]],.075),'#4fbd6b',7,'bloom-vine');}
  const flower=new THREE.Group();flower.name='arbor-flower';flower.position.y=2.6;root.add(flower);
  for(let i=0;i<8;i++){const petal=addPowerPart(flower,mirrorGeometry(),i%2?color:'#ffe7e1',7,'arbor-petal');const a=i*Math.PI/4;petal.position.set(Math.sin(a)*.65,0,Math.cos(a)*.65);petal.rotation.set(Math.PI/2+.4,a,0);petal.scale.set(.5,.7,.5);}
  const core=addonPart(flower,sphere,addonSurface('#ffffcc',0),'bloom-pistil');core.scale.setScalar(.35);addonFloor(root,'#67c893',2.8);
 }else if(id==='cyber'){
  const pts=[];for(let n=0;n<=32;n++){const t=n/32;pts.push([Math.sin(t*10)*.65*(1-t),Math.sin(t*6)*.25,1+t*8]);}
  const body=addonPart(root,powerCurve('cyber-spine',pts,.23),addonSurface(color,4),'cyber-serpent');
  const head=addonPart(root,addonCrystalGeometry(),addonSurface(color,3),'cyber-head',0,.12,.3);head.rotation.x=-Math.PI/2;head.scale.set(.8,.65,.8);
  for(const x of [-.2,.2]){const eye=addonPart(root,sphere,powerShader('#e4ffb8',8),'serpent-eye',x,.28,-.15);eye.scale.setScalar(.055);}
  addonFilaments(root,color,'cyber-helical-wake',2,9,.42);const floor=addonFloor(root,color,3.3,4,'routed-circuit');floor.scale.set(2,7,1);
 }else if(id==='venom'){
  addonCluster(root,color,'crystal',powerLow?9:15,1.5);const core=addonPart(root,sphere,addonSurface('#ff93ec',5),'venom-kernel',0,.2);core.scale.set(2.2,1.8,2.2);addonFloor(root,'#682481',2.8,2,'venom-bloom');
 }else if(id==='monolith'){
  addonCluster(root,'#6b6660','stone',powerLow?8:13,1.7);for(let i=0;i<3;i++){const slab=addonPart(root,addonSlabGeometry(),addonStone('#8d8271'),'rift-slab',(i-1)*.9,.1,-i*.9);slab.scale.set(.8,1.8-i*.25,.6);slab.rotation.z=(i-1)*.18;}
  const dust=addonPart(root,cachedPowerGeometry('dust-torus',()=>new THREE.TorusGeometry(2.7,.35,6,32)),addonSurface('#a59685',5),'cement-dust',0,-.5);dust.rotation.x=Math.PI/2;addonFloor(root,'#211e1b',3.5,3,'rift-scar');
 }else if(id==='ink'){
  addonFloor(root,'#080d17',3.6,3,'sumi-ink-pool');for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const crest=addPowerPart(root,ribbonGeometry('ink-crest-'+i,.45,.4,2.8,.3),'#aab7c3',1,'ink-crown');crest.material.dispose();crest.material=addonSurface('#26303e',3);crest.rotation.x=-Math.PI/2;crest.rotation.z=a;crest.position.set(Math.sin(a)*2,-.5,Math.cos(a)*2);}
  addonRing(root,'#c6d2d8',3.4,-.78,'ink-foam');
 }else if(id==='astral'){
  const horizon=addonPart(root,sphere,addonSurface('#191037',3),'event-horizon',0,.8);horizon.scale.setScalar(1.15);
  for(let i=0;i<3;i++){const r=addonRing(root,color,1.8+i*.32,.8,'accretion-ring');r.rotation.x=.65+i*.4;r.rotation.y=i*.8;}
  addonCluster(root,'#a391e3','crystal',8,3);addonFloor(root,color,4.1,4,'cosmic-shock');
 }else if(id==='cascade'){
  const crown=new THREE.Group();crown.name='cascade-crown';crown.position.y=2;root.add(crown);addonCluster(crown,color,'crystal',powerLow?9:15,1.6);crown.rotation.z=Math.PI;
  for(let i=0;i<3;i++){const blade=addonPart(root,addonCrystalGeometry(),addonSurface('#e9c8ff',0),'cascade-volley',(i-1)*.7,.5,-2-i);blade.rotation.x=-Math.PI/2;blade.scale.set(.3,1,.3);}addonFloor(root,color,3,4,'baleful-mark');
 }else if(id==='rend'){
  const pillar=addonPart(root,cachedPowerGeometry('rend-pillar',()=>new THREE.CylinderGeometry(.23,.8,5.5,12,12,true)),addonSurface(color,4),'celestial-pillar',0,1.7);addonFloor(root,color,3.2,4,'rend-sigil');
  for(let i=0;i<3;i++){const tendril=addPowerPart(root,ribbonGeometry('rend-tendril-'+i,1.6,1.2,5.5,.1),color,7,'rend-tendril');tendril.rotation.x=-Math.PI/2;tendril.rotation.z=i*2.1;tendril.position.y=-.7;}const halo=addonRing(root,'#fff4ce',1.2,4.3,'rend-star');
 }else if(id==='pyre'){
  addonCluster(root,color,'fire',powerLow?12:20,2.7);const crater=addonPart(root,cachedPowerGeometry('pyre-safe-center-annulus',()=>new THREE.RingGeometry(1.5,3,48)),addonSurface(color,1),'molten-annulus',0,-.87);crater.rotation.x=-Math.PI/2;addonFilaments(root,'#ffcc83','pyre-embers',2,4,.9);for(const r of root.children.filter(o=>o.name==='pyre-embers'))r.rotation.x=-Math.PI/2;
 }else if(id==='kraken'){
  addonFloor(root,'#184955',3.7,2,'abyss-pool');addonArms(root,color,powerLow?4:6);addonRing(root,'#acf5e7',3.4,-.55,'brine-veil');
 }else if(id==='electrical'){
  const core=addonPart(root,sphere,addonSurface('#404773',3),'electrical-black-core',0,.7);core.scale.setScalar(1.4);addonFloor(root,color,3.4,4,'containment-platform');
  for(let i=0;i<(powerLow?6:10);i++){const a=i*Math.PI*2/(powerLow?6:10),pts=[];for(let n=0;n<10;n++){const t=n/9,r=1.3+t*1.8;pts.push([Math.sin(a)*r+Math.sin(n*7+i)*.17,.6+Math.sin(n*3+i)*.3,Math.cos(a)*r]);}addPowerPart(root,powerCurve('radial-bolt-'+i,pts,.032),i%2?color:'#f5f4ff',8,'radial-bolt');}
 }else if(id==='earth-spire'){
  addonCluster(root,'#4e4942','stone',9,1.6);const tower=addonPart(root,addonCrystalGeometry(),addonSurface('#9ce3e7',0),'earthen-glass-spire',0,-.8);tower.scale.set(1.4,2.8,1.4);addonFloor(root,'#58504a',3,3,'fractured-plates');
 }else if(id==='verdant-gate'||id==='tide-ring'||id==='fire-portal'){
  const portal=new THREE.Group();portal.name=id+'-arch';portal.position.y=1;root.add(portal);
  if(id!=='fire-portal')for(let i=0;i<(powerLow?10:14);i++){const a=i/(powerLow?10:14)*Math.PI*2,stone=addonPart(portal,addonSlabGeometry(),addonStone(id==='tide-ring'?'#537778':'#7b8070'),'assembled-arch-stone',Math.sin(a)*2.2,Math.cos(a)*2.2,0);stone.scale.set(.5,.3,.45);stone.rotation.z=-a;}
  const aperture=addonPart(portal,cachedPowerGeometry('portal-aperture',()=>new THREE.CircleGeometry(1,48)),addonSurface(color,id==='fire-portal'?1:2),'portal-aperture');aperture.scale.setScalar(2);
  const ring=powerRing(portal,2.08,color,'portal-lip');ring.scale.setScalar(1.03);if(id==='tide-ring')portal.rotation.x=Math.PI/2;
 }else if(id==='electric-boost'||id==='magic-boost'||id==='fire-boost'){
  const family=id.split('-')[0];for(let i=0;i<3;i++){const stream=addPowerPart(root,ribbonGeometry('boost-'+family+'-'+i,family==='electric'?.1:family==='magic'?2:.35,.25,5+i,.14),color,family==='fire'?3:5,family+'-exhaust');stream.position.set((i-1)*.65,-.45,1.1);}
  if(family==='magic')for(let i=0;i<3;i++){const ring=powerRing(root,1.2+i*.3,color,'magic-flight-ring');ring.position.z=1+i*1.3;}
  if(family==='electric')addonFilaments(root,'#f5f5ff','boost-lightning',2,5,.4);
 }else if(id==='fire'){
  const head=addonPart(root,sphere,addonSurface(color,1),'combustion-head',0,0,-.6);head.scale.set(.8,.8,1.3);for(let i=0;i<3;i++){const tail=addPowerPart(root,ribbonGeometry('fireball-tail-'+i,.25,.5,6,.35),color,3,'burning-gas-wake');tail.rotation.z=i*2.1;}
 }else if(id==='water'){
  const head=addonPart(root,sphere,addonSurface(color,2),'water-surge-head');head.scale.set(1.1,.8,1.4);for(let i=0;i<2;i++){const wave=addPowerPart(root,ribbonGeometry('water-wave-'+i,.7,.7,6,.28),color,1,'water-crest');wave.rotation.z=i*Math.PI;}
  addonFilaments(root,'#e5fcff','water-foam-trace',2,5,.8);
 }else if(id==='earth'){
  for(let i=0;i<5;i++){const rock=addonPart(root,addonSlabGeometry(),addonStone(i%2?'#766653':'#a08b72'),'earth-fracture',(i%2?-.4:.4),-.1,i*1.3);rock.rotation.set(.1*i,.4*i,.2);rock.scale.set(.7,1.1-i*.14,.7);}addonFloor(root,'#3b3028',3,3,'earth-scar');
 }else if(id==='wind'){
  for(let i=0;i<4;i++){const air=addPowerPart(root,ribbonGeometry('wind-vortex-'+i,2.1,.8+i*.12,6,.07),color,1,'wind-vortex');air.rotation.z=i*Math.PI/2;}const ring=powerRing(root,1.2,'#f0ffff','wind-pressure-head');ring.position.z=-.4;
 }
}
function buildAddonProjectileSignature(root,id,color){
 if(id==='growth'||id==='cascade'){
  const blade=addonPart(root,addonCrystalGeometry(),addonSurface(id==='growth'?'#a9edb3':color,id==='growth'?2:0),id==='growth'?'growth-lance':'cascade-flying-blade');blade.rotation.x=-Math.PI/2;blade.scale.set(.25,1.5,.25);
  addonFilaments(root,color,id+'-shot-wake',2,4,.18);
 }else{
  // A travelling break in the road precedes the terminal standing formation.
  for(let i=0;i<5;i++){const slab=addonPart(root,addonSlabGeometry(),addonStone(i%2?'#706957':'#a09580'),'travelling-rupture',(i%2-.5)*.6,-.7,i*.8);slab.scale.set(.5,.15+(4-i)*.06,.7);slab.rotation.z=(i%2-.5)*.4;}
  const fissure=addPowerPart(root,powerCurve('fracture-front',[[0,-.85,-1],[.3,-.85,0],[-.25,-.85,1],[.2,-.85,2],[0,-.85,4]],.04),id==='earth-spire'?'#9ce3e7':'#211a15',8,'fracture-front');
 }
}
function removeAddonEffect(f){f.timeline?.cancel();scene.remove(f.mesh);const materials=new Set(),geometries=new Set();f.mesh.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o.userData.ownedGeometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose?.();});materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());}
function clearAddonEffects(){while(addonEffects.length)removeAddonEffect(addonEffects.pop());}
// Gameplay already bounds entity count. Pin their telegraphs; optional cast and
// contact decoration must never evict a hazard that can still hit a racer.
function reserveAddonEffect(entity){
 for(let i=addonEffects.length-1;i>=0;i--)if(addonEffects[i].entity&&addonEffects[i].entity.life<=0)removeAddonEffect(addonEffects.splice(i,1)[0]);
 if(addonEffects.length<ADDON_FX_CAP)return true;
 const index=addonEffects.findIndex(f=>!f.entity);
 if(index>=0){removeAddonEffect(addonEffects.splice(index,1)[0]);return true;}
 return !!entity;
}
function spawnAddonEffect(id,u,lat,owner,options={}){
 if(!ADDON_FX_COLORS[id])return null;
 if(options.phase==='burst')return spawnAddonContact(id,u,lat,owner);
 if(!reserveAddonEffect(options.entity))return null;
 const mesh=new THREE.Group();mesh.name='addon-'+id;
 if(options.phase==='projectile'&&['growth','cascade','monolith','earth-spire'].includes(id))buildAddonProjectileSignature(mesh,id,ADDON_FX_COLORS[id]);else buildAddonSignature(mesh,id,ADDON_FX_COLORS[id]);
 const duration=options.duration??2.4,fx={id,u,lat,owner,mesh,life:duration,duration,follow:!!options.follow,entity:options.entity,phase:options.phase||'cast',contact:false};if(options.radius&&options.phase!=='projectile'){const base={acid:3.8,pyre:3,kraken:3.7,astral:4.1,rend:3.2,ward:3.1,growth:2.8,ink:3.6,venom:2.8,monolith:3.5}[id]||3;mesh.scale.set(options.radius/base,1,options.radius/base);mesh.userData.effectRadius=options.radius;if(id==='pyre')mesh.userData.safeRadius=options.radius*.5;}
 scene.add(mesh);orientOnTrack(mesh,u,lat,1,0);addonEffects.push(fx);return fx;
}
// Public contact entry point: invoke after a collision/slow/blocked hit resolves.
// Normal item collisions use their item key, so missiles/mines share the standard.
function spawnAddonContact(id,u,lat,owner){
 if(!reserveAddonEffect())return null;
 const color=ADDON_FX_COLORS[id]||referencePowerColors[id]||'#fff4cb',mesh=new THREE.Group();mesh.name='contact-'+id;
 const ring=addonRing(mesh,color,1, -.6,'contact-shock');ring.scale.setScalar(.2);
 const burst=new THREE.InstancedMesh(addonCrystalGeometry(),addonSurface(color,['pyre','fire','fire-boost','fire-portal'].includes(id)?1:0),powerLow?8:14);burst.name='contact-shards';burst.frustumCulled=false;mesh.add(burst);
 const flash=addonPart(mesh,cachedPowerGeometry('contact-flash',()=>new THREE.SphereGeometry(1,16,8)),addonSurface(color,5),'contact-flash');
 const envelope={spread:.15,lift:0,fade:1};
 const timeline=globalThis.anime?.animate?globalThis.anime.animate(envelope,{spread:[.15,powerReduced?1.8:3.8],lift:[0,powerReduced?.3:1.8],fade:[1,0],duration:650,ease:'outCubic',autoplay:false}):null;
 const fx={id,u,lat,owner,mesh,life:.65,duration:.65,contact:true,envelope,timeline};scene.add(mesh);orientOnTrack(mesh,u,lat,1,0);addonEffects.push(fx);return fx;
}
function stepAddonEffects(dt){
 if(!(dt>0))return;
 for(let i=addonEffects.length-1;i>=0;i--){const f=addonEffects[i];f.life-=dt;
  if(f.entity?f.entity.life<=0:f.life<=0){removeAddonEffect(f);addonEffects.splice(i,1);continue;}
  const age=f.duration-f.life,clock=age*(powerReduced?.25:1);
  if(f.entity){f.u=f.entity.u;f.lat=f.entity.lat;}else if(f.follow&&f.owner){f.u=f.owner.u;f.lat=f.owner.lat;}
  orientOnTrack(f.mesh,f.u,f.lat,1,0);
  let fade=Math.min(1,age*7+.15,f.life*3);
  if(f.entity)fade=Math.max(.35,fade);
  if(f.contact){if(f.timeline)f.timeline.seek(age*1000);else{const t=Math.min(1,age/.65),e=1-Math.pow(1-t,3);f.envelope.spread=.15+e*(powerReduced?1.65:3.65);f.envelope.lift=e*(powerReduced?.3:1.8);f.envelope.fade=1-e;}
   fade=f.envelope.fade;const shock=f.mesh.getObjectByName('contact-shock');shock.scale.setScalar(f.envelope.spread);
   const shards=f.mesh.getObjectByName('contact-shards');for(let n=0;n<shards.count;n++){const a=n/shards.count*Math.PI*2,s=.035+(n%3)*.012;powerDummy.position.set(Math.sin(a)*f.envelope.spread,Math.max(-.8,f.envelope.lift*(.3+n%3*.25)-age*age*3),Math.cos(a)*f.envelope.spread);powerDummy.scale.set(s,s*3,s);powerDummy.rotation.set(age*6+n,a,age*3);powerDummy.updateMatrix();shards.setMatrixAt(n,powerDummy.matrix);}shards.instanceMatrix.needsUpdate=true;
   f.mesh.getObjectByName('contact-flash').scale.setScalar(.3+f.envelope.spread*.4);
  }
  f.mesh.traverse(p=>{if(p.material?.uniforms){p.material.uniforms.time.value=clock;p.material.uniforms.fade.value=fade;}else if(p.material?.transparent)p.material.opacity=fade;
   if(p.name==='acid-boil')p.position.y=-.65+Math.abs(Math.sin(clock*3+p.userData.seed))*.45;
   if(p.name==='kraken-tentacle')p.rotation.y=Math.sin(clock*2+p.userData.arm)*.035;
   if(p.name==='cascade-crown')p.rotation.y=clock*.5;
   if(p.name==='arbor-flower')p.rotation.y=clock*.22;
   if(p.name==='accretion-ring')p.rotation.z=clock*.6;
   if(p.name==='radial-bolt')p.visible=Math.sin(clock*29+p.id*3)>.0;
   if(p.name==='cement-dust')p.scale.setScalar(1+age*.3);
   if(p.name==='portal-lip')p.rotation.z=clock*.4;
  });
 }
}
