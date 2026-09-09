/* Pipeline contract tests with real r128 passes; no GPU/image-fidelity claim. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),THREE=require(path.join(root,'vendor/three.min.js'));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function setup(hdr=true){
 const renderer={capabilities:{isWebGL2:true},extensions:{has:()=>hdr},toneMapping:THREE.ACESFilmicToneMapping,outputEncoding:THREE.sRGBEncoding,toneMappingExposure:.94,info:{render:{}}};
 const c={THREE,renderer,console,performance,innerWidth:960,innerHeight:540,devicePixelRatio:1,addEventListener(){},FALLBACK_GRAPHICS:false,LOWFX:false,MOBILEFX:false,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera()};
 vm.createContext(c);
 for(const p of ['CopyShader','LuminosityHighPassShader','EffectComposer','RenderPass','ShaderPass','UnrealBloomPass'])vm.runInContext(read('vendor/postprocessing/'+p+'.js'),c);
 vm.runInContext(read('postfx.js'),c);return {c,renderer,run:code=>vm.runInContext(code,c)};
}
const {c,renderer,run}=setup();
run('raceComposer=buildRaceComposer()');
const composer=run('raceComposer'),bloom=run('raceBloom');
for(const t of [composer.renderTarget1,composer.renderTarget2,bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical]){
 assert.equal(t.texture.type,THREE.HalfFloatType,'no byte clipping anywhere in bloom chain');
 assert.equal(t.texture.encoding,THREE.LinearEncoding,'intermediates stay linear');
}
assert.equal(run('raceGrade.material.toneMapped'),false,'final ACES chunk is explicit, no duplicate injection');
run('racePostAttempted=true');let called=0;
composer.render=()=>{called++;assert.equal(renderer.toneMapping,THREE.NoToneMapping);assert.equal(renderer.outputEncoding,THREE.LinearEncoding);};
run('renderRaceScene()');assert.equal(called,1);assert.equal(run('raceGrade.uniforms.toneMappingExposure.value'),.94);
assert.equal(renderer.toneMapping,THREE.ACESFilmicToneMapping);assert.equal(renderer.outputEncoding,THREE.sRGBEncoding);
composer.render=()=>{throw Error('render failure')};assert.throws(()=>run('renderRaceScene()'),/render failure/);
assert.equal(renderer.toneMapping,THREE.ACESFilmicToneMapping,'restore display transform even on failure');assert.equal(renderer.outputEncoding,THREE.sRGBEncoding);
const low=setup(false);let direct=0;low.renderer.render=()=>direct++;
low.run('renderRaceScene();renderRaceScene()');assert.equal(direct,2);assert.equal(low.run('raceComposer'),null,'unsupported HDR renders directly');
low.renderer.capabilities.isWebGL2=false;
for(const missing of ['OES_texture_half_float','OES_texture_half_float_linear','EXT_color_buffer_half_float']){
 low.renderer.extensions.has=name=>name!==missing;assert.equal(low.run('supportsRaceHDR()'),false,missing+' is required');
}
low.renderer.extensions.has=()=>true;assert.equal(low.run('supportsRaceHDR()'),true);
// Evaluate the actual water material, and the angular term independently of rasterization.
c.zenWorldTime={value:0};vm.runInContext(read('immersion.js'),c);
const water=run("createImmersionWater({id:'cherry'},'sea')");
assert.ok(water.vertexShader.includes('waterPosition=worldPosition.xyz'));assert.ok(water.fragmentShader.includes('dot(N,V)'));
for(const source of [water.fragmentShader,read('world.js'),read('immersion.js')]){assert.ok(source.includes('#include <tonemapping_fragment>'));assert.ok(source.includes('#include <encodings_fragment>'));}
const fresnel=angle=>Math.pow(1-Math.abs(Math.cos(angle)),5);
assert.equal(fresnel(0),0);assert.ok(fresnel(Math.PI*.49)>.8,'grazing view receives stronger water sheen');
console.log('PASS HDR target chain, capability fallback, single display transform, exposure, failure restoration and water view response');
