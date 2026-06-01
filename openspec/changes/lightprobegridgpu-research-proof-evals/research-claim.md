# Research Claim: LightProbeGridGPU Research-Proof Evals

## Claim

For LightProbeGridGPU diagnostics, the candidate eval structure wins over the current mixed diagnostic/proof payloads only if proof verdicts derive from frozen gates, raw facts stay compact, runtime remains GPU-resident, and no asserted evidence is lost.

## Verifier Boundary

- Inputs: smoke harness results, compact proof facts, source text invariants.
- Evaluator: `test/e2e/lightprobegrid-gpu-proof-gates.js`, runner assertions, source invariants.
- Mutable artifacts: harness diagnostics, visibility study facts, proof gate definitions.
- Forbidden: runtime CPU readback, full-build claims, narrative-only proof status.
- Review authority: no-build checks plus explicit peer review before broad refactor.

## Baseline / Candidate Family

- Baseline: harness diagnostics return mixed facts, statuses, and explanatory payloads.
- Candidate: harness returns raw facts; proof gates own verdicts and rejection reasons.

## Current Evidence

- Compact proof gates already exist.
- Current diff removed unconsumed profiler fields and duplicate escape-count families.
- Remaining harness still contains verdict-like status payloads in several diagnostics.

## Enemy Terms

Evaluator hacking, duplicate-case inflation, narrative certainty, hidden runtime readback, uncharged benchmark cost, exploratory payload kept as proof, and file splitting that only moves bloat.

## Rejection Gates

- Reject if a `SUPPORTED`/`OPEN` verdict is introduced outside proof gates without a runner/assertion reason.
- Reject if removed payload is consumed by artifacts, source invariants, or runner assertions.
- Reject if cleanup adds a thin pass-through module with no ownership gain.
- Reject if runtime imports proof/readback helpers.

## Proof Ladder / Transfer Path

Fixed-harness research loop: preserve raw evidence, freeze gates, remove narrative payload, run no-build checks. Transfer only after compact gates remain readable and source invariants pass.

## Verdict

OPEN: direction is supported, but the ownership boundary is not fully frozen yet.

## Proof Ledger Decision

CONTINUE with SDD tasks before more code edits.

## Next Pressure

Move one verdict-like diagnostic status into proof-gate ownership or prove it must remain raw evidence.
