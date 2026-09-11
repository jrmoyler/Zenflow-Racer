// Reference-led circuits. Keep this registry before world.js in script order.
const SOLAR_DIRECTION=new THREE.Vector3(-90,140,-60).normalize();
const MAPS = [
  {id:'cherry',name:'Cherry Blossom Skyway',theme:'Sanctuary in the clouds',difficulty:'Flowing',road:0x6b60b8,edge:0x70f4ff,trim:0xe4b7ef,skyTop:0x6f86d6,skyHorizon:0xf4bcd6,fog:0xb9b3e2,sun:0xffe5df},
  {id:'stormforge',name:'Nexus Stormforge',theme:'Race the turbine foundry',difficulty:'Technical',road:0x525f78,edge:0x58efff,trim:0xffbb54,skyTop:0x667694,skyHorizon:0xffc99a,fog:0xadb6d1,sun:0xffce9a,
    control:[[20,0,0],[95,0,0],[155,4,-35],[175,12,-100],[120,21,-130],[60,23,-95],[12,19,-120],[-25,25,-185],[-80,32,-235],[-155,34,-240],[-200,29,-190],[-205,18,-110],[-160,12,-60],[-115,9,-105],[-95,6,-165],[-40,4,-160],[-10,2,-100],[-55,0,-55],[-60,0,-10],[-20,0,15]]},
  {id:'canopy',name:'Vital Canopy Run',theme:'Living gardens above the sea',difficulty:'Sweeping',road:0x7fb2a8,edge:0x48efff,trim:0xf1f2d7,skyTop:0x5fb0e6,skyHorizon:0xd3eefb,fog:0xbcdde8,sun:0xfff6dc,
    control:[[20,0,0],[85,0,-10],[145,8,-45],[175,19,-95],[150,30,-150],[90,34,-145],[45,29,-115],[10,22,-150],[5,19,-215],[-55,15,-245],[-125,11,-225],[-155,8,-170],[-195,4,-120],[-180,0,-65],[-115,3,-50],[-75,10,-105],[-30,8,-100],[-15,3,-65],[-50,0,-25],[-20,0,10]]}
];
let activeMap=MAPS[0];
let mapSceneryAnimations=[];
function selectMap(id){
  const next=MAPS.find(m=>m.id===id);if(!next)throw new Error('Unknown circuit: '+id);
  if(next===activeMap&&world.children.length)return false;
  activeMap=next;
  const baseControls=next.control||CHERRY_CONTROL;
  const controls=typeof extendedCircuitControls==='function'?extendedCircuitControls(id,baseControls):baseControls;
  const adapt=keys=>typeof extendedCircuitKeys==='function'?extendedCircuitKeys(id,keys):keys;
  CTRL.splice(0,CTRL.length,...controls.map(p=>p.slice()));
  // Wide, gently banked circuits maintain a continuous start/finish frame.
  ROLL_KEYS.splice(0,ROLL_KEYS.length,...adapt(next.id==='cherry'?CHERRY_ROLL:[[0,0],[3,0],[4,-12],[6,0],[9,9],[12,0],[16,-8],[18,0],[20,0]]).map(p=>p.slice()));
  AG_KEYS.splice(0,AG_KEYS.length,...adapt(next.id==='cherry'?CHERRY_AG:[[0,0],[20,0]]).map(p=>p.slice()));
  const geos=new Set(),mats=new Set();world.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});
  world.clear();geos.forEach(g=>g.dispose());mats.forEach(m=>{m.userData?.mapTexture?.dispose();m.dispose();});mapSceneryAnimations=[];
  buildTrackFrames();buildTrackMeshes();buildEnvironment();applyMapAtmosphere();
  return true;
}
function applyMapAtmosphere(){
  scene.fog.color.setHex(activeMap.fog);
  scene.fog.near=activeMap.id==='stormforge'?200:activeMap.id==='canopy'?300:260;
  scene.fog.far=activeMap.id==='canopy'?1180:activeMap.id==='stormforge'?860:980;
  sun.color.setHex(activeMap.sun);hemi.color.setHex(activeMap.skyTop);hemi.groundColor.setHex(activeMap.id==='canopy'?0x537b60:activeMap.id==='stormforge'?0x4a5368:0x8272a0);
  hemi.intensity=activeMap.id==='stormforge'?.58:.72;
  sun.intensity=activeMap.id==='canopy'?1.2:activeMap.id==='stormforge'?1.05:1.15;
  if(typeof rim!=='undefined'){rim.color.setHex(activeMap.id==='stormforge'?0x8bcaff:activeMap.id==='canopy'?0xb6f6ff:0xaecaff);rim.intensity=.55;}
  if(typeof renderer!=='undefined')renderer.toneMappingExposure=activeMap.id==='stormforge'?.88:.94;
  if(typeof game!=='undefined'&&game.skyMat?.uniforms.skyTop){game.skyMat.uniforms.skyTop.value.setHex(activeMap.skyTop);game.skyMat.uniforms.skyHorizon.value.setHex(activeMap.skyHorizon);}
  if(typeof game!=='undefined'&&game.skyMat?.uniforms.storm){game.skyMat.uniforms.storm.value=activeMap.id==='stormforge'?1:0;game.skyMat.uniforms.cloudCover.value=activeMap.id==='stormforge'?.77:activeMap.id==='canopy'?.54:.63;}
  if(typeof refreshMapEnvironment==='function')refreshMapEnvironment();
}
function updateMapScenery(dt){
  if(typeof zenWorldTime!=='undefined')zenWorldTime.value=(zenWorldTime.value||0)+dt;
  for(const rotor of mapSceneryAnimations)rotor.rotation.z+=dt*(rotor.userData.spinRate||.2);
  if(typeof updateImmersion==='function')updateImmersion(dt);
  if(typeof updateLivingWorld==='function')updateLivingWorld(dt);
  if(typeof updateAudience==='function')updateAudience(dt);
}
