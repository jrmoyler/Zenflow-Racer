/* Software rendering of the same authored scene, camera and animated meshes.
   No reference illustrations, alternate vehicle silhouettes or scenery mattes. */
class CanvasRaceRenderer {
  constructor({canvas,alpha=false}) {
    this.domElement=canvas;this.ctx=canvas.getContext('2d',{alpha});this.shadowMap={enabled:false};
    this.capabilities={isWebGL2:false,getMaxAnisotropy:()=>1};this.info={render:{calls:0,triangles:0},memory:{geometries:0,textures:0}};
    this.ratio=1;this.width=innerWidth;this.height=innerHeight;this.geometryCache=new WeakMap();this.textureCache=new WeakMap();this.portraits=new Map();
    this.domElement.dataset.renderer='software-3d';
  }
  setPixelRatio(r){this.ratio=Math.min(r,1);if(this.width)this.setSize(this.width,this.height);}
  setSize(w,h){this.width=w;this.height=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';}
  // Keep authored topology and split normals intact. No positional clustering:
  // welding nearby surfaces corrupts fingers, rims and overlapping body panels.
  meshData(g){
    let data=this.geometryCache.get(g);
    const p=g.attributes.position;if(!p)return null;
    if(!g.attributes.normal)g.computeVertexNormals();
    const n=g.attributes.normal,count=p.count;
    if(data&&data.positions.length===count*3){
      // IK sleeves deform attributes in place. Refresh CPU buffers only when
      // their source revision changes, retaining topology and projection storage.
      const pv=p.isInterleavedBufferAttribute?p.data.version:p.version;
      const nv=n.isInterleavedBufferAttribute?n.data.version:n.version;
      if(data.positionAttribute!==p||data.positionVersion!==pv){for(let i=0;i<count;i++){const j=i*3;data.positions[j]=p.getX(i);data.positions[j+1]=p.getY(i);data.positions[j+2]=p.getZ(i);}data.positionAttribute=p;data.positionVersion=pv;}
      if(data.normalAttribute!==n||data.normalVersion!==nv){for(let i=0;i<count;i++){const j=i*3;data.normals[j]=n.getX(i);data.normals[j+1]=n.getY(i);data.normals[j+2]=n.getZ(i);}data.normalAttribute=n;data.normalVersion=nv;}
      return data;
    }
    const positions=new Float32Array(count*3),normals=new Float32Array(count*3);
    for(let i=0;i<count;i++){positions.set([p.getX(i),p.getY(i),p.getZ(i)],i*3);normals.set([n.getX(i),n.getY(i),n.getZ(i)],i*3);}
    const indices=g.index?Uint32Array.from(g.index.array):Uint32Array.from({length:count},(_,i)=>i);
    const groups=g.groups.length?g.groups:[{start:0,count:indices.length,materialIndex:0}];
    const color=g.attributes.color,colors=color?new Float32Array(count*3):null;
    if(color)for(let i=0;i<count;i++)colors.set([color.getX(i),color.getY(i),color.getZ(i)],i*3);
    const uv=g.attributes.uv,uvs=uv?new Float32Array(count*2):null;
    if(uv)for(let i=0;i<count;i++){uvs[i*2]=uv.getX(i);uvs[i*2+1]=uv.getY(i);}
    data={positions,normals,indices,groups,colors,uvs,positionAttribute:p,normalAttribute:n,positionVersion:p.isInterleavedBufferAttribute?p.data.version:p.version,normalVersion:n.isInterleavedBufferAttribute?n.data.version:n.version,projected:new Float32Array(count*12+72)};
    // Authored IK bounds cover every pose, not just the current sleeve position.
    if(!g.boundingSphere)g.computeBoundingSphere();this.geometryCache.set(g,data);return data;
  }
  // Read authored textures once per revision, with a bounded thumbnail cache.
  // Tainted/unloaded sources retain material color until a readable revision arrives.
  textureData(texture){
    if(!texture)return null;
    const cached=this.textureCache.get(texture);if(cached?.version===texture.version)return cached.failed?null:cached;
    const image=texture.image;if(!image||!(image.width>0)||!(image.height>0))return null;
    try{
      let data,w=image.width,h=image.height;
      if(image.data){if(!ArrayBuffer.isView(image.data)||image.data.BYTES_PER_ELEMENT!==1||image.data.length!==w*h*4)return null;const size=Math.min(1,256/w,256/h),nw=Math.max(1,Math.round(w*size)),nh=Math.max(1,Math.round(h*size));data=new Uint8ClampedArray(nw*nh*4);for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){const from=(Math.floor(y*h/nh)*w+Math.floor(x*w/nw))*4;data.set(image.data.subarray(from,from+4),(y*nw+x)*4);}w=nw;h=nh;}
      else{const scale=Math.min(1,256/w,256/h);w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);data=ctx.getImageData(0,0,w,h).data;}
      const result={data,w,h,version:texture.version};this.textureCache.set(texture,result);return result;
    }catch{this.textureCache.set(texture,{version:texture.version,failed:true});return null;}
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
  drawSky(map,cam,rect){
    const ctx=this.ctx,{width:w,height:h}=rect,x=rect.x||0,y=rect.y||0;
    const gradient=ctx.createLinearGradient(0,y,0,y+h);
    gradient.addColorStop(0,'#'+new THREE.Color(map.skyTop).getHexString());gradient.addColorStop(1,'#'+new THREE.Color(map.skyHorizon).getHexString());ctx.fillStyle=gradient;ctx.fillRect(x,y,w,h);
    // Analytic sky only: no scenery images. Cloud positions are directions in
    // world space, so turning/banking the camera moves them with the horizon.
    cam.updateMatrixWorld(true);
    const inverse=new THREE.Quaternion();cam.getWorldQuaternion(inverse).invert();
    const time=typeof zenWorldTime!=='undefined'?zenWorldTime.value:0;
    const storm=map.id==='stormforge',garden=map.id==='canopy';
    const count=typeof MOBILEFX!=='undefined'&&MOBILEFX?22:34;
    const point=new THREE.Vector3(),projected=new THREE.Vector3();
    const project=(azimuth,elevation)=>{
      point.set(Math.cos(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.sin(azimuth)*Math.cos(elevation)).applyQuaternion(inverse);
      if(point.z>-.12)return false;
      projected.copy(point).applyMatrix4(cam.projectionMatrix);
      return Number.isFinite(projected.x)&&Number.isFinite(projected.y);
    };
    for(let i=0;i<count;i++){
      const angle=i*2.39996+time*.0009,elevation=.13+(i%5)*.078;
      if(!project(angle,elevation))continue;
      const cx=x+(projected.x+1)*w*.5,cy=y+(1-projected.y)*h*.5;
      const radius=Math.min(w*.42,h*(.06+(i%4)*.016)/-point.z);
      if(cx+radius*2<x||cx-radius*2>x+w||cy+radius<y||cy-radius>y+h)continue;
      // Five overlapping lobes share a vertical light gradient. Layered banks
      // cost at most 170 ellipses, with no blur, pixel loops or cached bitmaps.
      const shade=ctx.createLinearGradient(0,cy-radius,0,cy+radius*.4);
      shade.addColorStop(0,storm?'rgba(214,219,228,.85)':garden?'rgba(255,255,250,.92)':'rgba(255,235,239,.90)');
      shade.addColorStop(.55,storm?'rgba(121,137,157,.88)':'rgba(218,220,239,.84)');
      shade.addColorStop(1,storm?'rgba(83,99,124,.60)':'rgba(163,179,208,.25)');
      ctx.fillStyle=shade;ctx.beginPath();
      for(let j=0;j<5;j++){
        const rx=radius*(.52+(j%3)*.11),ry=radius*(.27+(j%2)*.20),px=cx+(j-2)*radius*.51,py=cy-Math.sin(j*1.8+i)*radius*.14;
        ctx.moveTo(px+rx,py);ctx.ellipse(px,py,rx,ry,0,0,Math.PI*2);
      }
      ctx.fill();
    }
    // The actual three ridge meshes are rasterized over this sky, retaining
    // the same geometry, horizon depth and occlusion as the WebGL path.
  }
  drawScene(stage,cam,rect,clear=true){
    const {min,max,ceil,floor,abs,hypot}=Math,isFiniteNumber=Number.isFinite;
    const ctx=this.ctx,w=rect.width,h=rect.height,x=rect.x||0,y=rect.y||0;if(w<=0||h<=0)return;
    ctx.save();ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    const map=typeof activeMap!=='undefined'?activeMap:{skyTop:0x798bad,skyHorizon:0xdceafa};
    if(clear)this.drawSky(map,cam,rect);
    const t=this.rasterTarget(w,h),rw=t.w,rh=t.h,pixels=t.image.data,depth=t.depth;
    stage.updateMatrixWorld(true);cam.updateMatrixWorld(true);cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const vp=new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse),frustum=new THREE.Frustum().setFromProjectionMatrix(vp);
    const eye=new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld),light=new THREE.Vector3(-.4,.85,-.35).normalize(),world=new THREE.Matrix4(),mvp=new THREE.Matrix4(),instance=new THREE.Matrix4(),sphere=new THREE.Sphere(),normalMatrix=new THREE.Matrix3(),skinPoint=new THREE.Vector3(),instanceTint=new THREE.Color();
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
    let projectedBuffer,winding=1,texture=null;
    const linear=this.linear||(this.linear=Float32Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);}));
    const wrap=(v,mode)=>mode===THREE.RepeatWrapping?v-Math.floor(v):mode===THREE.MirroredRepeatWrapping?1-Math.abs(((v%2)+2)%2-1):Math.max(0,Math.min(1,v));
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
      const opacity=mat.transparent?mat.opacity:1,basic=mat.isMeshBasicMaterial,metal=mat.metalness||0,rough=Math.max(.12,mat.roughness??.65),power=2+60*(1-rough)*(1-rough),tm=mat.map?.matrix.elements;
      const ia=1/projectedBuffer[a+3],ib=1/projectedBuffer[b+3],ic=1/projectedBuffer[c+3];
      triangles++;
      for(let py=minY;py<=maxY;py++,row0+=dy0,row1+=dy1){let u=row0,v=row1,offset=py*rw+minX;
        for(let px=minX;px<=maxX;px++,offset++,u+=dx0,v+=dx1){const q=1-u-v;if(u<-.00001||v<-.00001||q<-.00001)continue;
          const z=u*az+v*bz+q*cz;if(z < -1||z>1||z>=depth[offset])continue;
          const shade=basic?1:u*projectedBuffer[a+4]+v*projectedBuffer[b+4]+q*projectedBuffer[c+4],f=offset*4;
          let tr=1,tg=1,tb=1,alpha=opacity;
          if(texture){const iw=1/(u*ia+v*ib+q*ic),tu=(u*projectedBuffer[a+8]*ia+v*projectedBuffer[b+8]*ib+q*projectedBuffer[c+8]*ic)*iw,tv=(u*projectedBuffer[a+9]*ia+v*projectedBuffer[b+9]*ib+q*projectedBuffer[c+9]*ic)*iw;
            const tx=wrap(tm[0]*tu+tm[3]*tv+tm[6],mat.map.wrapS),wy=wrap(tm[1]*tu+tm[4]*tv+tm[7],mat.map.wrapT),ty=mat.map.flipY?1-wy:wy,ti=(min(texture.h-1,(ty*texture.h)|0)*texture.w+min(texture.w-1,(tx*texture.w)|0))*4,td=texture.data;
            const srgbTexture=mat.map.encoding===THREE.sRGBEncoding;tr=srgbTexture?linear[td[ti]]:td[ti]/255;tg=srgbTexture?linear[td[ti+1]]:td[ti+1]/255;tb=srgbTexture?linear[td[ti+2]]:td[ti+2]/255;alpha*=td[ti+3]/255;
          }
          if(alpha<=0||alpha<(mat.alphaTest||0))continue;
          if(!mat.transparent)alpha=1;
          const spec=basic?0:Math.pow(max(0,u*projectedBuffer[a+10]+v*projectedBuffer[b+10]+q*projectedBuffer[c+10]),power)*(1-rough*.65),rim=basic?0:Math.pow(max(0,1-(u*projectedBuffer[a+11]+v*projectedBuffer[b+11]+q*projectedBuffer[c+11])),3)*.12;
          const shine=spec*(.12+metal*.75),diffuse=shade*(1-metal*.28);
          const red=convert((color.r*tr*diffuse*(u*projectedBuffer[a+5]+v*projectedBuffer[b+5]+q*projectedBuffer[c+5])+shine*(1-metal+metal*color.r)+rim*.72+emission.r)*(1-fog.amount)+fog.r),green=convert((color.g*tg*diffuse*(u*projectedBuffer[a+6]+v*projectedBuffer[b+6]+q*projectedBuffer[c+6])+shine*(1-metal+metal*color.g)+rim*.84+emission.g)*(1-fog.amount)+fog.g),blue=convert((color.b*tb*diffuse*(u*projectedBuffer[a+7]+v*projectedBuffer[b+7]+q*projectedBuffer[c+7])+shine*(1-metal+metal*color.b)+rim+emission.b)*(1-fog.amount)+fog.b);
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
        instanceTint.setRGB(1,1,1);if(o.isInstancedMesh&&o.instanceColor)o.getColorAt(n,instanceTint);
        if(o.isInstancedMesh){o.getMatrixAt(n,instance);world.multiplyMatrices(o.matrixWorld,instance);}else world.copy(o.matrixWorld);
        sphere.copy(o.geometry.boundingSphere).applyMatrix4(world);if(!frustum.intersectsSphere(sphere))continue;
        const distance=max(.01,sphere.center.distanceTo(eye));if(sphere.radius/distance*rw<.75)continue;
        mvp.multiplyMatrices(vp,world);normalMatrix.getNormalMatrix(world);winding=world.determinant()<0?-1:1;
        const e=mvp.elements,ne=normalMatrix.elements,p=data.positions,norm=data.normals,projected=data.projected;
        projectedBuffer=projected;
        for(let i=0,j=0;i<p.length;i+=3,j+=12){let vx=p[i],vy=p[i+1],vz=p[i+2];if(o.isSkinnedMesh){skinPoint.set(vx,vy,vz);o.boneTransform(i/3,skinPoint);vx=skinPoint.x;vy=skinPoint.y;vz=skinPoint.z;}
          projected[j]=e[0]*vx+e[4]*vy+e[8]*vz+e[12];projected[j+1]=e[1]*vx+e[5]*vy+e[9]*vz+e[13];projected[j+2]=e[2]*vx+e[6]*vy+e[10]*vz+e[14];projected[j+3]=e[3]*vx+e[7]*vy+e[11]*vz+e[15];
          const nx=ne[0]*norm[i]+ne[3]*norm[i+1]+ne[6]*norm[i+2],ny=ne[1]*norm[i]+ne[4]*norm[i+1]+ne[7]*norm[i+2],nz=ne[2]*norm[i]+ne[5]*norm[i+1]+ne[8]*norm[i+2];
          const nl=hypot(nx,ny,nz)||1,we=world.elements,ex=eye.x-(we[0]*vx+we[4]*vy+we[8]*vz+we[12]),ey=eye.y-(we[1]*vx+we[5]*vy+we[9]*vz+we[13]),ez=eye.z-(we[2]*vx+we[6]*vy+we[10]*vz+we[14]),el=hypot(ex,ey,ez)||1,hx=light.x+ex/el,hy=light.y+ey/el,hz=light.z+ez/el,hl=hypot(hx,hy,hz)||1;
          projected[j+4]=.25+.15*(ny/nl*.5+.5)+.65*max(0,(nx*light.x+ny*light.y+nz*light.z)/nl);
          projected[j+8]=data.uvs?data.uvs[i/3*2]:0;projected[j+9]=data.uvs?data.uvs[i/3*2+1]:0;
          projected[j+10]=max(0,(nx*hx+ny*hy+nz*hz)/(nl*hl));projected[j+11]=max(0,(nx*ex+ny*ey+nz*ez)/(nl*el));
        }
        vertices+=p.length/3;draws++;
        const fogAmount=stage.fog?min(.9,stage.fog.isFog?max(0,(distance-stage.fog.near)/(stage.fog.far-stage.fog.near)):1-Math.exp(-Math.pow(distance*stage.fog.density,2))):0;
        const fog={amount:fogAmount,r:(stage.fog?.color.r||0)*fogAmount,g:(stage.fog?.color.g||0)*fogAmount,b:(stage.fog?.color.b||0)*fogAmount};
        const idx=data.indices;
        for(const group of data.groups){const mat=Array.isArray(o.material)?o.material[group.materialIndex]:o.material;if(!mat||mat.visible===false||mat.opacity<.025||mat.isShaderMaterial)continue;
          const base=mat.color||{r:.5,g:.7,b:.8},color={r:base.r*instanceTint.r,g:base.g*instanceTint.g,b:base.b*instanceTint.b},intensity=min(.6,mat.emissiveIntensity||0),emission={r:(mat.emissive?.r||0)*intensity,g:(mat.emissive?.g||0)*intensity,b:(mat.emissive?.b||0)*intensity};
          if(mat.map?.matrixAutoUpdate)mat.map.updateMatrix();texture=data.uvs?this.textureData(mat.map):null;
          const colors=data.colors;
          for(let j=0;j<p.length/3;j++){projected[j*12+5]=mat.vertexColors&&colors?colors[j*3]:1;projected[j*12+6]=mat.vertexColors&&colors?colors[j*3+1]:1;projected[j*12+7]=mat.vertexColors&&colors?colors[j*3+2]:1;}
          for(let i=group.start,end=min(idx.length,group.start+group.count);i<end;i+=3){const a=idx[i]*12,b=idx[i+1]*12,c=idx[i+2]*12,aw=projected[a+3],bw=projected[b+3],cw=projected[c+3];
            if((projected[a]<-aw&&projected[b]<-bw&&projected[c]<-cw)||(projected[a]>aw&&projected[b]>bw&&projected[c]>cw)||(projected[a+1]<-aw&&projected[b+1]<-bw&&projected[c+1]<-cw)||(projected[a+1]>aw&&projected[b+1]>bw&&projected[c+1]>cw)||(projected[a+2]>aw&&projected[b+2]>bw&&projected[c+2]>cw))continue;
            if(projected[a+2]>=-aw&&projected[b+2]>=-bw&&projected[c+2]>=-cw)raster(a,b,c,mat,color,emission,fog);
            else{ // Clip against the near plane rather than dropping road triangles.
              const polygon=[],input=[a,b,c];let next=p.length/3*12;
              for(let k=0;k<3;k++){const from=input[k],to=input[(k+1)%3],d0=projected[from+2]+projected[from+3],d1=projected[to+2]+projected[to+3];if(d0>=0)polygon.push(from);if((d0>=0)!==(d1>=0)){const f=d0/(d0-d1);for(let j=0;j<12;j++)projected[next+j]=projected[from+j]+(projected[to+j]-projected[from+j])*f;polygon.push(next);next+=12;}}
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
