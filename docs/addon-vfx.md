# Divisional and equipped-power visual contract

The two supplied JPEGs establish pearl/chrome chassis, readable coloured power sources, and effects drawn in the race world. The committed `references/art/division-effects-01.png`, `division-effects-02.png`, and `item-icons.png` provide the original twelve power and six inventory silhouettes. None is displayed as a replacement for playable geometry.

`effects.js` preserves those twelve signatures and implements the eight new signatures specified in `references/specs/POWERS_WAVE2.md`. `addon-effects.js` reconstructs the source repositories' effect anatomy at racing scale. These are adapted Three.js geometry and shader treatments, not imports of either demo's entire standalone rendering engine. The expensive demo raymarching, editor, HDR stage and unrelated FBX casting character are excluded; this keeps the racer’s camera, map lighting and collision simulation authoritative. Exact pixel parity with the demonstration renderers is not claimed.

## Source anatomy retained

The upstream `src/abilities`, `src/materials`, and relevant `src/assets` files were inspected. Source names below are direct audit pointers into [LinearAbiltyCastingExtendedThreeJS](https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS) and [LinearAbilityExtThreeJS](https://github.com/achrefelouafi/LinearAbilityExtThreeJS). See the source/license inventory for pinned revisions.

| Add-on ID | Inspected source | Playable geometry and material standard |
|---|---|---|
| ward | WardAbility / WardBarrierMaterial | Obsidian monolith ring, bounded rune barrier and floor current. |
| acid | AcidAbility / AcidPoolMaterial / ToxicMistMaterial | Wet chemical pool, independently boiling bubbles and soft toxic volume. |
| growth | ArborBloomAbility / GrowthGeometry | Six climbing stems and an eight-petal bloom; fired growth lances have separate projectile geometry. |
| cyber | CyberSerpentAbility / CyberSerpentMaterial | Undulating tubular serpent, separate head/eyes, inner wire currents and helical wake. |
| venom | VenomSurgeAbility / VenomCoreMaterial | Violet crystal spear cluster with a separate soft kernel and toxic footprint. |
| monolith | MonolithRiftAbility / MonolithGeometry | Irregular, rough non-emissive geological slabs, ground scar and expanding cement dust; travelling ground rupture precedes the terminal cluster. |
| ink | SumiTideAbility / InkPoolMaterial | Near-black opaque pool and curling crown with a pale foam edge. |
| astral | AstralVoidAbility / SingularityMaterial | Dark event horizon, tilted accretion rings, orbiting shard silhouette and cosmic footprint. |
| cascade | BalefulCascadeAbility / CascadeGeometry | Suspended inverted blade crown, ground mark; fired volleys use individual blades. |
| rend | CelestialRendAbility / RendPillarMaterial | Vertical light pillar with three braided tendrils, upper star halo and ground sigil. |
| pyre | PyreAbility / PyreMaterial | Open crown of opaque combustion blades, molten annulus, rising ember ribbons. The safe centre remains visually open. |
| kraken | KrakenAbility / KrakenMaterial | Separate curved arms, modeled suckers, abyss pool and brine rim. |
| electrical | ElectricalSphereAbility / RadialBoltMaterial | Dark conductive core, discontinuous white/cool radial bolts and containment platform. |
| earth-spire | EarthAbility | Broken stone collar and translucent tall spire; moving fracture is distinct from the terminal tower. |
| verdant-gate | PortalAbility | Assembled stone arch with a green liquid aperture. |
| tide-ring | AetherRingAbility | Horizontal assembled stone ring with a water surface. |
| fire-portal | FirePortalAbility | Upright burning aperture and hot lip without stone assembly. |
| electric-boost | electric boost effect | Narrow electrical exhaust and branching pale lightning. |
| magic-boost | magic boost effect | Coiled arcane exhaust and three flight rings. |
| fire-boost | fire boost effect | Three unequal, opaque-core flame exhaust tongues. |
| fire | archive/FireAbility | Combustion head and three burning gas tails. |
| water | archive/WaterAbility | Wet surge head, twin curling crests and white foam traces. |
| earth | archive/EarthAbility | Successive rough fractured road slabs and dark scar. |
| wind | archive/WindAbility | Four air helices and a leading pressure ring. |

## Wave 2

| Division | Signature | Attachment |
|---|---|---|
| Ledger | Six-rib vault cage, locked gold tokens and padlock shackles | Owner, 4s |
| Terra | Four physical anchor pylons, footings and three rings each | Owner, 3.5s |
| Obsidian | Six opaque dark chevron panels with hot orange edges | Owner, 4s |
| Civic | Twin slip ribbons plus a dynamic line to the actual nearest beneficiary | Owner, 5s |
| Cognara | Helmet sensors and a 24m line sampled from actual track geometry | Owner, 4s |
| Gaia | Five root braids and leaf instances | Authoritative left-behind root zone, 5s |
| Nomad | Origin and landing portal discs separated by 6m | Cast pose, 1.2s |
| Eon | Aqua infinity tube and rising petals | Owner, 5s |

Nexus, Loom and Gaia bind to actual ability-zone coordinates and lifetime: a consumed decoy disappears, and snares/roots are rendered at the dropped zone rather than at the owner's cast position. Civic never draws to a finished racer. Predictive Line follows curved/banked track coordinates rather than projecting a straight strip into scenery.

## Contact, pause and cleanup

`spawnAddonEffect(id,u,lat,owner,{duration,phase,radius,entity,follow})` tracks the exact projectile or zone record used by collision. Zone footprints scale to the gameplay radius. Pyre's visible annulus has an exact 3.5m inner / 7m outer radius. Summoned missiles and terminal formations use distinct geometries. Burst phases route to contact animation.

`spawnAddonContact(id,u,lat,owner)` creates a real Three.js pressure ring, instanced fragments and fading volume. Anime.js 4.2.2 drives spread, lift and fade with `autoplay:false`; `stepAddonEffects(dt)` seeks the animation using simulation time. There is no separate wall-clock playback while paused. Standard missile, mine, pulse, ram, shield and division contacts use the same entry point with their own colour identity. Reduced motion reduces movement, not hit readability.

Both emitter lists cap at 24 desktop / 12 mobile. Add-on contacts share the add-on list and evict the oldest emitter. Every eviction, expiry and rematch detaches meshes, cancels its anime animation, and disposes owned materials and instance buffers. Immutable geometries remain shared for reuse; the dynamic Civic/Cognara line buffers are disposed by their owners. The combined scene still has the existing race FX pools; these caps are per subsystem, not a claim about total draw calls.

## Verification

`node tests/addon-effects.cjs` exercises all 24 signatures with the actual bundled Three.js classes and anime.js runtime: finite geometry, unique anatomy, projectile following and expiry, paused contact seeking, mobile eviction/disposal, stationary zones, a measured 24m track line, exact Pyre annulus dimensions, distinct projectile/burst phases and consumed-decoy removal. The existing effect regression now checks all twenty divisions. GPU shader compilation and rendered appearance require the browser validation alongside these CPU lifecycle checks.
