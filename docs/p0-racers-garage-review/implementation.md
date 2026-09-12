# P0 Garage and controller follow-through

Baseline: main after PR #24, `96afc2c8c12595bab96e71bb8722d18057b77e9b`. Fresh branch: finish/p0-racers-garage-controls.

The user approved existing work except riders and karts. This preserves approved maps, economy and track timing, without altering historical review scores or manufacturing phone telemetry.

The Garage now shows the actual animated kart and rider, with shared gameplay models and saved build details. Drag/keyboard rotation, reduced motion, resizing, resource cleanup and new canvases after reopening are supported. It owns its own PMREM reflection target: GPU render targets are never shared between renderers. Background gameplay rendering pauses while the modal is open. Roster preview refreshes when equipment changes.

| Upgrade | Visible hardware |
| --- | --- |
| Tires | Tread shoulders and rim details |
| Motor | Engine housings and animated fans |
| Aero | Supported wing |
| Suspension | Wheel-mounted coil assemblies |
| Energy Core | Caged emissive energy housing |
| Armor | Bolted protection rails |

ADD-ON is beside POWER in the touch controller, with icon, cooldown and empty-slot state. F and L3 retain their independent binding. Disabled input is ignored; pointer cancellation clears only its pending action.

The all-20 art pass changes real geometry/materials rather than imagery: fuller tailored suits, fitted collars, sculpted helmets, rubber tires and machined wheel detail. Rider macro silhouettes still share substantial similarities. Strict P0.6 identity acceptance and final rider/kart approval remain open.

The execution workspace reset during the initial publish attempt. The implementation was reconstructed on continuation and reverified; prior local commit e8ee803 was never published. Diagnostic images in this branch are generated from the reconstructed files.
