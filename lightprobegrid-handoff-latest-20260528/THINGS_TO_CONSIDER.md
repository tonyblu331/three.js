# Things to consider / hardening checklist

## Immediate blocker before visibility tuning

The current OPEN blocker is **not** solved by changing radial visibility moments or Chebyshev constants.

Evidence now points to a CPU/GPU receiver sample-position mismatch:

- `finalSceneLinearIndirectStatus = OPEN-FINAL-VISIBLE-COLOR-MAPPING-PRESSURE`
- `finalVisibleSceneLinearMismatchClassifier.dominantMismatchSource = cpu-vs-gpu-sample-position-mismatch`
- `receiverPixelParity.status = OPEN-RECEIVER-PIXEL-CPU-GPU-MISMATCH`
- CPU/GPU scene-linear deltaMean/deltaMax remain above tolerance.

Next work should build a CPU mirror from GPU-read receiver pixel positions (or make CPU quadrature sample exactly the visible receiver pixels) before touching visibility moments, Chebyshev constants, APV/Lumen/RTXGI-style features, screen probes, neural probes, bent AO, log moments, support kernels, sparse residuals, or quantization.

## Concrete next tasks

1. Add a GPU-position-driven CPU mirror for the masked visible receiver pixels used by the runtime scene-linear row.
2. Recompute base probe coordinate, trilinear blend, selected 8 probe indices, scalar/base weights, visibility weights, visibility mass, and RGB irradiance from those GPU-read positions.
3. Only if that closes `finalVisibleProbeOnlySceneLinearCpuAgreement`, revisit final visible material and sealed-wall promotion gates.
4. Keep sealed-wall SUPPORTED only if moment-backed visibility is active, final scene-linear agreement is SUPPORTED, both wrong-side improvement ratios exceed 0.05, and correct-bounce preservation stays >= 0.9.
5. Continue using targeted syntax checks and the WebGPU Cornell e2e only; do not run builds.

## Red flags

- Treating projected CPU surface quadrature samples as equivalent to masked visible receiver pixels without proof.
- Tuning Chebyshev thresholds while CPU/GPU scene-linear agreement is OPEN.
- Promoting sealed-wall rows when either wrong-side improvement ratio is <= 0.05.
- Claiming public DDGI/APV/Lumen/RTXGI parity from this private proof hook.
