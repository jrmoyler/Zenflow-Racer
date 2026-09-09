# Division abilities

Use Q, gamepad Y, or the on-screen SPECIAL button. Each ability starts ready; cooldowns advance only during active simulation. AI racers use the same powers and cooldowns, with a randomized decision timer that fires only when the power's condition is met (defensive powers when threatened, offensive ones with a rival in range). Item use remains E / gamepad X. Equip an additional power on the character selection screen, then cast it with F, gamepad left-stick click, or ADD-ON. Add-ons have their own cooldown and do not replace the division power or item slot.

| Division ID | Power | Cooldown | Gameplay |
|---|---|---:|---|
| zenflow | TIME DILATION | 19s | A 4-second field slows nearby rivals while you keep your momentum. |
| collective | SHARED FORTUNE | 17s | Siphon one token from the nearest three eligible rivals within 35 metres, up to ten tokens. |
| hybrid | PHASE WALK | 20s | Become intangible for 3.5 seconds. Pass through karts, mines and missiles; phased racers cannot collect pickups. |
| nexus | HOLOGRAM DECOY | 17s | Leave an 8-second hologram that intercepts hostile missiles in its lane. |
| kinetic | IMPACT DRIVE | 20s | Charge your chassis for 4 seconds. Contact spins rivals out. |
| juris | VERDICT MIRROR | 18s | For 4 seconds, reflect the next hostile hit back to its owner. |
| signal | SONIC LANCE | 16s | Fire a narrow sonic strike at the closest rival ahead, within 70 metres. |
| loom | THREAD SNARE | 18s | Lay a 5-second ribbon behind you that slows rivals crossing its lane. |
| vector | SIDE STEP | 12s | Blink four metres toward the emptier adjacent lane with half a second of collision immunity. |
| aether | ORBITAL MAGNET | 20s | Pull available tokens from across the track within 24 metres for 5 seconds. |
| animus | SENTINEL DRONE | 23s | An escort pulses at 0, 1.5 and 3 seconds, slowing the nearest rival ahead within 32 metres and six lateral metres. |
| helix | REGENESIS | 18s | Clear spin and slowing effects, recover lost tokens, and resist slows for 5 seconds. |
| ledger | VAULT LOCK | 18s | A 4-second field freezes rivals’ token gains and item use within 16 metres. Existing tokens stay protected from theft. |
| terra | ANCHOR SPAN | 19s | Become an immovable span for 3.5 seconds. Bumps no longer shove you; momentum stays near your speed at activation. |
| obsidian | HARD PERIMETER | 18s | A 4-second shield blocks one hit; its perimeter also shoves and slows touching rivals. |
| civic | SHARED LANE | 17s | For 5 seconds the nearest unfinished racer within 14 metres and four lateral metres inherits your slipstream. |
| cognara | PREDICTIVE LINE | 16s | A 4-second racing line. Steering responds 35% faster and corner scrub drops 30%. |
| gaia | ROOT NET | 18s | Lay a 5-second root ribbon that slows crossings and reduces your edge speed penalty by 65%. |
| nomad | WAYPOINT HOP | 13s | Blink six metres forward with 0.6 seconds of collision immunity. Distance and lap crossings remain accurate. |
| eon | SECOND WIND | 18s | Cleanse spin and slow, resist slows for 5 seconds, and surge. Lost tokens stay lost. |

Phase blocks kart contact and damage without consuming projectiles. Ordinary Aegis shields block one hostile hit, slow or token theft. Hard Perimeter reserves its shield for hits; its shove lasts even after the shield is consumed. Verdict reflects one hit and consumes itself; reflected hits cannot recursively reflect. Slows, Vault Lock and token theft never consume or trigger Verdict. Vault Lock bypasses shields because it applies neither a hit nor a slow. Regenesis and Second Wind block slowing but do not prevent direct damage after their one-second recovery protection expires. Finished racers cannot activate powers or receive attacks. All temporary zones reset on rematch/menu. Effects are capped at 24 desktop / 12 mobile emitters. Shared immutable geometry, analytic ribbon shaders, and capped instanced particles keep lifetimes bounded; expired materials are disposed without destroying shared vehicle or effect geometry.

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
| Quantum Ledger | Violet vault cage and locked token instances |
| Terra Axis | Blue pylon rings around the chassis |
| Obsidian Arc | Orange chevron cage and six sharp security facets |
| Civic Core | Sky-blue draft ribbon connecting to the beneficiary |
| Cognara Mind | Rose predictive racing line and helmet sensor orbs |
| Gaia Synthesis | Stationary braided roots and leaf motes |
| Nomad Nexus | Sand portal discs at departure and landing |
| Eon Core | Aqua infinity ring and rising petals |

VFX architecture follows techniques inspected in the user-owned Zukan Arena `src/game/render/ElementalVfx.ts`: shader-driven ribbons, instanced analytic particles, quality caps, reduced-motion scaling, and deterministic cleanup. Shader/geometry code here is adapted for racing and each division rather than importing its game entrypoint.

## Rules reconciliation and simulation checks

The supplied Wave 1 document contains a general routing table that mentions reflection for all hostile effects; its locked Juris section and the Wave 2 shared rules explicitly restrict reflection to hits. The hit-only contract takes precedence. Obsidian’s specific shield contract reserves its shield for hits, while an ordinary Aegis shield still absorbs slows and theft.

The existing simulation stores `distance` in **laps**, while `du_dist` returns metres. Waypoint Hop therefore advances `6 / track.len` in the same signed-distance function as driving. It may cross the start or finish line, records each new split once, and cannot turn reverse travel into a free lap. Mid-lap, start-line, final-line and reverse-history cases run against the actual simulation.

`tests/division-powers.cjs`, loaded by `tests/game-regression.cjs`, exercises all twenty power contracts with real pickup, contact, steering, speed, AI and lap functions. It also checks timer freeze outside a live race. The field timer pass decays all racers before applying effects, removing roster-order differences in slow duration.
