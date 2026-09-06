# Immersion pass (playable worlds)

This pass finishes the **playable** image2threejs follow-up: circuits, atmosphere,
water, weather and signature landmarks are real Three.js / WebGL geometry and
shaders inside the game. It does **not** reopen the stopped img2threejs review
state or claim the 0.95 pixel-IoU likeness target.

## What shipped

- Animated sky (sun disc, drifting clouds, high-atmosphere sparkle).
- Per-circuit weather fields: cherry petals, Stormforge embers, Canopy spores.
- Shader water on island ponds and the Canopy sea.
- Pulsing track edge lights, lantern avenues, ground mist.
- Signature landmarks: moon + torii avenue + pagoda (Cherry), ribbed forge
  portal with cranes (Stormforge), ancient trunk, bioluminescent caps and
  circling fauna (Canopy).
- Map-switch disposal is unchanged: immersion meshes live in `world`.

## What remains out of scope

- Exact photographic reconstruction of the reference sheets (documented in
  [followup-blockers.md](followup-blockers.md)).
- Physical iPhone/Android certification.
- Replacing vendored Three r128 (the certified Vercel/runtime pin).

Blender 4.5 remains an optional offline authoring tool via
`bash tools/setup-blender.sh`. It is not part of the Vercel build.
