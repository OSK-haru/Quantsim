# Phase 3B Dense Ramsey Follow-up

## Execution

- Backend: `ibm_kingston` v`1.0.0`
- Job ID: `d9nl3d6ij12s73fu19kg`
- Physical qubit: `150`
- Circuits: 23
- Ramsey points: 21
- Delay range: `0..400 us` in `20 us` increments
- Shots: 256 per circuit, 5,888 total
- Formal holdout: no
- Model refit: no

## Same-job readout calibration

- `P(observed 1 | prepared 0) = 0.000`
- `P(observed 1 | prepared 1) = 1.000`

The assignment span was 1.000 for this job.

## Damped oscillation fit

The corrected Ramsey contrast was fitted with

```text
C(t) = A exp(-t/T2) cos(2 pi f t + phase)
```

| Quantity | Estimate |
|---|---:|
| Frequency | `0.006800 cycles/us` = `6.800 kHz` |
| T2 | `390.4 us` |
| Amplitude | `0.996` |
| Phase | `-0.0934 rad` |
| RMSE | `0.0355` |

The 21-point series supports the oscillatory fit much better than the earlier
five-point series. However, the next-best grid candidates have RMSE values
`0.03546`, `0.03554`, `0.03558`, and `0.03573`, so frequency and T2 are still
not tightly identified by this single experiment. No confidence interval is
claimed.

Using the previous readout-corrected T1 estimate `360.5 us`, the formal relation
would give an exploratory `Tphi = 851.6 us`. This value is not frozen because
the Ramsey fit is still exploratory.

## Interpretation

The dense measurement successfully resolved a repeatable oscillatory Ramsey
pattern and made a damped-oscillation fit possible. The next rigorous step is
to repeat the Ramsey sequence with phase cycling or a deliberate detuning/
frequency sweep, then fit a confidence interval rather than selecting one grid
minimum.

## Reproducibility

```powershell
.\.venv\Scripts\python.exe scripts\analyze_phase3b_ramsey_dense_followup.py
```

Files:

- `validation_hardware/raw/phase3b_ramsey_dense_followup_d9nl3d6ij12s73fu19kg.json`
- `validation_results/phase3b_ramsey_dense_comparison.json`
- `scripts/run_phase3b_ramsey_dense_followup.py`
- `scripts/analyze_phase3b_ramsey_dense_followup.py`
