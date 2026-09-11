# ZenFlow Racer — P0/P1 Finalization Execution Spec

**Repository:** `jrmoyler/Zenflow-Racer`  
**Baseline:** `main` after merged PR #23  
**Objective:** Finish ZenFlow Racer as a cohesive, replayable, mobile-ready racing game without regressing the existing gameplay, racers, powers, maps, PWA behavior, deployment flow, or current visual work.

---

## 0. Mission

This is a **finish-the-game pass**, not another broad rewrite.

The current build already has substantial systems in place:

- 3 playable circuits
- 20 playable divisions / racers
- 20 signature division powers
- 24 equippable add-on powers
- 6 standard race items
- drifting and drift boosts
- slipstream
- race tokens
- AI item/power/add-on use
- lap timing and results
- touch controls
- gamepad controls
- keyboard controls
- PWA/offline support
- Blender-authored kart/rider assets
- Three.js runtime
- Anime.js effects/UI motion
- physical race telemetry infrastructure
- regression coverage across gameplay, VFX, race flow, maps, rigs, and deployment

Do **not** replace functioning systems with placeholders.

Do **not** flatten the project into a simpler game.

Do **not** remove any current racer, map, ability, add-on, item, animation contract, visual system, telemetry system, or platform support unless a verified defect requires it.

The job is to complete the missing progression/economy loop, finish the racers/karts, improve track duration and racing identity, rebalance the game, certify mobile behavior, and complete final release polish.

---

# P0 — MUST COMPLETE BEFORE THE GAME IS CALLED FINISHED

---

## P0.1 Permanent Currency + Economy

### Problem

The current collectible race tokens are an **in-race mechanic**, not a permanent economy.

Current race tokens:

- start at `0`
- cap at `10`
- increase top speed
- can be lost when hit
- reset each race
- already affect gameplay balance

Do **not** convert these directly into the persistent wallet.

### Required Architecture

Keep two separate systems.

#### A. Race Tokens

Preserve the existing race-token behavior.

They must continue to:

- exist physically on the track
- cap at 10 held tokens
- increase race performance
- be losable through impacts where currently intended
- reset at the start of a new race

#### B. Persistent Currency

Create a permanent wallet system.

Working name may be:

- Zen Credits
- Flow Credits
- Race Credits

Pick one consistent name and use it everywhere.

Persistent currency must be stored in the existing save architecture and versioned safely.

### Reward Formula

Persistent race rewards should account for:

- finishing position
- difficulty
- total tokens collected during the race
- best lap / performance bonus
- clean-racing or low-hit bonus
- first-time achievements where appropriate
- map completion
- division diversity bonus if useful
- optional streak bonus if it does not become exploitative

Do not base rewards only on how many tokens the player still holds at the finish.

Track **total tokens collected during the race** separately from currently held tokens.

### Required Save State

Add persisted fields for at least:

```js
wallet
ownedAddons
addonUpgradeLevels
kartUpgrades
cosmetics
careerStats
rewardHistoryVersion
economyVersion
```

Migration must be backward-compatible with current saves.

Corrupt or partial save data must fail safely.

### Economy Guardrails

- No pay-to-win assumptions.
- No real-money monetization required.
- No random loot boxes.
- No progression that makes a veteran kart mathematically unbeatable by a skilled new player.
- Favor sidegrades and strategy over raw stat inflation.
- Currency must never be duplicated by reload, pause, crash, restart, or race-state bugs.

### Tests

Add automated tests for:

- wallet persistence
- reward calculation
- race restart exploits
- duplicate reward prevention
- save migration
- corrupted save recovery
- maximum/minimum reward boundaries

---

## P0.2 Garage / Store / Progression System

Create a first-class **Garage** experience.

### Required Entry Points

The player must be able to access Garage from:

- main/title flow
- character selection / loadout flow
- post-race results flow

### Garage Sections

At minimum:

1. **Add-Ons**
2. **Kart Upgrades**
3. **Appearance / Cosmetics**
4. **Owned / Locked inventory**
5. **Current wallet balance**

The garage should feel like part of the game, not an admin dashboard.

### UX Requirements

Every purchasable item must clearly show:

- name
- category
- cost
- owned / locked state
- current level
- next-level effect
- equipped state
- required prerequisite if applicable

No ambiguous buttons.

Examples:

- BUY
- OWNED
- EQUIP
- EQUIPPED
- UPGRADE
- MAX LEVEL

### Persistence

Purchases must persist across:

- reload
- browser restart
- PWA session
- map switch
- division switch

---

## P0.3 Convert Existing 24 Add-Ons into Unlockable / Ownable Content

The game already contains 24 add-ons.

Do **not** invent a new replacement add-on system.

Use the current add-on implementation.

### Required Progression

Each add-on should support:

- locked
- owned
- equipped
- optionally upgradeable

### Balance Philosophy

Use approximately:

- 80% horizontal progression
- 20% vertical progression

Do not make upgrades dramatically increase power.

Preferred upgrade dimensions:

- small cooldown reduction
- small duration increase
- small radius increase
- reliability/utility improvement
- visual mastery treatment
- alternate cosmetic treatment

Avoid:

- huge damage jumps
- huge speed jumps
- massive hit radius increases
- anything that invalidates lower-level players

### Suggested Upgrade Structure

Example:

- Level 1: unlock
- Level 2: minor utility improvement
- Level 3: minor cooldown or duration improvement
- Level 4: mastery visual effect
- Level 5: small final tuning benefit / prestige cosmetic

Every level must have a documented gameplay effect.

### Existing Controls Must Remain

Preserve current control bindings:

- keyboard
- touch
- gamepad

The add-on remains independent of:

- normal item slot
- division signature ability

---

## P0.4 Kart Upgrade / Build System

Add kart progression without destroying balance.

### Required Upgrade Categories

Use at least these categories:

- Tires
- Motor
- Aero
- Suspension
- Energy Core
- Armor

### Design Rule

Kart upgrades should primarily be **tradeoffs**, not pure increases.

Examples:

#### Tires
- more grip
- less drift rotation / slower drift charge

or

- lower grip
- faster drift charge / better slide behavior

#### Motor
- stronger acceleration
- slightly lower top speed

or

- higher top speed
- slower launch

#### Aero
- higher speed stability
- slightly reduced turning agility

#### Suspension
- stronger landing / collision stability
- reduced instant steering response

#### Energy Core
- slightly improved power cooldown
- slightly reduced item utility

#### Armor
- stronger collision resistance
- increased effective weight

### Visual Requirement

Whenever practical, upgrades should cause visible physical or material changes to the kart.

Do not make every upgrade invisible.

Examples:

- tire profile
- wheel style
- wing/aero piece
- exhaust
- suspension housing
- engine/energy housing
- body panels

### AI

AI racers must use legal builds from the same rules.

Do not give AI impossible hidden upgrade levels.

---

## P0.5 Increase Every Lap by ~15–20 Seconds

### Hard Requirement

Each circuit should gain approximately:

**+17 seconds per lap, target tolerance ±2 seconds**

for a competent human baseline.

### Critical Constraint

Do **not** accomplish this by simply reducing global kart speed.

Do not globally nerf:

- max speed
- acceleration
- drift boost
- slipstream
- token speed bonus

The extra duration must come primarily from **meaningful additional track geometry and racing decisions**.

### Cherry Blossom Skyway

Add meaningful race geometry such as:

- long flowing sweeper
- elevation change
- temple hairpin
- anti-gravity or skybridge section
- technically readable rejoin

Maintain Cherry as the elegant flow-focused circuit.

### Nexus Stormforge

Make this the most technical circuit.

Add:

- industrial S-curves
- turbine / machinery section
- elevation shift
- narrow high-risk line
- optional shortcut decision
- long acceleration exit

### Vital Canopy Run

Maintain this as the sweeping high-speed circuit.

Add:

- long cliffside sweeper
- canopy tunnel
- downhill sequence
- bridge / open-sea section
- fast rejoin

### Track Quality Requirements

The added track length must introduce:

- real corner variety
- risk/reward
- overtaking opportunities
- recognizable landmarks
- clean AI pathing
- collision-safe geometry

Do not pad duration with empty straights.

### Telemetry

Add / use telemetry to measure:

- average human lap time
- AI lap time
- fastest legal lap
- per-map added lap duration

Create repeatable timing evidence.

---

## P0.6 Finish Riders

The current riders are functional but not visually complete.

### Every Rider Must Have

- distinct silhouette
- distinct head / helmet / hair treatment
- distinct clothing / armor treatment
- distinct body proportions where appropriate
- distinct color blocking
- readable hands
- readable boots / lower body
- properly integrated torso
- cleaner shoulder/arm anatomy
- better seated posture
- visually believable steering pose

### Identity Test

Render every rider in neutral material / reduced-livery conditions.

A rider should still be distinguishable by:

- silhouette
- clothing shape
- head treatment
- proportions

Do not rely only on color changes.

### Animation States

Ensure every rider correctly supports:

- idle
- drive
- drift
- boost
- hit
- spinout
- victory
- defeat

### No Detached Look

Riders must no longer feel like mannequins placed onto karts.

---

## P0.7 Finish Karts

### Identity Requirement

Every division kart must remain visually distinguishable **even if all paint colors are temporarily replaced by neutral gray**.

### Vary

- nose profile
- front fairing
- wheel architecture
- cockpit
- side pods
- rear silhouette
- exhaust
- aero
- suspension treatment
- light signature
- body paneling
- material distribution

### Material Requirement

Clearly differentiate:

- painted metal
- bare metal
- carbon
- rubber
- cloth
- skin
- glass
- energy/emissive material
- matte plastics

No flat “same material with different color” look.

### Reference Fidelity

Use committed visual references as design targets.

Do not:

- billboard them
- paste them onto geometry
- embed them as fake panels
- substitute screenshots for playable assets

Actual playable geometry must be used.

---

## P0.8 Rider ↔ Kart Physical Integration

Improve the feeling that the rider is actually operating the vehicle.

### Required Behaviors

- hands track the steering wheel
- steering wheel rotates with steering input
- arms react naturally
- rider leans under lateral force
- torso compresses slightly under acceleration
- body moves forward under braking
- head anticipates turns
- rider reacts to collisions
- rider reacts to boost
- drift pose reflects counter-steering
- suspension/body motion is visually connected

### Preserve

Existing rig-node contracts.

Do not break:

- wheel nodes
- pilot nodes
- arm nodes
- head nodes
- steering-wheel node
- animation clip system
- ability anchor points

---

## P0.9 AI Rebalance

After track length and progression changes, rebalance all AI.

### Review

- corner approach
- braking
- drift timing
- shortcut choice
- token pursuit
- item usage
- signature power timing
- add-on timing
- defensive response
- rubberbanding
- collision behavior
- overtaking
- recovery

### Difficulty Levels

The current difficulty settings must remain meaningfully distinct.

Avoid:

- teleport-like rubberbanding
- impossible acceleration
- hidden speed multipliers that violate player rules
- perfect AI power timing

AI should feel intelligent, not fraudulent.

---

## P0.10 Post-Race Reward / Progression Ceremony

Replace the minimal race-end loop with a full reward sequence.

### Required Results Flow

Show:

1. finishing position
2. race time
3. best lap
4. gap to leader
5. tokens collected
6. credits earned
7. placement bonus
8. difficulty bonus
9. clean-race bonus if applicable
10. career progress
11. unlock progress
12. newly unlocked content
13. current wallet

### Required Actions

Results must include:

- Retry
- Next Circuit
- Garage
- Change Racer
- Main Menu

### Presentation

This should feel celebratory and game-like.

Use:

- race finish animation
- rider victory/defeat pose
- controlled Anime.js UI motion
- clear sound feedback
- progression count-up

Do not create excessive modal spam.

---

## P0.11 Full Visual QA Across All 20 Racers

The old 12-racer visual review is insufficient.

Create a new final QA set for all 20 playable divisions.

### For Each Racer

Render / capture:

- front
- rear
- left
- right
- 3/4 hero
- seated cockpit angle
- in-race chase angle
- drift state
- boost state
- victory state
- hit/spin state

### QA Checklist

Verify:

- no clipping
- no detached limbs
- hands aligned
- wheels aligned
- steering pivots correct
- no inverted normals
- no floating panels
- no missing material
- no duplicated rider parts
- no broken glow
- no broken shadow
- no bad LOD/pop
- no z-fighting
- no skin/cloth/material crossover
- no broken mobile fallback path

Create a final review document.

---

## P0.12 Physical Device Certification

This remains a genuine release requirement.

### Devices

At minimum test:

- modern iPhone / Safari
- modern Android / Chrome
- lower-end Android / Chrome

Target lower-end class similar to Galaxy A15.

### Run All Three Maps

Use:

- 12 racers
- 3 laps
- normal effects
- items
- drift
- powers
- add-ons
- collisions
- touch controls

### Test

- multi-touch
- simultaneous steering + drift + item + power
- touch cancellation
- portrait → landscape → portrait
- pause/resume
- background app for 30 sec and return
- mute/unmute
- restart
- next circuit loop
- PWA install
- offline launch after cache
- WebGL context recovery if practical
- sustained race completion

### Performance Targets

Modern devices:

- target near 60 FPS

Lower-end Android:

- stable 30 FPS minimum target

Do not fake certification with desktop responsive mode.

### Evidence

Commit:

- telemetry JSON
- device model
- OS
- browser version
- graphics mode
- screenshots / recordings
- notes
- deployed commit SHA

If a device fails, optimize and retest.

---

# P1 — RELEASE POLISH

Do not start P1 until P0 systems exist and work together.

---

## P1.1 Onboarding

Create a short first-time tutorial.

Teach:

- accelerate
- steering
- drift
- item
- signature power
- add-on
- race tokens
- permanent currency
- garage

Keep it brief.

Do not force a long tutorial every session.

Persist completion.

---

## P1.2 Reward Pacing

Tune:

- credit rewards
- add-on prices
- upgrade prices
- unlock cadence
- first-session progression
- midgame pacing
- mastery pacing

Goals:

- player should afford something meaningful early
- player should not unlock everything immediately
- grind should not feel punitive
- best rewards should still come from racing well

---

## P1.3 Difficulty Curve

Revisit all difficulty levels after economy/track changes.

Validate:

- early races
- upgraded builds
- all maps
- all racer archetypes

Difficulty should affect:

- AI decision quality
- racing consistency
- recovery
- power strategy

Do not rely only on raw stat boosts.

---

## P1.4 UI / UX Microinteractions

Polish:

- menu transitions
- card hover / press behavior
- controller focus
- touch feedback
- locked states
- purchase confirmation
- reward count-up
- garage equip feedback
- loadout changes
- settings
- pause
- results
- map transitions

No glassmorphism-heavy generic AI UI.

Keep the current game visual language cohesive.

---

## P1.5 Camera Feel

Tune race camera for:

- acceleration
- boost
- drift
- collisions
- airtime
- elevation
- tight corners

Avoid:

- excessive shake
- motion sickness
- unreadable cornering
- camera clipping

Offer reduced motion where appropriate.

---

## P1.6 Audio Mix

Final-pass:

- engine
- boost
- drift
- impacts
- items
- signature powers
- add-ons
- ambience
- UI
- crowd
- music

Ensure no effect dominates the mix.

Add ducking where useful.

Test mobile speakers and headphones.

---

## P1.7 VFX Consistency

Standardize:

- scale
- brightness
- hit readability
- duration
- opacity
- mobile low-FX behavior
- effect ownership
- hazard telegraph clarity

Gameplay-critical effects must remain visible before decorative particles.

---

## P1.8 Circuit Identity

Every circuit must have named memorable driving moments.

Examples:

### Cherry Blossom Skyway
- Sky Temple Hairpin
- Lantern Sweep
- Cloudfall Bridge

### Nexus Stormforge
- Turbine Chicane
- Foundry Drop
- Reactor Straight

### Vital Canopy Run
- Root Tunnel
- Sea Bridge
- Ancient Canopy Descent

Names are optional, but each circuit must have equivalent identifiable race moments.

---

## P1.9 Shortcuts / Risk-Reward Routes

Add at least one meaningful alternate line or shortcut per map if it can be done without compromising fairness.

Requirements:

- visible
- learnable
- risk/reward
- AI-aware
- collision-safe
- cannot bypass lap/checkpoint logic

---

## P1.10 Final Accessibility / Platform Pass

Verify:

- keyboard-only navigation
- touch
- gamepad
- visible focus
- readable contrast
- scalable UI
- reduced motion
- mute
- mobile safe areas
- orientation handling
- no text clipping
- no tiny controls
- no hover-only interactions

---

# DEVELOPMENT RULES

---

## Rule 1 — New Branch / New PR

Create a fresh branch from current `main`.

Do not modify main directly.

Use a clear name such as:

```text
finish/p0-p1-finalization
```

Open a new PR only after implementation and verification.

---

## Rule 2 — No Regressions

Preserve all current functionality unless explicitly replaced by the specification.

Before changing a system, inspect:

- existing tests
- existing docs
- existing PR history
- existing save behavior
- current runtime contracts

---

## Rule 3 — TDD for Critical Systems

Write or update tests before major implementation where practical.

Critical systems requiring regression tests:

- economy
- wallet
- purchases
- unlocks
- upgrades
- reward payout
- save migration
- lap logic
- extended tracks
- AI
- results
- mobile controls
- race restart
- race completion
- build/deploy

---

## Rule 4 — No Fake Visual Completion

Do not use:

- screenshot cards as geometry
- background image cheats
- billboard racers
- static image panels pretending to be 3D
- fake PBR
- hidden reference-image overlays

Visual references are targets only.

Playable runtime assets must remain real 3D.

---

## Rule 5 — Preserve Performance Budgets

Do not blindly increase:

- draw calls
- transparent layers
- particle counts
- texture resolution
- dynamic lights
- shadow casters
- object count

Use:

- instancing
- pooling
- shared geometry
- bounded effects
- distance culling
- quality tiers
- texture compression
- adaptive resolution

where appropriate.

---

## Rule 6 — Do Not “Solve” Mobile by Destroying Visual Quality

Use graceful scaling.

Priority order:

1. preserve gameplay readability
2. preserve kart/rider identity
3. preserve hazards
4. preserve key environmental landmarks
5. reduce decorative effects
6. reduce background density
7. reduce postprocessing
8. reduce resolution dynamically

Do not remove major gameplay visuals.

---

# IMPLEMENTATION ORDER

Use this sequence unless code dependencies require minor adjustment.

## Phase 1 — Economy Foundation

1. save migration
2. persistent wallet
3. reward model
4. anti-duplication reward state
5. tests

## Phase 2 — Garage

1. garage data model
2. owned inventory
3. add-on purchasing
4. kart upgrade purchasing
5. equip flow
6. tests

## Phase 3 — Progression

1. add-on levels
2. kart builds
3. AI legal builds
4. balance caps
5. tests

## Phase 4 — Circuit Extensions

1. Cherry
2. Stormforge
3. Canopy
4. lap timing telemetry
5. AI line validation
6. checkpoint validation

## Phase 5 — Rider / Kart Final Art

1. rider anatomy
2. rider identity
3. kart identity
4. materials
5. rider/kart integration
6. all-20 visual QA

## Phase 6 — Race-End Loop

1. reward settlement
2. progression ceremony
3. garage entry
4. unlock feedback
5. results actions

## Phase 7 — AI / Difficulty Balance

1. new track navigation
2. upgrades
3. item usage
4. power timing
5. rubberband tuning
6. difficulty tuning

## Phase 8 — Physical Device Certification

1. iPhone
2. modern Android
3. lower-end Android
4. fixes
5. repeat failed tests

## Phase 9 — P1 Polish

1. onboarding
2. reward pacing
3. camera
4. audio
5. VFX
6. UX
7. accessibility
8. circuit landmarks/shortcuts

---

# ACCEPTANCE CRITERIA

The PR must not be considered finished until all of the following are true.

## Gameplay

- all 3 maps playable
- all 20 racers playable
- all 20 signature powers work
- all 24 add-ons work
- all 6 normal items work
- economy does not break race-token behavior
- permanent currency persists
- garage works
- add-ons can be bought/equipped
- kart upgrades can be bought/equipped
- upgrades remain balanced
- AI uses legal builds
- all maps are approximately 15–20 seconds longer per lap
- no lap/checkpoint exploits introduced

## Visuals

- every kart is recognizable without relying only on color
- every rider is visually distinct
- no detached riders
- steering/body animation is connected
- PBR materials read correctly
- no billboard/screenshot shortcuts
- all 20 racers pass visual QA

## UX

- garage accessible from all intended flows
- reward settlement is clear
- unlocks are understandable
- controls remain consistent
- touch UI remains usable
- controller navigation remains usable
- onboarding works once and persists

## Performance

- modern iPhone test completed
- modern Android test completed
- lower-end Android test completed
- stable target FPS achieved or documented with justified fallback quality
- no runaway entity/VFX growth
- no new memory leak
- no WebGL context regression
- no PWA/offline regression

## Verification

Run the full existing verification pipeline plus all new tests.

At minimum:

```bash
npm ci
npm test
npm run build
npm run test:release
npm run verify
git diff --check
```

Also run any Blender/art verification scripts touched by the work.

Do not claim success if a required verification command fails.

---

# FINAL PR EVIDENCE

The PR description must include:

## Summary

- P0 work completed
- P1 work completed
- known limitations if any

## Economy

- reward formula
- example race payout
- upgrade price table
- save migration description

## Track Timing

Before/after representative lap timing for:

- Cherry Blossom Skyway
- Nexus Stormforge
- Vital Canopy Run

## Visual Evidence

- all-20 racer lineup
- representative kart closeups
- rider steering/drift/boost views
- garage screenshots
- reward ceremony screenshots

## Performance Evidence

For every physical test device:

- exact device
- OS
- browser
- deployed SHA
- graphics mode
- average FPS
- p95 frame time
- loading time
- issues observed
- whether the run completed successfully

## Test Evidence

Include:

- full verification command output summary
- new tests added
- regression count
- failed tests, if any
- final commit SHA

---

# DEFINITION OF DONE

ZenFlow Racer is done when a player can:

1. launch the game
2. understand the controls
3. select one of 20 racers
4. equip an owned add-on
5. configure a kart build
6. select one of 3 complete circuits
7. race a full field
8. collect race tokens
9. use items
10. use signature abilities
11. use add-ons
12. drift and draft
13. finish the race
14. receive permanent rewards
15. unlock or upgrade meaningful content
16. enter the Garage
17. change their build
18. start another race because progression gives them a reason to do so

The game should feel like one coherent finished product rather than a collection of individually completed systems.

Do not stop at “technically works.”

Finish the loop, verify the loop, balance the loop, certify the loop, and present evidence that the final deployed game is ready.
