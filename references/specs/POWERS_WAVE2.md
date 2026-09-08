# ZenFlow Racer — Wave 2 Powers

Eight powers for the missing divisions. Same machine as `POWERS_V12_TIGHTEN.md`. Same files: `abilities.js`, `game.js` `aiWantsSpecial`, `effects.js`, `tests/game-regression.cjs`.

Do not invent new verbs. Reuse `specialActive`, `abilityZones`, `phase`, `shield`, `reflect`, `regen`, `slow`, `ram`, `powerProtected`, `powerSlow`, `hitRacer`.

Roster ids: `ledger`, `terra`, `obsidian`, `civic`, `cognara`, `gaia`, `nomad`, `eon`.

---

## Shared rules (copied, not relaxed)

- Activate only in `race`, not finished, cooldown 0. Only Helix-class cleanses may fire during spin — Wave 2: **eon** may, nobody else.
- Cooldown ticks only in `stepAbilities`.
- Finished racers cannot be targeted.
- Phase skips contact and `hitRacer`; does not eat projectiles.
- Shield eats one hit. Reflect eats one **hit** (not a slow). Regen eats slows only.
- Token cap 10. FX cap 24 / 12. `clearAbilities()` on rematch.
- `du_dist` is metres. `TRACK_W = 14`.

Add to `ABILITIES`, `initAbility` defaults, `useSpecial` switch, `stepAbilities` ticks, `aiWantsSpecial`, `referencePowerColors`, `spawnPowerEffect` durations, follow-exclusion list when the effect is a left-behind zone.

---

## Board

| id | Power | CD | Duration | Role | Existing cousin |
|---|---|---:|---|---|---|
| ledger | VAULT LOCK | 18 | 4 field | Freeze rival tokens + items | collective + zenflow |
| terra | ANCHOR SPAN | 19 | 3.5 self | Mass lock, ignore bump | hybrid (self state) |
| obsidian | HARD PERIMETER | 18 | 4 self | Opaque shield that also shoves | juris + kinetic |
| civic | SHARED LANE | 17 | 5 field | Gift slipstream to nearest other | aether (field) |
| cognara | PREDICTIVE LINE | 16 | 4 self | Ghost line + tighter steer | vector (self feel) |
| gaia | ROOT NET | 18 | 5 zone | Off-road grip + wake slow | loom |
| nomad | WAYPOINT HOP | 13 | 0.6 phase | Forward blink along heading | vector |
| eon | SECOND WIND | 18 | 5 regen | Cleanse + 30% boost refill | helix |

Average CD ≈ 17.1s. Nomad is the short mobility button (pairs with Vector at 12). Nobody is below 13 or above 19 so Wave 2 does not out-tempo Animus or undercut Side Step.

---

## ledger — VAULT LOCK — CD 18s

FinTech / Quantum Ledger. Stops the economy around you without spinning anyone.

**Spec.**
- `specialActive = 4`. Field follows owner, radius 16m, any lane.
- Each rival in range: `o.vault = max(o.vault, field-remaining)`.
- While `vault > 0`: cannot gain tokens, cannot use items, cannot have tokens stolen by Collective. Existing tokens stay.
- Does not apply slow or hit.
- `powerProtected` / phase / finished skip the tag. Shield does **not** block it (not a hit). Regen does not block it (not a slow).

**Tick.** Decrement `vault` in the same key loop as `slow`.

**AI.** `aiWantsSpecial`: rival within 16m holding an item, or rival within 16m with `tokens >= 3`.

**FX.** Follow. Hex vault cage + locked token instances. Color `#8B5CF6`. Duration 4. Shader mode 4 (fracture, Juris-adjacent).

**Tests.**
- Rival in 16m cannot `useItem` and does not increment tokens from a touching token.
- Rival at 40m is free.
- Owner is free.
- Collective cannot steal from a vaulted rival.

---

## terra — ANCHOR SPAN — CD 19s

Infrastructure. You become the pylon.

**Spec.**
- `specialActive = 3.5`. `r.anchor = 3.5`.
- While anchored:
  - Kart-kart push on the owner is zero (`push` term skipped when `a.anchor||b.anchor` applies to the anchored body).
  - Owner speed is clamped to current speed ±2 (no launch, no slam).
  - Owner still collides; they are not phased.
  - Kinetic ram can still `hitRacer` the owner — anchor is mass, not armor.
- Does not grant shield.

**AI.** `aiThreatened` or rival within 4m / 2 lat (about to bump).

**FX.** Follow. Vertical pylon rings around the chassis. Color `#2563EB`. Duration 3.5. Mode 0.

**Tests.**
- Overlap with a heavier rival does not change owner `lat` by more than 0.05 over 0.2s.
- Owner can still be spun by `hitRacer`.
- Expires at 3.5s.

---

## obsidian — HARD PERIMETER — CD 18s

Security. One real shield, plus a shove.

**Spec.**
- `r.shield = max(r.shield, 4)` and `r.perimeter = 4`, `specialActive = 4`.
- First hostile `hitRacer` consumes the shield exactly as Aegis does.
- While `perimeter > 0`, kart-kart overlap `|Δu| < 2.6` and `|Δlat| < 1.9`: other racer is pushed 1.2 lat away from owner **and** `powerSlow(other, 0.5, owner)`. No spin unless they also eat a real hit.
- Perimeter is not consumed by the shove. Shield is only consumed by `hitRacer`.

**AI.** Incoming missile 50m, or rival 8m / 3 lat.

**FX.** Follow. Razor chevron cage, six sharp facets (Juris cousin, orange). Color `#EA580C`. Duration 4. Mode 4.

**Tests.**
- First `hitRacer` is blocked, shield goes to 0, perimeter may still be ticking.
- Overlapping rival is displaced and slowed, not spun.
- Phase rival is ignored.

---

## civic — SHARED LANE — CD 17s

Community. You donate draft.

**Spec.**
- `specialActive = 5`. Field follows owner.
- Each tick pick the nearest other racer with `|Δu| < 14` and `|Δlat| < 4` (ahead or behind).
- That racer gets `o.civicDraft = max(o.civicDraft, 0.4)`.
- While `civicDraft > 0`: treat as slipstream — reuse the existing slip bonus path (`slipBonus` floor 0.12, or `applyBoost(o, 0.4, 1.12, 0.2)` once per grant, not per tick).
- Does not slow anyone. Does not steal tokens.
- Works on rivals and, if a second human is added later, allies. Today the field is the whole roster minus self.

**AI.** Any other racer within 14m / 4 lat.

**FX.** Follow. Soft sky-blue slip ribbon from owner to beneficiary. Color `#7DD3FC`. Duration 5. Mode 1.

**Tests.**
- Nearest other racer’s speed after 0.5s is higher than a control with the field off.
- Owner does not self-boost.
- Finished racers are not picked.

---

## cognara — PREDICTIVE LINE — CD 16s

Behavioral science. Read the line.

**Spec.**
- `specialActive = 4`. `r.predict = 4`.
- While predicting:
  - Steer response `* 1.35` (tighter).
  - Off-line scrub `* 0.7` (forgives a miss).
  - Draw a 24m ghost racing line ahead of the owner (FX only).
- Does not blink. Does not phase. Does not hit.

**AI.** `|curvature|` high or rival ahead 20m (use the same curv sample the item AI already has; if unavailable, fire when `aiRivalAhead(r, 20, 4)`).

**FX.** Follow. Rose neural ribbon on the road, two sensor orbs at the helmet. Color `#E0267E`. Duration 4. Mode 7.

**Tests.**
- During predict, a fixed steer input changes `lat` more than the control in 0.25s.
- Expires at 4s.
- No spin applied to anyone.

---

## gaia — ROOT NET — CD 18s

AgriTech. Loom cousin with a self buff.

**Spec.**
- Zone `{kind:'roots', owner, u: wrap01(u - 4/track.len), lat, life:5}`.
- Envelope 8m × 2.6 lat.
- Rivals in envelope: `powerSlow(r, 0.8, owner)` each tick.
- Owner, while `specialActive = 5`: off-road / edge penalty `* 0.35` (root grip). If the sim exposes an off-road flag, use that; else apply to the existing edge scrub in `stepRacer`.
- Does not hit.

**AI.** Rival behind 12m / 3 lat, or owner currently edge-scrubbing.

**FX.** No follow (zone). Vine braids + leaf motes at the zone pose. Color `#22C55E`. Duration 5. Mode 7. Add `gaia` to the no-follow list.

**Tests.**
- Crossing rival slowed.
- Zone gone after 5s.
- Owner edge scrub is reduced while active (assert a smaller `|speed|` drop than control, or skip if the harness cannot see the edge term — then assert `specialActive === 5` only and leave the grip assert for a world test).

---

## nomad — WAYPOINT HOP — CD 13s

Global mobility. Vector’s forward twin.

**Spec.**
- Instant. Advance `u` by `6 / track.len` (6m forward). `distance` increases by 6.
- `phase = 0.6`, `specialActive = 0.6`.
- Lat unchanged. Steer/theta cleared.
- Cannot hop across the finish in a way that grants a free lap: if the 6m would wrap past `u = 1` while on the last lap, clamp to just before the line (`u = min(u+Δ, 0.999)` when `lap === maxLap`). Safer: always allow wrap; signed distance tracker already prevents reverse exploits, and a 6m hop cannot skip a lap gate if the lap increment requires a full crossing window. Lock: hop **may** wrap. Tests must use mid-lap `u`.
- Does not hit.

**AI.** Mine ahead 15m / 2.2 lat, or incoming missile 30m / 2.2, or rival ahead 6–10m / 2 lat (to pass).

**FX.** No follow. Sand portal disc at origin and at landing. Color `#FBBF24`. Duration 1.2. Add `nomad` to the no-follow list.

**Tests.**
- `u` increases, `lat` unchanged.
- `phase > 0`.
- Mid-lap hop does not change rank by more than one position against a stationary field (optional).
- Cooldown 13.

---

## eon — SECOND WIND — CD 18s

Longevity. Helix cousin that restores motion instead of tokens.

**Spec.**
- May fire during spin (`useSpecial` exception: `r.spin>0 && !['helix','eon'].includes(r.div.id)`).
- Instant: `spin = slow = wheelspin = 0`.
- `hitCd = max(hitCd, 1.0)`.
- `regen = 5` (anti-slow).
- `applyBoost(r, 1.2, 1.18, 0.8)` — “30% boost refill” as a short surge, not a token grant.
- Does **not** recover `lastLostTokens`. That stays Helix’s identity.

**AI.** `spin > 0` or `slow > 0` or `speed < maxSpeed * 0.55`.

**FX.** Follow. Aqua infinity ring + rising petals (Helix cousin, cooler). Color `#06B6D4`. Duration 5. Mode 7.

**Tests.**
- Fires while spinning. Spin/slow/wheelspin cleared.
- `regen > 0`.
- Tokens unchanged even if `lastLostTokens === 3`.
- `boost` or `surge` > 0 after cast.

---

## AI table

```
case 'ledger':  want = !!aiRivalAhead(r,16,9) && (rival.item || rival.tokens>=3);
                /* implement as a scan, not a fake property */
case 'terra':   want = aiThreatened(r) || !!aiRivalAhead(r,4,2) || !!aiRivalBehind(r,4,2);
case 'obsidian':want = !!aiIncomingMissile(r,50) || !!aiRivalAhead(r,8,3);
case 'civic':   want = !!(aiRivalAhead(r,14,4) || aiRivalBehind(r,14,4));
case 'cognara': want = !!aiRivalAhead(r,20,4);
case 'gaia':    want = !!aiRivalBehind(r,12,3);
case 'nomad':   want = !!aiIncomingMissile(r,30,2.2) || !!aiMineAhead(r,15,2.2) || !!aiRivalAhead(r,10,2);
case 'eon':     want = r.spin>0 || r.slow>0 || r.speed<r.maxSpeed*.55;
```

Idle fallback already in `aiWantsSpecial` (`specialIdle > 14` + anyone within 40m) applies unchanged.

---

## VFX follow list after Wave 2

Do **not** follow: `nexus`, `loom`, `signal`, `collective`, `vector`, `gaia`, `nomad`.

Follow owner: `zenflow`, `hybrid`, `kinetic`, `juris`, `aether`, `animus`, `helix`, `ledger`, `terra`, `obsidian`, `civic`, `cognara`, `eon`.

`referencePowerColors` adds:

```
ledger:'#b794f6', terra:'#60a5fa', obsidian:'#fb923c', civic:'#7dd3fc',
cognara:'#f472b6', gaia:'#4ade80', nomad:'#fbbf24', eon:'#67e8f9'
```

Keep reference colors readable on dark track. Do not paint them with chassis pearl.

---

## Init keys

`initAbility` must zero the new timers so leftover races cannot leak:

```
r.vault=0; r.anchor=0; r.perimeter=0; r.civicDraft=0; r.predict=0;
```

Decrement `vault`, `anchor`, `perimeter`, `civicDraft`, `predict` in the same `stepAbilities` decay list as `phase` / `slow` / `ram` / `reflect` / `regen`.

---

## Copy for `docs/abilities.md`

| Division ID | Power | Cooldown | Gameplay |
|---|---|---:|---|
| ledger | VAULT LOCK | 18s | A 4-second field freezes rivals’ tokens and items within 16 metres. |
| terra | ANCHOR SPAN | 19s | Become an immovable span for 3.5 seconds. Bumps no longer shove you. |
| obsidian | HARD PERIMETER | 18s | A 4-second shield that also shoves and slows anyone who touches the cage. |
| civic | SHARED LANE | 17s | For 5 seconds the nearest racer in 14 metres inherits your slipstream. |
| cognara | PREDICTIVE LINE | 16s | A 4-second racing line. Steering tightens. Off-line scrub eases. |
| gaia | ROOT NET | 18s | Lay a 5-second root ribbon that slows crossings and grips your off-road tyres. |
| nomad | WAYPOINT HOP | 13s | Blink 6 metres forward with 0.6 seconds of collision immunity. |
| eon | SECOND WIND | 18s | Cleanse spin and slow, resist the next slows for 5 seconds, and surge. |

---

## Implementation order

1. Add the eight `ABILITIES` rows and `initAbility` keys.
2. `useSpecial` cases + decay list.
3. `aiWantsSpecial` cases.
4. World hooks: `vault` blocks `useItem` and token pickup; `anchor` zeroes bump on that body; `perimeter` shove in the kart-kart loop; `predict` steer/scrub multipliers; `civicDraft` slip; Gaia zone next to Loom snare.
5. VFX kinds + colors + follow exclusions.
6. Eight regression tests matching the asserts above, in the same file as the twelve.

Identity split to protect the original roster:
- Collective steals tokens. Ledger freezes them.
- Vector blinks sideways. Nomad blinks forward.
- Helix returns lost tokens. Eon returns motion.
- Juris reflects a hit. Obsidian blocks a hit and shoves.
- Loom only hurts others. Gaia hurts others and grips the owner.
