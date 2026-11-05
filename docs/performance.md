# Performance

## Remote runtime measurements

**Run:** [GitHub Actions `41988254350`](https://github.com/kkonstantin08/feedbackpin/actions/runs/41988254350), commit `4c11272`, 2026-11-05. Measurements ran on the hosted CI runner, not on the user's laptop.

| Environment     | Value                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Runner          | GitHub Actions, Linux x64, 4 logical CPUs, 15,984 MiB RAM                                                            |
| Browser         | Chromium 156.0.8078.4                                                                                                |
| Pages           | Ordinary HTML, long document, dynamically rendered React fixture                                                     |
| Sampling        | Sequential isolated browser profiles; 2 seconds per state, plus one 35-second quiet interval                         |
| Result artifact | `feedbackpin-performance-<commit>/performance-results/feedbackpin-performance.json`, retained by Actions for 14 days |

CPU is summed across Chrome processes and shown as a percent of one logical core. RSS is resident memory summed over Chrome processes reported by CDP. GPU figures are for the dedicated GPU process. Values below average the three fixture runs where a state exists; individual samples are short and runner noise is material.

| State                      | Chrome CPU | GPU CPU | Aggregate Chrome RSS | Page task / long tasks |
| -------------------------- | ---------: | ------: | -------------------: | ---------------------- |
| No extension               |      2.99% |   1.33% |            988.0 MiB | maximum 9.22 ms / 0    |
| Installed, inactive        |      2.99% |   0.83% |          1,093.7 MiB | maximum 13.43 ms / 0   |
| Element selection active   |      2.33% |   1.00% |          1,159.4 MiB | maximum 12.13 ms / 0   |
| After text-only save       |      0.50% |      0% |          1,162.5 MiB | 1.58 ms / 0            |
| After selection close      |      1.50% |   0.75% |          1,178.7 MiB | maximum 7.99 ms / 0    |
| After 10 open/close cycles |      3.66% |   2.00% |          1,194.9 MiB | maximum 8.83 ms / 0    |
| After 35 seconds quiet     |      0.49% |      0% |          1,139.2 MiB | 11.89 ms / 0           |

Selection started in a median 29.7 ms across 33 activations (maximum 47.8 ms). Post-GC page heap after ten cycles was +0.5 to +0.6 MiB from installed-idle on all three fixtures. No long tasks were recorded in the samples.

Aggregate RSS was about 106 MiB above the no-extension mean while installed and inactive, and about 207 MiB above it after ten cycles. This is aggregate Chrome process memory, not an allocation attribution to FeedbackPin: browser test profiles, extension pages, renderers, and Chromium caches are included. The short hosted-runner measurements cannot establish the same CPU or memory impact on the user's laptop.

The 35-second performance sample uses Playwright, which observes a service-worker handle, so that sample alone is not a worker-shutdown assertion. A separate lifecycle E2E starts isolated Chromium and observes browser-level `Target.targetDestroyed` without attaching to the worker. Run `41988254350` measured natural worker termination at 30,101 ms and passed the 25–60 second idle-window assertion. The service worker source is event-driven and declares no timers, alarms, ports, or polling. The production manifest registers no content script, so page code is absent until the user invokes selection. Unit/E2E cleanup checks verify that closing selection removes its page overlay and listeners.

## Production artifact sizes

Measured by `npm run build` on 2026-11-05:

| Artifact             |       Raw |     Gzip |
| -------------------- | --------: | -------: |
| On-demand selector   |   6.77 kB |  2.81 kB |
| Service worker       |   1.57 kB |  0.80 kB |
| Popup JavaScript     |   2.38 kB |  1.10 kB |
| Dashboard JavaScript |   6.85 kB |  2.50 kB |
| Shared React runtime | 219.40 kB | 68.53 kB |
| Popup CSS            |   2.53 kB |  1.02 kB |
| Dashboard CSS        |   8.43 kB |  2.42 kB |

React is loaded by the extension popup and dashboard. The page selector remains a standalone 6.77 kB script with no runtime module imports. `npm run check:build` checks the production MV3 manifest has only `activeTab` and `scripting`, no host permissions, no optional permissions, and no registered `content_scripts`.

## Reproduction and limits

The performance experiment is part of the loaded-extension Playwright suite and runs only on GitHub Actions. The recorded command is `xvfb-run --auto-servernum npm run test:e2e`; run `41988254350` also passed lint, strict typecheck, all 33 unit tests, all six E2E scenarios, and production build. The CI workflow uploads raw measurements with a 14-day retention. No browser or Playwright process was launched on the user's laptop.

These numbers are a small CI comparison, not a benchmark of different laptops or a guarantee of zero impact. Dashboard overflow was checked at 390 px in E2E. Extended real-world browsing sessions and the user's laptop resource impact remain unmeasured.
