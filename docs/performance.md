# Performance status

**Status: remote measurement pending.** The user asked that no browser be run on their laptop. A short, sequential Chromium measurement is being added to GitHub Actions only; no local browser or browser automation will be started. Until that remote run returns data, no claim is made about Chrome CPU, memory, long tasks, or responsiveness. Screenshot capture is disabled for privacy, so no page pixels are collected.

## Environment and method

- Machine: Apple Silicon Mac, macOS 27.0.1.
- Earlier functional runs used Playwright 1.64.1 and Chrome for Testing 156.0.8078.4.
- Those runs exercised the extension flow but were not a performance experiment: they had no CPU sampling, memory snapshots, long-task collection, fixed-duration baselines, or comparison across the requested states.
- A screenshot captured in an earlier development run showed a sensitive input value outside its mask. The generated image was deleted. Because late injection cannot find every closed ShadowRoot, the user approved disabling screenshots in the MVP. Existing local report images from development builds are preserved; new report messages discard image payloads.
- GitHub Actions run `41916953384` on commit `664d75a` passed lint, typecheck, all 31 unit tests, all 3 loaded-extension E2E tests, and production build on an isolated Ubuntu runner. This is functional verification only, not a performance measurement.

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

## Required browser matrix (remote run pending)

| State                                   | CPU / memory | Start latency | Long tasks / page responsiveness | Cleanup                                                              |
| --------------------------------------- | ------------ | ------------- | -------------------------------- | -------------------------------------------------------------------- |
| No extension                            | Pending      | N/A           | Pending                          | N/A                                                                  |
| Installed, inactive                     | Pending      | N/A           | Pending                          | No page injection is registered in the production manifest           |
| Selection active                        | Pending      | Pending       | Pending                          | Unit tests check listener removal; remote E2E checks the active flow |
| After text-only report save             | Pending      | N/A           | Pending                          | Screenshot capture and image processing are absent                   |
| After selection close                   | Pending      | N/A           | Pending                          | Unit and remote E2E tests confirm host removal after close/cancel    |
| Repeated open / close                   | Pending      | Pending       | Pending                          | Remote performance run samples CPU, memory, and page activity        |
| Long document and dynamic React fixture | Pending      | Included      | Pending                          | Remote run measures both fixtures independently                      |

The remote run samples each state for two seconds on ordinary, long, and dynamic pages in sequential isolated Chromium sessions. It records aggregate Chrome CPU and RSS, dedicated GPU-process CPU and RSS when Chromium reports one, page task/script time, JS heap, and long tasks. CI stores the raw JSON result as a 14-day artifact. Remote CI results do not describe the user's laptop hardware and short measurements have runner noise. No performance claim is supported until that run completes.

The size table above is a build measurement only. It does not establish runtime performance.
