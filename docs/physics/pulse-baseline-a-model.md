# Pulse Baseline A Model

## Status

Pulse Baseline A is frozen as the experimental model:

```text
driven_two_level_rwa_experimental_v1
```

It is a generic educational two-level control-envelope model. It is not a
calibrated reproduction of a particular quantum processor.

## Physical Scope

The simulated system is one two-level qubit in the rotating frame under the
rotating-wave approximation (RWA). The basis and Pauli operators are:

$$
|0\rangle=(1,0)^\mathsf{T},
\qquad
|1\rangle=(0,1)^\mathsf{T},
$$

$$
\sigma_x=
\begin{pmatrix}0&1\\1&0\end{pmatrix},
\quad
\sigma_y=
\begin{pmatrix}0&-i\\i&0\end{pmatrix},
\quad
\sigma_z=
\begin{pmatrix}1&0\\0&-1\end{pmatrix}.
$$

The detuning convention is:

$$
\Delta=\omega_d-\omega_q.
$$

The driven Hamiltonian is:

$$
H_{\mathrm{rot}}(t)
=
\frac{\Delta}{2}\sigma_z
+
\frac{\Omega(t)}{2}
\left(
\cos\phi\,\sigma_x+\sin\phi\,\sigma_y
\right).
$$

Positive phase rotates the control axis from $+x$ toward $+y$.

## Units

| Quantity | Internal unit |
|---|---|
| Time | $\mu\mathrm{s}$ |
| Hamiltonian / angular frequency | $\mathrm{rad}/\mu\mathrm{s}$ |
| Dissipation rate | $1/\mu\mathrm{s}$ |
| Phase / rotation angle | radians |

The Hamiltonian is in angular-frequency units. Therefore the master equation
uses $-i[H,\rho]$ without another explicit factor of $\hbar$.

## Pulse Envelopes

Baseline A supports finite-duration square and truncated Gaussian envelopes.

For a square pulse:

$$
\Omega(t)=\Omega_0,
\qquad
0\leq t\leq\tau_p.
$$

For a Gaussian pulse centered at $t_c=N_\mathrm{trunc}\sigma$:

$$
\Omega(t)
=
\Omega_0
\exp\left[
-\frac{(t-t_c)^2}{2\sigma^2}
\right],
\qquad
0\leq t\leq2N_\mathrm{trunc}\sigma.
$$

In target-angle mode, $\Omega_0$ is normalized with the finite truncated
integral, not the infinite-support Gaussian approximation. Peak-amplitude mode
uses the supplied $\Omega_0$ directly.

Pulse duration and total simulation time are distinct. The drive acts only
during the pulse duration. If the total time is longer, the same Lindblad
environment continues during a zero-Hamiltonian idle segment.

## Open-System Model

The density matrix follows:

$$
\frac{d\rho}{dt}
=
-i[H(t),\rho]
+
\sum_k
\left(
L_k\rho L_k^\dagger
-
\frac12\{L_k^\dagger L_k,\rho\}
\right).
$$

The collapse operators are:

$$
L_\downarrow
=
\sqrt{\gamma_\downarrow}\,\sigma_-,
\qquad
L_\uparrow
=
\sqrt{\gamma_\uparrow}\,\sigma_+,
$$

$$
L_\phi
=
\sqrt{\frac{\gamma_\phi}{2}}\,\sigma_z.
$$

With this dephasing convention, off-diagonal coherence decays at
$\gamma_\phi$ from pure dephasing alone. At finite temperature:

$$
\frac{1}{T_1}
=
\gamma_\downarrow+\gamma_\uparrow,
$$

$$
\frac{1}{T_2}
=
\frac{\gamma_\downarrow+\gamma_\uparrow}{2}
+
\gamma_\phi.
$$

`physical` input mode derives these rates through the existing educational
environment profile. `direct_rates` mode accepts the three non-negative rates
directly and bypasses that mapping.

## Numerical Method

The pulse path is separate from the existing constant-Hamiltonian gate path.
It uses fixed-step classical RK4 and evaluates $H(t)$ at all four RK4 stage
times. The Hamiltonian and Lindblad terms are evolved together during both the
driven pulse and any post-pulse idle segment.

The frozen step policy chooses the most restrictive applicable limit:

$$
hG_H\leq0.05,
\qquad
hG_D\leq0.05,
\qquad
\frac{h}{\sigma}\leq\frac{1}{20}
\quad\text{for Gaussian pulses},
$$

where:

$$
G_H
=
\sqrt{\Omega_{\max}^2+\Delta^2},
\qquad
G_D
=
\gamma_\downarrow+\gamma_\uparrow+\gamma_\phi.
$$

The API rejects requests estimated to exceed 200,000 internal steps. This
budget includes the open and zero-rate reference evolutions.

## Physicality And Reported Metrics

Before each cleanup operation, the solver records:

- trace error,
- Hermiticity error,
- minimum eigenvalue of the Hermitian part,
- cleanup correction norm.

After each complete RK4 step, the density matrix is cleaned to suppress
floating-point drift. Cleanup is never applied inside an RK4 stage. The
response preserves both raw diagnostics and cleaned-state diagnostics so that
cleanup cannot hide an unsafe coarse step.

The API reports:

- open and zero-rate reference populations,
- overlap fidelity to the zero-rate reference,
- purity $\mathrm{Tr}(\rho^2)$,
- separate pulse-end and final states,
- step counts and physicality diagnostics.

## Validation Basis

The direct pulse evidence is:

| Validation | What it establishes |
|---|---|
| BA-2 | Square/Gaussian analytic trajectories and finite-support normalization |
| BA-3 | Phase direction, detuning sign, and ideal-gate equivalence |
| BA-4 | Dissipation during pulse and post-pulse idle |
| PULSE-CONV-2LEVEL | Fourth-order convergence and safe step controls |
| PULSE-QUTIP-2LEVEL | Agreement with QuTiP for six identical mathematical problems |
| BA-6 | Versioned API contract, bounded execution, and regression freeze |

V1-V7 remain regression guards for the pre-existing gate-aware path and shared
environment/collapse-operator conventions. They are not presented as direct
validation of the time-dependent pulse model.

## Limitations

- One qubit and two levels only.
- No transmon third level or leakage.
- No DRAG.
- No laboratory-frame carrier integration.
- No transfer-function distortion, crosstalk, or multi-qubit pulses.
- Markovian Lindblad environment only.
- Fixed-step RK4 is not intrinsically CPTP at arbitrary step sizes.
- No Rust time-dependent execution path.
- No hardware calibration or device-prediction claim.

Pulse Extension B may add qutrit and leakage behavior, but it must not silently
change this frozen two-level contract.
