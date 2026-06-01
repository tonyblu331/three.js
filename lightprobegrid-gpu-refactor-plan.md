# LightProbeGridGPU refactor roadmap

Verified: 2026-06-01 on branch `dev`.

## Goal

Harden the LightProbeGridGPU diagnostics/harness stack by deleting prototype payload bloat, consolidating repeated behavior, and keeping runtime code GPU-resident. This is not a file-moving project: a slice only counts when it removes duplication, removes unconsumed payload, or makes ownership clearer with fewer concepts.

## Non-negotiables

- No build runs for this refactor stream.
- Use focused no-build checks: `node --check`, direct source invariant invocation, and `git diff --check`.
- Keep `examples/jsm/lighting/LightProbeGridGPU.js` free of CPU readback (`readRenderTargetPixels`, `readPixels`, `Data3DTexture`).
- Keep proof/readback/CPU mirror logic out of runtime.
- Do not add thin pass-through modules. Prefer local helpers when callers are harness-only.
- Delete legacy/prototype report payloads instead of preserving wrappers.
- Preserve public example imports and smoke harness method names unless a gate is intentionally tightened.

## Current shape

| File | Lines | Role | Status |
| --- | ---: | --- | --- |
| `examples/jsm/lighting/LightProbeGridGPU.js` | 1669 | Runtime facade | GPU-resident; no CPU readback matches. |
| `examples/jsm/lighting/LightProbeGridGPUTestHarness.js` | 2806 | Browser proof/smoke harness | Main remaining monolith. Recent slices removed setter, fixture, rejection, profiling, leak-proof row, leak-proof promotion, visibility-moment, runtime-smoke, profiler/runtime-parity/projection-oracle/artifact-pressure verdict payload, artifact snapshot prose, projection fallback prose, and receiver-normal verdict duplication. |
| `examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js` | 708 | CPU/proof visibility weighting study | Trimmed unconsumed row variance/hit-confidence summaries, unused contribution ratios, duplicate escape-count families, and directional-suppression verdict payload. |
| `examples/jsm/lighting/LightProbeGridGPUShDiagnostics.js` | 198 | SH pressure diagnostics | SH mixed-color risk now emits raw row/ratio facts; proof gates own the verdict. |
| `examples/jsm/lighting/LightProbeGridGPUReceiverDiagnostics.js` | 164 | Receiver/surface diagnostics | Surface CPU/render and GPU-debug diagnostics now emit raw facts without local verdict/narrative payload. |
| `examples/jsm/lighting/LightProbeGridGPUExampleGUI.js` | 161 | Example controls | Stable. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProofReadback.js` | 285 | Proof-only readback adapter | Correct boundary: diagnostics may import, runtime must not. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js` | 60 | Shared constants | Intentionally small. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js` | 159 | Atlas/probe addressing and repack | Cohesive. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUCpuShMath.js` | 263 | Proof-only CPU SH math | Correct boundary. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProjection.js` | 242 | Projection material/node builders | Cohesive runtime helper. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js` | 135 | Visibility material/load helpers | Cohesive runtime helper. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUBake.js` | 132 | Bake state/result helpers | Cohesive runtime helper. |
| `test/e2e/lightprobegrid-gpu-artifacts.js` | 136 | Compact artifact contract | Healthy after earlier report deletion; WebGL reference artifact keeps raw fields without prose boundary payload. |
| `test/e2e/lightprobegrid-gpu-image-metrics.js` | 174 | Screenshot artifact metrics | Artifact pressure now emits raw ratios/floors only. |
| `test/e2e/lightprobegrid-gpu-proof-validation.js` | 281 | Artifact proof assertions | Owns artifact pressure thresholds instead of trusting payload status. |
| `test/e2e/lightprobegrid-gpu-proof-gates.js` | 385 | Proof gate derivation/assertions | Visibility moment, projection parity, and sealed-wall thresholds are data-driven; receiver-normal, visibility-weighting, receiver-surface, and SH contribution verdicts now live here instead of the harness/study/diagnostic modules. |
| `test/e2e/lightprobegrid-gpu-runner-*.js` | 761 | Smoke assertion runners | Mostly reasonable; core/matrix/visibility/runtime assertions now target compact raw contracts instead of local verdict payloads or raw rows. |

Tracked LightProbeGridGPU feature/proof set: about 8,264 LOC, excluding this plan.

## Dependency rules

```text
Runtime
  LightProbeGridGPU.js
    -> lightprobegridgpu runtime helpers only
    -> no proof readback, no CPU SH math, no report code

Diagnostics / harness
  LightProbeGridGPUTestHarness.js
  LightProbeGridGPUVisibilityWeightingStudy.js
  LightProbeGridGPUShDiagnostics.js
  LightProbeGridGPUReceiverDiagnostics.js
    -> CPU/proof helpers allowed
    -> compact facts only; no exploratory report dumps

Reports / e2e
  test/e2e/lightprobegrid-gpu-*.js
    -> consume harness facts
    -> assert gate contracts, not raw lab payloads
```

## Completed cleanup themes

- Runtime helper ownership is now split by real rendering responsibility: constants, atlas, projection, visibility, bake state.
- Proof readback is isolated in `LightProbeGridGPUProofReadback.js`.
- CPU SH proof math is isolated in `LightProbeGridGPUCpuShMath.js`.
- Artifact/report output was reduced to compact proof facts instead of giant exploratory markdown/json payloads.
- Receiver and SH diagnostics were trimmed to consumed gate fields.
- Harness proof setup now shares `applyProofBakeSettings()`.
- Harness endpoint setters now share `setBakeParameter()`.
- Harness contract/unit/projection fixture setup is consolidated locally.
- Harness validation rejection checks share one local capture primitive.
- Compute projection profiling keeps warmup execution but no longer returns warmup, full per-run payload arrays, nested backend arrays, deterministic timer flags, diagnostic status/policy text, claim text, or median speedup summaries.
- Compute projection runtime parity now returns raw tolerance, coefficient, atlas, backend, and fallback facts; proof gates own the parity verdict.
- Projection parity candidate/fallback/atlas-repack oracles now return raw path, threshold, capability, and delta facts without proof-only status or prose reason strings.
- Artifact pressure metrics now return raw black-tail/luminance/contrast facts; proof validation owns pressure/bounded thresholds.
- Artifact snapshot rows now keep structured role/policy facts without prose `referenceBoundary` or `action` payload.
- Leak-proof rows now share top-level proof settings and sampling instead of repeating frozen fixture controls per row.
- Visibility weighting summaries no longer carry unused variance, hit-confidence, min/max visibility-mass, or mirrored correct-side contribution ratios.
- Visibility moment inspection reports compact counters/ranges instead of raw readback sample arrays and deferred sweep-plan narrative.
- Runtime smoke diagnostics now keep benchmark, bake coalescing, and leak-mode comparison payloads to asserted fields only.
- Visibility escape classification now stores per-receiver escaped probes only and derives aggregate counts once, instead of duplicating per-receiver count families.
- Receiver-normal diagnostics now return raw availability/agreement facts; the proof gate owns the front-face/shader verdict.
- Visibility-weighting diagnostics now return raw directional-suppression and escape facts; the proof gate owns the directional suppression verdict.
- Receiver-surface diagnostics now return raw quadrature/delta facts; the proof gate owns the CPU/render agreement verdict.
- SH contribution diagnostics now return raw mixed-color row count and ratio facts; the proof gate owns the baked mixed-color risk verdict.
- GPU-debug diagnostics now return raw unavailable/surface facts only; placeholder open status, proofBoundary, reason, and sub-gates were deleted rather than moved.
- Visibility moment inspection now returns raw availability/mode/readback counters; the proof gate derives moment-backed support.
- Leak proof facts now return raw sealed-wall threshold metrics; proof gates own sealed-wall support/promotion verdicts.

## Current hotspots

1. **Harness monolith** — `LightProbeGridGPUTestHarness.js` remains the largest file and still mixes many proof endpoints. Continue cutting only repeated behavior or unconsumed payload.
2. **Visibility weighting study** — `LightProbeGridGPUVisibilityWeightingStudy.js` is smaller but still worth checking for repeated receiver aggregation/readback shape.
3. **Proof gate labels/statuses** — `lightprobegrid-gpu-proof-gates.js` may contain duplicated status composition as gates evolve.
4. **Plan/docs drift** — keep this roadmap short. Do not let architecture docs become another token sink.

## Next implementation slices

### Slice 1: harness payload audit

Target: `examples/jsm/lighting/LightProbeGridGPUTestHarness.js`

Look for:

- returned fields not consumed by runner assertions or compact artifacts;
- repeated fixture setup still local to one section;
- repeated snapshot/restore or metric capture patterns;
- status strings that can be section-local constants only when reused.

Acceptance:

- Net line reduction or clear branch/payload deletion.
- No new file unless there are multiple real callers outside the harness.
- `node --check` on harness and touched assertion files.
- Direct `checkSmokeSourceInvariants(...)` passes.
- `git diff --check` passes.

### Slice 2: visibility weighting study audit

Target: `examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js`

Look for:

- internal rows/summary objects that duplicate top-level facts;
- CPU visibility math repeated from `LightProbeGridGPUVisibility.js` or atlas helpers;
- fields only useful for old exploratory reports.

Acceptance:

- Keep public fields consumed by `lightprobegrid-gpu-runner-visibility-assertions.js`.
- Delete unconsumed proof-lab rows instead of moving them.
- No runtime imports from proof modules.

### Slice 3: proof gate/status consolidation

Target: `test/e2e/lightprobegrid-gpu-proof-gates.js`

Look for:

- repeated status/label derivation;
- status strings assembled in more than one place;
- gates that assert payload fields no longer returned.

Acceptance:

- Gate intent remains readable.
- No generic status factory unless repeated gate behavior proves it.
- Assertions stay focused on the compact contract.

## Verification commands

Use the narrowest applicable set per slice:

```bash
node --check examples/jsm/lighting/LightProbeGridGPUTestHarness.js
node --check examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js
node --check test/e2e/lightprobegrid-gpu-runner-core-assertions.js
node --check test/e2e/lightprobegrid-gpu-runner-visibility-assertions.js
node --check test/e2e/lightprobegrid-gpu-proof-gates.js
node --check test/e2e/lightprobegrid-gpu-source-invariants.js
node --input-type=module -e "import { checkSmokeSourceInvariants } from './test/e2e/lightprobegrid-gpu-source-invariants.js'; import { smokeHarnesses } from './test/e2e/lightprobegrid-gpu-smoke-config.js'; await checkSmokeSourceInvariants('webgpu_lightprobes_cornell', smokeHarnesses.webgpu_lightprobes_cornell);"
git diff --check
```

Do not run `npm run build` for this cleanup stream.

## Completion evidence

Current no-build evidence supports the refactor goal:

- runtime remains GPU-resident with no CPU readback matches in `LightProbeGridGPU.js`;
- diagnostics/harness no longer carry the targeted verdict, proofBoundary, status, referenceBoundary, or exploratory prose payloads;
- remaining files keep clear ownership without thin-file over-splitting;
- compact proof gates cover the default smoke proof behavior with a 16-gate budget;
- source invariants, runner assertions, OpenSpec tasks, and this roadmap match the current code shape.
