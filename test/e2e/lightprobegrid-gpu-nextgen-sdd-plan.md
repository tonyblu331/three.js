# LightProbeGridGPU Next-Gen SDD Plan

Verified: 2026-06-05.

## Core Decision

Build `LightProbeGridGPU` as a visibility-aware irradiance volume, not as a
larger collection of leak-fix experiments.

Target shape:

```text
Fast path:
  packed SH atlas
  hardware trilinear
  one SH evaluation

Guarded path:
  8-probe gather
  validity
  layer compatibility
  normal preference
  raw moment visibility
  visibility mass
  one SH evaluation

Proof path:
  GPU-resident receiver evaluation
  scene-linear indirect metrics
  leak/correct-bounce/validity/moment-delta gates
```

This is the next SDD scope after the authored-boundary/placement closure work.
It is not a request to add more public knobs. The point is to make the current
research branch smaller, clearer, and more mergeable while preserving the
visibility-aware reconstruction idea.

Companion execution packet:

- `test/e2e/lightprobegrid-gpu-contrast-research-ultraplan.md` contains the
  peer review verdict, SDD-skill contrast, task list, acceptance criteria,
  before/after diagram, whiteboard model, and implementation metaprompt.
- `test/e2e/lightprobegrid-gpu-math-slim-approaches.md` contains the boring
  production math SDD: one guarded equation, rejected math temptations, shader
  cleanup plan, and acceptance criteria.

## Current Truth

- Three.js `LightProbe` is a diffuse SH light probe, functionally equivalent to
  an irradiance environment map in the current implementation.
- `LightProbeGenerator.fromCubeRenderTarget()` still reads render target pixels
  while constructing a single `LightProbe`.
- SixteenStudio's WebGPU grid is useful product pressure: GPU bake, one packed
  RGBA 3D atlas, padding slices, and material integration direction.
- SixteenStudio's grid is still an SH atlas port, not a visibility-aware probe
  volume: no probe-receiver visibility moments, validity semantics, layer
  rejection, or proof receiver.
- This branch already has compute projection, visibility moments, metadata,
  guarded manual sampling, and visibility mass.
- The latest correction removed double application of `visibilityDepthWeighting`
  and added `_isVisibilityRuntimeActive()` as the single runtime truth for
  guarded visibility sampling.

Verified reference anchors:

- Three.js LightProbe docs: https://threejs.org/docs/pages/LightProbe.html
- Three.js LightProbeGenerator source: https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/lights/LightProbeGenerator.js
- SixteenStudio WebGPU grid source: https://raw.githubusercontent.com/sixteenstudio/three.js/feat/webgpu-lightprobes-sponza/examples/jsm/lighting/LightProbeGridGPU.js
- NVIDIA RTXGI DDGI algorithm notes: https://raw.githubusercontent.com/NVIDIAGameWorks/RTXGI-DDGI/main/docs/Algorithms.md

## North Star

The mathematical contract is:

```text
ProbeGI(x, n) =
  Mass(x)
  * EvalSH(
      sum_i( w_i(x, n) * C_i ) / sum_i( w_i(x, n) ),
      n
    )

w_i =
  trilinear_i
  * validity_i
  * layerCompatibility_i
  * normalWeight_i
  * momentVisibility_i

Mass(x) =
  sum_i( visibleWeight_i ) / max( sum_i( baseWeight_i ), epsilon )
```

`Mass(x)` is load-bearing. It prevents a surviving low-confidence probe from
being normalized back to full brightness after visibility rejects the rest of
the support.

## Semantic Contract

Keep the payloads separate:

```text
SH coefficients:
  value payload
  what low-frequency diffuse lighting the probe represents

Probe metadata:
  admissibility payload
  whether the probe may participate for a receiver

Visibility moments:
  receiver-relative support payload
  whether the receiver should trust this probe direction/distance

Visibility mass:
  energy honesty payload
  how much support was removed before normalization

GPU receiver proof:
  evidence payload
  whether the material estimator and proof metrics actually close
```

Design rule:

```text
never encode visibility, room ownership, invalidation, or topology by mutating
SH coefficients. Classify support first, normalize second, preserve lost mass.
```

## Public API Goal

Target public surface:

```js
const grid = new LightProbeGridGPU( min, max, {
  resolution: 4,
  cubemapSize: 16,
  quality: 'fast', // 'fast' | 'guarded'
  visibility: true,
  normalBias: 0.5,
  viewBias: 0.0,
  layers: true
} );
```

Rules:

- `quality: 'fast'` selects atlas-only sampling.
- `quality: 'guarded'` selects metadata + visibility-moment sampling.
- `visibility: true` requests the moment resources needed by guarded mode.
- No public Chebyshev controls.
- No public `visibilityDepthWeighting`.
- No public `band1Intensity` / `band2Intensity`.
- No public compatible-kernel data.
- No public receiver-boundary blend mode for v1.

If a debug or test needs intermediate blends, keep them in proof/debug paths,
not the merge-facing API.

## Runtime SDD

### Phase 1: Explicit Quality Modes

Goal:

```text
replace leakReductionMode + guarded private switch with quality-owned runtime paths
```

Tasks:

- Add internal mapping from current options to `quality`.
- Keep backward-compatible private/test shims only while the harness migrates.
- Report `quality`, `visibilityRequested`, `visibilityMomentBacked`, and
  `visibilityRuntimeActive` in `getSamplingInfo()`.
- Reject labels that say `visibility-moments` unless the derived active truth is
  true.

Exit gate:

- `quality='fast'` never creates guarded sampling code.
- `quality='guarded'` cannot claim active visibility until moment resources are
  baked and `depthMode === 'moments'`.

### Phase 2: Split Fast And Guarded Shader Builders

Goal:

```text
production runtime has two clean paths, debug attribution is separate
```

Tasks:

- Keep `_createAtlasIrradianceNode()` as the fast path.
- Extract guarded sampling into a compact production builder.
- Move neighbor attribution modes into a debug-only builder or harness helper.
- Keep scalar/visibility accumulator debug nodes out of production material
  construction.

Exit gate:

- Fast path contains no validity, visibility, layer, or debug branches.
- Guarded path contains only gather, metadata, moments, mass, and SH eval.

### Phase 3: Guarded Weight Semantics

Goal:

```text
make each weight term own exactly one concept
```

Runtime formula:

```text
base = tri * validity * layerCompatibility * normalWeight
visible = base * momentVisibilityRaw
mass = visibleSum / baseSum
```

Tasks:

- Remove the compatible ellipsoid kernel from the v1 guarded path.
- Keep normal weight as orientation preference, not visibility truth.
- Keep moment visibility raw; no second intermediate blend.
- Keep `visibilityDepthWeighting` out of moment visibility permanently.

Exit gate:

- Source invariant proves moment visibility does not reference
  `visibilityDepthWeighting`.
- Guarded path uses `visibleSum / baseSum` for mass.

### Phase 4: Probe Metadata Strictness

Goal:

```text
invalid probes can be actually invalid in proof
```

Tasks:

- Split validity policy:
  - `proofStrict`: `validity = meta.x`
  - `runtimeSoft`: `validity = max( meta.x, PROBE_VALIDITY_FLOOR )`
- Keep `proofStrict` test/proof-only unless product evidence shows the runtime
  floor should be user-facing.
- Keep metadata layout compact: validity, confidence, layer mask.
- Keep layer compatibility binary for v1.

Exit gate:

- Invalid-probe contribution can reach zero in strict proof.
- Runtime soft fallback is named honestly if retained.

### Phase 5: Visibility Representation Facts

Goal:

```text
reports prove availability, not just allocation
```

Tasks:

- Expand visibility depth info with:
  - `enabled`
  - `targetPresent`
  - `available`
  - `runtimeActive`
  - `mode`
  - `resolution`
  - `bytes`
  - compact moment readback stats in proof diagnostics
- Keep texture objects out of compact public facts unless needed by a local
  debug call.
- Add a source invariant that report labels derive from `runtimeActive`.

Exit gate:

- No report can label a row `visibility-moments` from `enableVisibility` alone.

## Bake SDD

### Phase 6: Merge-Grade Resource Ownership

Goal:

```text
all bake resources are grid-owned or explicitly shared with safe lifecycle
```

Tasks:

- Keep the current grid-owned resource direction.
- Avoid SixteenStudio-style module-level cached bake targets in the mergeable
  product path.
- Keep dispose/recreate/hot-reload behavior covered by source/runtime smoke.

Exit gate:

- Re-baking after resource recreation refreshes material bindings and does not
  leave destroyed textures in active materials.

### Phase 7: Projection Roadmap

Goal:

```text
compute projection is the default direction, workgroup reduction is future hardening
```

Tasks:

- Keep current compute projection as a valid first WebGPU improvement.
- Preserve fragment projection fallback while WebGPU compute support is guarded.
- Document current compute limitation: one invocation per probe still loops
  cubemap texels serially.
- Future lane: one workgroup per probe, lanes split cubemap texels, shared
  reduction writes all SH9 coefficients.

Exit gate:

- Compute/fragment projection parity remains machine-checked.
- Workgroup reduction is not mixed with runtime/API cleanup.

## Proof SDD

### Phase 8: GPU-Resident Receiver

Goal:

```text
prove the same estimator the material shader uses
```

Receiver shape:

```wgsl
struct Receiver {
  position: vec3f,
  normal: vec3f,
  layerMask: u32,
  expectedRegion: u32,
  referenceIndirect: vec3f,
};

struct ReceiverResult {
  fastIndirect: vec3f,
  guardedIndirect: vec3f,
  visibilityMass: f32,
  weightSum: f32,
  leakScore: f32,
  correctBounceScore: f32,
  flags: u32,
};
```

Tasks:

- Implement receiver evaluation in `test/e2e` or a proof/debug module, not in
  the production runtime.
- Reuse the guarded sampling math; do not maintain a CPU mirror as truth.
- Emit compact summary facts:
  - scene-linear indirect agreement
  - wrong-side leak ratio
  - correct-bounce preservation
  - moment-vs-scalar delta
  - visibility mass min/mean/max
  - invalid-probe contribution
  - layer-rejected contribution
  - negative-lobe pressure

Exit gate:

- Final-color claims must be backed by scene-linear indirect receiver facts.
- CPU attribution can explain, but not certify, the shader result.

### Phase 9: Hardening Gates

Goal:

```text
make the next-gen claim falsifiable
```

Required focused checks:

```text
node --check <touched js files>
npx eslint <touched js files>
node test/e2e/lightprobegrid-gpu-source-invariants.js
node test/e2e/lightprobegrid-gpu-placement-authoring-invariants.js
git diff --check
```

Runtime/proof behavior changes also require focused Cornell WebGPU proof:

```text
node test/e2e/puppeteer.js --webgpu webgpu_lightprobes_cornell --port 1235 --user-data-dir ./.puppeteer_profile_codex_1235
```

Sponza remains runtime/scale pressure only. It must not be used as sealed-wall
leak proof.

## Cut List Before Upstream Proposal

Demote or remove from merge-facing production:

```text
band1Intensity / band2Intensity
visibilityDepthWeighting
leakReductionMode
_probeKernelData / default ellipsoid kernel
receiverBoundaryMode='blend'
debug neighbor arrays in production guarded sampling
public Chebyshev / moment tuning knobs
proof verdict prose in runtime facts
```

Keep:

```text
packed padded SH atlas
compute projection with fallback
visibility moment texture
probe validity / confidence / layer metadata
manual 8-probe guarded gather
visibility mass
compact memory / sampling / timing facts
source invariants
```

## Three.js-Friendly File Shape

Production:

```text
examples/jsm/lighting/LightProbeGridGPU.js
examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js
examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUProjection.js
examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js
examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUMetadata.js
examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js
```

Proof/debug:

```text
test/e2e/lightprobegridgpu/LightProbeGridGPUReceiverDiagnostics.js
test/e2e/lightprobegridgpu/LightProbeGridGPUShDiagnostics.js
test/e2e/lightprobegridgpu/LightProbeGridGPUReadback.js
test/e2e/lightprobegridgpu/LightProbeGridGPUTestHarness.js
examples/jsm/lighting/lightprobegridgpu/debug/
```

Setup-owned authoring may remain product-facing only if it keeps the current
contract shape and source invariants:

```text
examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js
```

## Non-Goals

- Not dynamic DDGI.
- Not runtime ray-traced GI.
- Not APV.
- Not Brixelizer.
- Not neural probe weights.
- Not screen-probe GI.
- Not specular GI.
- Not zero-leak proof without receiver facts.

## Promotion Gate

This SDD is ready to promote to implementation only when the next slice is one
of these narrow changes:

1. API/option cleanup toward `quality`.
2. Runtime split between fast, guarded, and debug builders.
3. Strict validity proof path.
4. Expanded visibility info/report truth.
5. GPU receiver proof scaffold.

Do not combine these. If we mix API cleanup, shader split, proof receiver, and
projection workgroup reduction in one pass, we are back to research-platform
sprawl. This feature gets stronger by getting smaller.

Current implementation gate order is defined in
`test/e2e/lightprobegrid-gpu-math-slim-approaches.md`:

```text
Gate A: freeze production SH evaluation
Gate B: name validity policy
Gate C: demote boundary blend
Gate D: visibility facts and labels
Gate E: GPU receiver proof scaffold
Gate F: upstream shape
```
