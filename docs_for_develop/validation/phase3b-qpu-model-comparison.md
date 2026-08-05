# Phase 3B QPU / Gate-aware Model Comparison

## Scope

This report compares the completed exploratory QPU pilot with the frozen
gate-aware CPTP model. It is an analysis artifact only: it does not refit the
model, change the API, or make the dataset formal holdout eligible.

## Fixed conditions

| Item | Value |
|---|---|
| Backend | `ibm_kingston` |
| Backend version | `1.0.0` |
| Job | `d9njjeoqs0bc73e3gss0` |
| Physical qubit | `150` |
| Native dt | `4 ns` |
| Calibration snapshot | 2026-08-02 21:26:03 JST |
| QPU shots | 32 per point |
| Model input mode | physical |
| Model T1 | 303.33 us |
| Model T2 | 339.99 us |
| Derived Tphi | 773.459 us |
| Logical H/X duration | 0.02 us |

The Tphi value is derived from `1/T2 = 1/(2*T1) + 1/Tphi`. The model uses
`device_quality=1`, the measured T1/T2-derived profile values, 15 mK, and zero
flux-noise input for this comparison. These are comparison settings, not a
claim that the generic profile is a calibrated hardware model.

## Results

| Case | Maximum absolute difference in P(1) |
|---|---:|
| Readout zero calibration | 0.000 |
| Readout one calibration | 0.031 |
| T1 delay pilot | 0.061 |
| Single-qubit gate plus idle | 0.281 |

The T1 series shows the expected population relaxation trend. The gate-plus-
idle series is exploratory and should not be treated as a pass/fail result.
Its largest difference occurs at 20 us, where the QPU measured `P(1)=0.188`
and the logical-model prediction was `P(1)=0.468`.

## Interpretation

The readout-one difference is consistent with the observed one-shot readout
error (`31/32` measured as one). Readout assignment error is not included in
the gate-aware core model, so this is not a gate-dynamics discrepancy.

For the T1 series, the comparison is qualitatively consistent with relaxation,
but 32 shots per point produce broad binomial uncertainty. The data are not
sufficient for a precise T1 estimate.

The H comparison is not a native pulse-equivalent comparison. The QPU circuit
was transpiled to native SX/RZ gates, while this analysis uses a logical H with
an explicit 0.02 us duration. Native gate durations, pulse shape, calibration
drift, and readout assignment error are not represented by this comparison.

## Reproducibility

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe scripts\analyze_phase3b_qpu_pilot.py
```

Generated data:

- Raw QPU result: `validation_hardware/raw/phase3b_pilot_d9njjeoqs0bc73e3gss0.json`
- Comparison JSON: `validation_results/phase3b_qpu_model_comparison.json`
- Analysis script: `scripts/analyze_phase3b_qpu_pilot.py`

## Decision

This comparison supports the next step of increasing shots and separating
readout calibration from gate dynamics. It does not justify changing the
frozen model, declaring V8 passed, or starting Pulse-level validation.
