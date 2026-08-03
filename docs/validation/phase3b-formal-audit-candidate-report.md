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

## Ramsey repeatability check

An additional exploratory dense Ramsey measurement was performed after the
formal-audit candidate. It used the same backend, physical qubit, 21-point
`0..400 us` delay grid, and 256 shots per circuit. This was not a formal
holdout and did not modify the frozen model.

- Repeat job: `d9ntoj460llc73cagtgg`
- Fitted frequency: `9.55 MHz`
- Fitted T2: `443.9 us`
- Fit RMSE: `0.0380`
- Previous dense estimate: `6.80 MHz`, `390.4 us`, RMSE `0.0355`

The Ramsey oscillation is qualitatively reproducible, but the fitted frequency
changed by `2.75 MHz`. Therefore the local `6.7 MHz` detuning remains an
explanatory diagnostic only; it is not a stable hardware parameter and has not
been added to the production model. This repeatability result strengthens the
case for a time-dependent or reference-dependent phase effect, but does not
establish quantitative agreement with the frozen model.

## Spin-echo separation check

An exploratory spin-echo job was then executed with the sequence
`H -> delay(t/2) -> X -> delay(t/2) -> H -> measure`, using the same 21-point
grid and 256 shots per circuit.

- Job: `d9o12h8qs0bc73e3v590`
- Readout assignment span: `0.9844`
- The Ramsey-scale `6.8` to `9.55 MHz` oscillation was not recovered as a
  comparable spin-echo oscillation.
- The unconstrained single-tone fit was ill-conditioned (amplitude `3.22`) and
  is not interpreted as a physical frequency measurement.

This is consistent with, but does not prove, cancellation of a quasi-static
detuning or frame-offset contribution by the echo pulse. It does not justify
adding a fixed detuning to the production model and remains exploratory, not
formal holdout evidence.

## Decision

`CANDIDATE_NOT_FORMAL`

The data are useful and internally complete, but the protocol was not committed
before the QPU execution. Therefore this result must not be reported as a
formal holdout pass. It also lacks the required bootstrap confidence intervals
and coverage checks. No production physical parameter was changed.

## Files

- Raw result: `validation_hardware/raw/phase3b_formal_audit_d9nlh5ssfqic73ar6f30.json`
- Analysis: `validation_results/phase3b_formal_audit_analysis.json`
- Ramsey repeatability report: `docs/validation/phase3b-ramsey-repeatability-report.md`
- Ramsey repeat analysis: `validation_results/phase3b_ramsey_dense_repeat_d9ntoj460llc73cagtgg.json`
- Spin-echo report: `docs/validation/phase3b-spin-echo-report.md`
- Spin-echo analysis: `validation_results/phase3b_spin_echo_d9o12h8qs0bc73e3v590.json`
- Protocol: `docs/validation/phase3b-formal-qpu-audit-protocol.md`
