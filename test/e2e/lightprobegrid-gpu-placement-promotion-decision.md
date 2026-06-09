# LightProbeGridGPU Placement Promotion Decision

Verified: 2026-06-05.

## Decision

Keep `test/e2e/lightprobegridgpu/LightProbeGridGPULocalCellPlacement.js`
proof-scoped for now. The setup-owned placement seam is strong enough to keep
shaping the product authoring module, but not strong enough to move out of
`test/e2e`.

The first promotion candidate is not a receiver runtime option and not a shader
nonlocal-support path. The candidate is a setup-owned authoring module that
produces the existing runtime inputs:

```text
probeValidity
probeLayerMasks
placementFacts
```

Promotion is allowed only after the second sealed-wall-like fixture proves both
the same placement policy shape and an accepted render/leak outcome outside the
current Cornell geometry. Sponza is green visual/runtime coverage, but it is not
sealed-wall leak proof.

Use `test/e2e/lightprobegrid-gpu-second-sealed-fixture-design.md` as the
implementation contract for that second fixture.

## Why

The receiver-source seam is technically proven, but it did not reduce the open
residual. Receiver-side support routing is archived because tested candidates
reuse the same probe identities or normalize the signal away.

The current positive path is setup-time local-cell placement:

- side-shell topology is the first non-oracle selector to pass bilateral L0;
- side-shell support is outside the trilinear local cell on both sides;
- local-cell remasking keeps default/occupied support and is rejected;
- physical local-cell placement requires replacing all reachable local-cell
  slots on both sides, including occupied slots;
- the proof helper emits `probeValidity` and `probeLayerMasks`;
- final-irradiance debug consumes those arrays;
- Cornell render/leak attribution shows a narrow visible bilateral win.

That is enough to define a product seam, but not enough to promote it.

## Promotion Candidate

Promote a setup authoring module only if its public interface stays deep:

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

The interface must hide placement mechanics behind authored policies, while
keeping compact facts as the test surface.

The full contract lives in
`test/e2e/lightprobegrid-gpu-product-authoring-module-contract.md`.

## Acceptance Gates

- Default behavior is unchanged when no placement metadata is supplied.
- Generated arrays are length `resolution^3`.
- Masks remain 24-bit integer bitfields compatible with `probeLayerMasks`.
- Source support selection does not use CPU L0 readback, proof pixels, Cornell
  divider coordinates, scalar/WebGL truth, or residual-derived tuning.
- Placement policy facts remain explicit:
  - target support size `8`;
  - source support size `8`;
  - minimum replacement slots `1`;
  - minimum occupied replacement slots `1`;
  - maximum source occupied support `0`.
- Cornell focused proof keeps current supported gates and records:
  - `acceptedSideCount = 2`;
  - `placementIrradianceDeltaVerdict =
    placement-helper-arrays-improve-final-irradiance-over-default`;
  - `placementRenderLeakVerdict =
    placement-helper-arrays-improve-bilateral-render-leak-over-default`.
- A second sealed-wall-like fixture, currently designed as `sealed-offset-wall`,
  shows the same policy shape without Cornell fixture coordinates.
- `sealed-offset-wall` render/leak delta must either:
  - be bilateral-positive; or
  - pass the named low-baseline side-regression tolerance:
    - `lowBaselineSideRegressionPolicy.policyId =
      low-baseline-side-regression-policy`;
    - the regressing side starts below
      `maxBaselineWrongSideColorRatio = 0.25`;
    - masked and pre-tone receiver pixel counts are stable before/after
      placement;
    - combined masked wrong-side ratio improves;
    - pre-tone masked wrong-side ratio improves;
    - correct bounce is preserved or improved;
    - the regression attribution verdict is
      `right-side-small-baseline-regression-with-combined-placement-win`.
- Sponza visual/runtime controls pass, but remain non-leak-proof controls.

## Rejected Promotion Paths

- Promoting another receiver-source mode.
- Adding shader-side nonlocal support without an authored setup seam.
- Treating local-cell remasking as relocation.
- Promoting CPU L0 oracle logic.
- Claiming zero leak or product closure while the residual gate is open.

## Current Status

Status: shaping allowed, promotion still proof-scoped.

Second sealed-wall-like coverage now exists:

- `sealed-offset-wall` activation, leak rows, and residual attribution are
  captured.
- `sealed-offset-wall` placement helper attribution passes the same local-cell
  placement policy shape with `acceptedSideCount = 2`.
- `sealed-offset-wall` placement render/leak delta is combined-positive:
  `maskedWrongSideColorRatio = 0.8278 -> 0.6576`,
  `preToneMaskedWrongSideColorRatio = 0.7464 -> 0.6118`, and
  `correctBounceRatio = 1.3058 -> 1.5587`.
- The only offset regression is right-side low-baseline movement:
  `0.2141 -> 0.2195`, ratio `1.0252`, with stable pixel counts
  `28 -> 28` masked and `433 -> 433` pre-tone.
- That regression passes the machine-checked
  `low-baseline-side-regression-policy`.

That is enough to draft the product authoring module around the accepted setup
facts. It is not enough to promote the proof helper directly: the implementation
still lives in `test/e2e`, and the low-baseline tolerance is a promotion policy
that must stay named and machine-checked if accepted.

Next implementation step: keep `createLightProbeGridGPUPlacementAuthoring(...)`
as the direct product module, keep the proof helper in `test/e2e`, and harden
the compact facts and invariants without adding a legacy wrapper.
