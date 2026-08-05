# B-0: Qutrit Model and Contract

**Status:** Complete on 2026-07-23

## Implementation Result

B-0 added:

```text
core/pulse_qutrit_contract.py
tests/test_pulse_b0_qutrit_contract.py
```

and extended:

```text
core/capabilities.py
api/pulse_models.py
```

Implemented:

- exact qutrit basis, annihilation, creation, and number operators,
- negative transmon anharmonicity conversion from MHz to rad/us,
- positive derived $1\leftrightarrow2$ transition validation,
- the frozen 3x3 rotating-frame qutrit Hamiltonian constructor,
- physical and transition-specific direct-rate request contracts,
- a model-ID-discriminated private request union,
- capability state `contract_only`.

The public `POST /api/pulse/simulate` endpoint intentionally remains frozen to
`PulseSimulateRequest` from Baseline A. Valid qutrit contract objects can be
created internally, but an HTTP qutrit request is rejected with `422` until
B-5 completes the numerical and QuTiP gates. No qutrit success response is
currently exposed.

Verification:

```text
B-0 focused tests: 15 passed
B-0 plus Baseline A contract/API/freeze tests: 47 passed
Full Python suite: 408 passed
Frontend lint: passed
Frontend production build: passed
```

## 1. Goal

Fix the qutrit basis, operators, units, Hamiltonian, model identity, request
discriminator, and validation boundary before implementing qutrit evolution.

## 2. Prerequisites

- Pulse Baseline A is frozen and passing.
- The gate-aware V1-V7 evidence remains available.
- The current Pulse OpenAPI contract is recorded for regression comparison.

## 3. In Scope

- Three-level basis and exact 3x3 operators
- Anharmonicity and detuning conventions
- MHz-to-rad/us conversion
- Planned model and contract identifiers
- Qutrit initial-state and subsystem-dimension rules
- Provisional qutrit request types; successful response types remain deferred
- Explicit not-yet-executable API boundary
- Baseline A regression guards

## 4. Out of Scope

- Numerical qutrit evolution
- Dissipation execution
- DRAG
- Pulse Lab UI
- Rust execution
- API success responses for qutrit requests

## 5. Fixed Contract

Use basis order:

```text
|0>, |1>, |2>
subsystem_dimensions: (3,)
```

Use:

$$
a=
\begin{pmatrix}
0&1&0\\
0&0&\sqrt2\\
0&0&0
\end{pmatrix},
\qquad
n=a^\dagger a,
\qquad
\alpha=\omega_{12}-\omega_{01}.
$$

The rotating-frame Hamiltonian is:

$$
H(t)=
-\Delta n
+\frac{\alpha}{2}n(n-1)
+\frac{\Omega_x(t)}{2}(a+a^\dagger)
+\frac{\Omega_y(t)}{2}\left[-i(a-a^\dagger)\right],
$$

with:

$$
\Delta=\omega_d-\omega_{01}.
$$

The public anharmonicity input is:

```text
anharmonicity_mhz
```

and:

$$
\alpha_{\mathrm{rad}/\mu s}=2\pi\alpha_{\mathrm{MHz}}.
$$

The planned identity is:

```text
model_id: driven_transmon_qutrit_rwa_experimental_v1
contract_version: pulse-extension-b-v1
```

The contract version is provisional until B-7 freezes it.

## 6. API Boundary

Keep `POST /api/pulse/simulate` as the pulse endpoint and discriminate models
through `model_id`. The Baseline A request and response semantics must not
change.

Before B-5 completes, a qutrit request may be validated internally but must
not return a successful simulated result. The executable union is kept
private until validation is complete. The public endpoint remains Baseline
A-only and therefore rejects qutrit HTTP requests with `422`.

Reject:

- non-finite or zero transition frequencies,
- $f_{12}\leq0$,
- non-negative anharmonicity if the first model intentionally supports only
  transmon-like $\alpha<0$,
- initial states outside the 3x3 density-matrix contract,
- qutrit-only fields on the Baseline A model,
- nonzero DRAG before B-4.

## 7. Likely Files

```text
core/pulse_qutrit_contract.py
api/pulse_models.py
core/capabilities.py
tests/test_pulse_b0_qutrit_contract.py
```

Names may change, but qutrit constants must not be mixed into the frozen
two-level contract without a clear compatibility layer.

The implemented physics contract is documented in:

[`../../physics/pulse-extension-b-qutrit-contract.md`](../../physics/pulse-extension-b-qutrit-contract.md)

## 8. Tests

- Exact entries and Hermiticity of $a$, $a^\dagger$, and $n$
- $a|1\rangle=|0\rangle$
- $a|2\rangle=\sqrt2|1\rangle$
- $n|j\rangle=j|j\rangle$
- `-250 MHz -> -1570.7963267948965 rad/us`
- Hamiltonian Hermiticity for representative inputs
- Two-level block detuning-sign consistency
- `subsystem_dimensions == (3,)`
- Invalid $f_{12}$ rejection
- Model discriminator and mixed-field rejection
- Baseline A OpenAPI and behavior regression

## 9. Completion Criteria

- Every physical convention is represented by executable tests.
- The qutrit model is distinguishable from Baseline A.
- Unit conversion cannot silently confuse MHz with rad/us.
- No successful qutrit simulation is exposed prematurely.
- Baseline A and `/api/simulate` remain unchanged.

## 10. Stop Conditions

Stop before B-1 if the qutrit Hamiltonian does not reduce consistently to the
documented two-level sign convention, or if additive schema work requires
changing existing Baseline A payload semantics.
