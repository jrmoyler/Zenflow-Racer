#!/usr/bin/env node
/* P0.11 — full visual QA across all twenty racers, rendered by the real WebGL path.
 *
 * Every frame in this pass comes from the shipping index.html running in a real browser
 * with a real WebGL context (ANGLE/SwiftShader in CI containers, hardware GL elsewhere).
 * That is a change of kind from the earlier CPU contact sheets: the renderer, materials,
 * tone mapping, shadow map and post chain are the ones players get.
 *
 * What this tool does and does NOT establish:
 *   - it DOES produce reproducible in-browser WebGL captures and measured pixel evidence;
 *   - it does NOT constitute human art-direction approval, and it is not a substitute for
 *     the physical-device certification in P0.12. Software rasterisation says nothing
 *     about phone frame rates.
 *
 * Usage: node tools/p0-webgl-qa.cjs [--out docs/p0-webgl-qa] [--port 4178] [--racers 20]
 *        [--only racers,circuits,race,screens,mobile]   re-run selected phases only
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : fallback; };
const OUT = path.resolve(ROOT, option('out', 'docs/p0-webgl-qa'));
const PORT = Number(option('port', 4178));
const RACER_LIMIT = Number(option('racers', 20));
// Each capture phase can be run on its own, merging into the report already on disk, so a
// single slow phase can be repeated without re-rendering everything that already passed.
const PHASES = ['racers', 'circuits', 'race', 'screens', 'mobile'];
const ONLY = (option('only', '') || '').split(',').map(v => v.trim()).filter(Boolean);
for (const phase of ONLY) if (!PHASES.includes(phase)) { console.error(`unknown phase "${phase}"; expected one of ${PHASES.join(', ')}`); process.exit(2); }
const runs = name => !ONLY.length || ONLY.includes(name);
const CELL = { width: 420, height: 300 };
// Software rasterisation composites a full circuit frame in tens of seconds, not milliseconds.
const SHOT_TIMEOUT = 300000;
// The eleven captures P0.11 requires for every racer.
const VIEWS = ['front', 'rear', 'left', 'right', 'hero', 'cockpit', 'chase', 'drift', 'boost', 'victory', 'hit'];
const NAMED_MOMENTS = ['extension-1', 'extension-2', 'extension-3'];
const MAPS = ['cherry', 'stormforge', 'canopy'];

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
    path.join(ROOT, 'node_modules', 'playwright')
  ];
  for (const id of candidates) { try { return require(id); } catch (_) { /* next */ } }
  console.error('This capture pass needs Playwright and a Chromium build. Install one of:\n' +
    '  npm i -D playwright && npx playwright install chromium\n' +
    'or run where a global playwright is on NODE_PATH. No screenshots are invented without it.');
  process.exit(2);
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function serve() {
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.mjs'), '--port', String(PORT), '--host', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const deadline = Date.now() + 20000;
  for (;;) {
    const ok = await new Promise(resolve => {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/index.html' }, res => { res.resume(); resolve(res.statusCode === 200); });
      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => { req.destroy(); resolve(false); });
    });
    if (ok) break;
    if (Date.now() > deadline) { child.kill(); throw new Error('local server did not start'); }
    await wait(250);
  }
  return child;
}

/* Rendered-pixel statistics, read straight out of the live drawing buffer.
   This is the objective half of the QA: a frame that never drew, a subject that is
   missing, and an animation state that did not actually move all show up here. */
const PIXEL_PROBE = `(() => {
  renderReconstructionReview();
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0, min = 255, max = 0, nonBackground = 0, opaque = 0;
  const hist = new Set();
  // The staged background is a flat sky colour; anything far from it is subject or ground.
  const bg = [199, 218, 235];
  let signature = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722);
    sum += lum; if (lum < min) min = lum; if (lum > max) max = lum;
    if (px[i + 3] > 250) opaque++;
    if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 24) nonBackground++;
    if ((i / 4) % 37 === 0) { hist.add((r >> 3) + ',' + (g >> 3) + ',' + (b >> 3)); signature = (signature * 31 + r + g * 3 + b * 7) >>> 0; }
  }
  const count = px.length / 4;
  return {
    width: w, height: h,
    meanLuminance: +(sum / count).toFixed(3),
    minLuminance: min, maxLuminance: max,
    subjectCoverage: +(nonBackground / count).toFixed(5),
    opaqueRatio: +(opaque / count).toFixed(5),
    distinctColors: hist.size,
    signature
  };
})()`;

/* Structural checks against the live scene graph after the real renderer has drawn it.
   Everything here is measured from the rendered object, not from an offline asset copy. */
const STRUCTURE_PROBE = `(() => {
  const r = reconstructionReview, root = r.object, ud = root.userData;
  root.updateWorldMatrix(true, true);
  const issues = [];
  const box = o => new THREE.Box3().setFromObject(o);
  const meshes = [];
  let nanMatrix = 0, missingMaterial = 0, shadowless = 0, emissive = 0, doubleSided = 0;
  const names = new Map();
  root.traverse(o => {
    if (o.matrixWorld.elements.some(v => !Number.isFinite(v))) nanMatrix++;
    if (o.name) names.set(o.name, (names.get(o.name) || 0) + 1);
    if (!o.isMesh) return;
    meshes.push(o);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) { missingMaterial++; continue; }
      if (m.emissive && m.emissive.getHex() > 0) emissive++;
      if (m.side === THREE.DoubleSide) doubleSided++;
    }
    if (!o.castShadow) shadowless++;
  });
  if (nanMatrix) issues.push(nanMatrix + ' non-finite world matrices');
  if (missingMaterial) issues.push(missingMaterial + ' meshes without a material');
  if (!emissive) issues.push('no emissive surface left on the kart (broken glow)');

  // Detached parts: every rider mesh must sit inside the pilot envelope, and the pilot
  // inside the chassis envelope. A limb that broke off its pivot leaves that envelope.
  const chassis = box(root);
  const pilot = ud.pilot ? box(ud.pilot) : null;
  let detached = 0;
  if (pilot) {
    const slack = new THREE.Box3(pilot.min.clone().subScalar(0.22), pilot.max.clone().addScalar(0.22));
    ud.pilot.traverse(o => { if (o.isMesh && !slack.containsBox(box(o))) detached++; });
    if (!chassis.containsBox(new THREE.Box3(pilot.min.clone().addScalar(0.01), pilot.max.clone().subScalar(0.01)))) issues.push('pilot envelope leaves the chassis envelope');
  }
  if (detached) issues.push(detached + ' rider meshes outside the pilot envelope');

  // Hands on the wheel, measured against the rig's own contract: each glove belongs on
  // its grip point in steering-wheel space. Celebration deliberately releases the right
  // hand and spinout releases both, so those are not gaps — they are the pose.
  const wheel = ud.steeringWheel || root.getObjectByName('steering-wheel');
  const rig = ud.contactRig;
  let handGap = null;
  if (wheel && rig && rig.arms) {
    wheel.updateWorldMatrix(true, true);
    const gaps = rig.arms.map((contact, i) => {
      if (!contact) return null;
      if (r.view === 'spinout' || (r.view === 'victory' && i === 1)) return null;
      const glove = contact.arm.getObjectByName('racing-glove');
      if (!glove) return null;
      const actual = glove.getWorldPosition(new THREE.Vector3());
      const expected = wheel.localToWorld(contact.grip.clone());
      return +actual.distanceTo(expected).toFixed(4);
    }).filter(v => v !== null);
    if (gaps.length) {
      handGap = Math.max(...gaps);
      if (handGap > 0.02) issues.push('glove sits ' + handGap.toFixed(3) + 'm off its steering grip');
    }
  }

  // Wheels: four pivots, matched heights, mirrored track width, finite radius.
  const wheels = (ud.wheels || []).map(w => { const p = new THREE.Vector3(); (w.pivot || w).getWorldPosition(p); return p; });
  let wheelReport = null;
  if (wheels.length) {
    const ys = wheels.map(p => +p.y.toFixed(4));
    const xs = wheels.map(p => +p.x.toFixed(4));
    wheelReport = { count: wheels.length, heightSpread: +(Math.max(...ys) - Math.min(...ys)).toFixed(4), trackSpread: +(Math.max(...xs) + Math.min(...xs)).toFixed(4) };
    if (wheels.length !== 4) issues.push('expected four wheel pivots, found ' + wheels.length);
    if (wheelReport.heightSpread > 0.2) issues.push('wheel heights differ by ' + wheelReport.heightSpread + 'm');
    if (Math.abs(wheelReport.trackSpread) > 0.12) issues.push('wheel track is not mirrored (' + wheelReport.trackSpread + ')');
  }

  // Duplicated rider parts: the sculpt pass must not leave a second torso or helmet.
  const duplicated = [...names.entries()].filter(([n, c]) => c > 1 && /torso|head-mesh|division-rider-identity|steering-wheel$/.test(n));
  if (duplicated.length) issues.push('duplicated rider parts: ' + duplicated.map(([n, c]) => n + '×' + c).join(', '));

  return {
    asset: r.asset, view: r.view,
    meshes: meshes.length,
    triangles: renderer.info.render.triangles,
    drawCalls: renderer.info.render.calls,
    shadowMap: renderer.shadowMap.enabled,
    shadowlessMeshes: shadowless,
    doubleSidedMeshes: doubleSided,
    emissiveMaterials: emissive,
    handGap, wheels: wheelReport,
    chassisSize: chassis.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(3)),
    issues
  };
})()`;

async function bootPage(browser, url, { width = CELL.width, height = CELL.height, mobile = false } = {}) {
  const context = await browser.newContext(mobile
    ? { viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36' }
    : { viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  return { context, page, errors };
}

async function captureRacers(browser, report) {
  const url = `http://127.0.0.1:${PORT}/index.html?review=kart&asset=zenflow&view=front`;
  const { context, page, errors } = await bootPage(browser, url);
  await page.waitForFunction(() => typeof reconstructionReview !== 'undefined' && reconstructionReview && reconstructionReview.ready, null, { timeout: 240000 });
  // The evidence overlay is recorded in report.json instead of burned into every cell.
  await page.addStyleTag({ content: '#reconstruction-evidence{display:none!important}' });
  const roster = (await page.evaluate(() => ROSTER.map(d => ({ id: d.id, name: d.name })))).slice(0, RACER_LIMIT);
  const sheets = [];
  for (const racer of roster) {
    const cells = [];
    const entry = { id: racer.id, name: racer.name, views: {}, issues: [] };
    for (const view of VIEWS) {
      await page.evaluate(([a, v]) => reconstructionReview.retarget(a, v), [racer.id, view]);
      const pixels = await page.evaluate(PIXEL_PROBE);
      const structure = await page.evaluate(STRUCTURE_PROBE);
      const shot = await page.screenshot({ type: 'png', timeout: SHOT_TIMEOUT });
      cells.push({ view, data: 'data:image/png;base64,' + shot.toString('base64') });
      entry.views[view] = { pixels, structure: { triangles: structure.triangles, drawCalls: structure.drawCalls, meshes: structure.meshes, handGap: structure.handGap, wheels: structure.wheels, issues: structure.issues } };
      if (pixels.subjectCoverage < 0.02) entry.issues.push(`${view}: subject covers only ${(pixels.subjectCoverage * 100).toFixed(2)}% of the frame`);
      if (pixels.distinctColors < 12) entry.issues.push(`${view}: frame has ${pixels.distinctColors} sampled colours (suspect blank render)`);
      for (const issue of structure.issues) entry.issues.push(`${view}: ${issue}`);
    }
    // An animation state that does not move produces the same rendered frame as the
    // neutral pose. Compare against the front capture to prove the clip really applied.
    const base = entry.views.front.pixels.signature;
    for (const view of ['drift', 'boost', 'victory', 'hit']) {
      if (entry.views[view].pixels.signature === base) entry.issues.push(`${view}: rendered frame is identical to the static pose`);
    }
    entry.sheet = `racers/${racer.id}.png`;
    sheets.push({ id: racer.id, name: racer.name, cells });
    report.racers.push(entry);
    process.stdout.write(`  ${racer.id.padEnd(12)} ${entry.issues.length ? 'ISSUES ' + entry.issues.length : 'clean'}\n`);
  }
  report.renderer = await page.evaluate(() => reconstructionReview.renderer);
  report.consoleErrors.push(...errors);
  await context.close();
  return sheets;
}

async function composite(browser, sheets) {
  fs.mkdirSync(path.join(OUT, 'racers'), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 64, height: 64 } });
  const page = await context.newPage();
  await page.goto('about:blank');
  for (const sheet of sheets) {
    const dataUrl = await page.evaluate(async ({ cells, title, cell }) => {
      const cols = 4, rows = Math.ceil(cells.length / cols), pad = 26;
      const canvas = document.createElement('canvas');
      canvas.width = cols * cell.width; canvas.height = rows * (cell.height + pad) + pad;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#101b28'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f3f6fb'; ctx.font = '600 16px monospace';
      ctx.fillText(title, 12, 18);
      for (let i = 0; i < cells.length; i++) {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = cells[i].data; });
        const x = (i % cols) * cell.width, y = pad + Math.floor(i / cols) * (cell.height + pad);
        ctx.drawImage(img, x, y, cell.width, cell.height);
        ctx.fillStyle = '#c8d6e6'; ctx.font = '600 13px monospace';
        ctx.fillText(cells[i].view, x + 8, y + cell.height + 16);
      }
      return canvas.toDataURL('image/png');
    }, { cells: sheet.cells, title: `${sheet.name} · real WebGL capture · ${sheet.cells.length} views`, cell: CELL });
    fs.writeFileSync(path.join(OUT, 'racers', sheet.id + '.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  await context.close();
}

async function captureCircuits(browser, report) {
  fs.mkdirSync(path.join(OUT, 'circuits'), { recursive: true });
  for (const map of MAPS) {
    for (const view of NAMED_MOMENTS) {
      const { context, page, errors } = await bootPage(browser, `http://127.0.0.1:${PORT}/index.html?review=map&asset=${map}&view=${view}`, { width: 720, height: 405 });
      await page.waitForFunction(() => typeof reconstructionReview !== 'undefined' && reconstructionReview && reconstructionReview.ready, null, { timeout: 240000 });
      await page.evaluate(() => new Promise(res => { let n = 0; const tick = () => (++n > 3 ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }));
      const landmark = await page.evaluate(v => {
        const index = Number(v.slice(-1)) - 1;
        const mark = world.userData.extensionLandmarks && world.userData.extensionLandmarks[index];
        return mark ? { name: mark.name || null, u: mark.u } : null;
      }, view);
      const shot = await page.screenshot({ type: 'png', timeout: SHOT_TIMEOUT });
      fs.writeFileSync(path.join(OUT, 'circuits', `${map}-${view}.png`), shot);
      report.circuits.push({ map, view, landmark, errors });
      report.consoleErrors.push(...errors);
      await context.close();
    }
  }
}

async function captureRace(browser, report) {
  fs.mkdirSync(path.join(OUT, 'race'), { recursive: true });
  for (const map of MAPS) {
    const { context, page, errors } = await bootPage(browser, `http://127.0.0.1:${PORT}/index.html?review=1`, { width: 720, height: 405 });
    await page.waitForFunction(() => typeof game !== 'undefined' && game.state !== 'boot', null, { timeout: 240000 });
    // Scene transitions are frame-driven, and software rasterisation runs a handful of
    // frames a second. Every step waits on real game state rather than on a stopwatch.
    const settled = () => page.waitForFunction(() => typeof sceneCut === 'undefined' || !sceneCut.busy, null, { timeout: 300000 });
    await page.click('#title-start'); await settled();
    await page.waitForFunction(() => raceSetup.step === 'character', null, { timeout: 300000 });
    await page.evaluate(() => document.querySelector('#grid .card').click());
    await page.waitForFunction(() => !document.getElementById('confirm-racer').disabled, null, { timeout: 300000 });
    await page.click('#confirm-racer'); await settled();
    await page.waitForFunction(() => raceSetup.step === 'map', null, { timeout: 300000 });
    await page.click(`[data-map="${map}"]`); await settled();
    await page.waitForFunction(() => raceSetup.mapConfirmed && !document.getElementById('go').disabled, null, { timeout: 300000 });
    await page.click('#go'); await settled();
    // SwiftShader draws this scene at a few frames a second, so the countdown burns
    // real seconds. Wait on the simulation state, never on a fixed sleep.
    await page.waitForFunction(() => game.state === 'race', null, { timeout: 300000 });
    // Nothing moves until somebody drives. Auto throttle is off by default on a desktop
    // profile, so hold the accelerator the way a player would and let the kart get up to
    // racing speed before the frame is captured.
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => game.player && game.player.speed > 8, null, { timeout: 300000 });
    const shot = await page.screenshot({ type: 'png', timeout: SHOT_TIMEOUT });
    await page.keyboard.up('KeyW');
    fs.writeFileSync(path.join(OUT, 'race', `${map}-chase.png`), shot);
    const state = await page.evaluate(() => ({
      racers: game.racers.length, laps: game.laps, state: game.state,
      speed: +game.player.speed.toFixed(2), lap: game.player.lap,
      triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls,
      shadowMap: renderer.shadowMap.enabled, fallback: FALLBACK_GRAPHICS
    }));
    report.race.push({ map, state, errors });
    report.consoleErrors.push(...errors);
    await context.close();
  }
}

/* The spec asks for Garage and reward screenshots alongside the racer sheets, because
   those screens are where a player spends the credits the race pays. Both are captured
   through the real UI: the Garage through its own button, the results through the staged
   podium fixture, which never writes a record or claims a completed race. */
async function captureScreens(browser, report) {
  fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });
  const garage = await bootPage(browser, `http://127.0.0.1:${PORT}/index.html`, { width: 1280, height: 800 });
  await garage.page.waitForFunction(() => typeof game !== 'undefined' && game.state !== 'boot', null, { timeout: 240000 });
  await garage.page.evaluate(() => [...document.querySelectorAll('.title-actions button')].find(b => b.textContent === 'Garage').click());
  await garage.page.waitForFunction(() => document.getElementById('garage').open, null, { timeout: 300000 });
  await wait(2500);
  fs.writeFileSync(path.join(OUT, 'screens', 'garage.png'), await garage.page.screenshot({ type: 'png', timeout: SHOT_TIMEOUT }));
  const garageState = await garage.page.evaluate(() => ({
    wallet: saved.wallet, cards: document.querySelectorAll('#garage article').length,
    locked: document.querySelectorAll('#garage .garage-locked').length,
    previewRenderer: document.querySelector('#garage-preview canvas') ? 'canvas present' : 'no preview canvas'
  }));
  report.consoleErrors.push(...garage.errors);
  await garage.context.close();

  const podium = await bootPage(browser, `http://127.0.0.1:${PORT}/index.html?review=podium`, { width: 1280, height: 800 });
  await podium.page.waitForFunction(() => typeof reconstructionReview !== 'undefined' && reconstructionReview && reconstructionReview.ready, null, { timeout: 240000 });
  await wait(2500);
  fs.writeFileSync(path.join(OUT, 'screens', 'results-podium.png'), await podium.page.screenshot({ type: 'png', timeout: SHOT_TIMEOUT }));
  const rewardState = await podium.page.evaluate(() => ({
    resultsVisible: !document.getElementById('results').classList.contains('hidden'),
    rewardSummary: (document.getElementById('reward-summary').textContent || '').slice(0, 240)
  }));
  report.consoleErrors.push(...podium.errors);
  await podium.context.close();

  report.screens = { garage: garageState, results: rewardState };
}

async function captureMobileFallback(browser, report) {
  fs.mkdirSync(path.join(OUT, 'mobile'), { recursive: true });
  // Emulated handset viewport with a coarse pointer: this drives the shipping MOBILEFX
  // branch (no shadow map, reduced pixel ratio, no bloom). It is a code-path check.
  // It is NOT a device certification and says nothing about real phone frame rates.
  const { context, page, errors } = await bootPage(browser, `http://127.0.0.1:${PORT}/index.html?review=kart&asset=zenflow&view=hero`, { width: 390, height: 844, mobile: true });
  await page.waitForFunction(() => typeof reconstructionReview !== 'undefined' && reconstructionReview && reconstructionReview.ready, null, { timeout: 240000 });
  const mobile = await page.evaluate(() => ({ mobileFx: MOBILEFX, lowFx: LOWFX, fallback: FALLBACK_GRAPHICS, shadowMap: renderer.shadowMap.enabled, pixelRatio: renderer.getPixelRatio() }));
  fs.writeFileSync(path.join(OUT, 'mobile', 'handset-hero.png'), await page.screenshot({ type: 'png', timeout: SHOT_TIMEOUT }));
  await context.close();

  // The software fallback renderer is the path taken when WebGL is unavailable.
  const low = await bootPage(browser, `http://127.0.0.1:${PORT}/index.html?review=kart&asset=zenflow&view=hero&lowfx=1`, { width: 390, height: 844, mobile: true });
  await low.page.waitForFunction(() => typeof reconstructionReview !== 'undefined' && reconstructionReview && reconstructionReview.ready, null, { timeout: 240000 });
  const lowState = await low.page.evaluate(() => ({ lowFx: LOWFX, pixelRatio: renderer.getPixelRatio(), shadowMap: renderer.shadowMap.enabled }));
  fs.writeFileSync(path.join(OUT, 'mobile', 'handset-lowfx.png'), await low.page.screenshot({ type: 'png', timeout: SHOT_TIMEOUT }));
  await low.context.close();

  report.mobile = { emulatedHandset: mobile, lowFx: lowState };
  report.consoleErrors.push(...errors, ...low.errors);
}

(async () => {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let report = { generated: new Date().toISOString(), renderer: null, views: VIEWS, racers: [], circuits: [], race: [], screens: null, mobile: null, consoleErrors: [] };
  const existing = path.join(OUT, 'report.json');
  if (ONLY.length && fs.existsSync(existing)) {
    report = { ...JSON.parse(fs.readFileSync(existing, 'utf8')), generated: new Date().toISOString() };
    for (const phase of ONLY) { if (phase === 'racers') report.racers = []; if (phase === 'circuits') report.circuits = []; if (phase === 'race') report.race = []; }
    console.log(`Merging into the existing report; re-running: ${ONLY.join(', ')}`);
  }
  // The report is written after every phase. A later phase timing out then costs only
  // that phase, not the hour of rendering that came before it.
  const save = () => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1)); };
  try {
    if (runs('racers')) {
      console.log('Capturing twenty racers × ' + VIEWS.length + ' views through the real WebGL path…');
      const sheets = await captureRacers(browser, report);
      await composite(browser, sheets);
      save();
    }
    if (runs('circuits')) {
      console.log('Capturing the nine named circuit moments…');
      await captureCircuits(browser, report);
      save();
    }
    if (runs('race')) {
      console.log('Capturing an in-race chase frame on every circuit…');
      await captureRace(browser, report);
      save();
    }
    if (runs('screens')) {
      console.log('Capturing the Garage and the reward screen…');
      await captureScreens(browser, report);
      save();
    }
    if (runs('mobile')) {
      console.log('Capturing the emulated handset and reduced-effect paths…');
      await captureMobileFallback(browser, report);
      save();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  const issues = report.racers.flatMap(r => r.issues.map(i => `${r.id}: ${i}`));
  report.issueCount = issues.length;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(`\nRenderer: ${report.renderer}`);
  console.log(`Racers captured: ${report.racers.length} · views each: ${VIEWS.length}`);
  console.log(`Console/page errors: ${report.consoleErrors.length}`);
  console.log(`QA issues: ${issues.length}`);
  for (const issue of issues.slice(0, 40)) console.log('  ' + issue);
  process.exit(issues.length || report.consoleErrors.length ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
