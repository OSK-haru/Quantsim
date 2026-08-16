# Pulse API Contract

## Identity

```text
endpoint: POST /api/pulse/simulate
contract_versions: pulse-baseline-a-v1 | pulse-extension-b-v1 | pulse-coupled-pair-v1 | pulse-transmon-network-v1
model_ids:
  driven_two_level_rwa_experimental_v1
  driven_transmon_qutrit_rwa_experimental_v1
  driven_coupled_transmon_pair_rwa_experimental_v1
  driven_coupled_transmon_network_rwa_experimental_v1
status: experimental
```

This endpoint is intentionally separate from `POST /api/simulate`. Pulse
fields are not accepted by the gate-aware endpoint, and the pulse endpoint
does not accept circuit payloads.

## Request

The top-level request contains:

| Field | Meaning |
|---|---|
| `model_id` | One of the four `model_ids` above. It selects the contract version, and the accepted pulse/network/environment fields follow from it. |
| `initial_state` | `"0"` or `"1"` |
| `pulse` | Envelope, amplitude, phase, and detuning |
| `total_simulation_time_us` | Pulse plus optional observation/idle time |
| `environment` | Exactly one of `physical` or `direct_rates` |
| `snapshot_options` | Uniform and custom output times |

Unknown fields are rejected.

### Square Pulse Example

```json
{
  "model_id": "driven_two_level_rwa_experimental_v1",
  "initial_state": "0",
  "pulse": {
    "shape": "square",
    "amplitude_mode": "target_rotation_angle",
    "target_rotation_angle_rad": 3.141592653589793,
    "pulse_duration_us": 0.2,
    "phase_rad": 0.0,
    "detuning_rad_per_us": 0.0
  },
  "total_simulation_time_us": 0.6,
  "environment": {
    "input_mode": "direct_rates",
    "gamma_down_per_us": 0.1,
    "gamma_up_per_us": 0.02,
    "gamma_phi_per_us": 0.05
  },
  "snapshot_options": {
    "uniform_count": 101,
    "custom_times_us": [0.2]
  }
}
```

### Gaussian Timing

For `shape: "gaussian"`, the request supplies `sigma_us` and
`truncation_sigma`. `pulse_duration_us` is rejected because duration is
derived as:

$$
\tau_p=2N_\mathrm{trunc}\sigma.
$$

The derived pulse duration must not exceed `total_simulation_time_us`.

### Amplitude Modes

Exactly one amplitude definition is active:

- `target_rotation_angle` requires `target_rotation_angle_rad`.
- `peak_amplitude` requires `peak_amplitude_rad_per_us`.

Supplying the inactive field is rejected. `drag_beta_us` is reserved but must
be zero in Baseline A.

### Environment Modes

`physical` requires:

```text
device_quality
temperature_mk
flux_noise_phi0
qubit_frequency_ghz
t1_max_us
tphi_max_us
```

`direct_rates` requires:

```text
gamma_down_per_us
gamma_up_per_us
gamma_phi_per_us
```

Fields from the inactive mode are rejected.

## Successful Response

The response contains:

| Section | Contents |
|---|---|
| `contract_version` | Frozen response version |
| `model` | Identity, frame, approximation, levels, and units |
| `input` | Normalized pulse and timing summary |
| `rates` | Canonical rates and effective times |
| `step_policy` | Limits, controls, and estimated work |
| `sample_times_us` | Sorted, deduplicated global output times |
| `trajectory` | Open/reference populations, fidelity, purity, physicality |
| `pulse_end` | Pulse-boundary metrics and both density matrices |
| `final` | End-of-observation metrics and both density matrices |
| `diagnostics` | Runtime, step counts, RHS evaluations, raw/cleaned checks |
| `warnings` | Input-specific and numerical warnings |
| `limitations` | Model boundaries visible to clients |

Complex matrix elements use:

```json
{"real": 0.5, "imag": -0.25}
```

`pulse_end` and `final` are always separately named. They coincide only when
there is no post-pulse idle interval or when the state does not change during
that interval.

## Errors And Execution Bounds

| Status | Meaning |
|---|---|
| `422` | Schema, timing, mode, or internal-step-budget rejection |
| `503` | Both pulse execution slots are busy |
| `504` | Execution exceeded the 15-second API wait timeout |
| `500` | Structured unexpected execution failure |

The endpoint allows at most two concurrent pulse jobs. Baseline A rejects work
estimated above 200,000 total internal steps; the qutrit path uses the
25,000-step ceiling described below. A timeout response states that previous
client results should remain visible; cancellation of already-running Python
work is best-effort.

## Freeze And Compatibility

The OpenAPI path plus every `Pulse*` schema is canonicalized and SHA-256
hashed by:

```powershell
.\.venv\Scripts\python.exe scripts\validate_pulse_baseline_a_freeze.py
```

The frozen BA-6 artifact records the hash and smoke-test summaries under:

```text
validation_results/pulse_baseline_a_freeze.json
```

Changing required fields, response fields, units, model identity, or semantics
requires a new contract version. Adding Pulse Extension B must not repurpose
`pulse-baseline-a-v1`.

## Extension B Qutrit Contract

B-7 freezes the qutrit identity:

```text
model_id: driven_transmon_qutrit_rwa_experimental_v1
contract_version: pulse-extension-b-v1
capability status: available
```

The endpoint uses a `model_id` discriminator. Qutrit requests support square
and Gaussian envelopes, Gaussian DRAG, physical or transition-specific direct
rates, and return all three populations, leakage, 3x3 density snapshots,
step policy, and raw/cleaned physicality diagnostics.

B-5 connected this request only after all eight shared 3x3 QuTiP cases passed,
and B-7 froze its contract after the consolidated regression gate.
The Baseline A request and `pulse-baseline-a-v1` response remain unchanged.
Qutrit responses use `pulse-extension-b-v1`.

The qutrit HTTP work ceiling is 25,000 internal RK4 steps, shared with the
core validation ceiling. Requests over the HTTP ceiling receive an actionable
`422` before numerical execution.

## Pulse Coupled Transmon Pair Contract

```text
model_id: driven_coupled_transmon_pair_rwa_experimental_v1
contract_version: pulse-coupled-pair-v1
capability status: experimental
```

The same `POST /api/pulse/simulate` endpoint serves this model via the
`model_id` discriminator. It simulates two coupled two-level transmons with
exchange coupling in the rotating frame under RWA. An independent QuTiP
comparison and a numerical audit both report PASS.

## Pulse Coupled Transmon Network Contract

```text
model_id: driven_coupled_transmon_network_rwa_experimental_v1
contract_version: pulse-transmon-network-v1
capability status: experimental
transmon_count: 2..4
```

The network request supplies per-transmon frequencies, anharmonicities and
base detunings; unique exchange-coupling edges; and scheduled local drives
with targets and start times. Drives may overlap. Pulse detuning is represented
as a phase ramp in the target's local rotating frame. The implementation uses
three local levels and q0-most-significant tensor-basis order.

The network path is fixed-step RK4 only, and it always integrates with the
NumPy dense kernel: the request still accepts `backend`, but that field selects
the python or rust kernel for the other pulse models only, and the network
response reports `numpy_dense` as the resolved backend. Jump operators are
applied through the register's tensor structure rather than as dense products,
which is what keeps four transmons affordable.

Before allocating the full response, the service enforces
`steps * (hilbert_dimension^3 + 12_000) <= 1_200_000_000` and
`sample_count * hilbert_dimension^2 <= 250_000`. The per-step overhead term
records that one internal step costs a fixed setup plus dense work, so the same
budget bounds runtime at every register size: roughly 94,000 two-transmon,
37,000 three-transmon, or 2,200 four-transmon internal steps.

Drive start and end times are always integration boundaries, and the provider
resolves the active drive set per segment. A drive edge inside a segment is an
error rather than a silent loss of accuracy, because a pulse that switches
inside a step is only seen by part of the RK4 stages.

Validation: core invariants, API regression tests, solver-independent physics
checks (analytic exchange oscillation, closed-system purity and excitation
number, agreement with the single-qutrit model in the uncoupled limit) and an
independent QuTiP audit over two to four transmons
(`scripts/validate_pulse_transmon_network_qutip.py`, artifact
`validation_results/pulse_transmon_network_qutip_audit.json`).

Current capability meanings:

```text
available      numerical API execution is implemented
contract_only  identity and validation contract exist, execution is withheld
```
