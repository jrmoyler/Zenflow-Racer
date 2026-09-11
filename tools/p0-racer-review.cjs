// Diagnostic CPU renders of actual loaded geometry; not WebGL or device certification.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),THREE=require('../vendor/three.min.js');
const {createCanvas}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/p0-finalization/racers');fs.mkdirSync(out,{recursive:true});
const canvas=()=>{const c=createCanvas(480,400);c.style={};c.dataset={};return c;};
const c={THREE,console,TextDecoder,TextEncoder,ArrayBuffer,Uint8Array,self:{URL},URL,Blob,setTimeout,performance,FALLBACK_GRAPHICS:true,TEX:{},innerWidth:480,innerHeight:400,document:{createElement:canvas}};
vm.createContext(c);const run=s=>vm.runInContext(s,c),read=f=>fs.readFileSync(path.join(root,f),'utf8');
run(read('vendor/GLTFLoader.js'));const loader=new THREE.GLTFLoader();THREE.GLTFLoader.prototype.loadAsync=async file=>{const b=fs.readFileSync(path.join(root,file));return new Promise((ok,fail)=>loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'',ok,fail));};
run(read('core.js').split('function hexToRgb')[0]);run(read('kart-clips.js'));run(read('kart-materials.js'));run(read('vehicles.js').split('// ---------- Item / token pickups ----------')[0]);run(read('kart-assets.js'));run(read('fallback-renderer.js'));
(async()=>{
 await run('loadKartAssets()');const records=[];
 for(const div of run('ROSTER')){
  c.div=div;const kart=run('buildKart(div)');c.kart=kart;
  const views={front:[0,3,-8],rear:[0,3,8],left:[-8,3,0],right:[8,3,0],hero:[-6,4,-7],cockpit:[-2,4,-4],chase:[0,4,7],drift:[-6,4,-7],boost:[-6,4,-7],victory:[-6,4,-7],spinout:[-6,4,-7],neutral:[-6,4,-7]};
  const sheet=createCanvas(480*4,430*3),ctx=sheet.getContext('2d');ctx.fillStyle='#202833';ctx.fillRect(0,0,sheet.width,sheet.height);let index=0;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x303945);scene.add(kart);
  for(const [view,pos] of Object.entries(views)){
   c.state=['drift','boost','victory','spinout'].includes(view)?view:'idle';run('resetClipNodes(kart.userData);sampleKartClip(state,.4,1,kart.userData);constrainKartHands(kart,state)');
   if(view==='neutral')kart.traverse(o=>{if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.color?.setHex(0x949494);m.emissive?.setHex(0);}}});
   const camera=new THREE.PerspectiveCamera(38,480/400,.1,50);camera.position.set(...pos);camera.lookAt(0,1.35,0);camera.updateMatrixWorld();
   c.canvas=canvas();const renderer=run('new CanvasRaceRenderer({canvas})');renderer.setSize(480,400);renderer.render(scene,camera);
   ctx.drawImage(c.canvas,index%4*480,Math.floor(index/4)*430);ctx.fillStyle='white';ctx.font='18px sans-serif';ctx.fillText(div.name+' / '+view,index%4*480+12,Math.floor(index/4)*430+422);index++;
  }
  const file=div.id+'.png';fs.writeFileSync(path.join(out,file),sheet.toBuffer('image/png'));records.push({id:div.id,file,views:Object.keys(views),renderer:'CanvasRaceRenderer CPU diagnostic',webgl:false,visualApproval:false});run('disposeKart(kart)');console.log('Rendered',div.id);
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(records,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
