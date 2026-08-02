# Phase 3B Formal Audit Candidate Report

## Execution

- Job ID: `d9nlh5ssfqic73ar6f30`
- Backend: `ibm_kingston` v`1.0.0`
- Physical qubit: `150`
- Circuits: 44
- Shots: 1,024 per circuit, 45,056 total
- Native dt: `4 ns`
- Protocol committed before execution: **No**
- Formal holdout eligible: **No**
- Model refit: **No**

## Readout calibration

The same job measured:

- `P(observed 1 | prepared 0) = 0.00488`
- `P(observed 1 | prepared 1) = 0.98730`
- assignment span: `0.98242`

All 44 circuits returned exactly 1,024 shots.

## Dynamics fits

### T1

The readout-corrected `X -> delay -> measure` series gave:

- fitted `T1 = 392.4 us`
- initial fitted population: `0.975`
- log-population RMSE: `0.0293`
- model reference: `303.33 us`

### Ramsey / T2

The damped single-tone fit gave:

- frequency: `6.7 MHz`
- fitted `T2 = 437.6 us`
- amplitude: `0.969`
- phase: `0.00031 rad`
- RMSE: `0.0229`

The next-best grid candidates had RMSE values close to the minimum, so the
frequency/T2 pair remains exploratory without bootstrap confidence intervals.

Using the fitted T1, the exploratory relation
`1/Tphi = 1/T2 - 1/(2*T1)` gives `Tphi = 989.2 us`.

## Bootstrap analysis

Using 200 deterministic binomial bootstrap replicates, including the same-job
readout calibration:

- T1 95% interval: `376.5..407.1 us`
- T2 95% interval: `379.5..470.0 us`
- T1 model-point coverage: `14.3%`
- T2 model-point coverage: `57.1%`
- T1 compatibility with the `303.33 us` reference: no
- T2 compatibility with the `339.99 us` reference: no

The statistical evidence is therefore `CONDITIONAL_PASS` at most, and does not
support a full model pass. The outer audit decision remains
`CANDIDATE_NOT_FORMAL` because the protocol was not committed before execution.

## Decision

`CANDIDATE_NOT_FORMAL`

The data are useful and internally complete, but the protocol was not committed
before the QPU execution. Therefore this result must not be reported as a
formal holdout pass. It also lacks the required bootstrap confidence intervals
and coverage checks. No production physical parameter was changed.

## Files

- Raw result: `validation_hardware/raw/phase3b_formal_audit_d9nlh5ssfqic73ar6f30.json`
- Analysis: `validation_results/phase3b_formal_audit_analysis.json`
- Protocol: `docs/validation/phase3b-formal-qpu-audit-protocol.md`
