# Phase 3B Gate-Aware QPU Pilot Report

## Decision boundary

This is an operational pilot report, not a formal holdout PASS/FAIL decision.
The observations are permanently excluded from the formal holdout and were not
used to refit the physical model.

## Execution

| Field | Value |
|---|---|
| Provider | IBM Quantum |
| Backend | ibm_kingston |
| Backend version | 1.0.0 |
| Job ID | d9njjeoqs0bc73e3gss0 |
| Native dt | 4 ns |
| Physical qubit | 150 |
| Calibration snapshot | 2026-08-02 12:26:03 UTC |
| Submitted circuits | 12 |
| Shots per circuit | 32 |
| Total shots | 384 |
| Retry | 0 |

The raw result is archived at
validation_hardware/raw/phase3b_pilot_d9njjeoqs0.json.

## Observations

### Readout calibration

| Case | Counts | Estimate |
|---|---|---:|
| prepared 0 | 0: 32 | P(0) = 1.000 |
| prepared 1 | 1: 31, 0: 1 | P(1) = 0.969 |

The pilot observed one 1 -> 0 readout event in 32 shots. This is a
measurement observation, not a calibrated correction model.

### T1 delay pilot

The measured excited-state fractions for delay values
[0, 20, 80, 200, 400] us were:

1.000, 0.875, 0.719, 0.531, 0.313

The overall trend is consistent with excited-state relaxation. The small shot
count is not sufficient for a precise T1 estimate.

### Gate-plus-idle pilot

For H -> delay -> measure, the measured P(1) values were:

0.563, 0.188, 0.313, 0.313, 0.219

These values include gate error, relaxation, readout error, and shot noise.
They are an exploratory observable and are not treated as a monotonic
decoherence curve.

## Interpretation

The pilot confirms that the full submission path worked with the frozen
backend, mapping, native dt, circuit count, and shot budget. The T1 pilot also
shows the expected qualitative relaxation trend.

This result does not establish calibrated hardware predictive validity. It does
not validate the Pulse model, identify microscopic collapse operators, or
constitute a formal V8 holdout result.

## Next action

Do not refit the model from this pilot. First archive the raw provenance and
compare the fixed model against these observables. A later, separately
budgeted run may add Ramsey and Bell cases.
