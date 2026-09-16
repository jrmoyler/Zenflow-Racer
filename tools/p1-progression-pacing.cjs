#!/usr/bin/env node
/* P1.2 — reward pacing measured against the real economy module.
 *
 * This is a model of player outcomes, not measured human play: the three profiles below
 * are authored assumptions about how often a player finishes where, how many tokens they
 * keep, and how often they take hits. Everything downstream — payouts, prices, career
 * totals — comes from the shipping Economy rules, so a rule change moves these numbers.
 *
 * It answers the four P1.2 goals numerically:
 *   1. can a player afford something meaningful early?
 *   2. is everything unlocked immediately?
 *   3. is the grind punitive?
 *   4. does racing well still pay best?
 *
 * Usage: node tools/p1-progression-pacing.cjs [--json]
 */
const path = require('node:path');
const Economy = require(path.join(__dirname, '..', 'economy.js'));
const ADDON_IDS = require(path.join(__dirname, 'catalog-ids.cjs'));

// Authored outcome profiles. `places` is a weighted finishing distribution over 1..12.
const PROFILES = [
  { id: 'novice', difficulty: 0, places: [0, 0, 0, 0, 1, 2, 3, 3, 2, 2, 1, 1], tokens: 6, hitRate: 0.95, pbRate: 0.35 },
  { id: 'improving', difficulty: 1, places: [1, 1, 2, 3, 3, 2, 2, 1, 1, 0, 0, 0], tokens: 12, hitRate: 0.6, pbRate: 0.3 },
  { id: 'strong', difficulty: 2, places: [5, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0], tokens: 19, hitRate: 0.25, pbRate: 0.25 }
];
const MAPS = ['cherry', 'stormforge', 'canopy'];

// A deterministic generator keeps the report reproducible across runs and machines.
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function weightedPick(weights, rand) {
  const total = weights.reduce((a, b) => a + b, 0); let roll = rand() * total;
  for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) return i + 1; }
  return weights.length;
}

/* Spending plan: what a player actually wants first. One add-on to fill the second power
   slot, then the kart parts that change handling, then tuning, then cosmetics last. */
function shoppingList() {
  const list = [];
  const cheapestAddon = ADDON_IDS.map(id => ({ id, price: Economy.addonPrice(id, ADDON_IDS) })).sort((a, b) => a.price - b.price);
  list.push({ label: 'first extra add-on', price: cheapestAddon[1].price, kind: 'meaningful' });
  for (const [name, def] of Object.entries(Economy.BUILDS)) list.push({ label: name, price: def.price, kind: 'build' });
  list.push({ label: 'tuning level 2', price: 180, kind: 'tuning' });
  list.push({ label: 'tuning level 3', price: 360, kind: 'tuning' });
  list.push({ label: 'satin paint', price: 200, kind: 'cosmetic' });
  return list;
}

function simulate(profile, races, seed) {
  const rand = mulberry(seed);
  let save = Economy.migrate({}, ADDON_IDS);
  const curve = [], income = { skill: 0, novelty: 0 };
  const divisions = ['zenflow', 'collective', 'hybrid', 'nexus', 'vital', 'kinetic', 'juris', 'signal', 'loom', 'vector'];
  for (let race = 1; race <= races; race++) {
    const position = weightedPick(profile.places, rand);
    const hits = rand() < profile.hitRate ? 1 + Math.floor(rand() * 3) : 0;
    const tokens = Math.max(0, Math.round(profile.tokens * (0.6 + rand() * 0.8)));
    const map = MAPS[(race - 1) % MAPS.length];
    // A player exploring the roster early, then settling on a favourite.
    const division = race <= divisions.length ? divisions[race - 1] : divisions[0];
    const id = 'race-' + race;
    save = Economy.begin(save, id);
    const result = Economy.settle(save, {
      id, position, difficulty: profile.difficulty, map, division, hits, tokens,
      finished: true, completedLaps: 3, laps: 3, time: 120, bestLap: 38,
      personalBest: rand() < profile.pbRate
    });
    save = result.save;
    const r = result.reward;
    income.skill += r.placement + r.difficulty + r.performance + r.clean + r.tokens;
    income.novelty += r.firstMap + r.diversity;
    curve.push({ race, payout: r.total, wallet: save.wallet, career: save.careerStats.credits });
  }
  return { save, curve, income };
}

function report(races = 60) {
  const list = shoppingList();
  const catalogTotal = ADDON_IDS.reduce((sum, id) => sum + Economy.addonPrice(id, ADDON_IDS), 0)
    + ADDON_IDS.length * (180 + 360)
    + Object.values(Economy.BUILDS).reduce((sum, b) => sum + b.price, 0) + 200;
  const rows = PROFILES.map(profile => {
    const { curve, income } = simulate(profile, races, 20260916);
    const first = list.find(i => i.kind === 'meaningful');
    const raceAffordingFirst = curve.findIndex(c => c.career >= first.price) + 1;
    const competitiveCost = first.price + Economy.BUILDS.Tires.price + Economy.BUILDS.Motor.price + Economy.BUILDS.Aero.price;
    const racesToCompetitive = curve.findIndex(c => c.career >= competitiveCost) + 1;
    const racesToCatalog = curve.findIndex(c => c.career >= catalogTotal) + 1;
    const payouts = curve.map(c => c.payout);
    const earlyPayout = payouts.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const latePayout = payouts.slice(-10).reduce((a, b) => a + b, 0) / 10;
    return {
      profile: profile.id, difficulty: profile.difficulty,
      firstRacePayout: payouts[0], earlyMeanPayout: Math.round(earlyPayout), lateMeanPayout: Math.round(latePayout),
      racesToFirstAddon: raceAffordingFirst || null,
      racesToCompetitiveBuild: racesToCompetitive || null,
      racesToWholeCatalog: racesToCatalog || `>${races}`,
      skillShare: +(income.skill / (income.skill + income.novelty)).toFixed(3),
      careerAfter: { 5: curve[4].career, 10: curve[9].career, 25: curve[24].career, [races]: curve[races - 1].career }
    };
  });
  return { races, catalogTotal, competitiveCost: rows[0] && shoppingList(), rows };
}

const out = report();
if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log('P1.2 reward pacing — modelled outcomes through the real economy rules\n');
console.log(`Whole catalogue (every add-on, both tuning levels, six builds, satin): ${out.catalogTotal} credits\n`);
const pad = (v, n) => String(v).padStart(n);
console.log('profile     diff  race1  early  late  →1st add-on  →build  →catalogue  skill share');
for (const r of out.rows) {
  console.log(`${r.profile.padEnd(11)} ${pad(r.difficulty, 4)} ${pad(r.firstRacePayout, 6)} ${pad(r.earlyMeanPayout, 6)} ${pad(r.lateMeanPayout, 5)} ${pad(r.racesToFirstAddon, 12)} ${pad(r.racesToCompetitiveBuild, 8)} ${pad(r.racesToWholeCatalog, 11)} ${pad(r.skillShare, 12)}`);
}
console.log('\nCareer credits by race:');
for (const r of out.rows) console.log(`  ${r.profile.padEnd(11)} ${JSON.stringify(r.careerAfter)}`);
