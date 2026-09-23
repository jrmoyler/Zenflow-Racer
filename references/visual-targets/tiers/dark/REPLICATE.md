# ZenFlow Racer — Dark Final 20 (no pale)

Visual targets. Not runtime textures. Rebuild as unique named meshes.

Rule this pack enforces:
- Zero pearl / white / cream coachwork
- Zero white helmets
- One Bible accent per division
- No two chassis share a silhouette family
- No two pilots share a helmet kit
- Deep Navy #050A18 studio

| File | id | Division | HEX | Silhouette | Pilot lid |
|---|---|---|---|---|---|
| 01-zenflow.png | zenflow | ZenFlow | #7C3AED | exposed neural lattice, hex lamp pods | faceted neural dome |
| 02-collective.png | collective | The Collective | #D4A843 | formal enclosed tourer + credenza grille | gold-brow obsidian |
| 03-hybrid.png | hybrid | Hybrid Living | #F59E0B | rounded classroom pod + progress rails | amber vented dome |
| 04-nexus.png | nexus | Nexus Labs | #DC2626 | turbine iris + rear cinema fans | crimson rear-fin |
| 05-kinetic.png | kinetic | Kinetic Edge | #16A34A | skeletal needle + dual wings | green aero-blade |
| 06-juris.png | juris | Juris Guard | #6366F1 | armored tankette + shield plate | rectangular visor |
| 07-signal.png | signal | Signal Velocity | #F43F5E | coral dart + canards + tail fins | slash-mark wedge |
| 08-loom.png | loom | Binary Loom | #00D9B5 | woven teal ribbon beams, no shell | teal ear-pod |
| 09-vector.png | vector | Vector Shift | #CBD5E1 | drone-wing cargo wedge | silver aviator blades |
| 10-aether.png | aether | Aether Link | #34D399 | dish + orbital ring dominant | mint ear-pod |
| 11-animus.png | animus | Animus Prime | #22D3EE | mech plates + coil dampers + drone | cyan slit dome |
| 12-helix.png | helix | Vital Helix | #14B8A6 | DNA-tube spine + medical pod | teal crown-stripe |
| 13-ledger.png | ledger | Quantum Ledger | #8B5CF6 | hex vault armor | faceted purple vault |
| 14-terra.png | terra | Terra Axis | #2563EB | block-girder + twin pylons | blue-brow construction |
| 15-obsidian.png | obsidian | Obsidian Arc | #EA580C | knife interceptor + chevrons | orange slit combat |
| 16-civic.png | civic | Civic Core | #7DD3FC | pill buggy, zero edges | sky-blue rear-fin |
| 17-cognara.png | cognara | Cognara Mind | #E0267E | dual sensor orbs + neural grooves | rose visor band |
| 18-gaia.png | gaia | Gaia Synthesis | #22C55E | branch lattice exoskeleton + knobbies | green field visor |
| 19-nomad.png | nomad | Nomad Nexus | #FBBF24 | overland cage + sand hoop + travel pods | sand touring band |
| 20-eon.png | eon | Eon Core | #06B6D4 | long streamliner + infinity hoop | aqua touring visor |

Signal and Vector shots show the racer standing beside the chassis so the uniform reads. All others are seated. For game rigs, seat every pilot on the shared `pilot` node; keep the unique helmet/jacket meshes.

Do not collapse these back onto the old pearl split-fairing template. Each id needs its own `buildDivisionCoachwork` branch.
