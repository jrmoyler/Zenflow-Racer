# Deployment repair

At investigation, Vercel had one READY production deployment: the original direct-file upload, with no Git metadata. Neither the merged PR nor its head had a Vercel deployment/check. The merged source passed all 34 regression tests and built successfully on Node 24. There was no Vercel build failure to attribute to application code. GitHub Actions on the merge was separately blocked before starting by an account billing lock.

This patch makes the Git release path explicit: Node 24, npm ci, npm run verify, dist output and Git deployments enabled. Vercel runs the same regression/build/offline checks directly, without requiring a GitHub Actions deployment job. The source build copies only runtime assets, and the generated worker reads only its own release cache. Unversioned responses revalidate; the development worker no longer installs the obsolete v1 shell. Local preview does not register it.

The manual payload generator defaults to preview and preserves repository headers. Use `npm ci && npm run verify`, then `python scripts/deploy-payload.py` for a prebuilt preview payload. Production requires explicit `--target production`; manual upload is not proof that Git automatic deployments work.

If the PR receives no automatic Vercel preview, verify the Vercel GitHub App installation has this repository selected, then reconnect the existing zenflow-racer project in Settings > Git and retry. No code setting can grant missing GitHub App permissions. Existing project: prj_H3q9wwOjiqSrTYlb3KBMoqQ894Kh. Do not create a duplicate project.

The earlier exact-image fidelity and physical GPU/device testing limitations remain; this deployment patch does not mark those gates complete.
