/* Software rendering of the same authored scene, camera and animated meshes.
   No reference illustrations, alternate vehicle silhouettes or scenery mattes. */
class CanvasRaceRenderer {
  constructor({canvas,alpha=false}) {
    this.domElement=canvas;this.ctx=canvas.getContext('2d',{alpha});this.shadowMap={enabled:false};
    this.capabilities={isWebGL2:false,getMaxAnisotropy:()=>1};this.info={render:{calls:0,triangles:0},memory:{geometries:0,textures:0}};
    this.ratio=1;this.width=innerWidth;this.height=innerHeight;this.geometryCache=new WeakMap();this.portraits=new Map();
    this.domElement.dataset.renderer='software-3d';
  }
  setPixelRatio(r){this.ratio=Math.min(r,1);if(this.width)this.setSize(this.width,this.height);}
  setSize(w,h){this.width=w;this.height=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';}
  // Vertex clustering gives CPU mode a bounded mesh workload while preserving each
  // authored part, silhouette and transform. Cache only immutable BufferGeometry.
  meshData(g){
    const cached=this.geometryCache.get(g);if(cached)return cached;
    const pos=g.attributes.position;if(!pos)return null;g.computeBoundingBox();g.computeBoundingSphere();
    const extent=g.boundingBox.getSize(new THREE.Vector3()),cell=Math.max(extent.x,extent.y,extent.z)/28;
    const vertices=[],sourceIndices=[],remap=[],buckets=new Map();
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),key=cell>0?[Math.round(x/cell),Math.round(y/cell),Math.round(z/cell)].join(','):String(i);
      let id=buckets.get(key);if(id===undefined){id=vertices.length;buckets.set(key,id);vertices.push(new THREE.Vector3(x,y,z));sourceIndices.push(i);}remap[i]=id;
    }
    const faces=[],seen=new Set(),idx=g.index,count=idx?idx.count:pos.count;
    for(let i=0;i<count;i+=3){const a=remap[idx?idx.getX(i):i],b=remap[idx?idx.getX(i+1):i+1],c=remap[idx?idx.getX(i+2):i+2];if(a===b||b===c||c===a)continue;
      const key=[a,b,c].sort((x,y)=>x-y).join(',');if(seen.has(key))continue;seen.add(key);
      const group=g.groups.find(v=>i>=v.start&&i<v.start+v.count);faces.push([a,b,c,group?.materialIndex||0]);
    }
    const result={vertices,sourceIndices,faces};this.geometryCache.set(g,result);return result;
  }
  drawScene(stage,cam,rect,clear=true){
    const ctx=this.ctx,w=rect.width,h=rect.height,x=rect.x||0,y=rect.y||0;
    ctx.save();ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    const map=typeof activeMap!=='undefined'?activeMap:{skyTop:0x798bad,skyHorizon:0xdceafa,fog:0xc6d8e6};
    if(clear){const gradient=ctx.createLinearGradient(0,y,0,y+h);gradient.addColorStop(0,'#'+new THREE.Color(map.skyTop).getHexString());gradient.addColorStop(1,'#'+new THREE.Color(map.skyHorizon).getHexString());ctx.fillStyle=gradient;ctx.fillRect(x,y,w,h);}
    stage.updateMatrixWorld(true);cam.updateMatrixWorld(true);cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const vp=new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse),frustum=new THREE.Frustum().setFromProjectionMatrix(vp);
    const triangles=[],eye=new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld),light=new THREE.Vector3(-.4,.85,-.35).normalize(),normal=new THREE.Vector3(),edge=new THREE.Vector3(),worldMatrix=new THREE.Matrix4(),instance=new THREE.Matrix4(),sphere=new THREE.Sphere();
    const candidates=[];stage.traverseVisible(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;if(o.material?.isShaderMaterial||o.material?.opacity<.025)return;
      if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if(!o.isInstancedMesh&&!frustum.intersectsSphere(sphere))return;
      candidates.push({o,d:sphere.center.distanceTo(eye)-sphere.radius});});
    candidates.sort((a,b)=>a.d-b.d);let processed=0;
    for(const entry of candidates){const o=entry.o,data=this.meshData(o.geometry);if(!data)continue;
      for(let n=0;n<(o.isInstancedMesh?o.count:1);n++){
        if(o.isInstancedMesh){o.getMatrixAt(n,instance);worldMatrix.multiplyMatrices(o.matrixWorld,instance);}else worldMatrix.copy(o.matrixWorld);
        sphere.copy(o.geometry.boundingSphere).applyMatrix4(worldMatrix);if(!frustum.intersectsSphere(sphere))continue;
        const distance=Math.max(.01,sphere.center.distanceTo(eye));if(sphere.radius/distance*w<1.5)continue;
        if(o.isSkinnedMesh)o.skeleton.update();
        const world=data.vertices.map((v,i)=>{const p=v.clone();if(o.isSkinnedMesh)o.boneTransform(data.sourceIndices[i],p);return p.applyMatrix4(worldMatrix);}),screen=world.map(v=>v.clone().applyMatrix4(vp));
        for(const f of data.faces){const a=screen[f[0]],b=screen[f[1]],c=screen[f[2]];
          if(a.z < -1||b.z < -1||c.z < -1||a.z>1||b.z>1||c.z>1)continue;
          const ax=x+(a.x+1)*w/2,ay=y+(1-a.y)*h/2,bx=x+(b.x+1)*w/2,by=y+(1-b.y)*h/2,cx=x+(c.x+1)*w/2,cy=y+(1-c.y)*h/2;
          if(Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))<.3)continue;
          if(Math.max(ax,bx,cx)<x||Math.min(ax,bx,cx)>x+w||Math.max(ay,by,cy)<y||Math.min(ay,by,cy)>y+h)continue;
          const mat=Array.isArray(o.material)?o.material[f[3]]:o.material;if(!mat||mat.visible===false||mat.opacity<.025)continue;
          normal.subVectors(world[f[1]],world[f[0]]).cross(edge.subVectors(world[f[2]],world[f[0]])).normalize();
          const shade=mat.isMeshBasicMaterial?1:.4+.6*Math.abs(normal.dot(light));const color=(mat.color||new THREE.Color(0xb4d1de)).clone().multiplyScalar(shade);
          if(mat.emissive)color.add(mat.emissive.clone().multiplyScalar(Math.min(.45,mat.emissiveIntensity||0)));
          if(stage.fog){const fog=1-Math.exp(-Math.pow(distance*(stage.fog.density||.0012),2));color.lerp(stage.fog.color,Math.min(.9,fog));}
          triangles.push({p:[ax,ay,bx,by,cx,cy],depth:(a.z+b.z+c.z)/3,color:'#'+color.getHexString(),alpha:mat.transparent?mat.opacity:1});
        }
        processed+=data.faces.length;if(processed>180000)break;
      }
      if(processed>180000)break;
    }
    triangles.sort((a,b)=>b.depth-a.depth);for(const t of triangles){ctx.globalAlpha=t.alpha;ctx.fillStyle=t.color;ctx.beginPath();ctx.moveTo(t.p[0],t.p[1]);ctx.lineTo(t.p[2],t.p[3]);ctx.lineTo(t.p[4],t.p[5]);ctx.closePath();ctx.fill();}
    ctx.restore();this.info.render.calls=triangles.length;this.info.render.triangles=triangles.length;
  }
  render(stage,cam){if(stage&&cam)this.drawScene(stage,cam,{x:0,y:0,width:this.width,height:this.height});}
  makePreview(division){const stage=new THREE.Scene(),kart=buildKart(division);stage.add(kart);const cam=new THREE.PerspectiveCamera(32,1,.1,40);cam.position.set(5,3.7,-7);cam.lookAt(0,1,0);return {stage,kart,cam};}
  renderRosterPreview(division,rect,angle=0){
    if(!division||!rect)return;if(this.preview?.division!==division.id){if(this.preview)disposeKart(this.preview.kart);this.preview={...this.makePreview(division),division:division.id};}
    const {stage,kart,cam}=this.preview;kart.rotation.y=angle;cam.aspect=rect.width/rect.height;cam.updateProjectionMatrix();this.drawScene(stage,cam,rect,false);
  }
  renderDirectorPortrait(division){
    if(this.portraits.has(division.id))return this.portraits.get(division.id);
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=180;canvas.setAttribute('aria-label',division.name+' playable kart');
    const previous=this.ctx,ratio=this.ratio,{stage,kart,cam}=this.makePreview(division);cam.aspect=160/180;cam.updateProjectionMatrix();
    try{this.ctx=canvas.getContext('2d');this.ratio=1;this.drawScene(stage,cam,{x:0,y:0,width:160,height:180},false);}finally{this.ctx=previous;this.ratio=ratio;disposeKart(kart);}
    this.portraits.set(division.id,canvas);return canvas;
  }
}
