# Racing overhaul — PR 14

Built from merged PR 13. No reference artwork was inserted into the playable scene.

| Requested area | Implementation |
| --- | --- |
| Finished characters | Twelve regenerated Blender GLBs with fitted matte suits, helmet/visor assemblies, collar, harness, gloves, boots, division equipment and cockpit controls. Independent rigs retained. |
| Realistic items and effects | Manufactured device housings and detailed hardware; actual-model icon renders; turbulent exhaust, smoke density, hot spark cores, layered signature fields, drone rotors and helix links. |
| Remove glass UI | Opaque ink/ivory panels with lavender/coral accents across all screens. No backdrop blur. Anime.js transitions and menu entrance motion respect reduced motion. |
| Racing world | Covered populated stands, multi-bay garages, sector structures, kerbs, barriers, road wear and corner markers across all three circuits. Ten instanced infrastructure batches. |
| Steering and rules | Speed-sensitive turning, stronger countersteer response, continuous analog deadzones, predictive AI lane holding, first-connected controller support, safe key release and reverse-crossing split protection. |

## Verification

`npm run verify` passed on the integrated source and final GLBs. It includes 85 gameplay cases, telemetry, venue clearance/disposal, presentation transitions, lighting contracts, podium lifecycle, all six manufactured items, offline build, all three map frames and all twelve actual model loads/animation/cloning/disposal.

Models total 11.77 MiB and 919,699 triangles across the complete roster. These are asset counts, not simultaneous visible geometry or mobile frame rates. Venue additions use shared instancing, with lower mobile crowd counts. Software rendering remains bounded to 480 × 320 pixels and 256-pixel material textures.

See `race-pilot-review/README.md` for actual Blender re-import render evidence and file hashes. See `3d-reconstruction/race-venue-pass.md` for road-envelope and resource checks. Tests do not certify photographic realism or exact reference likeness. Review history remains intact.

## Hosted browser observations

The PR preview loaded its title screen, twelve-racer selection and race settings. Selected Vital Canopy Run, enabled auto throttle and started a race. HUD advanced through lap 1 with speed rising from 114 to 132 km/h and live position/draft updates. Activating Time Dilation changed its ready state to a 19-second cooldown. Pause displayed its dialog; Resume dismissed it and advanced the race clock.

Screenshots in `racing-overhaul-browser/` show this hosted session. This browser used the Canvas software fallback, whose low-resolution output does not represent WebGL visual quality. No application runtime error was observed; unrelated browser-extension metadata errors were excluded. A full race finish and physical mobile/controller/GPU performance were not exercised in this browser. Automated gameplay and model checks cover additional logic paths, but do not replace device playtesting.
