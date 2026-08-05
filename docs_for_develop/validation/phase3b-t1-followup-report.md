# Phase 3B T1 Follow-up

## Execution

- Backend: `ibm_kingston` v`1.0.0`
- Job ID: `d9nke9c60llc73ca7460`
- Physical qubit: `150`
- Native dt: `4 ns`
- Calibration timestamp: 2026-08-02 21:55:24 JST
- Points: 0, 20, 80, 200, 400 us
- Shots: 256 per point, 1,280 total
- Formal holdout: no
- Model refit: no

All five count totals equal 256.

## Observed populations

| Delay (us) | Measured P(1) | Model P(1) |
|---:|---:|---:|
| 0 | 0.996 | 1.000 |
| 20 | 0.961 | 0.936 |
| 80 | 0.797 | 0.768 |
| 200 | 0.574 | 0.517 |
| 400 | 0.375 | 0.267 |

The corrected log-linear fit uses the earlier prepared-|1> readout estimate
`P(1)=31/32` and gives:

- fitted `T1 = 409.9 us`
- log-population RMSE: `0.0261`
- model calibration comparison value: `303.33 us`

The fitted value is higher than the calibration CSV value. This is an
observation for follow-up, not a reason to refit the model. Possible causes
include calibration drift, readout correction uncertainty, the finite X-gate
duration, and the simplified no-thermal-offset fit. A future formal run should
measure readout calibration in the same job and include enough points/shots for
confidence intervals.

## Reproducibility

```powershell
.\.venv\Scripts\python.exe scripts\analyze_phase3b_qpu_pilot.py `
  --raw validation_hardware\raw\phase3b_t1_followup_d9nke9c60llc73ca7460.json `
  --output validation_results\phase3b_t1_followup_comparison.json
```

Files:

- `validation_hardware/raw/phase3b_t1_followup_d9nke9c60llc73ca7460.json`
- `validation_results/phase3b_t1_followup_comparison.json`
- `scripts/analyze_phase3b_qpu_pilot.py`
