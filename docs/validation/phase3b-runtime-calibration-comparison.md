# Phase 3B Runtime Calibration Comparison

## Purpose

This note checks whether the formal-audit candidate discrepancy can be
explained by using an older calibration snapshot. It does not change the
model and does not promote the candidate data to formal holdout status.

## Runtime snapshot

Collected from `ibm_kingston`, physical qubit 150:

- Calibration timestamp: 2026-08-03 08:28:25 JST
- T1: `300.16 us`
- T2: `315.27 us`
- `SX`/`X` gate length: `32 ns`
- `RZ` gate length: `0 ns`
- Readout error: `0.00708`

The formal candidate job used 44 circuits with the following compiled counts:

```text
measure=44, x=22, delay=42, rz=84, sx=42
```

## Comparison

The corrected candidate fits were:

- T1: `392.4 us`
- T2: `437.6 us`
- exploratory Tphi: `989.2 us`

Replacing the older CSV references (`303.33 us`, `339.99 us`) with the runtime
snapshot (`300.16 us`, `315.27 us`) does not resolve the discrepancy:

- T1 95% bootstrap interval: `376.5..407.1 us`
- T2 95% bootstrap interval: `379.5..470.0 us`
- T1 model-point coverage: `14.3%`
- T2 model-point coverage: `47.6%`

## Interpretation

Calibration drift is not the primary explanation for the observed difference.
The remaining comparison gap is likely distributed across native gate
implementation, gate duration/decoherence treatment, readout correction,
thermal-offset assumptions, and the difference between a logical H/X model and
the transpiled `SX/RZ` circuit.

The current gate-aware core supports logical gate evolution and RZ matrices,
but this audit does not yet constitute a pulse-accurate SX/RZ simulation.

## Decision

Do not refit the physical model and do not call the candidate a formal pass.
The next technical task is a local native-equivalent comparison that isolates
the `SX/RZ` decomposition and finite gate intervals before another QPU run.
