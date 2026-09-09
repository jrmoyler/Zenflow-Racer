# Elemental add-ons: source coverage and gameplay contract

This pass adds **24 equippable powers** independently of the racer's division ability and item slot. Every racer can equip one add-on before a race. Add-on cooldowns are independent of the division cooldown. Equipment is selected during setup and persists per racer; casting uses **F**, the touch add-on button or gamepad button 10. Empty equipment is valid.

The first supplied repository has ten current powers. The second has seven current powers plus three independently activated self-buffs. Both contain the same four archived elemental abilities: a byte-for-byte comparison found the corresponding archived files identical, so those become four entries rather than eight duplicate menu choices. Live **Earthen Spire**, archived **Elemental Earth** and **Brutalist Earth Blast** remain separate.

The committed [source manifest](../references/upstream/manifest.json) maps every power to its exact upstream commit, source file, SHA-256 and local reference. Both MIT notices are preserved under `references/upstream/`. The archived README mentions a former Ice ability, but neither checked-out source tree contains that ability: it is historical documentation, not an additional supplied implementation. AirScooter is the archived character's traversal effect and WalkController mode, not an independently cast ability. The archived fire, water, earth and wind powers themselves are included.

## Complete adaptation and appearance matrix

The upstream demos aim at a flat world-space floor. These adaptations use the actual race track's distance and lateral coordinates. The source screenshots below establish anatomy, material and cast/impact rhythm, not a promise of pixel-identical rendering on every GPU. They are not loaded as gameplay panels, textures, billboards or backdrops.

| Add-on ID | Upstream source / reference | Race behavior | Required visible anatomy |
| --- | --- | --- | --- |
| `ward` | Casting `WardAbility`; [Ward](../references/upstream/casting/screenshots/ward.jpg) | Rear ward consumes an incoming missile; caster receives one timed shield. | Solid volcanic ribs, runed barrier, molten ground seams; contact opens a brief fracture flash. |
| `acid` | Casting `AcidAbility`; [Bloom](../references/upstream/casting/screenshots/acid.jpg) | Five-second pool ahead, 1.6-second slow when crossed. | Corroded footprint, oily pool, uneven bubbles and rising toxic mist; separate wet contact splash. |
| `growth` | Casting `ArborBloomAbility`; [Growth](../references/upstream/casting/screenshots/growth.jpg) | Stationary plant chooses a forward rival and fires three visible slowing lances. | Curling woody tendrils, leaves and opening petals around a bright core; distinct lance silhouette. |
| `cyber` | Casting `CyberSerpentAbility`; [Serpent](../references/upstream/casting/screenshots/cyber.jpg) | A homing serpent changes lane toward its target and spins it on collision. | Segmented serpent body and head, continuous undulating ribbon wake, circuit ground accents. |
| `venom` | Casting `VenomSurgeAbility`; [Venom](../references/upstream/casting/screenshots/venom.jpg) | Crystal wave pierces three rivals, slows each and leaves a terminal venom bed. | Amethyst spear/blade/chunk populations, green inclusions, low heavy mist, droplets and fractured ground. |
| `monolith` | Casting `MonolithRiftAbility` / upstream key `quake`; [Earth blast](../references/upstream/casting/screenshots/quake.jpg) | Travelling rupture ends in a seven-metre area blast. | Non-emissive rough stone monoliths, irregular fracture faces, grounded dust, ballistic-looking debris and crater. |
| `ink` | Casting `SumiTideAbility`; [Sumi](../references/upstream/casting/screenshots/ink.jpg) | Four-second ink pool slows and pulls rivals toward its center lane. | Inky dark pool, raised fluid crown, continuous spiralling volume and wet splashes. |
| `astral` | Casting `AstralVoidAbility`; [Astral](../references/upstream/casting/screenshots/astral.jpg) | Visible pull field collapses after 1.6 seconds into one area hit. | Black singularity center, tight photon rim, sheared violet haze, infalling shards and collapse wave. |
| `cascade` | Casting `BalefulCascadeAbility`; [Cascade](../references/upstream/casting/screenshots/cascade.jpg) | Stationary crown acquires a target, launches two slowing blades then one hard-hit blade, 0.18 seconds apart. | Angular ground mark, rising wisps, crown of teal/violet facets; projectiles leave its actual center. |
| `rend` | Casting `CelestialRendAbility`; [Rend](../references/upstream/casting/screenshots/rend.jpg) | Ground mark warns for 1.1 seconds before a single area strike. | Sigil, gathering shards and braids, tall narrow light column and a brief expanding impact. |
| `pyre` | Ability `PyreAbility`; [Pyre](../references/upstream/ability/screenshots/pyre-crown.jpg) | Annular flame wall slows racers at its boundary; the open center is safe. | Uneven crossed burning blades around an open hollow center, molten cracks, rising embers and ash. |
| `kraken` | Ability `KrakenAbility`; [Kraken](../references/upstream/ability/screenshots/kraken-crown.jpg) | Tentacles strike alternating sides of a seven-metre pool, then the full footprint. | Coiled arms, rearing and descending tentacle silhouettes, black water, ink and spray at contact. |
| `electrical` | Ability `ElectricalSphereAbility`; [Sphere](../references/upstream/ability/screenshots/electrical-sphere.jpg) | Anchored sphere chains slowing arcs through up to three adjacent rivals. | Dark polished sphere, faceted containment base, skin arcs, jagged radial bolts and electrical impact. |
| `earth-spire` | Ability live `EarthAbility`; [Spire](../references/upstream/ability/screenshots/earthen-spire.jpg) | Fracture wave ends in a four-second lane blockade. | Sequential crust plates, cracked raised boulders, tall stone tower with broad plinth. |
| `verdant-gate` | Ability `PortalAbility`; [Gate](../references/upstream/ability/screenshots/verdant-gate.jpg) | Driving through your gate grants a timed shield and strong acceleration. | Two block-built jambs, seated keystone, green inner opening and assembled stone depth. |
| `tide-ring` | Ability `AetherRingAbility`; [Ring](../references/upstream/ability/screenshots/tidewrought-ring.jpg) | A crossing cleanses slowing and gives speed; its owner receives the stronger boost. | Segmented hoop, forged ground-to-upright assembly, rune band and luminous inner horizon. |
| `fire-portal` | Ability `FirePortalAbility`; [Portal](../references/upstream/ability/screenshots/fire-portal.jpg) | Owner crossing grants a short phase surge and leaves fire eighteen metres beyond the gate. No progress teleport. | Dark open disc, traced ignition ring, stretched tangential sparks and burning exit patch. |
| `electric-boost` | Ability `effects/ElectricBoost`; [Buffs](../references/upstream/ability/screenshots/self-buffs.jpg) | Short strong acceleration plus one close-range slowing arc. | Fine body arcs, charged coils and a brief crisp electrical contact flash. |
| `magic-boost` | Ability `effects/MagicBoost`; [Buffs](../references/upstream/ability/screenshots/self-buffs.jpg) | Clears slowing, resists further slows for four seconds, sustains a smooth speed boost. | Broad violet ribbons channelled around the kart, controlled Fresnel edge, low spiral smoke. |
| `fire-boost` | Ability `effects/FireBoost`; [Buffs](../references/upstream/ability/screenshots/self-buffs.jpg) | Three-second acceleration lays real short-lived fire zones behind the moving kart. | Body-following tongues of flame, orbiting embers, warm exhaust and a continuous burnt trail. |
| `fire` | Both archived `FireAbility` files | Straight fireball explodes on first collision, hitting nearby rivals within five metres. | Head-and-wake flame body, hot core and soot edge, embers, expanding detonation and scorch. |
| `water` | Both archived `WaterAbility` files | Broad water jet pierces rivals, slows and pushes them sideways. | Continuous rolling water body, Fresnel edge, foam crest and contact crown of jets. |
| `earth` | Both archived `EarthAbility` files | Four staggered sections of heaving crust behind the kart slow and deflect pursuers. | Flush plates before fracture, heaved stratified slabs and debris; separate from the live tower cast. |
| `wind` | Both archived `WindAbility` files | Owner receives tailwind while a drifting forward tornado slows and shoves rivals. | Fine combed ribbons that gather into a tapered vortex, leaf/debris drift and airy impact wisps. |

## Integration

`addons.js` is a classic global script loaded after `abilities.js`. Rendering lives in `addon-effects.js`.

- `ADDONS`: immutable catalog entries `{id,name,type,description,cooldown,color}`; `color` is a numeric Three.js color.
- `initAddons(r,id)`: validate saved equipment and reset `addonId`, `addonCooldown`, `addonActive`, `addonPulse`, `addonAI`. Invalid/empty IDs equip nothing.
- `useAddon(r)`: true only for a successful race cast; rejects cooldown, spin, completed racers and Quantum Vault. It does not consume the item or division power.
- `stepAddons(dt)`: update only during live races; seconds, finite positive values. Run after division timers. AI uses range/threat decisions.
- `clearAddons()`: mark live entity references dead, empty simulation and clear add-on effects at race restart/menu teardown.

The rendering callbacks are `spawnAddonEffect(id,u,lat,owner,{duration,phase,follow,radius,entity})` and `spawnAddonContact(id,u,lat,owner)`. Phases are `zone`, `projectile`, `buff` and `burst`. The supplied live entity has exact current `u`, `lat`, `life` and `age`: follow it for moving geometry and retire it at `life <= 0`. Buffs follow the owner. Contact is emitted only after the real hit or slow succeeds, or a real beneficial gate crossing/missile interception occurs. Calling `stepAddonEffects(dt)` once per simulation step keeps animation in sync with pause.

Projectiles perform swept collision in track distance, including across the finish-line seam, instead of checking just their endpoint. Slow, shove and pull effects call `powerSlow` before changing lateral position; hard hits call `hitRacer`. Their existing phase, ordinary shield, reflection and immunity gates remain authoritative. Portal boosts do not write lap, distance, checkpoint or finish state. Persistent hazards retire when their owner finishes. A 72-entity global ceiling, short zone lifetimes and bounded volley/pierce counts prevent unbounded simulation growth.

The demo's permanently lit gates are deliberately time-limited to seven seconds in the race adaptation. Rendering anatomy is retained while race reach, timing and contact are rebalanced. Upstream ragdoll destruction and body disassembly are replaced with the game's recoverable spin/slow rules. Upstream character FBX, environment HDR, photographic texture sets and snake GLB are not copied into the runtime.

## Verification

`node tests/addon-powers.cjs` runs 31 gameplay checks against the real protection and hit functions: all 24 powers have an observable result; additional checks cover guard states, collateral blast, piercing, delayed strike timing, ring safe center, chained range, crossing-only buffs, no portal progress changes, phase/shield/reflection behavior, lap-seam swept collision, pause, owner finish cleanup and the entity ceiling. These checks establish simulation behavior; browser visual verification remains a separate integration task.

## Equipping and casting

Every catalog row in the loadout is a single button carrying the add-on's behaviour glyph, its name, its behaviour badge, its cooldown and an explicit **ADD ON** action chip; the equipped row reads **EQUIPPED ✓** and the empty slot reads **CLEAR SLOT**. The equipped add-on then appears in the race on its own dock button beside the signature power — glyph, slot name, power name, live state and the **F** key hint — with a cooldown bar along its bottom edge. Touch races keep the separate **ADD-ON** button in the thumb cluster. Both dock buttons share one glyph vocabulary with the roster card, so the mark you chose in the menu is the mark you look for at speed.
