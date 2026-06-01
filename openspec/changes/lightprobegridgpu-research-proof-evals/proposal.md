# Proposal: LightProbeGridGPU Research-Proof Evals

## Intent

Make LightProbeGridGPU evals falsifiable and maintainable: harnesses emit compact raw facts, proof gates derive verdicts, and default artifacts stop carrying exploratory narrative payload.

## Scope

### In Scope
- Freeze raw-evidence vs verdict ownership for LightProbeGridGPU diagnostics.
- Compact profiler, visibility, leak, and proof-gate payloads to consumed fields.
- Keep no-build verification narrow and repeatable.

### Out of Scope
- Production DDGI/APV parity.
- Runtime behavior changes outside proof-backed gates.
- Full build or broad benchmark claims.

## Capabilities

### New Capabilities
- `lightprobegridgpu-evals`: falsifiable eval contract for LightProbeGridGPU proof diagnostics.

### Modified Capabilities
- None.

## Approach

Use research-proof discipline: baseline/candidate facts are captured in harnesses; rejection gates live in e2e proof files; compact artifacts summarize gate verdicts only.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `examples/jsm/lighting/LightProbeGridGPUTestHarness.js` | Modified | Emit compact raw facts and reduce lifecycle duplication. |
| `examples/jsm/lighting/LightProbeGridGPUVisibilityWeightingStudy.js` | Modified | Keep receiver evidence consumed by gates/diagnostics only. |
| `test/e2e/lightprobegrid-gpu-proof-gates.js` | Modified | Own verdict derivation and rejection gates. |
| `test/e2e/lightprobegrid-gpu-runner-*.js` | Modified | Assert frozen raw fact shape and compact contract. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Deleting useful evidence | Medium | Search consumers before removal; preserve gate inputs. |
| Hiding gate intent behind abstraction | Medium | Keep proof-gate definitions explicit and data-driven only where repeated. |
| Runtime/proof boundary leak | Low | Source invariants must pass. |

## Rollback Plan

Revert this change folder and touched diagnostics/proof files; no data migration exists.

## Dependencies

- Existing LightProbeGridGPU smoke harness and source invariant checks.

## Success Criteria

- [ ] Harness diagnostics return compact facts, not narrative verdict payloads.
- [ ] Proof gates derive `SUPPORTED` / `OPEN` from raw evidence.
- [ ] No CPU readback enters runtime.
- [ ] Narrow no-build checks pass.
