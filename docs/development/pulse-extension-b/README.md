# Pulse Extension B Development Phases

## 1. Purpose

Pulse Extension B extends the frozen two-level Pulse Baseline A into a
single-qutrit transmon model with leakage, transition-specific dissipation,
DRAG control, independent QuTiP comparison, and an experimental Pulse Lab UI.

The planned model identity is:

```text
driven_transmon_qutrit_rwa_experimental_v1
```

This remains a rotating-frame RWA educational model. It is not calibrated
hardware reproduction.

## 2. Starting Point

Baseline A is frozen as:

```text
model_id: driven_two_level_rwa_experimental_v1
contract_version: pulse-baseline-a-v1
```

Extension B must add a separate qutrit path. It must not reinterpret or
silently alter the validated Baseline A Hamiltonian, pulse envelopes,
dissipation conventions, step policy, API behavior, or validation artifacts.

## 3. Phase Map

| Phase | Status | Title | Main result |
|---|---|---|---|
| [B-0](phase-b0-qutrit-contract.md) | Complete | Qutrit model and contract | Basis, units, Hamiltonian, model identity, and API boundary are fixed |
| [B-1](phase-b1-closed-qutrit-leakage.md) | Complete | Closed qutrit and leakage | Three-level unitary evolution and leakage metrics are validated |
| [B-2](phase-b2-qutrit-open-system.md) | Complete | Qutrit open-system dynamics | Transition-specific thermal rates and qutrit dephasing are validated |
| [B-3](phase-b3-qutrit-convergence.md) | Complete | Convergence and safe-step policy | Qutrit step policy, physicality limits, and work budget are fixed |
| [B-4](phase-b4-drag-control.md) | Complete | DRAG control | Quadrature control is validated and evaluated beyond leakage alone |
| [B-5](phase-b5-qutip-qutrit-comparison.md) | Complete | QuTiP comparison and API gate | Shared qutrit problems agree and the qutrit API is enabled behind a bounded work gate |
| [B-6](phase-b6-pulse-lab-ui.md) | Complete | Pulse Lab UI | A separate experimental UI exposes validated pulse controls and results |
| [B-7](phase-b7-integration-and-freeze.md) | Complete | Integration and freeze | Extension B evidence, contracts, regressions, and limitations are frozen |

Dependency order:

```text
B-0
 |
B-1
 |
B-2
 |
B-3
 |
B-4
 |
B-5
 |
B-6
 |
B-7
```

The former v3 plan listed DRAG cases under qutrit convergence before DRAG was
implemented. This phase map resolves that dependency:

- B-3 validates non-DRAG qutrit evolution and selects the base qutrit step
  policy.
- B-4 adds DRAG and performs DRAG-specific convergence checks.

## 4. Fixed Physical Direction

The qutrit basis is:

$$
|0\rangle,\quad |1\rangle,\quad |2\rangle.
$$

The annihilation and number operators are:

$$
a=
\begin{pmatrix}
0&1&0\\
0&0&\sqrt2\\
0&0&0
\end{pmatrix},
\qquad
n=a^\dagger a.
$$

With detuning $\Delta=\omega_d-\omega_{01}$ and anharmonicity
$\alpha=\omega_{12}-\omega_{01}$, the planned Hamiltonian is:

$$
H(t)=
-\Delta n
+\frac{\alpha}{2}n(n-1)
+\frac{\Omega_x(t)}{2}(a+a^\dagger)
+\frac{\Omega_y(t)}{2}\left[-i(a-a^\dagger)\right].
$$

Internal units remain:

```text
time: us
Hamiltonian and angular frequency: rad/us
rates: 1/us
anharmonicity UI/API input: MHz
DRAG beta: us
```

The leakage probability is:

$$
P_{\mathrm{leak}}(t)=\rho_{22}(t).
$$

## 5. Shared Engineering Rules

- Keep `driven_two_level_rwa_experimental_v1` unchanged.
- Keep `/api/simulate` unchanged.
- Use a separate qutrit Hamiltonian and open-system assembly path.
- Generalize only dimension-independent numerical primitives.
- Keep Python/NumPy as the reference backend for Extension B.
- Do not route time-dependent Python callbacks through Rust.
- Do not expose unvalidated qutrit execution as a successful production API.
- Evaluate raw physicality before cleanup.
- Include $\alpha$ in the Hamiltonian spectral-diameter step constraint.
- Keep pulse duration and total observation duration distinct.
- Treat QuTiP comparison as a numerical cross-check, not hardware validation.
- Do not loosen tolerances after seeing a failure without documenting a new
  physical or numerical justification.

## 6. Shared Regression Gate

Every phase that changes numerical code must run its focused tests and:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests
cd frontend
npm.cmd run lint
npm.cmd run build
```

The following evidence must remain valid:

- gate-aware V1-V7 validations,
- Pulse Baseline A BA-2 through BA-6 validations,
- `/api/simulate`,
- the Baseline A request and response behavior of `/api/pulse/simulate`.

## 7. Validation Artifacts

Numerical phases should produce:

```text
validation_results/
  pulse_b_<id>.json
  pulse_b_<id>.csv
  pulse_b_<id>_<figure>.png

docs/validation/
  pulse-b-<id>-report.md
```

Artifacts must record, where applicable:

```text
model_id
contract_version
frame
approximation
basis_order
subsystem_dimensions
input_payload
internal_units
Hamiltonian convention
collapse operators
step policy
cleanup policy
tolerances
software versions
pass_fail
scope_and_limitations
```

## 8. Extension B Completion Definition

Extension B is complete only when:

- qutrit operators and MHz-to-rad/us conversion are exact and tested,
- closed qutrit evolution preserves trace and exposes leakage,
- qutrit thermal and dephasing conventions pass analytic checks,
- qutrit and DRAG trajectories have demonstrated convergence,
- QuantaScope and QuTiP agree on shared 3x3 mathematical problems,
- the Pulse Lab labels qutrit projections and approximations honestly,
- Baseline A and gate-aware regressions remain unchanged,
- a final Extension B report records performance and limitations.

## 9. Explicitly Outside Extension B

- More than three transmon levels
- Multi-qubit pulse simulation
- Entangling-pulse calibration
- Crosstalk and transfer-function distortion
- Laboratory-frame carrier integration
- Non-Markovian noise
- Strict finite-step CPTP solver guarantees
- Rust time-dependent production execution
- Real-device calibration or predictive hardware fidelity

These belong to later, separately approved phases.
