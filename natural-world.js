/* One continuous terrain edge and an offline Blender rock kit. */
function islandRimRadius(r,a,seed){return r*(.975+.035*Math.sin(a*7+seed)+.025*Math.sin(a*13+seed));}
function islandCapGeometry(r,seed){
  const segments=MOBILEFX?48:72,rings=8,p=[],uv=[],colors=[],idx=[];
  for(let j=0;j<=rings;j++)for(let k=0;k<=segments;k++){
    const a=k/segments*Math.PI*2,t=j/rings,rad=islandRimRadius(r,a,seed)*t;
    // Occupied surfaces stay at their established height. Only the unoccupied
    // outer shoulder undulates; the last ring exactly meets the cliff mesh.
    const shoulder=Math.sin(Math.max(0,(t-.8)/.2)*Math.PI)*.35*Math.sin(a*11+seed);
    const x=Math.cos(a)*rad,z=Math.sin(a)*rad*.83;p.push(x,shoulder,z);uv.push(x/12,z/12);
    const value=.78+.12*Math.sin(a*4+seed)*t+.10*(1-t);colors.push(value,value,value);
    if(j<rings&&k<segments){const n=j*(segments+1)+k,m=n+segments+1;idx.push(n,n+1,m,n+1,m+1,m);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function buildNaturalStonework(){
  const root=new THREE.Group();root.name='blender-natural-stonework';world.add(root);
  const rnd=mulberry(1871),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),scale=new THREE.Vector3();
  const industrial=activeMap.id==='stormforge';
  for(let variant=0;variant<NATURAL_STONE_DATA.length;variant++){
    const data=NATURAL_STONE_DATA[variant],g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
    const mat=new THREE.MeshStandardMaterial({color:industrial?0x737b80:variant===1?0x737d70:0xc6bfaa,map:TEX.cliffColor||null,bumpMap:TEX.cliffHeight||null,bumpScale:.065,roughness:.9,metalness:0});
    const count=(MOBILEFX?2:4),islands=world.userData.islands||[],mesh=new THREE.InstancedMesh(g,mat,islands.length*count);
    let i=0;for(const island of islands)for(let k=0;k<count;k++){
      const a=(k/count+variant/12)*Math.PI*2+.2,rad=island.r*(.80+variant*.012);
      p.set(island.x+Math.cos(a)*rad,island.y+.025,island.z+Math.sin(a)*rad*.83);
      q.setFromAxisAngle(new THREE.Vector3(0,1,0),rnd()*Math.PI*2);const s=.65+rnd()*.85;scale.set(s*(variant===0?1.6:1),s*.72,s);
      matrix.compose(p,q,scale);mesh.setMatrixAt(i++,matrix);
    }
    mesh.name=data.name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);
  }
  root.userData.source='Blender 4.5';
}

// Ecological edge planting stays on supported island shoulders, outside occupied centers.
function buildTerrainPlanting(){
 const root=new THREE.Group();root.name='island-understory';world.add(root);
 const rng=mulberry(60219),industrial=activeMap.id==='stormforge',islands=world.userData.islands||[];
 const layers=[{name:'tuft',count:MOBILEFX?14:28,color:industrial?0x8d805e:0x617a37},{name:'fern',count:MOBILEFX?7:14,color:industrial?0x6e735c:0x345d40},{name:'flowers',count:MOBILEFX?5:10,color:activeMap.id==='cherry'?0xd797ad:industrial?0xcda461:0xe2c87d}];
 const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
 for(const layer of layers){
  const verts=[],uv=[];
  for(let blade=0;blade<(layer.name==='fern'?7:5);blade++){
   const a=blade*2.399,x=Math.cos(a),z=Math.sin(a),h=layer.name==='fern'?.9:.6,w=layer.name==='flowers'?.10:.065;
   const points=[[-z*w,0,x*w],[z*w,0,-x*w],[x*.22-z*w*.5,h*.55,z*.22+x*w*.5],[-z*w,0,x*w],[x*.22-z*w*.5,h*.55,z*.22+x*w*.5],[x*.38,h,z*.38]];
   points.forEach((p,i)=>{verts.push(...p);uv.push(i%2,i/6);});
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.userData.wind=true;
  const mat=new THREE.MeshStandardMaterial({color:layer.color,roughness:1,side:THREE.DoubleSide});
  const mesh=new THREE.InstancedMesh(g,mat,islands.length*layer.count);mesh.name='understory-'+layer.name;mesh.receiveShadow=true;mesh.frustumCulled=false;
  let n=0;for(const island of islands)for(let k=0;k<layer.count;k++){
   const a=(k/layer.count+rng()*.035)*Math.PI*2,r=island.r*(.71+rng()*.06);
   pos.set(island.x+Math.cos(a)*r,island.y+.018,island.z+Math.sin(a)*r*.83);q.setFromAxisAngle(new THREE.Vector3(0,1,0),rng()*6.283);const s=.8+rng()*1.4;scale.set(s,s,s);matrix.compose(pos,q,scale);mesh.setMatrixAt(n++,matrix);mesh.setColorAt(n-1,new THREE.Color().setScalar(.78+rng()*.32));
  }
  root.add(mesh);
 }
 root.userData={islands:islands.length,instances:root.children.reduce((n,m)=>n+m.count,0),batches:3};
}
