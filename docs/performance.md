# Performance verification — 2 October 2026

Measurements were taken in the Codex in-app Chromium 154 browser on this Mac, with a 1600 × 1000 canvas. Results vary with device, browser, flock density, display size and other running work. The main README intentionally stays focused on using the app.

## Outcome

| Birds | Trails | Original CPU frame interval | Improved CPU frame interval | WebGPU frame interval |
|---|---|---:|---:|---:|
| 1,000 | Off | 16.7 ms | 16.7 ms | 16.6 ms |
| 1,000 | On | 16.7 ms | 16.7 ms | 16.7 ms |
| 3,000 | Off | 21.2 ms | 16.7 ms | 16.7 ms |
| 3,000 | On | 21.2 ms | 16.7 ms | 16.7 ms |
| 10,000 | Off | 219.3 ms | 28.9 ms | 16.7 ms |
| 10,000 | On | 220.7 ms | 28.2 ms | 16.7 ms |

These are controlled two-step-per-frame workloads, not a promise that the old realtime catch-up loop sustained the equivalent simulation speed. The original and improved CPU runs measured the early flock; the reported GPU run additionally settled for 10 simulation seconds. No per-frame pixel readback was used for the CPU baseline: doing that can change the Canvas rendering path. WebGPU explicitly waited for completed GPU work on every measured frame, preventing misleadingly low timings from measuring submission alone. Live UI testing also displayed 60 FPS at 10,000 birds with trails enabled.

For the settled 10,000-bird flock with trails, average completed GPU frame work was 5.23 ms, the 95th percentile was 8.0 ms and the maximum was 8.5 ms. The frame interval averaged 16.67 ms, with a 17.7 ms 95th percentile. A smaller-case run had a 22.3 ms work spike; raw summaries retain it. The live app also ran in another tab, so this was not an isolated laboratory benchmark.

Original Canvas bird drawing alone cost about 197–198 ms/frame at 10,000 birds. Batching paths in groups of 128 brought drawing submission down to about 3.3–3.5 ms/frame on the CPU fallback. The remaining CPU limitation at high density is neighbour processing.

## Implementation decisions

- WebGPU retains the separation, distance-weighted alignment/cohesion, rear blind cone, soft elliptical boundary, smooth perturbation, acceleration limits and speed limits. Steering remains at 30 Hz; movement remains at 120 Hz or finer export substeps.
- Grid construction uses atomic linked cell lists without fixed per-cell capacity or neighbour truncation. Separate compute passes establish dependencies before steering and integration.
- Bird state remains on the GPU for simulation and instanced rendering. GPU trail masks preserve the existing finite-lifetime batch approach. Video rendering clones state and trail textures on the GPU, without downloading bird positions each frame.
- GPU and CPU are numerically close but not bit-for-bit identical. GPU float precision and atomic neighbour order can lead to divergent trajectories over time in this interacting system.
- The live loop waits for submitted GPU work before scheduling another frame, preventing a growing backlog on slower devices.
- Browser support is detected at startup. Missing WebGPU or initialization failure selects the CPU renderer. Device loss restarts the flock on the CPU with the current population, seed and settings; existing trails are cleared. A device loss during export produces an error so the user can retry.
- Neighbour aggregation was considered but not enabled: exact-neighbour GPU work remained comfortably within the 60 FPS budget at 10,000 birds. Changing the interaction model would not be justified by these measurements. Revisit only if slower target devices or larger populations require it.

## Reproduce

Run `npm ci` and `npm run dev`, then open these local development pages:

- `/diagnostics/?backend=cpu` — current CPU fallback.
- `/diagnostics/?backend=gpu` — GPU with matching early-flock workload.
- `/diagnostics/?backend=gpu&settle=10` — GPU after 10 simulation seconds.
- `/diagnostics/verify.html` — force agreement, stability, real video encode/decode, cancellation, snapshot isolation, fallback and device-loss checks.
- `/?backend=cpu` — force the normal app to use the CPU fallback.

Run one diagnostic at a time and keep it visible; background-tab scheduling can affect frame intervals. Each profile uses 60 warmup frames followed by 120 measured frames per case. Physics and draw columns for WebGPU describe JavaScript command preparation; the completed-work column also waits for the GPU. The diagnostics are development pages and are not included in the public production build.

The original baseline is recorded in `diagnostics/baseline.json` and corresponds to the renderer at commit `e4e4008`. Improved CPU and settled GPU summaries are in `diagnostics/results.json`.

## Verification

- All nine Node tests and the production build pass.
- CPU/GPU initial acceleration agreement checked at 1,000, 3,000 and 10,000 birds: largest observed component error below 0.00023 world units/s².
- Ten seconds of GPU simulation at each population stayed finite and within speed limits. The existing soft boundary permits small excursions outside the visible frame on both CPU and GPU; stability checks account for that.
- CPU and GPU exports, with trails off and on, were encoded and decoded as both MP4 and WebM. All eight one-second exports contained 24 frames with increasing timestamps, the expected duration, and visible birds. Trail-enabled first frames contained the existing trail history.
- Cancellation and live-scene isolation passed on both backends. CPU fallback rendering and device-loss detection passed.
- An additional 10,000-bird GPU export with trails at 1920 × 1200, 60 FPS and 2× speed encoded and decoded all 60 frames for one second, preserving the live scene time.
