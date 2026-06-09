# LightProbeGridGPU Phases 1-5 Closure Audit

Date: 2026-06-05

## Verdict

Phases 1-5 are closed for the current SDD scope as a proof-backed product
authoring lane.

Current rating: `9.1/10`.

This closure does not claim zero leak, full DDGI relocation, Sponza sealed-wall
proof, or physical movement of baked coefficients/probe positions. It closes the
requested authored-boundary work by proving the setup-owned authoring interface,
source/placement guards, product module shape, product usage hook, and compact
machine gates.

## Evidence Summary

| Phase | Closure Status | Evidence | Remaining Non-Claim |
| --- | --- | --- | --- |
| Phase 1 authoring semantics | Closed with non-claims | Product contract, public non-claims, receiver/layer/placement semantics, bounded product usage | Not zero leak; second fixture is combined-positive, not bilateral-positive |
| Phase 2 ownership/helper seam | Closed as guarded product lane | Product module, proof helper kept in `test/e2e`, migration guard, invariants, helper-fact parity | Proof helper is not promoted |
| Phase 3 receiver boundary sources | Closed as archived source seam | Runtime source invariants and archived receiver-side routing decision | Not a residual leak-control fix |
| Phase 4 visibility policy | Closed as policy guard | Named proof policy facts and source invariants block magic-number/proof-source drift | Visibility policy is not a guaranteed residual solver |
| Phase 5 probe placement/relocation | Closed as active product candidate | Physical placement requirement, helper proof, product authoring module, product usage, sealed-offset-wall fixture, Cornell proof gates | Not full relocation/DDGI; no broad product claim beyond guarded authoring |

## Machine Evidence

- `test/e2e/lightprobegrid-gpu-placement-authoring-invariants.js`
  - positive product contract cases: `1`
  - product integration cases: `1`
  - rejection cases: `7`
  - guards product path:
    `examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js`
  - forbids proof helper imports, proof-boundary fields, CPU/readback source
    policies, proof pixels, residual ratios, scalar/WebGL truth, unmatched layer
    rules, out-of-grid probes, and implicit occupancy.
- `test/e2e/lightprobegrid-gpu-source-invariants.js`
  - runtime leak-control sources reject Cornell divider logic, proof pixels,
    scalar/WebGL truth, and CPU readback.
- Focused Cornell artifact:
  - `placement-authoring-product-module-emits-arrays`;
  - `productHasProofOnlyFacts = false`;
  - sealed-offset-wall parity:
    `placement-authoring-matches-helper-facts`;
  - sealed-offset-wall render verdict:
    `placement-helper-arrays-improve-combined-render-leak-over-default`;
  - right-side low-baseline verdict:
    `right-side-small-baseline-regression-with-combined-placement-win`.
- Focused Sponza ours artifact:
  - runtime status `ready`;
  - `probeCount = 343`;
  - `sponza-product-placement-authoring-usage-ready`;
  - `totalProbes = 343`;
  - replacement slots `16`;
  - occupied replacement slots `8`;
  - `productHasProofOnlyFacts = false`;
  - `leakMetricStatus = not-applicable`.
- Common comparison artifact:
  - Cornell rows are leak-tested sealed-wall rows;
  - Sponza control and Sponza ours rows remain
    `leakMetricStatus = not-applicable` with reason
    `not a sealed-wall Cornell fixture`.

## Product Boundary

Product module:

```text
examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUPlacementAuthoring.js
```

Proof helper:

```text
test/e2e/lightprobegridgpu/LightProbeGridGPULocalCellPlacement.js
```

The product module may be used by examples and product-facing harnesses. The
proof helper remains in `test/e2e` and must not be imported or copied into
`examples/jsm`.

## Closed Gates

- Product-shaped authoring contract exists.
- Product module emits `probeValidity`, `probeLayerMasks`, and compact
  `placementFacts`.
- Product/proof parity is checked for shared arrays and compact facts.
- Product module omits proof-only fields and proof-only source tokens.
- Product usage is gated in focused Cornell proof.
- Bounded Sponza usage is gated as product/runtime coverage only.
- Runtime and authoring source invariants run in the smoke path.
- Sealed-offset-wall second fixture remains machine-checked.
- Low-baseline right-side regression policy is explicit and machine-checked.

## Open By Design

- Do not claim zero leak.
- Do not claim Sponza as sealed-wall leak proof.
- Do not claim full DDGI relocation or baked coefficient movement.
- Do not promote the proof helper.
- Do not add shader-side nonlocal probe selection as a shortcut.
- Do not use CPU L0 readback, proof pixels, residual ratios, scalar/WebGL truth,
  or Cornell-specific coordinates in product logic.

## Next Work

Future work should move from closure to hardening:

- add broader product examples only with non-claims attached;
- extend placement policy beyond the minimal side-shell/local-cell policy;
- add over-occlusion and bilateral second-fixture gates before stronger leak
  claims;
- consider physical relocation/coefficient movement only after a separate SDD.
