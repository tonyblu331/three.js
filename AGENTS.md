## Repository routing

- Do not push branches, commits, tags, or PRs to upstream `mrdoob/three.js` for now.
- Use the private fork remote `tonyblu331` (`https://github.com/tonyblu331/three.js.git`) for this work.
- Prefer `gpu/` branch names for LightProbeGridGPU work.
- Keep `origin` as fetch-only/upstream reference unless explicitly told otherwise.

## LightProbeGridGPU SDD rules

- Current proof authority is the focused WebGPU proof harness and `test/e2e/lightprobegrid-gpu-proof-gates.js`, not scalar/WebGL parity or visual impressions.
- Harness and diagnostics emit compact raw facts only; proof gates own `SUPPORTED` / `OPEN` verdicts.
- Runtime must stay GPU-resident. Do not add CPU readback, proof helpers, or Cornell-only coordinates to runtime.
- The remaining open gate is `sealedWall.preToneMaskedWrongSideResidualLeakRatio = 0.9377` against the zero-leak oracle. Do not close it by comparing against the leaky baseline.
- Prototype residual fixes only when a source-backed receiver/material/geometry classification is available through GPU node/value metadata. Do not add shallow wrappers around existing `receiverBoundaryLayerMask` / `receiverBoundaryWeight`.
- Keep rejected paths out of live interfaces: naive adjacent fallback, raw resolution-only sweeps, diagonal overreach, global biased-query ownership, broad darkening, and stale rejected-path payloads.

