/* Articulated Blender spectators, batched by body part. Simulation time owns motion. */
const AUDIENCE={seats:[],batches:[],time:0,frame:-1,root:null};
function resetAudience(){AUDIENCE.seats=[];AUDIENCE.batches=[];AUDIENCE.time=0;AUDIENCE.frame=-1;AUDIENCE.root=null;}
function addAudienceSeat(base,x,y,z,side,color,seed,standing=false){
 const m=new THREE.Matrix4().makeRotationY(side>0?Math.PI/2:-Math.PI/2);
 m.setPosition(x,y,z);m.premultiply(base);
 AUDIENCE.seats.push({matrix:m,color,seed,standing,clip:['wave','clap','watch'][seed%3]});
}
function buildAudience(){
 const s=AUDIENCE,root=new THREE.Group();root.name='blender-animated-audience';world.add(root);s.root=root;
 if(!s.seats.length)return;
 const skin=[0xe2b293,0xb77955,0x704832,0xc99470],hair=[0x211c19,0x4d3022,0xb18c51,0x706a66];
 for(const part of AUDIENCE_DATA.parts){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(part.uv,2));
  const fabric=part.kind==='shirt'||part.kind==='pants';
  const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:fabric?.94:.7,metalness:0,bumpMap:fabric?TEX.fabricWeave||null:null,bumpScale:.008});
  const mesh=new THREE.InstancedMesh(g,mat,s.seats.length);mesh.name='audience-'+part.name;mesh.frustumCulled=false;mesh.castShadow=!MOBILEFX;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  s.seats.forEach((seat,i)=>mesh.setColorAt(i,new THREE.Color(part.kind==='shirt'?seat.color:part.kind==='skin'?skin[seat.seed%4]:part.kind==='hair'?hair[seat.seed%4]:part.kind==='detail'?0x211c19:0x27313c).convertSRGBToLinear()));
  root.add(mesh);s.batches.push(mesh);
 }
 root.userData={spectators:s.seats.length,rigParts:AUDIENCE_DATA.parts.length,clips:Object.keys(AUDIENCE_DATA.clips),source:AUDIENCE_DATA.source};
 updateAudience(0,true);
}
const AUDIENCE_LOCAL=new THREE.Matrix4(),AUDIENCE_Q=new THREE.Quaternion(),AUDIENCE_E=new THREE.Euler(),AUDIENCE_P=new THREE.Vector3(),AUDIENCE_SCALE=new THREE.Vector3(1,1,1);
function updateAudience(dt,force=false){
 const s=AUDIENCE;if(!s.root||!Number.isFinite(dt)||dt<0)return;
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!force&&(dt===0||reduced))return;
 s.time+=Math.min(dt,.1);const frame=Math.floor(s.time*(MOBILEFX?10:15));if(!force&&frame===s.frame)return;s.frame=frame;
 const parts=AUDIENCE_DATA.parts,matrices=parts.map(()=>new THREE.Matrix4());
 for(let n=0;n<s.seats.length;n++){
  const seat=s.seats[n],clip=AUDIENCE_DATA.clips[seat.clip],phase=((s.time+seat.seed*.173)%AUDIENCE_DATA.duration)/AUDIENCE_DATA.duration*(clip.length-1),a=Math.floor(phase),b=Math.min(a+1,clip.length-1),mix=phase-a;
  for(let j=0;j<parts.length;j++){
   const part=parts[j],ra=clip[a][j],rb=clip[b][j];AUDIENCE_E.set(ra[0]+(rb[0]-ra[0])*mix,ra[1]+(rb[1]-ra[1])*mix,ra[2]+(rb[2]-ra[2])*mix);if(seat.standing){if(part.name.startsWith('trouser'))AUDIENCE_E.x=-Math.PI/2;if(part.name.startsWith('shin-shoe'))AUDIENCE_E.x=Math.PI/2;}AUDIENCE_Q.setFromEuler(AUDIENCE_E);AUDIENCE_P.set(...part.pivot);
   AUDIENCE_LOCAL.compose(AUDIENCE_P,AUDIENCE_Q,AUDIENCE_SCALE);matrices[j].multiplyMatrices(part.parent<0?seat.matrix:matrices[part.parent],AUDIENCE_LOCAL);s.batches[j].setMatrixAt(n,matrices[j]);
  }
 }
 for(const mesh of s.batches)mesh.instanceMatrix.needsUpdate=true;
}
