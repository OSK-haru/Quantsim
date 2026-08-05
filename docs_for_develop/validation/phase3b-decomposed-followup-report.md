# Phase 3B Decomposed Follow-up Report

## Execution

- Backend: `ibm_kingston` v`1.0.0`
- Job ID: `d9nki08qs0bc73e3ht8g`
- Physical qubit: `150`
- Native dt: `4 ns`
- Circuits: 13
- Shots: 256 per circuit, 3,328 total
- Formal holdout: no
- Model refit: no

## Component results

### Readout

The same job measured:

- `P(observed 1 | prepared 0) = 0.000`
- `P(observed 1 | prepared 1) = 0.9922`

The assignment span used for correction was `0.9922`.

### X preparation

The readout-corrected `X -> measure` result was `P(1) = 1.000`. This indicates
that, at this shot count, preparation and immediate readout errors are small
for the selected qubit. It does not isolate the finite X-gate dissipation from
the preparation amplitude.

### T1

The readout-corrected exponential fit to `X -> delay -> measure` gave:

- fitted `T1 = 360.5 us`
- initial fitted population: `0.984`
- log-population RMSE: `0.0206`
- calibration reference: `303.33 us`

This is a more controlled estimate than the earlier separate follow-up because
the readout calibration was collected in the same job. The remaining difference
can still include the finite X-gate interval, calibration drift, and the
simplified fit model.

### Ramsey / T2

The `H -> delay -> H -> measure` series showed sign-changing Ramsey contrast:

| Delay (us) | Corrected P(1) | Contrast `1 - 2P(1)` |
|---:|---:|---:|
| 0 | 0.004 | 0.992 |
| 20 | 0.165 | 0.669 |
| 80 | 0.890 | -0.780 |
| 200 | 0.445 | 0.110 |
| 400 | 0.654 | -0.307 |

A simple exponential T2 fit is therefore invalid. An exploratory damped-
oscillation fit gave:

- frequency: `0.006083 cycles/us` (`6.083 kHz`)
- T2: `347.4 us`
- amplitude: `0.993`
- phase: `0.0136 rad`
- RMSE: `0.0090`

This fit follows
`C(t)=A exp(-t/T2) cos(2 pi f t + phase)`. The five points do not establish a
unique frequency/T2 pair; the next-best grid candidates have RMSE values
`0.0168`, `0.0250`, `0.0332`, and `0.0458`. Therefore this is an exploratory
fit, not a formal T2/Tphi estimate. No Tphi value is reported from this run.

## Conclusion

The decomposition successfully separated readout calibration and gave a
better-controlled T1 estimate. It also revealed that the proposed Ramsey
analysis must include oscillation phase/frequency rather than fitting a pure
exponential. No physics parameters were changed based on these results.

## Reproducibility

```powershell
.\.venv\Scripts\python.exe scripts\analyze_phase3b_decomposed_followup.py
```

Files:

- `validation_hardware/raw/phase3b_decomposed_followup_d9nki08qs0bc73e3ht8g.json`
- `validation_results/phase3b_decomposed_comparison.json`
- `scripts/run_phase3b_decomposed_followup.py`
- `scripts/analyze_phase3b_decomposed_followup.py`
