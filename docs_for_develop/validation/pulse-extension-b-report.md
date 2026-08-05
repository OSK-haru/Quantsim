# Pulse Extension B Integration And Freeze Report

**Phase:** B-7
**Date:** 2026-07-23
**Decision:** PASS WITH RESTRICTIONS

> **Superseded step ceiling**
>
> The public qutrit HTTP ceiling described below as a "stricter 4,000-step"
> limit has since been raised and merged with the core validation ceiling.
> `core/pulse_step_policy.py` and `api/pulse_qutrit_service.py` both use
> 25,000 internal RK4 steps. See `docs_for_develop/README.md` for the current
> value; this report's numbers reflect the state at the time of the B-7
> freeze only.

## Executive Result

Pulse Extension B is frozen as:

```text
model_id: driven_transmon_qutrit_rwa_experimental_v1
contract_version: pulse-extension-b-v1
capability_status: available
```

B-0 through B-6 are integrated. Gate-aware V1-V7, Pulse Baseline A, qutrit
closed/open evolution, convergence, DRAG, QuTiP comparison, bounded API
execution, and the independent Pulse Lab UI pass their required gates.

The restrictions are substantive: this is a single-qutrit, single-pulse,
rotating-frame RWA educational model using fixed-step RK4. It is not strict
finite-step CPTP evolution or calibrated hardware prediction.

## Frozen Physics Contract

The qutrit basis is `|0>, |1>, |2>` with subsystem dimensions `(3,)`.
Anharmonicity uses:

$$
\alpha_{\mathrm{rad}/\mu s}
=2\pi\alpha_{\mathrm{MHz}},
$$

and the detuning convention is:

$$
\Delta=\omega_d-\omega_{01}.
$$

The rotating-frame RWA Hamiltonian is:

$$
H(t)=
-\Delta n+\frac{\alpha}{2}n(n-1)
+\frac{\Omega_x}{2}(a+a^\dagger)
+\frac{\Omega_y}{2}[-i(a-a^\dagger)].
$$

Leakage is the unrenormalized `|2>` population. Gaussian DRAG is
`Omega_y = beta * dOmega/dt` before the common phase rotation.

Transition-specific collapse operators cover `1->0`, `0->1`, `2->1`, and
`1->2`. Qutrit pure dephasing uses:

$$
L_\phi^{(3)}
=\sqrt{2\gamma_{\phi,\mathrm{adj}}}\,n,
$$

which fixes the adjacent and `0-2` coherence-decay ratio to `1:1:4`.

The full frozen model is documented in
[`../physics/pulse-extension-b-qutrit-model.md`](../physics/pulse-extension-b-qutrit-model.md).

## Numerical Evidence

### Gate-Aware Regression

V1 through V7 were regenerated. All cases passed:

- zero-dissipation ideal gates through four qubits,
- zero-temperature excitation limit and detailed balance,
- excited-state exponential decay,
- pure dephasing,
- finite-temperature equilibrium,
- time-step convergence,
- shared-equation QuTiP comparisons.

During B-7, V7 exposed a CSV output-schema mismatch: the calculated
`purity_difference` metric was absent from `CSV_FIELDS`. The export schema was
corrected, a regression test was added, and V7 then passed. Physics and solver
equations were not changed.

### Baseline A Compatibility

The following regenerated successfully:

- analytic square and Gaussian envelope checks,
- phase, detuning, and gate-equivalence checks,
- open pulse plus idle checks,
- two-level convergence and stress checks,
- six two-level QuTiP comparisons,
- Baseline A freeze audit.

The Baseline A identity and response remain
`driven_two_level_rwa_experimental_v1` /
`pulse-baseline-a-v1`.

### Extension B

| Evidence | Result |
|---|---|
| Closed qutrit and leakage | PASS |
| Transition-specific dissipation | PASS |
| Qutrit convergence and physicality | PASS |
| Gaussian DRAG | PASS |
| Eight-case QuTiP qutrit comparison | PASS |
| Bounded qutrit API | PASS |
| Pulse Lab contract, lint, and build | PASS |

The maximum qutrit QuTiP errors were:

| Metric | Maximum |
|---|---:|
| Density-matrix element | `5.0269e-10` |
| Frobenius norm | `9.6319e-10` |
| Trace distance | `6.8220e-10` |
| Population 2 / leakage | `7.5331e-11` |
| Purity | `3.2105e-12` |

The preregistered tolerance was `5e-7`.

## Step, Cleanup, And Performance Policy

The qutrit core work recommendation remains 25,000 internal RK4 steps. The
public API keeps the stricter 4,000-step ceiling and rejects larger requests
before execution. The limit was not raised to make demonstrations pass.

The regenerated B-3 performance fixture measured:

```text
measured total internal steps: 32,381
measured total runtime:        31,233.52 ms
measured cost:                 0.9646 ms/internal step
25,000-step projection:        24,114.08 ms
```

The public 4,000-step ceiling is an execution-safety policy, not a response
time guarantee. The API has two execution slots and a 15-second wait timeout.

Raw trace, Hermiticity, and minimum-eigenvalue diagnostics are retained before
snapshot cleanup. Cleanup corrections remain visible. Strict finite-step CPTP
behavior is not claimed.

## API And UI Integration

`POST /api/pulse/simulate` accepts two discriminated model contracts:

- the frozen two-level Baseline A contract,
- the frozen qutrit Extension B contract.

Qutrit responses include all three populations, unrenormalized leakage, 3x3
density matrices, rates, step policy, raw/cleaned physicality, warnings, and
limitations.

Pulse Lab displays the rotating-frame RWA and non-calibrated identity. It
preserves the previous valid result on failure and blocks conservatively
over-budget qutrit requests. It is explicitly a single-pulse experiment and
does not consume Circuit Studio state. The gate-aware State Explorer does not
consume pulse responses.

## Reproducibility

The final machine-readable manifest is:

```text
validation_results/pulse_extension_b_freeze.json
```

It records artifact hashes and pass flags, the OpenAPI hash, source-file
hashes, dirty-worktree status, dependency versions, API smoke summaries,
performance limits, regression evidence, and restrictions.

The final B-7 run recorded:

```text
full Python regression: 471 tests passed in 526.510 seconds
API smoke regression: 39 tests passed in 9.496 seconds
canonical Markdown audit: 24 documents, 44 local links, 0 broken
Pulse Lab route: HTTP 200
qutrit direct smoke: 896 estimated internal steps
over-budget qutrit fixture: rejected before evolution
```

The manifest intentionally records a dirty working tree and hashes critical
source files individually. This makes the audited source state explicit even
before the changes are committed.

The canonical commands are:

```powershell
.\.venv\Scripts\python.exe scripts\validate_pulse_extension_b_freeze.py
.\.venv\Scripts\python.exe -m unittest discover -s tests
cd frontend
npm.cmd run validate:pulse-lab
npm.cmd run lint
npm.cmd run build
```

## Restrictions And Handoff

Extension B does not establish:

- calibrated real-device fidelity,
- more than three transmon levels,
- multi-qubit or entangling pulse control,
- pulse-sequence or circuit-to-pulse compilation,
- non-Markovian dynamics,
- laboratory-frame carrier integration,
- strict finite-step CPTP evolution,
- Rust time-dependent production execution.

Later phases require separate approval:

1. strict CPTP event or solver work,
2. Rust reproduction of this frozen contract,
3. external observable validation V8,
4. circuit-to-pulse compilation and pulse-sequence UI.
