# LightProbeGridGPU Eval Harness

This harness compares the Cornell sealed-wall proof implementation with the
SixteenStudio reference grid and provides Sponza render controls for both paths.

## Examples

- `examples/webgpu_lightprobes_cornell.html`
  - default: `ours-cornell-proof`
  - `?implementation=sixteenstudio`: `sixteenstudio-reference-cornell`
- `examples/webgpu_lightprobes_sponza.html`
  - `sixteenstudio-reference-sponza`
- `examples/webgpu_lightprobes_sponza_ours.html`
  - `ours-sponza-proof`
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
- The SixteenStudio Cornell control can render the Cornell fixture, but its
  sealed-wall rows are currently backed by the proof delegate for instrumentation.
