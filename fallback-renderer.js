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
  // Keep authored topology and split normals intact. No positional clustering:
  // welding nearby surfaces corrupts fingers, rims and overlapping body panels.
  meshData(g){
    let data=this.geometryCache.get(g);if(data)return data;
    const p=g.attributes.position;if(!p)return null;
    if(!g.attributes.normal)g.computeVertexNormals();
    const n=g.attributes.normal,count=p.count,positions=new Float32Array(count*3),normals=new Float32Array(count*3);
    for(let i=0;i<count;i++){positions.set([p.getX(i),p.getY(i),p.getZ(i)],i*3);normals.set([n.getX(i),n.getY(i),n.getZ(i)],i*3);}
    const indices=g.index?Uint32Array.from(g.index.array):Uint32Array.from({length:count},(_,i)=>i);
    const groups=g.groups.length?g.groups:[{start:0,count:indices.length,materialIndex:0}];
    const color=g.attributes.color,colors=color?new Float32Array(count*3):null;
    if(color)for(let i=0;i<count;i++)colors.set([color.getX(i),color.getY(i),color.getZ(i)],i*3);
    data={positions,normals,indices,groups,colors,projected:new Float32Array(count*8+48)};
    g.computeBoundingSphere();this.geometryCache.set(g,data);return data;
  }
  rasterTarget(width,height){
    // Bound pixel work independently of display DPR and phone orientation.
    const scale=Math.min(1,480/width,320/height),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
    if(!this.target||this.target.w!==w||this.target.h!==h){
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d'),image=ctx.createImageData(w,h);
      this.target={canvas,ctx,image,w,h,depth:new Float32Array(w*h)};
    }
    const t=this.target;t.image.data.fill(0);t.depth.fill(Infinity);return t;
  }
  drawScene(stage,cam,rect,clear=true){
    const {min,max,ceil,floor,abs,hypot}=Math,isFiniteNumber=Number.isFinite;
    const ctx=this.ctx,w=rect.width,h=rect.height,x=rect.x||0,y=rect.y||0;if(w<=0||h<=0)return;
    ctx.save();ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    const map=typeof activeMap!=='undefined'?activeMap:{skyTop:0x798bad,skyHorizon:0xdceafa};
    if(clear){const gradient=ctx.createLinearGradient(0,y,0,y+h);gradient.addColorStop(0,'#'+new THREE.Color(map.skyTop).getHexString());gradient.addColorStop(1,'#'+new THREE.Color(map.skyHorizon).getHexString());ctx.fillStyle=gradient;ctx.fillRect(x,y,w,h);}
    const t=this.rasterTarget(w,h),rw=t.w,rh=t.h,pixels=t.image.data,depth=t.depth;
    stage.updateMatrixWorld(true);cam.updateMatrixWorld(true);cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const vp=new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse),frustum=new THREE.Frustum().setFromProjectionMatrix(vp);
    const eye=new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld),light=new THREE.Vector3(-.4,.85,-.35).normalize(),world=new THREE.Matrix4(),mvp=new THREE.Matrix4(),instance=new THREE.Matrix4(),sphere=new THREE.Sphere(),normalMatrix=new THREE.Matrix3(),skinPoint=new THREE.Vector3();
    const opaque=[],transparent=[];
    stage.traverseVisible(o=>{
      if(!o.isMesh||!o.geometry?.attributes.position||o.material?.isShaderMaterial)return;
      if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
      sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if(!o.isInstancedMesh&&!frustum.intersectsSphere(sphere))return;
      const entry={o,d:sphere.center.distanceToSquared(eye)};
      (Array.isArray(o.material)?o.material.some(m=>m.transparent):o.material.transparent)?transparent.push(entry):opaque.push(entry);
    });
    opaque.sort((a,b)=>a.d-b.d);transparent.sort((a,b)=>b.d-a.d);
    let triangles=0,vertices=0,draws=0;
    const srgb=this.srgb||(this.srgb=Uint8Array.from({length:4097},(_,i)=>{const c=i/4096;return Math.round(255*(c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055));}));
    const convert=v=>srgb[v<=0?0:v>=1?4096:(v*4096)|0];
    // Edge functions plus a per-pixel depth buffer correctly resolve intersecting
    // geometry. Canvas receives one bitmap made from real scene triangles.
    let projectedBuffer,winding=1;
    const raster=(a,b,c,mat,color,emission,fog)=>{
      const ax=(projectedBuffer[a+0]/projectedBuffer[a+3]+1)*rw*.5,ay=(1-projectedBuffer[a+1]/projectedBuffer[a+3])*rh*.5,az=projectedBuffer[a+2]/projectedBuffer[a+3];
      const bx=(projectedBuffer[b+0]/projectedBuffer[b+3]+1)*rw*.5,by=(1-projectedBuffer[b+1]/projectedBuffer[b+3])*rh*.5,bz=projectedBuffer[b+2]/projectedBuffer[b+3];
      const cx=(projectedBuffer[c+0]/projectedBuffer[c+3]+1)*rw*.5,cy=(1-projectedBuffer[c+1]/projectedBuffer[c+3])*rh*.5,cz=projectedBuffer[c+2]/projectedBuffer[c+3];
      const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
      if(!isFiniteNumber(area)||abs(area)<.025)return;
      if((mat.side===THREE.FrontSide&&area*winding>=0)||(mat.side===THREE.BackSide&&area*winding<=0))return;
      const minX=max(0,ceil(min(ax,bx,cx)-.5)),maxX=min(rw-1,floor(max(ax,bx,cx)-.5));
      const minY=max(0,ceil(min(ay,by,cy)-.5)),maxY=min(rh-1,floor(max(ay,by,cy)-.5));
      if(minX>maxX||minY>maxY)return;
      const inv=1/area,dx0=(by-cy)*inv,dy0=(cx-bx)*inv,dx1=(cy-ay)*inv,dy1=(ax-cx)*inv;
      let row0=((bx-minX-.5)*(cy-minY-.5)-(by-minY-.5)*(cx-minX-.5))*inv;
      let row1=((cx-minX-.5)*(ay-minY-.5)-(cy-minY-.5)*(ax-minX-.5))*inv;
      const alpha=mat.transparent?mat.opacity:1,basic=mat.isMeshBasicMaterial;
      triangles++;
      for(let py=minY;py<=maxY;py++,row0+=dy0,row1+=dy1){let u=row0,v=row1,offset=py*rw+minX;
        for(let px=minX;px<=maxX;px++,offset++,u+=dx0,v+=dx1){const q=1-u-v;if(u<-.00001||v<-.00001||q<-.00001)continue;
          const z=u*az+v*bz+q*cz;if(z < -1||z>1||z>=depth[offset])continue;
          const shade=basic?1:u*projectedBuffer[a+4]+v*projectedBuffer[b+4]+q*projectedBuffer[c+4],f=offset*4;
          const red=convert((color.r*shade*(u*projectedBuffer[a+5]+v*projectedBuffer[b+5]+q*projectedBuffer[c+5])+emission.r)*(1-fog.amount)+fog.r),green=convert((color.g*shade*(u*projectedBuffer[a+6]+v*projectedBuffer[b+6]+q*projectedBuffer[c+6])+emission.g)*(1-fog.amount)+fog.g),blue=convert((color.b*shade*(u*projectedBuffer[a+7]+v*projectedBuffer[b+7]+q*projectedBuffer[c+7])+emission.b)*(1-fog.amount)+fog.b);
          if(alpha>=.999){pixels[f]=red;pixels[f+1]=green;pixels[f+2]=blue;pixels[f+3]=255;}
          else{const old=pixels[f+3]/255,combined=alpha+old*(1-alpha),mix=old*(1-alpha);pixels[f]=(red*alpha+pixels[f]*mix)/combined;pixels[f+1]=(green*alpha+pixels[f+1]*mix)/combined;pixels[f+2]=(blue*alpha+pixels[f+2]*mix)/combined;pixels[f+3]=combined*255;}
          if(mat.depthWrite!==false)depth[offset]=z;
        }
      }
    };
    for(const {o} of opaque.concat(transparent)){
      const data=this.meshData(o.geometry);if(!data)continue;
      if(o.isSkinnedMesh)o.skeleton.update();
      for(let n=0;n<(o.isInstancedMesh?o.count:1);n++){
        if(o.isInstancedMesh){o.getMatrixAt(n,instance);world.multiplyMatrices(o.matrixWorld,instance);}else world.copy(o.matrixWorld);
        sphere.copy(o.geometry.boundingSphere).applyMatrix4(world);if(!frustum.intersectsSphere(sphere))continue;
        const distance=max(.01,sphere.center.distanceTo(eye));if(sphere.radius/distance*rw<.75)continue;
        mvp.multiplyMatrices(vp,world);normalMatrix.getNormalMatrix(world);winding=world.determinant()<0?-1:1;
        const e=mvp.elements,ne=normalMatrix.elements,p=data.positions,norm=data.normals,projected=data.projected;
        projectedBuffer=projected;
        for(let i=0,j=0;i<p.length;i+=3,j+=8){let vx=p[i],vy=p[i+1],vz=p[i+2];if(o.isSkinnedMesh){skinPoint.set(vx,vy,vz);o.boneTransform(i/3,skinPoint);vx=skinPoint.x;vy=skinPoint.y;vz=skinPoint.z;}
          projected[j]=e[0]*vx+e[4]*vy+e[8]*vz+e[12];projected[j+1]=e[1]*vx+e[5]*vy+e[9]*vz+e[13];projected[j+2]=e[2]*vx+e[6]*vy+e[10]*vz+e[14];projected[j+3]=e[3]*vx+e[7]*vy+e[11]*vz+e[15];
          const nx=ne[0]*norm[i]+ne[3]*norm[i+1]+ne[6]*norm[i+2],ny=ne[1]*norm[i]+ne[4]*norm[i+1]+ne[7]*norm[i+2],nz=ne[2]*norm[i]+ne[5]*norm[i+1]+ne[8]*norm[i+2];
          projected[j+4]=.38+.62*max(0,(nx*light.x+ny*light.y+nz*light.z)/(hypot(nx,ny,nz)||1));
        }
        vertices+=p.length/3;draws++;
        const fogAmount=stage.fog?min(.9,stage.fog.isFog?max(0,(distance-stage.fog.near)/(stage.fog.far-stage.fog.near)):1-Math.exp(-Math.pow(distance*stage.fog.density,2))):0;
        const fog={amount:fogAmount,r:(stage.fog?.color.r||0)*fogAmount,g:(stage.fog?.color.g||0)*fogAmount,b:(stage.fog?.color.b||0)*fogAmount};
        const idx=data.indices;
        for(const group of data.groups){const mat=Array.isArray(o.material)?o.material[group.materialIndex]:o.material;if(!mat||mat.visible===false||mat.opacity<.025||mat.isShaderMaterial)continue;
          const color=mat.color||{r:.5,g:.7,b:.8},intensity=min(.6,mat.emissiveIntensity||0),emission={r:(mat.emissive?.r||0)*intensity,g:(mat.emissive?.g||0)*intensity,b:(mat.emissive?.b||0)*intensity};
          const colors=data.colors;
          for(let j=0;j<p.length/3;j++){projected[j*8+5]=mat.vertexColors&&colors?colors[j*3]:1;projected[j*8+6]=mat.vertexColors&&colors?colors[j*3+1]:1;projected[j*8+7]=mat.vertexColors&&colors?colors[j*3+2]:1;}
          for(let i=group.start,end=min(idx.length,group.start+group.count);i<end;i+=3){const a=idx[i]*8,b=idx[i+1]*8,c=idx[i+2]*8,aw=projected[a+3],bw=projected[b+3],cw=projected[c+3];
            if((projected[a]<-aw&&projected[b]<-bw&&projected[c]<-cw)||(projected[a]>aw&&projected[b]>bw&&projected[c]>cw)||(projected[a+1]<-aw&&projected[b+1]<-bw&&projected[c+1]<-cw)||(projected[a+1]>aw&&projected[b+1]>bw&&projected[c+1]>cw)||(projected[a+2]>aw&&projected[b+2]>bw&&projected[c+2]>cw))continue;
            if(projected[a+2]>=-aw&&projected[b+2]>=-bw&&projected[c+2]>=-cw)raster(a,b,c,mat,color,emission,fog);
            else{ // Clip against the near plane rather than dropping road triangles.
              const polygon=[],input=[a,b,c];let next=p.length/3*8;
              for(let k=0;k<3;k++){const from=input[k],to=input[(k+1)%3],d0=projected[from+2]+projected[from+3],d1=projected[to+2]+projected[to+3];if(d0>=0)polygon.push(from);if((d0>=0)!==(d1>=0)){const f=d0/(d0-d1);for(let j=0;j<8;j++)projected[next+j]=projected[from+j]+(projected[to+j]-projected[from+j])*f;polygon.push(next);next+=8;}}
              for(let k=1;k<polygon.length-1;k++)raster(polygon[0],polygon[k],polygon[k+1],mat,color,emission,fog);
            }
          }
        }
      }
    }
    t.ctx.putImageData(t.image,0,0);ctx.imageSmoothingEnabled=true;ctx.globalAlpha=1;ctx.drawImage(t.canvas,x,y,w,h);ctx.restore();
    this.info.render.calls=draws;this.info.render.triangles=triangles;this.info.render.vertices=vertices;this.info.render.rasterPixels=rw*rh;
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
