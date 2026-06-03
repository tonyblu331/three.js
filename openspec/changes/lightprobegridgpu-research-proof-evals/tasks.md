# Tasks: LightProbeGridGPU Research-Proof Evals

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 220-360 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single focused cleanup unless scope expands |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Freeze eval contract and compact current payloads | PR 1 | Current working diff plus SDD artifacts. |
| 2 | Move one verdict family into proof gates | PR 1 | Stop before broad harness surgery. |

## Phase 1: Contract Foundation

- [x] 1.1 Create `openspec/changes/lightprobegridgpu-research-proof-evals/research-claim.md` with falsifiable claim, enemy terms, and rejection gates.
- [x] 1.2 Create `openspec/changes/lightprobegridgpu-research-proof-evals/proof-ledger.md` tracking supported/open eval claims.
- [x] 1.3 Record SDD proposal/spec/design/tasks for the eval cleanup scope.

## Phase 2: Current Payload Cleanup

- [x] 2.1 Keep compact profiler diff in `examples/jsm/lighting/LightProbeGridGPUTestHarness.js`; preserve measured summaries and backend fallback evidence.
- [x] 2.2 Keep compact escape classification diff in `examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js`; aggregate counts once.
- [x] 2.3 Audit remaining `status`, `proofBoundary`, and `diagnosticConclusion` fields in `LightProbeGridGPUTestHarness.js`; classify raw fact vs verdict vs narrative.

## Phase 3: Gate Ownership Refactor

- [x] 3.1 Move one verdict-like diagnostic family into `test/e2e/lightprobegrid-gpu-proof-gates.js` when it has explicit thresholds.
- [x] 3.2 Update the relevant `test/e2e/lightprobegrid-gpu-runner-*.js` file to assert raw fact shape, not narrative status.
- [x] 3.3 Delete any now-unconsumed narrative payload from the harness.

## Phase 4: Verification

- [x] 4.1 Run `node --check` on touched harness, diagnostic, proof-gate, and runner files.
- [x] 4.2 Run direct `checkSmokeSourceInvariants(...)`.
- [x] 4.3 Run `git diff --check` and update `lightprobegrid-gpu-refactor-plan.md` only with current facts.

## Phase 5: Second Gate Ownership Refactor

- [x] 5.1 Move visibility-weighting directional suppression verdict out of `LightProbeGridGPUVisibilityWeightingStudy.js`.
- [x] 5.2 Add `visibilityWeighting.directionalSuppression` to compact proof gates.
- [x] 5.3 Update visibility runner/source invariants to assert raw diagnostic facts instead of narrative status, proofBoundary, interrogationFinding, or dominantEscapeReason.

## Phase 6: Remaining Verdict Audit

- [x] 6.1 Audit SH contribution and receiver GPU-debug diagnostics for the next gate-owned verdict candidate.

## Phase 7: Receiver Surface Gate Ownership Refactor

- [x] 7.1 Move receiver-surface CPU/render agreement verdict out of `LightProbeGridGPUReceiverDiagnostics.js`.
- [x] 7.2 Add `receiverSurface.cpuRenderAgreement` to compact proof gates.
- [x] 7.3 Update visibility runner/source invariants to assert raw receiver-surface facts instead of status/proofBoundary/cpuRenderAgreementGate.

## Phase 8: Remaining Verdict Audit

- [x] 8.1 Audit SH contribution and receiver GPU-debug diagnostics for any remaining status/proofBoundary payload that can be deleted or gate-owned.

## Phase 9: SH Contribution Gate Ownership Refactor

- [x] 9.1 Remove SH contribution status/proofBoundary/suspectedFailureDomain payload from `LightProbeGridGPUShDiagnostics.js`.
- [x] 9.2 Add `shContribution.noBakedMixedColorRisk` to compact proof gates.
- [x] 9.3 Update visibility runner/source invariants to assert raw SH contribution facts instead of suspected failure-domain narrative.

## Phase 10: Remaining Verdict Audit

- [x] 10.1 Audit receiver GPU-debug diagnostic; decide whether its open status can be deleted as narrative or needs an explicit opt-in debug gate.

## Phase 11: GPU-Debug Narrative Cleanup

- [x] 11.1 Remove receiver GPU-debug status/proofBoundary/reason payload from `LightProbeGridGPUReceiverDiagnostics.js`.
- [x] 11.2 Remove placeholder GPU-debug agreement gates from the compact diagnostic summary.
- [x] 11.3 Update visibility runner/source invariants to assert raw GPU-debug availability/surface facts only.

## Phase 12: Remaining Verdict Audit

- [x] 12.1 Audit visibility moment and leak proof endpoint status/proofBoundary fields for the next raw-fact/gate ownership cleanup.
- [x] 12.2 Remove visibility moment `evidenceStatus`/`proofBoundary` payload from `LightProbeGridGPUTestHarness.js`; keep raw availability/mode/readback facts.
- [x] 12.3 Remove sealed-wall leak proof `proofBoundary`, `status`, and `linearPromotionStatus` payload from `LightProbeGridGPUTestHarness.js`; keep raw threshold metrics.
- [x] 12.4 Run final focused syntax, source-invariant, synthetic proof-gate, and `git diff --check` verification after the leak proof cleanup.

## Phase 13: Projection Profiler Raw-Fact Cleanup

- [x] 13.1 Audit `inspectComputeProjectionProfiling()` for diagnostic status/policy payload not consumed by proof gates.
- [x] 13.2 Remove profiler `status`, `timingPolicy`, `timingGated`, `gpuTimerQueryStatus`, and `projectionPhaseTimingStatus`; keep timing sources, static work, medians, and backend/fallback facts.
- [x] 13.3 Update core runner/source invariants to assert raw profiler shape instead of diagnostic status strings.
- [x] 13.4 Run final focused syntax, source-invariant, synthetic proof-gate, and `git diff --check` verification after the profiler cleanup.

## Phase 14: Projection Runtime Parity Gate Ownership

- [x] 14.1 Audit `inspectComputeProjectionRuntimeParity()` consumers for verdict-like `status`/`statusTransition` fields.
- [x] 14.2 Remove runtime parity `status` and `statusTransition`; keep backend, tolerance, coefficient, atlas, and fallback facts.
- [x] 14.3 Update proof gates and core assertions to derive the parity verdict from raw `tolerancePass` and threshold facts.
- [x] 14.4 Run final focused syntax, source-invariant, synthetic proof-gate, and `git diff --check` verification after the runtime parity cleanup.

## Phase 15: Projection Oracle Raw-Fact Cleanup

- [x] 15.1 Audit projection parity candidate, adapter fallback, parity contract, and atlas repack oracle payloads for proof-only status strings.
- [x] 15.2 Remove projection oracle `status`, transition, and pending/promotion labels; keep raw paths, capabilities, thresholds, and deltas.
- [x] 15.3 Update core assertions/source invariants to assert raw projection oracle facts instead of proof-only status strings.
- [x] 15.4 Run final focused syntax, source-invariant, synthetic proof-gate, and `git diff --check` verification after the projection oracle cleanup.

## Phase 16: Artifact Pressure Raw-Fact Cleanup

- [x] 16.1 Audit artifact pressure `status` producers and proof-validation consumers.
- [x] 16.2 Remove artifact pressure `status` from harness and image metric helpers; keep black-tail, luminance, and contrast facts.
- [x] 16.3 Update proof-validation/source invariants to derive pressure/bounded assertions from raw thresholds.
- [x] 16.4 Run final focused syntax, source-invariant, synthetic proof-gate, and `git diff --check` verification after artifact pressure cleanup.

## Phase 17: Artifact Snapshot Narrative Cleanup

- [x] 17.1 Audit artifact snapshot `referenceBoundary` and anti-ringing `action` prose payloads.
- [x] 17.2 Remove prose boundary/action payload from WebGPU/WebGL artifact snapshots; keep structured `proofRole` and `antiRingingPolicy` facts.
- [x] 17.3 Update proof validation to assert structured role/policy fields instead of prose boundary text.
- [x] 17.4 Run final focused syntax, source-invariant, synthetic proof-gate, and `git diff --check` verification after artifact snapshot narrative cleanup.

## Phase 18: Final Narrative Sweep

- [x] 18.1 Audit remaining `reason`, `referenceBoundary`, and `action` payloads in harness/diagnostic outputs.
- [x] 18.2 Remove projection adapter fallback prose `reason`; keep selected path, fallback flag, capability, and runtime guard facts.
- [x] 18.3 Run final focused syntax, source-invariant, synthetic proof-gate, and `git diff --check` verification after the narrative sweep.

## Phase 19: Leak Evidence Shape Cleanup

- [x] 19.1 Tighten receiver-surface agreement so `surfaceCpuRenderDelta` compares surface render capture only against surface CPU quadrature, not masked visible-pixel leak ratios.
- [x] 19.2 Remove tone-mapped sealed-wall wrong-side improvements as promotion-blocking proof gates; keep the linear pre-tone masked leak improvement and correct-bounce preservation gates.
- [x] 19.3 Update source invariants, roadmap, and proof ledger to guard the new evidence ownership shape.
- [x] 19.4 Run focused no-build verification after the leak evidence cleanup.

## Phase 20: Density Fixture Proof-Validation Cleanup

- [x] 20.1 Extract density-specific budget and same-fixture predicates in proof validation.
- [x] 20.2 Update source invariants and roadmap to guard named density fixture proof checks instead of repeated inline field chains.
- [x] 20.3 Run focused no-build verification after the proof-validation cleanup.

## Phase 21: Projection Oracle Runner Assertion Cleanup

- [x] 21.1 Extract core runner projection parity contract, compute candidate, adapter fallback, and atlas repack checks into named raw-fact predicates.
- [x] 21.2 Update source invariants and roadmap to guard the named projection-oracle predicate seams.
- [x] 21.3 Run focused no-build verification after the runner assertion cleanup.

## Phase 22: Visibility Runner Assertion Cleanup

- [x] 22.1 Extract visibility runner moment, weighting, escape, SH contribution, receiver-surface, and receiver-normal checks into named raw-fact predicates.
- [x] 22.2 Update source invariants and roadmap to guard the named visibility predicate seams.
- [x] 22.3 Run focused no-build verification after the visibility runner cleanup.

## Phase 23: Matrix Runner Assertion Cleanup

- [x] 23.1 Extract matrix runner probe occupancy, leak-proof fixture, leak-proof row, and restoration checks into named raw-fact predicates.
- [x] 23.2 Update source invariants and roadmap to guard the named matrix predicate seams.
- [x] 23.3 Run focused no-build verification after the matrix runner cleanup.

## Phase 24: Runtime Runner Assertion Cleanup

- [x] 24.1 Extract runtime runner bake-coalescing, benchmark backend/memory/visibility-depth/timing, and color-sanity checks into named raw-fact predicates.
- [x] 24.2 Update roadmap and proof ledger to record the runtime runner predicate seam.
- [x] 24.3 Run focused no-build verification after the runtime runner cleanup.

## Phase 25: Core Runtime Parity/Profile Assertion Cleanup

- [x] 25.1 Extract core runner compute projection runtime parity and profiling checks into named raw-fact predicates.
- [x] 25.2 Update source invariants, roadmap, and proof ledger to guard the named core parity/profile seams.
- [x] 25.3 Run focused no-build verification after the core runner cleanup.

## Phase 26: Proof Summary Validation Cleanup

- [x] 26.1 Extract proof-summary gate-count, id, compact-shape, required-supported, and byte-budget checks into named predicates.
- [x] 26.2 Update source invariants, roadmap, and proof ledger to guard the named proof-summary validation seam.
- [x] 26.3 Run focused no-build verification after the proof-summary cleanup.

## Phase 27: Density Row Proof-Validation Cleanup

- [x] 27.1 Extract density reference, shadowless, crisp-shadow, and damped row checks into named proof-validation predicates.
- [x] 27.2 Fix the density damped row assertion so its message is a real assertion message, not part of the boolean expression.
- [x] 27.3 Update source invariants, roadmap, and proof ledger to guard the named density row validation seam.
- [x] 27.4 Run focused no-build verification after the density row cleanup.

## Phase 28: Low-Res Proof-Validation Cleanup

- [x] 28.1 Extract low-res shared-intensity, band-isolation, bounce-preservation, and damped-comparison checks into named predicates.
- [x] 28.2 Update source invariants, roadmap, and proof ledger to guard the named low-res validation seam.
- [x] 28.3 Run focused no-build verification after the low-res proof-validation cleanup.

## Phase 29: Density Damped Predicate Split

- [x] 29.1 Split density damped fixture-preservation and math-action checks into separate named predicates.
- [x] 29.2 Update source invariants, roadmap, and proof ledger to guard the split density damped validation seam.
- [x] 29.3 Run focused no-build verification after the density damped predicate split.

## Phase 30: Density Crisp-Shadow Predicate Split

- [x] 30.1 Split density crisp-shadow row facts from cross-row reference comparison facts.
- [x] 30.2 Update source invariants, roadmap, and proof ledger to guard the split crisp-shadow validation seam.
- [x] 30.3 Run focused no-build verification after the density crisp-shadow predicate split.

## Phase 31: Receiver-Surface Agreement Ownership

- [x] 31.1 Change receiver-surface diagnostics to emit raw render and CPU surface wrong-ratio facts instead of a pre-derived delta.
- [x] 31.2 Derive receiver-surface CPU/render delta once inside proof gates with matching max-to-max aggregation, then feed that same derived fact to both the receiver-surface predicate and gate actual.
- [x] 31.3 Update runner assertions, source invariants, roadmap, and proof ledger to guard proof-gate ownership of receiver-surface agreement.
- [x] 31.4 Run focused no-build verification after the receiver-surface agreement ownership cleanup.

## Phase 32: Visibility Status Payload Cleanup

- [x] 32.1 Remove the unused `deriveVisibilityProofStatus()` wrapper and its `visibilityLabel`/`visibilityStatus`/`ddgiStatus` verdict payload.
- [x] 32.2 Keep moment-backed visibility validation on the raw `isMomentBackedVisibility()` predicate.
- [x] 32.3 Update source invariants, roadmap, and proof ledger to guard against reintroducing unused visibility/DDGI status payloads.
- [x] 32.4 Run focused no-build verification after the visibility status payload cleanup.

## Phase 33: Leak Evidence Artifact Visibility

- [x] 33.1 Write compact `leak-proof-facts.json` alongside `proof-summary.json` so baseline and visibility-moment leak rows remain directly auditable.
- [x] 33.2 Keep the artifact raw: sealed-wall fixture/settings/sampling plus the two baseline/candidate leak rows, without proof-gate verdicts or nested metric snapshots.
- [x] 33.3 Add artifact/source-invariant guards for finite raw leak and bounce metrics.
- [x] 33.4 Run focused no-build verification after the leak evidence artifact cleanup.

## Phase 34: Finite Proof Goal and Ground-Truth Oracle

- [x] 34.1 Reframe the roadmap around a finite proof package instead of endless payload cleanup.
- [x] 34.2 Add the sealed-wall ground-truth oracle (`wrongSideLeakTarget: 0`) to compact leak artifacts.
- [x] 34.3 Add proof-gate derivation for residual pre-tone masked wrong-side leak against the zero-leak oracle, separate from baseline-vs-candidate improvement.
- [x] 34.4 Guard the ground-truth oracle and residual leak proof shape with source invariants.
- [x] 34.5 Run focused no-build verification after the ground-truth oracle cleanup.

## Phase 35: Receiver-Surface Runtime Mirror Fix

- [x] 35.1 Identify the CPU receiver-surface diagnostic mismatch source: SH diagnostics blended coefficients using `visibilityWeightFloor` instead of mirroring runtime `visibilityMass`.
- [x] 35.2 Change SH diagnostics to compute runtime wrong-ratio from visibility irradiance scaled by `visibilityWeight / scalarWeight`, matching the runtime shader shape.
- [x] 35.3 Guard the runtime-mirror formula with source invariants so the stale `visibilityWeightFloor` blend cannot return.
- [x] 35.4 Run focused no-build verification after the receiver-surface mirror fix.

## Phase 36: SH Mixed-Color Risk Predicate Tightening

- [x] 36.1 Classify the SH mixed-color proof gate as over-broad because it promoted intermediate visibility aggregate wrong-ratio into final runtime risk.
- [x] 36.2 Tighten `shContribution.noBakedMixedColorRisk` to use runtime wrong-ratio plus hard wrong-side escape evidence.
- [x] 36.3 Guard the tightened runtime-risk predicate with source invariants.
- [x] 36.4 Run focused no-build verification after the SH-risk predicate tightening.

## Phase 37: Final Proof Package Framing

- [x] 37.1 Add a one-sentence final proof claim to the roadmap.
- [x] 37.2 Add explicit non-claims for perfect GI, zero leak, leaky baseline as ground truth, tone-mapped promotion, intermediate SH drift, and unrefreshed receiver-surface values.
- [x] 37.3 Mark refreshed focused eval proof as the remaining final evidence gap instead of adding more cleanup scope.
- [x] 37.4 Run focused no-build verification after the final proof package framing.

## Phase 38: Visibility Escape Gate Ownership

- [x] 38.1 Rerun focused Cornell proof smoke and inspect compact proof gates.
- [x] 38.2 Reclassify `wrongSideEscapedCount = 4` as visibility escape evidence instead of SH mixed-color risk because SH runtime wrong-ratio is low (`0.0318 < 0.25`).
- [x] 38.3 Add `visibilityWeighting.noWrongSideEscape` as the proof-gate owner for wrong-side escape evidence.
- [x] 38.4 Run focused no-build verification and refreshed proof smoke after the gate ownership split.

## Phase 39: Compact Escape Subcount Evidence

- [x] 39.1 Add compact open-gate evidence for visibility-bias and front-edge bypass escape subcounts.
- [x] 39.2 Rerun focused Cornell proof smoke and confirm the four wrong-side escapes are not visibility-bias or front-edge bypass cases.
- [x] 39.3 Run focused no-build verification after the compact escape evidence update.

## Phase 40: True Escape Reason Evidence

- [x] 40.1 Add compact true-escape reason counts for receiver-before-mean, high-Chebyshev, and weak-crush/weighting escapes.
- [x] 40.2 Surface those counts only through the visibility escape gate evidence, keeping row dumps and per-probe arrays out of proof artifacts.
- [x] 40.3 Rerun focused Cornell proof smoke and confirm the remaining sealed-wall escapes are `receiverBeforeMeanEscapeCount = 2`, `highChebyshevEscapeCount = 0`, and `weakCrushEscapeCount = 2`.
- [x] 40.4 Run focused no-build verification after the compact true-escape reason update.

## Phase 41: Double-Sided Visibility Distance Capture

- [x] 41.1 Make the visibility-distance override material double-sided so moment captures do not depend on mesh front-face orientation.
- [x] 41.2 Guard double-sided visibility-distance capture with source invariants.
- [x] 41.3 Rerun focused Cornell proof smoke and confirm the receiver-before-mean subcase is gone while `wrongSideEscapedCount = 4` remains as weak-crush/weighting evidence.
- [x] 41.4 Test and reject the more aggressive partial-hit Chebyshev heuristic because it did not improve escape or leak metrics.
- [x] 41.5 Run focused no-build verification after the visibility-distance capture update.

## Phase 42: Weak-Crush No-Hit Classification

- [x] 42.1 Add compact weak-crush subcounts for partial-hit, full-hit, no-hit, and near-threshold escape cases.
- [x] 42.2 Surface the weak-crush subcounts only through the visibility escape gate evidence.
- [x] 42.3 Rerun focused Cornell proof smoke and confirm all four weak-crush escapes are no-hit moment coverage misses.
- [x] 42.4 Run focused no-build verification after the weak-crush classification update.

## Phase 43: Visibility Angular Resolution Sweep

- [x] 43.1 Test 16px visibility-depth angular resolution and record that it improves residual leak but opens directional suppression.
- [x] 43.2 Test 12px visibility-depth angular resolution and record that it partially improves residual leak but still opens directional suppression.
- [x] 43.3 Test 10px visibility-depth angular resolution and record that it preserves gate shape but does not improve the blocking residual leak metric.
- [x] 43.4 Revert visibility-depth angular resolution to 8px because the sweep is not a clean proof fix.
- [x] 43.5 Run focused no-build verification after reverting the resolution sweep.

## Phase 44: Receiver-Surface Raw Gate Evidence

- [x] 44.1 Change the receiver-surface open gate actual from a naked delta to compact raw render/CPU inputs plus the derived delta.
- [x] 44.2 Guard the receiver-surface evidence owner with source invariants.
- [x] 44.3 Rerun focused Cornell proof smoke and record `renderSurfaceWrongRatio = 0.8219`, `surfaceRuntimeWrongRatioMax = 0.1263`, and `surfaceCpuRenderDelta = 0.6956`.
- [x] 44.4 Update roadmap and proof ledger so the remaining receiver-surface decision targets render/surface-capture disagreement.


## Phase 45: Receiver-Surface Center Capture Evidence

- [x] 45.1 Add compact receiver-surface center render wrong-ratio evidence to distinguish broad surface-region contamination from interior receiver disagreement.
- [x] 45.2 Surface the center fact only through receiver-surface diagnostic/proof-gate evidence.
- [x] 45.3 Rerun focused Cornell proof smoke and record `renderSurfaceCenterWrongRatio = 0.9314`, worse than broad `renderSurfaceWrongRatio = 0.8219`, while CPU runtime mirror remains `0.1263`.
- [x] 45.4 Classify the receiver-surface open gate as render/runtime diagnostic disagreement, not an overbroad projected surface-region artifact.


## Phase 46: Receiver-Surface Runtime-Irradiance Evidence

- [x] 46.1 Add compact receiver-center render evidence using `probeGrid.createIrradianceNode()` on an unlit basic material to separate runtime irradiance from standard-material shading.
- [x] 46.2 Add compact center CPU mirror evidence and an irradiance-center CPU/render delta in proof-gate actuals.
- [x] 46.3 Rerun focused Cornell proof smoke and record `renderIrradianceCenterWrongRatio = 0.5882`, `centerRuntimeWrongRatioMax = 0.0635`, and `irradianceCenterCpuRenderDelta = 0.5247`.
- [x] 46.4 Classify receiver-surface as a CPU mirror/runtime-node disagreement; standard material shading increases the visible wrong ratio, but runtime irradiance alone is already above the CPU center mirror.


## Phase 47: Receiver-Surface Linear-Irradiance Gate Fix

- [x] 47.1 Stop using display-mapped standard-material surface ratios as the receiver-surface CPU/render agreement metric.
- [x] 47.2 Derive `receiverSurface.cpuRenderAgreement` from linear unlit runtime-irradiance center render versus CPU center runtime mirror.
- [x] 47.3 Keep display-space surface and sRGB irradiance deltas as compact evidence only, not as the pass/fail metric.
- [x] 47.4 Rerun focused Cornell proof smoke and confirm proof summary moves to 14 supported / 2 open gates.


## Phase 48: Final Bounded Proof Package

- [x] 48.1 Add final proof package notes listing the supported gates, open gates, non-claims, and exact bounded leak-improvement claim.
- [x] 48.2 Keep the final claim honest: improvement versus the leaky scalar-validity baseline is about `5.8%`, while residual leak remains `0.942` against the zero-leak oracle.
- [x] 48.3 Mark receiver-surface as supported only for linear unlit runtime irradiance agreement; display-space surface ratios remain diagnostics.


## Phase 49: No-Wrong-Side Escape Localization

- [x] 49.1 Add compact gate-owned no-hit localization counters for divider crossing, segment intersection, receiver/probe direction mismatch, adjacent oct-bin hits, all-adjacent no-hit misses, distinct oct bins, and visibility-depth resolution.
- [x] 49.2 Rerun focused Cornell proof smoke and classify the remaining four escapes as 8px exact-oct-bin no-hit misses with adjacent-bin coverage.
- [x] 49.3 Keep `visibilityWeighting.noWrongSideEscape` open because the gate still reports `wrongSideEscapedCount = 4`; do not soften the residual leak gate or use scalar/WebGL baselines as truth.
- [x] 49.4 Run focused no-build verification after the no-hit localization update.


## Phase 52: Residual Leak Classification Closeout

- [x] 52.1 Rerun focused Cornell proof smoke and confirm the proof remains `OPEN` with 14 supported / 2 open gates.
- [x] 52.2 Confirm the remaining visibility escapes are classified as four 8px exact-oct-bin no-hit misses with adjacent-bin coverage, not receiver/probe direction mismatch, front-edge bypass, high-Chebyshev, or SH mixed-color risk.
- [x] 52.3 Classify `sealedWall.preToneMaskedWrongSideResidualLeakRatio = 0.942` as out-of-scope for this bounded patch because no clean GPU-resident visibility/probe-sampling fix materially reduces it without opening another gate.
- [x] 52.4 Keep the final claim honest: `0.8626` to `0.8126` pre-tone masked wrong-side leak improvement versus the leaky scalar-validity baseline, with residual leak still reported against the zero-leak oracle.


## Phase 53: Adjacent Visibility-Moment Rescue SDD

- [x] 53.1 Define the SDD goal: prove whether bounded GPU-resident adjacent lookup can eliminate the four exact-bin no-hit escapes without regressing suppression, bounce, compactness, or residual-leak honesty.
- [x] 53.2 Define the ideal state: `visibilityWeighting.noWrongSideEscape` supported with `wrongSideEscapedCount = 0`, while residual leak remains independently reported against the zero-leak oracle.
- [x] 53.3 Define non-goals: no threshold tuning, no baseline-as-truth, no CPU readback in runtime, no broad payloads, and no resolution increase as the first fix.
- [x] 53.4 Specify the preferred runtime candidate: exact-bin first, conditional cross-bin fallback only when hit confidence is zero, choose the adjacent hit with lowest computed Chebyshev visibility, and preserve no-hit behavior when no adjacent hit exists.
- [x] 53.5 Define cost-ceiling evidence: exact lookup count, fallback activation count, adjacent load count, rescued no-hit escape count, and no-adjacent-hit fallback count.
- [x] 53.6 Define over-occlusion rejection criteria: directional suppression, correct bounce, SH-risk, compactness, and residual-leak honesty must not regress.
- [x] 53.7 Define proof-gate evidence requirements, keeping fallback verdicts gate-owned and residual leak independent.
- [x] 53.8 Define focused verification: touched `node --check`, source invariants, `git diff --check`, and targeted Cornell WebGPU proof smoke.
- [x] 53.9 Define acceptance and rejection outcomes for the research prototype before implementation.


## Phase 54: Adjacent Visibility-Moment Rescue Prototype

- [x] 54.1 Add source invariants for GPU-resident adjacent lookup and compact fallback facts.
- [x] 54.2 Prototype conditional cross-bin fallback in runtime visibility sampling.
- [x] 54.3 Add compact raw fallback activity facts consumed by `visibilityWeighting.noWrongSideEscape` and any cost/over-occlusion proof checks.
- [x] 54.4 Run touched `node --check`, source invariants, and `git diff --check`.
- [x] 54.5 Run targeted Cornell WebGPU proof smoke and record that conditional-cross fallback activates 11 times, loads 44 adjacent moments, rescues 5, but leaves `wrongSideEscapedCount = 4`.
- [x] 54.6 Compare the unconditional-cross upper bound after conditional-cross does not close cleanly; it still leaves `wrongSideEscapedCount = 4` and opens directional suppression (`0.1838`) plus receiver-surface agreement (`0.2422`).
- [x] 54.7 Reject promotion because neither adjacent-cross variant closes no-wrong-side without opening other gates.
- [x] 54.8 Remove the adjacent lookup from runtime/mirror code and keep the gate open as a known 8px exact-bin visibility-moment limitation.


## Phase 55: External Baseline And Modernization Framing

- [x] 55.1 Verify upstream three.js probe-volume history: `#16228` requests light-probe interpolation, and `#18371` discusses grid volumes, per-object/material irradiance, HDR data, and GPU-friendly sampling.
- [x] 55.2 Record that the scalar/WebGL and old LightProbe paths are leaky comparators/problem statements, not ground truth.
- [x] 55.3 Cross-check external sources: DDGI/RTXGI papers/blogs, Unity APV docs, Flax/SDFGI docs, three.js forum/PR history, and Reddit practitioner threads point to visibility, validity, relocation/classification, and layer separation as leak controls. Treat Reddit as corroboration, not primary proof.
- [x] 55.4 Update roadmap, design, and proof ledger so the next healthy gap is visibility representation or probe classification/relocation, while adjacent fallback and threshold tuning stay rejected.
- [x] 55.5 Keep the trim rule explicit: no new diagnostic field unless a proof gate, artifact contract, or public example consumes it.


## Phase 56: Rejected Adjacent-Fallback Payload Trim

- [x] 56.1 Remove the rejected adjacent-fallback evaluator from `LightProbeGridGPUVisibilityWeightingStudy.js` so the diagnostic mirrors exact-bin visibility weighting again.
- [x] 56.2 Remove `adjacentFallback*` counters from visibility-study facts, proof facts, proof-gate evidence, and runner assertions.
- [x] 56.3 Keep adjacent-hit localization evidence because it classifies the 8px exact-bin no-hit misses; do not keep failed-rescue counters.
- [x] 56.4 Add source-invariant absence guards for rejected adjacent-fallback payloads.
- [x] 56.5 Verify touched syntax, source invariants, and diff hygiene.


## Phase 57: Visibility Representation SDD

- [x] 57.1 Define the visibility representation interface: angular resolution, moment filtering, bias policy, border/gutter handling, and over-occlusion guard facts.
- [x] 57.2 Add a design note that explains why the current 8px exact-bin behavior fails and why raw 12px/16px resolution sweeps are not sufficient.
- [x] 57.3 Prototype one representation candidate behind the visibility seam without adding CPU readback or proof helpers to runtime.
- [x] 57.4 Emit compact raw candidate facts only: resolution, effective bias, moment-hit coverage, wrong-side escape count, and wrong-minus-correct suppression.
- [x] 57.5 Reject or promote through existing proof gates; do not add a new gate that merely renames residual leak.


## Phase 58: Probe Classification And Relocation SDD

- [x] 58.1 Define classification categories for this proof: valid, invalid, interior, exterior, occluding, relocated.
- [x] 58.2 Decide which facts are runtime sampling metadata versus proof-only diagnostic evidence.
- [x] 58.3 Prototype wall-aware probe classification/relocation with compact aggregate facts, not per-probe row dumps.
- [x] 58.4 Gate classification against wrong-side escape reduction, correct-bounce preservation, and directional suppression.
- [x] 58.5 Reject any brightness-derived validity shortcut or fixture-only hack.


## Phase 59: Bias And Resolution Coupling

- [x] 59.1 Re-run 8/10/12/16 only after a candidate defines resolution-scaled moment/bias policy.
- [x] 59.2 Record residual leak, wrong-side escape count, directional suppression, receiver-surface agreement, SH-risk, and bounce for each resolution.
- [x] 59.3 Promote a resolution only if it improves representation evidence without opening previously supported gates.
- [x] 59.4 Keep `VISIBILITY_DEPTH_RESOLUTION = 8` unless the coupled candidate proves a better default.


## Phase 60: Product API Shape

- [x] 60.1 Audit public and example-facing controls for GPU-resident grid-volume sampling, object/material irradiance direction, and proof-scoped diagnostics.
- [x] 60.2 Keep scalar/WebGL comparison language as "same-class reference" or "leaky comparator", never oracle.
- [x] 60.3 Document which controls are product controls versus proof-only diagnostics.
- [x] 60.4 Reject scene-global mutable `LightProbe` state as the modernization target for this GPU module.


## Phase 61: Proof Compactness

- [x] 61.1 After every rejected prototype, remove its runtime branches, diagnostic counters, proof-fact fields, and assertion expectations.
- [x] 61.2 Keep only raw facts consumed by proof gates, artifact contracts, or public examples.
- [x] 61.3 Add source-invariant absence guards for rejected-path payloads.
- [x] 61.4 Run touched syntax checks, direct source invariants, and `git diff --check`.


## Phase 56: Cross-Bin Bake Dilation Closeout

- [x] 56.1 Add bounded one-pixel cardinal taps to the GPU visibility-moment repack so exact bins can capture nearby angular occluder coverage without adding runtime sampling loads.
- [x] 56.2 Guard the promoted bake shape with source invariants and keep runtime free of CPU readback/proof helpers.
- [x] 56.3 Run focused Cornell proof smoke and record that the safe cross dilation keeps 14 supported / 2 open gates, leaves `wrongSideEscapedCount = 4`, and improves residual leak from `0.942` to `0.9377`.
- [x] 56.4 Test the stronger one-pixel diagonal dilation and reject it because it reduces escapes to `3` but opens `receiverSurface.cpuRenderAgreement` and `shContribution.noBakedMixedColorRisk`.
- [x] 56.5 Keep both open gates honest: `visibilityWeighting.noWrongSideEscape` remains a compact exact-bin no-hit limitation, and `sealedWall.preToneMaskedWrongSideResidualLeakRatio` remains open against the zero-leak oracle.


## Phase 62: Open-Gate SDD Plan

- [x] 62.1 Treat `visibilityWeighting.noWrongSideEscape` and `sealedWall.preToneMaskedWrongSideResidualLeakRatio` as coupled evidence with separate verdict ownership.
- [x] 62.2 Define the next `noWrongSideEscape` candidate shape as a border-aware visibility representation policy, not a threshold, raw resolution, or adjacent-fallback tweak.
- [x] 62.3 Define required representation facts: angular resolution, resolution-scaled moment filter, bias policy, border/gutter behavior, and over-occlusion guards.
- [x] 62.4 Define residual-leak handling: keep zero-leak oracle independent, keep baseline as leaky comparator only, and block promotion if residual improvement comes from over-occlusion.
- [x] 62.5 Define rejection conditions before implementation: unchanged escapes without new classification, directional-suppression regression, receiver-surface/SH/bounce regression, runtime CPU helper, or payload bloat.


## Phase 63: Border-Aware Visibility Representation Candidate

- [x] 63.1 Specify the exact GPU-resident representation candidate: guttered octahedral visibility moments, wrapped-border moment coverage, or an equivalent tile-boundary policy.
- [x] 63.2 Define resolution-scaled bias before measurement, including how receiver-distance bias scales with angular texel size and probe spacing.
- [x] 63.3 Prototype only after 63.1 and 63.2 are explicit; do not add rejected-path payloads or CPU runtime readback.
- [x] 63.4 Emit compact raw facts consumed by existing gates: representation policy, border policy, angular resolution, effective bias, moment hit/no-hit coverage, wrong-side escape count, wrong-minus-correct suppression, residual leak, and correct-bounce preservation.
- [x] 63.5 Promote only if `visibilityWeighting.noWrongSideEscape` improves or closes while `visibilityWeighting.directionalSuppression`, receiver-surface agreement, SH-risk, correct bounce, runtime readiness, projection parity, moment readback, residual honesty, and compact proof shape remain supported.
- [x] 63.6 If rejected, record the failure in roadmap/ledger and trim runtime branches plus diagnostic fields immediately.


## Phase 64: Candidate Verdict And Trim

- [x] 64.1 Read the Phase 63 proof result through existing gates, not diagnostic prose.
- [x] 64.2 Promote only if wrong-side escapes improve or close without opening supported gates.
- [x] 64.3 If rejected, remove runtime branches, proof-fact fields, runner expectations, and source-invariant requirements tied only to the failed candidate.
- [x] 64.4 Preserve only source-backed failure classification facts consumed by existing gates.
- [x] 64.5 Record the verdict in roadmap and ledger before starting the next algorithmic lane.


## Phase 65: Wall-Aware Probe Classification/Relocation Candidate

- [x] 65.1 Start only if Phase 63 does not close the local escape class cleanly.
- [x] 65.2 Specify a real wall-aware policy: invalid/occluding exclusion, interior/exterior separation, bounded relocation, or another source-backed classification rule.
- [x] 65.3 Keep runtime GPU-resident by expressing classification as sampling metadata, not CPU proof helper behavior.
- [x] 65.4 Defer compact aggregate candidate facts until receiver-specific sampling metadata exists; do not emit fake classification policy, relocation policy, changed probe counts, excluded/relocated contribution counts, wrong-side escape count, residual leak, or over-occlusion guards.
- [x] 65.5 Reject brightness-derived validity, fixture-only hacks, per-probe row dumps, and diagnostic verdict payloads.
- [x] 65.6 Promote only if wrong-side escapes improve or close and directional suppression, receiver-surface agreement, SH-risk, bounce, runtime readiness, projection parity, and compact proof shape stay supported.


## Phase 66: Coupled Resolution/Bias Sweep

- [x] 66.1 Run only after a representation or classification policy defines scaled moment, bias, and border behavior.
- [x] 66.2 Compare angular resolutions with the same policy contract; do not run naked 8/10/12/16 sweeps.
- [x] 66.3 Record wrong-side escape count, residual leak, directional suppression, receiver-surface agreement, SH-risk, correct bounce, moment readback, runtime readiness, and compactness for each tested resolution.
- [x] 66.4 Promote a resolution only if it improves representation evidence without opening supported gates.
- [x] 66.5 Keep `VISIBILITY_DEPTH_RESOLUTION = 8` if no coupled resolution proves a better default.


## Phase 67: Residual Leak Oracle Closeout

- [x] 67.1 Evaluate residual leak only after local escape/classification evidence improves or closes.
- [x] 67.2 Keep `wrongSideLeakTarget = 0` as the only residual oracle.
- [x] 67.3 Preserve baseline/candidate leak rows as leaky-comparator evidence only.
- [x] 67.4 Reject residual improvement caused by over-occlusion, bounce loss, SH-risk regression, or receiver-surface regression.
- [x] 67.5 Close the residual gate only if measured residual reaches the zero-leak oracle; otherwise publish the exact residual as an open non-claim.


## Phase 68: Product API Hardening

- [x] 68.1 If a candidate promotes, audit public controls and example controls for stable GPU-resident shape.
- [x] 68.2 Keep proof/readback helpers out of `LightProbeGridGPU` runtime.
- [x] 68.3 Document sampling, memory, and visibility representation implications without exposing proof-only diagnostics as product API.
- [x] 68.4 Preserve object/material irradiance direction through `createIrradianceNode()` and `createLightsNode()`.


## Phase 69: Final Proof Package

- [x] 69.1 Run touched syntax checks, direct source invariants, `git diff --check`, and targeted Cornell WebGPU proof smoke.
- [x] 69.2 Record supported gates and open gates exactly from proof summary.
- [x] 69.3 State exact residual leak against zero and exact baseline/candidate leak rows.
- [x] 69.4 List rejected paths and confirm their runtime/proof payloads are absent.
- [x] 69.5 Keep scalar/WebGL framed as same-class reference or leaky comparator only.


## Phase 70: Archive Or Continue Decision

- [x] 70.1 Archive the SDD as a bounded proof patch if no candidate improves the local escape class without over-occlusion.
- [x] 70.2 Continue only if new evidence changes the failure class or introduces a source-backed representation/classification policy.
- [x] 70.3 If continuing, create the next phase from evidence, not from constants or threshold guesses.


## Phase 71: Source-Backed Open-Gate Reframe

- [x] 71.1 Research primary/official DDGI, RTXGI, Unity APV, and Flax DDGI sources for leak mitigation, probe validity, relocation, classification, visibility, layer, and memory/pipeline shape.
- [x] 71.2 Map the research back to the two open gates without reopening threshold tuning, naive adjacent fallback, naked resolution bumps, or scalar/WebGL-as-truth framing.
- [x] 71.3 Record that the next valid algorithmic lane is receiver-scoped probe shaping / layer-mask sampling, not another exact-bin constant.
- [x] 71.4 Define over-occlusion rejection facts before prototype: directional suppression, correct bounce, SH-risk, receiver-surface agreement, runtime readiness, projection parity, moment readback, residual honesty, and compact proof shape.


## Phase 72: Receiver-Scoped Probe Mask API SDD

- [x] 72.1 Specify the runtime API seam for per-node/per-material receiver masks, such as `createIrradianceNode( { receiverLayerMask } )`, without relying on grid-global mutation.
- [x] 72.2 Specify probe-layer metadata packing and memory policy, preferring the existing GPU probe-validity/layer path unless a new metadata texture is justified.
- [x] 72.3 Specify the GPU compatibility weighting rule and source invariants that keep runtime free of CPU readback/proof helpers.
- [x] 72.4 Specify compact raw diagnostic facts for shaping policy, probe/receiver mask modes, compatible/incompatible aggregate counts, wrong-side exclusion, correct-side preservation, wrong-side escape count, residual leak, and guard-gate inputs.
- [x] 72.5 Prototype the runtime API seam only: `createIrradianceNode( options = {} )` / `createLightsNode( sceneLights = [], options = {} )` accept receiver-scoped mask input and keep compatibility testing GPU-resident against `probeMeta.b`.
- [x] 72.6 Prototype the probe metadata seam: optional `probeLayerMasks` are validated and packed into the existing `probeMeta.b` channel without allocating a new metadata texture.
- [x] 72.7 Add default-compatible side-mask metadata to the Cornell harness so ordinary receivers still match all probes while future proof receivers can request left/right compatibility.
- [x] 72.8 Add compact receiver-scoped shaping preview facts: shaping policy, probe/receiver mask modes, compatible/incompatible counts, excluded wrong-side probes, preserved correct-side probes, shaped wrong-side escape count, and preservation/exclusion ratios.
- [x] 72.9 Apply receiver-specific masks in render/proof only after the shaping preview is asserted, then promote only if `visibilityWeighting.noWrongSideEscape` improves or closes while all supported gates remain supported and residual leak stays measured against the zero-leak oracle.


## Phase 73: Receiver-Scoped Mask Candidate Verdict

- [x] 73.1 Run focused Cornell WebGPU proof smoke with receiver-specific left/right masks applied in render/proof.
- [x] 73.2 Promote `visibilityWeighting.noWrongSideEscape` only through existing proof gates, with receiver-scoped shaping facts showing zero shaped wrong-side escapes and full correct-side preservation.
- [x] 73.3 Confirm `visibilityWeighting.directionalSuppression`, receiver-surface agreement, SH-risk, correct bounce, runtime readiness, projection parity, moment readback, and compact proof shape stay supported.
- [x] 73.4 Keep `sealedWall.preToneMaskedWrongSideResidualLeakRatio` open against `wrongSideLeakTarget = 0`; record `0.9377` as residual scene leak, not as a local escape failure.
- [x] 73.5 Record the final proof package as `OPEN` with 15 supported / 1 open gate, and continue only on residual visibility/probe shaping or product API hardening that preserves the promoted receiver-scoped mask contract.


## Phase 74: Residual Leak Attribution SDD

- [x] 74.1 Re-read the residual gate math and classify it as rendered wrong-side energy relative to the leaky baseline-to-zero gap, not as `wrongSideEscapedCount`.
- [x] 74.2 Record that receiver-scoped shaping closes the compatible wrong-side probe class but leaves candidate pre-tone masked wrong-side color at `0.8089`, producing residual ratio `0.9377`.
- [x] 74.3 Define the next candidate precondition: attribute residual energy by source class before changing visibility math, probe shape, material response, or bake geometry.
- [x] 74.4 Add compact residual attribution facts only if they are raw measured source facts consumed by existing residual/guard gates.
- [x] 74.5 Do not prototype from Phase 74 attribution alone; defer residual code until a later GPU-resident policy preserves the Phase 73 receiver-scoped mask contract.
- [x] 74.6 Run focused Cornell WebGPU proof smoke and record residual attribution: screen-region `1.0053`, surface `0.9359`, surface-center `0.9666`, masked-visible `1.0012`, and pre-tone masked `0.9377`.


## Phase 75: Rendered Receiver Residual Source SDD

- [x] 75.1 Define the residual source question: why masked-visible wrong-side color remains near baseline (`1.0012`) after receiver-scoped compatibility shaping closes wrong-side probe escape.
- [x] 75.2 Preserve Phase 73 as a hard dependency: per-node receiver masks, GPU probe metadata, supported no-wrong-side escape, and all over-occlusion guards stay intact.
- [x] 75.3 Add source-class facts only if they distinguish probe SH content, receiver/material response, bake geometry coverage, visibility moment energy, or projection/atlas contribution.
- [x] 75.4 Do not prototype from the center-irradiance split alone; defer until a candidate names its GPU-resident policy and explains why it should reduce masked-visible residual without suppressing correct-side bounce.
- [x] 75.5 Run focused Cornell WebGPU proof smoke and record source split: candidate display irradiance center wrong-ratio `0.6241`, candidate linear irradiance center wrong-ratio `0`, and candidate linear-irradiance-to-masked-visible ratio `0`.


## Phase 76: Visible-Surface / Material Response SDD

- [x] 76.1 Define the next source question: why masked visible receiver pixels remain leaky when candidate center linear irradiance is clean.
- [x] 76.2 Preserve Phase 73 and Phase 75 contracts: no probe-escape reopening, no threshold tuning, no raw resolution bumping, no adjacent fallback, and no scalar/WebGL-as-truth framing.
- [x] 76.3 Add compact facts that distinguish receiver surface coverage, material response, tone/output mapping, and visible-pixel mask geometry.
- [x] 76.4 Do not prototype from visible-surface/material facts alone; defer until a GPU-resident policy can reduce masked-visible residual without over-occluding correct bounce.
- [x] 76.5 Run focused Cornell WebGPU proof smoke and record visible-surface/material facts: candidate masked visible pixel count `5557`, masked visible pixel ratio `0.0138`, masked-visible-to-surface-center ratio `0.7867`, and pre-tone-to-masked-visible ratio `1.1102`.


## Phase 77: Material/Output Mapping Attribution SDD

- [x] 77.1 Define the next source question: why pre-tone masked residual is stronger than display masked-visible residual while center linear irradiance remains clean.
- [x] 77.2 Preserve Phase 73-76 contracts: receiver masks stay promoted, residual remains open against zero, and material/output facts cannot become proof verdicts.
- [x] 77.3 Add compact facts only if they separate material response, tone mapping, output color space, and surface sampling without adding runtime CPU readback helpers.
- [x] 77.4 Do not prototype from material/output facts alone; defer until a GPU-resident material/output policy can reduce residual without suppressing correct bounce.
- [x] 77.5 Run focused Cornell WebGPU proof smoke and record material/output split: candidate display irradiance masked wrong-ratio `0.7244`, candidate linear irradiance masked wrong-ratio `0.5037`, and candidate masked-irradiance-to-masked-visible ratio `0.6913`.


## Phase 78: Material Albedo / BRDF Attribution SDD

- [x] 78.1 Define the next source question: why standard-material pre-tone masked wrong-ratio (`0.8089`) is higher than irradiance-only linear masked wrong-ratio (`0.5037`) under the same receiver mask.
- [x] 78.2 Preserve Phase 73-77 contracts: no probe-escape reopening, no residual oracle change, no presentation-only proof fix, and no scalar/WebGL-as-truth framing.
- [x] 78.3 Add compact facts only if they distinguish material albedo, BRDF response, normal/surface sampling, and output mapping for the same masked receiver pixels.
- [x] 78.4 Do not prototype from material-albedo facts alone; defer because albedo was rejected as the primary residual amplifier.
- [x] 78.5 Run focused Cornell WebGPU proof smoke and record material facts: receiver material type `standard`, albedo wrong-side ratio `1.0655`, roughness `0.82`, metalness `0`, and pre-tone-masked-to-albedo ratio `0.7592`.


## Phase 79: BRDF / Surface-Normal Transport Attribution SDD

- [x] 79.1 Define the next source question: why standard material pre-tone residual exceeds irradiance-only linear residual after albedo is shown not to be the primary amplifier.
- [x] 79.2 Preserve Phase 73-78 contracts: receiver masks stay promoted, residual stays open against zero, and material facts stay raw.
- [x] 79.3 Add compact facts only if they distinguish BRDF response, receiver normal/surface sampling, direct-light exclusion, and probe-only transport under the same masked pixels.
- [x] 79.4 Do not prototype from BRDF facts alone; defer because BRDF/material response contributes but does not fully explain the residual.
- [x] 79.5 Run focused Cornell WebGPU proof smoke and record BRDF facts: Lambert display masked wrong-ratio `0.7286`, Lambert linear masked wrong-ratio `0.6565`, linear-Lambert-to-linear-irradiance ratio `1.3034`, and pre-tone-masked-to-linear-Lambert ratio `1.2321`.


## Phase 80: Receiver Normal / Surface Sampling Attribution SDD

- [x] 80.1 Define the next source question: why linear Lambert masked response remains higher than irradiance-only linear masked response and why standard pre-tone remains higher than Lambert.
- [x] 80.2 Preserve Phase 73-79 contracts: receiver masks stay promoted, residual stays open against zero, and BRDF facts stay raw.
- [x] 80.3 Add compact facts only if they distinguish receiver normal orientation, surface sample distribution, visible-pixel mask distribution, and probe-only transport under the same masked pixels.
- [x] 80.4 Do not prototype from receiver-normal facts alone; defer because normal convention and surface coverage mismatch were rejected as primary explanations.
- [x] 80.5 Run focused Cornell WebGPU proof smoke and record receiver normal/surface facts: minimum camera-dot-CPU-normal `0.7999` and receiver surface region area ratio `0.0136`, alongside masked visible pixel ratio `0.0138`.


## Phase 81: Receiver Surface Spatial Distribution SDD

- [x] 81.1 Define the next source question: why residual persists when receiver normals are front-facing and visible-mask coverage matches receiver surface area.
- [x] 81.2 Preserve Phase 73-80 contracts: receiver masks stay promoted, residual stays open against zero, and surface facts stay raw.
- [x] 81.3 Add compact facts only if they distinguish center, quadrature, masked-pixel, and edge/near-divider receiver-surface distribution under the same probe-only setup.
- [x] 81.4 Do not prototype from spatial facts alone; use them to justify the Phase 82 receiver surface/discontinuity policy lane instead.
- [x] 81.5 Run focused Cornell WebGPU proof smoke and record spatial distribution facts: near-divider edge wrong-ratio `0.8729`, near-divider-edge-to-surface-center ratio `0.9425`, and near-divider-edge-to-masked-visible ratio `1.1981`.


## Phase 82: Near-Divider Surface Distribution Candidate SDD

- [x] 82.1 Define the candidate source class: residual is spatially concentrated near the divider-facing receiver edges after receiver masks, material color, BRDF, normal convention, and coverage mismatch have been ruled out as primary explanations.
- [x] 82.2 Preserve Phase 73-81 contracts: receiver masks stay promoted, residual stays open against zero, and no threshold/resolution/fallback path is reopened.
- [x] 82.3 Specify the GPU-resident policy contract: receiver/material/node-scoped surface-discontinuity metadata may reweight only compatible receiver-owned probe contribution, must reuse the promoted receiver mask seam where possible, and must not become a sealed-wall fixture hack.
- [x] 82.4 Define prototype preconditions: memory layout/channel ownership, runtime node weighting rule, over-occlusion guards, compact aggregate facts, and default behavior must be named before implementation.
- [x] 82.5 Specify the concrete receiver descriptor layout and GPU weighting rule, or record why the current runtime seam cannot express it without a broader receiver-surface metadata API.
- [x] 82.6 Prototype only after 82.5 is clear; this condition is satisfied by the later Phase 98-101 receiver descriptor/WGSL selector path, with no CPU runtime helpers or rejected-path payloads.


## Phase 83: Receiver Descriptor Layout SDD

- [x] 83.1 Resolve the runtime seam fork: the existing `receiverLayerMask` node/value input can express a discrete dynamic mask, but not a continuous boundary weight without a future API.
- [x] 83.2 Specify the descriptor layout candidate: keep probe ownership in `probeMeta.b`, use a receiver-supplied GPU uint mask node, and select stricter boundary-compatible probe classes only from material/object surface metadata.
- [x] 83.3 Specify the GPU weighting rule: keep the existing compatibility test `probeMeta.b & receiverLayerMask != 0`; boundary behavior changes the dynamic mask, not the visibility moment lookup or proof gate threshold.
- [x] 83.4 Define the rejection line: if boundary-safe probe ownership can only be authored as Cornell divider logic, defer the prototype rather than hard-code it.
- [x] 83.5 Defer prototype: the runtime seam can consume a dynamic mask, but the proof has not yet named a generic bake-authored boundary-safe probe class assignment.


## Phase 84: Boundary-Safe Probe Ownership Authoring SDD

- [x] 84.1 Define boundary-safe probe classes as setup/bake metadata consumed through `probeMeta.b`, not runtime-inferred wall facts.
- [x] 84.2 Keep the current memory policy: use the existing 24-bit probe ownership field unless a later product scene justifies a new metadata texture or descriptor buffer.
- [x] 84.3 Preserve the runtime consumption rule: GPU compatibility remains `probeMeta.b & receiverLayerMask != 0`, with receiver masks supplied as GPU node/value inputs.
- [x] 84.4 Bound the Cornell harness role: it may demonstrate authored ownership through public setup paths, but any left/right/divider helper remains proof scoped and cannot become runtime behavior.
- [x] 84.5 Defer until authored boundary-safe classes and compact aggregate proof facts are defined without Cornell-only semantics; later Phases 89-96 supply the layer/region adapter and fact bridge.


## Phase 85: Boundary Ownership Proof-Fact Contract SDD

- [x] 85.1 Define fact ownership: runtime owns only GPU compatibility inputs, diagnostics emit compact raw aggregates, and proof gates own verdicts.
- [x] 85.2 Specify required aggregate facts: policy id, probe ownership mask mode, receiver mask mode, interior/boundary-safe probe counts, boundary-selected receiver sample ratio, compatible contribution ratios, wrong-side exclusion, correct-side preservation, residual input, near-divider spatial ratio, and correct-bounce energy ratio.
- [x] 85.3 Specify non-facts: no per-probe rows, per-pixel dumps, Cornell divider coordinates, rejected-path payloads, CPU runtime readback, scalar/WebGL truth fields, or threshold verdicts.
- [x] 85.4 Keep prototype deferred until the aggregate facts are tied to a generic authored ownership assignment rather than left/right Cornell semantics.
- [x] 85.5 Defer until 85.4 is satisfied; later Phases 93 and 96 implement the compact proof-harness fact bridge without widening the live interface.


## Phase 86: Generic Boundary Ownership Assignment SDD

- [x] 86.1 Tie the assignment contract to source-backed engine patterns: layer masks / placement filters, invalidity and dilation, virtual offset or relocation, probe distance/visibility, and surface/SDF representation.
- [x] 86.2 Define allowed assignment sources: author-provided scene/material/renderer layers, bake/setup geometry classification, authored probe invalidity/relocation/dilation state, and receiver GPU node/value masks.
- [x] 86.3 Reject assignment sources that would reopen prior failures: Cornell-only runtime divider coordinates, brightness-derived validity, proof residual values, CPU runtime readback, scalar/WebGL truth, threshold tuning, adjacent fallback, and proof row payloads.
- [x] 86.4 Record the current verdict: Cornell side masks are valid region ownership for receiver-scoped compatibility, but not a generic boundary-safe ownership assignment for the residual gate.
- [x] 86.5 Defer until a bake/setup assignment adapter can derive stable ownership bits from product-visible layers or geometry classification; later Phases 89-96 supply the layer/region adapter path and aggregate facts.


## Phase 87: Probe Ownership Assignment Adapter SDD

- [x] 87.1 Define the adapter seam as setup/bake-time ownership assignment that outputs `probeLayerMasks`; runtime sampling remains GPU-resident and consumes only packed metadata plus receiver GPU mask input.
- [x] 87.2 Specify adapter inputs and outputs: probe positions, grid resolution, default mask, authored ownership rules, and a `Uint32Array` of 24-bit masks with length `resolution^3`.
- [x] 87.3 Specify allowed rule sources: product-visible layers, material/renderer tags, region volumes, or bake-geometry classification outputs.
- [x] 87.4 Specify deterministic conflict handling: defaults preserve current scenes, rule ordering is stable, and compatible classes combine by bitwise OR only when intentionally compatible.
- [x] 87.5 Keep Cornell `createProbeLayerMaskData()` proof-scoped: it demonstrates pre-upload authoring, but it is not the generic adapter.
- [x] 87.6 Defer the prototype and record the residual gate as blocked on product authoring shape: a reusable adapter with only the Cornell side split would be a renamed fixture helper.


## Phase 88: Product Authoring Shape Gap SDD

- [x] 88.1 Record the blocker: generic boundary-safe ownership needs product-visible authoring shape before runtime can consume it without Cornell-specific inference.
- [x] 88.2 Define unblocked authoring shapes: layer ownership, region ownership, geometry classification, and probe-state ownership from invalidity/relocation/dilation.
- [x] 88.3 Define minimum adapter promotion criteria: two non-identical rule sources, default-mask preservation, deterministic conflicts, Phase 85 aggregate facts, and residual honesty against zero.
- [x] 88.4 Classify the blocker correctly: this is not runtime GPU residency or proof infrastructure; it is missing product authoring semantics.
- [x] 88.5 Defer until one product API authoring shape and one distinct setup/bake classification source are selected; later Phases 89 and 90 satisfy this with layer and region ownership.


## Phase 89: Layer Ownership Product Shape SDD

- [x] 89.1 Select layer ownership as the first product-facing authoring shape because three.js already exposes `Object3D.layers` and the `Layers` bitmask vocabulary.
- [x] 89.2 Define the storage contract: authored layer ownership may map to `probeLayerMasks`, limited to the current 24-bit `probeMeta.b` range.
- [x] 89.3 Define the receiver contract: existing `receiverLayerMask` node/value input consumes the mapped GPU mask; runtime sampling still sees only the mask.
- [x] 89.4 Define non-automatic behavior: render-layer membership does not change probe ownership unless setup/bake tooling maps it into probe metadata.
- [x] 89.5 Preserve default compatibility: default scenes keep `DEFAULT_PROBE_LAYER_MASK`, and layer-owned probes OR the default bit only when intentionally compatible with default receivers.
- [x] 89.6 Keep adapter prototype deferred until a second distinct setup/bake classification source is selected.


## Phase 90: Region Ownership Product Shape SDD

- [x] 90.1 Select region ownership as the second setup/bake classification source because the grid has min/max bounds, deterministic probe coordinates, and world-space probe positions during setup.
- [x] 90.2 Define the first region shape as an axis-aligned `Box3` volume over probe world positions.
- [x] 90.3 Define the output contract: region rules write the same 24-bit ownership masks consumed by `probeLayerMasks`.
- [x] 90.4 Preserve runtime GPU residency: region classification happens before runtime upload; sampling still consumes `probeMeta.b` and receiver GPU masks.
- [x] 90.5 Define conflict/default policy: probes outside regions keep the default mask, compatible overlaps may OR masks, and incompatible overlaps become setup diagnostics.
- [x] 90.6 Prototype only after the concrete adapter interface names layer and region rule schemas plus Phase 85 aggregate facts.


## Phase 91: Probe Ownership Assignment Adapter Interface SDD

- [x] 91.1 Specify adapter inputs: grid min/max, resolution, default mask, layer rules, region rules, and conflict policy.
- [x] 91.2 Specify layer rule schema: name, source `Layers` bitmask, 24-bit ownership mask, and default compatibility flag.
- [x] 91.3 Specify region rule schema: name, world-space `Box3` or min/max pair, 24-bit ownership mask, default compatibility flag, and compatible-overlap names.
- [x] 91.4 Specify adapter outputs: `probeLayerMasks` plus compact `assignmentFacts`.
- [x] 91.5 Specify validation and rejection inputs: 24-bit masks, finite non-empty boxes, unique names, incompatible overlap facts, and no scene-pixel/proof-verdict/visibility-readback/scalar-WebGL dependency.
- [x] 91.6 Prototype only after an implementation plan ties `assignmentFacts` to Phase 85 proof facts without widening runtime sampling.


## Phase 92: Assignment Facts To Proof Facts Mapping SDD

- [x] 92.1 Define one-way raw mapping from adapter diagnostics to Phase 85 fact names; proof gates retain verdict ownership.
- [x] 92.2 Map assignment-owned fields: policy id, probe ownership mask mode, interior/default-compatible probe count, and boundary-safe assigned probe count.
- [x] 92.3 Identify receiver/proof-owned fields that the adapter cannot emit alone: receiver mask mode, boundary-selected receiver sample ratio, contribution ratios, wrong-side exclusion, correct-side preservation, residual ratio, spatial ratio, and correct-bounce energy.
- [x] 92.4 Define implementation constraints: keep `assignmentFacts` separate from residual attribution, add no rejected-path payloads, and infer no residual improvement from assignment coverage alone.
- [x] 92.5 Prototype only after the runtime/proof-side fields have a compact proof-harness plan.


## Phase 93: Boundary Ownership Proof Harness Facts SDD

- [x] 93.1 Define compact proof-harness fact object `boundaryOwnershipShaping`.
- [x] 93.2 Specify receiver/proof-owned fields: receiver mask mode, boundary-selected receiver sample ratio, contribution ratios, wrong-side exclusion, correct-side preservation, and preservation/exclusion ratios.
- [x] 93.3 Specify referenced gate-owned fields: pre-tone residual ratio, near-divider spatial ratio, and correct-bounce energy ratio are copied from existing proof paths, not recomputed.
- [x] 93.4 Preserve ownership rules: adapter owns assignment coverage, proof harness owns receiver/contribution classification, gates own verdicts.
- [x] 93.5 Prototype only if `boundaryOwnershipShaping` consumes adapter `assignmentFacts`, emits compact aggregate fields only, and preserves existing residual/bounce owners.


## Phase 94: Layer / Region Rule Binding SDD

- [x] 94.1 Record the implementation finding: layer rules define ownership classes, but region rules select probes; counting them as independent probe-assignment sources would be a shallow adapter.
- [x] 94.2 Specify binding: region rules may assign `ownershipMask` directly or reference a named layer rule through `layerRuleName`.
- [x] 94.3 Specify validation: if a region rule provides both `ownershipMask` and `layerRuleName`, the resolved masks must agree after default compatibility is applied.
- [x] 94.4 Specify assignment facts for binding: bound layer rule count, unbound layer rule count, region rule count, assigned probe count, and default probe count.
- [x] 94.5 Protect the binding contract with source invariants/docs so two arrays cannot masquerade as two classifiers.
- [x] 94.6 Prototype the adapter only after implementing the binding contract without widening runtime sampling.


## Phase 95: Probe Ownership Assignment Adapter Prototype

- [x] 95.1 Add setup-only `LightProbeGridGPUProbeOwnership` module that emits `probeLayerMasks` plus compact `assignmentFacts`.
- [x] 95.2 Validate masks, finite non-empty boxes, unique rule names, and layer/region binding agreement.
- [x] 95.3 Route Cornell `createProbeLayerMaskData()` through the adapter while keeping Cornell ownership proof-scoped.
- [x] 95.4 Add source invariants proving the adapter is setup-only, binds region rules to layer classes, and avoids proof/runtime readback dependencies.
- [x] 95.5 Run touched syntax checks, direct source invariants, direct Cornell mask equivalence, and `git diff --check`.


## Phase 96: Boundary Ownership Shaping Facts Prototype

- [x] 96.1 Preserve adapter `assignmentFacts` in the Cornell example context without widening runtime sampling.
- [x] 96.2 Emit compact `boundaryOwnershipShaping` facts from adapter assignment coverage plus receiver-scoped shaping aggregates.
- [x] 96.3 Carry `boundaryOwnershipShaping` through proof facts/evidence without adding verdict fields or residual-derived payloads.
- [x] 96.4 Add runner/source invariants for the compact fact shape and existing ownership boundaries.
- [x] 96.5 Run touched syntax checks, direct source invariants, and `git diff --check`.


## Phase 97: Residual Decision Boundary SDD

- [x] 97.1 Reclassify the remaining open gate as rendered masked receiver energy after receiver-scoped compatibility shaping, not unresolved wrong-side probe escape.
- [x] 97.2 Record current residual evidence: clean center linear irradiance, non-zero masked linear irradiance, stronger Lambert/material response, near-divider edge concentration, and matching masked/surface coverage.
- [x] 97.3 Reject stale explanations: wrong-side escape, center linear irradiance contamination, albedo-only amplification, broad visible-mask mismatch, and receiver-normal convention.
- [x] 97.4 Name the only eligible next seams: GPU-resident receiver descriptor, material response policy, or stronger visibility/probe representation.
- [x] 97.5 Add source invariants/ledger guards and run focused no-build verification.


## Phase 98: Receiver Discontinuity Descriptor Contract SDD

- [x] 98.1 Define the candidate interface: existing `receiverLayerMask`, optional `receiverBoundaryLayerMask`, and optional GPU `receiverBoundaryWeight`.
- [x] 98.2 Define default behavior: no boundary descriptor preserves the current Phase 96 receiver-scoped ownership path exactly.
- [x] 98.3 Define memory/runtime policy: keep probe ownership in `probeMeta.b`, keep receiver classification GPU-resident, and forbid proof-pixel/readback/residual/scalar-WebGL dependencies.
- [x] 98.4 Define compact aggregate proof facts only: policy id, mask modes, boundary-selected receiver sample ratio, compatible contribution ratios, wrong-side exclusion, correct-side preservation, residual input, spatial ratio, and correct-bounce ratio.
- [x] 98.5 Define over-occlusion guards: no-wrong-side escape, directional suppression, receiver-surface agreement, SH-risk, correct bounce, runtime readiness, projection parity, moment readback, residual honesty, and compact proof shape must remain supported.
- [x] 98.6 Hold prototype until `receiverBoundaryWeight` has a generic authored source; Cornell divider coordinates or residual-derived descriptors remain rejected.


## Phase 99: Authored Boundary Weight Source SDD

- [x] 99.1 Select caller-authored GPU node/value metadata as the minimum generic source for `receiverBoundaryWeight`.
- [x] 99.2 Allow constants, uniform-like node values, vertex/attribute-derived nodes, material-node expressions, or setup-authored receiver metadata resolved to GPU floats.
- [x] 99.3 Reject proof residuals, masked pixels, visibility readbacks, scalar/WebGL comparison, CPU readback, Cornell divider coordinates in runtime, brightness-derived classification, and post-hoc threshold tuning.
- [x] 99.4 Require the effective boundary weight to be clamped or saturated to `[0, 1]`.
- [x] 99.5 Hold implementation until the deterministic GPU mask selection rule is specified as classification rather than irradiance energy scaling.


## Phase 100: WGSL Boundary Mask Selection API Prototype

- [x] 100.1 Add `receiverBoundaryLayerMask` and `receiverBoundaryWeight` option handling to `createIrradianceNode()`.
- [x] 100.2 Default `receiverBoundaryLayerMask` to the existing resolved `receiverLayerMask` and `receiverBoundaryWeight` to `0`.
- [x] 100.3 Clamp/saturate `receiverBoundaryWeight` to `[0, 1]` on the GPU node path.
- [x] 100.4 Select `effectiveReceiverLayerMask` through a native WGSL helper using WGSL `select( receiverLayerMask, receiverBoundaryLayerMask, receiverBoundaryWeight >= 0.5 )`.
- [x] 100.5 Convert probe/receiver compatibility through a native WGSL helper using WGSL `select( 0.0, 1.0, ( probeLayerMask & receiverLayerMask ) != 0u )`.
- [x] 100.6 Use only `effectiveReceiverLayerMask` in the existing `probeMeta.b` compatibility test; do not change visibility moments, angular resolution, bias, SH sampling, or residual proof math.
- [x] 100.7 Add source invariants for the selector and keep focused proof smoke deferred until a harness supplies a non-default boundary descriptor.


## Phase 101: Boundary Descriptor Harness Equivalence Prototype

- [x] 101.1 Add proof-harness helper `createReceiverBoundaryDescriptor( mask )` with `receiverBoundaryLayerMask` and `receiverBoundaryWeight = 1`.
- [x] 101.2 Route unlit receiver irradiance capture through the descriptor helper.
- [x] 101.3 Route Lambert receiver response capture through the descriptor helper.
- [x] 101.4 Route receiver material light-node setup through the descriptor helper.
- [x] 101.5 Preserve non-claims: descriptor equivalence only, no automatic discontinuity detection, no runtime Cornell divider coordinates, and no residual movement claim without focused proof.
- [x] 101.6 Run focused Cornell WebGPU proof smoke and record `OPEN`, 15 supported / 1 open, with residual still `0.9377`.


## Phase 102: Final Package Reconciliation

- [x] 102.1 Treat Phase 101 as the authoritative current proof state: `OPEN`, 15 supported / 1 open.
- [x] 102.2 Keep older 13/3 and 14/2 summaries as historical rejected-path evidence, not current verdicts.
- [x] 102.3 Record that `visibilityWeighting.noWrongSideEscape` and `visibilityWeighting.directionalSuppression` are supported after WGSL descriptor routing.
- [x] 102.4 Keep `sealedWall.preToneMaskedWrongSideResidualLeakRatio = 0.9377` open against the zero-leak oracle.
- [x] 102.5 Do not add runtime code, proof payloads, or rejected-path fields during reconciliation.
- [x] 102.6 Rerun focused Cornell WebGPU smoke after WGSL compatibility classification and record the same `OPEN`, 15 supported / 1 open proof state.


## Phase 103: Checklist Guard Reconciliation

- [x] 103.1 Audit all unchecked task boxes and classify them as guard/defer decisions or superseded preconditions, not missing residual implementations.
- [x] 103.2 Close Phase 74-81 prototype guard boxes as explicit "do not prototype from this evidence alone" decisions.
- [x] 103.3 Close Phase 82 and Phase 84-88 guard boxes by pointing to the later receiver descriptor, layer/region adapter, and compact fact-bridge phases.
- [x] 103.4 Confirm `tasks.md` has no unchecked boxes while the proof package still reports `OPEN`, 15 supported / 1 open.
- [x] 103.5 Preserve residual honesty: checklist reconciliation does not close `sealedWall.preToneMaskedWrongSideResidualLeakRatio`.


## Phase 104: Cross-Domain Leak Research Synthesis

- [x] 104.1 Re-read current proof artifacts and record the true state: 15 supported / 1 open, with only `sealedWall.preToneMaskedWrongSideResidualLeakRatio = 0.9377` open.
- [x] 104.2 Compare candidate versus baseline: candidate pre-tone masked wrong-side ratio `0.8089` versus baseline `0.8626`, a modest baseline-relative improvement while still far from the zero-leak oracle.
- [x] 104.3 Research DDGI/RTXGI, Flax, Unity APV, precomputed light-field probes, SDFGI, GPU SDF construction, edge-aware interpolation, and finite-volume limiters as adjacent solution families.
- [x] 104.4 Inspect the public sixteenstudio artifact and record that the reachable work is `sixteenstudio/three.js` branch `feat/webgpu-lightprobes-sponza`, not a public standalone `LightProbesGPU` repo.
- [x] 104.5 Classify the sixteenstudio branch as a GPU SH atlas/probe-volume baseline without visibility moments, receiver ownership, invalidity/relocation/dilation, or residual proof gates.
- [x] 104.6 Record the next SDD lane: solve residual leakage as discontinuity-aware interpolation/visibility classification, not threshold tuning, adjacent fallback, or raw resolution increase.


## Phase 105: Residual Boundary Policy SDD and Prune

- [x] 105.1 Remove the old weak-crush/exact-bin no-hit localization subcounts from the live visibility study, proof-gate evidence, and runner assertions.
- [x] 105.2 Keep exact-bin/adjacent-hit evidence only as historical roadmap/ledger context for rejected adjacent fallback and raw resolution paths.
- [x] 105.3 Preserve compact current gate facts: visibility representation policy, aggregate wrong-side escape counts, receiver-scoped shaping, and boundary ownership shaping.
- [x] 105.4 Specify the remaining open gate as residual masked receiver energy after receiver-scoped ownership shaping, not unresolved wrong-side probe escape.
- [x] 105.5 Define the next eligible candidate as a GPU-resident receiver residual boundary policy using authored/setup receiver classification facts through `receiverBoundaryLayerMask` and `receiverBoundaryWeight`.
- [x] 105.6 Require promotion evidence to reduce `sealedWall.preToneMaskedWrongSideResidualLeakRatio` while preserving no-wrong-side escape, directional suppression, receiver-surface agreement, SH-risk, correct bounce, runtime readiness, projection parity, moment readback, residual honesty, and compact proof shape.
- [x] 105.7 Reject broad darkening, correct-bounce suppression, display-space masking, CPU proof readback, scalar/WebGL-as-truth framing, Cornell-only divider coordinates in runtime, and stale rejected-path payloads.
- [x] 105.8 Run touched syntax checks, direct source invariants, `git diff --check`, and focused Cornell WebGPU proof smoke; confirm proof remains `OPEN`, 15 supported / 1 open, with residual `0.9377`.


## Phase 106: Coherent Biased-Query Prototype Rejection

- [x] 106.1 Test the hypothesis that the normal/view-biased sample point should drive probe direction, compatibility kernel, and visibility distance, not only probe-cell selection.
- [x] 106.2 Mirror the candidate in the CPU visibility weighting study and update source invariants for measurement.
- [x] 106.3 Run touched syntax checks, source invariants, `git diff --check`, and focused Cornell WebGPU proof smoke.
- [x] 106.4 Reject the candidate because proof regressed to `OPEN`, 14 supported / 2 open: baseline-relative improvement opened at `-0.0243`, and residual worsened to `1.0243`.
- [x] 106.5 Trim the prototype from runtime, proof mirror, and source invariants; keep the result in roadmap/ledger only.


## Phase 107: Literature-Backed Comparative Roadmap

- [x] 107.1 Push the sixteenstudio comparison branch into the private fork as `gpu/sixteenstudio-lightprobes-sponza`.
- [x] 107.2 Classify sixteenstudio as WGPU SH atlas / node integration control, not leak-control target.
- [x] 107.3 Tie DDGI/RTXGI and Flax to visibility/distance representation decisions.
- [x] 107.4 Tie Unity APV to receiver/probe classification, rendering layer masks, validity, dilation, virtual offset, and adjustment metadata.
- [x] 107.5 Tie light-field probes, SDF/SDFGI, edge-aware filtering, and finite-volume limiters to representation/classification near discontinuities.
- [x] 107.6 Revise the finite plan: compare product/API shape against sixteenstudio, keep current SDD as bounded leak-improvement proof, and prototype only source-backed residual candidates.


## Phase 108: Sixteenstudio Control Diff

- [x] 108.1 Extract atlas layout differences for `examples/jsm/lighting/LightProbeGridGPU.js`.
- [x] 108.2 Extract runtime node interface differences for `src/nodes/lighting/LightProbeGridNode.js`.
- [x] 108.3 Extract demo/product integration differences from `examples/webgpu_lightprobes_sponza.html`.
- [x] 108.4 Record which pieces improve product/API simplicity without changing leak-control math.
- [x] 108.5 Do not merge sixteenstudio runtime into the SDD branch unless a specific deep-module seam is identified.


## Phase 109: Receiver Boundary Source Adapter SDD

- [x] 109.1 Define at least two generic, non-Cornell sources for receiver boundary/class metadata.
- [x] 109.2 Candidate source A: authored geometry or material attribute resolved as GPU node data.
- [x] 109.3 Candidate source B: setup-authored region/layer ownership metadata resolved before runtime upload.
- [x] 109.4 Reject proof pixels, CPU readback, scalar/WebGL comparison, brightness-derived validity, and Cornell divider coordinates in runtime.
- [x] 109.5 Specify compact facts: source type, selected receiver ratio, same-side preservation, cross-side exclusion, residual input ratios, and over-occlusion guards.


## Phase 110: GPU Metadata Layout SDD

- [x] 110.1 Decide whether the next metadata belongs in receiver node inputs, material/geometry attributes, existing probe metadata, or a new compact GPU buffer/texture.
- [x] 110.2 Define memory budget and sampling cost before implementation.
- [x] 110.3 Preserve default behavior when no boundary metadata is supplied.
- [x] 110.4 Keep runtime GPU-resident and diagnostics raw-only.


## Phase 111: Residual Candidate Prototype

- [x] 111.1 Audit prototype eligibility after Phase 109 and Phase 110: do not prototype because the only wired source is equivalent to the existing whole-receiver boundary descriptor path.
- [x] 111.2 Keep classification-before-interpolation as the next-candidate rule; reject irradiance darkening or leak masking.
- [x] 111.3 Preserve the measured residual state: existing boundary descriptor equivalence still leaves `sealedWall.preToneMaskedWrongSideResidualLeakRatio = 0.9377`.
- [x] 111.4 Preserve no-wrong-side escape, directional suppression, receiver-surface agreement, SH-risk, correct bounce, runtime readiness, projection parity, moment readback, and compact proof shape by avoiding a shallow runtime wrapper.


## Phase 112: Promote Or Trim

- [x] 112.1 Keep promotion held because no new candidate drops residual below `0.9377` while all supported gates remain supported.
- [x] 112.2 Reject shallow receiver-boundary wrapper work: it would leave residual flat and add interface surface without new represented state.
- [x] 112.3 Record final verdict in roadmap, design, tasks, and proof ledger.
