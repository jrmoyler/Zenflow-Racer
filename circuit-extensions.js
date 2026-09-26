'use strict';
// Each detour replaces the east-side approach before rejoining the original
// control point 3. Original sections and the start/finish are retained.
const CIRCUIT_EXTENSIONS={
 cherry:{names:['Lantern Sweep','Sky Temple Hairpin','Cloudfall Bridge'],points:[[255,8,15],[340,20,-30],[405,34,-145],[365,40,-250],[290,28,-275],[205,12,-195]],
  route:{id:'temple-inside-line',name:'Temple Inside Line',cue:'GOLD INSIDE LINE · SHORTER RADIUS, LESS ROOM',from:4,to:6}},
 stormforge:{names:['Turbine Chicane','Foundry Drop','Reactor Exit'],points:[[265,10,20],[325,22,-30],[295,29,-100],[365,34,-175],[325,20,-265],[260,10,-245],[220,7,-180]],
  route:{id:'turbine-service-apex',name:'Turbine Service Apex',cue:'GOLD INSIDE LINE · SHORTER RADIUS, LESS ROOM',from:4,to:6}},
 canopy:{names:['Cliffside Sweep','Canopy Descent','Sea Bridge'],points:[[265,18,15],[335,36,-55],[395,42,-200],[335,30,-280],[250,16,-275],[210,12,-220]],
  route:{id:'root-cut-line',name:'Root Cut Line',cue:'GOLD INSIDE LINE · SHORTER RADIUS, LESS ROOM',from:4,to:6},
  // The detour arrives heading north, so rejoining old control 3 folded a 4 m hairpin; it rejoins control 4.
  drop:1}
};
function extendedCircuitControls(id,base){const def=CIRCUIT_EXTENSIONS[id];return [...base.slice(0,3),...def.points.map(p=>p.slice()),...base.slice(3+(def.drop||0))];}
function extendedCircuitKeys(id,keys){const def=CIRCUIT_EXTENSIONS[id],shift=def.points.length-(def.drop||0);return keys.map(([i,v])=>[i>=3?i+shift:i,v]);}

// Arc-length anchors are derived from authored controls, not percentages of the
// old circuit: changing a detour cannot leave its landmark on another section.
function extensionAnchor(index){
 const lengths=track.curve.getLengths(4000);
 return lengths[Math.round(index/CTRL.length*4000)]/lengths[lengths.length-1];
}
function buildExtensionLandmarks(){
 // world.userData survives world.clear(); per-circuit scenery registries must be reset here.
 world.userData.sparkEmitters=[];world.userData.heatVents=[];world.userData.vista=null;
 const def=CIRCUIT_EXTENSIONS[activeMap.id];if(!def)return;
 const metal=new THREE.MeshStandardMaterial({color:activeMap.id==='stormforge'?0x647385:activeMap.id==='cherry'?0x57465e:0xcfc8b5,metalness:.55,roughness:.45});
 const dark=new THREE.MeshStandardMaterial({color:activeMap.id==='cherry'?0x713d47:activeMap.id==='canopy'?0x64553c:0x303943,metalness:.12,roughness:.85});
 const trim=new THREE.MeshStandardMaterial({color:activeMap.trim,emissive:activeMap.trim,emissiveIntensity:.15,roughness:.55});
 const leafMat=new THREE.MeshStandardMaterial({color:0x4f8a3c,roughness:.78,side:THREE.DoubleSide,map:TEX.mossColor||null});
 const put=(u,name)=>{const g=new THREE.Group();g.name=name;trackPoint(u,0,0,g.position);const right=trackRight(u,new THREE.Vector3()),up=trackUp(u,new THREE.Vector3()),forward=trackTan(u,new THREE.Vector3()).negate();g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));world.add(g);return g;};
 const box=(g,m,x,y,z,w,h,d)=>mapMesh(new THREE.BoxGeometry(w,h,d),m,g,x,y,z);
 const anchors=[3,5,3+def.points.length-1].map(extensionAnchor);
 world.userData.extensionLandmarks=anchors.map((u,i)=>({name:def.names[i],u}));
 for(let i=0;i<3;i++){
  const g=put(anchors[i],def.names[i]);
  if(activeMap.id==='cherry'){
   // Timber lantern colonnade, temple ridge roof, and suspended bridge pylons.
   for(const side of [-1,1]){
    box(g,dark,side*9,5,0,.7,10,.7);box(g,metal,side*9,.3,0,1.6,.6,1.6);
    if(i!==1){box(g,dark,side*9,6.6,0,1.4,1.7,1.4);box(g,trim,side*9,6.6,0,1.1,1.3,1.1);}
   }
   if(i===1){for(const z of [-1.4,0,1.4])mapTube([[-11,11.4,z],[-8,10.4,z],[0,10,z],[8,10.4,z],[11,11.4,z]],.32,dark,g,16);box(g,metal,0,9,0,20,.5,3.3);}
   if(i===2)for(const side of [-1,1])mapTube([[side*9,10,-15],[side*9,5,0],[side*9,10,15]],.17,metal,g,20);
  }else if(activeMap.id==='stormforge'){
   for(const side of [-1,1]){
    box(g,metal,side*10,5,0,2,10,3);box(g,dark,side*10,.4,0,4,.8,5);
    for(let h=1;h<9;h+=2)box(g,trim,side*8.95,h,0,.12,.5,2.2);
    if(i===0){const turbine=new THREE.Group();turbine.position.set(side*13,9,0);g.add(turbine);buildTurbine(turbine,3,dark,metal,trim);}
    else mapTube([[side*11,1,-5],[side*11,6,-5],[side*11,7,0],[side*11,6,5]],.4,dark,g,10);
    // Chevron hazard plates and cable trays make the pylons read as working plant, not blocks.
    for(let h=0;h<3;h++){const plate=box(g,trim,side*11.02,2+h*2.6,-1.4,.08,.9,.28);plate.rotation.x=.6;const plate2=box(g,trim,side*11.02,2+h*2.6,1.4,.08,.9,.28);plate2.rotation.x=-.6;}
    box(g,dark,side*11.3,6,0,.35,.25,4.6);for(let k=-2;k<=2;k++)box(g,metal,side*11.3,6.18,k*.9,.4,.06,.08);
   }
   box(g,metal,0,12,0,22,.8,2);box(g,trim,0,11.5,0,17,.15,2.1);
  }else{
   // Root arches clear the full roadway; leaves stay above the seated racers.
   for(let j=0;j<(i===1?5:2);j++){
    const z=(j-(i===1?2:.5))*5;
    mapTube([[-9,0,z],[-9,5,z],[-6,9,z],[0,11,z],[6,9,z],[9,5,z],[9,0,z]],.45,dark,g,20);
    // Layered leaf-blade canopy along the arch crown plus trailing vines down each root leg.
    if(i!==2){const a=[];for(let k=0;k<=12;k++){const x=(k/12-.5)*15;a.push([x,9.4+Math.cos(x/15*Math.PI)*1.5,z,5]);}for(const side of [-1,1])for(let k=0;k<7;k++)a.push([side*(9.3+k*.02),9-k*1.05,z+.3,2]);mapMesh(vineLeafGeometry(a,501+i*31+j,1.25),leafMat,g);}
   }
   if(i===2)for(const side of [-1,1])mapTube([[side*9,11,-18],[side*9,4,0],[side*9,11,18]],.16,metal,g,20);
  }
 }
 buildThemeVista();
 if(activeMap.id==='stormforge')buildFoundryDressing(metal,dark,trim);
}

// ---------- Distant vistas ----------
// Offshore silhouettes rise from the sea plane (y -99.6) between the circuit and the ranges,
// so every heading has a readable skyline. Everything is instanced; nothing is placed within
// 90 m of any road sample or on top of an island.
function vistaSites(count,inner,outer,seed){
 const rnd=mulberry(seed),sites=[],islands=world.userData.islands||[];
 const clear=(x,z,r)=>{for(let i=0;i<N_SAMP;i+=6)if(Math.hypot(track.pos[i].x-x,track.pos[i].z-z)<r+90)return false;return !islands.some(a=>Math.hypot(a.x-x,a.z-z)<a.r+r+25)&&!sites.some(q=>Math.hypot(q.x-x,q.z-z)<q.r+r+30);};
 for(let k=0;k<count*8&&sites.length<count;k++){const a=(sites.length/count+rnd()*.08)*Math.PI*2+k*.013,d=inner+rnd()*(outer-inner),r=16+rnd()*16,x=-20+Math.cos(a)*d,z=-120+Math.sin(a)*d;if(clear(x,z,r))sites.push({x,z,r,a,s:rnd()});}
 return sites;
}
function vistaInstances(name,geometry,material,list){
 const mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,list.length)),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),sc=new THREE.Vector3();
 list.forEach((t,i)=>{e.set(t.rx||0,t.ry||0,t.rz||0);q.setFromEuler(e);p.set(t.x,t.y,t.z);sc.set(t.sx,t.sy,t.sz);m.compose(p,q,sc);mesh.setMatrixAt(i,m);});
 mesh.count=list.length;mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;world.add(mesh);return mesh;
}
// Hyperboloid cooling tower (unit height) with soot staining at the lip and splash-line base.
function coolingTowerGeometry(){
 const pts=[];for(let k=0;k<=18;k++){const y=k/18,w=.5*Math.sqrt(1+Math.pow((y-.72)/.42,2))*.58;pts.push(new THREE.Vector2(w,y));}
 const g=new THREE.LatheGeometry(pts,MOBILEFX?20:32),p=g.attributes.position,col=[];
 for(let i=0;i<p.count;i++){const y=p.getY(i),a=Math.atan2(p.getZ(i),p.getX(i)),streak=.05*Math.sin(a*23)+.03*Math.sin(a*57);const v=Math.max(.35,.92-Math.pow(Math.max(0,y-.84)/.16,2)*.45-Math.max(0,.08-y)*3+streak*(1-y));col.push(v,v*.99,v*.97);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;
}
// Chimney with red/white aviation bands in the top fifth (unit height, origin at base).
function stackGeometry(){
 const g=new THREE.CylinderGeometry(.34,.5,1,MOBILEFX?10:16,20,true).translate(0,.5,0),p=g.attributes.position,col=[];
 for(let i=0;i<p.count;i++){const y=p.getY(i),band=y>.8&&Math.floor((y-.8)/.04)%2===0,soot=Math.pow(Math.max(0,y-.93)/.07,1.5);const c=band?[.62,.12,.1]:[.82,.8,.76];col.push(c[0]*(1-soot*.8),c[1]*(1-soot*.8),c[2]*(1-soot*.8));}
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;
}
// Sawtooth-roof foundry hall: north-light glazing faces away from the sun (unit 1x1x1).
function foundryHallGeometry(){
 const sh=new THREE.Shape();sh.moveTo(-.5,0);sh.lineTo(-.5,.62);for(let k=0;k<5;k++){const x=-.5+k*.2;sh.lineTo(x+.16,.86);sh.lineTo(x+.2,.62);}sh.lineTo(.5,0);sh.closePath();
 return new THREE.ExtrudeGeometry(sh,{depth:1,bevelEnabled:false}).translate(0,0,-.5);
}
// Wave-cut sea stack: fluted, notched at the tide line, moss and hanging gardens on the crown.
function seaStackGeometry(seed){
 const seg=MOBILEFX?18:30,rows=MOBILEFX?12:22,p=[],col=[],uv=[],idx=[];
 for(let j=0;j<=rows;j++)for(let k=0;k<=seg;k++){
  const t=j/rows,a=k/seg*Math.PI*2,notch=1-.16*Math.exp(-Math.pow((t-.06)*14,2)),flute=1+.07*Math.sin(a*9+seed+t*3)+.04*Math.sin(a*17+seed*2);
  const strata=1+.035*Math.sin(t*61+seed)*Math.sin(a*3+seed),r=(.5-.14*t+.06*Math.sin(t*9+seed))*notch*flute*strata*(t>.9?Math.sqrt(Math.max(0,1-Math.pow((t-.9)/.1,2))):1); // domed, closed crown
  p.push(Math.cos(a)*r,t,Math.sin(a)*r*.86);uv.push(k/seg*3,t*6);
  const moss=Math.max(0,Math.min(1,(t-.8)/.12))*(.75+.25*Math.sin(a*5+seed)),salt=Math.exp(-Math.pow((t-.1)*9,2));
  col.push(.62+salt*.25-moss*.34,.6+salt*.22-moss*.1,.54+salt*.2-moss*.34);
  if(j<rows&&k<seg){const n=j*(seg+1)+k,m=n+seg+1;idx.push(n,m,n+1,n+1,m,m+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
// Merge flat-shaded parts with a per-part albedo into one vertex-coloured geometry.
function tintedMerge(parts){
 const list=parts.map(([g,c])=>{const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();n.deleteAttribute('normal');n.computeVertexNormals();return [n,c];});
 const count=list.reduce((t,[g])=>t+g.attributes.position.count,0),pos=new Float32Array(count*3),nor=new Float32Array(count*3),col=new Float32Array(count*3),c=new THREE.Color();let o=0;
 for(const [g,tint] of list){const p=g.attributes.position;pos.set(p.array,o*3);nor.set(g.attributes.normal.array,o*3);
  for(let i=0;i<p.count;i++){typeof tint==='function'?tint(p.getX(i),p.getY(i),p.getZ(i),c):c.setHex(tint);col[(o+i)*3]=c.r;col[(o+i)*3+1]=c.g;col[(o+i)*3+2]=c.b;}o+=p.count;g.dispose();}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeBoundingSphere();return g;
}
// Floating sky-islet (unit radius, top at y 0) crowned by a tiered pagoda: craggy tapered
// underside with strata, sweeping concave hip roofs with lifted eaves, balconies and a
// sorin finial. Albedo is baked per vertex so a whole skyline is one draw.
function pagodaIsletGeometry(seed,tiers){
 const rnd=mulberry(seed),parts=[],seg=MOBILEFX?14:22,pts=[];
 for(let k=0;k<=12;k++){const t=k/12,r=k===0?1:Math.max(.02,Math.pow(1-t,1.35)*(1+.1*Math.sin(k*2.3+seed)));pts.push(new THREE.Vector2(r,-t*1.9));}
 const rock=new THREE.LatheGeometry(pts.reverse(),seg),rp=rock.attributes.position;
 for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),a=Math.atan2(z,x),n=1+.14*Math.sin(a*5+seed)*Math.sin(y*4.1+seed)+.07*Math.sin(a*13+y*9);rp.setXYZ(i,x*n,y,z*n*.9);}
 parts.push([rock,(x,y,z,c)=>{const strata=.5+.5*Math.sin(y*14+Math.atan2(z,x)*2),top=Math.max(0,1+y*4);c.setHex(0x4b4352).lerp(new THREE.Color(0x6e6676),strata*.55).lerp(new THREE.Color(0x5d6a55),Math.min(1,top)*.8);}]);
 const cap=new THREE.CircleGeometry(1,seg).rotateX(-Math.PI/2);const cp=cap.attributes.position;for(let i=0;i<cp.count;i++){const x=cp.getX(i),z=cp.getZ(i),a=Math.atan2(z,x),n=1+.14*Math.sin(a*5+seed)*Math.sin(seed)+.07*Math.sin(a*13);cp.setXYZ(i,x*n,0,z*n*.9);}
 parts.push([cap,0x55624f]);
 // Stone plinth, then tiers shrinking upward.
 parts.push([new THREE.CylinderGeometry(.5,.56,.1,4,1).rotateY(Math.PI/4).translate(0,.05,0),0x6e6676]);
 let y=.1,w=.44;
 for(let k=0;k<tiers;k++){
  const h=k?.17:.24;parts.push([new THREE.BoxGeometry(w,h,w).translate(0,y+h/2,0),0x7a3440]);
  // Balcony rail and dark bracket band under the eave.
  parts.push([new THREE.BoxGeometry(w*1.12,.02,w*1.12).translate(0,y+h*.35,0),0x3a2f3c]);
  const eave=w*.92+.09,top=w*.34,rh=.13,prof=[];
  for(let j=0;j<=5;j++){const t=j/5,r=top+(eave-top)*Math.pow(1-t,2.1),lift=.035*Math.pow(1-t,6);prof.push(new THREE.Vector2(r,y+h+lift+t*rh));}
  const roof=new THREE.LatheGeometry(prof,4).rotateY(Math.PI/4);parts.push([roof,(x,yy,z,c)=>c.setHex(0x2f2835).lerp(new THREE.Color(0x4a3d52),Math.min(1,(yy-y-h)/rh))]);
  parts.push([new THREE.CylinderGeometry(eave*.99,eave,.014,4,1,true).rotateY(Math.PI/4).translate(0,y+h+.007,0),0x8a6a4a]);
  y+=h+rh*.7;w*=.8+rnd()*.04;
 }
 parts.push([new THREE.CylinderGeometry(.01,.02,.34,6).translate(0,y+.17,0),0xb8904e]);
 for(let k=0;k<5;k++)parts.push([new THREE.TorusGeometry(.036,.007,4,10).rotateX(Math.PI/2).translate(0,y+.07+k*.05,0),0xb8904e]);
 return tintedMerge(parts);
}
function buildThemeVista(){
 const industrial=activeMap.id==='stormforge',sea=-99.6,vista={towers:[],stacks:[],vents:[],beacons:[]};world.userData.vista=vista;
 if(industrial){
  const sites=vistaSites(MOBILEFX?6:9,340,405,4401),towers=[],stacks=[],halls=[],windows=[],decks=[],beacons=[];
  for(const [n,s] of sites.entries()){
   // Each offshore works: caisson deck, one or two cooling towers, a hall and chimneys.
   decks.push({x:s.x,y:sea-2,z:s.z,sx:s.r*3.2,sy:8,sz:s.r*2.4,ry:s.a});
   const c=Math.cos(s.a),sn=Math.sin(s.a),at=(u,v)=>({x:s.x+c*u-sn*v,z:s.z+sn*u+c*v});
   const th=90+s.s*60;for(let k=0;k<(n%2?1:2);k++){const p=at(k?-s.r*.9:s.r*.2,k?s.r*.5:-s.r*.3);towers.push({x:p.x,y:sea+2,z:p.z,sx:th*.62,sy:th,sz:th*.62});vista.vents.push({x:p.x,y:sea+2+th,z:p.z,r:th*.2});}
   const hp=at(s.r*.7,s.r*.4);halls.push({x:hp.x,y:sea+2,z:hp.z,sx:s.r*1.4,sy:26,sz:s.r*.9,ry:s.a+Math.PI/2});
   windows.push({x:hp.x,y:sea+12,z:hp.z,sx:s.r*1.42,sy:2.2,sz:s.r*.92,ry:s.a+Math.PI/2});
   for(let k=0;k<3;k++){const p=at(s.r*(1.1+k*.18),-s.r*(.4-k*.25)),h=120+((n*3+k)%4)*22;stacks.push({x:p.x,y:sea+2,z:p.z,sx:5,sy:h,sz:5});beacons.push({x:p.x,y:sea+2+h+1.2,z:p.z,sx:1.6,sy:1.6,sz:1.6});vista.stacks.push({x:p.x,y:sea+2+h,z:p.z});}
  }
  const concrete=new THREE.MeshStandardMaterial({vertexColors:true,color:0xa3a6a8,roughness:.96,side:THREE.DoubleSide,map:TEX.plasterColor||null,bumpMap:TEX.groundHeight||null,bumpScale:.4});
  const brick=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,side:THREE.DoubleSide,map:TEX.cliffColor||null});
  const steel=new THREE.MeshStandardMaterial({color:0x4a5563,roughness:.62,metalness:.55,bumpMap:TEX.metalGrain||null,bumpScale:.2});
  const glowMat=new THREE.MeshStandardMaterial({color:0xffc27a,emissive:0xff9a3c,emissiveIntensity:1.6,roughness:.5});
  const beaconMat=new THREE.MeshStandardMaterial({color:0xff4a3a,emissive:0xff2a1a,emissiveIntensity:2.4,roughness:.4});beaconMat.name='vista-aviation-beacon';
  vistaInstances('vista-cooling-towers',coolingTowerGeometry(),concrete,towers);
  vistaInstances('vista-chimneys',stackGeometry(),brick,stacks);
  vistaInstances('vista-foundry-halls',foundryHallGeometry(),steel,halls);
  vistaInstances('vista-caisson-decks',new THREE.BoxGeometry(1,1,1),steel,decks);
  vistaInstances('vista-furnace-glazing',new THREE.BoxGeometry(1,1,1),glowMat,windows);
  vistaInstances('vista-aviation-beacons',new THREE.SphereGeometry(1,10,8),beaconMat,beacons);
  vista.beaconMaterial=beaconMat;
 }else if(activeMap.id==='cherry'){
  // Floating pagoda islets drift in the mauve haze band above the sea, beyond the playable
  // islands; each carries a blossom canopy on its lee side. Two draws for the whole skyline.
  const sites=vistaSites(MOBILEFX?7:11,335,410,6173),islets=[],blossom=[],geos=[1,2].map(n=>pagodaIsletGeometry(4100+n*17,n===1?3:5));
  const lists=[[],[]];
  for(const [n,s] of sites.entries()){
   const r=s.r*.9,y=30+s.s*70,face=Math.atan2(-120-s.z,-20-s.x);
   lists[n%3===2?1:0].push({x:s.x,y,z:s.z,sx:r,sy:r*(1.05+s.s*.3),sz:r,ry:face+Math.PI/4});
   for(let k=0;k<2;k++){const a=face+Math.PI+(k?.7:-.7);blossom.push({x:s.x+Math.cos(a)*r*.62,y:y+.4,z:s.z+Math.sin(a)*r*.62,sx:r*.16,sy:r*.13,sz:r*.16,ry:a});}
   vista.towers.push({x:s.x,z:s.z,y});
  }
  const shell=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0,map:TEX.cliffColor||null,bumpMap:TEX.cliffHeight||null,bumpScale:.3});
  lists.forEach((list,n)=>{if(list.length)vistaInstances('vista-pagoda-islets'+(n?'-tall':''),geos[n],shell,list);else geos[n].dispose();});
  const bloom=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84,side:THREE.DoubleSide});
  if(typeof treeCanopyGeo==='function')vistaInstances('vista-islet-blossom',treeCanopyGeo(6021,[0x7a3f5c,0xe9a9c2]),bloom,blossom);
 }else{
  const sites=vistaSites(MOBILEFX?8:13,335,410,7731),stacks=[],crowns=[],anchors=[];
  for(const s of sites){
   const h=95+s.s*85,w=s.r*2.2;stacks.push({x:s.x,y:sea-4,z:s.z,sx:w,sy:h,sz:w,ry:s.a});
   for(let k=0;k<3;k++){const a=k*2.1+s.a;crowns.push({x:s.x+Math.cos(a)*w*.13,y:sea-4+h-4.5,z:s.z+Math.sin(a)*w*.14,sx:2.6+k*.5,sy:1.9+k*.3,sz:2.6+k*.5,ry:a});}
   // Hanging gardens: vines spill over the crown on the circuit-facing side.
   const face=Math.atan2(-120-s.z,-20-s.x);for(let v=0;v<(MOBILEFX?3:6);v++){const a=face+(v-2.5)*.28,rr=w*.36;for(let d=0;d<8;d++)anchors.push([s.x+Math.cos(a)*rr*(1+d*.006),sea-4+h-1-d*2.6,s.z+Math.sin(a)*rr*.86*(1+d*.006),3]);}
  }
  const rock=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,map:TEX.cliffColor||null,bumpMap:TEX.cliffHeight||null,bumpScale:.5});
  const canopy=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,side:THREE.DoubleSide});
  vistaInstances('vista-sea-stacks',seaStackGeometry(3.7),rock,stacks);
  if(typeof treeCanopyGeo==='function')vistaInstances('vista-stack-gardens',treeCanopyGeo(5150,[0x1f4a31,0x6d9a4a]),canopy,crowns);
  const vineMat=new THREE.MeshStandardMaterial({color:0x3f6f35,roughness:.82,side:THREE.DoubleSide});
  const vines=new THREE.Mesh(vineLeafGeometry(anchors,9021,3.2),vineMat);vines.name='vista-hanging-gardens';vines.userData.dynamic=true;world.add(vines);
  // Vine curtains spill over every island rim (the cliff tapers inward, so they hang free),
  // leaving the waterfall lips clear.
  const curtain=[],isl=world.userData.islands||[];
  isl.forEach((island,n)=>{const count=MOBILEFX?4:8,rnd=mulberry(n*13+77);for(let k=0;k<count;k++){
   const a=(k+rnd()*.6)/count*Math.PI*2;if(Math.abs(Math.sin((a-Math.PI/2)/2))<.18||(n%3===0&&Math.abs(Math.sin((a-Math.PI/2+.9)/2))<.15))continue;
   const rim=typeof islandRimRadius==='function'?islandRimRadius(island.r,a,n+80):island.r*.975,len=MOBILEFX?6:9+Math.floor(rnd()*6);
   for(let d=0;d<len;d++)curtain.push([island.x+Math.cos(a)*rim*1.01,island.y-.3-d*1.25,island.z+Math.sin(a)*rim*.83*1.01+(d%2)*.15,d<2?4:2]);}});
  if(curtain.length){const hang=new THREE.Mesh(vineLeafGeometry(curtain,4417,1.15),vineMat);hang.name='island-vine-curtains';hang.userData.dynamic=true;world.add(hang);}
  vista.towers=sites.map(s=>({x:s.x,z:s.z}));
 }
}

// ---------- Stormforge foundry dressing ----------
// Overhead gantry cranes span the road (lowest steel 9.6 m), crucible furnaces sit in each
// machine yard, and their positions seed the GPU spark / heat-haze systems in living-world.
function buildFoundryDressing(metal,dark,trim){
 const emitters=[],islands=world.userData.islands||[];world.userData.sparkEmitters=emitters;world.userData.heatVents=[];
 const hot=new THREE.MeshStandardMaterial({color:0xffb46a,emissive:0xff7a1e,emissiveIntensity:2.2,roughness:.4});
 const hazard=new THREE.MeshStandardMaterial({color:0xf0b43a,roughness:.5,metalness:.2});
 const iron=new THREE.MeshStandardMaterial({color:0x3b3f45,roughness:.72,metalness:.6,bumpMap:TEX.metalGrain||null,bumpScale:.05});
 const anchors=(world.userData.extensionLandmarks||[]).map(m=>m.u);
 for(const u0 of [.05,.683,.939]){
  if(anchors.some(a=>Math.abs(a-u0)<.02))continue;
  const g=new THREE.Group();g.name='foundry-gantry';trackPoint(u0,0,0,g.position);
  const right=trackRight(u0,new THREE.Vector3()),forward=trackTan(u0,new THREE.Vector3()).negate();right.y=0;right.normalize();forward.y=0;forward.normalize();
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,new THREE.Vector3(0,1,0),forward));
  // Another section passing through the span would be struck by the legs or girder.
  const inv=new THREE.Matrix4().compose(g.position,g.quaternion,new THREE.Vector3(1,1,1)).invert(),q=new THREE.Vector3();let blocked=false;
  for(let i=0;i<N_SAMP&&!blocked;i+=3){const d=Math.abs(i/N_SAMP-u0);if(Math.min(d,1-d)*track.len<30)continue;q.copy(track.pos[i]).applyMatrix4(inv);if(Math.abs(q.x)<22&&Math.abs(q.z)<12&&q.y>-3&&q.y<16)blocked=true;}
  if(blocked)continue;world.add(g);
  for(const side of [-1,1]){
   // A-frame legs on bogies, diagonal bracing and a caged ladder.
   for(const dz of [-2.2,2.2]){const leg=mapMesh(new THREE.BoxGeometry(.7,11.6,.7),hazard,g,side*13,5.8,dz);leg.rotation.x=dz>0?-.08:.08;}
   mapMesh(new THREE.BoxGeometry(1.6,.8,6.4),iron,g,side*13,.4,0);
   for(const y of [3.4,7.2]){const br=mapMesh(new THREE.BoxGeometry(.18,.18,4.4),iron,g,side*13,y,0);br.rotation.x=.55;}
   for(let k=0;k<10;k++)mapMesh(new THREE.BoxGeometry(.5,.05,.05),iron,g,side*13.55,.8+k*1.05,-2.2);
  }
  // Twin box girders with end trucks, trolley, hoist drum, cable and hook block.
  for(const dz of [-.9,.9]){mapMesh(new THREE.BoxGeometry(28,1.1,.6),hazard,g,0,10.2,dz);mapMesh(new THREE.BoxGeometry(28,.14,.8),iron,g,0,9.6,dz);}
  for(let k=-6;k<=6;k++)mapMesh(new THREE.BoxGeometry(.08,1.1,1.9),iron,g,k*2,10.2,0);
  const trolley=mapMesh(new THREE.BoxGeometry(3.2,1.6,2.8),iron,g,(Math.sin(u0*97)>0?4:-4),11.4,0);
  const drum=mapMesh(new THREE.CylinderGeometry(.55,.55,2.2,14),dark,g,trolley.position.x,11.3,0);drum.rotation.x=Math.PI/2;
  mapMesh(new THREE.CylinderGeometry(.04,.04,2.2,5),dark,g,trolley.position.x,9.4,0);
  mapMesh(new THREE.BoxGeometry(.9,1.1,.6),hazard,g,trolley.position.x,8.4,0);
  mapTube([[trolley.position.x,7.9,0],[trolley.position.x+.35,7.5,0],[trolley.position.x+.1,7.15,0],[trolley.position.x-.3,7.35,0]],.1,iron,g,8);
  for(const side of [-1,1])mapMesh(new THREE.SphereGeometry(.28,10,8),hot,g,side*13,11.9,0);
 }
 // Crucible furnaces: refractory shell, glowing tap hole, ladle and spark spout per yard.
 const brick=new THREE.MeshStandardMaterial({color:0x6c4a3c,roughness:.92,map:TEX.cliffColor||null,bumpMap:TEX.cliffHeight||null,bumpScale:.12});
 const limit=MOBILEFX?8:14;
 for(const island of islands){
  if(emitters.length>=limit)break;if(island.temple)continue; // landmark tower occupies the centre
  // West of the yard slab, clear of the pond, stepping stones and orchard ring; tap hole faces -x.
  const r=island.r,x=island.x-r*.3,z=island.z+r*.03,y=island.y;
  const shell=mapMesh(new THREE.CylinderGeometry(1.9,2.3,4.4,18),brick,world,x,y+2.2,z);shell.name='foundry-crucible';
  mapMesh(new THREE.CylinderGeometry(1.2,1.9,1.4,18),iron,world,x,y+5.1,z);
  mapMesh(new THREE.CylinderGeometry(.5,.62,3.2,12),brick,world,x,y+7.3,z);
  for(const h of [.9,2.3,3.7]){const band=mapMesh(new THREE.TorusGeometry(2.05+(3.7-h)*.05,.1,6,24),iron,world,x,y+h,z);band.rotation.x=Math.PI/2;}
  const mouth=mapMesh(new THREE.CircleGeometry(.62,20),hot,world,x-2.14,y+1.3,z);mouth.rotation.y=-Math.PI/2;
  const spout=mapMesh(new THREE.BoxGeometry(1.3,.25,.5),iron,world,x-2.7,y+1.1,z);spout.rotation.z=-.3;
  emitters.push({x:x-3.2,y:y+1.1,z,dx:-1,dz:0});world.userData.heatVents.push({x,y:y+8.9,z,r:.6});
 }
}

// Leaf-blade clusters (midrib crease, tapered tip) for vines and hanging gardens. One
// opaque, non-vertex-coloured geometry per parent so the static batching pass merges it.
function vineLeafGeometry(anchors,seed,size=1){
 const rnd=typeof mulberry==='function'?mulberry(seed):Math.random,p=[],q=new THREE.Quaternion(),e=new THREE.Euler(),v=new THREE.Vector3(),o=new THREE.Vector3();
 for(const [x,y,z,count=3] of anchors)for(let k=0;k<count;k++){
  const length=(.42+rnd()*.3)*size,width=length*.38;
  // Leaves droop from the stem: pitch below horizontal, random yaw, slight roll.
  e.set(.35+rnd()*.9,rnd()*Math.PI*2,(rnd()-.5)*.6);q.setFromEuler(e);o.set(x+(rnd()-.5)*.25*size,y+(rnd()-.5)*.3*size,z+(rnd()-.5)*.25*size);
  const pts=[[0,0,0],[-width,.03,length*.45],[0,.02,length],[width,.03,length*.45],[0,.07,length*.45]];
  for(const n of [0,1,4,1,2,4,2,3,4,3,0,4]){v.set(...pts[n]).applyQuaternion(q).add(o);p.push(v.x,v.y,v.z);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.length/3*2),2));g.computeVertexNormals();return g;
}

// Every circuit carries one marked alternate line on the existing deck. Its shorter
// inner radius saves distance, not a speed bonus, and the paint only appears where the
// road genuinely bends. Both lines pass the same ordered lap gates; there is no
// progress jump, and the exit cannot award a lap or a finish.
function configureCircuitRoutes(){
 const def=CIRCUIT_EXTENSIONS[activeMap.id];
 const first=def&&def.points[0],extended=!!first&&CTRL.some(p=>p[0]===first[0]&&p[1]===first[1]&&p[2]===first[2]);
 track.serviceRoute=extended&&def.route
  ?{id:def.route.id,name:def.route.name,cue:def.route.cue,start:extensionAnchor(def.route.from),end:extensionAnchor(def.route.to)}
  :null;
}
function serviceLaneMetric(u,lat){
 const route=track.serviceRoute;if(!route||u<=route.start||u>=route.end)return 1;
 return Math.max(.82,Math.min(1.18,1-trackCurv(u)*lat));
}
function serviceLaneTarget(u){
 const route=track.serviceRoute;if(!route||u<=route.start||u>=route.end)return null;
 const curve=trackCurv(u);return Math.abs(curve)>.004?Math.sign(curve)*4.65:null;
}
function buildServiceLane(){
 const route=track.serviceRoute;if(!route)return;
 const positions=[],indices=[],p=new THREE.Vector3();
 // Individual short paint dashes follow the real road frame and bank angle.
 for(let u=route.start;u<route.end;u+=5/track.len){
  const lat=serviceLaneTarget(u);if(lat===null)continue;
  const base=positions.length/3;
  for(const [du,offset] of [[0,-.8],[0,.8],[2.5/track.len,-.8],[2.5/track.len,.8]]){trackPoint(u+du,lat+offset,.035,p);positions.push(p.x,p.y,p.z);}
  indices.push(base,base+2,base+1,base+1,base+2,base+3);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
 const mat=new THREE.MeshStandardMaterial({color:0xe4b66b,roughness:.9,side:THREE.DoubleSide});if(typeof decalMaterial==='function')decalMaterial(mat);
 const markings=new THREE.Mesh(geo,mat);markings.name=route.id+'-markings';markings.receiveShadow=true;world.add(markings);
 world.userData.serviceRoute={...route,width:1.6,metricRange:[.82,1.18],checkpointBypass:false};
}

// P1.8 — circuit identity. Each authored moment already has real geometry; this reports
// the one a racer has just entered so the HUD can name it. Sections are ordered by
// arc length, so a crossing is a plain interval test and never re-fires mid-section.
function circuitLandmarkCrossed(lastU,u){
 const marks=world.userData.extensionLandmarks;if(!marks||!Number.isFinite(lastU)||!Number.isFinite(u))return null;
 // A lap wrap is the only backwards step worth following; everything else is noise.
 const wrapped=u<lastU;
 for(const mark of marks){
  const crossed=wrapped?(lastU<mark.u||u>=mark.u):(lastU<mark.u&&u>=mark.u);
  if(crossed)return mark;
 }
 return null;
}
