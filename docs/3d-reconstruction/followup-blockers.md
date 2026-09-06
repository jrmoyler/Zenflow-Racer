# Follow-up reconstruction status

Base: main `891817ab2787a8d06371fcee304d9b34f155662b`, which merged PR #7's
`34fa43c004216216911320d75c68c55154e12fb9`. The follow-up uses a new branch.

The supplied user instruction authorizes another bounded modeling pass. That authorization
is preserved here; no new permission request is needed. However, the installed img2threejs
package has no documented review-resumption mutation. Its mandatory `forge/next.py` command
returns exit 3, `status=stopped`, against the committed state. `forge/state.py` exposes only
`init`, `status` and `mark`; marking work on a stopped state is explicitly rejected. The
documented `sync` operation does not reactivate a stopped local state. No manual status
rewrite, history reset, fabricated acceptance, or increased threshold/loop allowance was used.
Continuation needs the supported resumption-capable img2threejs package/process requested
by the user. The .95 fidelity target and all three rejection records are unchanged.

Blender 4.5.0 was downloaded through `tools/setup-blender.sh`, but its executable exits 139
(segmentation fault) even for `--version`; a background/factory-startup, one-thread attempt
also exits 139. No author/export pass ran. A working Blender runtime is independently needed.
The available browser renders Software 3D, not WebGL. No new WebGL captures exist, and old
Cycles or software images are not relabeled as WebGL evidence.

## Reference observations and unresolved views

Inspected the committed driver sheets, item sheet, all three gameplay sheets, original JPEG
selection/race references, author/export/render scripts, sculpt specification, rejected
reviews and the final ZenFlow GLB render. The uploaded source ZIP is an earlier source
snapshot; main, including PR #7's changes, remains the implementation authority.

The original JPEG shows AURA/FLORA/PYRA/LIRA, facial features/hair on some drivers and an
eight-racer HUD. The newer driver sheets show twelve named divisions with faceless bald
mannequins. Preserve the committed twelve-division contract; these images cannot all be
copied literally at once.

The driver-sheet kart thumbnails predominantly show a front three-quarter view. Standing
front/back mannequins do not provide seated joint deformation, cockpit clearance or head/hand
side views. Several gameplay panels show a driver's back alongside what looks like the
same front-facing nose motif (especially the Nexus turbine and Aether round lens). They do
not establish a unique, consistent rear design. Kart undersides, rear body panels and
cockpit interiors remain unresolved. Request orthographic front/rear/side/top kart views
and a consistent seated driver turnaround to settle those details.

The previous Cycles render still has softer generic head/jaw and abdominal contours,
different wheel shoulder/rim ratios and a split front fairing/headlight treatment that
differs from ZenFlow's thumbnail. Its darker studio backdrop, camera and occupied cockpit
also prevent a reliable pixel comparison with the unoccupied thumbnail. Do not optimize
geometry to that unaligned IoU score.

For the next supported pass, first match camera, object scale, occupancy and studio lighting;
save those parameters with the image and actual GLB hash. Then review silhouette, panel
boundaries, rim proportions and anatomical contours independently. Orbit views must include
front, side, rear, three-quarter and grazing light. A camera match is not a geometry pass.

| Scope | Identity to preserve / unresolved acceptance |
|---|---|
| ZenFlow / Hybrid | Split white fenders and cyan bonnet; Hybrid orange seam/pinstripes |
| Collective / Nexus | Bronze vertical-bar oval grille versus circular orange turbine |
| Kinetic / Juris | Open suspension and wings versus navy armor and gold shield nose |
| Signal / Vector | Long red arrow and swept fins versus silver jet wedge and twin tails |
| Loom / Helix | Purple crossing ribbons versus teal/orange rails; real negative space |
| Aether / Animus | Copper nose lens and antennas versus mechanical suspension and hovering drone |
| Cherry | Tiered pagodas, carved floating cliffs, waterfall spans, blossom crowns and curved barriers |
| Stormforge | Large ribbed circular forge portal, cranes, articulated industrial towers and orange apertures |
| Canopy | Giant branching trunk, terraces, transparent conservatory ribs and waterfalls |
| Items / powers | Six sculpted item forms and twelve distinct active powers; volumetric geometry/shaders |

All of these remain visually unaccepted. No new meshes were exported in this follow-up.
Gameplay geometry and the twelve articulated GLBs are preserved. Runtime lifecycle fixes
and the measurement recorder are independently testable, but do not complete either visual
fidelity or physical-device acceptance.
