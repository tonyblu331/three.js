# LightProbeGridGPU Boring Math SDD

Verified: 2026-06-05.

## Why The Implementation Was Not There Yet

The architecture was pointed in the right direction, but the implementation was
not yet in the mergeable shape because the runtime still had unresolved
production/debug/math coupling.

Concrete gaps:

- `examples/jsm/lighting/LightProbeGridGPU.js` still keeps debug neighbor arrays
  inside `_createManualIrradianceDebugNode(...)`.
- `visibilityDepthWeighting` still exists as a final scalar-vs-visible irradiance
  blend in the manual path.
- `band1Intensity` and `band2Intensity` still exist as debug/proof controls
  and need API demotion before upstream shape.
- `receiverBoundaryMode: 'blend'` is still part of receiver sampling options.
- GPU receiver proof is still a document/spec item, not an implemented proof
  pass.

The compatible ellipsoid kernel was already removed from production guarded
sampling in the first implementation slice. That was one real step forward, but
not the whole merge-grade cleanup.

## Math Guardrails

The math references are guardrails, not implementation targets. The goal is not
to import new methods. The goal is to make the current estimator smaller, more
stable, and easier to prove.

Sources:

- Shepard interpolation: Donald Shepard, "A two-dimensional interpolation
  function for irregularly-spaced data", ACM 1968,
  https://doi.org/10.1145/800186.810616
- Nadaraya-Watson normalized kernel estimator:
  Nadaraya 1964 / Watson 1964 summary,
  https://en.wikipedia.org/wiki/Kernel_regression
- Moving least squares:
  David Levin, "The Approximation Power of Moving Least-Squares",
  https://www.cs.jhu.edu/~misha/Fall05/Papers/levin98.pdf
- Partition of unity:
  Babuska and Melenk, "The Partition of Unity Method",
  https://ivo100.oden.utexas.edu/assets/papers/ijnme97.pdf
- Compactly supported radial basis functions:
  Buhmann, "Radial basis functions",
  https://pages.mtu.edu/~struther/Courses/OLD/5630/Refs/RBFs/RBF_Survey_2000_buhmann-actanumerica.pdf
- Cantelli / one-sided Chebyshev family:
  "Probability inequalities of the Tchebycheff type",
  https://nvlpubs.nist.gov/nistpubs/jres/65b/jresv65bn3p211_a1b.pdf

Use these only for principles:

```text
normalized weighted averages are boring and reviewable;
partition-of-unity support should stay explicit;
compact support beats infinite-tail heuristics in a shader;
small per-pixel solves are not v1 material code;
moment bounds should stay one raw visibility term, not a tuning panel.
```

## Problem To Solve

We need one shader estimator that:

- keeps fast mode as hardware trilinear SH atlas sampling;
- keeps guarded mode cheap enough for Three.js;
- rejects incompatible support before SH normalization;
- does not boost one remaining probe back to full brightness;
- avoids user-facing math knobs;
- is easy to prove with a GPU receiver pass.

The current guarded path should be reduced to this mathematical object:

```text
Given receiver x, normal n, and 8 neighboring probes:

C_i = packed SH coefficient payload
T_i = trilinear cell weight
Vd_i = probe validity
Cf_i = probe confidence
L_i = layer/topology compatibility
N_i = normal support weight
M_i = raw moment visibility

base_i = T_i * Vd_i * Cf_i * L_i * N_i
visible_i = base_i * M_i

C_hat = sum_i( visible_i * C_i ) / max( sum_i( visible_i ), eps )

Mass = saturate(
  sum_i( visible_i ) / max( sum_i( base_i ), eps )
)

E = max( EvalSH9( C_hat, n ), 0 ) * Mass
```

This is a normalized local estimator with a partition-of-unity input
(`T_i`) and admissibility masks layered before normalization.

## Before / After Math

Before:

```text
scalarSamples = sum_i( base_i * C_i )
visibleSamples = sum_i( base_i * M_i * C_i )

scalarIrradiance = EvalSH9( scalarSamples / baseSum, n )
visibleIrradiance = EvalSH9( visibleSamples / visibleSum, n ) * Mass

E = mix( scalarIrradiance, visibleIrradiance, visibilityDepthWeighting )
```

Problem:

```text
the final mix keeps a back door from rejected support to final energy.
```

After:

```text
visibleSamples = sum_i( base_i * M_i * C_i )
visibleSum = sum_i( base_i * M_i )
baseSum = sum_i( base_i )

E = EvalSH9( visibleSamples / visibleSum, n )
  * saturate( visibleSum / baseSum )
```

This is the boring math we want.

## Production Equation

Equation:

```text
A_i = Vd_i * Cf_i * L_i * N_i
base_i = T_i * A_i
visible_i = base_i * M_i

C_hat = weightedSH / visibleSum
Mass = visibleSum / baseSum
E = EvalSH9( C_hat, n ) * Mass
```

Production shader shape:

```wgsl
var sh0..sh6: vec4f = 0;
var visibleSum: f32 = 0;
var baseSum: f32 = 0;

for i in 0..7 {
  let tri = trilinearWeight(i);
  let meta = loadMeta(i);
  let layer = compatible(meta.layerMask, receiverLayerMask);
  let normalW = normalSupport(n, probePos[i] - x);
  let base = tri * meta.validity * meta.confidence * layer * normalW;

  let moment = loadMoment(i, x - probePos[i]);
  let vis = momentVisibilityRaw(distance(x, probePos[i]), moment);
  let w = base * vis;

  sh0..sh6 += loadPackedSH(i) * w;
  visibleSum += w;
  baseSum += base;
}

let invVisible = 1.0 / max(visibleSum, EPSILON);
let mass = saturate(visibleSum / max(baseSum, EPSILON));
let irradiance = max(evalSH(sh0..sh6 * invVisible, n), vec3f(0.0)) * mass;
```

What it deletes:

- scalar coefficient accumulator from production;
- final `visibilityDepthWeighting` blend;
- compatible kernel;
- public Chebyshev controls;
- production debug neighbor arrays.

Main risk:

- If `M_i` over-rejects, correct bounce can dim. The answer is not a final blend
  back to scalar. The answer is better moment confidence and GPU receiver proof.

## Rejected Temptations

These are not implementation approaches for this SDD. They are traps to avoid.

### Rejected: Scalar Fallback Blend

Do not keep:

```text
E = mix( scalarIrradiance, visibleIrradiance, visibilityDepthWeighting )
```

Why:

```text
it lets through-wall support survive after the guarded estimator already rejected it.
```

If low visibility mass causes blackouts, fix the reason:

- moment confidence;
- validity classification;
- probe placement;
- proof fixtures.

Do not blend rejected scalar energy back into production.

### Rejected: Local Linear / MLS Runtime Solve

Do not add:

```text
C_i approx a0 + G * (p_i - x)
```

Why:

- it solves smooth interpolation bias, not the current support-identity problem;
- it adds per-pixel solve complexity;
- it can introduce negative coefficients/weights;
- it is much harder for Three.js maintainers to review.

MLS can remain a future proof or bake diagnostic, but not runtime shader math.

### Rejected: New Kernel Menu

Do not add Wendland/Gaussian/Shepard/IDW switches.

Why:

```text
the v1 support is already the 8-probe cell. The problem is admissibility inside
that support, not choosing a new distance falloff.
```

## SDD Spec

Public/runtime contract:

- `quality: 'fast'` uses atlas trilinear SH sampling.
- `quality: 'guarded'` uses manual 8-probe sampling.
- Guarded production math is exactly:

```text
base_i = tri_i * validity_i * confidence_i * layer_i * normal_i
visible_i = base_i * moment_i
mass = visibleSum / baseSum
E = EvalSH9( weightedSH / visibleSum, n ) * mass
```

- `visibilityDepthWeighting` is not production math.
- `band1Intensity` and `band2Intensity` are not production math.
- Debug attribution may compute scalar and neighbor facts, but only in a debug
  builder.
- GPU receiver proof is evidence, not runtime behavior.

## Implementation Plan

Do the code in this order:

1. Extract production guarded builder from `_createManualIrradianceDebugNode`.
2. Production builder keeps only:
   - packed SH weighted sum;
   - `visibleSum`;
   - `baseSum`;
   - `visibilityMass`;
   - one SH evaluation.
3. Move `scalarSamples`, `scalarIrradiance`, neighbor debug arrays, and debug
   return modes into a debug-only builder.
4. Remove final `visibilityDepthWeighting` blend from production guarded output.
5. Move `band1Intensity` and `band2Intensity` out of production SH evaluation,
   or freeze them to `1` in production and keep uniforms only for debug.
6. Keep source invariants for:
   - no `scalarSamples` in production guarded builder;
   - no `debugProbe` arrays in production guarded builder;
   - no `visibilityDepthWeighting` in production guarded builder;
   - no compatible kernel;
   - `visibleSum / baseSum` mass exists.
7. Only after that, add GPU receiver proof.

## Implementation SDD Gates

This is the promotion plan for moving the code from current branch shape to a
mergeable implementation. Each gate must land as a focused change. Do not merge
two gates just because the files are nearby.

### Gate A: Freeze Production SH Evaluation

Goal:

```text
production SH evaluation uses the baked coefficients as-is.
band damping exists only in debug/proof code.
```

Problem this gate addresses:

```text
_evaluateCoefficients() still multiplies band 1 and band 2 by runtime uniforms,
so production output can be changed by public-ish SH surgery.
```

Status:

```text
implemented in production fast/guarded paths; keep the gate as the acceptance
contract while the debug/proof controls remain available.
```

Required changes:

- Add a production SH evaluator that uses fixed band multipliers of `1`.
- Keep the current band-uniform evaluator only for debug/proof attribution.
- Route `_createAtlasIrradianceNode()` and `_createGuardedIrradianceNode()`
  through the production evaluator.
- Route `_createManualIrradianceDebugNode()` through the debug evaluator.
- Update `getSamplingInfo()` so band controls are reported as debug/proof
  controls, not production math.

Acceptance:

- Production atlas path does not reference `band1Intensity` or `band2Intensity`.
- Production guarded path does not reference `band1Intensity` or
  `band2Intensity`.
- Debug attribution can still vary bands for existing proof reports.
- Source invariant covers the split.

Verification:

```text
node --check examples/jsm/lighting/LightProbeGridGPU.js
npx eslint examples/jsm/lighting/LightProbeGridGPU.js test/e2e/lightprobegrid-gpu-source-invariants.js
node test/e2e/lightprobegrid-gpu-source-invariants.js
git diff --check
```

### Gate B: Name Validity Policy

Goal:

```text
runtime soft validity and proof strict validity are separate, explicit policies.
```

Current problem:

```text
production and debug paths use max(meta.x, PROBE_VALIDITY_FLOOR), so invalid
probes cannot prove zero contribution.
```

Status:

```text
implemented as a named split: production guarded sampling uses runtime-soft
validity, while debug/proof sampling can request proof-strict validity.
```

Required changes:

- Keep runtime guarded sampling soft by default:

```text
runtimeSoftValidity = max(meta.x, PROBE_VALIDITY_FLOOR)
```

- Add proof/debug strict validity:

```text
proofStrictValidity = meta.x
```

- Add a small option or internal debug flag only on the debug/proof builder.
- Expose sampling info that names the active validity policy.
- Add source invariant that production uses runtime-soft and proof/debug can use
  strict validity.

Acceptance:

- Runtime behavior stays conservative.
- Proof/debug can measure `validity = 0` as zero contribution.
- No public product API exposes a validity tuning knob.

### Gate C: Demote Boundary Blend

Status: implemented. Production guarded sampling now forces select-only boundary
compatibility while debug/proof sampling can still request blend.

Goal:

```text
production layer compatibility is binary/select for v1.
boundary blend remains debug/proof or authoring-only.
```

Current problem:

```text
receiverBoundaryMode: 'blend' can still flow into material sampling options.
```

Required changes:

- Production `createIrradianceNode()` coerces receiver boundary mode to
  `'select'`.
- `_createManualIrradianceDebugNode()` may keep `'blend'` for attribution.
- Keep harness assertions that inspect blend facts pointed at debug/proof paths.
- Update docs to say boundary blending is not v1 production math.

Acceptance:

- Production guarded builder cannot use blend compatibility.
- Debug/proof still reports old blend studies.
- Source invariant proves production uses select-only compatibility.

### Gate D: Visibility Facts And Labels

Status: implemented. Runtime visibility facts now carry active state,
resolution, texture presence, and bytes; proof labels demote
`visibility-moments` when active moment-backed guarded sampling is false.

Goal:

```text
reports describe actual runtime state, not requested intent.
```

Current problem:

```text
visibility labels can be confused if they come from flags instead of allocation,
moment mode, byte count, and guarded runtime use.
```

Required changes:

- Expand `getVisibilityDepthInfo()` with:
  - `available`;
  - `active`;
  - `mode`;
  - `resolution`;
  - `texturePresent`;
  - `bytes`;
  - compact moment stats when proof readback exists.
- Gate labels on `active === true`, not `enableVisibility`.
- Keep `visibilityRequested`, `visibilityMomentBacked`, and
  `visibilityRuntimeActive` in sampling info.

Acceptance:

- No report can say `visibility-moments` unless active moment-backed guarded
  sampling is true.
- Fast mode cannot report active visibility.
- Guarded mode without baked moment texture cannot report active visibility.

### Gate E: GPU Receiver Proof Scaffold

Status: scaffold contract implemented. `test/e2e` now contains the receiver
and receiver-result contract plus required summary fields; actual GPU
evaluation remains the next Gate E implementation task.

Goal:

```text
prove the same estimator the material uses.
```

Required changes:

- Add proof receiver structs/buffers in `test/e2e`, not production runtime.
- Evaluate fast and guarded indirect for controlled receiver samples.
- Emit:
  - fast indirect;
  - guarded indirect;
  - visibility mass;
  - leak score;
  - correct-bounce score;
  - invalid contribution;
  - layer-rejected contribution;
  - moment-vs-scalar delta.
- Keep CPU readback as I/O, not truth.

Acceptance:

- Proof receiver uses the production guarded estimator or a shared proof
  equivalent with source invariants.
- Leak/correct-bounce claims must reference receiver facts.
- Sponza remains scale/runtime pressure, not sealed-wall proof.

### Gate F: Upstream Shape

Goal:

```text
make the feature reviewable by Three.js maintainers.
```

Required changes:

- Move debug/proof helpers out of the production module where practical.
- Keep public API to `quality`, `visibility`, bias, resolution, cubemap size,
  and optional layer metadata.
- Keep research docs in `test/e2e` or debug docs.
- Write proposal notes around small API, private moments, metadata, and proof.

Acceptance:

- Production core is explainable in one short formula.
- Debug/proof code is visibly separate.
- No public research knobs remain in the product surface.

## Acceptance

- Production guarded shader has no `scalarSamples`.
- Production guarded shader has no `debugProbe*` arrays.
- Production guarded shader has no `visibilityDepthWeighting`.
- Production guarded shader has no compatible kernel.
- Production guarded shader uses:

```text
visible_i = tri_i * validity_i * confidence_i * layer_i * normal_i * moment_i
mass = visibleSum / baseSum
```

- Debug attribution can still compute scalar/neighbor facts in a separate debug
  builder.
- GPU receiver proof is still required before claiming leak/correct-bounce
  closure.
