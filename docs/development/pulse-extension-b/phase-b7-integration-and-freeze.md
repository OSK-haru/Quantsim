# B-7: Extension B Integration and Freeze

**Status:** Complete (2026-07-23)

## 1. Goal

Integrate and audit all Extension B work, freeze the qutrit contract and model
identity, publish reproducible evidence, and confirm that gate-aware and
Baseline A behavior remain unchanged.

## 2. Prerequisites

- B-0 through B-6 are complete.
- All numerical tolerances and cost limits are documented.
- Required JSON/CSV/figure artifacts exist.
- Pulse Lab manual checks pass.

## 3. In Scope

- Final qutrit API contract
- Consolidated physics and numerical documentation
- Full regression run
- Performance and execution-budget report
- Model limitations and UI labels
- Extension B freeze artifact
- Handoff to later CPTP and Rust phases

## 4. Required Final Documents

Create or update:

```text
docs/physics/pulse-extension-b-qutrit-model.md
docs/architecture/pulse-api-contract.md
docs/validation/pulse-extension-b-report.md
docs/README.md
```

The final report must include:

- basis and Hamiltonian conventions,
- anharmonicity and unit conversion,
- qutrit collapse operators,
- dephasing limitation,
- step and cleanup policy,
- closed and open-system analytic checks,
- qutrit convergence,
- DRAG evaluation,
- QuTiP comparison,
- API and UI behavior,
- performance observations,
- scope and limitations.

## 5. Freeze Artifact

Produce:

```text
validation_results/pulse_extension_b_freeze.json
```

It should record:

```text
model_id
contract_version
source revision
dependency versions
required artifact hashes
required artifact pass flags
OpenAPI contract hash
two-level and qutrit API smoke summaries
regression command results
performance budget
limitations
```

## 6. Consolidated Regression Gate

Run:

1. Gate-aware V1-V7 validations
2. Pulse Baseline A validations and freeze audit
3. B-0 through B-5 numerical and API tests
4. B-6 frontend lint, build, and manual route checks
5. Full Python test discovery
6. Markdown link audit
7. `git diff --check`

Recommended commands:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests
cd frontend
npm.cmd run lint
npm.cmd run build
```

## 7. Freeze Criteria

Freeze only when:

- `driven_transmon_qutrit_rwa_experimental_v1` is unambiguous,
- the final contract version is fixed,
- leakage metrics are consistent across core, API, and UI,
- qutrit dissipation passes analytic and equilibrium checks,
- non-DRAG and DRAG convergence are demonstrated,
- QuTiP comparison passes fixed tolerances,
- raw physicality and cleanup corrections are reported honestly,
- API execution is bounded,
- Baseline A results and payload behavior are unchanged,
- the UI states that the model is experimental and uncalibrated.

## 8. Performance Decision

Record at least:

- representative closed qutrit runtime,
- dissipative qutrit runtime,
- DRAG runtime,
- internal-step counts,
- API queue/timeout behavior,
- memory observations,
- rejected over-budget example.

Do not raise work limits solely to make a demonstration request pass.

## 9. Handoff

After B-7, separately approve:

```text
strict CPTP event/solver phase
Rust time-dependent backend phase
external observable validation (V8)
```

Rust should reproduce the frozen Python/NumPy qutrit contract rather than
co-evolve with an unstable model definition.

## 10. Completion Decision

The final decision must be one of:

```text
PASS
PASS WITH RESTRICTIONS
FAIL / RETURN TO PHASE
```

Document unresolved limitations explicitly. Extension B completion does not
claim real-device calibration, multi-qubit pulse control, strict finite-step
CPTP evolution, or a Rust production backend.

## 11. Completion Record

Final decision:

```text
PASS WITH RESTRICTIONS
```

Completed gates:

- Gate-aware V1-V7 regenerated and passed.
- Pulse Baseline A analytic, convergence, QuTiP, and freeze audits passed.
- Extension B closed qutrit, dissipation, convergence, DRAG, and eight-case
  QuTiP validations passed.
- Full Python discovery passed 471 tests.
- Pulse Lab contract, ESLint, TypeScript, Vite build, and route probe passed.
- The canonical Extension B Markdown audit found no broken local links.
- Two-level, qutrit direct-rate, qutrit physical-mode, and over-budget API
  smoke checks passed.
- Required validation files and documents were SHA-256 audited.

One integration defect was found and fixed: VALIDATION-7 emitted
`purity_difference` but omitted that field from its CSV schema. The export
contract was synchronized and protected by a regression test. No physics
equation or solver behavior changed.

Frozen outputs:

```text
docs/physics/pulse-extension-b-qutrit-model.md
docs/validation/pulse-extension-b-report.md
validation_results/pulse_extension_b_freeze.json
validation_results/pulse_extension_b_regression.json
validation_results/pulse_extension_b_markdown_links.json
```

The qutrit core recommendation remains 25,000 internal steps and the public
HTTP ceiling remains 4,000. B-7 did not raise either limit.
