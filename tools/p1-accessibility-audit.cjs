#!/usr/bin/env node
/* P1.10 — accessibility and platform pass, audited in a real browser against the real
 * game rather than against a mock of it.
 *
 * Covered here, with measurements: keyboard-only reach, visible focus, text contrast,
 * scalable UI at 200%, touch-target size, safe-area handling, both orientations, text
 * clipping, hover-only affordances, mute and reduced motion.
 *
 * NOT covered, and not claimed: screen-reader output on real assistive technology, and
 * anything that needs a physical phone (P0.12). Those remain human checks.
 *
 * Usage: node tools/p1-accessibility-audit.cjs [--port 4181] [--json]
 *        [--devices desktop,handset-portrait] [--screens settings,garage]
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : fallback; };
const PORT = Number(option('port', 4181));
const OUT = path.resolve(ROOT, option('out', 'docs/p1-release-polish'));
// WCAG AA: 4.5:1 for body text, 3:1 for large text. Touch targets follow the 44px guidance.
const CONTRAST_BODY = 4.5, CONTRAST_LARGE = 3, TOUCH_TARGET = 44;

function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright', path.join(ROOT, 'node_modules', 'playwright')]) {
    try { return require(id); } catch (_) { /* next */ }
  }
  console.error('This audit needs Playwright and a Chromium build (npm i -D playwright && npx playwright install chromium).');
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

/* Contrast, focus visibility, target size and clipping, all measured from computed style
   and layout boxes of the live page. Injected once and reused by every check. */
const HELPERS = `
window.__a11y = (() => {
  const parse = c => {
    const m = /rgba?\\(([^)]+)\\)/.exec(c || '');
    if (!m) return null;
    const [r, g, b, a] = m[1].split(',').map(Number);
    return { r, g, b, a: a === undefined ? 1 : a };
  };
  const lum = ({ r, g, b }) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1
  });
  // Walk up for the first ancestor that actually paints a background.
  const backdrop = el => {
    let node = el, acc = null;
    while (node && node !== document.documentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) { acc = acc ? over(acc, bg) : bg; if (acc.a >= 0.999) return acc; }
      node = node.parentElement;
    }
    // Everything sits over the circuit render, whose worst case is the pale sky.
    return acc && acc.a > 0 ? over(acc, { r: 199, g: 218, b: 235, a: 1 }) : { r: 199, g: 218, b: 235, a: 1 };
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
  const visible = el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && r.width > 0 && r.height > 0;
  };
  const label = el => (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 48);
  return {
    visible, label,
    contrast(el) {
      const style = getComputedStyle(el);
      const fg = parse(style.color); if (!fg) return null;
      const bg = backdrop(el);
      const size = parseFloat(style.fontSize), weight = Number(style.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const box = el.getBoundingClientRect();
      return { ratio: +ratio(over(fg, bg), bg).toFixed(2), large, size, color: style.color,
        against: 'rgb(' + Math.round(bg.r) + ', ' + Math.round(bg.g) + ', ' + Math.round(bg.b) + ')',
        box: [Math.round(box.width), Math.round(box.height)] };
    },
    focusRing(el) {
      el.focus();
      const s = getComputedStyle(el);
      const outline = parseFloat(s.outlineWidth) || 0;
      const shadow = s.boxShadow && s.boxShadow !== 'none';
      return { focused: document.activeElement === el, outline, shadow, style: s.outlineStyle };
    },
    clipped(el) {
      // Text is only clipped when the box actually clips it. Overflowing a box that
      // paints outside itself (a display face whose glyphs exceed its line box, say)
      // hides nothing and is not a defect. An inline box also reports clientWidth 0 by
      // definition, so it would always look overflowed.
      const s = getComputedStyle(el);
      if (s.display === 'inline' || s.display === 'contents') return false;
      const clips = v => v === 'hidden' || v === 'clip';
      const cut = clips(s.overflowX) || clips(s.overflowY) || s.textOverflow === 'ellipsis';
      if (!cut) return false;
      return el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
    },
    operable(el) {
      if (el.closest('[hidden]')) return false;
      for (let n = el; n; n = n.parentElement) if (n.inert === true) return false;
      // While a modal dialog is open the rest of the document is inert by definition.
      const modal = [...document.querySelectorAll('dialog[open]')].find(d => d.matches(':modal') || d.open);
      if (modal && !modal.contains(el)) return false;
      return true;
    },
    interactive() {
      return [...document.querySelectorAll('button, [href], input, select, summary, [tabindex], .card, .map-card')]
        .filter(el => visible(el) && !el.disabled && this.operable(el));
    }
  };
})();`;

/* Screens worth auditing. Each one is opened through the game's own controls, so what is
   measured is the real focus order and the real layout, not a synthetic fixture. */
const SCREENS = {
  title: async () => {},
  settings: async page => {
    await page.click('#title-settings');
    await page.waitForFunction(() => !document.getElementById('settings-panel').classList.contains('hidden'), null, { timeout: 300000 });
  },
  character: async page => {
    await page.click('#title-start');
    await page.waitForFunction(() => raceSetup.step === 'character', null, { timeout: 300000 });
  },
  circuit: async page => {
    await page.click('#title-start');
    await page.waitForFunction(() => raceSetup.step === 'character', null, { timeout: 300000 });
    await page.evaluate(() => document.querySelector('#grid .card').click());
    await page.waitForFunction(() => !document.getElementById('confirm-racer').disabled, null, { timeout: 300000 });
    await page.click('#confirm-racer');
    await page.waitForFunction(() => raceSetup.step === 'map', null, { timeout: 300000 });
  },
  garage: async page => {
    await page.evaluate(() => [...document.querySelectorAll('.title-actions button')].find(b => b.textContent === 'Garage').click());
    await page.waitForFunction(() => document.getElementById('garage').open, null, { timeout: 300000 });
  },
  loadout: async page => {
    await page.click('#title-start');
    await page.waitForFunction(() => raceSetup.step === 'character', null, { timeout: 300000 });
    await page.evaluate(() => document.querySelector('#grid .card').click());
    await page.click('#open-loadout');
    await page.waitForFunction(() => document.getElementById('loadout-dialog').open, null, { timeout: 300000 });
  },
  coach: async page => {
    // The coach only exists inside a race — it parks itself anywhere else — so audit it
    // where a player actually meets it, by entering a real race through the real UI.
    const settled = () => page.waitForFunction(() => typeof sceneCut === 'undefined' || !sceneCut.busy, null, { timeout: 300000 });
    await page.evaluate(() => { try { localStorage.removeItem('zenflow-racer-v2'); } catch (_) {} delete saved.tutorial; });
    await page.click('#title-start'); await settled();
    await page.waitForFunction(() => raceSetup.step === 'character', null, { timeout: 300000 });
    await page.evaluate(() => document.querySelector('#grid .card').click());
    await page.waitForFunction(() => !document.getElementById('confirm-racer').disabled, null, { timeout: 300000 });
    await page.click('#confirm-racer'); await settled();
    await page.waitForFunction(() => raceSetup.step === 'map', null, { timeout: 300000 });
    await page.click('[data-map="cherry"]'); await settled();
    await page.waitForFunction(() => raceSetup.mapConfirmed && !document.getElementById('go').disabled, null, { timeout: 300000 });
    await page.click('#go'); await settled();
    await page.waitForFunction(() => !document.getElementById('coach').hidden, null, { timeout: 300000 });
  }
};

async function audit(browser, { name, viewport, isMobile = false, reducedMotion, zoom = 1, screen = 'title' }) {
  const context = await browser.newContext({ viewport, hasTouch: isMobile, isMobile, reducedMotion, deviceScaleFactor: isMobile ? 2 : 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.state !== 'boot', null, { timeout: 240000 });
  if (zoom !== 1) await page.addStyleTag({ content: `html{font-size:${Math.round(16 * zoom)}px}` });
  const findings = [];
  const add = (check, detail) => findings.push({ profile: name, screen, check, detail });
  try {
    await SCREENS[screen](page);
  } catch (error) {
    // A screen the audit cannot even open is itself a finding, and the rest of the run
    // still has value, so it is recorded rather than thrown.
    add('unreachable', `could not open this screen: ${error.message.split('\n')[0]}`);
    await page.screenshot({ path: path.join(OUT, `a11y-${name}-${screen}-unreachable.png`), timeout: 300000 }).catch(() => {});
    await context.close();
    return { findings, errors, viewport, motion: null, overflow: null };
  }
  await page.addScriptTag({ content: HELPERS });
  await wait(500);

  // --- Keyboard-only reach: every visible control must be focusable by the keyboard. ---
  const unreachable = await page.evaluate(() => window.__a11y.interactive()
    .filter(el => { el.focus(); return document.activeElement !== el; })
    .map(el => window.__a11y.label(el)));
  for (const label of unreachable) add('keyboard-reach', `"${label}" cannot take keyboard focus`);

  // Tabbing from the top must land inside the page's own controls, not fall through.
  const tabOrder = await page.evaluate(async () => {
    document.body.focus();
    return window.__a11y.interactive().slice(0, 12).map(el => ({ label: window.__a11y.label(el), tabIndex: el.tabIndex }));
  });
  for (const entry of tabOrder) if (entry.tabIndex < 0) add('keyboard-reach', `"${entry.label}" is removed from the tab order`);

  // --- Visible focus on every control. ---
  // :focus-visible follows the browser's input modality. The audit drives the UI with the
  // mouse to reach each screen, which leaves Chromium in pointer modality and hides the
  // very indicator being measured, so switch to keyboard modality first.
  await page.keyboard.press('Tab');
  const noRing = await page.evaluate(() => window.__a11y.interactive()
    .map(el => ({ label: window.__a11y.label(el), ring: window.__a11y.focusRing(el) }))
    .filter(r => r.ring.focused && r.ring.outline < 1 && !r.ring.shadow)
    .map(r => r.label));
  for (const label of noRing) add('visible-focus', `"${label}" shows no focus indicator`);

  // --- Contrast of visible text. ---
  const contrast = await page.evaluate(({ body, large }) => {
    const out = [];
    for (const el of document.querySelectorAll('button, p, h1, h2, h3, span, label, div, strong, em, summary, kbd')) {
      if (!window.__a11y.visible(el)) continue;
      const text = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
      if (!text) continue;
      const c = window.__a11y.contrast(el);
      if (!c) continue;
      const need = c.large ? large : body;
      if (c.ratio < need) out.push({ label: window.__a11y.label(el), ratio: c.ratio, need, size: c.size, color: c.color, against: c.against, box: c.box });
    }
    return out;
  }, { body: CONTRAST_BODY, large: CONTRAST_LARGE });
  for (const c of contrast) add('contrast', `"${c.label}" is ${c.ratio}:1 (needs ${c.need}:1 at ${c.size}px) — ${c.color} on ${c.against}, box ${c.box[0]}×${c.box[1]}`);

  // --- Text clipping. ---
  const clipped = await page.evaluate(() => [...document.querySelectorAll('button, .card, .map-card, #pick, .btn, kbd, .circuit-name, #selected-name')]
    .filter(el => window.__a11y.visible(el) && window.__a11y.clipped(el))
    .map(el => window.__a11y.label(el)));
  for (const label of clipped) add('text-clipping', `"${label}" clips its own text`);

  // --- Horizontal overflow: the page must never scroll sideways. ---
  const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: window.innerWidth }));
  if (overflow.doc > overflow.view + 2) add('layout', `the page scrolls sideways (${overflow.doc}px of content in ${overflow.view}px)`);

  // --- Touch targets, on the profiles that actually use touch. ---
  if (isMobile) {
    await page.evaluate(() => { game.touch = true; if (typeof showTouch === 'function') showTouch(); document.getElementById('touch')?.classList.add('on'); });
    await wait(300);
    const small = await page.evaluate(min => [...document.querySelectorAll('#touch .tz, #touch #tSteer, button')]
      .filter(el => window.__a11y.visible(el))
      .map(el => { const r = el.getBoundingClientRect(); return { label: window.__a11y.label(el), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(r => r.w < min || r.h < min), TOUCH_TARGET);
    for (const t of small) add('touch-target', `"${t.label}" is ${t.w}×${t.h}px (needs ${TOUCH_TARGET}px)`);

    // Safe areas: the shell must use env(safe-area-inset-*) rather than fixed padding.
    const safeArea = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sa-t') !== '');
    if (!safeArea) add('safe-area', 'the layout does not declare safe-area insets');
  }

  // --- Hover-only affordances: anything that reveals on hover must also reveal on focus. ---
  const hoverOnly = await page.evaluate(() => {
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (_) { continue; }
      for (const rule of rules || []) {
        if (!rule.selectorText || !rule.selectorText.includes(':hover')) continue;
        // A hover rule is fine as long as the same declaration block is reachable by focus.
        const selectors = rule.selectorText.split(',').map(s => s.trim());
        for (const selector of selectors) {
          if (!selector.includes(':hover')) continue;
          const base = selector.replace(/:hover/g, '');
          const focusForm = selector.replace(/:hover/g, ':focus-visible');
          const hasFocusForm = [...rules].some(r => r.selectorText && r.selectorText.split(',').some(s => s.trim() === focusForm || s.trim() === selector.replace(/:hover/g, ':focus')));
          let interactive = false;
          try { interactive = [...document.querySelectorAll(base)].some(el => el.matches('button, [href], [tabindex], input, select, summary')); } catch (_) { /* selector not queryable */ }
          if (interactive && !hasFocusForm) out.push(selector);
        }
      }
    }
    return [...new Set(out)];
  });
  for (const selector of hoverOnly) add('hover-only', `${selector} has no focus equivalent`);

  // --- Mute must work from the keyboard and report its state. ---
  const mute = await page.evaluate(() => {
    const button = document.getElementById('mutebtn');
    if (!button) return { missing: true };
    // The mute control belongs to the race HUD, which the menu screens hold inert on
    // purpose. Only check it where a player can actually reach it.
    if (!window.__a11y.operable(button) || !window.__a11y.visible(button)) return { unreachable: true };
    const before = button.textContent;
    button.click();
    const after = button.textContent;
    button.click();
    return { before, after, restored: button.textContent };
  });
  if (mute.missing) add('mute', 'no mute control');
  else if (mute.unreachable) { /* held inert with the rest of the race HUD */ }
  else if (mute.before === mute.after) add('mute', 'the mute control does not report its state');
  else if (mute.restored !== mute.before) add('mute', 'muting twice does not restore the original state');

  // --- Reduced motion must actually reach the camera comfort factor. ---
  const motion = await page.evaluate(() => ({
    query: matchMedia('(prefers-reduced-motion: reduce)').matches,
    camera: typeof cameraComfort !== 'undefined' ? cameraComfort.motion : null
  }));
  if (reducedMotion === 'reduce') {
    if (!motion.query) add('reduced-motion', 'the browser did not report reduced motion');
    else if (!(motion.camera !== null && motion.camera < 1)) add('reduced-motion', 'the camera ignores reduced motion');
  }

  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `a11y-${name}-${screen}.png`), timeout: 300000 });
  await context.close();
  return { findings, errors, viewport, motion, overflow };
}

// Every profile audits the title screen; the three that matter most for layout and for
// touch also walk the rest of the interactive surface.
const ALL_SCREENS = Object.keys(SCREENS);
const DEVICES = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, screens: ALL_SCREENS },
  { name: 'desktop-200pct-text', viewport: { width: 1440, height: 900 }, zoom: 2, screens: ALL_SCREENS },
  { name: 'desktop-reduced-motion', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', screens: ['title', 'coach'] },
  { name: 'handset-portrait', viewport: { width: 390, height: 844 }, isMobile: true, screens: ALL_SCREENS },
  { name: 'handset-landscape', viewport: { width: 844, height: 390 }, isMobile: true, screens: ['title', 'circuit', 'garage'] },
  { name: 'small-android-portrait', viewport: { width: 360, height: 640 }, isMobile: true, screens: ['title', 'circuit', 'garage', 'coach'] }
];
const ONLY_DEVICES = (option('devices', '') || '').split(',').map(v => v.trim()).filter(Boolean);
const ONLY_SCREENS = (option('screens', '') || '').split(',').map(v => v.trim()).filter(Boolean);
const PROFILES = DEVICES
  .filter(device => !ONLY_DEVICES.length || ONLY_DEVICES.includes(device.name))
  .flatMap(device => device.screens
    .filter(screen => !ONLY_SCREENS.length || ONLY_SCREENS.includes(screen))
    .map(screen => ({ ...device, screen })));

(async () => {
  const { chromium } = loadPlaywright();
  const server = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const report = { generated: new Date().toISOString(), thresholds: { CONTRAST_BODY, CONTRAST_LARGE, TOUCH_TARGET }, profiles: [], findings: [], consoleErrors: [] };
  try {
    for (const profile of PROFILES) {
      process.stdout.write(`auditing ${profile.name} · ${profile.screen}… `);
      const result = await audit(browser, profile);
      report.profiles.push({ name: profile.name, screen: profile.screen, viewport: result.viewport, findings: result.findings.length, errors: result.errors.length });
      report.findings.push(...result.findings);
      report.consoleErrors.push(...result.errors.map(e => `${profile.name}/${profile.screen}: ${e}`));
      console.log(`${result.findings.length} findings`);
    }
  } finally {
    await browser.close();
    server.kill();
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'accessibility-report.json'), JSON.stringify(report, null, 1) + '\n');
  if (argv.includes('--json')) console.log(JSON.stringify(report, null, 1));
  const byCheck = {};
  for (const f of report.findings) (byCheck[f.check] ||= []).push(f);
  console.log('\nFindings by check:');
  for (const [check, list] of Object.entries(byCheck)) {
    console.log(`  ${check}: ${list.length}`);
    for (const f of list.slice(0, 8)) console.log(`     [${f.profile} · ${f.screen}] ${f.detail}`);
    if (list.length > 8) console.log(`     …and ${list.length - 8} more`);
  }
  if (!report.findings.length) console.log('  none');
  console.log(`\nConsole/page errors: ${report.consoleErrors.length}`);
  process.exit(report.findings.length || report.consoleErrors.length ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
