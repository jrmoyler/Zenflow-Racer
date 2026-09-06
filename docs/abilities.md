# Division abilities

Use Q, gamepad Y, or the on-screen SPECIAL button. Each ability starts ready; cooldowns advance only during active simulation. AI racers use the same powers and cooldowns, with a randomized decision timer that fires only when the power's condition is met (defensive powers when threatened, offensive ones with a rival in range). Item use remains E / gamepad X.

| Division ID | Power | Cooldown | Gameplay |
|---|---|---:|---|
| zenflow | TIME DILATION | 19s | A 4-second field slows nearby rivals while you keep your momentum. |
| collective | SHARED FORTUNE | 17s | Siphon one token from up to three nearby rivals into your reserve. |
| hybrid | PHASE WALK | 20s | Become intangible for 3.5 seconds. Pass through karts, mines and missiles. |
| nexus | HOLOGRAM DECOY | 17s | Leave an 8-second hologram that intercepts hostile missiles in its lane. |
| kinetic | IMPACT DRIVE | 20s | Charge your chassis for 4 seconds. Contact spins rivals out. |
| juris | VERDICT MIRROR | 18s | For 4 seconds, reflect the next hostile hit back to its owner. |
| signal | SONIC LANCE | 16s | Fire a narrow sonic strike at the closest rival ahead, within 70 metres. |
| loom | THREAD SNARE | 18s | Lay a 5-second ribbon behind you that slows rivals crossing its lane. |
| vector | SIDE STEP | 12s | Blink into the adjacent lane with half a second of collision immunity. |
| aether | ORBITAL MAGNET | 20s | Pull available tokens from across the track within 24 metres for 5 seconds. |
| animus | SENTINEL DRONE | 23s | A 4-second escort fires up to three short-range pulses at rivals ahead. |
| helix | REGENESIS | 18s | Clear spin and slowing effects, recover lost tokens, and resist slows for 5 seconds. |

Phase blocks kart contact and damage without consuming projectiles. Shields block one attack. Verdict reflects one hit and consumes itself; reflected hits cannot recursively reflect. Regenesis blocks slowing, but does not prevent direct damage. Finished racers cannot activate powers or receive attacks. All temporary zones reset on rematch/menu. Effects are capped at 24 desktop / 12 mobile emitters. Shared immutable geometry, analytic ribbon shaders, and capped instanced particles keep lifetimes bounded; expired materials are disposed without destroying shared vehicle or effect geometry.

The selection preview and portraits render the same buildKart division geometry as the race in an isolated lit scene. The Canvas fallback provides an equivalent preview when WebGL is unavailable.

## Visual signatures

| Division | Distinct effect |
|---|---|
| ZenFlow | Scanning temporal dome and suspended clock fragments |
| The Collective | Contracting fortune stream with converging gold shards |
| Hybrid Living | Actual kart ghost with Fresnel edges and spectral veil |
| Nexus Labs | Human hologram silhouette, animated scanlines and projection sheet |
| Kinetic Edge | Three tapered, turbulent flame tongues behind the chassis |
| Juris Guard | Six independently floating reflective shield facets |
| Signal Velocity | Tapered sonic wavefront lance extending down-track |
| Binary Loom | Three braided, animated ribbon trails |
| Vector Shift | Two split portal crescents across adjacent lanes |
| Aether Link | Spiralling token streaks and orbit trails |
| Animus Prime | Sculpted sentinel drone, ribbon wings and orbiting motes |
| Vital Helix | Double-helix strands with rising instanced healing petals |

VFX architecture follows techniques inspected in the user-owned Zukan Arena `src/game/render/ElementalVfx.ts`: shader-driven ribbons, instanced analytic particles, quality caps, reduced-motion scaling, and deterministic cleanup. Shader/geometry code here is adapted for racing and each division rather than importing its game entrypoint.
