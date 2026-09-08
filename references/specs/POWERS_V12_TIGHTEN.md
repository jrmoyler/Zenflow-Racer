# ZenFlow Racer — Twelve Powers Tighten Pass

Source of truth in repo:
- Rules: `abilities.js` (`ABILITIES`, `useSpecial`, `stepAbilities`, `powerProtected`, `powerSlow`)
- Combat: `game.js` (`hitRacer`, `stepWorld` kart-kart / mines / missiles)
- AI gates: `game.js` `aiWantsSpecial`
- VFX: `effects.js` (`spawnPowerEffect`, `stepPowerEffects`)
- Tests: `tests/game-regression.cjs`
- Player copy: `docs/abilities.md`

This document does not invent a new power fantasy. It locks the existing twelve to one mechanical vocabulary so they read, test, and AI-fire the same way.

Track units: `du_dist` returns metres along the lap (`Δu * track.len`). Lateral units are metres. `TRACK_W = 14`. Token reserve cap is 10.

---

## Shared machine (do not fork)

| Verb | Meaning | Code |
|---|---|---|
| Activate | `game.state==='race'`, not finished, cooldown 0. Helix may fire while spinning; nobody else may. | `useSpecial` |
| Cooldown | Starts on press. Ticks only in `stepAbilities` during live simulation. Pause/menu freeze it. Fresh race resets to 0. | `r.specialCooldown` |
| Duration | `r.specialActive` for owner-attached fields. `abilityZones[]` for left-behind volumes. | |
| Phase | Intangible. Skips kart-kart, mines, missiles, `hitRacer`. Does **not** eat projectiles. | `r.phase` |
| Shield | Blocks one hostile. Consumed. Not a slow block unless `powerSlow` is used. | `r.shield` |
| Reflect | Blocks one hostile via `powerProtected`. Consumed. Calls `hitRacer(attacker,'reflection')` with `reflectable=false`. | `r.reflect` |
| Regen | Blocks **slows only**. Does not block `hitRacer`. | `r.regen` |
| Slow | `r.slow` seconds. Speed cap becomes `maxSpeed * 0.68` while `slow > 0`. | `game.js` stepRacer |
| Hit | Spin 1.1s, hitCd 1.6s, drop up to 3 tokens into `lastLostTokens`, cancel drift/boost. | `hitRacer` |
| Finished | Cannot activate. Cannot be targeted by hits, zones, or pulses. | |
| FX cap | 24 desktop / 12 mobile emitters. Follow owner unless kind is `nexus`, `loom`, `signal`, `collective`, `vector`. | `effects.js` |
| Cleanup | `clearAbilities()` empties zones and FX on rematch / menu. | |

Routing rule for **every** hostile application:

```
if finished or phase → ignore
if reflect and reflectable → consume reflect, hit attacker, ignore
if shield → consume shield, ignore
else apply effect
```

Use `powerProtected` + `powerSlow` + `hitRacer`. Do not invent a fourth gate.

---

## Per-power contract after tighten

Each block: what the code does today, the defect, the locked spec, AI, FX, tests.

### zenflow — TIME DILATION — CD 19s

**Today.** `specialActive = 4`. Each step, rivals with `|Δu| < 18` get `slow = max(slow, 0.18)` if they lack regen / phase / reflect / shield. Owner is exempt. Shield is **not** consumed. `powerSlow` is not used.

**Defect.** 0.18s refresh is a frame-tied leak. Leaving the bubble for one tick drops the slow. Shield check is a silent immunity instead of a consume. Copy says “a 4-second field,” which is the field life, not the slow life.

**Locked spec.**
- Field follows owner for 4.0s, radius 18m, any lane.
- First entry this field: `powerSlow(o, 1.2, owner)`.
- While still inside: refresh `slow` to at least 0.6s via `powerSlow` so leaving the bubble drops the effect inside a second, not a frame.
- Owner never slowed.
- Distant rivals (`|Δu| ≥ 18`) untouched.
- Regen / phase / reflect / consumed shield all go through `powerSlow`.

**AI.** Rival ahead or behind within 18m / 9 lat.

**FX.** Follow. Time dome, three clocks, fragments. Duration 4.

**Tests keep.** Owner unslowed. Distant unslowed. Nearby slowed. Add: shield on rival is consumed once and that rival is not slowed on the consuming tick.

---

### collective — SHARED FORTUNE — CD 17s

**Today.** Instant. Scan all rivals `|Δu| < 35`. Skip finished-protected via `powerProtected`. Shield on victim is consumed, no token taken. Else steal 1 token, cap owner at 10, max 3 victims. Sets `lastLostTokens` on victim.

**Defect.** No lane gate, so it siphons across the whole width. That is acceptable if copy stays “nearby.” Instant FX is not in the follow-exclusion list? Collective **is** excluded from follow, so the funnel stays at cast point — correct for a burst.

**Locked spec.**
- Instant. Range 35m. Any lane. Max 3 victims. Owner cap 10.
- Order: nearest first (sort by `|Δu|`) so the steal is deterministic.
- `powerProtected` then shield-consume-without-steal, else `-1` token / `+1` owner / `lastLostTokens = max(last, 1)`.
- No duration flag.

**AI.** Owner tokens < 10 and at least one rival with tokens in 35m.

**FX.** No follow. Fortune stream + gold token instances. Duration default 1.2.

**Tests keep.** 9→10 cap. Add: nearest-three order. Shielded rival loses shield not token.

---

### hybrid — PHASE WALK — CD 20s

**Today.** `phase = 3.5`, `specialActive = 3.5`. `powerProtected` true while phased. Kart-kart / mines / missiles skip phased bodies. Projectiles keep flying.

**Defect.** Phased racers can still collect tokens and item boxes. That fights the “walk between things” read.

**Locked spec.**
- Intangible 3.5s. No kart contact, no mine/missile hit, no `hitRacer`.
- Projectiles are not destroyed.
- While phased: skip token and item-box pickup.
- Cooldown still starts on press even if already overlapping a mine.

**AI.** `aiThreatened` (incoming missile 50m, mine 18m ahead, or rammer 9m behind).

**FX.** Follow. Kart ghost + echo + three veils. Duration 3.5.

**Tests keep.** hitRacer no-ops during phase, lands after expiry. Add: token under the kart is not collected while phased.

---

### nexus — HOLOGRAM DECOY — CD 17s

**Today.** Zone `{kind:'decoy', u, lat, life:8}` at cast pose. First hostile missile with `|Δu| < 10` and `|Δlat| < 3` is disposed and zone dies. Mines ignore it.

**Defect.** Decoy does not intercept mines. Fine if copy stays “missiles.” Zone is not owner-tagged against own missiles (`m.owner !== z.owner`) — good.

**Locked spec.**
- Stationary 8.0s. Intercept envelope 10m × 3 lat.
- First hostile **missile** only. Dispose projectile, expire zone, pulse FX on owner.
- Does not intercept mines, tokens, or racers.
- Own missiles pass through.

**AI.** Incoming missile 60m, or a rival 16m behind holding a missile item.

**FX.** No follow. Hologram kart/human + scan sheet. Duration 8.

**Tests keep.** Hostile missile deleted, zone then empty. Add: own missile not eaten. Mine not eaten.

---

### kinetic — IMPACT DRIVE — CD 20s

**Today.** `ram = 4`. Kart-kart: if either has ram, `hitRacer` the other. Push still applies.

**Defect.** Mutual ram double-hits. Phased pairs already skip the whole contact block, so ram cannot tag a phased Hybrid — correct. Ram does not pierce shield/reflect; `hitRacer` handles that.

**Locked spec.**
- Owner tagged `ram` 4.0s. Follow FX 4.0s.
- On overlap `|Δu| < 2.6` and `|Δlat| < 1.9`: `hitRacer(other, 'ram', owner)`.
- Owner is not spun by their own ram.
- If both have ram, both are hit (committed collision).
- Does not pierce phase. Does go through `hitRacer` gates.

**AI.** Rival ahead 8m / 3 lat or behind 5m / 3 lat.

**FX.** Follow. Three flame tongues. Duration 4.

**Tests keep.** Nearby rival spins, owner does not.

---

### juris — VERDICT MIRROR — CD 18s

**Today.** `reflect = 4`. Next `powerProtected(..., reflectable=true)` consumes and reflects. `source==='reflection'` cannot bounce back.

**Defect.** `powerSlow` also trips reflect, so a Loom snare can spend the mirror. Copy says “hostile hit.” Lock it to hits.

**Locked spec.**
- `reflect` 4.0s or until consumed.
- Consumed only by `hitRacer` paths (`ram`, `sonic`, `mine`, `missile`, `pulse`, `test`).
- `powerSlow` does **not** consume or block via reflect. Regen remains the slow answer.
- Reflection cannot reflect.

**AI.** Incoming missile 50m, or rival 12m behind holding any item.

**FX.** Follow. Six crystal facets. Duration 4.

**Tests keep.** One reflected spin. Add: snare slow during reflect does not consume the mirror.

---

### signal — SONIC LANCE — CD 16s

**Today.** Nearest rival with `du_dist > 0`, `< 70`, `|Δlat| < 3`. `hitRacer(target,'sonic')`. Cooldown spent even on miss.

**Defect.** Miss still burns 16s with no FX at the owner. Lane gate is correct.

**Locked spec.**
- Instant committed fire. CD always spent.
- Target: nearest forward rival, 70m, `|Δlat| < 3`, not finished.
- Hit goes through `hitRacer`.
- Miss: still play owner FX. No zone.

**AI.** Rival ahead 70m / 3 lat.

**FX.** No follow. Lance + wavefronts. Duration 1.2.

**Tests keep.** Forward in-lane spins. Behind does not. Add: no target still sets cooldown.

---

### loom — THREAD SNARE — CD 18s

**Today.** Zone 5m behind owner at cast lat. Life 5. Each tick, rivals `|Δu| < 7` and `|Δlat| < 2.4` get `powerSlow(.7)`.

**Defect.** Same frame-refresh pattern as ZenFlow, but 0.7s is long enough. Stationary is correct.

**Locked spec.**
- Stationary ribbon. Origin `wrap01(u - 5/track.len)`, same lat. Life 5.0s.
- Envelope 7m × 2.4 lat.
- Apply `powerSlow(r, 0.8, owner)` each tick in envelope.
- Owner immune. Does not deal hits.

**AI.** Rival behind 12m / 3 lat.

**FX.** No follow. Three braids. Duration 5.

**Tests keep.** Crossing rival slowed. Zone gone after 5s.

---

### vector — SIDE STEP — CD 12s

**Today.** `lat += 5` if `lat <= 0` else `-5`, clamped to track. `phase = 0.5`. Clears theta/steer. No `specialActive`.

**Defect.** Blink distance is a fixed 5m (~0.7 of half-width). Always flips toward the opposite half, so a rider already at +6 still jumps toward center-left. No specialActive means HUD duration is empty.

**Locked spec.**
- Instant lateral blink of **4.0m** toward the emptier adjacent lane: if a rival occupies `|Δlat| < 2` on the would-be side, blink the other way.
- Clamp to `±(TRACK_W/2 - 1)`.
- Race distance unchanged.
- `phase = 0.5`, `specialActive = 0.5`.
- Clears steer/theta so the landing does not immediately drift back.

**AI.** Incoming missile 30m / 2.2 lat or mine 15m / 2.2 lat.

**FX.** No follow. Two portal crescents. Duration 1.2 is fine; attach to cast pose.

**Tests keep.** Lat changes, distance does not, phase > 0, stays on track.

---

### aether — ORBITAL MAGNET — CD 20s

**Today.** `specialActive = 5`. Each tick, available tokens with `|Δu| < 24` and owner tokens < 10 are collected instantly (`t.t = 9`, hide mesh).

**Defect.** Lane-agnostic, which matches copy. Collects the instant the field turns on, so the “pull” is visual only. Acceptable if FX shows streaks.

**Locked spec.**
- Field follows owner 5.0s, radius 24m, any lane.
- Each tick collect as many available tokens as fit under the cap of 10.
- Does not steal rival tokens (Collective’s job).
- Does not collect while owner `spin > 0` (same as normal pickup).

**AI.** Tokens < 10 and an available token within 24m.

**FX.** Follow. Token instances + magnet orbits. Duration 5.

**Tests keep.** Near token taken, far token left, cap 10.

---

### animus — SENTINEL DRONE — CD 23s

**Today.** `specialActive = 4`, `specialPulse = 0`. Every 1.5s pick nearest forward rival within 32m (no lane gate), `powerSlow(1.1)` and `speed *= 0.84`. First pulse on the first stepAbilities tick.

**Defect.** No lane gate makes it a wide cone. Three pulses at t≈0 / 1.5 / 3.0. Speed multiply stacks with slow cap — strong, but tested.

**Locked spec.**
- Escort follows owner 4.0s.
- Pulses at 0.0, 1.5, 3.0 (max 3).
- Target: nearest forward rival, 32m, `|Δlat| < 6` (tighten from “any lane” so it cannot snipe the far ribbon).
- Each pulse: `powerSlow(target, 1.1, owner)` then if that returned true, `speed *= 0.84`.
- Respects shield / reflect / phase / regen via `powerSlow`.

**AI.** Rival ahead 32m / 9 lat.

**FX.** Follow. Drone + wings + motes. Pulse kind `animus-pulse` on the target, duration 0.9.

**Tests keep.** Forward rival slowed and speed drops. Shield/reflect/phase/regen block. Add: far-lateral rival (`|Δlat| ≥ 6`) is not pulsed.

---

### helix — REGENESIS — CD 18s

**Today.** Only power usable while spinning. Clears spin, slow, wheelspin. `hitCd = max(hitCd, 1)`. `regen = 5`. Recovers `lastLostTokens` into reserve, cap 10, then zeroes the ledger.

**Defect.** Does not clear `ram` / `phase` / `reflect` — good. Does not prevent the next `hitRacer`. `hitCd` floor of 1s is a hidden i-frame; keep it, name it.

**Locked spec.**
- May fire during spin.
- Instant cleanse: `spin = slow = wheelspin = 0`.
- `hitCd = max(hitCd, 1.0)` i-frame.
- `regen = 5.0` — blocks `powerSlow` only.
- Recover `min(10 - tokens, lastLostTokens)` then `lastLostTokens = 0`.
- Does not heal a live hit, does not grant shield.

**AI.** `spin > 0` or `slow > 0` or `lastLostTokens > 0`.

**FX.** Follow. Double helix + petals. Duration 5.

**Tests keep.** Cleanse + cap + regen flag.

---

## Cooldown / duration board (locked)

| id | CD | Duration | Zone? | Hostile verb |
|---|---:|---:|---|---|
| zenflow | 19 | 4 field | no | slow refresh |
| collective | 17 | 0 instant | no | steal token |
| hybrid | 20 | 3.5 phase | no | self intangibility |
| nexus | 17 | 8 decoy | yes | eat one missile |
| kinetic | 20 | 4 ram | no | hit on contact |
| juris | 18 | 4 or 1 hit | no | reflect one hit |
| signal | 16 | 0 instant | no | hit forward |
| loom | 18 | 5 ribbon | yes | slow in volume |
| vector | 12 | 0.5 phase | no | blink |
| aether | 20 | 5 field | no | collect tokens |
| animus | 23 | 4 escort | no | slow pulse ×3 |
| helix | 18 | 5 regen | no | cleanse + anti-slow |

Average CD ≈ 18.2s. Do not flatten them. Vector is the short mobility button. Animus is the long escort.

---

## Implementation order

1. Route ZenFlow through `powerSlow` with 1.2s first-enter / 0.6s refresh.
2. Stop Juris reflect from eating slows.
3. Phase skips token/item pickup.
4. Vector writes `specialActive = 0.5` and blinks 4m with a side picker.
5. Animus gains a 6m lane gate.
6. Collective sorts victims by `|Δu|`.
7. Keep every existing regression green, then add the four extra asserts named above.

Do not retune copy names. Players already know TIME DILATION, PHASE WALK, SIDE STEP, REGENESIS.
