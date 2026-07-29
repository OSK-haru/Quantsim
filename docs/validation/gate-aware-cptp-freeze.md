# Gate-aware CPTP Freeze

**Freeze ID:** `quantascope_gate_aware_cptp_v1`
**Tag:** `quantascope-gate-aware-cptp-v1`
**Status:** PASS WITH RESTRICTIONS
**Scope:** Gate-aware Hamiltonian-Lindblad circuit execution

## Frozen contract

The gate-aware simulator supports these evolution methods:

```text
fixed_step_rk4
explicit_cptp
```

`fixed_step_rk4` remains the backward-compatible default. The frozen explicit
CPTP method is identified by:

```text
gate_aware_constant_gksl_exponential_v1
```

For each finite-duration gate column and idle interval, the implementation
constructs one constant-GKSL exponential map:

\[
\mathcal E(\tau)=\exp(\tau\mathcal L_{H,L}).
\]

The map is Choi-audited for complete positivity and trace preservation before
application. Explicit CPTP mode does not apply density-matrix cleanup.

## Frozen implementation scope

- Existing gate-duration defaults and per-gate overrides are unchanged.
- Existing effective involution Hamiltonians are unchanged.
- Existing environment-rate mapping and collapse operators are unchanged.
- Gate and dissipation are evolved simultaneously in each finite interval.
- Idle intervals use the zero Hamiltonian with the same environment.
- Python and Rust dense exponential implementations share the same Choi audit.
- API and UI selection is opt-in; omitted `evolution_method` means RK4.
- `MEASURE` remains the existing identity placeholder. It is not a projective
  measurement instrument and no classical outcome is generated.

## Evidence

The following checks passed before tagging:

- `tests.test_gate_aware_cptp`
- `tests.test_gate_aware_hamiltonian_lindblad`
- `tests.test_validation_qutip_comparison`
- `tests.test_cptp_rust_parity`
- API circuit/config/input-mode regressions
- snapshot and UI response regressions
- frontend `npm.cmd run build`
- frontend `npm.cmd run lint`

The focused regression run completed with 91 passing tests. The independent
QuTiP Bell trajectory comparison passed at `2e-9` density-matrix tolerance.
Three- and four-qubit finite-noise smoke cases passed Choi audits with no
physicality issues; the measured four-qubit smoke case took approximately
2.11 seconds for three output samples on the development machine.

## Restrictions

This freeze establishes numerical CPTP construction for the implemented dense
gate-aware maps. It does not establish calibrated hardware predictive validity,
non-Markovian dynamics, arbitrary gate generators, or projective measurement
semantics. Dense Liouville-space exponentials become expensive as qubit count
and the number of distinct intervals increase.

## Source and tag rule

The source commit for this freeze is the commit carrying this document and the
Gate-aware CPTP implementation. The tag must point directly to that commit.
Unrelated working-tree changes are intentionally excluded from the freeze.
