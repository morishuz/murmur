# Murmur — flocking studies

A 2D bird-flocking study: 100–10,000 directional triangles on a flat colour field, with live controls, fading traces and offline video rendering.

**[Launch Murmur →](https://morishuz.github.io/murmur/)**

Runs entirely in your browser. No account, server or uploads required.

## Run

Node 20.18+:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a production build; `npm run preview` serves it.

## Controls

Adjust population (100–10,000), alignment, cohesion, separation, flight speed, triangle size and colours. Pause freezes the current state. New flock changes the deterministic seed while preserving settings. Changing population restarts the flock.

## Fading traces

Enable **Leave a trace** (off by default) to draw a thin line behind every bird. Adjust **Trace colour** and **Line persistence** (0.5–10 seconds of simulation time). Pause freezes both birds and trails; flight speed affects how quickly they age in real time. Disabling traces clears them, and a new flock or population change starts fresh. Colour changes recolour existing traces too.

Trails use bounded raster batches that fade smoothly to zero, avoiding permanent faint canvas residue. Persistence is approximate because segments are grouped in short batches; a segment disappears within the selected duration. The history uses at most five 1600 × 1000 transparent layers (about 32 MB of pixel storage), with no allocation when disabled. The trail layer is scaled with the artwork; bird shapes remain separate and crisp. Video exports copy the visible trail history, then extend and fade it using simulation time rather than encoding time.

## Motion

Birds perceive nearby neighbours within a forward-biased field of view. Distance-weighted alignment matches velocity, cohesion draws neighbours together, and short-range separation avoids crowding. Acceleration is limited, speed varies slightly per bird, and smooth directional disturbances introduce variation. A soft elliptical boundary steers birds away from the frame without teleporting or reflecting them.

This is a stylised, planar boids model, not a biological flight model or a 3D starling simulation. High alignment can create ordered circulating flocks; lower alignment allows more local variation. Separation is steering, not guaranteed collision prevention.

A fine spatial grid stores birds in contiguous cell ranges and skips cells outside the perception circle. The visibility test avoids per-neighbour square roots. Steering is recalculated at 30 Hz in simulation time, considering all neighbours, while movement still uses a fixed 120 Hz timestep (or finer export steps). Holding acceleration between steering updates slightly changes trajectories compared with the original 120 Hz steering model. Typed arrays and batched canvas triangle drawing keep overhead low; unusually slow frames are capped so returning to a backgrounded tab does not trigger a large catch-up burst. Very dense flocks still incur more neighbour comparisons.

## Video

Expand **Render a film**, choose duration (1–60 seconds), FPS (24/30/60), resolution (1280 × 800 through 3840 × 2400), and MP4 or WebM. Render, then download the result. Cancel stops the export.

The exporter adapts the sibling project's Mediabunny/WebCodecs pipeline. It clones the current flock, including velocities and settings, and advances fixed simulation substeps for each explicit video timestamp. Slow encoding cannot skip frames. Flight speed affects export playback as well as preview. The live simulation pauses during rendering and resumes from its previous state. The artwork exports at 16:10 with no interface overlays; preview uses the same world framing, with extra background where the panel aspect differs.

Encoding requires WebCodecs support on localhost or HTTPS and a supported codec. MP4 uses H.264; WebM tries VP9 then VP8. The app checks encoder availability and displays errors. Compressed output remains in memory until downloaded; nothing is uploaded.

## Verification

`npm test` checks determinism, isolated snapshots including cached steering, one minute of 1,000-bird stability, 20 seconds of 3,000-bird stability, equivalence to the original neighbour forces, steering cadence across export timesteps, frame timing and cancellation. `npm run benchmark` compares the original and optimised physics from matching warmed-up snapshots at 1,000 and 3,000 birds. It excludes canvas rendering and is not a browser FPS measurement. `npm run build` checks bundling.

Local before/after benchmark: 1,000 birds improved from 4.42 to 0.79 ms per integration step; 3,000 birds improved from 33.84 to 4.48 ms on average (about 7.5× faster physics). The averages include steps that reuse cached steering. The original 1,000-bird in-app preview displayed 60 FPS; updated browser FPS at 3,000 birds has not been measured. These are machine-specific observations, not guarantees for every device or parameter combination. Browser encoder integration still needs a completed export check; automated browser clicks did not activate controls in the available in-app browser during initial verification.

## GitHub Pages

The repository contains the HTML entry point plus JavaScript and CSS modules; it is not a standalone HTML file. Vite bundles these and the video encoder dependency into a static website. The GitHub Actions workflow runs tests, builds the app, and deploys `dist/` to GitHub Pages on every push to `main`. Vite uses relative asset paths so the site works beneath the GitHub Pages repository URL.

For a fork, update the launch link, and select **GitHub Actions** under **Settings → Pages → Build and deployment**.
