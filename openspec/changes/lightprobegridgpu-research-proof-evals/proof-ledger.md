# Proof Ledger: LightProbeGridGPU Research-Proof Evals

| Item | Status | Evidence | Decision |
|------|--------|----------|----------|
| Runtime GPU-resident boundary | SUPPORTED | Source invariants guard no `readRenderTargetPixels`, `readPixels`, or `Data3DTexture` in runtime. | Preserve. |
| Profiler payload compaction | SUPPORTED | Current diff keeps medians, measured run counts, backend pass/fallback, timing sources, static work. | Keep if checks pass. |
| Escape classification compaction | SUPPORTED | Current diff derives aggregate escape counts once from escaped probes. | Keep if visibility assertions pass. |
| Receiver normal verdict ownership | SUPPORTED | Harness now emits raw receiver/shader agreement facts; `receiverNormal.frontFaceShaderAgreement` is evaluated in proof gates. | Keep. |
| Visibility weighting verdict ownership | SUPPORTED | Study now emits raw directional suppression and escape facts; `visibilityWeighting.directionalSuppression` is evaluated in proof gates. | Keep. |
| Receiver surface verdict ownership | SUPPORTED | Receiver diagnostics now emit raw `surfaceCpuRenderDelta` facts; `receiverSurface.cpuRenderAgreement` is evaluated in proof gates. | Keep. |
| SH contribution verdict ownership | SUPPORTED | SH diagnostics now emit raw mixed-color row count and ratio facts; `shContribution.noBakedMixedColorRisk` is evaluated in proof gates. | Keep. |
| GPU-debug narrative cleanup | SUPPORTED | Receiver GPU-debug now emits raw unavailable/surface facts only; no focused debug gate is introduced. | Keep raw-only until a real debug verifier exists. |
| Visibility moment verdict ownership | SUPPORTED | Moment inspection now emits raw availability/mode/byte/sample facts; `visibility.momentReadback` derives the support verdict. | Keep. |
| Leak proof verdict ownership | SUPPORTED | Leak proof facts now emit raw sealed-wall threshold metrics; `sealedWall.*` gates derive support/promotion thresholds. | Keep. |
| Projection profiler raw facts | SUPPORTED | `inspectComputeProjectionProfiling()` now emits timing sources, static work, medians, and backend/fallback facts without diagnostic status/policy strings. | Keep profiler diagnostic non-gated and raw. |
| Projection runtime parity verdict ownership | SUPPORTED | Runtime parity now emits raw `tolerancePass`, backend, coefficient, atlas, and fallback facts; `projection.runtimeParity` derives the verdict. | Keep. |
| Projection oracle raw facts | SUPPORTED | Projection candidate, adapter fallback, parity contract, and atlas repack oracles now emit raw paths/capabilities/thresholds/deltas instead of proof-only status strings. | Keep. |
| Artifact pressure verdict ownership | SUPPORTED | Artifact pressure helpers now emit raw black-tail/luminance/contrast facts; proof validation owns pressure and bounded thresholds. | Keep. |
| Artifact snapshot narrative cleanup | SUPPORTED | WebGPU/WebGL artifact snapshots now keep structured `proofRole`/`antiRingingPolicy` facts without prose `referenceBoundary` or `action` payloads. | Keep. |
| Projection fallback narrative cleanup | SUPPORTED | Adapter fallback scenarios now emit raw runtime guard, capability, selected path, and fallback facts without prose `reason`. | Keep. |
| Remaining verdict ownership | SUPPORTED | Final scan leaves only operational runtime/smoke statuses and proof-gate verdict status construction; harness diagnostics no longer carry the targeted narrative/verdict payloads. | Keep. |
| SDD/OpenSpec persistence | SUPPORTED | Change folder records proposal, claim, design, tasks. | Continue. |

## Failed / Rejected Shortcuts

- Rejected: slicing by line count without contract ownership.
- Rejected: preserving narrative proof payload because it might be useful later.
- Rejected: moving harness-only helpers into thin modules.

## Next Adversarial Pressure

Before merge/commit, rerun the focused no-build verifier set and review the diff for accidental generated-file or line-ending churn.
