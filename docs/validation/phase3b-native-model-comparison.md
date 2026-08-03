# Phase 3B Native Model Comparison

## Purpose

This is a local comparison between the formal-audit QPU result and a
native-inspired CPTP sequence. It does not modify `core/` or add a new physics
feature.

## Native assumptions

- `SX` is represented by `RX(pi/2)` up to global phase.
- `X` is represented by `RX(pi)`.
- `SX/X` duration is the runtime calibration value `32 ns`.
- `RZ` is virtual and has zero duration.
- Idle evolution uses the runtime T1/T2 calibration snapshot.
- Readout is corrected using the same-job calibration.
- Native pulse shape and calibration error channels are not modeled. A local
  detuning-only diagnostic is evaluated separately below; it is not part of
  the frozen production model.

## Results

| Sequence | Points | Maximum absolute difference | Mean absolute difference |
|---|---:|---:|---:|
| T1: X + idle | 21 | 0.108 | 0.059 |
| Ramsey: H + idle + H | 21 | 0.764 | 0.290 |

The native duration substitution does not remove the T1 discrepancy. The
Ramsey discrepancy is substantially larger because the QPU data contain an
approximately `6.7 MHz` oscillation while the local comparison has no detuning
or phase-accumulation term during idle.

## Local detuning diagnostic

A scan of a constant idle detuning was performed without submitting another
QPU job. The diagnostic adds an idle Hamiltonian

`H_detuning = (delta / 2) Z`

where `delta` is expressed as cycles per microsecond after conversion to
angular frequency. The scan used `0` to `10 MHz` in `0.1 MHz` increments.

| Diagnostic | Value |
|---|---:|
| Zero-detuning Ramsey RMSE | 0.374 |
| Best detuning | 6.7 MHz |
| Best-detuning Ramsey RMSE | 0.030 |

This substantially improves the local Ramsey trace and is consistent with the
frequency obtained from the exploratory damped-oscillation fit. It supports a
detuning/frame-offset interpretation of the observed Ramsey oscillation. It
does not establish that the offset is constant on hardware, nor does it
validate the pulse shape or gate-error model.

## Interpretation

The current evidence points to at least two separate issues:

1. T1: remaining differences are distributed among finite gate evolution,
   gate error, readout uncertainty, calibration drift, and fit assumptions.
2. Ramsey/T2: a frequency/phase model is required; native gate duration alone
   cannot reproduce the observed oscillation. A local constant-detuning term
   reproduces the oscillation frequency as a diagnostic, but requires further
   validation before becoming a production input.

This is diagnostic evidence, not a justification for changing the frozen model
or declaring the QPU audit passed. The next model investigation should test a
detuning/quasi-static phase term locally before another QPU job.

## Reproducibility

```powershell
.\.venv\Scripts\python.exe scripts\compare_phase3b_native_model.py
```

Files:

- `scripts/compare_phase3b_native_model.py`
- `validation_results/phase3b_native_model_comparison.json`
- `validation_results/phase3b_runtime_calibration.json`

The detuning scan and its result are stored in
`validation_results/phase3b_native_model_comparison.json` under
`detuning_scan`.
