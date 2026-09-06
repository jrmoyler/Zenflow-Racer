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
