# Power effects: staging and impact

Every special move plays out in three beats.

1. **Cast.** Energy pulls in toward the kart. The release follows 0.12 s later: a short
   coloured flare, a ground shockwave, a scorch mark that cools over about 2 s, speed-stretched
   sparks, rising embers and a light pulse on the road. The player's own casts add a small
   camera kick. All of this lives in `power-vfx.js` (`powerVFX.cast`).
2. **Presence.** The effect's own form, anchored by a rotating ground sigil in the division's
   colour. Each division has its own sigil, drawn with a varying number of sides.
   `effects.js` builds that form from a small set of authored primitives (`stagePower`):
   - a fresnel field dome for Time Dilation, Phase Walk, Impact Drive, Verdict Mirror, Vault
     Lock and Obsidian's perimeter;
   - a volumetric beam: the Sonic Lance runs to the rival it will strike, and Vector and
     Nomad leave blink streaks;
   - light pillars for the Nexus hologram, Aether, Helix, Eon, Collective and Terra's four
     pylons.

   While a field is active, a pooled light casts its colour onto the road and nearby karts.
   Add-on hazards carry a sigil at their true footprint, so a zone 30 m ahead still reads.
3. **Contact.** Every landed hit, block or slow gets its own confirmation: a flash, a spark
   fountain, a shock ring and a light pulse on the struck kart (`powerVFX.impact` /
   `powerVFX.touch`).

## Readability rules

- **Pale circuits:** a purely additive glow vanishes on Cherry Blossom Skyway's pale road.
  Halos, decals and sigils are therefore drawn with normal blending, in a deepened version of
  the division's colour, over a darkened rim bed. Only the cores, sparks and flares are
  additive.
- **Energy surfaces:** these are lifted into HDR and saturated rather than whitened.
- **Bloom:** only HDR light blooms (bloom threshold 1.0). A boost intensifies the bloom
  without lowering the threshold, so lit scenery no longer hazes over during boosts and casts.
- **Screen flash:** the cast flash is a brief coloured pop. The full-screen white flash on the
  player's own cast was cut from 0.22 to 0.08.

## Budgets

`power-vfx.js` allocates everything once:
- one `Points` for motes;
- one `LineSegments` for sparks;
- 14–28 sprites;
- 8–16 decals;
- 1–3 point lights.

The light count never changes during a race, because in this Three.js version that would
recompile every shader. `tests/power-vfx.cjs` checks that repeated casts never grow the scene
or change the light count, and that everything returns to rest.

## Evidence

`docs/power-vfx/` holds real WebGL captures (ANGLE/SwiftShader) of every signature power and
add-on at 0.25, 0.8 and 1.6 s, plus before/after rows.
