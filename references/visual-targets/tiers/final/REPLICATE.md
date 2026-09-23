# ZenFlow Racer — Final 20 Chassis Pack

Visual targets for Blender 4.5 + Three.js r128. These PNGs are **not** runtime textures. Rebuild as named meshes using the live rig in `vehicles.js` / `export-kart-rig.cjs`.

Source identities: Collective AI Design System Bible v3 — one accent per division, pearl body majority, dressed race pilots.

Studio: Deep Navy #050A18 cyclorama, 3/4 front-right, 35mm, single key from camera-left.

---

## Shared kit (every chassis)

| Part | Spec |
|---|---|
| Body | Pearl dielectric white, 60%+ of silhouette. Clearcoat 0.85, roughness 0.18. |
| Accent | One Bible HEX only: lamps, wheel rings, suit piping, helmet trim, coachwork inlays. |
| Pilot suit | Woven charcoal #182532, roughness 0.78, metalness 0.02. Raised collar, harness, gloves, boots. |
| Helmet | White enamel shell, rubber gasket #10151d, mirrored visor. Variant by index % 4. |
| Wheels | Four rounded shells at `KART_WHEEL_REST`. Luminous accent ring child. |
| Cockpit | Open monocoque, black well, steering wheel at `[0, 1.45, -0.34]`, rot.x `-0.7`. |
| Forbidden | Logos, text, sponsors, extra riders, second accent paint, bare polymer pilots. |

Rig names (do not invent):
`body, pilot, torso, head, head-mesh, arm-l, arm-r, steering-wheel, exhaust-l, exhaust-r, wheel-fl, wheel-fr, wheel-rl, wheel-rr, spin, wheel-light-ring, underbody-flow-ring, aegis-shield, halo, star`

Clips: `idle, drive, drift, boost, spinout, hit, victory, defeat`

Helmet variants: `0 aero-blade` `1 comms-pod` `2 crown-vent` `3 rear-stabilizer`

Materials: reuse `kart-materials.js` — pearl body, accent glow, woven-race-suit, helmet enamel.

Export: GLB, no Draco, <50k tris, `zf_runtime_name` extras. Three `(x,y,z)` → Blender `(x,-z,y)`.

---

## Roster

| File | id | Division | Code | Accent | HEX | Coachwork | Helmet |
|---|---|---|---|---|---|---|---|
| 01-zenflow.png | zenflow | ZenFlow | ZF-01 | Neural Violet | #7C3AED | split fairing + neural lattice | aero-blade |
| 02-collective.png | collective | The Collective | TC-01 | Matte Gold | #D4A843 | tourer + formal grille | comms-pod |
| 03-hybrid.png | hybrid | Hybrid Living | HL-01 | Learning Amber | #F59E0B | split fairing + amber outriggers | crown-vent |
| 04-nexus.png | nexus | Nexus Labs | NL-01 | Creative Crimson | #DC2626 | turbine lip + rear turbines | rear-stabilizer |
| 05-kinetic.png | kinetic | Kinetic Edge | KE-01 | Performance Green | #16A34A | slim nose + dual wings | aero-blade |
| 06-juris.png | juris | Juris Guard | JG-01 | Regulation Indigo | #6366F1 | armored flanks + nose shield | comms-pod |
| 07-signal.png | signal | Signal Velocity | SV-01 | Conversion Coral | #F43F5E | wedge + canards + tail fins | crown-vent |
| 08-loom.png | loom | Binary Loom | BL-01 | Electric Teal | #00D9B5 | interlaced body ribbons | rear-stabilizer |
| 09-vector.png | vector | Vector Shift | VS-01 | Velocity Silver | #CBD5E1 | wedge + rear wing | aero-blade |
| 10-aether.png | aether | Aether Link | AL-01 | Signal Mint | #34D399 | comms dish + orbital antenna | comms-pod |
| 11-animus.png | animus | Animus Prime | AP-01 | Arc Cyan | #22D3EE | coils + companion drone | crown-vent |
| 12-helix.png | helix | Vital Helix | VH-01 | Bio Teal | #14B8A6 | double-helix ribbons + rungs | rear-stabilizer |
| 13-ledger.png | ledger | Quantum Ledger | QL-01 | Quantum Purple | #8B5CF6 | hex vault facets | aero-blade |
| 14-terra.png | terra | Terra Axis | TA-01 | Infrastructure Blue | #2563EB | pylon stacks + girder sills | comms-pod |
| 15-obsidian.png | obsidian | Obsidian Arc | OA-01 | Threat Orange | #EA580C | knife wedge + chevron armor | crown-vent |
| 16-civic.png | civic | Civic Core | CC-01 | Hope Sky Blue | #7DD3FC | rounded pill nose | rear-stabilizer |
| 17-cognara.png | cognara | Cognara Mind | CM-01 | Cognara Rose | #E0267E | sensor orbs + neural grooves | aero-blade |
| 18-gaia.png | gaia | Gaia Synthesis | GS-01 | Synthesis Green | #22C55E | faceted vine lattice | comms-pod |
| 19-nomad.png | nomad | Nomad Nexus | NN-01 | Horizon Sand | #FBBF24 | waypoint roll arch | crown-vent |
| 20-eon.png | eon | Eon Core | EC-01 | Longevity Aqua | #06B6D4 | infinity hoop + touring shoulder | rear-stabilizer |

These HEX values are Bible-true. Live `core.js` still uses older game accents on some Wave-1 ids. Do not silently retcon runtime colors unless JR asks. New chassis (`ledger`–`eon`) should ship with the Bible HEX.

---

## Coachwork build notes

- **ZenFlow** — boolean lattice grooves in the pearl skin. Dual swept lamps. Violet only; lamp glass may read cool.
- **Collective** — horizontal grille bars, broader fenders, gold as metal inlay not wrap.
- **Hybrid** — softer radii, short outrigger plates in amber.
- **Nexus** — circular ignition in the nose, twin rear turbine cans.
- **Kinetic** — needle nose, short dual wing, exposed links.
- **Juris** — flat nose shield, faceted armored flanks, indigo edge light.
- **Signal** — wedge, front canards, twin tail fins, coral slash lamps.
- **Loom** — three geometric ribbon bands wrapping the body in teal (Bible teal, not the old purple).
- **Vector** — wedge + single rear wing, silver edge light only.
- **Aether** — dish + ring antenna parented to `body`, mint bars.
- **Animus** — coil springs as visible mesh, companion drone parented to `body` (not a clip node). Cyan exclusive.
- **Helix** — two tube strands + instanced rungs. Teal only.
- **Ledger** — hex inset panels, vault lip.
- **Terra** — two vertical pylons behind the seat, box-section sills.
- **Obsidian** — chevron plates, knife nose, orange slit lamps.
- **Civic** — full-radius nose, pill lamps, no canards.
- **Cognara** — two sphere sensors in the nose, rose grooves.
- **Gaia** — faceted branch lattice over pearl panels.
- **Nomad** — single roll arch (waypoint), touring shoulder, sand light.
- **Eon** — infinity-loop hoop behind the helmet, oval aqua lamps.

Named extra meshes (parent to `body`):
`comms-dish, orbital-antenna, companion-drone, helix-strand-a, helix-strand-b, vault-hex, pylon-l, pylon-r, waypoint-arch, infinity-hoop, sensor-orb-l, sensor-orb-r`

Keep extras under 2k tris each. They do not get clip tracks.

---

## Build order for agents

1. Start from `buildKart(div)` shared chassis.
2. Call `dressRacePilot` with roster index for helmet variant.
3. Branch `buildDivisionCoachwork(id)` for the silhouette family.
4. Assign Bible HEX to `div.acc` for Wave 2; leave Wave 1 runtime colors unless directed.
5. Export GLB matching `docs/playable-assets.md`.
6. Verify named nodes against `KART_RIG_NAMES` and finite transforms through all eight clips.
