'use strict';
// Each detour replaces the east-side approach before rejoining the original
// control point 3. Original sections and the start/finish are retained.
const CIRCUIT_EXTENSIONS={
 cherry:{names:['Lantern Sweep','Sky Temple Hairpin','Cloudfall Bridge'],points:[[255,8,15],[340,20,-30],[405,34,-145],[365,40,-250],[290,28,-275],[205,12,-195]]},
 stormforge:{names:['Turbine Chicane','Foundry Drop','Reactor Exit'],points:[[265,10,20],[325,22,-30],[295,29,-100],[365,34,-175],[325,20,-265],[260,10,-245],[220,7,-180]]},
 canopy:{names:['Cliffside Sweep','Canopy Descent','Sea Bridge'],points:[[265,18,15],[335,36,-55],[395,42,-200],[335,30,-280],[250,16,-275],[210,12,-220]]}
};
function extendedCircuitControls(id,base){return [...base.slice(0,3),...CIRCUIT_EXTENSIONS[id].points.map(p=>p.slice()),...base.slice(3)];}
function extendedCircuitKeys(id,keys){const count=CIRCUIT_EXTENSIONS[id].points.length;return keys.map(([i,v])=>[i>=3?i+count:i,v]);}

// Arc-length anchors are derived from authored controls, not percentages of the
// old circuit: changing a detour cannot leave its landmark on another section.
function extensionAnchor(index){
 const lengths=track.curve.getLengths(4000);
 return lengths[Math.round(index/CTRL.length*4000)]/lengths[lengths.length-1];
}
function buildExtensionLandmarks(){
 const def=CIRCUIT_EXTENSIONS[activeMap.id];if(!def)return;
 const metal=new THREE.MeshStandardMaterial({color:activeMap.id==='stormforge'?0x647385:0xcfc8b5,metalness:.55,roughness:.45});
 const dark=new THREE.MeshStandardMaterial({color:activeMap.id==='cherry'?0x713d47:activeMap.id==='canopy'?0x64553c:0x303943,metalness:.12,roughness:.85});
 const trim=new THREE.MeshStandardMaterial({color:activeMap.trim,emissive:activeMap.trim,emissiveIntensity:.15,roughness:.55});
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
   }
   box(g,metal,0,12,0,22,.8,2);box(g,trim,0,11.5,0,17,.15,2.1);
  }else{
   // Root arches clear the full roadway; leaves stay above the seated racers.
   for(let j=0;j<(i===1?5:2);j++){
    const z=(j-(i===1?2:.5))*5;
    mapTube([[-9,0,z],[-9,5,z],[-6,9,z],[0,11,z],[6,9,z],[9,5,z],[9,0,z]],.45,dark,g,20);
    if(i!==2)for(const side of [-1,1]){const leaf=mapMesh(new THREE.SphereGeometry(1,8,5),trim,g,side*6.3,9,z);leaf.scale.set(2.2,.25,1.1);leaf.rotation.z=side*.4;}
   }
   if(i===2)for(const side of [-1,1])mapTube([[side*9,11,-18],[side*9,4,0],[side*9,11,18]],.16,metal,g,20);
  }
 }
}

// Stormforge's marked service apex is a narrow alternate racing line on the
// existing deck. Its shorter inner radius saves distance, not a speed bonus.
// Both lines pass the same ordered lap gates; there is no progress jump.
function configureCircuitRoutes(){
 track.serviceRoute=activeMap.id==='stormforge'&&CTRL.length>20?{name:'Turbine Service Apex',start:extensionAnchor(4),end:extensionAnchor(6)}:null;
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
 const mat=new THREE.MeshStandardMaterial({color:0xe4b66b,roughness:.9,side:THREE.DoubleSide});
 const markings=new THREE.Mesh(geo,mat);markings.name='turbine-service-apex-markings';markings.receiveShadow=true;world.add(markings);
 world.userData.serviceRoute={...route,width:1.6,metricRange:[.82,1.18],checkpointBypass:false};
}
