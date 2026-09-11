# Merged PR review audit — 2026-09-11

Base: `main` at `2fcad84fde2e0d5bd7c234181911a9a91537070a`.

Reviewed all 22 merged PRs (#1–#22): 77 discussion entries, including conversation comments, review submissions, and inline comments. Independently queried review threads for every PR, including resolved/outdated state. Seven inline findings cover six distinct defects; two findings report the same hazard-visual eviction. Deployment notifications, completed-review summaries, and skipped CodeRabbit notices contain no additional code fixes.

| PR | Discussion entries | Inline findings |
| --- | ---: | ---: |
| [#1](https://github.com/jrmoyler/Zenflow-Racer/pull/1) | 2 | 0 |
| [#2](https://github.com/jrmoyler/Zenflow-Racer/pull/2) | 5 | 1 |
| [#3](https://github.com/jrmoyler/Zenflow-Racer/pull/3) | 3 | 0 |
| [#4](https://github.com/jrmoyler/Zenflow-Racer/pull/4) | 3 | 0 |
| [#5](https://github.com/jrmoyler/Zenflow-Racer/pull/5) | 3 | 0 |
| [#6](https://github.com/jrmoyler/Zenflow-Racer/pull/6) | 3 | 0 |
| [#7](https://github.com/jrmoyler/Zenflow-Racer/pull/7) | 3 | 0 |
| [#8](https://github.com/jrmoyler/Zenflow-Racer/pull/8) | 3 | 0 |
| [#9](https://github.com/jrmoyler/Zenflow-Racer/pull/9) | 3 | 0 |
| [#10](https://github.com/jrmoyler/Zenflow-Racer/pull/10) | 3 | 0 |
| [#11](https://github.com/jrmoyler/Zenflow-Racer/pull/11) | 3 | 0 |
| [#12](https://github.com/jrmoyler/Zenflow-Racer/pull/12) | 3 | 0 |
| [#13](https://github.com/jrmoyler/Zenflow-Racer/pull/13) | 3 | 0 |
| [#14](https://github.com/jrmoyler/Zenflow-Racer/pull/14) | 3 | 0 |
| [#15](https://github.com/jrmoyler/Zenflow-Racer/pull/15) | 5 | 1 |
| [#16](https://github.com/jrmoyler/Zenflow-Racer/pull/16) | 8 | 3 |
| [#17](https://github.com/jrmoyler/Zenflow-Racer/pull/17) | 3 | 0 |
| [#18](https://github.com/jrmoyler/Zenflow-Racer/pull/18) | 3 | 0 |
| [#19](https://github.com/jrmoyler/Zenflow-Racer/pull/19) | 3 | 0 |
| [#20](https://github.com/jrmoyler/Zenflow-Racer/pull/20) | 3 | 0 |
| [#21](https://github.com/jrmoyler/Zenflow-Racer/pull/21) | 3 | 0 |
| [#22](https://github.com/jrmoyler/Zenflow-Racer/pull/22) | 6 | 2 |

## Fix mapping

| Finding | Resolution | Regression coverage |
| --- | --- | --- |
| [Local worker cleanup, #2](https://github.com/jrmoyler/Zenflow-Racer/pull/2#discussion_r3942870478) | Unregister active/waiting/installing workers for this app's exact local sw.js URL; remove only ZenFlow caches. Keep unrelated app workers. | review-bootstrap: four local hosts, unrelated workers/caches, denied storage |
| [Orbitron startup, #15](https://github.com/jrmoyler/Zenflow-Racer/pull/15#discussion_r3960317536) | Await Orbitron 700/800 with Rajdhani before texture boot. allSettled keeps one font failure from prematurely releasing the barrier. | review-bootstrap: delayed fonts and partial failure |
| [Hazard cap, #16 P2](https://github.com/jrmoyler/Zenflow-Racer/pull/16#discussion_r3962982919), [duplicate P1](https://github.com/jrmoyler/Zenflow-Racer/pull/16#discussion_r3962984741) | Pin entity-backed telegraphs, evict optional visuals first, and omit optional contacts if all slots are pinned. Entity lifetime owns visibility; the existing 72-entity simulation ceiling bounds pinned visuals. | addon-effects: 72 concurrent hazards on mobile/desktop, contacts, lifetime and disposal |
| [Civic beneficiary, #16](https://github.com/jrmoyler/Zenflow-Racer/pull/16#discussion_r3962982922) | Exclude phased racers using gameplay's eligibility predicate. | addon-effects: nearest phased rival, eligible next rival, all phased |
| [Downhill roll, #22](https://github.com/jrmoyler/Zenflow-Racer/pull/22#discussion_r3984503292) | Apply slope gravity without throttle when brake is released, including at rest. | circuit-physics: downhill release and existing countdown/incline cases |
| [Contact closing speed, #22](https://github.com/jrmoyler/Zenflow-Racer/pull/22#discussion_r3984503298) | Project both speeds onto track forward, with heading-projected impulse response and effective inverse mass. | circuit-physics: separating sideways rear kart, equal-speed drifting leader, straight momentum/energy and anchored cases |

Historical threads remain intact; this PR supplies the fixes without rewriting their review history. Physical-device performance and exact reference-image acceptance are not claimed by this code-review pass.

## Validation

`npm run verify` completed with exit 0: 119 gameplay regression cases, all add-on gameplay/UI/effects suites, bootstrap and automatic-update lifecycle tests, production build, 51 offline entrypoint resources / 81 cached assets, desktop/mobile circuit geometry, and all twenty playable GLB assets. `git diff --check` passed. Main was re-fetched before publishing and remained at the audited base.
