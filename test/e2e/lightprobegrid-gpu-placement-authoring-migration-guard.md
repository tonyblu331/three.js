# LightProbeGridGPU Placement Authoring Migration Guard

## Decision

`createLightProbeGridGPUPlacementAuthoring(...)` is the product-shaped seam.
The product module now lives here:

```text
examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js
```

The proof helper still stays here:

```text
test/e2e/lightprobegridgpu/LightProbeGridGPULocalCellPlacement.js
```

## Migration Preconditions

A product module may remain in `examples/jsm` only while it keeps this interface
shape:

```js
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
} );
```

It must return:

```js
{
  probeValidity,
  probeLayerMasks,
  placementFacts
}
```

## Required Guards

- Do not import or copy `LightProbeGridGPULocalCellPlacement.js` into
  `examples/jsm`.
- Do not expose `proofBoundary` or proof verdict strings in product output.
- Do not use CPU L0 readback, proof pixels, residual ratios, or scalar/WebGL
  truth as source-selection inputs.
- Keep `receiverRegions` matched to `layerRules` by `side` and
  `boundaryLayerMask`.
- Keep support entries explicit: every probe needs a bounded `probeIndex` and
  boolean `occupied` state.
- Keep compact facts as the interface test surface: counts, policy ids, hashes,
  and schema facts. Do not promote row dumps or rendered pixel samples.

## Machine Guard

`test/e2e/lightprobegrid-gpu-placement-authoring-invariants.js` enforces:

- one positive product-shaped authoring case;
- thirteen invalid source/schema cases;
- no proof helper import, proof-boundary strings, or proof-only source tokens in
  current/future `examples/jsm` LightProbeGridGPU authoring sources.

The guard now checks the product module directly. It also keeps scanning future
LightProbeGridGPU product sources so proof-only dependencies cannot slip in
through a later integration.

## Still Not Claimed

- This does not promote the helper.
- This does not prove zero leak.
- This does not make Sponza a sealed-wall leak proof.
- This does not move baked coefficients or physical probe positions yet.
