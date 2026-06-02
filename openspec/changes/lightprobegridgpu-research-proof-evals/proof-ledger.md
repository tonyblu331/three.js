# Proof Ledger: LightProbeGridGPU Research-Proof Evals

| Item | Status | Evidence | Decision |
|------|--------|----------|----------|
| Runtime GPU-resident boundary | SUPPORTED | Source invariants guard no `readRenderTargetPixels`, `readPixels`, or `Data3DTexture` in runtime. | Preserve. |
| Runtime runner predicates | SUPPORTED | Runtime smoke assertions now validate bake coalescing, benchmark backend/memory/visibility-depth/timing, and color-sanity raw facts through named local predicates. | Keep runtime runner checks predicate-owned; avoid scattered timing/memory payload-shape chains. |
| Profiler payload compaction | SUPPORTED | Current diff keeps medians, measured run counts, backend pass/fallback, timing sources, static work. | Keep if checks pass. |
| Escape classification compaction | SUPPORTED | Current diff derives aggregate escape counts once from escaped probes. | Keep if visibility assertions pass. |
| Receiver normal verdict ownership | SUPPORTED | Harness now emits raw receiver/shader agreement facts; `receiverNormal.frontFaceShaderAgreement` is evaluated in proof gates. | Keep. |
| Visibility weighting verdict ownership | SUPPORTED | Study now emits raw directional suppression and escape facts; `visibilityWeighting.directionalSuppression` is evaluated in proof gates. | Keep. |
| Visibility runner predicates | SUPPORTED | Visibility smoke assertions now validate moment readback, visibility weighting, escape classification, SH contribution, receiver-surface, and receiver-normal raw facts through named local predicates guarded by source invariants. | Keep visibility runner checks predicate-owned; avoid scattered inline payload-shape chains. |
| Receiver surface verdict ownership | SUPPORTED | Receiver diagnostics emit raw surface render/CPU wrong-ratio facts; `receiverSurface.cpuRenderAgreement` and `surfaceCpuRenderDelta` are evaluated in proof gates. | Keep masked render ratios out of the receiver-surface agreement path. |
| Receiver surface agreement ownership | SUPPORTED | Receiver diagnostics now emit raw `renderSurfaceWrongRatio` plus `surfaceRuntimeWrongRatioMax`; proof gates derive `surfaceCpuRenderDelta` once with matching max-to-max aggregation and feed that value to both predicate and gate actual. | Keep receiver-surface agreement deltas out of diagnostics; do not compare render max against whichever CPU aggregate happens to be closer. |
| SH contribution verdict ownership | SUPPORTED | SH diagnostics now emit raw mixed-color row count and ratio facts; `shContribution.noBakedMixedColorRisk` is evaluated in proof gates. | Keep. |
| GPU-debug narrative cleanup | SUPPORTED | Receiver GPU-debug now emits raw unavailable/surface facts only; no focused debug gate is introduced. | Keep raw-only until a real debug verifier exists. |
| Visibility moment verdict ownership | SUPPORTED | Moment inspection now emits raw availability/mode/byte/sample facts; `visibility.momentReadback` derives the support verdict. | Keep. |
| Visibility status payload cleanup | SUPPORTED | The unused `deriveVisibilityProofStatus()` wrapper and its `visibilityLabel`/`visibilityStatus`/`ddgiStatus` payload are gone; moment-backed validation uses the raw `isMomentBackedVisibility()` predicate only. | Keep visibility/DDGI narrative status out of proof facts unless a gate directly consumes it. |
| Leak proof verdict ownership | SUPPORTED | Leak proof facts now emit raw sealed-wall baseline/candidate rows; proof gates derive linear pre-tone masked leak improvement plus correct-bounce preservation thresholds. | Keep tone-mapped wrong-side improvements as raw derivable facts only, not promotion blockers. |
| Leak evidence artifact visibility | SUPPORTED | Artifact writer now persists compact `leak-proof-facts.json` with sealed-wall baseline/candidate raw leak rows next to `proof-summary.json`; validation guards finite raw leak/bounce metrics. | Keep raw baseline/candidate evidence auditable without bloating proof-summary gates or reintroducing nested metric snapshots. |
| Matrix runner predicates | SUPPORTED | Matrix smoke assertions now validate compact probe occupancy, sealed-wall leak-proof fixture facts, leak-proof row facts, and restoration facts through named local predicates guarded by source invariants. | Keep matrix runner checks predicate-owned; avoid rebuilding proof-gate derivations in the runner. |
| Projection profiler raw facts | SUPPORTED | `inspectComputeProjectionProfiling()` now emits timing sources, static work, medians, and backend/fallback facts without diagnostic status/policy strings. | Keep profiler diagnostic non-gated and raw. |
| Projection runtime parity verdict ownership | SUPPORTED | Runtime parity now emits raw backend, coefficient, atlas, and fallback facts; `projection.runtimeParity` derives the verdict. | Keep `tolerancePass` out of runtime parity facts. |
| Core runtime parity/profile predicates | SUPPORTED | Core smoke assertions now validate compute projection runtime parity facts, parity support facts, profiling selector facts, and compact timing facts through named local predicates guarded by source invariants. | Keep parity/profile runner checks predicate-owned; proof gates keep verdict ownership. |
| Projection oracle raw facts | SUPPORTED | Projection candidate, adapter fallback, parity contract, and atlas repack oracles now emit raw paths/capabilities/thresholds/deltas instead of proof-only status strings. | Keep. |
| Projection oracle runner predicates | SUPPORTED | Core smoke assertions now validate projection parity contract, compute candidate, adapter fallback, and atlas repack raw facts through named local predicates guarded by source invariants. | Keep projection-oracle runner checks predicate-owned; avoid growing inline assertion blobs. |
| Artifact pressure verdict ownership | SUPPORTED | Artifact pressure helpers now emit raw black-tail/luminance/contrast facts; proof validation owns pressure and bounded thresholds. | Keep. |
| Density fixture proof ownership | SUPPORTED | Proof validation now derives the shared WebGPU/WebGL density budget and same-fixture checks with named predicates instead of repeated inline field chains. | Keep density artifact rows raw; keep fixture-equivalence verdicts in validation. |
| Density row validation predicates | SUPPORTED | Proof validation now checks density reference, shadowless, crisp-shadow row facts, crisp-shadow reference comparison, damped fixture-preservation, and damped math-action rows through named predicates, and fixes the damped assertion message comma bug. | Keep density row policy in validation predicates; keep artifact rows raw. |
| Low-res validation predicates | SUPPORTED | Proof validation now checks low-res shared probe intensity, SH band isolation, green-bounce preservation, red-bias improvement, and dark-tail bounds through named predicates. | Keep low-res comparison policy in validation predicates; keep artifact rows raw. |
| Proof summary validation predicates | SUPPORTED | Proof summary validation now checks bounded gate count, unique and required ids, compact gate shape, required supported gates, and byte budget through named predicates guarded by source invariants. | Keep proof-summary contract checks predicate-owned; do not rebuild giant proof reports. |
| Artifact snapshot narrative cleanup | SUPPORTED | WebGPU snapshots no longer echo `proofRole`/`antiRingingPolicy`; validation derives the label-owned role and anti-ringing expectations from compact row facts, while the WebGL reference keeps its explicit same-class reference role. | Keep generated WebGPU artifact rows raw and non-narrative. |
| Projection fallback narrative cleanup | SUPPORTED | Adapter fallback scenarios now emit raw runtime guard, capability, selected path, and fallback facts without prose `reason`. | Keep. |
| Remaining verdict ownership | SUPPORTED | Final scan leaves only operational runtime/smoke statuses and proof-gate verdict status construction; harness diagnostics no longer carry the targeted narrative/verdict payloads. | Keep. |
| SDD/OpenSpec persistence | SUPPORTED | Change folder records proposal, claim, design, tasks. | Continue. |

## Failed / Rejected Shortcuts

- Rejected: slicing by line count without contract ownership.
- Rejected: preserving narrative proof payload because it might be useful later.
- Rejected: moving harness-only helpers into thin modules.

## Next Adversarial Pressure

Before merge/commit, rerun the focused no-build verifier set and review the diff for accidental generated-file or line-ending churn.
