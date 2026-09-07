/* Transition lifecycle: cover before mutation, reject duplicates, unblock both motion modes. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../presentation.js'),'utf8');
(async()=>{
 for(const reduced of [false,true]){
  const frames=[],animations=[],classes=new Set(),listeners={};let resets=0,commits=0,curtain;
  const node=()=>({classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},setAttribute(){},getAnimations:()=>[],animate(){let resolve;const finished=new Promise(r=>resolve=r);animations.push(resolve);return {finished};}});
  const c={console,matchMedia:()=>({matches:reduced}),requestAnimationFrame:f=>frames.push(f),resetInput:()=>resets++,addEventListener(){},document:{getElementById:()=>curtain,createElement:()=>curtain=node(),body:{classList:node().classList,append(){}},addEventListener:(key,fn)=>listeners[key]=fn}};
  vm.createContext(c);vm.runInContext(source,c);c.commit=()=>commits++;
  assert.equal(vm.runInContext("transitionScene('GRID',commit)",c),true);
  assert.equal(vm.runInContext("transitionScene('DUPLICATE',commit)",c),false);
  let blocked=0;listeners.keydown({preventDefault:()=>blocked++,stopImmediatePropagation:()=>blocked++});assert.equal(blocked,2);
  assert.equal(resets,1);assert.equal(commits,reduced?1:0,'mutation waits for opaque cover');
  if(!reduced){animations.shift()();await Promise.resolve();assert.equal(commits,1);}
  frames.shift()();frames.shift()();if(!reduced){animations.shift()();await Promise.resolve();}
  assert.equal(vm.runInContext('sceneCut.busy',c),false);assert.ok(classes.has('hidden'));assert.equal(classes.has('scene-changing'),false);
  assert.equal(vm.runInContext('sceneCut.committing',c),false);
 }
 console.log('PASS scene cuts: commit under cover, duplicate/input gating, release and reduced motion');
})().catch(e=>{console.error(e);process.exitCode=1;});
