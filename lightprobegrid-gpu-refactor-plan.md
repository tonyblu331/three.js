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
| `examples/jsm/lighting/LightProbeGridGPU.js` | 1262 | Runtime facade | GPU-resident; no CPU readback matches. |
| `examples/jsm/lighting/LightProbeGridGPUTestHarness.js` | 2316 | Browser proof/smoke harness | Main remaining monolith. Recent slices removed setter, fixture, rejection, profiling, and leak-proof row payload duplication. |
| `examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js` | 601 | CPU/proof visibility weighting study | Trimmed unconsumed row variance/hit-confidence summaries and unused contribution ratios. |
| `examples/jsm/lighting/LightProbeGridGPUShDiagnostics.js` | 188 | SH pressure diagnostics | Currently compact enough; avoid further splitting unless overlap appears. |
| `examples/jsm/lighting/LightProbeGridGPUReceiverDiagnostics.js` | 139 | Receiver/surface diagnostics | Currently compact enough. |
| `examples/jsm/lighting/LightProbeGridGPUExampleGUI.js` | 104 | Example controls | Stable. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProofReadback.js` | 214 | Proof-only readback adapter | Correct boundary: diagnostics may import, runtime must not. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js` | 58 | Shared constants | Intentionally small. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js` | 118 | Atlas/probe addressing and repack | Cohesive. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUCpuShMath.js` | 178 | Proof-only CPU SH math | Correct boundary. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProjection.js` | 157 | Projection material/node builders | Cohesive runtime helper. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js` | 102 | Visibility material/load helpers | Cohesive runtime helper. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUBake.js` | 113 | Bake state/result helpers | Cohesive runtime helper. |
| `test/e2e/lightprobegrid-gpu-artifacts.js` | 97 | Compact artifact contract | Healthy after earlier report deletion. |
| `test/e2e/lightprobegrid-gpu-proof-gates.js` | 264 | Proof gate derivation/assertions | Sealed-wall thresholds are data-driven; watch for future status drift. |
| `test/e2e/lightprobegrid-gpu-runner-*.js` | 689 | Smoke assertion runners | Mostly reasonable; matrix assertions now target compact leak-proof settings and rows. |

Tracked LightProbeGridGPU feature/proof set: about 6,600 LOC, excluding this plan.

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
- Compute projection profiling keeps warmup execution but no longer returns warmup or full per-run payload arrays.
- Leak-proof rows now share top-level proof settings and sampling instead of repeating frozen fixture controls per row.
- Visibility weighting summaries no longer carry unused variance, hit-confidence, min/max visibility-mass, or mirrored correct-side contribution ratios.

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
node --check test/e2e/lightprobegrid-gpu-source-invariants.js
node --input-type=module -e "import { checkSmokeSourceInvariants } from './test/e2e/lightprobegrid-gpu-source-invariants.js'; import { smokeHarnesses } from './test/e2e/lightprobegrid-gpu-smoke-config.js'; await checkSmokeSourceInvariants('webgpu_lightprobes_cornell', smokeHarnesses.webgpu_lightprobes_cornell);"
git diff --check
```

Do not run `npm run build` for this cleanup stream.

## Completion bar

The goal is not complete yet. It becomes complete only when current evidence shows:

- runtime remains GPU-resident with no CPU readback;
- diagnostics/harness no longer carry obvious unconsumed lab payloads;
- remaining files have clear ownership and no thin-file over-splitting;
- compact proof gates cover the behavior that remains;
- the roadmap and assertions match the actual code shape.
