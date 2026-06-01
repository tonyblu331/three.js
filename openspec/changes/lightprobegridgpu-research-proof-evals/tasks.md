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
