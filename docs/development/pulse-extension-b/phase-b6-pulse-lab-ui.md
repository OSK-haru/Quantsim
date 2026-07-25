# B-6: Pulse Lab Experimental UI

**Status:** Complete (2026-07-23)

## 1. Goal

Add a separate Pulse Lab view that exposes the validated two-level and qutrit
pulse models without making the circuit simulation workspace text-heavy or
implying calibrated hardware reproduction.

## 2. Prerequisites

- B-5 QuTiP comparison and API gate pass.
- Qutrit API errors and execution limits are stable.
- Baseline A remains available.

## 3. Route and Positioning

Add an independent view using the existing lightweight navigation approach:

```text
/pulse-lab
Pulse Lab / Experimental
```

Do not add a routing dependency.

Always display:

```text
Rotating-frame RWA control-envelope experimental model.
Not a calibrated hardware model.
```

## 4. Inputs

Beginner-visible inputs:

- Model: two-level or qutrit
- Envelope: square or Gaussian
- Target angle or peak amplitude
- Pulse duration
- Total simulation time
- Phase
- Detuning
- Environment mode and its active fields

Qutrit-only inputs:

- Anharmonicity [MHz]
- DRAG beta [$\mu$s]

Expert details may include:

- direct transition rates,
- qutrit dephasing rate,
- internal-step cap,
- snapshot count.

Inactive-mode and inactive-model fields must be hidden or disabled and must
not be sent silently.

## 5. Visualizations

Always-visible core results:

- pulse waveform $\Omega_x(t)$ and $\Omega_y(t)$,
- state populations over time,
- fidelity and purity,
- pulse-end and final summaries.

Qutrit results:

- $P_0$, $P_1$, and $P_2$,
- leakage timeline,
- maximum, pulse-end, and final leakage,
- 3x3 density-matrix heatmap.

A standard Bloch sphere is not a complete qutrit representation. If shown for
qutrit mode, label it:

```text
Computational-subspace Bloch projection
Not a complete representation of the qutrit state
```

Do not silently renormalize away leakage. If a normalized computational
projection is offered, show the normalization choice explicitly.

Secondary details should use compact drawers:

- model and approximation details,
- rates and thermal occupations,
- step-policy diagnostics,
- raw physicality,
- API debug fields,
- warnings and limitations.

## 6. Interaction and Error Behavior

- Keep the previous valid result visible on request failure.
- Show validation errors next to the relevant field.
- Warn before a costly request and reject requests beyond the API budget.
- Disable Run only for invalid inputs or an active request.
- Preserve the application routes, but do not present Circuit Studio or the
  gate-aware State Explorer as Pulse Lab tools. Pulse Lab may link back to the
  gate-aware simulation only as an explicit model switch.
- Provide keyboard-accessible controls and meaningful button text.

## 7. Out of Scope

- Arbitrary pulse sequences
- Multi-qubit pulse editor
- Laboratory-frame carrier waveform
- Hardware calibration upload
- Drag-and-drop pulse programming
- Rust backend selector

## 8. Likely Files

```text
frontend/src/pages/PulseLabPage.tsx
frontend/src/pages/PulseLabPage.css
frontend/src/components/PulseParameterPanel.tsx
frontend/src/components/PulseWaveform.tsx
frontend/src/components/PulsePopulationTimeline.tsx
frontend/src/types/pulse.ts
frontend/src/App.tsx
```

Reuse small established result components where their semantics match. Do not
force qutrit data into two-level-only types.

## 9. Tests and Manual Checks

- TypeScript build and lint
- Two-level request preserves Baseline A payload
- Qutrit request sends the qutrit model discriminator
- Model-specific inputs are included only when active
- API 422/timeout/error states preserve the last valid result
- Waveform phase and DRAG quadrature are visible
- Leakage is not hidden by computational-subspace normalization
- Mobile and desktop layouts remain usable
- Existing routes still open and return correctly

## 10. Completion Criteria

- The Pulse Lab is clearly separate from circuit-level simulation.
- Users can distinguish pulse duration from total observation time.
- Qutrit leakage is visible and correctly labeled.
- The qutrit Bloch projection cannot be mistaken for the full state.
- No unvalidated numerical control is presented as a safe default.
- No external frontend dependency is added.

## 11. Stop Conditions

Do not ship the UI if it exposes qutrit execution before B-5 passes, hides
qutrit leakage through normalization, or presents the model as calibrated
hardware reproduction.

## 12. Completion Record

B-6 adds the independent `/pulse-lab` view without a routing or visualization
dependency. The view supports both frozen Baseline A and the available qutrit
model through `POST /api/pulse/simulate`.

Implemented behavior:

- model, envelope, amplitude, timing, phase, detuning, and environment inputs,
- qutrit-only anharmonicity and Gaussian DRAG controls,
- model-specific payload omission for inactive fields,
- conservative client-side qutrit work-budget rejection,
- rotating-frame X/Y control-envelope visualization,
- two-level and qutrit population, purity, and fidelity timelines,
- explicit qutrit leakage summaries without subspace renormalization,
- qutrit 3x3 final density-matrix heatmap,
- compact model, rate, physicality, warning, and API drawers,
- inline validation and preservation of the previous valid response on failure,
- explicit navigation to Home, Help, and the separately labeled gate-aware
  simulation,
- no Pulse Lab links to Circuit Studio or the gate-aware State Explorer,
- a visible statement that Pulse Lab is a single-pulse experiment and does
  not consume the edited circuit.

The page always identifies the calculation as a rotating-frame RWA
experimental model and not a calibrated hardware model. No Bloch sphere is
shown for qutrit results, so a two-level projection cannot be mistaken for the
complete qutrit state.

Verification:

```text
npm.cmd run validate:pulse-lab  PASS
npm.cmd run lint                PASS
npm.cmd run build               PASS
GET /pulse-lab                  HTTP 200 through Vite
qutrit API smoke                PASS (pulse-extension-b-v1, 3x3 final state)
```

Detailed evidence is recorded in
[`../../validation/pulse-b-pulse-lab-ui.md`](../../validation/pulse-b-pulse-lab-ui.md).
