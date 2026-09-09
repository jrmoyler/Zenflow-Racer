# ZenFlow Racer — Wave 2 Chassis Pack

Source game: https://github.com/jrmoyler/Zenflow-Racer  
Scope: analyze existing 12 chassis, then author the 8 missing Collective AI Inc divisions so coding agents can rebuild them in Three.js r128 + Blender 4.5 using the live rig contract.

These images are **visual targets**, not runtime assets. The game never projects PNGs onto meshes. Follow `docs/playable-assets.md` and `.img2threejs/vehicle/` in the repo.

---

## 1. What the existing game actually builds

### Engine / pipeline
- Runtime: Three.js r128 procedural `buildKart(div)` in `vehicles.js`.
- Materials: canvas PBR generated once per division in `kart-materials.js`.
- Animation: shared Blender clips in `kart-clips.js` layered additively onto named rig nodes.
- Optional playable GLBs in `assets/models/*.glb` loaded if present.
- Blender path: `export-kart-rig.cjs` → `build-kart-rig-blender.py` → `author-kart-clips.py` → `export-kart-clips.py` → `render-karts-blender.py`.
- Coordinate map: Three `(x, y, z)` → Blender `(x, -z, y)`. glTF Y-up, Three forward `-Z`.

### Shared visual language (must not break)
Coachwork language: `references/art/division-karts-01.png` and `division-karts-02.png`.
Pilot language: `docs/race-pilot-review/` — the current twelve playable GLBs use **dressed race pilots**, not the older bare polymer figures. `dressRacePilot()` in `vehicles.js` and `tools/author-playable-karts.py` (`woven-race-suit`) are the source of truth.

| Rule | Spec |
|---|---|
| Body | White / pearl dielectric coachwork is 60%+ of the silhouette |
| Accent | One division color only: inlay, lamps, wheel rings, suit piping, helmet trim |
| Pilot | Finished racing uniform. Dark charcoal woven suit `#182532`, roughness 0.78, metalness 0.02, no clearcoat. White enamel helmet, mirrored visor, dark gasket, accent chin/crown. Harness, gloves, boots, shoulder pads. Head-mesh stays inside the helmet for the clip contract. |
| Cockpit | Open monocoque, black well, steering wheel reachable by both gloved hands |
| Wheels | Four large rounded shells, luminous accent ring on each, rest at `KART_WHEEL_REST` |
| Backdrop | Pale cool studio gray-blue for sheet art; game lighting is dynamic |
| Restraint | No sponsor wrap, no competing accents, no extra riders, no logos, no bare translucent body |

### Existing roster (12)

From `core.js` `ROSTER`:

| id | name | code | game acc | coachwork family in `buildDivisionCoachwork` |
|---|---|---|---|---|
| zenflow | ZenFlow | ZF-01 | #20CFF5 | sculpted split fairing + swept headlamp |
| collective | The Collective | TC-01 | #065F46 | bronze tourer grille + broad fenders |
| hybrid | Hybrid Living | HL-01 | #0EA5E9 | split fairing + orange outriggers |
| nexus | Nexus Labs | NL-01 | #FF9E32 | turbine lip / ignition / rear turbines |
| kinetic | Kinetic Edge | KE-01 | #16A34A | slim nose + dual wings + exposed links |
| juris | Juris Guard | JG-01 | #C9A84C | armored flanks + nose shield |
| signal | Signal Velocity | SV-01 | #F43F5E | sharp wedge + canards + tail fins |
| loom | Binary Loom | BL-01 | #B869F3 | interlaced body ribbons |
| vector | Vector Shift | VS-01 | #CBD5E1 | sharp wedge + rear wing |
| aether | Aether Link | AL-01 | #B5451B | comms dish + orbital antenna |
| animus | Animus Prime | AP-01 | #22D3EE | coils + companion drone |
| helix | Vital Helix | VH-01 | #14B8A6 | interlaced ribbons + copper helix |

Note: several **game accents diverge from Design System Bible v3**. Wave 2 uses official Bible HEX values so new chassis stay on-brand. Do not retcon the existing 12 unless JR asks.

### Shared rig contract (do not invent new pivot names)

```
root `${name} Reference Chassis`
  body
    coachwork meshes (batched unless named)
    open-cockpit-monocoque
    contoured-seat
    cockpit-well
    steering-column
    steering-wheel
      steering-wheel-rim, steering-hub, steering-spoke, shift-paddle,
      wheel-thumb-button, wheel-telemetry-display, wheel-center-marker
    exhaust-l, exhaust-r
    pilot
      torso
      head
        head-mesh, hair?, helmet-*, halo (hidden), star (hidden)
      arm-l / arm-r
        arm-*-mesh, suit-shoulder-pad, racing-glove
  wheel-fl / wheel-fr / wheel-rl / wheel-rr
    spin > rounded-wheel-shell, recessed-colored-hub, translucent-tire-band, machined-wheel-spokes
    wheel-light-ring
  underbody-flow-ring
  aegis-shield (hidden)
```

Addressable names used by clips / FX (`KART_RIG_NAMES`):
`body, pilot, torso, head, head-mesh, hair, arm-l, arm-r, arm-l-mesh, arm-r-mesh, steering-wheel, steering-wheel-rim, exhaust-l, exhaust-r, wheel-fl, wheel-fr, wheel-rl, wheel-rr, spin, wheel-light-ring, underbody-flow-ring, aegis-shield, halo, star`

Pivots:
- `PILOT_NECK = [0, 1.2, 0]`
- `PILOT_SHOULDER = [.34, .9, .02]`
- `KART_WHEEL_REST = [[-1.23,.6,-1.25],[1.23,.6,-1.25],[-1.23,.6,1.28],[1.23,.6,1.28]]`
- Pilot rest: `pilot.position = [0, 1, .37]`
- Steering wheel rest: `[0, 1.45, -.34]`, `rotation.x = -0.7`

Clip states (already authored, reuse for Wave 2):
`idle, drive, drift, boost, spinout, hit, victory, defeat`

### Pilot uniform contract (`dressRacePilot`)

Every Wave 2 kart must call the same dresser. Do not ship a bare polymer body.

Shared kit (parented to existing pivots):

| Node | Parent | Material | Notes |
|---|---|---|---|
| helmet-shell | head | white enamel | ellipsoid over head-mesh |
| helmet-visor-gasket | head | rubber `#10151d` | dark seal |
| helmet-mirrored-visor | head | Physical visor, metalness 0.72 | palette rotates by roster index % 4 |
| helmet-chin-guard | head | panel (accent) | |
| helmet-crown-stripe | head | panel | |
| helmet-ear-lock ×2 | head | metal | |
| helmet-cheek-rail ×2 | head | panel | |
| helmet-aero-blade / comms-pod / top-vent / rear-spoiler | head | panel | variant = roster index % 4 |
| shoulder-harness ×2 | pilot | rubber | |
| harness-stitched-edge ×2 | pilot | white | |
| harness-buckle | pilot | metal | chest |
| suit-raised-collar | pilot | rubber | torus at neck |
| suit-front-zip | pilot | metal | |
| suit-side-piping ×2 | pilot | panel | accent |
| suit-shoulder-pad ×2 | arm-l / arm-r | panel | |
| racing-glove ×2 | arms | rubber | |
| glove-knuckle-plate ×2 | arms | white | |
| racing-boot ×2 | pilot | rubber | |

Wave 2 helmet variants (continue the existing `% 4` cycle; roster index 12–19):

| id | index | variant |
|---|---|---|
| ledger | 12 | aero blades |
| terra | 13 | comms pods |
| obsidian | 14 | crown vents |
| civic | 15 | rear stabilizer |
| cognara | 16 | aero blades |
| gaia | 17 | comms pods |
| nomad | 18 | crown vents |
| eon | 19 | rear stabilizer |

Suit material remains the shared woven charcoal. Accent appears only as piping, shoulder pads, chin guard, crown stripe, and helmet variant parts. Visor colors stay in the existing four-swatch loop (`#153544`, `#362c18`, `#192d44`, `#402712`).

Materials from `kartMaterials(div)`:
`white` (pearl livery Physical), `dark` (carbon Standard), `panel` (accent Physical + emissive), `glow` (emissive Standard), `skin` (pilot Physical), `metal` (brushed Physical), `tyre` (Standard).

UV convention: u around cross-section (0 top, .25 right, .5 underside, .75 left), v along length (0 front, 1 rear).

---

## 2. Missing divisions (Wave 2)

Official Bible accents. Game-side ids stay lowercase slugs.

| # | id | name | role | code | acc | acc2 | base | stats S/A/H/W | mark | power proposal |
|---|---|---|---|---|---|---|---|---|---|---|
| 13 | ledger | Quantum Ledger | FinTech & Web3 | QL-01 | #8B5CF6 | #EDE9FE | #0B0814 | 3,3,5,4 | hex | VAULT LOCK — 4s token/item freeze on rivals in 16m |
| 14 | terra | Terra Axis | Physical Infrastructure | TA-01 | #2563EB | #93C5FD | #071018 | 3,2,4,5 | pylon | ANCHOR SPAN — 3.5s mass lock, ignore bump displacement |
| 15 | obsidian | Obsidian Arc | Unified Security | OA-01 | #EA580C | #1C1917 | #0A0807 | 4,3,3,5 | chevron | HARD PERIMETER — 4s opaque shield that blocks one plus shoves |
| 16 | civic | Civic Core | Non-Profit Soul | CC-01 | #7DD3FC | #F0F9FF | #071018 | 3,4,5,2 | halo | SHARED LANE — 5s slipstream gifted to nearest trailing ally/rival |
| 17 | cognara | Cognara Mind | Behavioral Science | CM-01 | #E0267E | #FCE7F3 | #14080F | 3,4,4,3 | wave | PREDICTIVE LINE — 4s ghost racing line + tighter steer response |
| 18 | gaia | Gaia Synthesis | AgriTech & Environment | GS-01 | #22C55E | #2563EB | #06140C | 3,4,4,3 | leaf | ROOT NET — 5s off-road grip restore + vine slow in your wake |
| 19 | nomad | Nomad Nexus | Global Mobility | NN-01 | #FBBF24 | #78350F | #120E08 | 4,3,4,3 | horizon | WAYPOINT HOP — 1.2s forward blink along current heading |
| 20 | eon | Eon Core | Longevity Science | EC-01 | #06B6D4 | #ECFEFF | #061418 | 2,5,4,3 | infinity | SECOND WIND — clear hit CD, refill 30% boost, resist next slow |

`stats` are 1–5 like the existing roster. Tune in playtest; do not hard-code handling elsewhere.

---

## 3. Chassis component inventories

Use these as the `buildDivisionCoachwork` branches. Keep the shared cockpit, seat, four suspension pipes, rear light signatures, and three diffuser fins.

### ledger — Quantum Ledger
Hero file: `quantum-ledger.jpg`
- Faceted crystal nose, not a long wedge.
- Hex-cell grille at fascia (reuse Nexus turbine-lip idea as a hex grid, not a fan).
- Honeycomb inlay on both flanks (`panel` material).
- Thin violet edge lights as `headlight-signature` ribbons.
- Low faceted rear cowl. No rear wing.
- Identity details: hex grille, honeycomb flank, purple rings.

### terra — Terra Axis
Hero file: `terra-axis.jpg`
- Blunt pylon nose, squared panel seams.
- Blue structural rails as `suspension-link` / hulls under white arches.
- Broad fenders (`fenders(true)`).
- Exposed beam chassis between wheels. Heavier visual mass.
- Identity details: overpass arches, blue rails, block headlight bar.

### obsidian — Obsidian Arc
Hero file: `obsidian-arc.jpg`
- Reuse `signal`/`vector` sharp path: `nose(2.45, .52, 1.00)` + canards + tail plates.
- Black carbon `dark` insets on shoulders.
- Threat-orange slit headlights + nose chevron plate.
- Razor endplates, no rounded grille.
- Identity details: chevron, knife canards, orange slit lamps.

### civic — Civic Core
Hero file: `civic-core.jpg`
- Full-radius fenders, oval single-lamp nose.
- Halo torus behind the cockpit (`halo` group can stay hidden for the power; add a visible `civic-halo-hoop` mesh on body).
- Soft oval headlamps using `glow`.
- No sharp wings. Warm, unaggressive silhouette.
- Identity details: rear halo hoop, round lamps, pill-like body.

### cognara — Cognara Mind
Hero file: `cognara-mind.jpg`
- Soft lab-kart shell, continuous white volume.
- Dual circular sensor pods on the nose (`ring` + `glow` cores).
- Rose neural ribbon from nose over the bonnet into the cockpit shoulder (`kartRibbon`, `panel`/`glow`).
- Keep the ribbon as geometry, not a texture decal of a literal brain if the reconstruction gets noisy. The sheet art is allowed to be more illustrative than the runtime mesh.
- Identity details: two eye-pods, one continuous wave ribbon.

### gaia — Gaia Synthesis
Hero file: `gaia-synthesis.jpg`
- Closest to `loom`/`helix` interlaced ribbons.
- Leaf-shaped fenders, seed-pod rear fin.
- Green vine ribbons + very thin circuit-blue traces (`acc2` only as 1–2 subordinate ribbons).
- Identity details: leaf fender, vine wrap, pod fin.

### nomad — Nomad Nexus
Hero file: `nomad-nexus.jpg`
- Raised ride: keep wheel pivots at the contract Y, but visual arches sit higher and tyres use the kinetic/animus rubber path (`tyre` not white shell).
- Horizon-sand shoulder stripe ribbon.
- Side case pods (`sculptedPanel` boxes parented to `body`, not wheels).
- Rear luggage rail as three metal tubes. Coil springs visible like Animus.
- Identity details: sand stripe, side cases, knobby tyre + glow ring.

### eon — Eon Core
Hero file: `eon-core.jpg`
- Calm medical tourer. Smooth closed lofts, no armor.
- Aqua infinity / double-ring on the nose (`two torus rings` or a ribbon figure-eight).
- Centerline spine light from nose to cockpit (`glow` ribbon).
- Quiet rear diffuser, no wing.
- Identity details: infinity nose, spine light, aqua rings.

---

## 4. Three.js implementation sketch

Add the eight objects to `ROSTER` in `core.js`. Extend `KART_ORDER` in `kart-materials.js`. Add `widths` entries (~0.03–0.08). Keep livery generator generic.

In `buildDivisionCoachwork` add `else if` branches **before** the generic `else`. Suggested order after existing specials:

```js
} else if (id === 'ledger') {
  // hex grille + honeycomb flanks
} else if (id === 'terra') {
  // pylon nose + blue rails + broad fenders
} else if (id === 'obsidian') {
  // sharp wedge + chevron + carbon shoulders
} else if (id === 'civic') {
  // round lamps + halo hoop
} else if (id === 'cognara') {
  // dual pods + neural ribbon
} else if (id === 'gaia') {
  // vine ribbons + leaf fin (helix-like)
} else if (id === 'nomad') {
  // stripe + cases + coils
} else if (id === 'eon') {
  // infinity rings + spine light
}
```

Tyre material switch in `buildKart`:
```js
div.id === 'kinetic' || div.id === 'animus' || div.id === 'nomad' || div.id === 'terra'
  ? tyre : white
```

Metal tint list: add `terra` (steel `#708CA3`), `obsidian` (dark steel), `nomad` (warm bronze from `acc2`).

Triangle budget: stay under 50k per kart including pilot. Reuse `KART_GEO` for shell/tyre/pilot. Division identity is extra ribbons/plates only.

---

## 5. Blender reconstruction contract

Follow `tools/build-kart-rig-blender.py` and `docs/playable-assets.md`.

1. Export live `buildKart()` with `node tools/export-kart-rig.cjs .tools/kart-rig`.
2. Rebuild collections named by division id. Placeholder Empties for any missing contract node.
3. Principled BSDF:
   - white: base 0.94, roughness 0.18, clearcoat 1.0, clearcoat roughness 0.12, metalness 0.22
   - dark/carbon: base 0.08, roughness 0.35, metalness 0.15
   - panel: base = acc HEX, emission = acc, strength 0.08–0.35
   - glow: emission = lightened acc, strength 1.4–2.0
   - skin/pilot: acc mixed 35% toward `#17202b`, transmission 0.35–0.55, roughness 0.18, IOR 1.4
   - metal: metalness 0.85, roughness 0.22
   - tyre: roughness 0.85, metalness 0
4. Do **not** bake sheet-art lighting into albedo. Identity color lives in material, not texture photos.
5. Animation: reuse existing Actions. New chassis must contain the same node names so `kart-clips.js` plays without new authoring.
6. Export glTF: Y-up, no Draco required, keep `zf_runtime_name`, `zf_visible`, `zf_root` extras.
7. Review: three-quarter idle frame + front/side/rear stills into `docs/kart-review/` using the existing render script.

Hidden geometry inference (single 3/4 sheet):
- Rear is inferred from family (tourer / sharp / ribbon / hauler).
- Underside is the existing lofted floor + flow ring.
- Pilot legs are the shared `torso` merge; do not invent new anatomy.
- If a sheet shows a literal graphic (Cognara brain, Eon infinity), prefer a simplified geometric stand-in that reads at race camera distance.

---

## 6. Quality gates before calling a chassis done

- Silhouette reads at showroom camera `[5.5, 2.9, -7.3]`.
- Accent HEX is the only saturated color besides white/carbon/metal.
- All contract nodes exist; clips idle/drive/drift/boost still bind.
- Wheel pivots stay on `KART_WHEEL_REST`.
- No second division accent. Gaia may use one thin circuit-blue ribbon only.
- Runtime triangle count < 50k. Dispose path still shared-geometry safe.
- Image is a target. Runtime match is structural + material, not pixel.

---

## 7. File map

| File | Division |
|---|---|
| quantum-ledger.jpg | ledger |
| terra-axis.jpg | terra |
| obsidian-arc.jpg | obsidian |
| civic-core.jpg | civic |
| cognara-mind.jpg | cognara |
| gaia-synthesis.jpg | gaia |
| nomad-nexus.jpg | nomad |
| eon-core.jpg | eon |

Existing reference sheets to match against:
- `references/art/division-karts-01.png`
- `references/art/division-karts-02.png`
- `docs/playable-lineup/*-front.png`
