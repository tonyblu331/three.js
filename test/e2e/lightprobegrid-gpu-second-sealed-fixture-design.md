# LightProbeGridGPU Second Sealed Fixture Design

Verified: 2026-06-05.

## Purpose

The local-cell placement lane needs one more leak-proof fixture before
promotion. Cornell proves the current policy shape in one geometry; Sponza
proves visual/runtime scale only. The second fixture must be sealed-wall-like,
but not Cornell-shaped.

This fixture is a promotion gate for the setup-owned placement seam described in
`test/e2e/lightprobegrid-gpu-placement-promotion-decision.md`.

## Non-Goals

- Do not use Sponza as sealed-wall leak proof.
- Do not add a receiver runtime mode.
- Do not add shader-side nonlocal support.
- Do not use CPU L0 readback, proof pixels, Cornell divider coordinates, or
  scalar/WebGL truth for runtime placement.
- Do not clone Cornell with renamed labels.

## Fixture Requirements

The second fixture must preserve the proof idea but change the geometry enough
to catch overfitting:

- different divider axis or divider offset from Cornell;
- different receiver depths and rotations;
- different side-owned bounce surface layout;
- same two-sided sealed occlusion principle;
- same proof row family:
  - validity-weighted baseline;
  - visibility-moments candidate;
  - local-cell placement helper attribution;
  - final-irradiance debug attribution;
  - render/leak attribution.

The fixture must expose compact facts:

```text
fixtureId
fixtureFamily
dividerAxis
dividerOffset
leftReceiverWorldBounds
rightReceiverWorldBounds
leftBounceRegion
rightBounceRegion
probeResolution
placementPolicyFacts
```

## Candidate Shape

Use a second fixture family named:

```text
sealed-offset-wall
```

Recommended geometry:

- divider axis: `z`, not `x`;
- divider offset: non-centered within the probe grid;
- left/right receivers become front/back receivers in world terms, while proof
  facts keep logical side names `left` and `right`;
- bounce surfaces sit on opposite side walls and floor strips, not symmetric
  Cornell wall/floor layout;
- receivers are rotated toward the divider but use different depths from the
  current Cornell receivers.

This gives the placement policy a real generalization test:

- side-shell topology cannot rely on Cornell `x` shell only;
- local-cell reachability must be computed from receiver placement, not
  hard-coded divider position;
- render/leak ratios still use logical left/right wrong-side color channels.

## Implementation Seams

Preferred implementation order:

1. Add a second fixture builder in `examples/webgpu_lightprobes_cornell.html`
   instead of adding a new runtime example.
2. Extend `leakFixture` to hold named fixture families:
   - `sealed-wall`;
   - `sealed-offset-wall`.
3. Change `setLeakFixtureMode()` to accept `{ family, dividerMode }` or a
   compact fixture id, while preserving current `sealed-wall`, `thin-wall`, and
   `zero-thickness` behavior.
4. Extend `captureLeakProofFacts()` to run the current Cornell family first and
   the second fixture as a separate promotion-gate block.
5. Add matrix assertions that validate the second fixture emits the same compact
   placement policy facts without requiring identical numeric ratios.

## Acceptance Gates

- Existing Cornell proof still passes unchanged.
- Sponza visual/runtime controls still pass.
- Second fixture rows include `fixtureId = sealed-offset-wall`.
- Second fixture has `leakMetricStatus = tested`.
- Placement policy facts match:
  - target support size `8`;
  - source support size `8`;
  - minimum replacement slots `1`;
  - minimum occupied replacement slots `1`;
  - maximum source occupied support `0`.
- Local-cell placement helper reports `acceptedSideCount = 2`.
- Final-irradiance debug attribution is present and finite.
- Render/leak attribution is present and finite.
- Promotion requires either:
  - bilateral render/leak improvement; or
  - an explicit rejection artifact showing why the Cornell placement policy does
    not generalize.

## Rejection Signals

Reject the fixture implementation if:

- it depends on Cornell divider coordinates;
- it only changes screenshot framing;
- it reuses the same receiver world bounds;
- it requires new runtime shader behavior;
- it hides a failed side by using combined-only metrics;
- it passes by broad darkening or correct-bounce loss.

## Current Status

Status: fixture family implemented with activation attribution, leak rows,
residual attribution, placement-policy helper attribution, and right-side
placement regression attribution.

`sealed-offset-wall` now exists as an activatable leak fixture family in
`examples/webgpu_lightprobes_cornell.html`. The harness can switch to it through
`setLeakFixtureMode( 'sealed-offset-wall' )`, and focused Cornell proof now
emits `sealedOffsetWallFixtureAttribution`:

- `fixtureId = sealed-offset-wall`;
- `proofBoundary = fixture-family-activation-only`;
- `activeDivider = sealed-offset-wall`;
- `dividerAxis = z`;
- `dividerOffset = 0.52`;
- logical left receiver at `[-1.05, 1, -0.75]`;
- logical right receiver at `[0.75, 1.18, 1.55]`;
- `visibleMeshCount = 9`;
- `offsetVisible = true`;
- `fixtureActivationVerdict = sealed-offset-wall-fixture-activates`.

Focused Cornell proof also emits `sealedOffsetWallRows` from an
offset-fixture proof camera. That camera is steep enough to see both sides of
the `z` divider; the row contract requires nonzero masked pixels on both
logical receivers so this fixture cannot pass with a one-sided mask.

- `sealed-offset-wall-validity-weighted` has `wrongSideColorRatio = 0.7024`,
  `maskedWrongSideColorRatio = 0.8784`, `correctBounceRatio = 1.4238`,
  `preToneMaskedWrongSideColorRatio = 0.8452`,
  `preToneMaskedCorrectBounceRatio = 1.1832`, and masked receiver pixels
  `248/28` left/right;
- `sealed-offset-wall-visibility-moments` has `wrongSideColorRatio = 0.7115`,
  `maskedWrongSideColorRatio = 0.8737`, `correctBounceRatio = 1.4056`,
  `preToneMaskedWrongSideColorRatio = 0.8325`,
  `preToneMaskedCorrectBounceRatio = 1.2012`, and masked receiver pixels
  `248/28` left/right;
- `sealedOffsetWallResidualAttribution.maskedVisibleResidualRatio = 0.9946`;
- `sealedOffsetWallResidualAttribution.preToneMaskedResidualRatio = 0.985`;
- `sealedOffsetWallResidualAttribution.correctBounceRatio = 0.9872`;
- `sealedOffsetWallResidualAttribution.preToneCorrectBounceRatio = 1.0152`;
- `sealedOffsetWallResidualAttribution.offsetResidualVerdict =
  sealed-offset-wall-visibility-lowers-masked-wrong-side-ratio`.

Focused Cornell proof also emits
`sealedOffsetWallPlacementHelperAttribution` inside the setup-side placement
lane:

- `fixtureId = sealed-offset-wall`;
- `helperPolicyId = local-cell-placement`;
- `acceptedSideCount = 2`;
- `probeValidityLength = 64` and `probeLayerMasksLength = 64`;
- total replacement slots `16`, including `8` occupied replacement slots;
- both sides replace `8/8` target local-cell slots;
- both sides report `overlapCount = 0`, `sourceOutsideLocalCellCount = 8`,
  `targetOccupiedSupportCount = 4`, `sourceOccupiedSupportCount = 0`, and
  `side-passes-local-cell-placement-policy`.

Focused Cornell proof also emits
`sealedOffsetWallPlacementRenderLeakDelta`:

- unclassified offset boundary render has `maskedWrongSideColorRatio = 0.8278`,
  left `0.8278`, right `0.2141`,
  `preToneMaskedWrongSideColorRatio = 0.7464`, and
  `correctBounceRatio = 1.3058`;
- placement offset boundary render has `maskedWrongSideColorRatio = 0.6576`,
  left `0.6576`, right `0.2195`,
  `preToneMaskedWrongSideColorRatio = 0.6118`, and
  `correctBounceRatio = 1.5587`;
- placement/default render ratios are `0.7944` combined wrong-side, `0.7944`
  left, `1.0252` right, `0.8197` pre-tone wrong-side, and `1.1937` correct
  bounce;
- `placementRenderLeakVerdict =
  placement-helper-arrays-improve-combined-render-leak-over-default`.
- `rightSideRegressionAttribution.rightSideRegressionVerdict =
  right-side-small-baseline-regression-with-combined-placement-win`;
- `lowBaselineSideRegressionPolicy.policyId =
  low-baseline-side-regression-policy`;
- `lowBaselineSideRegressionPolicy.maxBaselineWrongSideColorRatio = 0.25`;
- right masked visible pixels stay stable at `28 -> 28`;
- right pre-tone masked visible pixels stay stable at `433 -> 433`;
- right masked wrong-side starts low at `0.2141` and moves to `0.2195`.

This is useful second-fixture coverage: the visibility candidate lowers masked
wrong-side rendered energy on a non-Cornell divider axis, the same setup-owned
local-cell placement policy shape survives on the offset fixture, and applying
those arrays improves combined rendered leakage without losing correct bounce.
It is not promotion success yet. The offset render result is combined-positive
but not bilateral-positive. The right-side attribution shows this is not a
mask-footprint shift: the right footprint is stable, and the regression is a
small delta from an already low wrong-side baseline. The named
`low-baseline-side-regression-policy` is now machine-checked. The next
engineering task is product-shape work: draft the setup-owned authoring module
around the accepted facts while keeping the proof helper in `test/e2e`.
