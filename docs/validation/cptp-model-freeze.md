# Explicit CPTP Model Freeze

## Decision

**PASS WITH RESTRICTIONS**

Phase 2 C0-C10 is complete. The explicit CPTP pulse-evolution family is
frozen as:

```text
freeze ID: quantascope_explicit_cptp_v1
public API value: explicit_cptp
evolution method ID: explicit_cptp_midpoint_gksl_v1
RK4 reference method ID: fixed_step_rk4_v1
```

The canonical machine-readable record is
`validation_results/cptp_model_freeze.json`.

## Frozen Mathematical Contract

| Item | Frozen value |
| --- | --- |
| Choi convention | `unnormalized_input_output_row_major_v1` |
| Choi normalization | Unnormalized, `Tr(J) = d` for TP maps |
| Choi basis order | Input tensor output |
| CP tolerance | `1e-12` |
| TP tolerance | `1e-12` |
| Liouvillian vectorization | `column_major_vec_f_v1` |
| Python exponential | `scaling_squaring_pade13_numpy_v1` |
| Rust exponential | `scaling_squaring_pade13_rust_v1` |
| Time-dependent sampling | `midpoint_piecewise_constant_v1` |
| Time unit | `us` |
| Hamiltonian unit | `rad/us` |
| Collapse-operator unit | `sqrt(1/us)` |
| Liouvillian unit | `1/us` |
| Density-matrix cleanup | Not applied |

The supported API models are:

- `driven_two_level_rwa_experimental_v1`
- `driven_transmon_qutrit_rwa_experimental_v1`

The Pulse API default remains `fixed_step_rk4`. A caller must explicitly
select `explicit_cptp`.

## Guarantee Boundary

The following statements are frozen:

1. Every midpoint-frozen interval is generated as a finite GKSL exponential.
2. Every interval map is audited for complete positivity and trace
   preservation using the frozen Choi convention.
3. Every map composed between output checkpoints is independently
   Choi-audited.
4. Python and Rust use the same convention and tolerances.
5. CPTP state application does not use Hermitian symmetrization, negative
   eigenvalue clipping, or trace normalization.

The CPTP guarantee applies to the constructed discrete interval maps and
their compositions. It does not make midpoint freezing exact for a
time-dependent Hamiltonian. Agreement with the continuous time-ordered
solution remains an interval-refinement question.

## Evidence

The C8 comparison artifact reports:

- all accepted comparison cases passed;
- maximum accepted RK4/CPTP trace distance: approximately `2.70e-4`;
- maximum CPTP state trace error: approximately `4.56e-14`;
- minimum accepted CPTP state eigenvalue: approximately `1.14e-3`;
- maximum Choi TP residual: approximately `7.78e-14`.

C10 additionally executes two-level and qutrit API smoke cases through both
Python and Rust when the Rust extension is available. Each smoke must report:

- `explicit_cptp_midpoint_gksl_v1`;
- CPTP guaranteed by construction;
- all maps passing their audits;
- no cleanup;
- state trace error at most `1e-10`;
- state minimum eigenvalue at least `-1e-10`.

The freeze manifest hashes every critical C0-C10 source and evidence file.
Regenerating the manifest therefore exposes changes to the frozen
implementation.

## Restrictions

This freeze does not establish:

- calibrated hardware prediction;
- non-Markovian dynamics;
- laboratory-frame carrier resolution;
- multi-qubit pulse control;
- CPTP execution in gate-aware `run_simulation`;
- completion of the CPTP-to-QuTiP Phase 3 audit.

These restrictions are part of the frozen claim and must remain visible in
later model descriptions.
