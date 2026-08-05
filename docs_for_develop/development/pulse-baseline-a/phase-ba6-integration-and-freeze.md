# BA-6: API Integration and Baseline Freeze

**Status:** Complete

## 1. Goal

Integrate the validated two-level pulse path behind its dedicated API, freeze
the Baseline A contract, and publish a complete validation report without
changing the existing gate-level behavior.

## 2. Prerequisites

- BA-0 through BA-5 are complete.
- Recommended step-policy parameters and tolerances are documented.
- All required validation artifacts exist.

## 3. In Scope

- Functional `/api/pulse/simulate`
- Versioned request and response contract
- Model metadata and limitations
- API contract and smoke tests
- Consolidated Baseline A report
- Complete regression run
- Freeze decision

## 4. Out of Scope

- Full Pulse Lab UI
- Qutrit model selection
- Leakage visualization
- DRAG controls
- Multi-qubit pulse sequences
- Rust time-dependent backend

## 5. API Integration Requirements

The endpoint must:

- Require `driven_two_level_rwa_experimental_v1`.
- Preserve the BA-0 `physical` and `direct_rates` discrimination.
- Keep pulse duration separate from total observation duration.
- Report internal units, frame, approximation, and model ID.
- Report pulse-end and final-time results separately.
- Return actionable validation errors for incompatible inputs.
- Apply bounded execution and timeout handling.
- Leave `/api/simulate` unchanged.

Do not reuse the gate-level endpoint with ambiguous optional pulse fields.

## 6. Response Requirements

The response should provide enough data for a later Pulse Lab UI without
claiming qutrit support:

```text
model identity
frame and approximation
sample times
closed and open trajectory metrics
|0> and |1> populations
fidelity and purity
pulse-end state
final state
derived or direct rates
step-policy diagnostics
raw and cleaned physicality diagnostics
warnings and limitations
```

The exact contract is frozen in API tests and documentation at this phase.

## 7. Consolidated Regression Gate

Run:

1. V1-V7 physical validations
2. All BA-0 through BA-5 tests
3. Pulse API schema tests
4. Pulse API success and rejection smoke tests
5. Full Python unit-test discovery
6. Frontend production build
7. `git diff --check`

The existing gate-level numerical results and `/api/simulate` response contract
must remain unchanged.

## 8. Documentation Deliverables

Create:

```text
docs/validation/pulse-baseline-a-report.md
docs/physics/pulse-baseline-a-model.md
docs/architecture/pulse-api-contract.md
```

The consolidated report must include:

- Physics conventions
- Numerical method
- Step policy
- Cleanup policy
- Analytic validation
- QuTiP comparison
- API behavior
- Regression results
- Performance observations
- Scope and limitations

## 9. Freeze Criteria

Baseline A can be frozen only when:

- Rotating frame, RWA, detuning, phase, and units are fixed.
- Constant and time-dependent paths remain separate.
- Square and Gaussian pulses pass analytic validation.
- Phase and detuning signs are verified beyond populations alone.
- Dissipation during pulse and post-pulse idle is validated.
- PULSE-CONV-2LEVEL is complete.
- QuTiP comparison passes fixed tolerances.
- V1-V7 and the existing API remain unchanged.
- The experimental and non-calibrated nature of the model is visible.

## 10. Handoff to Extension B

After the freeze, Pulse Extension B may add:

- Three-level transmon state space
- Transition-specific qutrit dissipation
- Leakage metrics
- PULSE-CONV-QUTRIT
- DRAG
- Qutrit QuTiP comparison
- Full Pulse Lab UI

Extension B must consume the frozen Baseline A contracts without rewriting the
validated two-level path.

## 11. Implementation

BA-6 added:

```text
api/pulse_models.py
api/pulse_service.py
core/pulse_step_policy.py
validation_pulse/baseline_freeze.py
scripts/validate_pulse_baseline_a_freeze.py
tests/test_pulse_api_baseline_a.py
tests/test_pulse_ba6_freeze.py
docs/physics/pulse-baseline-a-model.md
docs/architecture/pulse-api-contract.md
docs/validation/pulse-baseline-a-report.md
```

`POST /api/pulse/simulate` now executes the frozen two-level path. It supports
strict `physical` and `direct_rates` requests, returns separate pulse-end and
final states, exposes raw and cleaned physicality diagnostics, and includes
the zero-rate reference trajectory.

Execution is bounded by:

```text
maximum concurrent pulse requests: 2
API wait timeout: 15 seconds
maximum estimated internal steps: 200,000
```

The pre-existing `POST /api/simulate` endpoint and its request/response
contract were not repurposed.

## 12. Freeze Audit

The consolidated audit is:

```text
validation_results/pulse_baseline_a_freeze.json
```

It records:

- package and Python versions,
- the frozen physical and numerical conventions,
- SHA-256 hashes and pass flags for 12 prerequisite artifacts,
- direct-rate and physical-input API smoke summaries,
- coexistence of the gate and pulse endpoints,
- the canonical Pulse OpenAPI contract hash.

The Pulse OpenAPI hash at freeze is:

```text
5ae21f2d5f4d7e546e5ba689c7869b70edd0f432835dcfe817dc31f4732dc39b
```

## 13. Verification Results

All V1-V7 and BA2-BA5 validation scripts were rerun successfully on
2026-07-23. The final regression results were:

```text
Python unit tests: 393 passed in 88.796 s
Frontend production build: passed
Pulse API/freeze target tests: 32 passed
Scoped git diff check: passed
```

The full repository `git diff --check` still reports a pre-existing trailing
whitespace issue in `frontend/src/pages/HomePage.tsx`; BA-6 does not modify
that file or fold the unrelated cleanup into this freeze.

## 14. Freeze Decision

Pulse Baseline A is frozen as:

```text
model_id: driven_two_level_rwa_experimental_v1
contract_version: pulse-baseline-a-v1
```

The freeze is accepted for an experimental educational two-level model. It
does not claim hardware calibration, qutrit leakage support, DRAG,
multi-qubit pulse control, strict finite-step CPTP evolution, or a Rust
time-dependent backend.
