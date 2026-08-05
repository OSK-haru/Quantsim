# Pulse Extension B Frozen Qutrit Model

## Status

```text
model_id: driven_transmon_qutrit_rwa_experimental_v1
contract_version: pulse-extension-b-v1
capability_status: available
freeze_status: frozen with documented restrictions
frame: rotating
approximation: RWA
```

This is a single-transmon, three-level educational model. It is not a
calibrated hardware model and does not predict a specific device.

The detailed field-level contract remains in
[`pulse-extension-b-qutrit-contract.md`](pulse-extension-b-qutrit-contract.md).

## State Space

The basis and subsystem dimensions are:

$$
|0\rangle,\quad |1\rangle,\quad |2\rangle,
\qquad
\text{subsystem dimensions}=(3,).
$$

With:

$$
a=
\begin{pmatrix}
0&1&0\\
0&0&\sqrt2\\
0&0&0
\end{pmatrix},
\qquad
n=a^\dagger a
=
\operatorname{diag}(0,1,2).
$$

The reported leakage is:

$$
P_{\mathrm{leak}}(t)=P_2(t)=\rho_{22}(t).
$$

It is never hidden by computational-subspace renormalization.

## Units And Frequencies

Internal units are:

```text
time: us
Hamiltonian and angular frequency: rad/us
dissipation rates: 1/us
```

The detuning and anharmonicity conventions are:

$$
\Delta=\omega_d-\omega_{01},
\qquad
\alpha=\omega_{12}-\omega_{01}<0.
$$

The public `anharmonicity_mhz` input is converted as:

$$
\alpha_{\mathrm{rad}/\mu s}
=2\pi\alpha_{\mathrm{MHz}}.
$$

Physical-mode requests require:

$$
f_{12}=f_{01}+\frac{\alpha_{\mathrm{MHz}}}{1000}>0
$$

when frequencies are expressed in GHz.

## Hamiltonian

The frozen rotating-frame RWA Hamiltonian is:

$$
H(t)=
-\Delta n
+\frac{\alpha}{2}n(n-1)
+\frac{\Omega_x(t)}{2}(a+a^\dagger)
+\frac{\Omega_y(t)}{2}\left[-i(a-a^\dagger)\right].
$$

Square and truncated Gaussian envelopes are supported. Gaussian DRAG uses:

$$
\Omega_y(t)=\beta\frac{d\Omega(t)}{dt},
$$

before the common phase rotation. `drag_beta_us` is available only for the
qutrit Gaussian path. The validated fixture uses `beta = 0.001 us`; this is
not a universal optimum.

The total simulation time can exceed the pulse duration. After the control
envelope ends, the state evolves through a free-idle segment under the
undriven rotating-frame Hamiltonian and the same collapse operators.

## Open-System Model

Transition-specific thermal collapse operators are:

$$
L_{10}^{\downarrow}
=\sqrt{\gamma_{10}^{\downarrow}}|0\rangle\langle1|,
\qquad
L_{01}^{\uparrow}
=\sqrt{\gamma_{01}^{\uparrow}}|1\rangle\langle0|,
$$

$$
L_{21}^{\downarrow}
=\sqrt{\gamma_{21}^{\downarrow}}|1\rangle\langle2|,
\qquad
L_{12}^{\uparrow}
=\sqrt{\gamma_{12}^{\uparrow}}|2\rangle\langle1|.
$$

Physical mode derives separate Bose occupations for the `0-1` and `1-2`
transition frequencies. Its educational profile assumes:

$$
\gamma_{21,0}=2\gamma_{10,0}.
$$

This factor reflects a harmonic-matrix-element approximation, not hardware
calibration.

Pure dephasing is:

$$
L_\phi^{(3)}
=\sqrt{2\gamma_{\phi,\mathrm{adj}}}\,n.
$$

Therefore the adjacent coherences decay at
`gamma_phi_adjacent_per_us`, while the `0-2` coherence decays four times as
fast. The three coherence rates cannot be configured independently.

## Numerical Policy

The production reference path is fixed-step dense RK4. The qutrit step cap is
the minimum of:

- a Hamiltonian spectral-diameter bound,
- a dissipative-scale bound,
- 32 samples per Gaussian sigma,
- the segment duration.

The core validation work recommendation is 25,000 internal steps. Public HTTP
execution uses a stricter 4,000-step preflight ceiling, two execution slots,
and a 15-second wait timeout.

Raw physicality is measured before cleanup. Reported snapshots are cleaned by
Hermitian symmetrization, eigenvalue clipping, and trace normalization when
needed. Cleanup corrections are exposed in diagnostics. This policy does not
make finite-step RK4 a strict CPTP integrator.

## Validated Evidence

The frozen evidence includes:

- closed qutrit basis, coherence, pulse, leakage, and idle checks,
- zero-temperature cascade and finite-temperature Gibbs equilibrium,
- the `1:1:4` qutrit dephasing relation,
- physical/direct-rate equivalence,
- non-DRAG convergence and raw physicality,
- DRAG sign, derivative, leakage, fidelity, phase, and convergence checks,
- eight shared 3x3 QuTiP comparisons.

The maximum QuTiP differences were:

```text
density-matrix element: 5.0269e-10
Frobenius norm:         9.6319e-10
trace distance:         6.8220e-10
leakage:                7.5331e-11
```

All were below the preregistered `5e-7` tolerance.

## API And UI Boundary

`POST /api/pulse/simulate` dispatches by `model_id`. Two-level Baseline A
continues to return `pulse-baseline-a-v1`; qutrit requests return the frozen
`pulse-extension-b-v1`.

Pulse Lab is a single-pulse interface. It does not read `CircuitEditorState`
or `circuit_config`. Circuit Studio and State Explorer belong to the
gate-aware `POST /api/simulate` flow.

## Frozen Restrictions

The optional quasi-static detuning extension is specified separately in
[`pulse-quasi-static-noise.md`](./pulse-quasi-static-noise.md). It preserves
the frozen per-shot qutrit Hamiltonian and forms an ensemble average across
Gaussian detuning offsets; it does not replace the Lindblad rates.

- one qutrit and one control pulse only,
- three-level truncation only,
- rotating-frame RWA only,
- Markovian Lindblad dissipation plus optional Gaussian quasi-static detuning only,
- no strict finite-step CPTP guarantee,
- no multi-qubit or entangling pulse control,
- no transfer-function distortion or crosstalk,
- no calibrated hardware prediction,
- no Rust time-dependent production backend,
- no circuit-to-pulse compiler.

These restrictions require an explicit new phase and contract review before
they can be changed.
