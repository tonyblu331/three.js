# LightProbeGridGPU Product Hardening Metaprompt

Use this prompt when continuing the LightProbeGridGPU residual-leak hardening work.

```text
You are working in the three.js LightProbeGridGPU branch. Treat the current
worktree and these docs as authoritative:

- test/e2e/lightprobegrid-gpu-residual-research.md
- test/e2e/lightprobegrid-gpu-product-roadmap.md
- test/e2e/lightprobegrid-gpu-eval.md
- test/e2e/lightprobegrid-gpu-authored-boundary-sdd.md
- test/e2e/lightprobegrid-gpu-math-whiteboard.md
- test/e2e/lightprobegrid-gpu-public-non-claims.md
- test/e2e/lightprobegrid-gpu-placement-promotion-decision.md
- test/e2e/lightprobegrid-gpu-second-sealed-fixture-design.md
- test/e2e/lightprobegrid-gpu-product-authoring-module-contract.md

Goal:

Continue hardening the authored-boundary SDD phases 1-5. The current valid
direction is setup-time local-cell placement / relocation, not receiver-side
support routing and not another receiver-source mode.

Current proof state:

- The proof package still has the residual open gate against the physical
  zero-leak oracle.
- TSL uniform, UV-band, and geometry-attribute receiver sources proved a
  GPU-resident receiver-source seam, but residual stayed unchanged.
- Receiver-side routing is archived: swaps, blends, masks, and support-set
  variants reused the same probe identities or normalized away the coefficient
  loss.
- Setup-side classification is archived as asymmetric: left support changes and
  L0 improves, right support stays fixed, and final irradiance remains neutral.
- Probe-side classification changes identity bilaterally, but local support
  still contains occupied probes and misses the bilateral L0 gate.
- Proof-only relocation oracle proves useful non-occupied support exists, but
  CPU L0/readback is proof evidence only, not product logic.
- Distance, divider, and receiver-visibility proxies are rejected.
- Side-shell topology proxy is the first non-oracle rule to pass bilateral L0:
  left `0.8599 -> 0.6683`, right `0.5818 -> 0.3045`, both occupied support `0`.
- Side-shell support is not reachable by the current trilinear reconstruction
  cell: local-cell overlap is `0/8` on both sides.
- Local-cell support itself stays default/occupied, so remasking is not
  relocation.
- Physical placement requirement proves both sides must replace `8/8` reachable
  local-cell slots, including `4` occupied slots, with non-occupied side-owned
  source support.

Current implemented proof seam:

- `test/e2e/lightprobegridgpu/LightProbeGridGPULocalCellPlacement.js` is
  proof-scoped.
- It emits `probeValidity`, `probeLayerMasks`, and compact `placementFacts`.
- Focused Cornell helper facts: array lengths `64/64`, replacement slots `16`,
  occupied replacement slots `8`, and `acceptedSideCount = 2`.
- Explicit placement policy facts are now part of the interface test surface:
  target support `8`, source support `8`, minimum replacement slots `1`,
  minimum occupied replacement slots `1`, and maximum source occupied support
  `0`.
- Final-irradiance debug consumes the emitted arrays:
  `placementIrradianceDeltaVerdict =
  placement-helper-arrays-improve-final-irradiance-over-default`,
  combined ratio `1.3271`, left ratio `1`, right ratio `1.3512`.
- Render/leak attribution is proof-positive in focused Cornell:
  `placementRenderLeakVerdict =
  placement-helper-arrays-improve-bilateral-render-leak-over-default`;
  masked wrong-side improves `0.7288 -> 0.7246`, left `0.5918 -> 0.5465`,
  right `0.7288 -> 0.7246`, pre-tone `0.8446 -> 0.8204`, and correct bounce
  `1.2654 -> 1.2754`.
- Non-Cornell Sponza visual/runtime coverage is green. `webgpu_lightprobes_sponza`
  passes with `probeCount = 147`, ready initial/rebake metrics, and screenshot
  diff `0.0%`; its rebake path now refreshes material `lightsNode` after atlas
  resources are recreated. `webgpu_lightprobes_sponza_ours` passes with
  `probeCount = 343`, ready initial/rebake metrics, and screenshot diff `0.0%`;
  its harness reports vector resolution consistently with
  `LightProbeGridGPU.resolution`.

Non-goals:

Do not claim zero leak. Do not promote authored-boundary examples as product
proof. Do not add another receiver-source mode. Do not use CPU readback, proof
pixels, Cornell divider coordinates, scalar/WebGL truth, or residual-derived
tuning in runtime leak control.

Next valid product direction:

Harden the proof-scoped local-cell placement helper with coverage before
promotion:

1. Preserve compact proof facts as the interface test surface.
2. Follow `test/e2e/lightprobegrid-gpu-placement-promotion-decision.md`: keep
   the helper proof-scoped, shape only a setup-owned authoring module as the
   promotion candidate, and require a second sealed-wall-like fixture before
   moving the seam out of `test/e2e`. The second fixture contract is
   `test/e2e/lightprobegrid-gpu-second-sealed-fixture-design.md`, with the
   fixture id `sealed-offset-wall`. That fixture family is activatable now and
   emits activation facts, leak rows, and residual attribution. Its current
   proof view uses an offset camera so both sides of the `z` divider are visible
   to the receiver-ID mask. The visibility row lowers masked wrong-side rendered
   energy from `0.8784` to `0.8737`, with
   `maskedVisibleResidualRatio = 0.9946`; pre-tone correct bounce moves from
   `1.1832` to `1.2012`. The same fixture now emits
   `sealedOffsetWallPlacementHelperAttribution` with `acceptedSideCount = 2`,
   replacement slots `16`, occupied replacement slots `8`, and both sides
   passing `local-cell-placement-policy`. It also emits
   `sealedOffsetWallPlacementRenderLeakDelta`: combined masked wrong-side
   improves `0.8278 -> 0.6576`, pre-tone wrong-side improves `0.7464 ->
   0.6118`, and correct bounce improves `1.3058 -> 1.5587`, but right masked
   wrong-side worsens by `1.0252x`. `rightSideRegressionAttribution` classifies
   this as `right-side-small-baseline-regression-with-combined-placement-win`:
   the right footprint is stable (`28 -> 28` masked pixels, `433 -> 433`
   pre-tone pixels), and wrong-side starts low (`0.2141 -> 0.2195`). The
   `low-baseline-side-regression-policy` is machine-checked with baseline
   threshold `0.25`, stable-pixel requirements, combined/pre-tone improvement,
   and correct-bounce preservation. Treat Sponza as visual/runtime coverage,
   not sealed-wall leak proof.
3. Keep production semantics setup-owned:
   `createLightProbeGridGPUPlacementAuthoring(...)` accepts authored receiver
   regions, layer rules, occupancy policy, placement policy, and source
   selection policy; it emits `probeValidity`, `probeLayerMasks`, and compact
   `placementFacts`.
4. Do not move the helper out of `test/e2e` until the promotion gate is backed
   by render/leak evidence beyond the single focused Cornell scene.

Expected code seams:

- examples/jsm/lighting/LightProbeGridGPU.js
- examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js
- examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUAtlas.js
- test/e2e/lightprobegridgpu/LightProbeGridGPULocalCellPlacement.js
- test/e2e/lightprobegridgpu/LightProbeGridGPUTestHarness.js
- test/e2e/lightprobegrid-gpu-runner-matrix-assertions.js
- test/e2e/lightprobegrid-gpu-source-invariants.js
- test/e2e/lightprobegrid-gpu-placement-authoring-invariants.js
- test/e2e/lightprobegrid-gpu-placement-authoring-migration-guard.md
- test/e2e/lightprobegrid-gpu-phases-1-5-closure-audit.md
- examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js

Verification:

- For docs only: git diff --check.
- For runtime or harness changes: touched node --check, source invariants if
  runtime source changes, placement authoring invariants if the authoring seam
  changes, git diff --check, and focused Cornell WebGPU proof.
- Do not run a full build by default.

Final answer should state:

- What changed.
- Which gate or product-hardening phase it advances.
- What remains open.
- Which checks ran.
```

## Active Slice

Start from `test/e2e/lightprobegrid-gpu-authored-boundary-sdd.md`.

The current task is to convert the proof-positive local-cell placement seam into
a hardened product shape. The proof helper is promising, but still test-scoped:
it does not move baked coefficients or probe positions, and the current visible
win is narrow. Keep the implementation honest by treating compact placement
facts and render/leak attribution as the interface test surface.

The current promotion decision is explicit: no runtime receiver-source
promotion, no shader-side nonlocal support, and no direct move out of `test/e2e`.
The product-shaped contract is
`test/e2e/lightprobegrid-gpu-product-authoring-module-contract.md`.
`createLightProbeGridGPUPlacementAuthoring(...)` now lives directly in
`examples/jsm` and accepts product-shaped inputs without a legacy e2e wrapper.
Focused Cornell emits `placement-authoring-product-module-emits-arrays`,
`acceptedSideCount = 2`, replacement slots `16`, occupied replacement slots
`8`, and product source-selection facts that omit proof-only forbidden-input
fields. Sealed-wall and sealed-offset-wall now both emit
`placement-authoring-matches-helper-facts`; offset parity reports matching
policy facts, summary counts, and side hashes. The smoke path also runs
`lightprobegrid-gpu-placement-authoring-invariants.js`, which validates the
product module directly, proves one positive product contract, proves one base
array integration case, and rejects thirteen source/schema violations. Focused
Cornell now gates product module usage with
`placement-authoring-product-module-emits-arrays`, `productHasProofOnlyFacts =
false`, and helper-fact parity via `placement-authoring-matches-helper-facts`.
`webgpu_lightprobes_sponza_ours` now exposes
bounded product-facing usage with
`sponza-product-placement-authoring-usage-ready`, `totalProbes = 343`,
replacement slots `16`, occupied replacement slots `8`,
`productHasProofOnlyFacts = false`, and `leakMetricStatus = not-applicable`.

The `examples/jsm` migration guard now exists at
`test/e2e/lightprobegrid-gpu-placement-authoring-migration-guard.md`. The
placement authoring invariant runner scans current/future `examples/jsm`
LightProbeGridGPU authoring sources for proof helper imports and proof-only
tokens. The initial product module now exists at
`examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js`
without proof helper imports or proof-only authoring tokens. Keep the proof
helper in `test/e2e`; retain placement authoring invariants and compact matrix
facts as the interface test surface. Do not claim Sponza is sealed-wall leak
proof.

The closure audit exists at
`test/e2e/lightprobegrid-gpu-phases-1-5-closure-audit.md`. Future work should
move to broader hardening, not more proof-helper promotion.
The previous zero pre-tone correct-bounce issue was a one-sided proof-mask
visibility failure and is now guarded by bilateral masked pixel facts.
