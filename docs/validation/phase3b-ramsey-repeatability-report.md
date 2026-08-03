# Phase 3B Ramsey Repeatability Check

## Purpose

This report compares two dense Ramsey measurements on `ibm_kingston` using
the same 21-point delay grid from `0` to `400 us`, physical qubit `150`, and
`256` shots per circuit. The second measurement was intentionally repeated to
test whether the locally inferred `6.7 MHz` detuning is stable on hardware.

No detuning was injected into either QPU circuit, and no production model or
`core/` code was changed.

## Results

| Measurement | Job ID | Calibration time (JST) | Ramsey frequency | T2 | RMSE |
|---|---|---|---:|---:|---:|
| Previous | `d9nl3d6ij12s73fu19kg` | 2026-08-02 22:30 | 6.80 MHz | 390.4 us | 0.0355 |
| Repeat | `d9ntoj460llc73cagtgg` | 2026-08-03 08:48 | 9.55 MHz | 443.9 us | 0.0380 |

The repeated run clearly shows an oscillatory Ramsey trace, with a comparable
single-tone fit residual. However, the fitted frequency shifted by `2.75 MHz`
(about `40%` relative to the first estimate). The same-job readout assignment
span also changed from `1.000` to `0.9805`.

## Interpretation

The evidence supports the following limited conclusion:

1. A Ramsey phase/frequency effect is reproducibly present on the hardware.
2. A fixed `6.7 MHz` detuning is not established by these two runs.
3. The effective frequency may vary with calibration state, frame/reference
   conventions, device drift, or the exploratory fit's sensitivity to the
   sampled trace.
4. The constant-detuning term remains a useful local explanatory diagnostic,
   but must not be promoted to a fixed production parameter.

The result is therefore **qualitative repeatability, quantitative frequency
instability**. More measurements or an explicitly controlled phase-reference
experiment would be required before claiming a stable detuning value.

## Reproduction

```powershell
.\.venv\Scripts\python.exe scripts\analyze_phase3b_ramsey_dense_followup.py `
  --raw validation_hardware\raw\phase3b_ramsey_dense_followup_d9ntoj460llc73cagtgg.json `
  --output validation_results\phase3b_ramsey_dense_repeat_d9ntoj460llc73cagtgg.json
```

## Artifacts

- Raw repeat result: `validation_hardware/raw/phase3b_ramsey_dense_followup_d9ntoj460llc73cagtgg.json`
- Repeat analysis: `validation_results/phase3b_ramsey_dense_repeat_d9ntoj460llc73cagtgg.json`
- Previous analysis: `validation_results/phase3b_ramsey_dense_comparison.json`
- Runner: `scripts/run_phase3b_ramsey_dense_followup.py`
- Analyzer: `scripts/analyze_phase3b_ramsey_dense_followup.py`
