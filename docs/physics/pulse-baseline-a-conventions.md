# Pulse Baseline A Physical Conventions

## Status

This document fixes the BA-0 contract for:

```text
driven_two_level_rwa_experimental_v1
```

BA-0 originally froze this contract before numerical execution was enabled.
BA-6 now exposes the validated path through `POST /api/pulse/simulate`.
The complete frozen model description is
`docs/physics/pulse-baseline-a-model.md`.

## Model Identity

```text
model: rotating-frame RWA control-envelope experimental model
frame: rotating
approximation: RWA
calibration status: generic educational model, not hardware calibrated
```

This model is separate from the existing gate-aware simulation models.

## Basis and Operators

$$
|0\rangle=
\begin{pmatrix}1\\0\end{pmatrix},
\qquad
|1\rangle=
\begin{pmatrix}0\\1\end{pmatrix}.
$$

$$
\sigma_x=
\begin{pmatrix}0&1\\1&0\end{pmatrix},
\qquad
\sigma_y=
\begin{pmatrix}0&-i\\i&0\end{pmatrix},
\qquad
\sigma_z=
\begin{pmatrix}1&0\\0&-1\end{pmatrix}.
$$

The positive phase direction is from the $+x$ axis toward the $+y$ axis.

## Rotating-Frame Hamiltonian

The detuning convention is:

$$
\boxed{\Delta=\omega_d-\omega_q}.
$$

The Baseline A Hamiltonian is:

$$
\boxed{
H_{\mathrm{rot}}(t)
=
\frac{\Delta}{2}\sigma_z
+
\frac{\Omega(t)}{2}
\left(
\cos\phi\,\sigma_x
+
\sin\phi\,\sigma_y
\right)
}.
$$

The Hamiltonian is represented in angular-frequency units. The evolution
equation therefore uses:

$$
\frac{d\rho}{dt}=-i[H,\rho]+\mathcal D(\rho)
$$

without an additional explicit $\hbar$.

## Units

| Quantity | Internal unit |
|---|---|
| Time | $\mu\mathrm{s}$ |
| Hamiltonian and angular frequency | $\mathrm{rad}/\mu\mathrm{s}$ |
| Dissipation rate | $1/\mu\mathrm{s}$ |
| Phase | radians |

Ordinary frequency is converted using:

$$
f\ [\mathrm{MHz}]
\longrightarrow
2\pi f\ [\mathrm{rad}/\mu\mathrm{s}],
$$

$$
f\ [\mathrm{GHz}]
\longrightarrow
2\pi(1000f)\ [\mathrm{rad}/\mu\mathrm{s}].
$$

## API Boundary

Pulse requests use:

```text
POST /api/pulse/simulate
```

The environment input is exactly one of:

```text
physical
direct_rates
```

Unknown fields and fields belonging to the inactive mode are rejected.
Gaussian pulse duration is derived from:

$$
\tau_p=2N_{\mathrm{trunc}}\sigma.
$$

The pulse duration must not exceed the total observation duration.

## Baseline A Limitations

- No Pulse Lab UI is provided.
- No qutrit, leakage, or DRAG dynamics are provided.
- No laboratory-frame carrier is integrated.
- No Rust time-dependent backend is used.
- The existing `/api/simulate` path is unchanged.
