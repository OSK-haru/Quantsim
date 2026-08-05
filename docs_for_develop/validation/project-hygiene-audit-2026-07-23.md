# Project Hygiene Audit 2026-07-23

## Result

The repository was audited against the current React/FastAPI, gate-aware
1-4 qubit, state snapshot, dense backend, and Pulse Baseline A implementation.

The audit found and corrected three classes of stale material:

1. Streamlit-era documents presented without a historical status.
2. Pre-migration paths and feature limits such as `app/`, `validation/`, and
   1-2 qubit assumptions.
3. Executable files left behind after the original one-qubit MVP modules were
   removed.

## Deleted Dead Or Redundant Files

```text
scripts/plot_results.py
test1.py
docs/development/phase0_mvp_freeze.md
docs/physics/監査方針/validation1_zero_dissipation_ideal_gate_codex_prompt.md
docs/physics/監査方針/validation2_zero_temperature_thermal_excitation_codex_prompt.md
docs/physics/監査方針/validation3_excited_state_exponential_decay_codex_prompt.md
docs/physics/監査方針/validation4_pure_dephasing_codex_prompt.md
docs/physics/監査方針/validation5_finite_temperature_thermal_equilibrium_codex_prompt.md
docs/physics/監査方針/validation6_time_step_convergence_codex_prompt.md
docs/physics/監査方針/validation7_qutip_comparison_codex_prompt (1).md
```

`scripts/plot_results.py` imported the removed `core.evolution` module and
could not run. `test1.py` duplicated the maintained public API smoke tests
under `tests/`. The empty MVP document carried no information. The V1-V7 task
prompts duplicated final reports, scripts, tests, and artifacts.

## Rewritten Current Documents

- Added `docs/README.md` as the current implementation and documentation index.
- Replaced the obsolete Streamlit module tree in
  `docs/architecture/module_structure.md`.
- Replaced pre-FastAPI decisions in `docs/requirements/Open-Questions.md`.
- Replaced the original verification roadmap with a V1-V7/Pulse evidence
  index that clearly marks V8 as planned.
- Replaced the Vite template `frontend/README.md`.
- Updated backend, qubit-count, config, pulse, and validation paths in current
  architecture and model documents.

## Retained Historical Documents

Large Phase 3-8 Streamlit plans, the original MVP specification, the React
physical-input migration spec, and completed circuit-editor plans were not
deleted because they preserve design history. Each now has an explicit
Historical, Implemented, or Superseded status and links to the current source
of truth.

Historical documents must not be used as current launch instructions or
feature matrices.

## Code Reference Audit

- Missing local Python imports: 0.
- Isolated frontend TypeScript modules: 0.
- Unreferenced public Python top-level candidates: only
  `api.main.simulation_example`.
- `simulation_example` is retained because FastAPI registers it as
  `GET /api/simulation/example`.
- Broken local Markdown links: 0.

Three React lifecycle lint findings were also corrected without changing API
payloads or simulation behavior:

- The circuit-column jump field now reads its submitted form value instead of
  synchronizing local state in an effect.
- Selected-column reveal runs on the next animation frame.
- Initial API example loading uses an Effect Event and runs on the next
  animation frame.

## Verification

The final repository state passed:

```text
python -m unittest discover -s tests
393 tests passed

cd frontend
npm.cmd run lint
passed

cd frontend
npm.cmd run build
passed

git diff --check
passed (line-ending notices only)
```

The UTF-8-aware local Markdown-link scan also reported 0 broken links.

## Canonical Current Entry Points

```text
README.md
docs/README.md
frontend/README.md
docs/architecture/module_structure.md
docs/physics/model_identity.md
docs/physics/pulse-baseline-a-model.md
docs/validation/pulse-baseline-a-report.md
```

## Policy Going Forward

- Update `docs/README.md` when a feature crosses from planned to implemented.
- Mark phase plans historical when complete; do not leave future-tense
  statements unqualified.
- Remove task prompts after equivalent reproducible scripts, tests, reports,
  and artifacts exist.
- Keep validation helpers in `validation_pulse/`, scripts in `scripts/`, and
  machine-readable evidence in `validation_results/`.
- Run Markdown link, local import, full unit-test, frontend lint/build, and
  `git diff --check` audits before a major implementation freeze.
