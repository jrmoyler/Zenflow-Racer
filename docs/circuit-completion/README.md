# Circuit completion and race physics

Based on main 369bac5 (merged crowd / racer presentation PR #21). Cherry Blossom geometry, all twenty drivers and karts, signatures and 24 add-ons are preserved.

## Changes

- Stormforge: 32 supported machine yards with pressure vessels, pipework, deck rails, braced maintenance hoists and service equipment beside the road.
- Canopy: 32 terraced orchards with retaining walls, soil beds, pergolas and roadside planters. Added foliage uses three reusable geometries / instanced batches. Existing shared wind animation drives these plants.
- Geometry is playable world scenery using existing PBR materials and shadows; no reference images are substituted for 3D. Existing water, sky, animated crowds, terrain and Blender stone assets remain active.
- Kart contact transfers momentum only when closing. Equal-speed overlap no longer injects speed every tick. Mass and anchored abilities affect separation; track bounds are enforced.
- Race progress uses the forward component of velocity. Track incline and banking affect motion; anti-gravity cancels gravity, and the countdown grid remains stationary.
- Removed the update button and its styles. Cached releases apply automatically at a visible title/roster menu outside transitions. Race, countdown, pause, finish and results are protected, including a race started while activation is settling. Powers remain built in without an upgrade gate.

## Validation

- 116 gameplay regressions pass, including seven new physics cases.
- Automatic-update behavior is exercised with the actual PWA script.
- All three maps construct with finite geometry in desktop and mobile modes; terrain seals, water, crowds and map switching pass.
- All twenty playable GLBs, rigs, animation contracts and disposal pass.
- Production build and offline release-shell checks pass.

Browser access to the local preview was blocked by the browser environment (ERR_BLOCKED_BY_CLIENT). No new visual-match or physical-device performance claim is made. Runtime geometry validation is not a screenshot review.
