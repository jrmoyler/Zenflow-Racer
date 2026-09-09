/* Shared solar direction and anchored environmental motion. All clocks follow simulation dt. */
const LIVING_WORLD={rigs:[],leaves:[],time:0,timeline:null,gust:{value:0},lastLeaf:-1,batches:[],matrix:new THREE.Matrix4()};
function buildLivingWorld(){
  const state=LIVING_WORLD;
  state.timeline?.cancel();state.rigs=[];state.leaves=[];state.batches=[];state.time=0;state.lastLeaf=-1;state.gust.value=0;
  // A paused Anime.js envelope is advanced only by the game clock; pause cannot drift.
  state.timeline=globalThis.anime?.animate?globalThis.anime.animate(state.gust,{value:[0,1,0],duration:8000,ease:'inOutSine',autoplay:false}):null;
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.reduced=reduced;
  const seen=new Set();world.traverse(m=>{
    if(!m.isMesh)return;
    if(m.material?.isMeshStandardMaterial){m.receiveShadow=true;}
    if(m.geometry?.userData.wind&&!seen.has(m.geometry)){
      seen.add(m.geometry);const g=m.geometry;g.computeBoundingBox();
      state.leaves.push({g,base:g.attributes.position.array.slice(),min:g.boundingBox.min.y,height:Math.max(1,g.boundingBox.max.y-g.boundingBox.min.y)});
      g.computeBoundingSphere();g.boundingSphere.radius+=.6;
    }
  });
  const root=new THREE.Group();root.name='living-world-rigs';world.add(root);
  const fabric=new THREE.MeshStandardMaterial({color:activeMap.id==='cherry'?0xcf647e:activeMap.id==='stormforge'?0xe6a540:0x5aa88c,roughness:.92,side:THREE.DoubleSide,map:TEX.fabricWeave||null});
  const metal=new THREE.MeshStandardMaterial({color:0x6c6558,metalness:.72,roughness:.42,bumpMap:TEX.metalGrain||null,bumpScale:.025});
  const paper=new THREE.MeshStandardMaterial({color:0xffe1a5,emissive:0xffad48,emissiveIntensity:.48,roughness:.84,map:TEX.fabricWeave||null});
  const poleGeo=new THREE.CylinderGeometry(.09,.13,6,8),armGeo=new THREE.CylinderGeometry(.07,.07,1.7,8),cordGeo=new THREE.CylinderGeometry(.025,.025,.8,5),shadeGeo=new THREE.SphereGeometry(.44,12,8),capGeo=new THREE.CylinderGeometry(.28,.28,.09,10);
  for(const [i,island] of (world.userData.islands||[]).entries()){
    const mount=new THREE.Group();mount.name='island-wind-mount-'+i;mount.position.set(island.x+island.r*.55,island.y+.4,island.z);root.add(mount);
    const pole=new THREE.Mesh(poleGeo,metal);pole.position.y=3;mount.add(pole);
    const arm=new THREE.Mesh(armGeo,metal);arm.rotation.z=Math.PI/2;arm.position.set(.75,5.8,0);mount.add(arm);
    const hinge=new THREE.Group();hinge.name='suspension-hinge';hinge.position.set(1.5,5.8,0);mount.add(hinge);
    const cord=new THREE.Mesh(cordGeo,metal);cord.position.y=-.4;hinge.add(cord);
    const shade=new THREE.Mesh(shadeGeo,paper);shade.scale.y=1.28;shade.position.y=-1.3;hinge.add(shade);
    for(const y of[-.78,-1.83]){const cap=new THREE.Mesh(capGeo,metal);cap.position.y=y;hinge.add(cap);}
    const g=new THREE.BufferGeometry(),data=WORLD_MOTION_DATA.fabric;
    g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.setIndex(data.indices);g.computeVertexNormals();
    const flag=new THREE.Mesh(g,fabric);flag.position.set(.07,5.45,0);flag.castShadow=true;mount.add(flag);
    g.computeBoundingSphere();g.boundingSphere.radius+=.4;
    state.rigs.push({hinge,flag,base:g.attributes.position.array.slice(),phase:i*.71});
  }
  root.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
  // Instance repeated rigid pieces, including moving lantern parts. Pivot groups
  // remain the transform authority without paying one draw call per small mesh.
  root.updateMatrixWorld(true);const batches=new Map();
  root.traverse(m=>{if(!m.isMesh||m.geometry.attributes.position.count===WORLD_MOTION_DATA.fabric.positions.length/3)return;const key=m.geometry.uuid+':'+m.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(m);});
  for(const list of batches.values()){
    const mesh=new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    const sources=list.map(m=>{m.updateMatrix();const source={parent:m.parent,local:m.matrix.clone()};m.parent.remove(m);return source;});
    root.add(mesh);state.batches.push({mesh,sources});
  }
  syncLivingInstances();
  root.userData={rigCount:state.rigs.length,leafGeometries:state.leaves.length,source:WORLD_MOTION_DATA.source};
}
function syncLivingInstances(){
  for(const batch of LIVING_WORLD.batches){for(let i=0;i<batch.sources.length;i++){
    const src=batch.sources[i];src.parent.updateWorldMatrix(true,false);
    LIVING_WORLD.matrix.multiplyMatrices(src.parent.matrixWorld,src.local);batch.mesh.setMatrixAt(i,LIVING_WORLD.matrix);
  }batch.mesh.instanceMatrix.needsUpdate=true;}
}
function updateLivingWorld(dt){
  const s=LIVING_WORLD;if(!Number.isFinite(dt)||dt<=0)return;
  s.time+=Math.min(dt,.1);s.timeline?.seek((s.time*1000)%8000);
  const strength=s.reduced?.18:1,wind=(.65+s.gust.value*.35)*strength*(activeMap.id==='stormforge'?1.4:1);
  const clip=WORLD_MOTION_DATA.hinge;
  for(const r of s.rigs){
    const phase=((s.time+r.phase)%4)/4*(clip.length-1),i=Math.floor(phase);
    r.hinge.rotation.z=(clip[i]+(clip[Math.min(i+1,clip.length-1)]-clip[i])*(phase-i))*wind;
  }
  syncLivingInstances();
  // Bounded 15/10 Hz deformation shared by every instance of each leaf geometry.
  const frame=Math.floor(s.time*(MOBILEFX||LOWFX?10:15));if(frame===s.lastLeaf)return;s.lastLeaf=frame;
  for(const r of s.rigs){const p=r.flag.geometry.attributes.position;
    for(let i=0;i<p.count;i++){const k=i*3,u=r.base[k]/2.8;p.array[k+2]=r.base[k+2]+u*u*.22*wind*Math.sin(u*8-s.time*3+r.phase);}
    p.needsUpdate=true;r.flag.geometry.computeVertexNormals();
  }
  for(const leaf of s.leaves){const p=leaf.g.attributes.position;
    for(let i=0;i<p.count;i++){const k=i*3,x=leaf.base[k],y=leaf.base[k+1],z=leaf.base[k+2],weight=Math.max(0,(y-leaf.min)/leaf.height);p.array[k]=x+weight*weight*.16*wind*Math.sin(s.time*1.7+y*.7+z*.4);}
    p.needsUpdate=true;
  }
}
