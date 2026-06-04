# LightProbeGridGPU Public Non-Claims

These statements must appear before any product, demo, or release note claims
that describe LightProbeGridGPU leak control.

## Non-Claims

- This is not zero-leak global illumination.
- This is not a full DDGI implementation.
- This does not claim scalar/WebGL output is ground truth.
- This does not claim Cornell proof pixels predict arbitrary scenes.
- This does not use CPU readback as runtime leak-control input.
- This does not use Cornell divider coordinates in runtime leak control.
- This does not replace authored scene, receiver, or probe metadata.

## Allowed Claim Shape

LightProbeGridGPU may claim a GPU-resident authored receiver/probe metadata seam
for reducing known residual-risk cases only after the relevant proof gates pass.
Any claim must name the proof boundary, preserve correct bounce, and state the
known residual cases.

## Demo Copy Guard

Demo copy may say "proof-gated leak reduction experiment" or "authored metadata
seam under test." It must not say "solves light leaks", "physically correct",
"DDGI equivalent", or "Cornell-proven for production scenes".
