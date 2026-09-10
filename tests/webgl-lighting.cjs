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

// Previews copy the actual circuit light colors/intensities and world direction.
{
 const scene=new THREE.Scene(),hemi=new THREE.HemisphereLight(0xabcdff,0x61743a,.72),sun=new THREE.DirectionalLight(0xffbdaa,1.15),rim=new THREE.DirectionalLight(0xaacfff,.55);
 sun.position.set(200,140,30);sun.target.position.set(290,0,90);rim.position.set(160,80,200);scene.environment=new THREE.Texture();
 const ctx={THREE,scene,hemi,sun,rim};vm.createContext(ctx);const game=read('game.js');vm.runInContext(game.slice(game.indexOf('function copyCircuitLights'),game.indexOf('const directorPortraits')),ctx);
 const target=new THREE.Scene();ctx.target=target;const lights=vm.runInContext('copyCircuitLights(target)',ctx);
 assert.equal(target.environment,scene.environment);
 for(const [i,source] of [hemi,sun,rim].entries()){assert.ok(lights[i].color.equals(source.color));assert.equal(lights[i].intensity,source.intensity);if(source.target)assert.ok(lights[i].position.clone().sub(lights[i].target.position).normalize().distanceTo(source.position.clone().sub(source.target.position).normalize())<1e-9);}
 sun.color.setHex(0xaaffff);sun.intensity=.9;ctx.lights=lights;vm.runInContext('syncCircuitLights(target,lights)',ctx);assert.ok(lights[1].color.equals(sun.color));assert.equal(lights[1].intensity,.9);
 console.log('PASS roster/showroom lighting: same circuit environment, colors, intensity and direction across moving sun targets');
}
