/* CPU rendering uses exact playable topology, a bounded raster and real occlusion. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const THREE=require('../vendor/three.min.js');
let uploads=0,blits=0,skyLobes=0;
const makeCanvas=()=>{const canvas={style:{},dataset:{},setAttribute(){}};canvas.ctx={canvas,save(){},restore(){},setTransform(){},beginPath(){},moveTo(){},ellipse(){skyLobes++;},fill(){},rect(){},clip(){},arc(){},createRadialGradient(){return {addColorStop(){}};},createLinearGradient(){return {addColorStop(){}};},fillRect(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4),width:w,height:h};},putImageData(){uploads++;},drawImage(){blits++;}};canvas.getContext=()=>canvas.ctx;return canvas;};
const source=fs.readFileSync(path.join(__dirname,'../fallback-renderer.js'),'utf8');
const context={THREE,innerWidth:320,innerHeight:240,document:{createElement:makeCanvas},console};vm.createContext(context);vm.runInContext(source+';globalThis.Renderer=CanvasRaceRenderer',context);
const renderer=new context.Renderer({canvas:makeCanvas()}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,320/240,.1,100);
camera.position.set(3,2,5);camera.lookAt(0,0,0);
const kart=new THREE.Mesh(new THREE.BoxGeometry(1,1,3),new THREE.MeshStandardMaterial({color:0x20cff5}));scene.add(kart);
const bytes=()=>Buffer.from(renderer.target.image.data),pixelCount=()=>{let n=0;for(let i=3;i<renderer.target.image.data.length;i+=4)if(renderer.target.image.data[i])n++;return n;};
renderer.render(scene,camera);assert.ok(skyLobes>0&&skyLobes<=170,'bounded cloud geometry draws behind the scene');assert.ok(pixelCount()>100,'actual geometry fills pixels');const initial=bytes();kart.rotation.y=Math.PI/3;renderer.render(scene,camera);assert.notDeepEqual(bytes(),initial,'rotation changes the real silhouette');
kart.visible=false;renderer.render(scene,camera);assert.equal(pixelCount(),0,'hidden scene geometry excluded');
const instances=new THREE.InstancedMesh(kart.geometry,kart.material,2);instances.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-1,0,0));instances.setMatrixAt(1,new THREE.Matrix4().makeTranslation(1,0,0));scene.add(instances);renderer.render(scene,camera);const two=pixelCount();instances.count=1;renderer.render(scene,camera);assert.ok(two>pixelCount(),'instance transforms have separate coverage');
const cached=renderer.meshData(kart.geometry);assert.equal(cached,renderer.meshData(kart.geometry));assert.equal(cached.positions.length,kart.geometry.attributes.position.count*3,'no destructive vertex clustering');assert.equal(cached.indices.length,kart.geometry.index.count,'all authored triangles retained');
// Dynamic IK geometry updates retain buffers but refresh visible sleeve shape.
const deformScene=new THREE.Scene(),deformGeometry=new THREE.PlaneGeometry(1,1),deformMesh=new THREE.Mesh(deformGeometry,new THREE.MeshStandardMaterial({color:0xcc7833,side:THREE.DoubleSide}));
deformGeometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),5);deformScene.add(deformMesh);
renderer.drawScene(deformScene,camera,{width:100,height:100},false);
const deformBefore=bytes(),deformCache=renderer.meshData(deformGeometry),positionStorage=deformCache.positions,projectionStorage=deformCache.projected,indexStorage=deformCache.indices;
const attribute=deformGeometry.attributes.position;for(let i=0;i<attribute.count;i++)if(attribute.getY(i)>0)attribute.setX(i,attribute.getX(i)+1.1);attribute.needsUpdate=true;deformGeometry.computeVertexNormals();
renderer.drawScene(deformScene,camera,{width:100,height:100},false);
assert.notDeepEqual(bytes(),deformBefore,'deforming sleeve attributes changes rasterized pixels');
assert.equal(renderer.meshData(deformGeometry),deformCache,'attribute deformation preserves cached mesh record');
assert.equal(deformCache.positions,positionStorage);assert.equal(deformCache.projected,projectionStorage);assert.equal(deformCache.indices,indexStorage,'deformation does not allocate topology');
assert.equal(deformGeometry.boundingSphere.radius,5,'authored conservative IK bounds survive caching');
const normalAttribute=deformGeometry.attributes.normal;normalAttribute.setXYZ(0,0,1,0);normalAttribute.needsUpdate=true;renderer.meshData(deformGeometry);assert.equal(deformCache.normals[1],1,'normal revisions refresh independently');
// Overlapping opaque triangles must be depth tested independently of draw order.
const occlusion=new THREE.Scene(),cam=new THREE.PerspectiveCamera(55,1,.1,20);cam.position.z=3;
const plane=new THREE.PlaneGeometry(2,2),back=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({color:0x0000ff})),front=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({color:0xff0000}));front.position.z=.4;occlusion.add(front,back);renderer.drawScene(occlusion,cam,{width:100,height:100},false);
let center=(50*100+50)*4;assert.equal(renderer.target.image.data[center],255);assert.equal(renderer.target.image.data[center+2],0,'foreground occludes background');
occlusion.children.reverse();renderer.drawScene(occlusion,cam,{width:100,height:100},false);assert.equal(renderer.target.image.data[center],255,'order does not change depth result');
// Crowd instance palettes multiply the shared white material instead of disappearing.
const crowdScene=new THREE.Scene(),crowd=new THREE.InstancedMesh(new THREE.PlaneGeometry(.8,.8),new THREE.MeshBasicMaterial({color:0xffffff}),2);
crowd.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-.6,0,0));crowd.setMatrixAt(1,new THREE.Matrix4().makeTranslation(.6,0,0));crowd.setColorAt(0,new THREE.Color(0xff0000));crowd.setColorAt(1,new THREE.Color(0x0000ff));crowdScene.add(crowd);renderer.drawScene(crowdScene,cam,{width:100,height:100},false);
let redCrowd=0,blueCrowd=0;for(let i=0;i<renderer.target.image.data.length;i+=4){const p=renderer.target.image.data;if(p[i]===255&&p[i+2]===0)redCrowd++;if(p[i]===0&&p[i+2]===255)blueCrowd++;}assert.ok(redCrowd>50&&blueCrowd>50,'separate crowd instances retain their assigned colors');
crowd.material.color.set(0x808080);renderer.drawScene(crowdScene,cam,{width:100,height:100},false);assert.ok(renderer.target.image.data.some((v,i)=>i%4!==3&&v>0&&v<255),'instance tint multiplies shared material');
// Botanical vertex palettes and translucent icon output survive the CPU path.
const greenGeometry=plane.clone();greenGeometry.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:4},()=>[0,1,0]).flat(),3));
const colored=new THREE.Mesh(greenGeometry,new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true})),colors=new THREE.Scene();colors.add(colored);renderer.drawScene(colors,cam,{width:100,height:100},false);assert.equal(renderer.target.image.data[center+1],255);assert.equal(renderer.target.image.data[center],0,'vertex colors determine canopy/flower palette');
colored.scale.x=-1;renderer.drawScene(colors,cam,{width:100,height:100},false);assert.ok(pixelCount()>0,'mirrored mesh winding remains visible');
colored.material.transparent=true;colored.material.opacity=.5;renderer.drawScene(colors,cam,{width:100,height:100},false);assert.ok(Math.abs(renderer.target.image.data[center+3]-128)<=1,'overlay preserves alpha when swapping portrait/icon contexts');
// UV-driven decals preserve color, alpha cutouts and texture revision changes.
const decalScene=new THREE.Scene(),tex=new THREE.DataTexture(new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,0]),2,2,THREE.RGBAFormat);tex.needsUpdate=true;
const decal=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.1}));decalScene.add(decal);renderer.drawScene(decalScene,cam,{width:100,height:100},false);
const uvBytes=bytes(),palette=new Set();for(let i=0;i<uvBytes.length;i+=4)if(uvBytes[i+3])palette.add(`${uvBytes[i]},${uvBytes[i+1]},${uvBytes[i+2]}`);assert.ok(palette.has('255,0,0')&&palette.has('0,255,0')&&palette.has('0,0,255'),'UV samples real texture colors');
const cutoutCount=pixelCount();decal.material.map=null;renderer.drawScene(decalScene,cam,{width:100,height:100},false);assert.ok(pixelCount()>cutoutCount,'texture alpha removes coverage');
decal.material.map=tex;tex.wrapS=THREE.RepeatWrapping;tex.offset.x=.5;renderer.drawScene(decalScene,cam,{width:100,height:100},false);assert.notDeepEqual(bytes(),uvBytes,'texture matrix and repeat wrapping move authored decal');
const largeTexture=new THREE.DataTexture(new Uint8Array(1024*512*4),1024,512,THREE.RGBAFormat);const boundedTexture=renderer.textureData(largeTexture);assert.ok(boundedTexture.w<=256&&boundedTexture.h<=256,'texture cache work and memory bounded per asset');
const firstTexture=renderer.textureData(tex);tex.image.data.fill(255);tex.needsUpdate=true;assert.notEqual(renderer.textureData(tex),firstTexture,'texture updates invalidate cached bytes');
let failedReads=0;const previousCreate=context.document.createElement;context.document.createElement=()=>({getContext:()=>({drawImage(){failedReads++;throw new Error('unreadable image');}})});
const unreadable=new THREE.Texture({width:2,height:2});assert.equal(renderer.textureData(unreadable),null);assert.equal(renderer.textureData(unreadable),null);assert.equal(failedReads,1,'unreadable texture is attempted once per revision');unreadable.needsUpdate=true;renderer.textureData(unreadable);assert.equal(failedReads,2,'new revision retries failed texture');context.document.createElement=previousCreate;
const metallicScene=new THREE.Scene(),metalMesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshStandardMaterial({color:0x6699bb,metalness:1,roughness:.18}));metallicScene.add(metalMesh);renderer.drawScene(metallicScene,cam,{width:100,height:100},false);const polished=bytes();metalMesh.material.roughness=1;renderer.drawScene(metallicScene,cam,{width:100,height:100},false);assert.notDeepEqual(bytes(),polished,'material roughness changes reflected highlight');
// A triangle crossing the near plane remains visible instead of disappearing.
const clipScene=new THREE.Scene(),geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute([-.3,-.3,-.5,.3,-.3,-.5,0,.3,-.01],3));clipScene.add(new THREE.Mesh(geom,new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide})));cam.position.z=0;renderer.drawScene(clipScene,cam,{width:100,height:100},false);assert.ok(pixelCount()>0,'near clipping preserves visible road geometry');
renderer.drawScene(scene,camera,{width:3840,height:2160});assert.ok(renderer.info.render.rasterPixels<=480*320,'pixel workload bounded on high DPR displays');
assert.equal(uploads,blits,'one bitmap submission per scene, no per-triangle Canvas calls');
assert.ok(!/new Image|assets\/art|referenceKart|paintReferencePortrait/.test(source),'no illustration substitution');
// Real exported GLB benchmark: retain nodes and full topology, animate the camera.
(async()=>{global.THREE=THREE;require('../vendor/GLTFLoader.js');const buffer=fs.readFileSync(path.join(__dirname,'../assets/models/zenflow.glb'));const gltf=await new Promise((resolve,reject)=>new THREE.GLTFLoader().parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'',resolve,reject));
const actual=new THREE.Scene();actual.add(gltf.scene);gltf.scene.traverse(o=>{if(o.userData.zf_visible===false)o.visible=false;});const camera=new THREE.PerspectiveCamera(32,1.5,.1,40);camera.position.set(5,3.7,-7);camera.lookAt(0,1,0);
renderer.drawScene(actual,camera,{width:480,height:320},false);assert.ok(pixelCount()>500,'actual exported driver/kart has rasterized silhouette');const durations=[];for(let i=0;i<5;i++){gltf.scene.rotation.y=i*.15;const start=performance.now();renderer.drawScene(actual,camera,{width:480,height:320},false);durations.push(performance.now()-start);}durations.sort((a,b)=>a-b);assert.ok(durations[2]<500,'actual GLB bounded CPU smoke budget (not a mobile FPS certification)');
console.log(`PASS software 3D: topology, rotation, instances, occlusion, UV textures, alpha cutouts, material highlights, near clipping, bounded pixels; actual GLB median ${durations[2].toFixed(1)} ms, ${renderer.info.render.vertices} vertices, ${renderer.info.render.triangles} raster triangles, one Canvas blit.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
// Actual water factory must remain visible when GLSL execution is unavailable.
context.zenWorldTime={value:0};vm.runInContext(fs.readFileSync(path.join(__dirname,'../immersion.js'),'utf8'),context);
const waterMaterial=vm.runInContext("createImmersionWater({id:'canopy'},'sea')",context);
const waterStage=new THREE.Scene();waterStage.add(new THREE.Mesh(new THREE.BoxGeometry(2,.3,3),waterMaterial));
renderer.render(waterStage,camera);assert.ok(pixelCount()>0,'actual shader-backed water has a software surface');
console.log('PASS software water remains visible using the actual water factory');
