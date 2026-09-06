/* Software fallback must project playable mesh geometry rather than reference images. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const THREE=require('../vendor/three.min.js');
const paths=[];let current;
const ctx={save(){},restore(){},setTransform(){},beginPath(){current=[];},rect(){},clip(){},createLinearGradient(){return {addColorStop(){}};},fillRect(){},moveTo(x,y){current.push(x,y);},lineTo(x,y){current.push(x,y);},closePath(){},fill(){paths.push(current.slice());}};
const canvas={style:{},dataset:{},getContext:()=>ctx,setAttribute(){}};
const source=fs.readFileSync(path.join(__dirname,'../fallback-renderer.js'),'utf8');
const c={THREE,innerWidth:320,innerHeight:240,document:{createElement:()=>canvas},console};vm.createContext(c);vm.runInContext(source+';globalThis.Renderer=CanvasRaceRenderer',c);
const renderer=new c.Renderer({canvas}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,320/240,.1,100);
camera.position.set(3,2,5);camera.lookAt(0,0,0);
const kart=new THREE.Mesh(new THREE.BoxGeometry(1,1,3),new THREE.MeshStandardMaterial({color:0x20cff5}));scene.add(kart);
renderer.render(scene,camera);assert.ok(paths.length>0,'actual BufferGeometry triangles draw');assert.ok(paths.flat().every(Number.isFinite),'projection remains finite');const initial=JSON.stringify(paths);
paths.length=0;kart.rotation.y=Math.PI/3;renderer.render(scene,camera);assert.notEqual(JSON.stringify(paths),initial,'kart rotation changes projected body silhouette');
paths.length=0;kart.visible=false;renderer.render(scene,camera);assert.equal(paths.length,0,'hidden scene geometry is excluded');
const instanced=new THREE.InstancedMesh(kart.geometry,kart.material,2);instanced.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-1,0,0));instanced.setMatrixAt(1,new THREE.Matrix4().makeTranslation(1,0,0));scene.add(instanced);renderer.render(scene,camera);const twoInstances=paths.length;paths.length=0;instanced.count=1;renderer.render(scene,camera);assert.ok(twoInstances>paths.length&&paths.length>0,'world instance matrices produce distinct visible faces');
assert.ok(paths.length<12,'opaque boxes cull their hidden back faces');
assert.equal(renderer.meshData(kart.geometry),renderer.meshData(kart.geometry),'immutable topology cache is reused');
assert.ok(!/new Image|drawImage|assets\/art|referenceKart|paintReferencePortrait/.test(source),'software mode cannot substitute illustration sheets');
console.log('PASS software 3D: real mesh projection, rotation, visibility, instances and shared topology cache.');
