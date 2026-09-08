/* Actual world-space inventory models, using the approved icon silhouettes. */
function itemModelMaterial(color,emissive=false){
  return new THREE.MeshPhysicalMaterial({color,metalness:emissive?.35:.55,roughness:.2,clearcoat:1,emissive:emissive?color:0x000000,emissiveIntensity:emissive?.65:0});
}
function modelPart(group,geometry,material,x=0,y=0,z=0){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;}
function buildReferenceMine(){
  const g=new THREE.Group();g.name='Loom Mine';
  const pearl=itemModelMaterial(0xeef4ff),metal=itemModelMaterial(0x263c27),green=itemModelMaterial(0xa3e635,true);
  modelPart(g,new THREE.CylinderGeometry(.53,.7,.22,32),metal,0,.05);
  const dome=modelPart(g,new THREE.SphereGeometry(.36,24,12,0,Math.PI*2,0,Math.PI/2),green,0,.2);
  modelPart(g,new THREE.TorusGeometry(.44,.055,8,32),pearl,0,.17).rotation.x=Math.PI/2;
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,leg=new THREE.Mesh(coachwork([[-.2,.12,.32,.08],[.12,.19,.28,.12],[.55,.2,.13,.14],[.72,.12,-.05,.06]],16),pearl);leg.rotation.y=a;g.add(leg);
    const strip=modelPart(g,new THREE.BoxGeometry(.15,.045,.25),green,Math.sin(a)*.54,.27,Math.cos(a)*.54);strip.rotation.y=a;
  }
  g.userData.core=dome;return g;
}
function buildReferenceMissile(){
  const g=new THREE.Group();g.name='Vector Missile';
  const pearl=itemModelMaterial(0xe7edf6),blue=itemModelMaterial(0x259eea,true),dark=itemModelMaterial(0x0a1932);
  const body=modelPart(g,new THREE.LatheGeometry([new THREE.Vector2(.1,-.8),new THREE.Vector2(.26,-.65),new THREE.Vector2(.28,.2),new THREE.Vector2(.24,.35)],24),pearl);body.rotation.x=-Math.PI/2;
  const nose=modelPart(g,new THREE.LatheGeometry([new THREE.Vector2(.24,0),new THREE.Vector2(.18,.24),new THREE.Vector2(.07,.5),new THREE.Vector2(0,.64)],24),blue,0,0,-.35);nose.rotation.x=-Math.PI/2;
  for(let i=0;i<3;i++){
    const shape=new THREE.Shape();shape.moveTo(.17,-.1);shape.lineTo(.62,.5);shape.lineTo(.57,.72);shape.lineTo(.2,.54);shape.closePath();
    const fin=modelPart(g,new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:1}),dark);fin.rotation.x=Math.PI/2;fin.rotation.y=i*Math.PI*2/3;
  }
  modelPart(g,new THREE.TorusGeometry(.17,.045,8,24),blue,0,0,.8);
  return g;
}
function buildReferenceCapsule(color){
 const g=new THREE.Group(),pearl=itemModelMaterial(0xeef4ff),dark=itemModelMaterial(0x15253f),energy=itemModelMaterial(color,true);
 // Transparent-looking energy vessel enclosed by four modeled pearl straps.
 const core=modelPart(g,new THREE.SphereGeometry(.34,24,16),energy);core.scale.z=1.65;
 for(const z of [-.37,.37])modelPart(g,new THREE.TorusGeometry(.30,.035,8,28),dark,0,0,z);
 for(let j=0;j<4;j++){
  const a=j*Math.PI/2,strap=new THREE.Mesh(kartRibbon([[Math.cos(a)*.21,Math.sin(a)*.21,-.49],[Math.cos(a)*.37,Math.sin(a)*.37,-.27],[Math.cos(a)*.39,Math.sin(a)*.39,.25],[Math.cos(a)*.20,Math.sin(a)*.20,.49]],.07,.035),pearl);g.add(strap);
 }
 modelPart(g,new THREE.TorusGeometry(.28,.035,8,28),energy,0,0,-.4);
 return g;
}
function buildInventoryModel(key){
 if(key==='mine')return buildReferenceMine();if(key==='missile')return buildReferenceMissile();
 const g=new THREE.Group(),pearl=itemModelMaterial(0xeef4ff),dark=itemModelMaterial(0x15253f);
 const palette={shield:0x42e4ed,pulse:0xffbc36,triple:0xa63dff,burst:0xff2258};
 const accent=itemModelMaterial(palette[key]||palette.burst,true);
 if(key==='shield'){
  g.name='Aegis Shield';
  const s=new THREE.Shape();s.moveTo(0,.7);s.lineTo(.6,.43);s.lineTo(.49,-.35);s.lineTo(0,-.78);s.lineTo(-.49,-.35);s.lineTo(-.6,.43);s.closePath();
  modelPart(g,new THREE.ExtrudeGeometry(s,{depth:.18,bevelEnabled:true,bevelThickness:.04,bevelSize:.05,bevelSegments:3}),pearl);
  const face=modelPart(g,new THREE.ExtrudeGeometry(s,{depth:.06,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2}),accent,0,0,-.09);face.scale.set(.8,.8,1);
  modelPart(g,new THREE.TorusGeometry(.22,.027,8,32),pearl,0,-.03,-.14);
  const hub=modelPart(g,new THREE.SphereGeometry(.14,20,12),accent,0,-.03,-.16);hub.scale.z=.5;
  // Actual hexagonal reinforcement, visible from orbit views as shallow surface ribs.
  for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++){
   const x=col*.145+(row%2)*.07,y=row*.126;
   if(Math.abs(x)>.30-Math.max(0,-y)*.2||Math.hypot(x,y)<.22)continue;
   modelPart(g,new THREE.TorusGeometry(.078,.006,3,6),pearl,x,y,-.125).rotation.z=Math.PI/6;
  }
 }else if(key==='pulse'){
  g.name='Overseer Pulse';
  modelPart(g,new THREE.CylinderGeometry(.49,.54,.20,32),dark,0,-.2);
  modelPart(g,new THREE.TorusGeometry(.45,.095,8,32),pearl,0,-.09).rotation.x=Math.PI/2;
  modelPart(g,new THREE.SphereGeometry(.29,24,16),accent,0,.25);
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3,m=modelPart(g,new THREE.BoxGeometry(.13,.25,.17),pearl,Math.sin(a)*.43,-.16,Math.cos(a)*.43);m.rotation.y=a;
  }
  for(let i=0;i<3;i++){
   const ring=modelPart(g,new THREE.TorusGeometry(.50+i*.15,.016,6,48,Math.PI*1.7),accent,0,-.38+i*.44);
   ring.rotation.x=Math.PI/2;ring.rotation.z=i*1.7;
  }
 }else if(key==='triple'){
  g.name='Node Cluster';
  for(let i=0;i<3;i++){
   const a=i*Math.PI*2/3,body=buildReferenceCapsule(palette.triple);body.scale.setScalar(.64);body.position.set(Math.sin(a)*.40,Math.cos(a)*.40,0);body.rotation.set(0,Math.sin(a)*.5,-a);g.add(body);
  }
  modelPart(g,new THREE.SphereGeometry(.13,16,12),accent,0,0,-.2);
 }else{
  g.name='Signal Burst';g.add(buildReferenceCapsule(palette.burst));
  for(let i=0;i<3;i++){
   const fin=modelPart(g,sculptedPanel([[.19,0,.09],[.58,0,.70],[.36,0,.56],[.20,0,.40]],.045),accent);fin.rotation.z=i*Math.PI*2/3;
  }
 }
 return g;
}
