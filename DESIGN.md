# ZenFlow Racer interface contract

The player chooses a racer and circuit, then races without interface chrome covering the road. The current upgrade replaces the former glass presentation throughout the title, showroom, HUD, settings, pause, loading and results.

## Art direction
Opaque motorsport timing boards and pit-wall equipment, with the playable Three.js world providing atmosphere. Warm ivory #f4f1e8, ink #19202b, elevated ink #28313e, lavender #c9bce9, coral #ef765e and restrained cyan #8fd5dc. No frosted glass, blur, translucent cards, neon text, chrome gradients or screenshot backdrops. Racer portraits remain renders of the actual models. Strong condensed Rajdhani 700 typography; system sans for supporting copy; tabular race numerals. No additional UI library: existing semantic DOM controls already fit the engine and need no framework dependency.

## Layout and components
Four-point spacing scale; 2px panel corners; hard strokes, flat surfaces and sparing offset shadows. Asymmetric title with numbered actions over the live scene. Driver specifications and circuit list frame the real 3D showroom. Desktop HUD uses compact timing boards. Portrait layout puts the showroom above specification panels; short landscape layouts scroll naturally. Minimum 44px primary controls. Safe-area insets remain in force.

## States and motion
Coral primary action, ivory secondary action, lavender selected state with border and textual selected indicators. Keyboard outline is 3px cyan; disabled controls visibly muted. Anime.js performs short opaque scene wipes and staggered menu arrivals only on real screen entry; no idle ornamental motion. Reduced motion skips movement and scene fades. Modal focus containment, escape actions and existing keyboard semantics remain intact.

## Validation
Check title → selection → race → pause → results and settings keyboard focus, responsive overflow at phone portrait/landscape and desktop, and legibility against real gameplay. Browser inspection and engine test suite provide evidence; physical-device behavior requires real-device measurement.

## Wave 2 loadout
Twenty selectable divisions retain twelve-kart race grids. A compact Loadout action below the signature power opens an opaque equipment drawer with searchable add-ons, cooldowns and gameplay descriptions. Equip one of all 24 source powers per racer, or leave the slot empty. The original character → circuit → race flow remains mandatory. F / left-stick press / ADD-ON casts independently of Q / Y / POWER. The loadout dialog traps focus, returns it on close, and uses 44px controls with a scrollable list on compact displays. Contact animations use simulation-driven Anime.js envelopes so pausing freezes them.

## Connected racers and circuit cards
Racer hands are constrained to the steering rim after the additive clips, with the original sleeve geometry bending and shoulder attachment retained. Victory and spinout can intentionally release grips. Loaded karts receive contact shadows and two batched cockpit assemblies. Skies use animated cloud layers and tiered shader cost (desktop/mobile/LOWFX), with dimensional horizon ridges and landmark foundations.

The three commissioned circuit-card illustrations in `assets/map-cards/` are explicitly embedded in the selection menu at the user's request. This is an exception to the previous menu-art restriction: reference sheets remain excluded from runtime, and all racing scenery stays playable 3D. Track-outline canvases still trace the actual circuit spline. The equipment dock appears before the showroom and remains available in both character and circuit setup; one bonus power is saved per division.
