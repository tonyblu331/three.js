# ADR 0001: LightProbeGridGPU Residual Proof Authority

## Status

Accepted

## Context

The LightProbeGridGPU SDD branch is a research-proof branch, not a general cleanup branch. The current focused proof package is `OPEN` with 15 supported gates and 1 open gate:

- supported: receiver-scoped no-wrong-side escape, directional suppression, receiver-surface linear agreement, SH-risk, correct bounce, runtime readiness, projection parity, moment readback, and compact proof shape;
- open: `sealedWall.preToneMaskedWrongSideResidualLeakRatio = 0.9377` against the physical zero-leak oracle.

The scalar/WebGL path and the older baseline rows are useful comparators, but they are leaky and cannot define success. The sixteenstudio branch is useful as a WGPU SH atlas and product-node control, but it does not include visibility moments, receiver ownership metadata, residual proof gates, or zero-leak evidence.

## Decision

The remaining LightProbeGridGPU work is dictated by proof authority and source-backed representation, in this order:

1. The focused WebGPU proof harness emits compact raw facts.
2. `test/e2e/lightprobegrid-gpu-proof-gates.js` owns verdicts.
3. The sealed-wall zero-leak oracle owns residual truth.
4. Runtime changes are eligible only when they consume GPU-resident authored/setup metadata or represented geometry state.

The next residual candidate must add represented state before interpolation, such as authored receiver/material metadata, setup-authored region/layer ownership, or GPU-resident geometry/surface-distance facts. A candidate that merely renames existing `receiverBoundaryLayerMask` / `receiverBoundaryWeight` inputs is rejected as a shallow wrapper because the current equivalence path already exercises those inputs and still leaves residual at `0.9377`.

## Consequences

- Do not promote scalar/WebGL agreement, baseline-relative improvement, visual appearance, or Sponza demo behavior as proof truth.
- Do not add CPU readback, proof helpers, brightness-derived validity, Cornell divider coordinates, or rejected-path payloads to runtime.
- Do not reopen naive adjacent fallback, raw resolution-only sweeps, diagonal overreach, global biased-query ownership, or broad darkening.
- Keep sixteenstudio as a control for base SH atlas/product shape only.
- Keep `tasks.md` checkboxes interpreted as SDD phase decisions, not as proof closure. A checked hold/trim task can coexist with an `OPEN` proof package.
- Promotion requires reducing `sealedWall.preToneMaskedWrongSideResidualLeakRatio` below `0.9377` while all currently supported gates remain supported.

## Verification

Before claiming progress, run the narrow checks that match the touched surface:

- Markdown/SDD-only changes: `git diff --check` plus direct searches for the stated proof state and rejection language.
- Runtime or harness changes: touched `node --check`, direct source invariants, `git diff --check`, and focused Cornell WebGPU proof smoke only when needed.
- Never use a full build as the default verification path for this SDD stream unless explicitly requested.
