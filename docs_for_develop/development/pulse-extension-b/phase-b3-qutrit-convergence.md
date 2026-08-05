# B-3: Qutrit Convergence and Safe-Step Policy

**Status:** Complete (2026-07-23)

## 1. Goal

Establish numerical convergence, raw physicality limits, performance
instrumentation, and a bounded default step policy for non-DRAG qutrit
evolution before public API or UI exposure.

## 2. Prerequisites

- B-1 closed qutrit validation passes.
- B-2 open-system qutrit validation passes.
- Validation can run with cleanup diagnostics exposed.

## 3. In Scope

- Fixed-step refinement studies
- Hamiltonian spectral-diameter limits including $\alpha$
- Gaussian envelope-resolution limits
- Qutrit dissipation limits
- Raw versus cleaned physicality comparison
- Runtime and internal-step instrumentation
- API work-budget recommendation
- Non-DRAG qutrit safe defaults

## 4. Out of Scope

- DRAG convergence, which belongs to B-4
- QuTiP acceptance, which belongs to B-5
- UI defaults before this phase passes
- Adaptive solvers or strict CPTP integrators

## 5. Step Policy Candidate

Let:

$$
G_H(t)=\lambda_{\max}(H(t))-\lambda_{\min}(H(t)).
$$

The policy must include:

$$
h\max_tG_H(t)\leq\varepsilon_H,
$$

$$
h/\sigma\leq1/N_\sigma
$$

for Gaussian pulses, and:

$$
hG_D^{(3)}\leq\varepsilon_D,
$$

where:

$$
G_D^{(3)}
=
\gamma_{10}^{\downarrow}
+\gamma_{01}^{\uparrow}
+\gamma_{21}^{\downarrow}
+\gamma_{12}^{\uparrow}
+4\gamma_{\phi,\mathrm{adj}}.
$$

Do not copy Baseline A thresholds blindly. Select or confirm qutrit values
from recorded convergence evidence.

## 6. Required Cases

1. Free qutrit phase evolution with large $|\alpha|$.
2. Closed resonant Gaussian pulse with measurable leakage.
3. Detuned Gaussian qutrit pulse.
4. Dissipative Gaussian pulse.
5. Pulse followed by idle.
6. Deliberately coarse unsafe case demonstrating the guard.

For each case compare at least four refinements and a finer reference.

## 7. Required Diagnostics

```text
hamiltonian_scale_max_rad_per_us
dissipation_scale_per_us
envelope_step_limit_us
selected_internal_step_cap_us
actual_internal_step_min_us
actual_internal_step_max_us
actual_internal_step_count
step_limit_reason
runtime_ms
raw_trace_error
raw_hermiticity_error
raw_minimum_eigenvalue
cleanup_correction_norm
```

Track errors for the full 3x3 density matrix, all populations, and leakage.

## 8. Acceptance Method

- Fix tolerances before the final run.
- Confirm decreasing state error under refinement.
- Expect approximately fourth-order behavior only in the asymptotic smooth
  region; document exceptions caused by pulse boundaries.
- Require cleanup correction to decrease with refinement.
- Reject a policy that passes only after projecting away substantial negative
  eigenvalues.
- Record runtime and estimated steps for API budget design.

## 9. Likely Files

```text
core/pulse_step_policy.py
validation_pulse/qutrit_convergence.py
scripts/validate_pulse_qutrit_convergence.py
tests/test_pulse_b3_qutrit_convergence.py
docs/validation/pulse-b-qutrit-convergence.md
```

## 10. Artifacts

```text
validation_results/pulse_b_qutrit_convergence.json
validation_results/pulse_b_qutrit_convergence.csv
validation_results/pulse_b_qutrit_convergence.png
validation_results/pulse_b_qutrit_physicality.png
```

## 11. Completion Criteria

- A documented qutrit default step policy is supported by refinement data.
- $\alpha$ cannot be omitted from the limiting scale.
- Safe and intentionally unsafe conditions are distinguishable.
- A bounded API work budget is proposed from measured costs.
- Baseline A step selection remains unchanged for two-level requests.

## 12. Stop Conditions

Do not implement DRAG or expose qutrit controls in the UI if convergence is
not monotonic in the intended operating region, if the cost guard cannot
bound execution, or if raw physicality relies materially on cleanup.

## 13. Implemented Policy

The completed non-DRAG policy is:

```text
policy_id: qutrit_fixed_rk4_v1
epsilon_h: 0.02
epsilon_d: 0.02
Gaussian samples per sigma: 32
maximum internal steps: 25000
```

The selected step is the minimum of the segment-duration, full qutrit
Hamiltonian spectral-diameter, qutrit dissipative-scale, and Gaussian
envelope limits. The Hamiltonian calculation explicitly includes
anharmonicity, detuning, and peak drive.

The qutrit thresholds are separate from the frozen Baseline A values.
Baseline A remains:

```text
epsilon_h: 0.05
epsilon_d: 0.05
Gaussian samples per sigma: 20
```

## 14. Validation Result

All required cases passed four refinements plus a finer reference:

1. free qutrit phase with large $|\alpha|$,
2. resonant Gaussian leakage,
3. detuned Gaussian,
4. dissipative Gaussian,
5. pulse followed by idle,
6. deliberately unsafe coarse-step control.

At the selected policy step:

```text
maximum full-matrix error: 5.006523e-09
maximum population error: 8.595430e-11
maximum leakage error: 7.179329e-11
minimum raw eigenvalue: -3.849658e-10
maximum cleanup correction norm: 2.819873e-16
```

The unsafe control produced a raw minimum eigenvalue of approximately
`-12.7083`; the policy-safe run returned within the fixed raw-physicality and
state-error bounds. Cleanup is not a PSD projection and did not conceal the
coarse-step failure.

The final artifact run measured approximately `2.07 ms` per internal step on the
recorded development environment. The 25,000-step recommendation is a
deterministic future preflight work bound, not a latency guarantee.

Evidence:

```text
docs/validation/pulse-b-qutrit-convergence.md
validation_results/pulse_b_qutrit_convergence.json
validation_results/pulse_b_qutrit_convergence.csv
validation_results/pulse_b_qutrit_convergence.png
validation_results/pulse_b_qutrit_physicality.png
```

Qutrit HTTP execution remains `contract_only`. B-3 does not activate the API,
add DRAG, or claim a strict finite-step CPTP solver.
