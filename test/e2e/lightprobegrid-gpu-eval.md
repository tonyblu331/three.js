# LightProbeGridGPU Eval Harness

This harness exercises the canonical LightProbeGridGPU runtime with Cornell
sealed-wall checks and Sponza render controls.

## Examples

- `examples/webgpu_lightprobes_cornell.html`
  - default: `ours-cornell`
  - `?implementation=sixteenstudio`: `ours-cornell-legacy-query`
- `examples/webgpu_lightprobes_sponza.html`
  - `ours-sponza-control`
- `examples/webgpu_lightprobes_sponza_ours.html`
  - `ours-sponza`
- `examples/webgpu_lightprobes_compare.html`
  - tabbed local comparison page for Cornell and Sponza variants

## Running

```sh
node test/e2e/puppeteer.js --webgpu webgpu_lightprobes_cornell webgpu_lightprobes_cornell_sixteenstudio webgpu_lightprobes_sponza webgpu_lightprobes_sponza_ours
```

The common eval artifact is written to:

```text
%TEMP%/codex-threejs-lightprobegrid-common-eval/comparison.json
```

## Metric Sources

- `sealed-wall-proof` rows come from the Cornell proof harness and include
  validity-weighted and visibility-moments leak ratios.
- Sponza rows are visual/runtime controls and do not expose sealed-wall leak
  proof ratios.
- The legacy Cornell query renders through the canonical runtime; it is retained
  only for old smoke harness compatibility.

## Residual Research

- `test/e2e/lightprobegrid-gpu-residual-research.md` records the current open
  sealed-wall residual gate, source-backed leak-control research, bottlenecks,
  and the next valid receiver-boundary candidate shape.
- `test/e2e/lightprobegrid-gpu-math-whiteboard.md` extracts the current gates
  into their core reconstruction, visibility, ownership, and residual math.
- `test/e2e/lightprobegrid-gpu-product-roadmap.md` records the peer-review
  contrast, product architecture, hardening phases, and task list.
- `test/e2e/lightprobegrid-gpu-product-metaprompt.md` records the continuation
  prompt for starting the hardening tasks without losing proof context.
- `test/e2e/lightprobegrid-gpu-authored-boundary-sdd.md` records the active
  SDD plan for the authored receiver-boundary source slice.
