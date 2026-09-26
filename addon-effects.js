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
 if(mode!=1.&&mode!=3.){a=clamp(a*1.7+.04,0.,1.);float l=dot(c,vec3(.299,.587,.114));c=max(mix(vec3(l),c,1.5),0.)*1.15;}
 float edge=noise(vP*20.);if(fade<.98&&edge>fade)discard;c+=tint*2.*smoothstep(fade,fade+.08,edge+.08)*step(fade,.98);
 gl_FragColor=vec4(c,a*fade);}`});
}
function addonPart(root,geometry,material,name,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);root.add(m);return m;}
// Procedural rock kit. A welded, subdivided block is chamfered, cleaved by fracture planes into
// fresh flat facets, stepped by bedding ledges and weathered by fbm relief; vertex colour carries
// ground-contact occlusion, strata banding, cavity darkening and pale fresh-fracture faces. The
// game's own cliff albedo/height maps supply grain, bump and per-texel roughness variation.
function addonHash3(x,y,z){const s=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return s-Math.floor(s);}
function addonNoise3(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),h=addonHash3,L=(a,b,t)=>a+(b-a)*t;let fx=x-ix,fy=y-iy,fz=z-iz;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
 return L(L(L(h(ix,iy,iz),h(ix+1,iy,iz),fx),L(h(ix,iy+1,iz),h(ix+1,iy+1,iz),fx),fy),L(L(h(ix,iy,iz+1),h(ix+1,iy,iz+1),fx),L(h(ix,iy+1,iz+1),h(ix+1,iy+1,iz+1),fx),fy),fz);}
function addonFbm3(x,y,z){return addonNoise3(x,y,z)*.55+addonNoise3(x*2.07+5.2,y*2.07,z*2.07)*.3+addonNoise3(x*4.3,y*4.3+1.7,z*4.3)*.15;}
function addonRockGeometry(seed=0,detail){const n=detail??(powerLow?4:8);return cachedPowerGeometry('addon-rock-'+seed+'-'+n,()=>{
 const box=new THREE.BoxGeometry(2,2,2,n,n,n),src=box.attributes.position,weld=new Map(),remap=[],pos=[];
 for(let i=0;i<src.count;i++){const x=src.getX(i),y=src.getY(i),z=src.getZ(i),key=Math.round(x*1e4)+'|'+Math.round(y*1e4)+'|'+Math.round(z*1e4);if(!weld.has(key)){weld.set(key,pos.length/3);pos.push(x,y,z);}remap.push(weld.get(key));}
 const index=Array.from(box.index.array,i=>remap[i]);box.dispose();
 let state=(seed+1)*7919;const rnd=()=>(state=(state*9301+49297)%233280)/233280,planes=[];
 for(let k=0;k<(n>3?9:6);k++){const t=rnd()*Math.PI*2,e=(rnd()*2-1)*.9,c=Math.sqrt(1-e*e);planes.push([Math.cos(t)*c,e,Math.sin(t)*c,.56+rnd()*.3]);}
 planes.push([Math.sin(seed*2.3)*.38,.92,Math.cos(seed*1.7)*.38,.74+rnd()*.12]);
 const colors=[],uv=[],o=seed*17.31+.37;
 for(let i=0;i<pos.length;i+=3){let x=pos[i],y=pos[i+1],z=pos[i+2];const l=Math.hypot(x,y,z)||1;
  x+=(x/l*1.22-x)*.3;y+=(y/l*1.22-y)*.3;z+=(z/l*1.22-z)*.3;
  let cut=0;for(const [a,b,c,d] of planes){const over=x*a+y*b+z*c-d;if(over>0){x-=a*over*.97;y-=b*over*.97;z-=c*over*.97;cut=Math.max(cut,Math.min(1,over*5));}}
  const band=Math.sin(y*6.4+addonNoise3(x*1.3+o,y*.6,z*1.3)*2.6+o),ledge=.06*Math.tanh(band*4);x*=1+ledge;z*=1+ledge;
  const r=Math.hypot(x,y,z)||1,f=addonFbm3(x*1.7+o,y*1.7,z*1.7-o),disp=(f-.5)*.26*(1-cut*.75)+(addonNoise3(x*7.3+o,y*7.3,z*7.3)-.5)*.06;x+=x/r*disp;y+=y/r*disp;z+=z/r*disp;
  pos[i]=x*.5;pos[i+1]=y;pos[i+2]=z*.5;
  const ao=.3+.7*Math.min(1,Math.max(0,(y+1.08)/1.3)),strata=.5+.5*Math.sin(y*10.5+f*4.2+o),tone=Math.min(1.2,Math.max(.1,(.6+strata*.4)*ao*(1+disp*3)+cut*.22));
  colors.push(tone*(1.02-strata*.05),tone,tone*(.93+strata*.07));uv.push((x+z)*.55+o,y*.55);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;});}
function addonStone(color='#474950',gloss=false){const T=typeof TEX!=='undefined'&&TEX?TEX:{},mat=new THREE.MeshStandardMaterial({color,vertexColors:true,roughness:gloss?.34:T.cliffHeight?1.7:.9,metalness:gloss?.12:.02,map:T.cliffColor||null,bumpMap:T.cliffHeight||null,roughnessMap:gloss?null:T.cliffHeight||null,bumpScale:.075});mat.name='addon-rock';return mat;}
function addonCrystalGeometry(){return cachedPowerGeometry('addon-crystal',()=>{const shape=new THREE.Shape();shape.moveTo(-.35,0);shape.lineTo(-.48,.5);shape.lineTo(-.13,1.8);shape.lineTo(.14,2.1);shape.lineTo(.4,.65);shape.lineTo(.27,0);shape.closePath();return new THREE.ExtrudeGeometry(shape,{depth:.38,bevelEnabled:true,bevelThickness:.05,bevelSize:.04,bevelSegments:1,steps:1});});}
// 1 x 2 x 1 rock block centred on its origin (drop-in for the old slab box).
function addonSlabGeometry(seed=0){return addonRockGeometry(seed%5);}
// Emergence: a part starts buried and thrusts up with an overshoot-and-settle, then sinks at expiry.
function addonEmerge(o,delay=0,rise=.3,h){o.userData.emerge={y:o.position.y,delay,rise,h:h??o.position.y+1.05+Math.abs(o.scale.y)*1.15,rz:o.rotation.z};o.visible=false;return o;}
function addonDebris(root,color,count,reach=3){const m=new THREE.InstancedMesh(addonRockGeometry(7,2),addonStone(color),count);m.name='rock-debris';m.frustumCulled=false;m.castShadow=true;const d=[];
 for(let i=0;i<count;i++){const up=3.5+3*Math.abs(Math.sin(i*5.3)),y0=-.7,tl=(up+Math.sqrt(up*up+19.6*(y0+.9)))/9.8;d.push({a:i/count*Math.PI*2+Math.sin(i*7.1)*.5,up,y0,tl,v:reach*(.55+.5*Math.abs(Math.sin(i*3.7)))/tl,s:.1+.12*Math.abs(Math.sin(i*2.9)),spin:4+i%5,delay:.03*(i%4)});}
 m.userData.debris=d;root.add(m);addonPlaceDebris(m,0);return m;}
function addonPlaceDebris(m,age){for(let i=0;i<m.count;i++){const c=m.userData.debris[i],t=powerReduced?c.tl:Math.min(c.tl,Math.max(0,age-c.delay)),live=age>c.delay;
 powerDummy.position.set(Math.cos(c.a)*c.v*t,Math.max(-.9+c.s,c.y0+c.up*t-4.9*t*t),Math.sin(c.a)*c.v*t);powerDummy.rotation.set(t*c.spin,c.a,t*c.spin*.6);powerDummy.scale.set(c.s*1.4,live?c.s:0,c.s*1.2);powerDummy.updateMatrix();m.setMatrixAt(i,powerDummy.matrix);}m.instanceMatrix.needsUpdate=true;}
function addonDust(root,color,radius=2.6,name='rock-dust'){const d=addonPart(root,cachedPowerGeometry('rock-dust-torus',()=>new THREE.TorusGeometry(1,.5,8,powerLow?20:36)),addonSurface(color,5),name,0,-.75);d.rotation.x=Math.PI/2;d.userData.base=radius;d.scale.setScalar(radius);return d;}
// A helical band that widens as it climbs: the body of a travelling tornado.
function addonFunnelGeometry(key,turns,r0,r1,height,width){return cachedPowerGeometry(key,()=>{const pts=[],uv=[],idx=[],seg=powerLow?48:96;for(let i=0;i<=seg;i++){const t=i/seg,a=t*turns*Math.PI*2,r=r0+(r1-r0)*t*t;for(const side of [-1,1]){pts.push(Math.cos(a)*r,t*height+side*width*(.45+t),Math.sin(a)*r);uv.push(t,(side+1)/2);}if(i<seg){const j=i*2;idx.push(j,j+1,j+2,j+1,j+3,j+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;});}
function addonCluster(root,color,type='crystal',count=12,radius=2.5,seed=0,gloss=false){const geo=type==='stone'?addonSlabGeometry(seed):addonCrystalGeometry(),mat=type==='stone'?addonStone(color,gloss):addonSurface(color,type==='fire'?1:0),m=new THREE.InstancedMesh(geo,mat,count);m.name=type+'-crown';m.frustumCulled=false;m.castShadow=type==='stone';const placements=[];
 for(let i=0;i<count;i++){const a=i/count*Math.PI*2,r=radius*(.88+.14*Math.sin(i*12.3)),s=.6+.35*Math.sin(i*5.7);powerDummy.position.set(Math.sin(a)*r,-.7,Math.cos(a)*r);powerDummy.rotation.set(Math.cos(a)*.28,a+(type==='stone'?Math.sin(i*3.1):0),Math.sin(a)*-.28);powerDummy.scale.set(type==='stone'?.7+.2*Math.sin(i*4.3):.6,s+.55,type==='stone'?.6+.15*Math.cos(i*2.1):.6);powerDummy.updateMatrix();m.setMatrixAt(i,powerDummy.matrix);placements.push({a,r,s});}root.add(m);return m;}
function addonFloor(root,color,radius=3,mode=4,name='ground-current'){const disc=addonPart(root,cachedPowerGeometry('addon-disc',()=>new THREE.CircleGeometry(1,powerLow?32:64)),addonSurface(color,mode),name,0,-.87,0);disc.rotation.x=-Math.PI/2;disc.scale.setScalar(radius);return disc;}
function addonRing(root,color,radius,y=-.72,name='pressure-ring'){const ring=powerRing(root,radius,color,name);ring.rotation.x=Math.PI/2;ring.position.y=y;return ring;}
// Readable ground lip: a thick glowing torus at the true footprint edge (the thin energy ring vanishes past 20m).
function addonRim(root,color,radius,name='footprint-rim',tube=.09){const rim=addonPart(root,cachedPowerGeometry('addon-rim',()=>new THREE.TorusGeometry(1,.09,6,powerLow?40:80)),addonSurface(color,0),name,0,-.86,0);rim.rotation.x=Math.PI/2;rim.scale.set(radius,radius,tube/.09);return rim;}
function addonFilaments(root,color,name,count=3,length=7,radius=.6,width=.055){for(let i=0;i<count;i++){const ribbon=addPowerPart(root,ribbonGeometry('addon-'+name+'-'+i,1+i*.2,radius,length,width),color,5,name);ribbon.rotation.z=i*Math.PI*2/count;}}
function addonArms(root,color,count=6){for(let i=0;i<count;i++){const a=i/count*Math.PI*2,pts=[];for(let n=0;n<=18;n++){const t=n/18,r=1.6+t*1.8;pts.push([Math.cos(a)*r+Math.sin(t*5)*.2,-.8+Math.sin(t*Math.PI)*2.5+t*.7,Math.sin(a)*r]);}const arm=addonPart(root,powerCurve('kraken-arm-'+i,pts,.21),addonSurface(color,2),'kraken-tentacle');arm.userData.arm=i;
 for(let n=0;n<5;n++){const t=.1+n*.16,p=pts[Math.round(t*18)];const cup=powerRing(root,.16,'#bfe4d3','kraken-sucker');cup.position.set(p[0],p[1]-.14,p[2]);cup.rotation.x=Math.PI/2;}}
}
function buildAddonSignature(root,id,color,phase='cast'){
 const sphere=cachedPowerGeometry('addon-sphere',()=>new THREE.SphereGeometry(1,powerLow?16:24,powerLow?10:16));
 if(id==='ward'){
  // Obsidian monoliths thrust up in a ring around a molten moat and a tall rune barrier.
  addonEmerge(addonCluster(root,'#292333','stone',powerLow?8:12,2.8,1,true),0,.3,3.4);const cage=addonPart(root,cachedPowerGeometry('ward-cylinder',()=>new THREE.CylinderGeometry(2.65,2.65,2.7,48,1,true)),addonSurface(color,4),'ward-rune-barrier',0,.3);addonFloor(root,color,3.1);addonRing(root,color,2.8);
  const moat=addonPart(root,cachedPowerGeometry('ward-moat',()=>new THREE.RingGeometry(2.3,3.05,powerLow?32:64)),addonSurface(color,1),'ward-lava-moat',0,-.85);moat.rotation.x=-Math.PI/2;addonDust(root,'#4a3a3a',2.4);
 }else if(id==='acid'){
  addonFloor(root,color,3.8,2,'acid-pool');for(let i=0;i<(powerLow?5:8);i++){const bubble=addonPart(root,sphere,addonSurface(color,2),'acid-boil',Math.sin(i*2.4)*(1.1+i%3*.5),-.65,Math.cos(i*2.4)*(1.1+i%3*.5));bubble.scale.setScalar(.34+(i%4)*.09);bubble.userData.seed=i;}
  const mist=addonPart(root,sphere,addonSurface(color,5),'toxic-mist',0,.1);mist.scale.set(3.3,2.1,3.3);addonRing(root,color,3.6);addonRim(root,color,3.75,'acid-rim',.12);
 }else if(id==='growth'){
  for(let i=0;i<6;i++){const a=i*Math.PI/3;addPowerPart(root,powerCurve('bloom-vine-'+i,[[Math.cos(a)*2,-.85,Math.sin(a)*2],[Math.cos(a)*1.4,.9,Math.sin(a)*1.4],[Math.cos(a)*.7,2,Math.sin(a)*.7],[0,2.7,0]],.11),'#4fbd6b',7,'bloom-vine');}
  const flower=new THREE.Group();flower.name='arbor-flower';flower.position.y=2.6;root.add(flower);
  for(let i=0;i<8;i++){const petal=addPowerPart(flower,mirrorGeometry(),i%2?color:'#ffe7e1',7,'arbor-petal');const a=i*Math.PI/4;petal.position.set(Math.sin(a)*.9,0,Math.cos(a)*.9);petal.rotation.set(Math.PI/2+.4,a,0);petal.scale.set(.75,1.05,.75);}
  const core=addonPart(flower,sphere,addonSurface('#ffffcc',0),'bloom-pistil');core.scale.setScalar(.52);addonFloor(root,'#67c893',2.8);addonRim(root,'#8ff0b0',2.75,'bloom-rim');
 }else if(id==='cyber'){
  // The serpent rides a metre off the road so its undulation reads against the circuit.
  const pts=[];for(let n=0;n<=32;n++){const t=n/32;pts.push([Math.sin(t*10)*.7*(1-t),.35+Math.sin(t*6)*.38*(1-t*.5),1+t*8]);}
  const body=addonPart(root,powerCurve('cyber-spine-v2',pts,.34),addonSurface(color,4),'cyber-serpent');
  const head=addonPart(root,addonCrystalGeometry(),addonSurface(color,3),'cyber-head',0,.5,.3);head.rotation.x=-Math.PI/2;head.scale.set(1.25,1,1.2);
  for(const x of [-.3,.3]){const eye=addonPart(root,sphere,powerShader('#e4ffb8',8),'serpent-eye',x,.72,-.25);eye.scale.setScalar(.1);}
  addonFilaments(root,color,'cyber-helical-wake',2,9,.55,.09);const floor=addonFloor(root,color,3.3,4,'routed-circuit');floor.scale.set(2,7,1);
 }else if(id==='venom'){
  addonCluster(root,color,'crystal',powerLow?9:15,1.5);const core=addonPart(root,sphere,addonSurface('#ff93ec',5),'venom-kernel',0,.2);core.scale.set(2.2,1.8,2.2);addonFloor(root,'#682481',2.8,2,'venom-bloom');addonRim(root,color,2.75,'venom-rim');
 }else if(id==='monolith'){
  // Terminal rupture: a broad crown of fractured blocks erupts, sheds chips and a cement-dust ring.
  addonEmerge(addonCluster(root,'#6b6660','stone',powerLow?8:13,1.7,2),0,.2,3.2);for(let i=0;i<3;i++){const slab=addonPart(root,addonSlabGeometry(i+1),addonStone('#8d8271'),'rift-slab',(i-1)*.9,.1,-i*.9);slab.scale.set(.8,1.8-i*.25,.6);slab.rotation.z=(i-1)*.18;slab.castShadow=true;addonEmerge(slab,.03*i,.22);}
  const dust=addonPart(root,cachedPowerGeometry('dust-torus',()=>new THREE.TorusGeometry(2.7,.35,6,32)),addonSurface('#a59685',5),'cement-dust',0,-.5);dust.rotation.x=Math.PI/2;addonFloor(root,'#211e1b',3.5,3,'rift-scar');addonDebris(root,'#8a7f70',powerLow?6:14,3.3);
 }else if(id==='ink'){
  addonFloor(root,'#080d17',3.6,3,'sumi-ink-pool');for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const crest=addPowerPart(root,ribbonGeometry('ink-crest-'+i,.45,.4,2.8,.3),'#aab7c3',1,'ink-crown');crest.material.dispose();crest.material=addonSurface('#26303e',3);crest.rotation.x=-Math.PI/2;crest.rotation.z=a;crest.position.set(Math.sin(a)*2,-.5,Math.cos(a)*2);}
  addonRing(root,'#c6d2d8',3.4,-.78,'ink-foam');addonRim(root,'#c6d2d8',3.5,'ink-foam-lip',.11);
 }else if(id==='astral'){
  const horizon=addonPart(root,sphere,addonSurface('#191037',3),'event-horizon',0,.8);horizon.scale.setScalar(1.15);
  const lens=addonPart(root,sphere,addonSurface(color,0),'lensing-halo',0,.8);lens.scale.setScalar(1.55);
  for(let i=0;i<3;i++){const r=addonRing(root,color,1.8+i*.32,.8,'accretion-ring');r.rotation.x=.65+i*.4;r.rotation.y=i*.8;r.scale.set(1,1,3);}
  addonCluster(root,'#a391e3','crystal',8,3);addonFloor(root,color,4.1,4,'cosmic-shock');addonRim(root,color,4.05,'event-rim');
 }else if(id==='cascade'){
  const crown=new THREE.Group();crown.name='cascade-crown';crown.position.y=2;root.add(crown);addonCluster(crown,color,'crystal',powerLow?9:15,1.6);crown.rotation.z=Math.PI;
  for(let i=0;i<3;i++){const blade=addonPart(root,addonCrystalGeometry(),addonSurface('#e9c8ff',0),'cascade-volley',(i-1)*.7,.5,-2-i);blade.rotation.x=-Math.PI/2;blade.scale.set(.45,1.2,.45);}addonFloor(root,color,3,4,'baleful-mark');addonRim(root,color,2.95,'baleful-rim');
 }else if(id==='rend'){
  const pillar=addonPart(root,cachedPowerGeometry('rend-pillar',()=>new THREE.CylinderGeometry(.23,.8,5.5,12,12,true)),addonSurface(color,4),'celestial-pillar',0,1.7);addonFloor(root,color,3.2,4,'rend-sigil');addonRim(root,'#fff4ce',3.15,'rend-footprint',.12);
  for(let i=0;i<3;i++){const tendril=addPowerPart(root,ribbonGeometry('rend-tendril-'+i,1.6,1.2,5.5,.1),color,7,'rend-tendril');tendril.rotation.x=-Math.PI/2;tendril.rotation.z=i*2.1;tendril.position.y=-.7;}const halo=addonRing(root,'#fff4ce',1.2,4.3,'rend-star');halo.scale.set(1,1,3);
 }else if(id==='pyre'){
  addonCluster(root,color,'fire',powerLow?12:20,2.7);const crater=addonPart(root,cachedPowerGeometry('pyre-safe-center-annulus',()=>new THREE.RingGeometry(1.5,3,48)),addonSurface(color,1),'molten-annulus',0,-.87);crater.rotation.x=-Math.PI/2;addonFilaments(root,'#ffcc83','pyre-embers',2,4,.9);for(const r of root.children.filter(o=>o.name==='pyre-embers'))r.rotation.x=-Math.PI/2;
 }else if(id==='kraken'){
  addonFloor(root,'#184955',3.7,2,'abyss-pool');addonArms(root,color,powerLow?4:6);addonRing(root,'#acf5e7',3.4,-.55,'brine-veil');addonRim(root,'#acf5e7',3.6,'brine-lip');
 }else if(id==='electrical'){
  const core=addonPart(root,sphere,addonSurface('#404773',3),'electrical-black-core',0,.7);core.scale.setScalar(1.2);const shell=addonPart(root,sphere,addonSurface(color,4),'electrical-plasma-shell',0,.7);shell.scale.setScalar(1.45);addonFloor(root,color,3.4,4,'containment-platform');addonRim(root,color,3.35,'containment-rim');
  for(let i=0;i<(powerLow?6:10);i++){const a=i*Math.PI*2/(powerLow?6:10),pts=[];for(let n=0;n<10;n++){const t=n/9,r=1.3+t*1.8;pts.push([Math.sin(a)*r+Math.sin(n*7+i)*.17,.6+Math.sin(n*3+i)*.3,Math.cos(a)*r]);}addPowerPart(root,powerCurve('radial-bolt-v2-'+i,pts,.06),i%2?color:'#f5f4ff',8,'radial-bolt');}
 }else if(id==='earth-spire'){
  // A stone column breaks the road, its glass seam exposed at the crown, inside a broken collar.
  addonEmerge(addonCluster(root,'#4e4942','stone',9,1.6,3),.08,.3,3.2);const column=addonPart(root,addonSlabGeometry(4),addonStone('#71685c'),'earthen-stone-spire',0,1.25,0);column.scale.set(1.3,2.25,1.15);column.castShadow=true;addonEmerge(column,0,.4);
  const tower=addonPart(root,addonCrystalGeometry(),addonSurface('#9ce3e7',0),'earthen-glass-spire',-.05,2.2,-.15);tower.scale.set(.85,1.45,.85);addonEmerge(tower,.1,.42,6.4);addonFloor(root,'#58504a',3,3,'fractured-plates');addonDebris(root,'#6a6156',powerLow?5:10,2.6);addonDust(root,'#8c8070',2.2);
 }else if(id==='verdant-gate'||id==='tide-ring'||id==='fire-portal'){
  const portal=new THREE.Group();portal.name=id+'-arch';portal.position.y=1.25;root.add(portal);
  if(id!=='fire-portal')for(let i=0;i<(powerLow?10:14);i++){const a=i/(powerLow?10:14)*Math.PI*2,stone=addonPart(portal,addonSlabGeometry(i),addonStone(id==='tide-ring'?'#537778':'#7b8070'),'assembled-arch-stone',Math.sin(a)*2.2,Math.cos(a)*2.2,0);stone.scale.set(.62,.36,.55);stone.rotation.z=-a;stone.castShadow=true;stone.userData.assemble={x:stone.position.x,y:stone.position.y,delay:i*.018};}
  const aperture=addonPart(portal,cachedPowerGeometry('portal-aperture',()=>new THREE.CircleGeometry(1,48)),addonSurface(color,id==='fire-portal'?1:2),'portal-aperture');aperture.scale.setScalar(2);
  const ring=powerRing(portal,2.08,color,'portal-lip');ring.scale.set(1.03,1.03,4);const glow=addonPart(portal,cachedPowerGeometry('addon-rim',()=>new THREE.TorusGeometry(1,.09,6,powerLow?40:80)),addonSurface(color,0),'portal-glow');glow.scale.set(2.05,2.05,1.6);
  // Tide ring lies back 54 degrees: still a ring you drive through, but it reads from the chase camera.
  if(id==='tide-ring')portal.rotation.x=Math.PI*.3;
 }else if(id==='fire-boost'&&phase==='zone'){
  // Burning gas left on the road: a low bed of combustion tongues over a molten film.
  addonCluster(root,color,'fire',powerLow?7:12,1.5);addonFloor(root,color,2.2,1,'burning-gas-floor');addonRim(root,'#ffd08a',2.15,'burning-gas-rim',.1);
 }else if(id==='electric-boost'||id==='magic-boost'||id==='fire-boost'){
  // Self buffs wrap the kart in a rim-lit sheath and trail heavy exhaust so a boosting rival reads at range.
  const family=id.split('-')[0];for(let i=0;i<3;i++){const stream=addPowerPart(root,ribbonGeometry('boost-v2-'+family+'-'+i,family==='electric'?.1:family==='magic'?2:.35,.45,6+i*1.2,.3),color,family==='fire'?3:5,family+'-exhaust');stream.position.set((i-1)*.8,-.4,1.2);}
  const sheath=addonPart(root,sphere,addonSurface(color,0),'boost-sheath',0,-.15,.2);sheath.scale.set(1.75,1.15,2.9);
  if(family==='magic')for(let i=0;i<3;i++){const ring=powerRing(root,1.5+i*.35,color,'magic-flight-ring');ring.position.z=1+i*1.5;ring.scale.set(1,1,3);}
  if(family==='electric')addonFilaments(root,'#f5f5ff','boost-lightning',2,6,.55,.08);
  if(family==='fire')addonFilaments(root,'#ffd08a','boost-afterburn',2,5,.4,.12);
 }else if(id==='fire'){
  const head=addonPart(root,sphere,addonSurface(color,1),'combustion-head',0,0,-.6);head.scale.set(.8,.8,1.3);const core=addonPart(root,sphere,addonSurface('#fff1c2',0),'combustion-core',0,0,-.7);core.scale.set(.5,.5,.75);const halo=addonPart(root,sphere,addonSurface(color,5),'heat-halo',0,0,-.3);halo.scale.set(1.3,1.3,1.9);
  for(let i=0;i<3;i++){const tail=addPowerPart(root,ribbonGeometry('fireball-tail-'+i,.25,.5,6,.35),color,3,'burning-gas-wake');tail.rotation.z=i*2.1;}
 }else if(id==='water'){
  const head=addonPart(root,sphere,addonSurface(color,2),'water-surge-head');head.scale.set(1.1,.8,1.4);for(let i=0;i<2;i++){const wave=addPowerPart(root,ribbonGeometry('water-wave-'+i,.7,.7,6,.28),color,1,'water-crest');wave.rotation.z=i*Math.PI;}
  addonFilaments(root,'#e5fcff','water-foam-trace',2,5,.8,.09);const spray=addonCluster(root,'#dff8ff','crystal',powerLow?6:10,.95);spray.name='water-spray-crown';spray.scale.set(.85,.42,.85);spray.position.y=.15;
 }else if(id==='earth'){
  // Heaving crust: road plates thrust up in a tented pressure ridge around a central upthrust, with
  // fresh pale fracture faces, flung chips and a settling dust skirt.
  for(let i=0;i<4;i++){const pivot=new THREE.Group(),a=i*Math.PI/2+.4;pivot.name='crust-pivot';pivot.rotation.y=a;root.add(pivot);const rock=addonPart(pivot,addonSlabGeometry(i),addonStone(i%2?'#766653':'#a08b72'),'earth-fracture',0,-.72,1.25);rock.scale.set(1.65,.34,1.5);rock.rotation.set(.58+.08*(i%2),0,.1*(i-1.5));rock.castShadow=true;addonEmerge(rock,.05*i,.34,1.6);}
  const spike=addonPart(root,addonSlabGeometry(4),addonStone('#8f7c66'),'earth-upthrust',.15,0,0);spike.scale.set(.62,1.25,.55);spike.rotation.set(.12,.7,-.16);spike.castShadow=true;addonEmerge(spike,0,.3);
  addonFloor(root,'#3b3028',3,3,'earth-scar');addonDebris(root,'#7d6b57',powerLow?4:8,2.6);addonDust(root,'#9a876f',2.3);
 }else if(id==='wind'){
  // A standing tornado drives down the lane; low helices shear the air at its base.
  for(let i=0;i<3;i++){const funnel=addPowerPart(root,addonFunnelGeometry('wind-funnel-'+i,2.4,.25,1.9,4.4,.28),i?color:'#ffffff',1,'wind-funnel');funnel.position.y=-1;funnel.rotation.y=i*2.1;}
  for(let i=0;i<4;i++){const air=addPowerPart(root,ribbonGeometry('wind-vortex-'+i,2.1,.8+i*.12,6,.1),color,1,'wind-vortex');air.rotation.z=i*Math.PI/2;air.position.y=-.5;}const ring=powerRing(root,1.2,'#f0ffff','wind-pressure-head');ring.position.z=-.4;ring.scale.set(1,1,3);addonRim(root,color,1.9,'wind-skirt',.14);
 }
}
function buildAddonProjectileSignature(root,id,color){
 if(id==='growth'||id==='cascade'){
  // Crossed blades read as a star from behind; an emissive core and wake carry it at range.
  const tint=id==='growth'?'#a9edb3':color;for(let k=0;k<2;k++){const blade=addonPart(root,addonCrystalGeometry(),addonSurface(tint,id==='growth'?2:0),id==='growth'?'growth-lance':'cascade-flying-blade');blade.rotation.set(-Math.PI/2,k*Math.PI/2,0);blade.scale.set(.85,1.4,.85);}
  const core=addonPart(root,cachedPowerGeometry('addon-sphere',()=>new THREE.SphereGeometry(1,powerLow?16:24,powerLow?10:16)),addonSurface('#ffffff',0),id+'-shot-core',0,0,-1.2);core.scale.set(.46,.46,.75);
  addonFilaments(root,color,id+'-shot-wake',2,4.5,.3,.09);
 }else{
  // A travelling break in the road: a heaving wave of fractured rock, crest leading, precedes the
  // terminal formation. Each block rides its own phase so the rupture visibly rolls forward.
  for(let i=0;i<7;i++){const H=1.45*(1-i*.11),x=(i%2?-1:1)*(.3+i*.09),slab=addonPart(root,addonSlabGeometry(i),addonStone(i%2?'#706957':'#a09580'),'travelling-rupture',x,-1+H*.4,i*.72-.4);slab.scale.set(.72-i*.03,H*.62,.78);slab.rotation.set(-.32,i*.9,(i%2?1:-1)*.3);slab.castShadow=true;slab.userData.heave={y:slab.position.y,i};}
  addPowerPart(root,powerCurve('fracture-front-v2',[[0,-.85,-1],[.3,-.85,0],[-.25,-.85,1],[.2,-.85,2.5],[0,-.85,5]],.09),id==='earth-spire'?'#9ce3e7':'#2a1f17',8,'fracture-front');
  const dust=addonPart(root,cachedPowerGeometry('addon-sphere',()=>new THREE.SphereGeometry(1,powerLow?16:24,powerLow?10:16)),addonSurface('#a59685',5),'rupture-dust',0,-.55,2.4);dust.scale.set(1.5,.7,2.8);
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
// Readability contract at 25-40m chase distance (camera ~7m behind, 66deg FOV: 1m reads as ~2.5% of
// screen height at 30m). Zones: [local radius that maps onto the gameplay radius, vertical lift];
// lift 0 scales uniformly (upright gates must not squash). The mesh is raised by its lift so local
// ground (-1) stays on the road. Projectiles: [x,y,z scale at reference gameplay radius, ref radius];
// hero silhouettes clear ~3m and span most of the collision width.
const ADDON_ZONE_READ={ward:[2.8,1.5],acid:[3.8,1.5],growth:[2.8,1.4],venom:[2.8,1.3],monolith:[3.5,1.6],ink:[3.6,1.45],astral:[4.1,1.7],cascade:[3,1.5],rend:[3.2,1.3],pyre:[3,1.3],kraken:[3.7,1.7],electrical:[3.4,1.8],'earth-spire':[3,1.15],'verdant-gate':[2.35,0],'tide-ring':[2.35,0],'fire-portal':[2.35,0],'fire-boost':[2.2,1.2],earth:[3,1.15]};
const ADDON_PROJECTILE_READ={fire:[1.7,1.7,1.25,2],water:[2.3,2.3,1.3,3.5],wind:[1.55,1.5,1.1,4],cyber:[1.45,1.7,1.1,2],venom:[1.15,1.3,1.15,2.6],growth:[1.6,1.6,1.2,1.7],cascade:[1.6,1.6,1.2,1.7],monolith:[1.55,1.75,1.3,2],'earth-spire':[1.55,1.85,1.3,2.5]};
function spawnAddonEffect(id,u,lat,owner,options={}){
 if(!ADDON_FX_COLORS[id])return null;
 if(options.phase==='burst')return spawnAddonContact(id,u,lat,owner,options.radius||0);
 if(!reserveAddonEffect(options.entity))return null;
 const mesh=new THREE.Group();mesh.name='addon-'+id;
 if(options.phase==='projectile'&&['growth','cascade','monolith','earth-spire'].includes(id))buildAddonProjectileSignature(mesh,id,ADDON_FX_COLORS[id]);else buildAddonSignature(mesh,id,ADDON_FX_COLORS[id],options.phase||'cast');
 const duration=options.duration??2.4,fx={id,u,lat,owner,mesh,life:duration,duration,follow:!!options.follow,entity:options.entity,phase:options.phase||'cast',contact:false,h:1};
 if(options.radius&&options.phase!=='projectile'){const [base,lift]=ADDON_ZONE_READ[id]||[3,1.2],s=options.radius/base;mesh.scale.set(s,lift||s,s);fx.h=lift||s;mesh.userData.effectRadius=options.radius;if(id==='pyre')mesh.userData.safeRadius=options.radius*.5;}
 else if(options.phase==='projectile'&&ADDON_PROJECTILE_READ[id]){const [x,y,z,ref]=ADDON_PROJECTILE_READ[id],k=(options.radius||ref)/ref;mesh.scale.set(x*k,y*k,z*k);fx.h=y*k;mesh.userData.effectRadius=options.radius||ref;}
 // Hazards on the road carry a ground sigil at their true footprint, readable at distance.
 if(fx.phase==='zone'&&options.radius&&!options.visualOnly&&typeof addSigil==='function'){const sig=addSigil(mesh,ADDON_FX_COLORS[id],options.radius,({acid:5,pyre:7,kraken:8,electrical:6,astral:9,ink:5,rend:4,ward:6})[id]||6);sig.position.y=-.96;}
 // Armed hazards telegraph their footprint with converging pulses until they go live.
 const arm=options.entity?.arm||0;if(fx.phase==='zone'&&arm>=.3&&!options.visualOnly&&typeof powerVFX!=='undefined'&&powerVFX.telegraph)powerVFX.telegraph({u,lat},ADDON_FX_COLORS[id],options.radius||3,arm);
 scene.add(mesh);orientOnTrack(mesh,u,lat,fx.h,0);addonEffects.push(fx);return fx;
}
// Public contact entry point: invoke after a collision/slow/blocked hit resolves.
// Normal item collisions use their item key, so missiles/mines share the standard.
// A radius marks an area detonation: the shock front and debris reach the true blast footprint.
function spawnAddonContact(id,u,lat,owner,radius=0){
 const color=ADDON_FX_COLORS[id]||(typeof referencePowerColors!=='undefined'&&referencePowerColors[id])||'#fff4cb';
 if(typeof powerVFX!=='undefined'){if(radius&&powerVFX.blast)powerVFX.blast({u,lat},color,radius);else powerVFX.touch({u,lat},color);}
 if(!reserveAddonEffect())return null;
 const mesh=new THREE.Group();mesh.name='contact-'+id;const reach=radius||3.8;
 const ring=addonRing(mesh,color,1, -.6,'contact-shock');ring.scale.set(.2,.2,4);
 const burst=new THREE.InstancedMesh(addonCrystalGeometry(),addonSurface(color,['pyre','fire','fire-boost','fire-portal'].includes(id)?1:0),radius?(powerLow?10:20):(powerLow?8:14));burst.name='contact-shards';burst.frustumCulled=false;mesh.add(burst);
 const flash=addonPart(mesh,cachedPowerGeometry('contact-flash',()=>new THREE.SphereGeometry(1,16,8)),addonSurface(color,5),'contact-flash');
 if(radius){const column=addonPart(mesh,cachedPowerGeometry('contact-column',()=>new THREE.CylinderGeometry(.5,1,1,24,1,true)),addonSurface(color,4),'contact-column',0,-1);column.scale.set(radius*.35,.01,radius*.35);}
 const envelope={spread:.15,lift:0,fade:1};
 const timeline=globalThis.anime?.animate?globalThis.anime.animate(envelope,{spread:[.15,reach],lift:[0,powerReduced?.3:1.8],fade:[1,0],duration:650,ease:'outCubic',autoplay:false}):null;
 const fx={id,u,lat,owner,mesh,life:.65,duration:.65,contact:true,envelope,timeline,reach,radius,h:1};scene.add(mesh);orientOnTrack(mesh,u,lat,1,0);addonEffects.push(fx);return fx;
}
const ADDON_BACK=t=>t>=1?1:1+2.70158*Math.pow(t-1,3)+1.70158*Math.pow(t-1,2);
function stepAddonEffects(dt){
 if(!(dt>0))return;
 for(let i=addonEffects.length-1;i>=0;i--){const f=addonEffects[i];f.life-=dt;
  if(f.entity?f.entity.life<=0:f.life<=0){removeAddonEffect(f);addonEffects.splice(i,1);continue;}
  const age=f.duration-f.life,clock=age*(powerReduced?.25:1),remain=f.entity?f.entity.life:f.life;
  if(f.entity){f.u=f.entity.u;f.lat=f.entity.lat;}else if(f.follow&&f.owner){f.u=f.owner.u;f.lat=f.owner.lat;}
  orientOnTrack(f.mesh,f.u,f.lat,f.h||1,0);
  // Live hazards light the road beneath them in their own colour.
  if(f.entity&&!f.contact&&typeof powerVFX!=='undefined')powerVFX.sustain(f,out=>out.copy(f.mesh.position),ADDON_FX_COLORS[f.id]||'#ffffff',2.4,12);
  let fade=Math.min(1,age*7+.15,f.life*3);
  if(f.entity)fade=Math.max(.35,fade);
  if(f.contact){if(f.timeline)f.timeline.seek(age*1000);else{const t=Math.min(1,age/.65),e=1-Math.pow(1-t,3);f.envelope.spread=.15+e*(f.reach-.15);f.envelope.lift=e*(powerReduced?.3:1.8);f.envelope.fade=1-e;}
   fade=f.envelope.fade;const shock=f.mesh.getObjectByName('contact-shock');shock.scale.set(f.envelope.spread,f.envelope.spread,4);
   const shards=f.mesh.getObjectByName('contact-shards'),big=f.radius?1.5:1;for(let n=0;n<shards.count;n++){const a=n/shards.count*Math.PI*2,s=(.1+(n%3)*.04)*big;powerDummy.position.set(Math.sin(a)*f.envelope.spread*(.75+.25*(n%2)),Math.max(-.8,f.envelope.lift*(.3+n%3*.25)*big-age*age*3),Math.cos(a)*f.envelope.spread*(.75+.25*(n%2)));powerDummy.scale.set(s,s*2.4,s);powerDummy.rotation.set(age*6+n,a,age*3);powerDummy.updateMatrix();shards.setMatrixAt(n,powerDummy.matrix);}shards.instanceMatrix.needsUpdate=true;
   f.mesh.getObjectByName('contact-flash').scale.setScalar(.45+f.envelope.spread*.42);
   const column=f.mesh.getObjectByName('contact-column');if(column){const rise=Math.min(1,age/.14);column.scale.y=.01+rise*f.radius*1.1*(powerReduced?.6:1);column.position.y=-1+column.scale.y/2;}
  }
  f.mesh.traverse(p=>{if(p.material?.uniforms){p.material.uniforms.time.value=clock;p.material.uniforms.fade.value=fade;}
   // Stone stays opaque (depth-written, unsorted) for its whole life and only blends during the fade-out.
   else if(p.material?.name==='addon-rock'){const m=p.material,blend=fade<.999;if(m.transparent!==blend){m.transparent=blend;m.needsUpdate=true;}m.opacity=blend?fade:1;}
   else if(p.material?.transparent)p.material.opacity=fade;
   const em=p.userData.emerge;if(em){const t=Math.min(1,Math.max(0,(age-em.delay)/em.rise)),e=powerReduced?1-Math.pow(1-t,3):ADDON_BACK(t),sink=remain<.4?Math.pow(1-remain/.4,2):0;p.visible=t>0;p.position.y=em.y-em.h*(1-e)-em.h*sink;if(!powerReduced)p.rotation.z=em.rz+Math.sin(age*43+em.delay*9)*.045*(1-t);}
   const as=p.userData.assemble;if(as){const t=Math.min(1,Math.max(0,(age-as.delay)/.42)),e=powerReduced?1:ADDON_BACK(t),k=1+(1-e)*1.4;p.position.x=as.x*k;p.position.y=as.y*k;}
   if(p.userData.heave)p.position.y=p.userData.heave.y+Math.max(0,Math.sin(clock*11-p.userData.heave.i*.95))*.3;
   if(p.userData.debris)addonPlaceDebris(p,age);
   if(p.name==='rock-dust'){const g=powerReduced?1:1+Math.min(age,1.6)*.55;p.scale.set(p.userData.base*g,p.userData.base*g,1+Math.min(age,1.6)*1.3);p.material.uniforms.fade.value=fade*Math.max(0,1-age/1.8);}
   if(p.name==='acid-boil')p.position.y=-.65+Math.abs(Math.sin(clock*3+p.userData.seed))*.55;
   if(p.name==='kraken-tentacle')p.rotation.y=Math.sin(clock*2+p.userData.arm)*.035;
   if(p.name==='cascade-crown')p.rotation.y=clock*.5;
   if(p.name==='arbor-flower')p.rotation.y=clock*.22;
   if(p.name==='accretion-ring')p.rotation.z=clock*.6;
   if(p.name==='radial-bolt')p.visible=Math.sin(clock*29+p.id*3)>.0;
   if(p.name==='cement-dust')p.scale.setScalar(1+age*.3);
   if(p.name==='portal-lip')p.rotation.z=clock*.4;
   if(p.name==='wind-funnel')p.rotation.y=-clock*5.5+p.id;
   if(p.name==='boost-sheath')p.scale.x=1.75*(1+.05*Math.sin(clock*18));
  });
 }
}
