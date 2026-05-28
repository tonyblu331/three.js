# LightProbeGridGPU latest handoff — receiver-pixel scene-linear proof audit

Generated: 2026-05-28T10:53:31.573Z  
Branch: codex/runtime-lightprobe  
Commit: d04ad18988  
Workspace: G:/Antonio Bonet/three.js

## Executive summary

This package is a candid proof handoff, not a victory lap.

What is real now:

- Strict proof gates prevent disabled/missing visibility moments from being labeled as moment-backed.
- Private radial visibility moments are active: available=true, mode=moments, encoding=radial-distance, bytes=32768, finite samples=7, hit samples=4.
- Visibility label/status are derived from evidence: visibility-moments / SUPPORTED.
- DDGI-lite private moment status: IMPLEMENTED-PRIVATE-DDGI-LITE-MOMENTS.
- Final-color debug targets exist: directOnly=true, indirectOnlySceneLinear=true, indirectAfterAlbedo=true, finalBeforeToneMapping=true, finalAfterToneMapping=true, receiverMaskOverlay=true.
- Runtime-equivalent probe-indirect scene-linear comparison uses `runtime-probe-indirect-scene-linear`.
- New receiver-pixel parity diagnostics compare projected CPU quadrature samples against GPU/debug position, normal, probe coordinate/blend, selected probes, weights, visibility mass, and RGB irradiance terms.
- The mask pass is now depth-preserved: non-receiver meshes render black and keep depth so mask pixels refer to the same visible fragments as the color pass.
- Compute projection parity remains reported as passing; timing evidence is wall-clock-or-static-work-only.
- SH guard metadata is emitted: enabled=true, correctionStrengthMax=0.0076, negative pressure 0.0076 -> 0, L00 preserved=true.

What remains open:

- Final scene-linear indirect mapping status is `OPEN-FINAL-VISIBLE-COLOR-MAPPING-PRESSURE`; CPU/GPU deltaMean=1.3524, deltaMax=1.352, tolerance=0.15.
- Dominant mismatch source is `cpu-vs-gpu-sample-position-mismatch`; classifier=OPEN-RUNTIME-PROBE-INDIRECT-CPU-SH-MISMATCH.
- Receiver-pixel parity status is `OPEN-RECEIVER-PIXEL-CPU-GPU-MISMATCH`. Max sample-position grid delta=0.9751, max normal-encoded delta=0.9623, selected-probe mismatches=144, max linear irradiance delta=0.0249.
- Final visible material gate: `OPEN-FINAL-VISIBLE-BSDF-PRESSURE`. Final visible Lambert debug does not match the standard material linear-output path closely enough; inspect BSDF/light-node integration before tuning visibility thresholds.
- Sealed-wall status is `OPEN`; wrong-side improvement=-0.0251, masked wrong-side improvement=-0.0281, correct-bounce preservation=0.9755.
- Sealed-wall blockers: final scene-linear indirect CPU/GPU agreement is not supported; visibilityWrongSideImprovementRatio <= 0.05; visibilityMaskedWrongSideImprovementRatio <= 0.05.
- This is still a proof-scoped private path, not public APV/DDGI/Lumen parity.
- No build was executed because AGENTS.md says never build after changes.

## Verification run

- Command: `node test/e2e/puppeteer.js --webgpu webgpu_lightprobes_cornell`
- Result: passed, 34 smoke checks.
- TEMP/TMP were redirected to workspace `.tmp-puppeteer`.
- Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`.

## Included artifacts

- `artifacts/proof-report.json` — regenerated evidence report.
- `artifacts/proof-table.md` — regenerated proof table.
- `latest-runtime-profile.json` — compact summary of current gates.
- `screenshots/*.png` — latest proof screenshots copied from the verifier artifact directory when regenerated; legacy comparison screenshots remain when the current e2e does not re-emit them.

## Candid reading

The branch now proves the old aggregate explanation was too coarse. The scene-linear row still does **not** agree with CPU surface attribution, but the added receiver-pixel diagnostics point at a specific remaining problem: the CPU quadrature samples are projected to pixels whose GPU/debug world position, normal, base probe coordinate, blend, selected probe indices, and weights do not match the CPU sample assumptions. SH RGB evaluation itself is comparatively bounded (`maxLinearIrradianceDelta=0.0249`).

So: do **not** tune visibility moments or Chebyshev constants yet. The next closure step is to build the CPU mirror from GPU-read receiver pixel positions, or otherwise make the CPU sample set match the exact visible receiver pixels used by the scene-linear aggregate.
