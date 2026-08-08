# VALIDATION-8: Real-Hardware Observable Validation

> **Unit correction (Ramsey/detuning frequencies)**
>
> Ramsey and detuning frequencies in the Phase 3B reports were previously
> labelled `MHz` but the underlying values are in `kHz`. The analysis code
> emitted `cycles_per_us * 1000.0` under the field name `detuning_mhz`;
> because `cycles/us` is numerically identical to `MHz`, that scaled value is
> `kHz`, not `MHz`. The numbers themselves were always correct — only the unit
> label was wrong by a factor of 1000.
>
> All Phase 3B reports now read `kHz`, the field is now `detuning_khz` in
> `scripts/compare_phase3b_native_model.py`, and
> `validation_results/phase3b_native_model_comparison.json` has been
> regenerated. The regenerated artifact is byte-identical to the previous one
> apart from that field name — no measured or fitted value changed. The
> unaffected field `detuning_cycles_per_us` remains authoritative.
>
> The kHz reading is also the physically consistent one: the delay grid spacing
> is 20 us, so the Nyquist limit is 25 kHz. A 6.7 MHz oscillation (0.15 us
> period) could not be resolved on that grid, while 6.7 kHz (about 149 us
> period) fits roughly 2.7 cycles into the 400 us window.

## Status

**Exploratory hardware validation complete; formal QPU holdout PASS not
established.**

The gate-aware CPTP model is frozen at
`yuragi-strider-gate-aware-cptp-v1`. The QPU measurements are evidence about
observable hardware behavior, not a replacement for the local numerical and
QuTiP audits.

## Scope

This audit evaluates whether the frozen gate-aware open-system model produces
the right kind of observable behavior for small circuits. It does not claim to
calibrate or reproduce a particular IBM device.

The hardware measurements used:

- Backend: `ibm_kingston` v`1.0.0`
- Physical qubit: `150`
- Native `dt`: `4 ns`
- Measurement: computational-basis Z readout
- Same-job readout calibration
- Ramsey and spin-echo delay grid: `0..400 us`, 21 points

## Evidence layers

### Numerical and QuTiP evidence

The explicit CPTP path has been compared with QuTiP using matching Hamiltonian
and collapse-operator matrices. Python/Rust parity and refinement behavior were
also tested for the registered cases.

This supports the following limited claim:

> The implemented equations and tested CPTP discretization agree with the
> reference calculation within the registered test scope.

It does not establish hardware calibration.

### QPU observable evidence

The formal-audit candidate and follow-up jobs produced the following evidence:

- T1 and Ramsey population traces were measurable with complete shot counts.
- Ramsey oscillations were observed in the first dense run at approximately
  `6.80 kHz` and in the repeat run at approximately `9.55 kHz`.
- Spin echo did not recover a comparable Ramsey-scale oscillation.
- The Ramsey frequency was therefore qualitatively reproducible as an
  oscillatory phase effect, but not quantitatively stable as one fixed
  detuning value.

The spin-echo observation is consistent with a quasi-static detuning or frame
offset contribution being refocused. It does not prove that interpretation;
time-dependent drift, pulse errors, and fit identifiability remain possible.

## Formal decision

`CANDIDATE_NOT_FORMAL`

The QPU candidate is not a formal holdout pass because the formal protocol and
holdout provenance conditions were not satisfied before that execution, and
the frozen-model predictive compatibility checks did not pass. The later
Ramsey repeat and spin-echo measurements are exploratory follow-ups and do not
retroactively change that decision.

## Claims supported by this audit

- The simulator's gate-aware dynamics are numerically and reference-model
  consistent within the tested local scope.
- Real hardware exhibits measurable relaxation and phase evolution that can be
  studied with the selected circuits.
- Ramsey phase oscillations and their partial suppression by spin echo were
  observed on the selected device and qubit.
- A fixed detuning is not sufficient as a stable hardware parameter based on
  the available runs.

## Claims not supported

- The model quantitatively reproduces `ibm_kingston` or physical qubit 150.
- `6.7 kHz` or `9.55 kHz` is a device-independent or stable detuning value.
- Pulse shape, gate error, frame reference, drift, and SPAM effects have been
  fully separated.
- The QPU audit is a formal PASS.
- The simulator is a calibrated hardware predictor.

## Model policy after V8

No fixed detuning is added to the production model. The detuning-only local
calculation remains a diagnostic tool. The spin-echo result is recorded as
hardware evidence and does not change the frozen Gate-aware CPTP equations.

## Artifacts

- [Formal audit candidate report](phase3b-formal-audit-candidate-report.md)
- [Ramsey repeatability report](phase3b-ramsey-repeatability-report.md)
- [Spin-echo report](phase3b-spin-echo-report.md)
- [Native model comparison](phase3b-native-model-comparison.md)
- [QuTiP CPTP comparison](cptp-qutip-comparison.md)
- Freeze commit: `badb128`
- Freeze tag: `yuragi-strider-phase3b-qpu-observability-v1`

## Next validation option

If additional QPU time becomes available, phase cycling or a bounded-contrast
spin-echo analysis should be preregistered before execution. It should be
treated as a new exploratory protocol, not as a retroactive formal pass.
