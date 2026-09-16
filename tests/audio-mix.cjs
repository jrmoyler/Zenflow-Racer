/* P1.6 — final audio mix, driven through the real vehicles.js audio graph against a
   Web Audio stub. What matters for a mix is routing and relative level, both of which
   are observable here: which bus a sound lands on, how loud that bus is, and whether a
   gameplay call actually ducks the continuous beds. Speaker and headphone listening on
   real phones is a human check this cannot replace. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');

// ---- Web Audio stub: records the graph, every connection and every gain change. ----
const events=[],connections=[];
const param=(value,owner,name)=>({value,owner,name,
 setValueAtTime(v,t){events.push({node:owner,param:name,op:'set',value:v,time:t});this.value=v;return this;},
 setTargetAtTime(v,t){events.push({node:owner,param:name,op:'target',value:v,time:t});this.value=v;return this;},
 linearRampToValueAtTime(v,t){events.push({node:owner,param:name,op:'ramp',value:v,time:t});return this;},
 exponentialRampToValueAtTime(v,t){events.push({node:owner,param:name,op:'expo',value:v,time:t});return this;},
 cancelScheduledValues(){events.push({node:owner,param:name,op:'cancel'});return this;}});
const node=type=>{const self={type,outputs:[],
 connect(target){self.outputs.push(target);connections.push({from:self,to:target});return target;},
 disconnect(){},start(){},stop(){}};return self;};
class StubContext{
 constructor(){this.state='running';this.sampleRate=48000;this.currentTime=10;this.destination=node('destination');}
 createGain(){const g=node('gain');g.gain=param(1,g,'gain');return g;}
 createBiquadFilter(){const f=node('filter');f.frequency=param(350,f,'frequency');f.Q=param(1,f,'Q');f.type='lowpass';return f;}
 createOscillator(){const o=node('oscillator');o.frequency=param(440,o,'frequency');o.detune=param(0,o,'detune');return o;}
 createBufferSource(){const s=node('source');s.playbackRate=param(1,s,'playbackRate');return s;}
 createDynamicsCompressor(){const c=node('compressor');for(const k of ['threshold','knee','ratio','attack','release'])c[k]=param(0,c,k);return c;}
 createBuffer(channels,length){return {length,getChannelData:()=>new Float32Array(length)};}
 resume(){return Promise.resolve();}
 close(){return Promise.resolve();}
}
const feeding=bus=>connections.filter(c=>c.to===bus).length;

const context={console,Math,Date,Set,Map,Float32Array,Array,Object,Number,Promise,
 window:{AudioContext:StubContext},document:{hidden:false,addEventListener(){}},
 game:{state:'race'},clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
context.globalThis=context;
vm.createContext(context);
// The audio section of vehicles.js is self-contained; everything above it is geometry.
const source=fs.readFileSync(path.join(root,'vehicles.js'),'utf8');
vm.runInContext(source.slice(source.indexOf('// ---------- Procedural audio')),context);
// `const` declarations in a vm script live in the lexical global scope, not on the
// context object, so they are read back by evaluating their names.
const read=expr=>vm.runInContext(expr,context);
const AUDIO=read('AUDIO'),AUDIO_MIX=read('AUDIO_MIX'),AUDIO_DUCK=read('AUDIO_DUCK'),SFX=read('SFX');

read('audioInit()');
assert.ok(AUDIO.ctx,'the audio graph is built');
assert.deepEqual(Object.keys(AUDIO.bus).sort(),['ambience','engine','sfx','ui'],'four named buses');

// Every bus feeds the master, and the master feeds a limiter before the speakers.
for(const [name,bus] of Object.entries(AUDIO.bus)){
 assert.ok(bus.outputs.includes(AUDIO.master),name+' feeds the master bus');
 assert.equal(bus.gain.value,AUDIO_MIX[name],name+' sits at its documented level');
}
const limiter=AUDIO.master.outputs[0];
assert.equal(limiter.type,'compressor','the master passes through a limiter');
assert.ok(limiter.outputs.includes(AUDIO.ctx.destination),'and the limiter reaches the output');

// No single source dominates: the continuous beds sit under the momentary calls, and
// menu sound sits under everything.
assert.ok(AUDIO_MIX.engine<AUDIO_MIX.sfx,'engine sits under gameplay effects');
assert.ok(AUDIO_MIX.ambience<AUDIO_MIX.engine,'ambience sits under the engine');
assert.ok(AUDIO_MIX.ui<AUDIO_MIX.ambience,'menu sound is the quietest bus');
assert.ok(AUDIO_MIX.master<1,'headroom is left ahead of the limiter');
console.log('PASS four buses, documented levels, limiter on the output');

// The engine and the drift/wind beds are wired to their own buses, not straight to master.
assert.ok(AUDIO.engGain.outputs.includes(AUDIO.bus.engine),'the engine runs on the engine bus');
assert.ok(AUDIO.noiseGain.outputs.includes(AUDIO.bus.ambience),'drift texture runs on the ambience bus');
assert.ok(AUDIO.windGain.outputs.includes(AUDIO.bus.ambience),'wind runs on the ambience bus');
assert.ok(!AUDIO.engGain.outputs.includes(AUDIO.master),'nothing bypasses its bus');

// Routing of one-shots: gameplay calls land on the effects bus, menu clicks on the UI bus.
let before=feeding(AUDIO.bus.sfx);
SFX.hit();
assert.ok(feeding(AUDIO.bus.sfx)>before,'an impact plays on the effects bus');
before=feeding(AUDIO.bus.ui);
const beforeSfx=feeding(AUDIO.bus.sfx);
SFX.ui();
assert.ok(feeding(AUDIO.bus.ui)>before,'a menu click plays on the UI bus');
assert.equal(feeding(AUDIO.bus.sfx),beforeSfx,'and does not leak into the gameplay bus');
console.log('PASS gameplay effects and menu sound use separate buses');

// Ducking: a gameplay call pulls the continuous buses down, then restores them exactly.
events.length=0;
assert.equal(read('audioDuck')('hit'),true,'an impact ducks the mix');
const ducked=events.filter(e=>e.op==='set');
assert.equal(ducked.length,2,'both continuous buses duck');
for(const event of ducked){
 const name=event.node===AUDIO.bus.engine?'engine':'ambience';
 assert.equal(event.value,AUDIO_MIX[name]*AUDIO_DUCK.hit[0],name+' ducks to its configured depth');
}
const restored=events.filter(e=>e.op==='target');
assert.equal(restored.length,2,'both buses are scheduled back up');
for(const event of restored){
 const name=event.node===AUDIO.bus.engine?'engine':'ambience';
 assert.equal(event.value,AUDIO_MIX[name],name+' returns to its mix level, not to full scale');
}
assert.equal(read('audioDuck')('nothing-like-this'),false,'an unknown cue ducks nothing');
for(const [kind,[depth,seconds]] of Object.entries(AUDIO_DUCK)){
 assert.ok(depth>0&&depth<1,kind+': ducking attenuates without muting');
 assert.ok(seconds>0&&seconds<=1.2,kind+': ducking releases within about a second');
}
// The calls a player must not miss all duck; background texture never does.
events.length=0;SFX.boost(2);
assert.ok(events.some(e=>e.op==='set'&&e.node===AUDIO.bus.engine),'a boost ducks the engine');
events.length=0;SFX.token(1);
assert.ok(!events.some(e=>e.op==='set'&&e.node===AUDIO.bus.engine),'picking up a token does not duck');
console.log('PASS loud gameplay calls duck the engine and ambience, then restore exactly');

// The running mix follows the table, and a paused or hidden game is silent.
events.length=0;
read('audioUpdate')(1/60,{speed:30,maxSpeed:40,throttle:true,boost:0,drifting:false,driftTier:0});
const master=events.find(e=>e.node===AUDIO.master&&e.param==='gain');
assert.equal(master.value,AUDIO_MIX.master,'racing runs at the documented master level');
context.game.state='paused';events.length=0;
read('audioUpdate')(1/60,null);
assert.equal(events.find(e=>e.node===AUDIO.master).value,0,'a paused race is silent');
context.game.state='race';context.document.hidden=true;events.length=0;
read('audioUpdate')(1/60,null);
assert.equal(events.find(e=>e.node===AUDIO.master).value,0,'a backgrounded tab is silent');
context.document.hidden=false;
console.log('PASS master level follows the mix table; pausing and backgrounding silence the game');
console.log('audio mix tests passed');
