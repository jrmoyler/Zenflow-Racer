/* Bloom is a presentation adapter. Race rules remain independent of GPU effects.
   Dynamic grade: bloom breathes with raceFX.post (boost / drift tier / hit) and a single cheap
   final pass applies the grade, ACES tone mapping, then sRGB encoding.
   Scene and bloom buffers remain linear HDR until that final display transform. */
let raceComposer=null,raceBloom=null,raceGrade=null,racePostAttempted=false;
const RACE_POST_ZERO={bloom:0,vignette:0,chroma:0,hit:0,flash:0};
const RACE_BLOOM_BASE={strength:.3,radius:.4,threshold:.9};
const RaceGradeShader={
  uniforms:{tDiffuse:{value:null},vignette:{value:0},chroma:{value:0},hit:{value:0},flash:{value:0},aspect:{value:1.5},toneMappingExposure:{value:1}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`
#include <tonemapping_pars_fragment>
uniform sampler2D tDiffuse;uniform float vignette,chroma,hit,flash,aspect;varying vec2 vUv;
void main(){vec2 c=vUv-.5;vec4 tex=texture2D(tDiffuse,vUv);
if(chroma>.001){vec2 d=c*chroma*.006;tex.r=texture2D(tDiffuse,vUv+d).r;tex.b=texture2D(tDiffuse,vUv-d).b;}
if(vignette>.001){float r=length(c*vec2(aspect,1.));float vig=smoothstep(.32,1.05,r);vec3 tint=mix(vec3(0.,.85,.71),vec3(1.,.26,.18),hit);tex.rgb=mix(tex.rgb,tex.rgb*(1.-vig*.6)+tint*vig*.14,vignette);}
if(flash>.001)tex.rgb+=flash*vec3(1.,.97,.9)*.16;
tex.rgb=ACESFilmicToneMapping(tex.rgb);
gl_FragColor=LinearTosRGB(tex);}`
};
function supportsRaceHDR(){
  const ext=renderer.extensions;
  if(!ext||!renderer.capabilities)return false;
  return renderer.capabilities.isWebGL2?ext.has('EXT_color_buffer_float'):
    ext.has('OES_texture_half_float')&&ext.has('OES_texture_half_float_linear')&&ext.has('EXT_color_buffer_half_float');
}
function buildRaceComposer(){
  const target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,encoding:THREE.LinearEncoding});
  const composer=new THREE.EffectComposer(renderer,target);
  composer.setPixelRatio(Math.min(devicePixelRatio,1.25));
  composer.addPass(new THREE.RenderPass(scene,camera));
  raceBloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),RACE_BLOOM_BASE.strength,RACE_BLOOM_BASE.radius,RACE_BLOOM_BASE.threshold);
  // r128's bloom defaults to byte buffers, which clip luminous rims and highlights.
  for(const target of [raceBloom.renderTargetBright,...raceBloom.renderTargetsHorizontal,...raceBloom.renderTargetsVertical]){
    target.texture.type=THREE.HalfFloatType;
    target.texture.encoding=THREE.LinearEncoding;
  }
  composer.addPass(raceBloom);
  raceGrade=new THREE.ShaderPass(RaceGradeShader);
  raceGrade.material.toneMapped=false;
  composer.addPass(raceGrade);
  composer.setSize(innerWidth,innerHeight);
  return composer;
}
function renderRaceScene() {
  const started=performance.now();
  if (!FALLBACK_GRAPHICS && !LOWFX && !MOBILEFX && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.ShaderPass && !racePostAttempted) {
    racePostAttempted=true;
    try{if(supportsRaceHDR())raceComposer=buildRaceComposer();}catch(error){raceComposer=null;raceBloom=null;raceGrade=null;console.warn('Post-processing disabled:',error);}
  }
  if (raceComposer) {
    const post=(typeof raceFX!=='undefined'&&raceFX&&raceFX.post)||RACE_POST_ZERO;
    const b=post.bloom>0?Math.min(1,post.bloom):0;
    raceBloom.strength=RACE_BLOOM_BASE.strength+b*.28;raceBloom.radius=RACE_BLOOM_BASE.radius+b*.1;raceBloom.threshold=RACE_BLOOM_BASE.threshold-b*.1;
    const u=raceGrade.uniforms;u.vignette.value=post.vignette>0?Math.min(1,post.vignette):0;u.chroma.value=post.chroma>0?Math.min(1,post.chroma):0;u.hit.value=post.hit>0?Math.min(1,post.hit):0;u.flash.value=post.flash>0?Math.min(1,post.flash):0;u.aspect.value=innerHeight>0?innerWidth/innerHeight:1.5;
    u.toneMappingExposure.value=renderer.toneMappingExposure;
    const toneMapping=renderer.toneMapping,encoding=renderer.outputEncoding;
    // Keep direct showroom/portrait rendering on the same display transform.
    try{renderer.toneMapping=THREE.NoToneMapping;renderer.outputEncoding=THREE.LinearEncoding;raceComposer.render();}
    finally{renderer.toneMapping=toneMapping;renderer.outputEncoding=encoding;}
  }
  else renderer.render(scene, camera);
  renderer.info.render.workMs=performance.now()-started;
}
addEventListener('resize', () => {if(!raceComposer)return;raceComposer.setSize(innerWidth, innerHeight);if(raceBloom)raceBloom.resolution.set(innerWidth,innerHeight);});
