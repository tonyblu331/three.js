# LightProbeGridGPU compute projection profiling handoff

Generated: 2026-05-28T02:08:39+07:00
Workspace: G:/Antonio Bonet/three.js
Branch observed: $branch

## Current result

The compute projection path remains parity-passing, and the harness now captures forced-backend diagnostic profiling evidence.

``json
{   "runtimeStatus": "RUNTIME-PARITY-READBACK-PASSING",   "coefficientMaxDelta": 0,   "atlasMaxDelta": 0,   "staticWork": {     "resolution": 2,     "totalProbes": 8,     "cubemapSize": 4,     "cubemapTexelsPerProbe": 96,     "fragmentCubemapSweepsPerProbe": 9,     "computeCubemapSweepsPerProbe": 1,     "fragmentTexelVisits": 6912,     "computeTexelVisits": 768,     "savedTexelVisits": 6144,     "reductionRatio": 0.8889,     "reductionPercent": 88.8889   },   "projectionPhaseTimingStatus": "UNAVAILABLE-DETERMINISTIC-TIMER-ZERO",   "fragmentProjectionMedian": 0,   "computeProjectionMedian": 0,   "fragmentTotalMedian": 9.9,   "computeTotalMedian": 8.8,   "totalBakeMedianSpeedupRatio": 1.125,   "totalBakeMedianReductionPercent": 11.1111,   "timingPolicy": "DIAGNOSTIC-WALL-CLOCK-NOT-GATED" }
``

## What changed in this profiling pass

- Added a private profiling selector: uto | force-fragment | force-compute.
- Wired forced fragment/compute runs into the browser harness.
- Added inspectComputeProjectionProfiling() with 1 warmup and 3 measured runs per backend.
- Persisted profiling evidence into the proof report and markdown.
- Added artifact/source gates so static work reduction and diagnostic timing boundaries stay explicit.

## Candid profiling interpretation

The static projection work reduction is real:

``txt
fragment: 9 cubemap sweeps/probe, 6912 cubemap texel visits
compute:  1 cubemap sweep/probe,  768 cubemap texel visits
saved:    6144 visits = 88.8889% fewer cubemap integrations
``

The measured projection phase timer is still unavailable in deterministic e2e:

``txt
projectionPhaseTimingStatus: UNAVAILABLE-DETERMINISTIC-TIMER-ZERO
fragment projection median: 0 ms
compute projection median: 0 ms
``

So do not claim projection-phase GPU speedup yet.

The harness-level wall-clock diagnostic for the small 2³ / 4px fixture reported:

``txt
fragment total bake median: 9.9 ms
compute total bake median:  8.8 ms
diagnostic total bake median speedup: 1.125x
diagnostic total bake median reduction: 11.1111%
``

That is useful smoke evidence, not a gated GPU-timer result.

## Verification

No build was run.

``txt
node --check examples/jsm/lighting/LightProbeGridGPU.js
node --check examples/jsm/lighting/LightProbeGridGPUTestHarness.js
node --check test/e2e/lightprobegrid-gpu-runner-core-assertions.js
node --check test/e2e/lightprobegrid-gpu-proof-report.js
node --check test/e2e/lightprobegrid-gpu-proof-research-sections.js
node --check test/e2e/lightprobegrid-gpu-proof-markdown.js
node --check test/e2e/lightprobegrid-gpu-artifacts.js
node --check test/e2e/lightprobegrid-gpu-source-invariants.js
node test/e2e/lightprobegrid-gpu-source-invariants.js
TEMP=G:/Antonio Bonet/three.js/.codex-tmp TMP=G:/Antonio Bonet/three.js/.codex-tmp node test/e2e/puppeteer.js --webgpu webgpu_lightprobes_cornell
TEMP=G:/Antonio Bonet/three.js/.codex-tmp TMP=G:/Antonio Bonet/three.js/.codex-tmp node test/e2e/lightprobegrid-gpu-artifacts.js
``

Result:

``txt
Smoke 35 checks in file: webgpu_lightprobes_cornell
TEST PASSED! 1 screenshots rendered correctly.
``

## Environment caveat

C: / default TEMP had 0 bytes free during this run, so the e2e artifact output was redirected to:

``txt
G:/Antonio Bonet/three.js/.codex-tmp/codex-threejs-lightprobes-parity
``
