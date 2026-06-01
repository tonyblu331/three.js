# Design: LightProbeGridGPU Research-Proof Evals

## Technical Approach

Keep the existing smoke harness shape, but sharpen ownership: harness modules capture raw evidence, runner assertions validate evidence shape, proof gates derive verdicts, and artifacts serialize compact summaries.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Verdict ownership | `test/e2e/lightprobegrid-gpu-proof-gates.js` derives proof verdicts | Status prose scattered in harness diagnostics | Freezes falsifiable gates and prevents narrative proof drift. |
| Evidence capture | Keep proof-only readback in harness/diagnostics modules | Runtime readback or public API hooks | Preserves GPU-resident runtime boundary. |
| Abstraction style | Local helpers only when they delete repeated lifecycle/payload logic | Thin pass-through modules | KISS/YAGNI; ownership matters more than file count. |
| Verification | No-build checks only | `npm run build` | Matches current refactor stream constraints. |

## Data Flow

```text
LightProbeGridGPUTestHarness / diagnostics
  -> raw compact facts
  -> runner assertions validate shape
  -> proof-gates derive SUPPORTED/OPEN
  -> artifacts write compact proof-summary.json
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `examples/jsm/lighting/LightProbeGridGPUTestHarness.js` | Modify | Remove unconsumed payload and consolidate repeated proof lifecycle where it truly deletes concepts. |
| `examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js` | Modify | Keep only receiver evidence consumed by visibility/SH/surface diagnostics and gates. |
| `test/e2e/lightprobegrid-gpu-proof-gates.js` | Modify | Centralize verdict thresholds and rejection reasons. |
| `test/e2e/lightprobegrid-gpu-runner-*.js` | Modify | Assert compact raw fact contracts. |
| `lightprobegrid-gpu-refactor-plan.md` | Modify | Keep roadmap current and short. |

## Interfaces / Contracts

Raw fact objects SHOULD include measured values and availability flags. Gate objects include `id`, `subject`, `metric`, `actual`, `expected`, `status`, `reason`, and optional `evidenceRef`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Syntax | touched JS files parse | `node --check` |
| Boundary | runtime remains GPU-resident | `checkSmokeSourceInvariants(...)` |
| Diff hygiene | no whitespace/errors | `git diff --check` |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] Which remaining harness `status` fields are raw availability evidence versus verdicts that belong in proof gates?
