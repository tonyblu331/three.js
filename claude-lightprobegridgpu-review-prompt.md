# Claude Review Prompt: LightProbeGridGPU

You are reviewing an in-progress three.js research/proof implementation for GPU-baked light probe grids.

## Goal

Help us validate whether the current `LightProbeGridGPU` direction is technically sound, maintainable enough for an examples/jsm research path, and supported by proof/evaluation gates that actually catch regressions.

This is not ready-for-core API work. Treat it as a focused research implementation whose current priority is correctness, observability, and proof quality before API polish.

## Project Context

Repository: `three.js`

Relevant entry points:

- `examples/webgpu_lightprobes_cornell.html`
- `examples/jsm/lighting/LightProbeGridGPU.js`
- `examples/jsm/lighting/lightprobegridgpu/*`
- `examples/jsm/lighting/LightProbeGridGPUTestHarness.js`
- `examples/jsm/lighting/LightProbeGridGPUReceiverDiagnostics.js`
- `examples/jsm/lighting/LightProbeGridGPUShDiagnostics.js`
- `examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js`
- `examples/jsm/helpers/LightProbeHelperGPU.js`
- `test/e2e/lightprobegrid-gpu-*.js`
- `openspec/changes/lightprobegridgpu-research-proof-evals/*`
- `lightprobegrid-gpu-refactor-plan.md`

## What The Implementation Is Trying To Prove

The branch is exploring a GPU path for baking and evaluating irradiance from a 3D grid of light probes.

Current proof focus:

- Probe placement, indexing, and atlas layout are deterministic and inspectable.
- GPU bake/readback data can be validated against expected invariants.
- Spherical harmonics projection and diagnostic paths are testable.
- Visibility weighting and receiver diagnostics expose failure modes instead of hiding them.
- E2E tests can detect blank, invalid, unstable, or misleading renders.

## What To Review

Please review the included files for:

1. Correctness risks in probe indexing, atlas addressing, visibility weighting, SH math, and bake/readback assumptions.
2. Hidden coupling between the example UI, test harness, diagnostics, and implementation.
3. Whether the proof gates are meaningful or merely checking that code ran.
4. Places where source invariants or runtime assertions are too brittle, too weak, or aimed at the wrong behavior.
5. Refactor opportunities that reduce complexity without prematurely designing a public API.
6. Any naming, module boundaries, or lifecycle choices that would make future three.js review harder.

## Important Constraints

- Keep feedback grounded in the files provided.
- Do not propose moving this into core yet.
- Prefer concrete risks with file/function references over broad style feedback.
- Call out if a test proves less than its name suggests.
- Call out if a diagnostic path can accidentally influence the behavior it is supposed to observe.
- Assume the goal is to learn and harden the proof first, not to make a polished feature demo.

## Desired Output

Please return:

- Top findings, ordered by severity.
- For each finding: why it matters, where it appears, and a concrete fix or validation step.
- A short section on proof quality: what the current tests genuinely prove and what they do not.
- A short section on architecture: what should be split, kept together, or left alone for now.
- Any questions that block a confident review.
