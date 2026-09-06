// Guards the Blender-exported kart-clips.js against the runtime contract (vehicles.js sampleKartClip).
const {readFileSync,statSync}=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const CONTRACT=['body','pilot','torso','head','hair','arm-l','arm-r','steering-wheel','exhaust-l','exhaust-r','wheel-fl','wheel-fr','wheel-rl','wheel-rr','spin','wheel-light-ring','underbody-flow-ring','aegis-shield','coachwork-batch'];
const REQUIRED=['idle','drive','drift','boost','spinout','hit','victory','defeat'];
module.exports=function({test,assert}){
 const file=path.join(__dirname,'../kart-clips.js');const source=readFileSync(file,'utf8');
 const ctx={};vm.createContext(ctx);vm.runInContext(source+'\nglobalThis.KART_CLIPS=KART_CLIPS;',ctx);const clips=ctx.KART_CLIPS;
 test('kart-clips.js is generated plain script under 60 KB with version 1 at 30 fps',()=>{
  assert.ok(statSync(file).size<60*1024,'kart-clips.js must stay under 60 KB');assert.ok(/GENERATED FILE/.test(source.slice(0,600)),'generated header present');
  assert.equal(clips.version,1);assert.equal(clips.fps,30);assert.ok(!/fetch\(/.test(source),'no runtime fetch');
 });
 test('Blender clip set covers every kart state',()=>{
  const names=Object.keys(clips.clips);assert.ok(names.length>=8,'at least eight clips');for(const n of REQUIRED)assert.ok(names.includes(n),'clip '+n);
  for(const n of ['idle','drive','drift','victory','defeat'])assert.equal(clips.clips[n].loop,true,n+' loops');for(const n of ['boost','spinout','hit'])assert.equal(clips.clips[n].loop,false,n+' is one-shot');
 });
 test('Every clip track targets a rig contract node with sorted finite additive keys',()=>{
  for(const [name,clip] of Object.entries(clips.clips)){
   assert.ok(clip.duration>0&&Number.isFinite(clip.duration),name+' duration');const tracks=Object.keys(clip.tracks);assert.ok(tracks.length>0,name+' has tracks');
   for(const node of tracks){assert.ok(CONTRACT.includes(node),`${name}: ${node} is not a rig contract node`);
    for(const [channel,keys] of Object.entries(clip.tracks[node])){assert.ok(['position','rotation','scale'].includes(channel),channel);assert.ok(keys.length>=2,`${name}.${node}.${channel} keys`);
     for(let i=0;i<keys.length;i++){assert.equal(keys[i].length,4);assert.ok(keys[i].every(Number.isFinite),`${name}.${node}.${channel}[${i}] finite`);if(i)assert.ok(keys[i][0]>keys[i-1][0],`${name}.${node}.${channel} sorted`);}
     assert.equal(keys[0][0],0);assert.ok(Math.abs(keys[keys.length-1][0]-clip.duration)<1e-6,`${name}.${node}.${channel} ends at duration`);
     const peak=Math.max(...keys.map(k=>Math.max(Math.abs(k[1]),Math.abs(k[2]),Math.abs(k[3]))));assert.ok(peak>0&&peak<(channel==='position'?.5:channel==='rotation'?Math.PI:1.5),`${name}.${node}.${channel} plausible delta ${peak}`);}}
  }
 });
 test('One-shot clips start and end at rest so state crossfades stay seamless',()=>{
  for(const name of ['boost','spinout','hit'])for(const [node,track] of Object.entries(clips.clips[name].tracks))for(const [channel,keys] of Object.entries(track)){
   const first=keys[0],last=keys[keys.length-1];assert.ok([1,2,3].every(i=>Math.abs(first[i])<1e-6&&Math.abs(last[i])<1e-6),`${name}.${node}.${channel} returns to rest`);}
  for(const name of ['idle','drive','drift','victory','defeat'])for(const [node,track] of Object.entries(clips.clips[name].tracks))for(const [channel,keys] of Object.entries(track)){
   const first=keys[0],last=keys[keys.length-1];assert.ok([1,2,3].every(i=>Math.abs(first[i]-last[i])<2e-3),`${name}.${node}.${channel} loops seamlessly`);}
 });
 test('Signature poses exist: victory fist pump, spinout flail, hit whiplash',()=>{
  assert.ok(Math.max(...clips.clips.victory.tracks['arm-r'].rotation.map(k=>k[1]))>1.5,'victory raises arm-r forward-up (positive x on the rig)');
  assert.ok(Math.max(...clips.clips.spinout.tracks.head.rotation.map(k=>Math.abs(k[2])))>.25,'spinout shakes the head');
  assert.ok(Math.min(...clips.clips.hit.tracks.head.rotation.map(k=>k[1]))<-.2,'hit snaps the head forward');
  assert.ok(clips.clips.hit.tracks['wheel-fl'].position.some(k=>k[2]>.02),'hit bottoms the suspension');
 });
};
