// Reference-led circuits. Keep this registry before world.js in script order.
const MAPS = [
  {id:'cherry',name:'Cherry Blossom Skyway',image:'assets/art/map-cherry.webp',theme:'Sanctuary in the clouds',difficulty:'Flowing',road:0x777ab2,edge:0x70f4ff,trim:0xe4b7ef,skyTop:0x879cdb,skyHorizon:0xffcadb,fog:0xc5c8ec,sun:0xffe5df},
  {id:'stormforge',name:'Nexus Stormforge',image:'assets/art/map-stormforge.webp',theme:'Race the turbine foundry',difficulty:'Technical',road:0x525f78,edge:0x58efff,trim:0xffbb54,skyTop:0x667694,skyHorizon:0xffc99a,fog:0xadb6d1,sun:0xffce9a,
    control:[[20,0,0],[95,0,0],[155,4,-35],[175,12,-100],[120,21,-130],[60,23,-95],[12,19,-120],[-25,25,-185],[-80,32,-235],[-155,34,-240],[-200,29,-190],[-205,18,-110],[-160,12,-60],[-115,9,-105],[-95,6,-165],[-40,4,-160],[-10,2,-100],[-55,0,-55],[-60,0,-10],[-20,0,15]]},
  {id:'canopy',name:'Vital Canopy Run',image:'assets/art/map-canopy.webp',theme:'Living gardens above the sea',difficulty:'Sweeping',road:0xb2cbc5,edge:0x48efff,trim:0xf1f2d7,skyTop:0x69bae9,skyHorizon:0xe4f6ff,fog:0xc3e4ee,sun:0xfff6dc,
    control:[[20,0,0],[85,0,-10],[145,8,-45],[175,19,-95],[150,30,-150],[90,34,-145],[45,29,-115],[10,22,-150],[5,19,-215],[-55,15,-245],[-125,11,-225],[-155,8,-170],[-195,4,-120],[-180,0,-65],[-115,3,-50],[-75,10,-105],[-30,8,-100],[-15,3,-65],[-50,0,-25],[-20,0,10]]}
];
let activeMap=MAPS[0];
let mapSceneryAnimations=[];
function selectMap(id){
  const next=MAPS.find(m=>m.id===id);if(!next)throw new Error('Unknown circuit: '+id);
  if(next===activeMap&&world.children.length)return false;
  activeMap=next;
  const controls=next.control||CHERRY_CONTROL;
  CTRL.splice(0,CTRL.length,...controls.map(p=>p.slice()));
  // Wide, gently banked circuits maintain a continuous start/finish frame.
  ROLL_KEYS.splice(0,ROLL_KEYS.length,...(next.id==='cherry'?CHERRY_ROLL:[[0,0],[3,0],[4,-12],[6,0],[9,9],[12,0],[16,-8],[18,0],[20,0]]).map(p=>p.slice()));
  AG_KEYS.splice(0,AG_KEYS.length,...(next.id==='cherry'?CHERRY_AG:[[0,0],[20,0]]).map(p=>p.slice()));
  const geos=new Set(),mats=new Set();world.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});
  world.clear();geos.forEach(g=>g.dispose());mats.forEach(m=>{m.userData?.mapTexture?.dispose();m.dispose();});mapSceneryAnimations=[];
  buildTrackFrames();buildTrackMeshes();buildEnvironment();applyMapAtmosphere();
  return true;
}
function applyMapAtmosphere(){
  scene.fog.color.setHex(activeMap.fog);sun.color.setHex(activeMap.sun);hemi.color.setHex(activeMap.skyTop);hemi.groundColor.setHex(activeMap.id==='canopy'?0x537b60:0x8272a0);
  if(typeof game!=='undefined'&&game.skyMat?.uniforms.skyTop){game.skyMat.uniforms.skyTop.value.setHex(activeMap.skyTop);game.skyMat.uniforms.skyHorizon.value.setHex(activeMap.skyHorizon);}
  if(typeof refreshMapEnvironment==='function')refreshMapEnvironment();
}
function updateMapScenery(dt){for(const rotor of mapSceneryAnimations)rotor.rotation.z+=dt*.2;}
