# P1 — release polish

Baseline: `main` at `ff03dee` (merged PR #25). All ten P1 items in
`docs/p0-finalization/spec.md` are implemented here. Everything below is either code in
this branch or a number produced by a tool in this branch — reproduce any of it with the
commands listed at the end.

The P0 gates that remain open are unchanged by this work and are still open. They are
listed in **Still open** at the bottom, and nothing here should be read as closing them.

---

## P1.1 Onboarding — `onboarding.js`, `tests/onboarding.cjs`

A first-race coach rather than a separate tutorial mode. Nine steps, in the order P1.1
lists them: accelerate, steer, drift, item, signature power, add-on, race tokens, Zen
Credits, Garage. Each step waits for the thing it teaches to actually happen in the real
race — speed above 14, a charged drift, an item actually fired — and each one also has a
patience of 6–22 seconds after which it moves on by itself, so a player who ignores the
coach is never held up by it.

- The last two steps wait for the results screen, where credits and the Garage exist. A
  step parked on that wait does not burn its patience while the race is still running.
- With no add-on equipped there is nothing to press, so that step reports itself as not
  applicable instead of stalling.
- Keyboard, touch and gamepad bindings are all named, and the panel shows the set that
  matches how the player is currently playing.
- Completion and an explicit skip are both persisted in the existing save
  (`saved.tutorial`, versioned). It runs once. **Race settings → Replay tutorial** clears
  the record for anyone who wants it back.
- The panel is a `role="status"` aside, never a modal, so it cannot trap focus mid-race.

`onboardingAdvance` is a pure function, and the test drives both it and the real DOM panel
through jsdom: every subject covered once, every control scheme named, the patience and
phase rules, persistence, and the skip path.

## P1.2 Reward pacing — `economy.js`, `tools/p1-progression-pacing.cjs`

The measurement came first. `tools/p1-progression-pacing.cjs` runs three authored player
profiles through the **real** `Economy` rules for 60 races and reports what P1.2 actually
asks about: time to a first meaningful purchase, time to a competitive build, time to the
whole catalogue, and how much of the income came from racing well versus from one-off
novelty bonuses.

The profiles are authored assumptions about finishing positions, tokens kept and hits
taken. They are a model of outcomes, not measured human play, and the tool says so.

That first run showed three of the four goals already met and one clearly missed. A
weaker player's income *collapsed* once the first-map and first-racer bonuses were spent —
mean payout fell from 166 to 69 credits per race, a 58% drop, while a strong player fell
only 24%. The player who needed the most support lost the most income.

Two changes, both flat and both placement-independent, fix that without touching the skill
ladder:

| Component | Before | After |
|---|---|---|
| Race completed | — | **20**, paid to every finisher |
| Damage control (was "clean race") | 25 / 10 / 0 | **25 / 12 / 6 / 0** at 0, 1–2, 3–4, 5+ hits |

Maximum configured payout moves from 423 to **443**; a last-place, no-token, three-hit
finish moves from 25 to **51**.

After the change (`pacing.txt` is the committed run):

| profile | race 1 | early mean | late mean | races to 1st add-on | to a competitive build | to whole catalogue | skill share |
|---|---:|---:|---:|---:|---:|---:|---:|
| novice (Simulation) | 173 | 188 | 93 | 2 | 7 | >60 | 0.914 |
| improving (Standard) | 225 | 250 | 169 | 1 | 5 | >60 | 0.949 |
| strong (Overseer) | 310 | 290 | 223 | 1 | 4 | >60 | 0.967 |

Against the four stated goals: something meaningful is affordable after one or two races;
the whole catalogue (21,140 credits) is well beyond 60 races; the novice's late-game
income is up 35% and the gap to a strong player narrowed from 0.34× to 0.42×; and
91–97% of all income still comes from placement, difficulty, tokens, personal bests and
damage control rather than from novelty bonuses. No streaks, no loot boxes, no paid
currency.

## P1.3 Difficulty curve — `game.js`, `abilities.js`, `addons.js`, `tools/p1-difficulty-curve.cjs`

Difficulty must change decision quality, consistency and recovery, never raw stats. Two
things it did not previously change have been added, both as decisions:

- **Recovery.** A Simulation field dithers for 1.1s before getting back on the throttle
  after a spin; Standard 0.5s; an Overseer field is straight back to work. Steering
  authority while a long way off line is also scaled (0 / 0.18 / 0.36). Speed,
  acceleration and grip are untouched.
- **Power and item strategy.** How often a rival re-evaluates its signature power, its
  add-on and its held item now scales with difficulty (×1.5 / ×1 / ×0.7 review cadence,
  ×1.6 / ×1 / ×0.7 item reaction), as does the point at which an unused power is spent
  opportunistically (22 / 14 / 9 seconds). Cooldowns, effects and targeting rules are
  identical at every level.

`npm run test:difficulty` measures the result on the shipping AI and **fails** if pace or
recovery is not ordered by difficulty, or if top speed, acceleration, handling or the
catch-up multiplier differ between levels:

| circuit | difficulty | mean lap | best lap | metres lost after an identical spin |
|---|---:|---:|---:|---:|
| Cherry | 0 / 1 / 2 | 50.302 / 48.714 / 47.731 | 50.065 / 48.468 / 47.479 | 105.42 / 80.44 / 59.45 |
| Stormforge | 0 / 1 / 2 | 53.516 / 50.325 / 48.783 | 53.271 / 50.067 / 48.525 | 97.21 / 74.50 / 55.80 |
| Canopy | 0 / 1 / 2 | 51.466 / 48.926 / 47.521 | 51.225 / 48.668 / 47.266 | 98.07 / 78.88 / 59.46 |

Recovery is measured against an unperturbed twin: two identical karts run the same opening
stint, one is given an identical spin, and the deficit it still carries eight seconds later
is the number above. Raw data: `docs/p0-finalization/difficulty-curve.json`.

`npm run test:balance` still completes all 108 racer runs across three maps and three
difficulties after these changes.

## P1.4 UI / UX microinteractions — `garage.js`, `polish.css`, `garage.css`, `presentation.css`

- **Locked states say what is missing.** A Garage card you cannot afford now carries
  `Locked · N more Zen Credits needed` instead of only a greyed-out button, and the note
  disappears the moment it becomes affordable.
- **Purchases confirm themselves.** Buying reports `<item> · bought for <price> · <balance>
  Zen Credits left`; equipping reports what it equipped. A transaction in flight shows
  `saving…` on the status line and `Saving…` on the button rather than going quiet.
- **Press feedback** on every button, map card and racer card, and a `cursor:progress`
  busy state. Reduced motion already removes the transitions; the pressed state stays,
  because it is feedback rather than decoration.
- Card state is exposed as `data-state` so equipped, owned and locked cards read
  differently at a glance, and each button carries `aria-pressed`.
- Hover emphasis is now mirrored on keyboard focus everywhere (see P1.10).

Existing behaviour that already met the bar and was left alone: reward count-up on the
results screen, controller focus retention through Garage transactions, scene-cut menu
transitions, and touch feedback on the race controls.

## P1.5 Camera feel — `game.js`

- **Reduced motion is honoured by the camera.** One factor (`cameraComfort.motion`)
  scales impact shake, chassis roll, the drift lean and the field-of-view swing. A player
  who asked for reduced motion keeps everything informative — the camera still follows at
  the same distance and still looks as far through the corner — and loses the vestibular
  noise. The media query is watched, so toggling it applies immediately.
- **Airtime.** The rig eases back, up and further ahead over a jump so the landing and the
  road beyond it stay in frame, and eases back in on touchdown rather than snapping.
- **No camera clipping.** The chase position is held at least 1.05 m above the road
  surface it is following, which is what stopped it sinking through the deck on crests and
  steep banking.
- **Shake has a hard ceiling** (0.5 m) independent of how much trauma accumulates.

Covered by two cases in `tests/game-regression.cjs`.

## P1.6 Audio mix — `vehicles.js`, `tests/audio-mix.cjs`

The graph now has four named buses under the master, and one table owns their levels:

| bus | level | what is on it |
|---|---:|---|
| sfx | 1.00 | impacts, boosts, items, powers, pickups |
| engine | 0.82 | the engine oscillators |
| ambience | 0.72 | drift texture, wind, the crowd bed |
| ui | 0.50 | menu sound |
| master | 0.42 | feeds a limiter, then the output |

Nothing bypasses its bus. **Ducking** pulls the two continuous buses down under a
momentary one and restores them exactly — an impact to 55% for 0.45s, a boost to 70%, a
power to 60%, the finish fanfare to 60% — so a hit or a boost still reads over a
full-throttle engine at top speed. Background texture never ducks.

The test drives the real graph against a Web Audio stub and checks routing, relative
levels, the limiter, every ducking envelope, and that pausing or backgrounding silences
the game. **Listening on real phone speakers and headphones is a human check this does not
replace.**

## P1.7 VFX consistency — `racefx.js`

One frozen table now classifies every effect family by role, paint order and power budget,
and the code reads that table rather than magic numbers:

- `critical` — boost flames, shock rings, shield shells, flash strips, speed lines
- `readable` — skid marks, drift ribbons, impact shards
- `decorative` — smoke/dust, confetti, glints

This fixed a real readability bug: confetti and glints were painted at render order 11 and
12, *on top of* the shock rings, shield shells and flash strips at 7–9. Decorative
families now occupy orders 3–5 and every critical family paints over them.

On the reduced-effects path every critical family keeps its whole budget and only
decorative and readable families give way. The regression test asserts all of it, including
that the built scene really carries the paint orders the table declares.

## P1.8 Circuit identity — `circuit-extensions.js`, `game.js`

Each circuit already had three authored moments built from real geometry. They now name
themselves as the player reaches them, in their own quiet HUD lane
(`#landmark`) rather than the toast lane, so naming a corner can never displace an item
call-out or a lap split. A name is suppressed while it is still showing, and the crossing
test handles the lap wrap.

| Cherry Blossom Skyway | Nexus Stormforge | Vital Canopy Run |
|---|---|---|
| Lantern Sweep | Turbine Chicane | Cliffside Sweep |
| Sky Temple Hairpin | Foundry Drop | Canopy Descent |
| Cloudfall Bridge | Reactor Exit | Sea Bridge |

## P1.9 Alternate lines — `circuit-extensions.js`

The marked inside line that previously existed only on Stormforge is now a per-circuit
definition, and all three circuits have one:

| circuit | line | between extension controls |
|---|---|---|
| Cherry Blossom Skyway | Temple Inside Line | 4 → 6 |
| Nexus Stormforge | Turbine Service Apex | 4 → 6 |
| Vital Canopy Run | Root Cut Line | 4 → 6 |

Each one meets the P1.9 requirements the same way the original did: **visible** (gold dashes
painted on the real road frame, only where the road actually bends), **learnable** (a
player-entry cue naming the line and its trade-off), **risk/reward** (a shorter inner radius
saves distance, with less room near the wall — no speed, acceleration or boost bonus),
**AI-aware** (Overseer and positively-offset Standard rivals take it; hazards and slower
traffic still override), **collision-safe** (it is an apex on the existing full-width deck,
not a branch), and it **cannot bypass lap or checkpoint logic** — both lines pass the same
ordered gates, progress per physical step stays bounded to 0.82–1.18, and
`checkpointBypass` is asserted false on every circuit.

## P1.10 Accessibility / platform — `tools/p1-accessibility-audit.cjs`

A real-browser audit over six device profiles × up to seven screens (title, race settings,
character select, circuit select, Garage, add-on loadout, first-run coach) — **30 audited
combinations** — measuring keyboard reach, visible focus, WCAG AA text contrast against the
composited backdrop, 200% text scaling, horizontal overflow, 44px touch targets, safe-area
insets, both orientations, text clipping, hover-only affordances, mute state reporting, and
whether reduced motion actually reaches the camera.

**Final result: 0 findings and 0 console errors across all 30.** Full data in
`accessibility-report.json`, with a screenshot per profile and screen.

Getting there took two rounds, and both are worth recording.

**Round one — the title screen, six profiles.** One class of defect, 48 instances:
interactive elements had `:hover` emphasis with no `:focus-visible` equivalent, so a
keyboard user got an outline but not the same emphasis on buttons, map cards, the preview
navigation, the menu tools and the loadout launcher. Fixed across `polish.css`,
`presentation.css` and `addon-ui.css`.

**Round two — every screen, not just the title.** 85 raw findings. Four of them were real:

| Defect | Measured | Fix |
|---|---|---|
| Pause-panel key hints unreadable | 3.57:1 against a 4.5:1 requirement | Two stale dark-chip overrides in `polish.css` beat the current light-panel treatment on specificity, leaving near-white text on a translucent chip over paper. They now match the panel. The settings hint chips had the same defect, unseen only because that disclosure starts collapsed. |
| The coach's Skip button unreadable | 1.25:1 — `rgb(25,32,43)` on `rgb(40,49,62)` | It was relying on a `.btn.ghost` cascade that resolved to dark-on-dark. It now carries an explicit light chip scoped to the panel. |
| The coach's Skip button too small to tap | 88×36px on a 360×640 Android | Raised to a 44px minimum at every size, including short landscape. |
| Equipped add-on choices | hover emphasis, no focus equivalent | Mirrored onto `:focus-visible`. |

The remaining 81 were the audit measuring the wrong thing. Each check was corrected rather
than the game, because in each case the game was already right:

- Elements behind an open modal dialog, and the race HUD the menus hold `inert` on purpose,
  were counted as unreachable controls. Both are correct browser and product behaviour.
- `:focus-visible` follows the browser's input modality, and the audit reaches each screen
  by *clicking*, which left Chromium in pointer modality and hid the very indicator being
  measured. It now switches to keyboard modality before measuring.
- Mute was being exercised on screens where it is deliberately inert or hidden.
- Overflow was reported as clipping even where the box does not clip and the text is fully
  readable, and inline boxes report `clientWidth` 0 by definition so they always looked
  overflowed.

The audit also drives a real race to reach the coach panel (it parks itself anywhere else),
and records a screen it cannot open as a finding instead of ending the run.

**Not claimed:** screen-reader output on real assistive technology, and anything requiring
a physical device.

---

## Reproducing all of it

```
npm ci
npm test            # includes tests/onboarding.cjs and tests/audio-mix.cjs
npm run verify      # test + build + release shell + runtime + assets
npm run test:pacing
npm run test:difficulty
npm run test:balance
node tools/p1-accessibility-audit.cjs   # needs Playwright + Chromium
node tools/p0-webgl-qa.cjs              # needs Playwright + Chromium
```

## Still open

P1 does not close any of these. They are the same P0 gates listed in
`docs/p0-finalization/README.md`:

- Competent-human before/after lap timing and fastest legal laps.
- Human art-direction sign-off on riders and karts.
- Physical iPhone/Safari, Android/Chrome and lower-end Android/Chrome certification
  (P0.12), including frame rates. No physical device was connected to this session, and
  software rasterisation says nothing about phone performance.
- Human listening checks on phone speakers and headphones for the P1.6 mix.
- Human driving validation of the risk/reward on each alternate line.
