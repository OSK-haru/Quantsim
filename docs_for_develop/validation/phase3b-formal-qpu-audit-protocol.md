# Phase 3B Formal QPU Audit Protocol

## Purpose

This protocol defines the formal holdout audit for the frozen gate-aware CPTP
model. It is not an execution record. No QPU result is formal until this
protocol is frozen, the holdout data are collected, and the analysis is run
without changing the model.

## Frozen model

- Freeze tag: `yuragi-strider-gate-aware-cptp-v1`
- Freeze commit: `f306fbf6eb2083d9098ab0ade079e2681920ac4e`
- Backend: `ibm_kingston`
- Physical qubit: `150`
- Measurement basis: computational Z
- Input mode: physical
- No model refit after holdout collection

The backend calibration timestamp and software versions must be recorded at
execution time. If the backend version or native `dt` differs from the frozen
selection, the run is invalid and must not be labelled formal.

## Circuit protocol

Readout calibration is collected in the same job as the dynamics:

1. `|0> -> measure`
2. `X -> measure`

T1 series:

```text
X -> delay(t) -> measure
```

T2/Ramsey series:

```text
H -> delay(t) -> H -> measure
```

The delay grid is `0, 20, 40, ..., 400 us`, represented in backend `dt`.
The formal run uses at least 1024 shots per circuit. If provider limits make
that impossible, the run remains exploratory and cannot be promoted silently.

## Analysis lock

The following analysis is fixed before inspecting formal holdout results:

1. Estimate the two readout probabilities from the same job.
2. Apply the affine readout correction to the T1 and Ramsey populations.
3. Fit T1 with a population decay model including a thermal equilibrium
   offset if the data support it.
4. Fit Ramsey contrast with a damped oscillation including amplitude, phase,
   frequency, and T2.
5. Derive Tphi only when T1 and T2 fits are statistically valid:

   ```text
   1/Tphi = 1/T2 - 1/(2*T1)
   ```

6. Use bootstrap confidence intervals that resample shot counts and preserve
   the readout-calibration uncertainty.
7. Compare the frozen model curve and fitted parameters without modifying the
   model or selecting a more favourable subset of points.

## Acceptance criteria

The formal report must state the criteria before the result is labelled.

### PASS

All of the following hold:

- all circuits have the planned shot count and complete provenance;
- readout calibration is valid and its correction matrix is non-singular;
- the T1 and Ramsey fits pass their predeclared residual/coverage checks;
- the 95% confidence interval for the frozen-model prediction contains the
  corrected observation at at least 90% of the planned delay points for both
  T1 and Ramsey;
- the fitted T1 and T2 are compatible with the frozen comparison values under
  the predeclared 95% parameter-compatibility rule;
- no model refit or post-hoc protocol change occurred.

### CONDITIONAL PASS

The data and fits are valid, but one component is underpowered or only one of
T1/T2 passes. The report must identify the failing component and must not claim
full model validation.

### FAIL

Any provenance failure, invalid readout correction, invalid fit, systematic
disagreement beyond the predeclared rule, or post-hoc model adjustment causes
failure.

The numerical thresholds above are audit thresholds, not physical laws. They
must not be relaxed after seeing the holdout data.

## Holdout status policy

The data are formal holdout eligible only when:

- the protocol file is committed;
- the formal manifest records the exact protocol revision;
- the model freeze commit matches;
- the QPU job is executed after the protocol freeze;
- the raw result is archived without editing;
- the analysis script version is recorded.

The current pilot and all previous follow-ups remain exploratory:
`formal_holdout_eligible: false`.

## Required report outputs

- raw provider result;
- backend version, native `dt`, calibration timestamp, and physical qubit;
- readout calibration matrix and uncertainty;
- corrected T1 and Ramsey data;
- T1, T2, and optional Tphi estimates with 95% confidence intervals;
- frozen-model predictions and residuals;
- PASS, CONDITIONAL PASS, or FAIL decision;
- explicit statement that no model refit occurred.

## Execution gate

This protocol only authorizes implementation of the audit procedure. A QPU
submission requires a separate explicit approval because it consumes provider
allowance and is irreversible.
