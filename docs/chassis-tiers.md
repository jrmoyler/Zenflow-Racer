# Chassis tiers

Every division now has three chassis:

| Tier | Name | Model | How to get it |
|---|---|---|---|
| I | Factory | `assets/models/<id>.glb` (Blender-authored rig) | Always available |
| II | Nightfall Spec | `assets/models/tiers/<id>-dark.glb` | 650 Zen Credits in the Garage |
| III | Apex Pearl | `assets/models/tiers/<id>-final.glb` | Own Nightfall on that racer, reach a career of 8 finished races and 2 wins, then pay 1,400 Zen Credits |

Buy and equip tiers from the **Chassis** tab, which is the first tab in the Garage. The character-select
showroom labels the equipped tier under the racer name. The results screen shows the next tier
and what is still missing. Rivals race the factory chassis. Tiers are only visual: handling still comes
from the division stats and the Kart Upgrades build.

## Visual targets

- `references/visual-targets/tiers/dark/` holds the 20 Nightfall reference images and their `REPLICATE.md`.
- `references/visual-targets/tiers/final/` holds the 20 Apex Pearl reference images and their `REPLICATE.md`.
- The Tier I reference renders are `docs/p0-finalization/racers/*.png`. They are byte-identical
  to the "current 20 racers" pack, so Tier I needed no change.

In the Nightfall pack, Signal Velocity and Vector Shift show the pilot standing beside the kart.
Both `REPLICATE.md` files say to seat every pilot in-game, so those two targets were edited to
seat the same pilot in the cockpit, with the coachwork unchanged. The files are `07-signal.jpg`
and `09-vector.jpg`. The untouched originals are kept as `*-original-standing.jpg`.

## Pipeline

1. **Image to 3D.** Each reference image went through Tripo H3.1 image-to-3D on Higgsfield, with a
   40k face limit and PBR textures. The output is one textured, fused mesh per image.
2. **Fit** (`tools/fit-scan-kart.py`, driven over all 40 by `tools/fit-scan-karts.py`):
   - orients the scan to the runtime frame: Y up, nose at −Z, length 4.5 m, ground at y = 0;
   - finds each tyre from its outer sidewall disc and tread ring, then splits the tyre, rim and hub
     into a `wheel-fl/fr/rl/rr` mesh built around its own axle so the shared spin, steer and fold
     animation drives it. A piece that overlaps the tyre cylinder stays on the chassis unless it
     wraps the axle and sits inside the tyre radius, which keeps fenders on the chassis;
   - strips metalness from bright, unsaturated texels, because the scans marked pearl paint as metal
     and it rendered as chrome;
   - derives an emissive map from texels near the division accent hue, so lamps, rim lights and
     inlays glow where the reference glows;
   - re-encodes textures as JPEG (1024 colour/normal, 512 ORM) and writes a compact GLB of about
     1.3 MB with the `zf_root`, `zf_id`, `zf_tier` and `zf_size` extras.
3. **Runtime** (`createTierKart` in `kart-assets.js`) builds the standard rig around the fitted
   chassis: `body`, `pilot`, `head`, arms, `steering-wheel`, wheel pivots with `spin`, the light
   ring, exhausts, underbody ring, shield, halo and star. All existing animation, FX, abilities
   and cleanup code therefore works unchanged. Tier models load on demand (`loadKartTier`).
   Equipped tiers preload at boot. The release service worker leaves them out of the install
   precache and caches each one on first use.

`tools/scan-karts.json` holds the accent colour for each division and the per-model overrides.
`docs/chassis-tiers/fit-report.json` records what the fit measured: orientation, size, and each
wheel's centre, radius, width and triangle count.

## Known limits

- **The pilot is part of the sculpted body.** Tier II and III pilots move with the sprung body
  (roll, pitch, heave, spin-out), but their arms and heads do not animate separately. The factory
  karts still have the fully articulated pilot.
- **Nine Nightfall chassis have static wheels.** Collective, Eon, Juris, Cognara, Civic, Obsidian,
  Nomad, Signal and Vector have tyres fused to enclosing fenders, so splitting the tyre would drag
  bodywork around with it. Their wheels steer and fold with the pivot but do not spin. All 20 Apex
  Pearl chassis and the other 11 Nightfall chassis have spinning wheels.
- **Fidelity comes from image-to-3D reconstruction.** Silhouettes, colour, livery and lights follow
  each reference closely. The back and underside of each kart are the model's inference, because
  every reference shows a single three-quarter view.
- **Garage bolt-ons are hidden on tier chassis.** The Kart Upgrades build (tyres, motor, wing and so
  on) still changes handling, but no hardware is attached to a finished Tier II or III body.

## Evidence

- `docs/chassis-tiers/{dark,final}-review-*.jpg` show, for every model: the reference, a WebGL
  three-quarter render, a top view that checks orientation, and a side view with the split wheels
  tinted.
- `title-webgl.jpg`, `garage-apex-webgl.jpg` and `grid-apex-webgl.jpg` are real WebGL captures of
  the shipped game (ANGLE/SwiftShader) with an Apex Pearl chassis equipped.
- `tests/chassis-tiers.cjs` checks all 40 GLBs against the contract (nodes, envelope, wheel axles,
  triangle and size budgets) and covers the tier economy rules.
