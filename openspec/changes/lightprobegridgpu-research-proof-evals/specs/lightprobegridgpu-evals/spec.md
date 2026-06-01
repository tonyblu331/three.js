# Delta for lightprobegridgpu-evals

## ADDED Requirements

### Requirement: Harness Raw Evidence Boundary

LightProbeGridGPU harness diagnostics MUST emit compact raw evidence required by smoke assertions, proof gates, artifacts, or source invariants. They MUST NOT preserve exploratory payload fields only for narrative reporting.

#### Scenario: Consumed fields are preserved

- GIVEN a harness diagnostic field is asserted by a runner or proof gate
- WHEN eval cleanup compacts payloads
- THEN that field remains available with the same meaning

#### Scenario: Unconsumed fields are removed

- GIVEN a payload field has no runner, artifact, proof-gate, or invariant consumer
- WHEN the diagnostic is refactored
- THEN the field is removed instead of moved to another wrapper

### Requirement: Proof Gate Verdict Ownership

Proof verdicts SHOULD be derived in e2e proof-gate code from raw evidence. Harness diagnostics MAY expose capture status only when it is raw availability evidence.

#### Scenario: Gate verdict derives from facts

- GIVEN raw facts for runtime, projection, visibility, or leak proof
- WHEN proof summary is created
- THEN `SUPPORTED` / `OPEN` derives from explicit thresholds or predicates

#### Scenario: Narrative verdict is rejected

- GIVEN a diagnostic returns prose-only confidence or unsupported status text
- WHEN no proof gate consumes it
- THEN cleanup removes it or converts it into a frozen gate

### Requirement: Runtime Boundary Protection

Runtime LightProbeGridGPU code MUST remain free of proof readback and CPU mirror logic.

#### Scenario: Source invariant guards runtime

- GIVEN eval cleanup touches proof or harness files
- WHEN source invariants run
- THEN runtime still has no CPU readback/import boundary leak
