# LightProbeGridGPU refactor roadmap

Verified: 2026-06-02 on branch `dev`.

## Goal

Harden the LightProbeGridGPU diagnostics/harness stack by deleting prototype payload bloat, consolidating repeated behavior, and keeping runtime code GPU-resident. This is not a file-moving project: a slice only counts when it removes duplication, removes unconsumed payload, or makes ownership clearer with fewer concepts.

## North star

LightProbeGridGPU should be a deep runtime module with a small GPU-resident interface. Harnesses and diagnostics should emit compact raw facts only. Proof gates own thresholds, verdicts, and promotion decisions. If a field is not consumed by a gate, artifact contract, or public example, delete it instead of moving it.

## Working prompt

Continue the LightProbeGridGPU refactor from the current worktree as authoritative. Find the next smallest slice that improves ownership shape, compactness, or leak evidence. Keep runtime free of CPU readback/proof helpers. Keep diagnostics/evals as raw facts, keep verdicts in proof gates, update this roadmap with every material finding, and verify with focused no-build checks only.

## Latest eval findings

- 2026-06-02 focused smoke now passes after two correctness fixes: the atlas verifier imported the missing TSL `floor()` used by its synthetic coefficient writer, and `CubeTextureNode` now treats `builder.object?.isComputeNode` as compute context so explicit cubemap sampling does not pull `materialEnvRotation` from a null render scene/material. Because examples load `build/three.webgpu.js`, the same CubeTextureNode guard was mirrored there without running build.
- Latest Cornell smoke before the current gate cleanup: `TEST PASSED`, 33 checks. Proof summary was `OPEN` with 13 supported / 3 open gates: receiver-surface CPU/render delta `0.6014 > 0.15`, tone-mapped wrong-side improvement `-0.0025 < 0.05`, and masked wrong-side improvement `0.0004 < 0.05`.
- Visibility-weighting diagnostics now compare moment suppression against base visibility weights, not pre-kernel scalar weights, and use the same un-biased receiver position as runtime guarded visibility. This moved directional suppression from open to supported without changing proof thresholds.
- Latest leak promotion metric is still thin: pre-tone masked wrong-side improvement is `0.058` against the `>= 0.05` gate, with correct-bounce preservation healthy at `0.9974` and pre-tone masked correct-bounce preservation `1.0616`.
- Leak evidence artifacts now write compact `leak-proof-facts.json` next to `proof-summary.json`, so the raw sealed-wall baseline row and visibility-moment candidate row can be compared directly without inflating proof-gate summaries.
- Receiver-surface agreement was tightened after audit: diagnostics now emit raw surface render wrong-ratio plus CPU surface runtime wrong-ratio max, while the proof gate derives `surfaceCpuRenderDelta` with max-to-max aggregation. Masked render ratios stay in leak-proof rows, not in the receiver-surface gate's evidence path.
- Sealed-wall promotion gates now block only on the linear pre-tone masked leak metric plus correct-bounce preservation. Tone-mapped wrong-side improvements remain derivable from raw rows but no longer block proof promotion.
- Core runner projection-oracle assertions now use named local predicates for parity contract, compute candidate, adapter fallback, and atlas repack raw facts; source invariants guard those predicate seams instead of brittle inline assertion blobs.
- Visibility runner assertions now use named local predicates for moment readback facts, visibility-weighting facts, escape classification, SH contribution, receiver-surface agreement, and receiver-normal facts.
- Matrix runner assertions now use named local predicates for compact probe occupancy, sealed-wall leak-proof fixture facts, leak-proof row facts, and restoration facts.
- Runtime runner assertions now use named local predicates for bake coalescing, benchmark backend/memory/visibility-depth/timing facts, and compact color-sanity facts.
- Core runner runtime parity and projection profiling assertions now use named local predicates for raw parity facts, support facts, profiling selector facts, and compact timing facts.
- Proof-summary validation now uses named predicates for bounded gate count, unique/required gate ids, compact gate shape, required supported gates, and summary byte budget.
- Proof-validation density row checks now use named predicates for WebGPU/WebGL density reference, shadowless, crisp-shadow row facts, crisp-shadow reference comparison facts, damped quality-candidate fixture facts, and damped math-action facts; this also fixed a missing-comma assertion bug in the density damped row check and removed the lazy `snapshot, snapshot` crisp-shadow self-comparison.
- Proof-validation low-res comparison checks now use named predicates for shared probe intensity, band isolation, bounce preservation, and damped-vs-full-band red-bias/dark-tail comparison.
- Compact payload assertions now cover visibility-depth facts, visibility moment evidence, color sanity, artifact center signatures, projection fixture/fallback counts, and `getMetrics()` timing facts.
- Source invariants now guard against reintroducing raw RGB regions, timing sample/range payloads, profiling backend verdict/fallback arrays, runtime-parity phase timing/path label dumps, leak-proof restore metric dumps, nested leak-proof metric snapshots, sealed-wall derived gate metric payloads, sealed-wall row visibility-depth duplication, visibility-weighting diagnostic visibility-depth duplication, sealed-wall promotion metric mode echoes, leak-region center/surface-correct/masked-mode payloads, leak-proof top-level metric-mode prose, receiver-normal sample arrays/distance payloads/fallback reasons, visibility-weighting escape rows, internal escape-probe arrays, duplicate escape-summary reducers, duplicate receiver row totals/escape filter reducers, unused hit-confidence threshold/policy branches, visibility-weighting aggregate predicate/reader adapters, stale proof-era unavailable-mode labels, receiver quadrature-weight echoes, receiver-surface `runtimeWrongOverCorrect` naming, receiver-surface mutable sample counting, duplicate proof-gate runtime/projection/moment-readback/receiver-normal/directional-suppression/receiver-surface/SH-risk/sealed-wall predicates, proof-gate runtime identity echoes, visibility-weighting diagnostic-scope/label echoes and directional-suppression verdict echoes, color-bias objects/channel/value echoes, placeholder GPU-debug unavailable payloads, receiver quadrature sample descriptor metadata, receiver-surface render-agreement object wrappers, and duplicate receiver-surface fixture/rule echoes, visibility-weighting/receiver-surface/SH contribution nested summaries, SH contribution receiver-diagnostics wrapper reductions, SH math THREE parity support verdict echoes, artifact snapshot proof-role echoes, artifact snapshot derived bake-texel budget echoes, duplicate proof-validation density budget checks, repeated proof-validation absence predicates, repeated proof-validation artifact-pressure fact predicates, repeated proof-validation region fact checks, repeated proof-validation crisp direct-shadow control predicates, duplicate grounding-parity base setup and band-2 setup echoes, artifact snapshot anti-ringing policy/prose/path echoes, default direct-shadow-control snapshot echoes, direct-shadow-control mode echoes, default bake-shadow-disabled flag echoes, artifact probe-helper intensity echoes, artifact runtime/debug metric echoes, per-probe occupancy metadata, visibility-depth runtime metadata, divider-audit reason payloads, projection/atlas promotion/source/policy prose, projection parity marker-allowance/path-introduced echoes, projection parity promotion-evidence payloads, atlas-repack adapter-fallback policy echoes, duplicated projection fallback scenarios, SH math prose/sample/axis verdict payloads, atlas packing layout/readback arrays, runtime parity pass booleans/sample arrays, and old moment texture/sample details.
- The current evidence still points to payload leakage as the main refactor opportunity, not a runtime GPU residency leak.

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
| `examples/jsm/lighting/LightProbeGridGPU.js` | 1649 | Runtime facade | GPU-resident; no CPU readback matches; `getVisibilityDepthInfo()` now exposes compact availability/mode/byte facts only. |
| `examples/jsm/lighting/LightProbeGridGPUTestHarness.js` | 2584 | Browser proof/smoke harness | Main remaining monolith. Recent slices removed setter, fixture, rejection, profiling sample/range payload, runtime-parity phase timing/static-work/path-label dumps, leak-proof row/nested metric snapshot, leak-proof derived sealed-wall gate metrics, leak-proof row visibility-depth duplication, leak-proof promotion and restore metric dump, sealed-wall promotion metric mode echoes, leak-region center/surface-correct/masked-mode payloads, leak-proof top-level metric-mode prose, visibility-moment range/profile/runtime-info payload, compacted exported visibility-depth, timing, color-sanity, probe-occupancy, SH math, atlas packing, and runtime parity facts, runtime-smoke, profiler/runtime-parity/projection-oracle/artifact-pressure verdict payload, projection/atlas promotion/source/policy prose and unconsumed contract fields, projection parity marker-allowance/path-introduced/path-label echoes, projection parity promotion-evidence payloads, atlas-repack adapter-fallback policy echoes, duplicate projection fallback scenarios, projection adapter internal scenario labels/path echoes, projection adapter local decision verdicts, profiling backend mismatch verdict counts, profiling requested-backend selector echoes, profiling fallback reason counts, artifact snapshot prose/unused center RGB/chroma fields, artifact snapshot proof-role echoes, artifact snapshot derived bake-texel budget echoes, duplicate grounding-parity base setup and band-2 setup echoes, artifact anti-ringing policy/prose/path echoes, default direct-shadow-control snapshot echoes, direct-shadow-control mode echoes, default bake-shadow-disabled flag echoes, artifact probe-helper intensity echo, artifact runtime/debug metric echoes, projection fallback prose, receiver-normal verdict duplication, receiver-normal sample arrays/distance payloads/fallback reasons, and SH math THREE parity support verdict echoes. |
| `examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js` | 589 | CPU/proof visibility weighting study | Trimmed unconsumed row variance/hit-confidence summaries, unused hit-confidence threshold/policy branches, aggregate predicate/reader adapters, receiver quadrature-weight echoes, unused contribution ratios, duplicate escape-count families/reducers, duplicate receiver row totals/escape filter reducers, directional-suppression verdict/scope/receiver-label/policy-label payload, color-bias object/channel/value echoes, public per-probe/per-receiver receiver row dumps, runner-only contribution/visibilityMass summary fields, SH chroma-pressure helpers, exported visibility-depth runtime metadata, visibility-depth diagnostic duplication, stale proof-era unavailable-mode labels, placeholder GPU-debug unavailable payloads, aggregate escape row/reason payloads, internal escaped-probe arrays, internal divider-audit payload objects, and the `directionalSuppressionSupported` verdict echo; receiver probe and escape counters are now accumulated during receiver row analysis through `probeFacts`, public `receiverProbeFacts` remains compact, `escapeClassification` is derived from the same aggregate, and proof gates derive support from raw comparable receiver count plus wrong-minus-correct suppression. |
| `examples/jsm/lighting/LightProbeGridGPUShDiagnostics.js` | 90 | SH pressure diagnostics | SH mixed-color risk now emits proof-gate-consumed flat wrong-ratio and mixed-color row facts only; receiver contribution rows/aggregate snapshots stay internal, and the two-receiver aggregation no longer builds a receiverDiagnostics wrapper array. |
| `examples/jsm/lighting/LightProbeGridGPUReceiverDiagnostics.js` | 91 | Receiver/surface diagnostics | Surface CPU/render diagnostics now emit only proof-gate-consumed sample count, raw surface render wrong-ratio, and raw CPU surface runtime wrong-ratio max; masked render ratios and derived deltas stay out of the diagnostic, and nested summary, duplicate fixture/rule/receiver-label echoes, placeholder GPU-debug objects, exported quadrature helper, sample descriptor metadata, render-agreement object wrappers, mutable sample counting, old wrong-over-correct naming, and unused hit-confidence policy threading are gone. |
| `examples/jsm/lighting/LightProbeGridGPUExampleGUI.js` | 161 | Example controls | Stable. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProofReadback.js` | 285 | Proof-only readback adapter | Correct boundary: diagnostics may import, runtime must not. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js` | 60 | Shared constants | Intentionally small. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js` | 159 | Atlas/probe addressing and repack | Cohesive. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUCpuShMath.js` | 263 | Proof-only CPU SH math | Correct boundary. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProjection.js` | 242 | Projection material/node builders | Cohesive runtime helper. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js` | 135 | Visibility material/load helpers | Cohesive runtime helper. |
| `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUBake.js` | 132 | Bake state/result helpers | Cohesive runtime helper. |
| `test/e2e/lightprobegrid-gpu-artifacts.js` | 181 | Compact artifact contract | Healthy after earlier report deletion; proof summary and leak-proof baseline/candidate raw facts are written as compact single-line JSON, and the WebGL reference artifact keeps raw fields without prose boundary payload. |
| `test/e2e/lightprobegrid-gpu-image-metrics.js` | 174 | Screenshot artifact metrics | Artifact pressure now emits raw ratios/floors only. |
| `test/e2e/lightprobegrid-gpu-proof-validation.js` | 372 | Artifact proof assertions | Owns artifact pressure fact validation/thresholds, label-to-role interpretation, density budget checks, unweighted/hardware-filtered sampling checks, same-density-fixture checks, density reference/shadowless/crisp-shadow row/crisp-shadow comparison/damped fixture and damped math-action row checks, low-res shared-intensity/band-isolation/bounce/damped-comparison checks, derived bake-texel budget math, anti-ringing path/band checks, proof-role absence, anti-ringing policy absence, default direct-shadow-control absence, direct-shadow-control mode absence, default bake-shadow-disabled flag absence, probe-helper intensity absence, compact region fact checks, and runtime/debug metric absence through local helpers instead of trusting payload status or prose/path echoes; asserts compact artifact center/timing signatures, fixes the density damped row assertion comma bug, and avoids crisp-shadow self-comparison. |
| `test/e2e/lightprobegrid-gpu-proof-gates.js` | 486 | Proof gate derivation/assertions | Visibility moment, projection parity, directional suppression, and sealed-wall thresholds are data-driven; receiver-normal, visibility-weighting, receiver-surface, SH contribution, runtime parity, and sealed-wall improvement/preservation derivation now live here instead of the harness/study/diagnostic modules; runtime, projection, moment-readback, receiver-normal, directional-suppression, receiver-surface, SH-risk, sealed-wall, and proof-summary validation reuse named predicates, projection runtime parity, receiver-normal agreement, and receiver-surface CPU/render delta are derived from raw fact counts/ratios inside proof gates, sealed-wall proof facts now keep raw baseline/candidate leak rows while gate evaluation derives only blocking pre-tone leak improvement plus bounce-preservation metrics, tone-mapped sealed-wall wrong-side improvements are no longer derived as promotion math, proof-summary support/open counts are accumulated in one pass, visibility moment, directional suppression, receiver-surface, SH mixed-color risk, runtime readiness/texture/bounds, projection delta, receiver-normal availability/agreement, no-SH-risk, sealed-wall threshold pass states, bounded gate count, unique/required gate ids, compact gate shape, required supported gates, and summary byte budget are predicate-owned, supported gates omit remediation prose/evidence refs and actual/expected values from the compact proof summary, unused visibility/DDGI status payloads are gone, and unused runtime identity echo is gone. |
| `test/e2e/lightprobegrid-gpu-runner-*.js` | 806 | Smoke assertion runners | Mostly reasonable; core/matrix/visibility/runtime assertions now target compact raw contracts instead of local verdict payloads, projection/atlas promotion prose and unconsumed contract fields, projection parity marker-allowance/path-introduced echoes, projection parity promotion-evidence payloads, atlas-repack adapter-fallback policy echoes, SH math prose/sample/axis verdict payloads, SH math THREE parity support verdict echoes, atlas packing layout/readback arrays, runtime parity pass booleans/sample arrays/phase timing dumps/static-work echoes, profiling backend verdict/fallback arrays, profiling backend mismatch verdict counts, profiling fallback reason counts, leak-proof restore metric dumps, nested leak-proof metric snapshots, sealed-wall derived gate metric payloads, sealed-wall row visibility-depth duplication, visibility-weighting diagnostic visibility-depth duplication, leak-region center/surface-correct/masked-mode payloads, leak-proof top-level metric-mode prose, receiver-normal sample arrays/distance payloads/fallback reasons, visibility-weighting escape/per-receiver rows, visibility-weighting/receiver-surface/SH contribution nested summaries, placeholder GPU-debug unavailable payloads, per-probe occupancy metadata, projection fixture/fallback arrays, raw color regions, raw rows, timing sample/range payloads, visibility-depth runtime metadata, receiver-surface diagnostic-owned deltas, or directional-suppression verdict echoes; core projection/atlas/runtime-parity/profiling plus matrix/runtime/visibility absence assertions now share local field-absence helpers instead of repeating selector/verdict field checks inline, and core projection-oracle/parity/profiling, matrix leak-proof, runtime benchmark/color-sanity, and visibility raw-fact checks use named local predicates. |

Tracked LightProbeGridGPU feature/proof set: about 8,429 lines, excluding this plan and source-invariant guard file.

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
- Compute projection profiling keeps warmup execution but no longer returns warmup, per-run sample arrays, min/average/p95/max timing ranges, nested backend arrays, backend-selection verdict booleans, backend mismatch verdict counts, requested-backend selector echoes, fallback reason arrays/counts, deterministic timer flags, diagnostic status/policy text, claim text, or median speedup summaries; it keeps raw fallback-run counts instead.
- Compute projection runtime parity now returns raw tolerance, coefficient, atlas-count, backend, and fallback facts; proof gates and runner assertions derive parity verdicts, and local pass booleans, atlas sample arrays, static-work echoes, path-label echoes, and phase timing dumps are gone.
- Projection parity candidate/fallback/atlas-repack oracles now return raw path, threshold, capability, count, and delta facts without proof-only status, per-fixture arrays, per-fixture sweep echoes, fallback scenario arrays, internal adapter scenario labels/path echoes, local adapter decision verdicts, or prose reason strings.
- Projection parity runtime and oracle contracts now keep only raw sweep/fallback/tolerance/count/delta facts plus the single contract path family; old `runtimeMarkersAllowed`, `runtimePathIntroduced`, and duplicate candidate/adapter path-label echoes are gone, and source invariants prove guarded runtime markers directly from runtime implementation evidence instead of trusting harness allowance fields.
- Atlas repack oracle no longer echoes `adapterFallbackEvidenceRequired`; adapter fallback evidence is owned by the adapter fallback oracle, while atlas repack keeps only tolerance and max-readback-delta facts.
- Projection and atlas diagnostics no longer return unconsumed promotion-effect, candidate-planning/public-API policy flags, required-capability, required-gate prose, required parity source lists, checked-layer, coefficient-write count, required-flag, fixture-list, or open-evidence narrative payloads.
- Projection adapter fallback diagnostics now keep one supported runtime scenario plus the two fallback capability scenarios; the duplicated promoted-supported candidate row was deleted.
- Artifact pressure metrics now return raw black-tail/luminance/contrast facts; proof validation owns pressure/bounded thresholds.
- Artifact snapshot rows now keep structured role/policy facts without prose `referenceBoundary` or `action` payload.
- Grounding parity artifact snapshots no longer echo `proofRole`; proof validation owns label-to-role interpretation for those rows.
- Grounding parity artifact snapshots no longer echo derived bake-texel budgets; proof validation derives cubemap work from resolution and cubemap size.
- Grounding parity snapshot setup now centralizes the shared band-2 intensity instead of repeating the same constant in every frozen row.
- Grounding parity snapshot setup now has shared low-resolution and density base rows so per-case entries only show the values that actually vary.
- Proof validation now uses one local density-budget helper for repeated WebGPU/WebGL-like 6^3 / 32px checks.
- Proof validation now uses one local absence helper for compact metric, timing, and artifact-signature payload checks.
- Proof validation now uses one local artifact-pressure fact helper for both grounding parity snapshots and WebGL reference artifacts.
- Proof validation now uses one local region fact helper for both grounding parity snapshots and WebGL reference artifacts; grounding snapshots opt into black-tail/cell-edge checks while the WebGL reference keeps the smaller shared region contract.
- Proof validation now uses one local crisp direct-shadow control helper for both per-row artifact validation and cross-row density comparison.
- Core smoke assertions now use the local field-absence helper for projection contract/oracle, SH math, atlas packing, runtime parity, and profiling timing compactness checks instead of repeating long `field === undefined` chains.
- Matrix and runtime smoke assertions now use local field-absence helpers for probe occupancy, leak-proof row/restoration, benchmark visibility/timing, and color-sanity compactness checks.
- Artifact snapshot anti-ringing policy echoes were removed entirely; proof validation now derives stress/control/quality meaning from labels, SH band intensities, and sampling facts instead of persisted policy/path prose.
- Artifact snapshot direct-shadow control now emits only custom shadow override values; default direct-shadow-map settings and custom-mode prose stay implicit, and proof validation asserts their absence.
- Artifact snapshots now emit `shadowsDisabledDuringBake` only for the shadowless proof row; default bake-shadow-enabled state stays implicit and proof validation asserts its absence for the crisp-shadow control row.
- Artifact snapshots no longer echo probe-helper intensity; proof validation asserts that helper-only visualization intensity stays out of proof artifacts.
- Artifact snapshot metrics now use a compact snapshot-specific metric shape; runtime/debug facts such as memory, visibility-depth, identity, texture, bounds, and probe-helper state stay out of artifact rows.
- Artifact center signatures now expose only the consumed luminance fact; unused RGB/chroma fields were deleted.
- Leak-proof rows now share top-level proof settings, sampling, and metric modes instead of repeating frozen fixture controls or nested metric snapshots per row; restoration evidence now returns only lighting mode, leak-reduction mode, and fixture visibility instead of a full `getMetrics()` dump.
- Probe occupancy diagnostics now return counts and a mesh-hit count only; per-probe indices, positions, and mesh lists remain local to the example's validity upload path.
- Visibility weighting summaries no longer carry unused variance, hit-confidence, min/max visibility-mass, mirrored correct-side contribution ratios, or runner-only base/visible/visibilityMass contribution means.
- Visibility aggregate evaluation now owns the single SH readback path directly; dead predicate and coefficient-reader adapters were deleted because the only callers aggregate all rows with the default probe coefficient reader.
- Visibility weighting diagnostics now expose aggregate receiver probe counters instead of public per-probe weighting rows or per-receiver `left`/`right` payloads; aggregate escape facts stay in `escapeClassification`.
- Visibility-study receiver probe counters are now accumulated in the receiver-analysis pass via `probeFacts`; the old second pass over `receiver.rows` is guarded against by source invariants.
- Visibility-study escape counters now share the same `probeFacts` aggregate; the old per-receiver `escapeSummary` object and combiner are gone without adding escape fields to public `receiverProbeFacts`.
- Proof validation now uses `hasUnweightedSampling()` for repeated density/reference sampling checks instead of re-spelling weighted-sampling raw field comparisons inline.
- Proof validation now uses `hasHardwareFilteredSampling()` where density reference, crisp-shadow, and damped rows must prove both manual sampling is off and weighted sampling is off.
- Proof validation now uses density-specific helpers for the shared WebGPU/WebGL 6^3 / 32px budget and same-fixture checks, so density reference/damped/shadow rows prove fixture equivalence through named predicates instead of repeated inline field chains.
- Proof validation now splits crisp-shadow row facts from crisp-shadow cross-row comparison facts, so the per-row assertion no longer proves itself by comparing the snapshot to itself.
- Compact proof-summary gates now include `actual`/`expected`, remediation `reason`, and `evidenceRef` only for OPEN gates; SUPPORTED gates keep id/subject/metric/status only.
- `proof-summary.json` now writes compact single-line JSON instead of pretty-printing the already compact proof summary.
- Visibility weighting compact visibility-depth fallback now uses the neutral `unavailable` mode instead of the stale proof-era `unavailable-proof-6-runtime-removed` label.
- Visibility divider segment checks now return the consumed boolean intersection fact only; point/distance/reason audit payload objects were deleted.
- Visibility-depth facts exported by metrics, benchmarks, leak rows, and visibility-weighting diagnostics now stay to `available`/`mode`/`bytes`; private readback dimensions stay local to the harness and runtime.
- Runtime `getVisibilityDepthInfo()` now emits only `available`/`mode`/`bytes`; placeholder samples, stats, texture dimensions, moment count, encoding, and channel-label report fields were removed.
- Visibility moment inspection reports compact availability/mode/readback counters only; raw samples, range/profile payload, runtime-info metadata, texture metadata, channel labels, and deferred sweep-plan narrative are gone.
- Visibility-weighting diagnostics no longer duplicate compact visibility-depth facts; moment-readback proof remains owned by the dedicated visibility moment inspection and proof gates.
- Runtime smoke diagnostics now keep benchmark, bake coalescing, and leak-mode comparison payloads to asserted fields only.
- `getMetrics()` timing facts now expose only total bake time and timing source; detailed phase timing stays in benchmark-specific diagnostics.
- Color sanity diagnostics now return wall dominance ratios and center energy instead of raw left/right/center RGB regions.
- Visibility escape classification now keeps only aggregate escape counts, instead of public row/reason payloads, internal escaped-probe arrays, unused hit-confidence threshold escape branches, or duplicated per-receiver count families.
- Visibility escape summary now combines receiver escape facts in one reducer instead of running separate receiver reducers for each count.
- Visibility receiver analysis now derives totals and escape counters in one row pass instead of stacking `wrongSideRows`, `escapedRows`, reason filters, relation-key sum helpers, and separate base/visible sum reducers.
- Receiver-normal diagnostics now return raw availability and receiver/shader-normal count facts; the proof gate derives the front-face/shader agreement verdict, and internal shader-normal capture no longer creates public-style distance/convention payload fields or fallback reason prose.
- Visibility-weighting diagnostics now return flat fixture-mode, wrong-minus-correct suppression, and escape facts without nested summary, duplicate diagnostic-scope payloads, or `directionalSuppressionSupported` verdict echoes; the proof gate owns the directional suppression verdict.
- Receiver-surface diagnostics now return only sample count, raw CPU surface runtime wrong-ratio max, and raw render surface wrong-ratio; parent fixture mode supplies sealed-wall context, the Gauss-Legendre rule stays implicit in code plus runner sample-count assertions, quadrature sample descriptors keep only local position/weight inside receiver diagnostics instead of echoing quadrature weight through analyzed receiver objects, the placeholder GPU-debug unavailable diagnostic was deleted, and the proof gate owns the CPU/render agreement delta and verdict.
- Receiver-surface quadrature now derives `sampleCount` from `sampleDescriptors.length` instead of mutating a loop counter.
- Receiver-surface render agreement now emits raw max-to-max comparison inputs instead of diagnostic-owned candidate deltas.
- Receiver-surface render agreement now compares surface CPU quadrature only with surface render capture; masked render ratios remain leak-proof-row evidence and cannot lower or alter the surface agreement gate.
- Receiver-surface CPU/render agreement now compares render surface wrong-ratio max against CPU surface runtime wrong-ratio max; the old “pick the closer mean-or-max delta” diagnostic path is gone.
- Receiver-surface proof gating now derives `surfaceCpuRenderDelta` once, passes that derived fact into the receiver-surface predicate, and uses the same value as the gate actual; source invariants guard that single-owner derivation path.
- Sealed-wall proof gates no longer treat tone-mapped wrong-side improvement metrics as promotion blockers and no longer derive those unused improvement values; raw baseline/candidate rows still carry the underlying tone-mapped fields, while the blocking improvement gate uses `preToneMaskedWrongSideImprovement`.
- Receiver-surface CPU aggregation now uses the same `runtimeWrongRatio` language as SH contribution diagnostics; the old `runtimeWrongOverCorrect` name was deleted as color-bias report residue.
- SH contribution diagnostics now return only flat proof-gate-consumed mixed-color row count plus visibility/runtime wrong-ratio facts; runner-only scalar, inverted-normal, chroma-pressure, nested summary payloads, receiver contribution row echoes, color-bias objects/channel/value echoes, and aggregate color-bias snapshots were deleted.
- SH contribution two-receiver aggregation now uses direct left/right diagnostic facts instead of a temporary `receiverDiagnostics` wrapper array plus repeated reductions.
- SH math diagnostics now return constant-radiance max delta, directional axis deltas, THREE parity availability, and THREE parity delta only; prose formulas, sample arrays, expected color echoes, support verdict echoes, and local axis verdict booleans were deleted.
- Atlas packing diagnostics now return counts, mismatch counters, orientation probe indices, validity delta, and max readback delta; full coefficient layout, address/readback arrays, expected/actual pixel echoes, formula strings, and oracle path prose were deleted.
- Placeholder GPU-debug diagnostics were deleted after their unsupported/unavailable payload stopped feeding proof gates; runner assertions now guard that the payload stays absent.
- Visibility moment inspection now returns raw availability/mode/readback counters; the proof gate derives moment-backed support from bytes plus finite/hit readback evidence, not leaked texture metadata.
- Runtime, projection delta, visibility moment, receiver-normal, directional-suppression, receiver-surface, SH mixed-color, and sealed-wall proof gates now derive pass states from named predicates instead of duplicating status/readback/agreement/tolerance/risk/threshold conditions inside gate objects.
- Visibility moment readback, directional suppression, receiver-surface agreement, and baked SH mixed-color risk now use named proof-gate predicates instead of inline pass-condition locals.
- Runtime readiness/texture/bounds and projection coefficient/atlas delta gates now also use named proof-gate predicates instead of inline comparisons.
- Receiver-normal availability/agreement and no-baked-SH-risk pass states now also use proof-gate predicates instead of inline boolean composition.
- The unused visibility status wrapper is gone; moment-backed visibility validation now uses `isMomentBackedVisibility()` directly and source invariants guard against reintroducing `visibilityLabel`, `visibilityStatus`, or `ddgiStatus` payloads.
- Sealed-wall threshold pass states now use the proof-gate predicate path instead of inline `actual >= threshold` composition inside the gate loop.
- Projection runtime parity and receiver-normal proof facts now stay raw: proof facts carry backend/delta/count evidence, while proof gates derive runtime parity and normal agreement via named predicates.
- Sealed-wall proof facts now carry raw baseline/candidate leak-row metrics; proof gate evaluation derives wrong-side improvement and correct-bounce preservation metrics locally.
- Compact proof facts no longer carry `isLightProbeGrid`; runtime packaging identity is guarded by source invariants, while proof gates consume only status, texture, and bounds facts.
- Leak proof facts now return raw sealed-wall rows only; proof gates derive sealed-wall improvement/preservation metrics and own support/promotion verdicts, while nested/top-level metric mode prose, row-level visibility-depth duplication, and unconsumed center/surface-correct/masked-mode leak-region payloads stay absent.
- Grounding parity artifacts now persist `leak-proof-facts.json` as compact raw leak evidence: fixture/settings/sampling plus the two sealed-wall rows only, with finite raw leak and bounce metrics validated before writing.

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

- remaining internal rows/summary objects that duplicate top-level facts;
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

Current focused evidence supports the refactor goal:

- runtime remains GPU-resident with no CPU readback matches in `LightProbeGridGPU.js`;
- Cornell WebGPU smoke passes 33 checks after atlas parity and compute cubemap-sampling fixes;
- atlas packing verifier reports `maxReadbackDelta = 0.0005` against the `< 0.008` gate;
- compute projection runtime parity selects `compute-probe-reduction` with `computeFallbackReason = null`, `coefficientMaxDelta = 0`, and `atlasMaxDelta = 0`;
- diagnostics/harness no longer carry the targeted verdict, proofBoundary, status, referenceBoundary, or exploratory prose payloads;
- remaining files keep clear ownership without thin-file over-splitting;
- compact proof gates cover the default smoke proof behavior with a 16-gate budget and derive visibility support from compact readback facts; the remaining known runtime-evidence gap is receiver-surface CPU/render agreement, while tone-mapped sealed-wall leak improvements are no longer promotion blockers;
- source invariants, runner assertions, OpenSpec tasks, and this roadmap match the current code shape.
