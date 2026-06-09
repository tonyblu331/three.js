# LightProbeGridGPU Product Authoring Module Contract

Verified: 2026-06-05.

## Decision

The product candidate is a setup-owned authoring module, not a runtime receiver
mode and not shader-side nonlocal probe sampling.

Keep the current proof helper in
`test/e2e/lightprobegridgpu/LightProbeGridGPULocalCellPlacement.js`. The
production-shaped module should live conceptually in:

```text
examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js
```

Do not move code there until the interface below is implemented against the
accepted proof facts.

## Module Shape

```text
createLightProbeGridGPUPlacementAuthoring( {
  min,
  max,
  resolution,
  defaultLayerMask,
  receiverRegions,
  layerRules,
  occupancyPolicy,
  placementPolicy,
  sourceSelectionPolicy
} ) -> {
  probeValidity,
  probeLayerMasks,
  placementFacts
}
```

## Inputs

`min`, `max`, and `resolution` define the probe grid and must match the
`LightProbeGridGPU` instance that consumes the output arrays.

`defaultLayerMask` is the fallback receiver/probe compatibility bitfield.

`receiverRegions` describe the receiver-side reconstruction cells that need
protected support. They are authored regions, not proof pixels. Required fields:

```text
id
side
boundaryLayerMask
sampleRegion
```

`layerRules` map authored sides/classes to 24-bit masks. They must not depend on
Cornell divider coordinates.

`occupancyPolicy` decides which local-cell probes are unusable. It may consume
scene geometry at setup time, but it must emit facts and must not use lighting
readback.

`placementPolicy` names the acceptance thresholds:

```text
policyId = local-cell-placement-policy
requiredTargetSupportSize = 8
requiredSourceSupportSize = 8
minReplacementSlotCount = 1
minOccupiedReplacementSlotCount = 1
maxSourceOccupiedSupportCount = 0
```

`sourceSelectionPolicy` chooses side-owned source support. Accepted product
policy:

```text
policyId = side-shell-local-cell-source-policy
ranking = side-shell topology, then receiver distance
```

Proof-only source fields such as CPU L0, proof pixels, residual ratios, and
scalar/WebGL truth are rejected input and must not appear in product facts.

## Outputs

`probeValidity` is a `Float32Array` of length `resolution^3`.

`probeLayerMasks` is a `Uint32Array` of length `resolution^3`.

`placementFacts` is the interface test surface. It must include:

```text
policyId
placementPolicyFacts
sourceSelectionPolicyFacts
totalProbes
acceptedSideCount
replacementSlotCount
occupiedReplacementSlotCount
sideFacts
```

Each side fact must include:

```text
side
boundaryLayerMask
targetSupportIdentityHash
targetSupportGridCoordHash
sourceSupportIdentityHash
sourceSupportGridCoordHash
targetSupportSize
sourceSupportSize
overlapCount
replacementSlotCount
occupiedReplacementSlotCount
sourceOutsideLocalCellCount
targetOccupiedSupportCount
sourceOccupiedSupportCount
placementPolicyVerdict
```

## Accepted Evidence

Focused Cornell:

- `acceptedSideCount = 2`;
- replacement slots `16`;
- occupied replacement slots `8`;
- final-irradiance debug consumes the arrays;
- render/leak verdict is
  `placement-helper-arrays-improve-bilateral-render-leak-over-default`.

Second fixture `sealed-offset-wall`:

- same policy shape passes with `acceptedSideCount = 2`;
- replacement slots `16`;
- occupied replacement slots `8`;
- combined render leak improves `0.8278 -> 0.6576`;
- pre-tone wrong-side improves `0.7464 -> 0.6118`;
- correct bounce improves `1.3058 -> 1.5587`;
- right-side low-baseline regression passes
  `low-baseline-side-regression-policy`.

Proof-side authoring adapter:

- `createLightProbeGridGPUPlacementAuthoring(...)` exists in the product module;
- it accepts product-shaped receiver regions, layer rules, occupancy policy,
  placement policy, and source-selection policy;
- it delegates to the current proof-scoped placement helper;
- it rejects malformed layer rules and source-selection policy facts that drop
  the proof-independent source constraints;
- focused Cornell emits `placement-authoring-emits-local-cell-placement-arrays`;
- focused Cornell reports `acceptedSideCount = 2`, replacement slots `16`, and
  occupied replacement slots `8`;
- `sourceSelectionPolicyFacts` explicitly forbids `cpu-l0-readback`,
  `proof-pixels`, `residual-ratios`, and `scalar-webgl-truth`;
- sealed-wall and sealed-offset-wall both emit
  `placement-authoring-matches-helper-facts`;
- sealed-offset-wall adapter facts match helper policy facts, summary counts,
  and compact side hashes;
- sealed-offset-wall side hashes are left target/source
  `fnv1a32:f7b1180d` / `fnv1a32:1eb3d3a1` and right target/source
  `fnv1a32:e50b2bcd` / `fnv1a32:519a6495`.
- `lightprobegrid-gpu-placement-authoring-invariants.js` runs one positive
  contract case and seven rejection cases;
- placement authoring invariants reject CPU/readback source policy drift,
  proof-pixel ranking drift, missing forbidden inputs, unmatched layer rules,
  out-of-grid support probes, missing occupancy state, and malformed layer rule
  sides.
- `test/e2e/lightprobegrid-gpu-placement-authoring-migration-guard.md` names the
  product module path and keeps the proof helper in `test/e2e`;
- the invariant runner scans current/future `examples/jsm` LightProbeGridGPU
  authoring sources for proof helper imports, proof-boundary strings, and
  proof-only source tokens.

Initial product module:

- `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js`
  now implements the product-shaped interface without importing the proof
  helper;
- the product module returns `probeValidity`, `probeLayerMasks`, and compact
  `placementFacts`;
- product placement facts omit proof-boundary fields and proof-only source
  tokens;
- the placement authoring invariant runner validates the product module;
- the invariant runner covers one positive case and seven rejection cases;
- focused Cornell compares product module facts against proof helper facts for
  the minimal contract input;
- product-facing integration checks verify base arrays are copied, target slots
  use `defaultLayerMask | boundaryLayerMask`, source-only slots are invalidated,
  and untouched slots preserve caller-provided base data.
- focused Cornell product authoring reports `placementAuthoringVerdict =
  placement-authoring-product-module-emits-arrays`;
- focused Cornell helper/product parity reports
  `placement-authoring-matches-helper-facts`;
- focused Cornell product authoring reports `productHasProofOnlyFacts = false`.
- `webgpu_lightprobes_sponza_ours` now exposes bounded product-facing example
  usage through `inspectPlacementAuthoringUsageFacts()`;
- Sponza ours product usage reports
  `placementAuthoringUsageVerdict =
  sponza-product-placement-authoring-usage-ready`, `totalProbes = 343`,
  replacement slots `16`, occupied replacement slots `8`,
  `productHasProofOnlyFacts = false`, and `leakMetricStatus = not-applicable`.

## Non-Claims

- This is not zero leak.
- This is not a DDGI relocation system.
- This is not runtime nonlocal probe selection.
- This is not CPU L0 or scalar/WebGL truth in product logic.
- Sponza remains visual/runtime scale pressure, not sealed-wall leak proof.

## Next Implementation Step

Use `test/e2e/lightprobegrid-gpu-phases-1-5-closure-audit.md` as the closure
record for phases 1-5. Future work should be broader hardening, not more
promotion of the proof helper.
