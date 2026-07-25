# Pulse Extension B Qutrit Contract

## Status

B-0 through B-7 are complete. The contract, implementation, validation
evidence, bounded API, and experimental Pulse Lab UI are frozen with the
restrictions listed below.

```text
model_id: driven_transmon_qutrit_rwa_experimental_v1
contract_version: pulse-extension-b-v1
capability status: available
freeze status: frozen with documented restrictions
frame: rotating
approximation: RWA
```

This is an educational three-level transmon contract. It is not a calibrated
hardware model.

## Basis And Operators

The basis order is:

$$
|0\rangle,\quad |1\rangle,\quad |2\rangle,
$$

with:

```text
subsystem_dimensions: (3,)
```

The annihilation and number operators are:

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
\begin{pmatrix}
0&0&0\\
0&1&0\\
0&0&2
\end{pmatrix}.
$$

Executable tests verify:

$$
a|1\rangle=|0\rangle,
\qquad
a|2\rangle=\sqrt2|1\rangle,
\qquad
n|j\rangle=j|j\rangle.
$$

## Frequency And Unit Conventions

The detuning convention is unchanged from Baseline A:

$$
\Delta=\omega_d-\omega_{01}.
$$

Anharmonicity is:

$$
\alpha=\omega_{12}-\omega_{01}.
$$

The first qutrit model accepts only transmon-like:

$$
\alpha<0.
$$

The public field is:

```text
anharmonicity_mhz
```

and conversion is:

$$
\alpha_{\mathrm{rad}/\mu s}
=2\pi\alpha_{\mathrm{MHz}}.
$$

For example:

$$
-250\ \mathrm{MHz}
\longrightarrow
-1570.7963267948965\ \mathrm{rad}/\mu\mathrm{s}.
$$

For physical input:

$$
f_{12}[\mathrm{GHz}]
=f_{01}[\mathrm{GHz}]
+\frac{\alpha[\mathrm{MHz}]}{1000}.
$$

Requests with $f_{12}\leq0$ are invalid.

## Hamiltonian Contract

The frozen B-0 constructor implements:

$$
H(t)=
-\Delta n
+\frac{\alpha}{2}n(n-1)
+\frac{\Omega_x(t)}{2}(a+a^\dagger)
+\frac{\Omega_y(t)}{2}\left[-i(a-a^\dagger)\right].
$$

Its matrix form is:

$$
H(t)=
\begin{pmatrix}
0 &
\frac{\Omega_x-i\Omega_y}{2} &
0 \\
\frac{\Omega_x+i\Omega_y}{2} &
-\Delta &
\frac{\sqrt2(\Omega_x-i\Omega_y)}{2} \\
0 &
\frac{\sqrt2(\Omega_x+i\Omega_y)}{2} &
-2\Delta+\alpha
\end{pmatrix}.
$$

The top-left two-level block agrees with the Baseline A Hamiltonian up to the
global shift $(\Delta/2)I$, which does not affect density-matrix dynamics.

## Request Contract

The private B-0 qutrit request includes:

```text
model_id
initial_state: "0" | "1" | "2"
anharmonicity_mhz
pulse
total_simulation_time_us
environment
snapshot_options
```

Two environment modes are defined:

```text
physical
direct_rates
```

The provisional direct qutrit rates are:

```text
gamma_10_down_per_us
gamma_01_up_per_us
gamma_21_down_per_us
gamma_12_up_per_us
gamma_phi_adjacent_per_us
```

B-2 implements and validates their collapse operators. B-4 accepts nonzero
`drag_beta_us` for Gaussian qutrit pulses only. Square qutrit pulses and the
Baseline A request continue to reject nonzero DRAG.

## Closed-System Evolution

B-1 implements the B-0 Hamiltonian as a separate 3x3 closed-system path in:

```text
core/pulse_qutrit.py
```

During a pulse it evaluates the full time-dependent qutrit Hamiltonian at all
RK4 stages. After the pulse, a requested idle interval evolves with:

$$
H_{\mathrm{idle}}
=
-\Delta n
+\frac{\alpha}{2}n(n-1).
$$

Therefore closed idle preserves populations but can continue rotating
coherences in the selected rotating frame.

The reported populations are:

$$
P_j(t)=\rho_{jj}(t),\qquad j=0,1,2,
$$

without renormalizing the computational subspace. Leakage is:

$$
P_{\mathrm{leak}}(t)=P_2(t)=\rho_{22}(t).
$$

The current summary includes pulse-end leakage, final leakage, and:

```text
maximum_recorded_leakage_probability
```

The last quantity is sampled at returned checkpoints and is not guaranteed to
equal the continuous-time maximum between checkpoints.

## Open-System Dynamics

B-2 implements a separate qutrit open-system path in:

```text
core/pulse_qutrit_open_system.py
```

Its transition collapse operators are:

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

Physical mode computes a separate Bose occupation for each positive
transition frequency. The educational profile uses:

$$
\gamma_{21,0}=2\gamma_{10,0}.
$$

This factor is a harmonic-matrix-element approximation, not a calibrated
device constant.

Pure dephasing uses:

$$
L_\phi^{(3)}
=\sqrt{2\gamma_{\phi,\mathrm{adj}}}\,n.
$$

Consequently, pure dephasing alone gives:

$$
|\rho_{01}(t)|,|\rho_{12}(t)|
\propto e^{-\gamma_{\phi,\mathrm{adj}}t},
\qquad
|\rho_{02}(t)|
\propto e^{-4\gamma_{\phi,\mathrm{adj}}t}.
$$

The three coherence rates are therefore not independently configurable. The
direct-rate schema description and rate metadata expose this limitation.

The same collapse operators act continuously during the pulse and the
post-pulse free-idle interval.

## Non-DRAG Step Policy

B-3 implements `qutrit_fixed_rk4_v1`. The fixed-step cap is the minimum of:

$$
h_H=\frac{0.02}{\max_t[
\lambda_{\max}(H(t))-\lambda_{\min}(H(t))]},
$$

$$
h_D=\frac{0.02}{
\gamma_{10}^{\downarrow}
+\gamma_{01}^{\uparrow}
+\gamma_{21}^{\downarrow}
+\gamma_{12}^{\uparrow}
+4\gamma_{\phi,\mathrm{adj}}}
$$

when the corresponding scale is nonzero, and:

$$
h_G=\frac{\sigma}{32}
$$

for Gaussian pulses. The segment duration is also an upper bound. The full
3x3 spectral diameter includes $\alpha$, including during zero-drive idle.

The future API preflight recommendation is at most 25,000 internal steps.
This is a work bound derived from measured fixed-step cost, not a guaranteed
response time. The policy does not make RK4 intrinsically CPTP.

The B-3 validation report is:

```text
docs/validation/pulse-b-qutrit-convergence.md
```

## Gaussian DRAG Control

B-4 defines:

$$
\Omega_x(t)=\Omega(t),
\qquad
\Omega_y(t)=\beta\frac{d\Omega(t)}{dt},
$$

with `drag_beta_us` in microseconds. For:

$$
\Omega(t)
=A\exp\left[-\frac{(t-t_c)^2}{2\sigma^2}\right],
$$

the implemented derivative is:

$$
\frac{d\Omega}{dt}
=-\frac{t-t_c}{\sigma^2}\Omega(t).
$$

The Gaussian and derivative are evaluated at both endpoints of the inclusive
finite support. Both are zero strictly outside the support. This preserves
the Baseline A hard truncation and does not introduce a smooth-edge envelope.

For phase $\phi$, the in-phase and quadrature components are:

$$
\Omega_x^{\mathrm{lab}}
=\Omega\cos\phi-\Omega_{\mathrm{DRAG}}\sin\phi,
$$

$$
\Omega_y^{\mathrm{lab}}
=\Omega\sin\phi+\Omega_{\mathrm{DRAG}}\cos\phi.
$$

Thus positive DRAG is +90 degrees from the in-phase axis. B-4 validates both
signs and does not assume $\beta=1/\alpha$ is universally correct.

The B-3 Hamiltonian spectral-diameter policy now includes the maximum combined
drive magnitude:

$$
\max_t\sqrt{\Omega(t)^2+
\left[\beta\dot\Omega(t)\right]^2}.
$$

The existing 32 samples per $\sigma$ envelope limit was sufficient for the
fixed DRAG convergence fixture; no additional derivative-resolution constant
was needed.

The validated fixture uses `beta = 0.001 us`, $\alpha/(2\pi)=-100$ MHz, and
`sigma = 0.002 us`. This is evidence for one fixed condition, not a calibrated
or universal optimum. The report is:

```text
docs/validation/pulse-b-drag.md
```

## Public API Boundary

The pulse endpoint now dispatches by `model_id` and accepts:

```text
driven_two_level_rwa_experimental_v1
driven_transmon_qutrit_rwa_experimental_v1
```

Valid qutrit requests return `pulse-extension-b-v1`. Requests estimated above
the qutrit HTTP work ceiling of 4,000 internal steps return `422` before
execution.

The core capability record distinguishes:

```text
two-level model: available
qutrit model: available
```

## Frozen Scope And Restrictions

B-7 freezes the qutrit contract and Pulse Lab behavior. It does not establish:

- hardware calibration or real-device prediction,
- more than three transmon levels,
- multi-qutrit or entangling pulse control,
- pulse-sequence or circuit-to-pulse compilation,
- laboratory-frame carrier dynamics,
- non-Markovian noise,
- strict finite-step CPTP evolution,
- Rust time-dependent production execution.

The consolidated model is
[`pulse-extension-b-qutrit-model.md`](pulse-extension-b-qutrit-model.md), and
the integration evidence is
[`../validation/pulse-extension-b-report.md`](../validation/pulse-extension-b-report.md).
