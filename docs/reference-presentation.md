# Reference game presentation review

## Starting point

Based on main `dd33ca5` (merged PRs #7, #8 and #9). The supplied ZIP is an older
snapshot with procedural karts; the HTML is its standalone build. Main already
ships twelve Blender GLBs, eight additive animation clips, distinct track splines,
weather, landmarks, pickups, abilities, touch recovery and measurement exports.
These are retained. No reconstruction review history or thresholds are changed.

The two supplied JPEGs were successfully opened: character selection and Cherry
chase gameplay. Their visible design is pale lavender/pink sky, cyan/white wide
lettering, translucent blue controls and luminous sculpted karts. The existing
Space Grotesk/Collective gold-and-teal chrome, dark title scrim and instantaneous
menu swaps did not follow that direction. The old attract sequence used stationary
showroom animation even while its karts moved down the road. The procedural PBR
factory was also bypassed when shipping GLBs were loaded.

## Changes

- Local Orbitron display and Rajdhani body/number typography; remove corporate
  title copy and interface color tokens. The game remains named ZenFlow Racer.
  Distinct division identities, saves and abilities retain their existing IDs.
- Cyan glass title actions, clearer selection panels, compact racing HUD and
  consistent pause/results presentation; safe-area/mobile rules retained.
- A real driving-rig attract sequence: wheel rotation, steering, suspension and
  driver poses use `animateKart`. Camera tracks the pack with portrait framing.
- Curtain transitions for title, character select, circuit changes, race entry,
  restart and roster return. State changes occur under cover; simulation and input
  are gated, duplicate actions rejected, with immediate reduced-motion cuts.
- Pause/results focus ownership and keyboard focus wrapping.
- Tune actual cloned GLB skin, pearl and rim materials without mutating shared
  templates; per-map hemisphere, key, rim and exposure balance is applied at boot
  as well as on map switches. No extra per-kart lights or rendering passes.
- Frame-rate-independent animation crossfades and staggered procedural motion
  across all twelve rigs. Existing authored eight-state animation data is retained.
- Fonts ship in the versioned offline shell with their licenses. Reference artwork
  remains excluded from the release; there are no reference image panels.

## Verification

`npm run verify` passes: race/input/lifecycle/telemetry regressions, transition
lifecycle, static build, offline shell, map resource disposal, all rig states and
all twelve actual shipping GLBs. Added checks cover cloned skin material changes
and immutable templates, transition commit order and duplicate input gating,
reduced-motion completion and offline font availability.

Browser review and deployment status are recorded below after inspection.

## Remaining limits

This is a presentation/material/animation pass, not a new geometry export. It does
not establish exact image reconstruction: character silhouettes and scenery are
still the inherited models, and the two supplied images depict four named racers
while the committed roster has twelve division identities. Existing likeness
rejections remain valid. Physical-device FPS and WebGL likeness require actual
GPU/device evidence; CSS viewport checks are not physical phone certification.
