# LightProbeGridGPU Product Hardening Metaprompt

Use this prompt when continuing the LightProbeGridGPU residual-leak hardening work.

```text
You are working in the three.js LightProbeGridGPU branch. Treat the current worktree and these docs as authoritative:

- test/e2e/lightprobegrid-gpu-residual-research.md
- test/e2e/lightprobegrid-gpu-product-roadmap.md
- test/e2e/lightprobegrid-gpu-eval.md
- test/e2e/lightprobegrid-gpu-authored-boundary-sdd.md
- test/e2e/lightprobegrid-gpu-math-whiteboard.md

Goal:

Advance Gate 1 of the setup-side candidate triage: explain why the
setup-classified coefficient/render candidate shows a real left-side signal,
while the final-irradiance/debug ratios stay neutral at `1`.

The next useful artifact is proof-only descriptor/debug-path attribution:
compact facts showing whether the final-irradiance debug node is comparing the
same setup-classified probe metadata that the render guard samples, or whether
its default/boundary descriptors collapse to the same support set.

Non-goal:

Do not close the residual by adding knobs. Do not promote probe ownership. Do
not claim zero leak. Do not add another receiver-source mode. Do not implement
relocation or visibility-policy cleanup until Gate 1 and Gate 2 explain whether
the setup-side identity change survives reconstruction.

Current proof state:

- The proof package is OPEN with 15 supported gates and 1 open gate.
- The only open gate is sealedWall.preToneMaskedWrongSideResidualLeakRatio = 0.9377 against the physical zero-leak oracle.
- The scalar/WebGL path and SixteenStudio path are leaky comparators, not ground truth.
- Current render guard reports `maskedWrongSideColorRatio = 0.7286`,
  `preToneMaskedWrongSideColorRatio = 0.8089`,
  `preToneMaskedCorrectBounceRatio = 1.2363`, and
  `correctBounceRatio = 1.3163`.
- The left setup-side candidate changes `4/8` support probe identities and
  reduces packed-atlas L0 wrong-side ratio from `0.8599` to `0.2763`.
- The right setup-side candidate changes `0/8` probe identities and is rejected
  for no identity change.
- Separate final-irradiance/debug attribution reports scalar, visibility,
  irradiance, and final-irradiance boundary/default ratios of `1`, with verdict
  `candidate-neutralized-by-final-irradiance-debug-node`.

Core rule:

Do not tune constants, increase visibility resolution, add adjacent-bin lookup, or move visibility/probe queries to the biased sample point unless a new candidate preserves all supported gates and lowers the zero-oracle residual. Those families were already tested or rejected.

Next valid product direction:

Keep receiver/probe classification explicit, but prove the representation path
before adding product shape.

The runtime already accepts receiverLayerMask, receiverBoundaryLayerMask, and
receiverBoundaryWeight. TSL uniform, UV-band, and geometry-attribute sources
proved the GPU-resident receiver-source seam, but residual stayed unchanged.
Receiver-side support routing is archived for this gate because tested
candidates reused the same probe identities or normalized away the change.

The active gap is now setup-side representation parity: the left setup-side
candidate changes probe identity and improves packed-atlas L0, but the debug
node still reports neutral final irradiance.

Immediate task slice:

1. Treat `LightProbeGridGPUProbeOwnership.js` as proof-scoped. The Cornell
   example's import from `test/e2e` remains product-shape debt, not a promotion
   precedent.
2. Implement Gate 1 descriptor/debug-path attribution only:
   - default descriptor facts;
   - setup-classified descriptor facts;
   - probe mask source;
   - receiver mask and boundary mask;
   - selected support identity hashes;
   - parity comparison against render guard candidate facts.
3. Keep this read-only and compact: no new runtime option, no public helper, no
   row dumps, no residual-derived tuning.
4. Preserve default behavior when no authored metadata is supplied.
5. If debug and render descriptors differ, record attribution mismatch and move
   to Gate 2 reconstruction attribution.
6. If debug and render descriptors match and final irradiance still stays `1`,
   archive the setup-side coefficient lead as not surviving reconstruction.
7. Reject any candidate that lowers leak by broad darkening, correct-bounce
   suppression, CPU readback, proof pixels, Cornell divider coordinates,
   scalar/WebGL truth, or stale rejected-path payloads.

Expected code seams:

- examples/jsm/lighting/LightProbeGridGPU.js
- examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUVisibility.js
- examples/jsm/lighting/lightprobegridgpu/LightProbeGridGPUConstants.js
- test/e2e/lightprobegridgpu/LightProbeGridGPUProbeOwnership.js
- test/e2e/lightprobegridgpu/LightProbeGridGPUTestHarness.js
- test/e2e/lightprobegrid-gpu-proof-gates.js
- test/e2e/lightprobegrid-gpu-source-invariants.js

Verification:

- For docs only: git diff --check.
- For runtime or harness changes: touched node --check, source invariants, git diff --check, and focused Cornell WebGPU proof smoke only when needed.
- Do not run a full build by default.

Final answer should state:

- What changed.
- Which gate or product-hardening phase it advances.
- What remains open.
- Which checks ran.
```

## Active Slice

Start from the reframed SDD in `test/e2e/lightprobegrid-gpu-authored-boundary-sdd.md`.

The authored receiver-source seam is technically proven but rejected as the
residual fix. Support-set attribution archived receiver-side routing for this
gate. The next concrete work item is Gate 1 descriptor/debug-path attribution
for the setup-side candidate.

Keep the probe ownership helper proof-only until all SDD triage gates pass:

1. Descriptor parity.
2. Reconstruction attribution.
3. Side symmetry.
4. Product seam test.
