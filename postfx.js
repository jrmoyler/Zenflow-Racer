/* Bloom is a presentation adapter. Race rules remain independent of GPU effects.
   Dynamic grade: bloom breathes with raceFX.post (boost / drift tier / hit) and a single cheap
   final pass does vignette + chromatic aberration + the gamma correction. With every post value
   at 0 the output is byte-identical to the vendored GammaCorrectionShader path (LinearTosRGB). */
let raceComposer=null,raceBloom=null,raceGrade=null;
const RACE_POST_ZERO={bloom:0,vignette:0,chroma:0,hit:0,flash:0};
const RACE_BLOOM_BASE={strength:.3,radius:.4,threshold:.9};
const RaceGradeShader={
  uniforms:{tDiffuse:{value:null},vignette:{value:0},chroma:{value:0},hit:{value:0},flash:{value:0},aspect:{value:1.5}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float vignette,chroma,hit,flash,aspect;varying vec2 vUv;
void main(){vec2 c=vUv-.5;vec4 tex=texture2D(tDiffuse,vUv);
if(chroma>.001){vec2 d=c*chroma*.014;tex.r=texture2D(tDiffuse,vUv+d).r;tex.b=texture2D(tDiffuse,vUv-d).b;}
if(vignette>.001){float r=length(c*vec2(aspect,1.));float vig=smoothstep(.32,1.05,r);vec3 tint=mix(vec3(0.,.85,.71),vec3(1.,.26,.18),hit);tex.rgb=mix(tex.rgb,tex.rgb*(1.-vig*.6)+tint*vig*.14,vignette);}
if(flash>.001)tex.rgb+=flash*vec3(1.,.97,.9)*.32;
gl_FragColor=LinearTosRGB(tex);}`
};
function buildRaceComposer(){
  const composer=new THREE.EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio,1.25));
  composer.addPass(new THREE.RenderPass(scene,camera));
  raceBloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),RACE_BLOOM_BASE.strength,RACE_BLOOM_BASE.radius,RACE_BLOOM_BASE.threshold);
  composer.addPass(raceBloom);
  raceGrade=new THREE.ShaderPass(RaceGradeShader);
  composer.addPass(raceGrade);
  composer.setSize(innerWidth,innerHeight);
  return composer;
}
function renderRaceScene() {
  if (!FALLBACK_GRAPHICS && !LOWFX && !MOBILEFX && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.ShaderPass && !raceComposer) {
    try{raceComposer=buildRaceComposer();}catch(error){raceComposer=null;raceBloom=null;raceGrade=null;console.warn('Post-processing disabled:',error);}
  }
  if (raceComposer) {
    const post=(typeof raceFX!=='undefined'&&raceFX&&raceFX.post)||RACE_POST_ZERO;
    const b=post.bloom>0?Math.min(1,post.bloom):0;
    raceBloom.strength=RACE_BLOOM_BASE.strength+b*.5;raceBloom.radius=RACE_BLOOM_BASE.radius+b*.15;raceBloom.threshold=RACE_BLOOM_BASE.threshold-b*.22;
    const u=raceGrade.uniforms;u.vignette.value=post.vignette>0?Math.min(1,post.vignette):0;u.chroma.value=post.chroma>0?Math.min(1,post.chroma):0;u.hit.value=post.hit>0?Math.min(1,post.hit):0;u.flash.value=post.flash>0?Math.min(1,post.flash):0;u.aspect.value=innerHeight>0?innerWidth/innerHeight:1.5;
    raceComposer.render();
  }
  else renderer.render(scene, camera);
}
addEventListener('resize', () => {if(!raceComposer)return;raceComposer.setSize(innerWidth, innerHeight);if(raceBloom)raceBloom.resolution.set(innerWidth,innerHeight);});
