# Dense worlds and guided race setup

Based on merged main at cc7dd763633b10cbc8e0f2ba846cf453d58ae607 (PR #14).

Home now has Start, settings and keyboard/touch/gamepad instructions. Start opens character selection; confirming the racer opens circuit selection. An explicit circuit click, including the saved/default circuit, enables Enter race. Back navigation clears confirmations. The race entry function independently rejects incomplete initial setup. Rematches and paused restarts preserve the already chosen race.

| Circuit | Added desktop districts | Venue spectators | Lamps | Instanced venue batches |
|---|---:|---:|---:|---:|
| Cherry Blossom Skyway | 21 festival courts | 650 | 76 | 10 |
| Nexus Stormforge | 24 foundry service decks | 677 | 98 | 10 |
| Vital Canopy Run | 24 botanical promenades | 665 | 96 | 10 |

Mobile quality uses 16 districts per map and reduced grandstand crowds. Shared geometry/material batches preserve the existing venue draw-call budget. This is a geometry budget check, not a physical-device frame-rate measurement.

Validation: full `npm run verify`; subsequent updated `npm test`, production build and release/offline tests. Menu handler coverage additionally exercises default-map selection, back navigation, title return and stale confirmation clearing. Scenery checks sample the road against full building envelopes on all three tracks, verify finite instance matrices, bound mobile density and verify GPU resource disposal on map changes.

Removed unused cypress, trunk, lamp and pillar generators and the title's direct-race shortcut. Preserved reconstruction references, review history and export tools.

Browser visual review was blocked: the browser could not access localhost, and Vercel preview authentication required access that automatic approval review rejected without explicit user authorization. No browser or physical-mobile visual/performance pass is claimed. Vercel reported a successful deployment for the initial PR commit.
