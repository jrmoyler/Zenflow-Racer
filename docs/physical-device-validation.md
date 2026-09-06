# Physical-device validation — still blocked

No physical phone measurements have been collected in this follow-up. No mobile
certification is claimed. The available browser reports Software 3D, with roughly
1,016 ms animation intervals, and is unsuitable for WebGL or phone acceptance.
No connected USB device endpoints, Android/iOS device tools, or real-device service
connector were available. Changing viewport dimensions does not change that fact.

## Access needed

A tester with physical iPhone/Safari and Android/Chrome, or an authenticated real-device
service session exposing those browsers, must run the final preview. Include a modern
phone in each family and an identified lower-end Android (for example a Galaxy A15).
Those are proposed test targets, not devices tested here. Service access must include
interactive multi-touch, rotation, background/resume, audio and download of results.
Supply credentials through the service's secure connection, not in a repository or chat.

## Reproducible run

1. Open the final deployment's `index.html?review=1` directly on the phone. Do not use
   the responsive iframe for certification. Open **Race measurements** and fill in the
   exact device, OS, browser version and environment; note power-saving mode, temperature,
   service session ID, network and whether this is a cold or warm load. Collapse the panel.
2. In Settings enable Touch controls. Run all three maps with the normal twelve-racer,
   three-lap field. Do not remove opponents or effects. Use items, drift and division
   powers throughout. A race is marked complete only by the actual finish logic.
3. For each map collect an uninterrupted race at the default settings. Run a second set
   using `?review=1&lowfx` only if needed; never combine the two settings into one result.
   Target 60 FPS on modern phones and stable 30 FPS on the named lower-end phone.
4. Separately perform a lifecycle/control run: portrait → landscape → portrait; simultaneous
   steering, drift, item and power; two fingers on drift; OS touch cancellation; background
   for 30 seconds then resume; mute/unmute; restart while paused; finish and use Next Circuit
   repeatedly through cherry → stormforge → canopy → cherry. Check engine/music recovery,
   wheel spin, steering pivots, articulated arms, pickups, cooldowns and collisions.
5. Export after each map and before navigating/reloading. The recorder retains at most
   six races and 120,000 samples per race; exports explicitly flag truncation. It is local
   and opt-in; there is no telemetry upload. Browser crashes lose unexported samples, so
   keep a separate tester incident log and screen recording. Missing exports are failures
   to investigate, never evidence of stability.
6. Put the JSON, screen recording/captures, service provenance and tester notes into the
   PR evidence. The export contains the deployed commit SHA, graphics settings and resource
   counts. Compare the SHA with the Vercel deployment before interpreting the results.

## What the export means

- `frameMs`: nearest-rank p50/p95/max of raw positive rAF intervals during racing. Active
  long stalls are retained. Countdown, pause, background and state boundaries are excluded;
  interruption events remain visible. Use uninterrupted runs for sustained performance.
- `averageFps`: frame count divided by the sum of measured intervals, not the mean of
  instantaneous FPS. `sustainedFps5s` describes consecutive non-overlapping windows of at
  least five seconds; an incomplete final window is excluded.
- `renderSubmissionMs`: CPU time spent in render calls from the preceding frame. It is
  **not GPU execution time** and cannot substitute for frame delivery cadence.
- `loadingMs`: navigation-to-playable-roster readiness, including model loading and world
  assembly. `sceneBuildMs` records synchronous race/map construction for each race.
- Samples also retain resolution ratio, rendered triangles/calls, simulation time and an
  effects-presence count (zones, projectiles, boosting/drifting/shielded/spinning racers).
  This is an activity proxy, not an inventory of every particle.
- Resource snapshots, errors, context loss/restoration, cancellation, visibility and resize
  events help explain failures. Hardware metadata is tester supplied; the export always
  says `not-certified`. A user-agent string cannot prove physical hardware.

## Results

| Device / OS / browser | Graphics | p50 / p95 frame ms | Sustained FPS | Loading / stability | Status |
|---|---|---|---|---|---|
| Physical iPhone / Safari | Not measured | Not measured | Not measured | Not measured | Access needed |
| Physical modern Android / Chrome | Not measured | Not measured | Not measured | Not measured | Access needed |
| Physical lower-end Android / Chrome | Not measured | Not measured | Not measured | Not measured | Access needed |

No LOD or effects reductions are presented as measured phone optimizations. Existing
resolution adaptation remains; non-finite input is rejected and resume resets its timing
history without resetting the chosen pixel ratio. Tests prove these code behaviors, not FPS.
