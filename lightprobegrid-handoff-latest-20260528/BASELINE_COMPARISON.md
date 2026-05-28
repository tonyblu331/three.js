# Baseline comparison summary

| Candidate | Best at | Weak at | Candid verdict |
|---|---|---|---|
| Our WebGPU branch | Proof gates, runtime parity, debug tooling, falsifiability | Final visual quality, real visibility/depth, production-scale numbers | Best engineering proof candidate, not production GI yet. |
| SixteenStudio WebGPU baseline | Demo/product feel, visual communication | Proof harness, leak honesty, DDGI/APV readiness | Best visual/demo candidate, but needs falsifiable gates. |
| WebGL LightProbeGrid reference | Maturity, baseline stability, ergonomics | WebGPU target, DDGI/APV visibility, proof against leakage | Stable reference, wrong final renderer architecture. |

## Score matrix

| Axis | Our WebGPU proof | SixteenStudio | WebGL reference |
|---|---:|---:|---:|
| Runtime maturity | 6.5 | 5.5 | 8.0 |
| Proof/falsifiability | 8.0 | 3.0 | 6.0 |
| Demo/product feel | 5.0 | 8.0 | 7.0 |
| Leak/visibility honesty | 6.0 | 3.5 | 3.0 |
| Upstream ergonomics | 5.5 | 7.0 | 8.5 |
| DDGI/APV readiness | 4.0 | 2.0 | 2.0 |
| Overall | 6.3 | 5.0 | 6.4 |

These scores are engineering assessment, not a published benchmark.
