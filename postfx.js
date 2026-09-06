/* Bloom is a presentation adapter. Race rules remain independent of GPU effects. */
let raceComposer = null;
function renderRaceScene() {
  if (!FALLBACK_GRAPHICS && !LOWFX && !MOBILEFX && THREE.EffectComposer && !raceComposer) {
    raceComposer = new THREE.EffectComposer(renderer);
    raceComposer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    raceComposer.addPass(new THREE.RenderPass(scene, camera));
    raceComposer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.26, 0.4, 0.93));
    raceComposer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
  }
  if (raceComposer) raceComposer.render();
  else renderer.render(scene, camera);
}
addEventListener('resize', () => raceComposer?.setSize(innerWidth, innerHeight));
