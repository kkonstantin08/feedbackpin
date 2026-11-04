# Performance status

**Status: incomplete.** Browser CPU and memory measurements were stopped after the user reported excessive laptop load and asked to continue without browser runs. No claim is made about Chrome CPU, memory, long tasks, or responsiveness. The user has since chosen to disable screenshot capture for privacy, so the earlier pixel-mask issue is no longer in the shipped capture path. Do not restart browser measurements without the user's permission.

## Environment and method

- Machine: Apple Silicon Mac, macOS 27.0.1.
- Earlier functional runs used Playwright 1.64.1 and Chrome for Testing 156.0.8078.4.
- Those runs exercised the extension flow but were not a performance experiment: they had no CPU sampling, memory snapshots, long-task collection, fixed-duration baselines, or comparison across the requested states.
- A screenshot captured in an earlier development run showed a sensitive input value outside its mask. The generated image was deleted. Because late injection cannot find every closed ShadowRoot, the user approved disabling screenshots in the MVP. Existing local report images from development builds are preserved; new report messages discard image payloads.

## Measurements available without a browser

Measured from the local production build on 2026-11-05 with `npm run build`:

| Artifact             |       Raw |     Gzip |
| -------------------- | --------: | -------: |
| On-demand selector   |   6.77 kB |  2.81 kB |
| Service worker       |   1.57 kB |  0.80 kB |
| Popup JavaScript     |   2.38 kB |  1.10 kB |
| Dashboard JavaScript |   6.85 kB |  2.50 kB |
| Shared React runtime | 219.40 kB | 68.53 kB |
| Popup CSS            |   2.53 kB |  1.02 kB |
| Dashboard CSS        |   8.43 kB |  2.42 kB |

These are build artifact sizes, not runtime CPU or memory measurements. The injected selector is checked by `npm run check:build` for a standalone script with no import statements. Unit tests exercise selection teardown and report behavior.

The manifest is statically checked to use only `activeTab` and `scripting`, with no `content_scripts`, host permissions, or optional permissions. Thus the shipped extension does not register page code at navigation time. This static property does not measure whole-browser CPU or memory.

## Required browser matrix (not measured)

| State                                   | CPU / memory | Start latency | Long tasks / page responsiveness | Cleanup                                                                        |
| --------------------------------------- | ------------ | ------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| No extension                            | Not measured | N/A           | Not measured                     | N/A                                                                            |
| Installed, inactive                     | Not measured | N/A           | Not measured                     | No page injection is registered in the production manifest                     |
| Selection active                        | Not measured | Not measured  | Not measured                     | Unit cleanup tests pass; browser listener count not measured                   |
| After text-only report save             | Not measured | N/A           | Not measured                     | Screenshot capture and image processing are absent                             |
| After selection close                   | Not measured | N/A           | Not measured                     | Unit tests confirm host removal and no post-close selector response            |
| Repeated open / close                   | Not measured | Not measured  | Not measured                     | Earlier E2E repeat passed; latest source revision was not run in a browser     |
| Long document and dynamic React fixture | Not measured | Not measured  | Not measured                     | Earlier functional E2E passed; latest source revision was not run in a browser |

This matrix remains a release blocker for any performance claim. It must be run on ordinary, long, and dynamic pages with short, sequential browser sessions, recording conditions and exact results. No browser should be started for this purpose without the user's permission.

The size table above is a build measurement only. It does not establish runtime performance.
