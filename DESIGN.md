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
