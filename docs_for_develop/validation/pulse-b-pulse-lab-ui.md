# Pulse Extension B: Pulse Lab UI Validation

**Phase:** B-6
**Date:** 2026-07-23
**Result:** Pass

## Scope

This validation covers the independent `/pulse-lab` frontend added for the
frozen two-level pulse baseline and the qutrit Pulse Extension B model. It does
not revalidate the physical equations established in B-1 through B-5.

## Implemented Boundary

- Requests use the existing `POST /api/pulse/simulate` contract.
- Two-level and qutrit model discriminators remain explicit.
- Inactive model, envelope, and environment fields are omitted from payloads.
- Qutrit requests are blocked in the client when the conservative estimate
  exceeds the API's 4,000-internal-step work gate.
- Previous valid results remain visible after validation, timeout, HTTP, or
  response-shape failures.
- The page labels the model as rotating-frame RWA, experimental, educational,
  and not hardware calibrated.

## Automated Checks

Run from `frontend/`:

```powershell
npm.cmd run validate:pulse-lab
npm.cmd run lint
npm.cmd run build
```

All three commands passed.

The Pulse Lab contract script checks:

- qutrit payloads include anharmonicity and active DRAG data,
- two-level payloads exclude qutrit-only data,
- inactive Gaussian and direct-rate fields do not leak into requests,
- a known over-budget qutrit case is rejected,
- nonzero DRAG produces a visible Y quadrature,
- zero-phase, zero-DRAG control has no spurious Y quadrature.
- Pulse Lab has no direct Circuit Studio or gate-aware State Explorer
  callbacks,
- the single-pulse scope boundary remains visible.

## HTTP Smoke Checks

- Vite served `GET /pulse-lab` with HTTP 200.
- A qutrit request returned `pulse-extension-b-v1`.
- The returned model was qutrit and contained 21 trajectory snapshots.
- The final density matrix had shape 3x3.
- The API reported 900 estimated internal steps, below the 4,000-step limit.
- Final leakage was returned and displayed without computational-subspace
  renormalization.

## Visual And Interaction Coverage

The implementation provides:

- active-field parameter editing and inline validation,
- X/Y drive waveform with pulse-end and idle-observation distinction,
- two-level and qutrit population timelines,
- qutrit leakage timeline and pulse-end/final/maximum summaries,
- qutrit 3x3 final density-matrix heatmap,
- compact drawers for model, rates, diagnostics, warnings, and API details,
- responsive desktop and mobile CSS,
- keyboard-native buttons, selects, inputs, and drawer controls.

Responsibility-boundary follow-up:

- Pulse Lab is explicitly labeled as a single-pulse experiment.
- Circuit Studio is explicitly labeled as gate-aware and is not linked from
  Pulse Lab.
- State Explorer is explicitly labeled as displaying `/api/simulate`
  gate-aware snapshots only.
- Pulse responses remain inside Pulse Lab and are not passed to the
  gate-aware State Explorer.

Automated in-app browser control was unavailable in this environment because
its Node runtime path could not be started. Consequently, visual pixel-level
and interactive browser checks remain a manual B-7 integration check. The
production build, route HTTP probe, payload checks, and live API smoke test
passed.

## Exclusions

B-6 does not add pulse drag-and-drop, pulse sequences, multi-qubit pulse
control, hardware calibration, laboratory-frame carriers, a Rust selector, or
new frontend dependencies.
