# Wave 2 integration verification

Built on main `9a5c5cab9940f442bf7a7e9d26634696a60086fa`, preserving the merged guided setup and dense-world work. The uploaded HTML/ZIP contain an older baseline; the current repository remains authoritative. All three supplied markdown specs and both JPEGs are committed under `references/` as design inputs, excluded from the runtime build.

## Delivered

- Eight added divisions bring character selection to twenty; each race retains a twelve-kart grid.
- Eight actual Blender-authored GLBs retain the dressed pilot, four wheel pivots and all eight animation states. All original twelve GLB bytes are preserved. The new models each have 45,411–45,449 triangles.
- Twelve tightened signature powers and eight Wave 2 powers use the shared deterministic rules. Specific per-power locked rules resolve contradictions in the supplied general overview: Juris reflects hits only; regeneration blocks slows; Obsidian's shield is reserved for hits.
- Both upstream repositories were inspected at pinned revisions. Their full unique inventory is 24 powers: ten casting abilities, seven other live abilities, three self-buffs and four archived elements. Duplicate archived copies are mapped once. Original flat-floor demo behavior is adapted to the racing spline.
- One optional add-on is saved for each racer. Character confirmation and circuit selection remain mandatory. Keyboard F, gamepad left-stick press and a touch ADD-ON button operate independently of signature powers and track pickups.
- Contact effects use real Anime.js timelines manually advanced by simulation time; pause cannot progress them. Projectile, zone and collision geometry share authoritative entity poses and lifetimes.

## Reproducible local checks

`npm run verify` completed with exit code 0 after the final runtime/model correction:

- 106 game regression cases, including twenty new divisional physics/world cases.
- 31 add-on gameplay cases covering every power, shielding/reflection/phase, swept contacts, lap seam, cooldowns, pause, finish and bounded entity cleanup.
- Nine actual Three.js/Anime.js VFX checks: finite geometry, paused animation, retirement/disposal, phase-specific projectiles, Pyre safe/threat radii and authoritative zone following.
- Loadout handler tests: all24 choices plus empty, search, per-division persistence, malformed saves, focus return, input guards and HUD state.
- Original setup, telemetry, world density, presentation, lighting, ceremony and manufactured-item geometry suites.
- Production build, 44 entrypoint resource/offline requests, dependency order, all20 model files and cache integrity.
- Desktop/mobile geometry profiles across all20 procedural chassis and three maps; real GLTFLoader, all eight clips, material independence, ghost clones and resource disposal on all20 exported models.

The complete20-model download is 18.30MiB. Original models exceed the new50k per-model budget and remain unchanged by request; the eight new assets meet it. Geometry/profile tests do not measure physical mobile frame rate.

## Render evidence

`docs/wave2-review/README.md` links the lineup and front/side/rear views of each final exported GLB. Render-manifest hashes match the shipping assets. Initial rejected Ledger views, the first unsuccessful backing method and the final XY extrusion correction remain recorded. No legacy image-fidelity state was reset or relabeled as accepted. The eight written inventories supplied component targets; individual Wave2 hero JPGs were not attached, so these are authored interpretations, not exact likeness claims.

## Hosted checks and remaining limits

PR16's runtime commit `cf4d173d0e6397d20f4fec4609df8cd97a22da37` deployed successfully to Vercel (`READY`). Its runtime assets match the locally verified source; later commits append evidence only.

GitHub Actions reported: “The job was not started because your account is locked due to a billing issue.” No runner steps executed. Workflow gates remain intact; local verification and Vercel deployment succeeded independently.

After the user explicitly approved temporary preview access, the deployed game was opened and exercised in the connected browser. Character selection exposed all twenty racers and the loadout exposed all24 powers plus an empty slot. Search, equipping Pyre Crown on Quantum Ledger, persistence across navigation, mandatory circuit selection, entering a twelve-racer grid, add-on activation, paused cooldown and restart reset were observed through the actual UI. Search-to-result Tab movement and Escape focus return were checked in the phone viewport.

The 390×844 portrait loadout fit its viewport. The 844×390 landscape check revealed a clipped footer; `addon-ui.css` now compacts the short-screen header/search spacing and allows the list to shrink while keeping its own scroll. The production build, loadout tests and release/offline checks pass after that correction. Browser screenshots and the specific observations are in `docs/wave2-review/browser-playtest.md`.

The cloud browser selected the Canvas software fallback (reported in DOM renderer metadata and the review-page performance output), so this is a software-renderer functional smoke test. It does not establish WebGL shader compilation, all24 effects' rendered appearance, a completed race, gamepad hardware behavior or physical-device performance. The cloud frame cadence was about one frame per second; it is not a phone benchmark. Actual Three.js/Anime.js structural tests and Blender renders remain separate evidence. Localhost access remains blocked, and GitHub Actions still requires the account billing issue to be resolved.
