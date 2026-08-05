# Circuit Probe and Physical Timeline Audit

Date: 2026-08-02
Branch: `React-phase`

This audit reconciles the current repository with the Quirk-like video. The key distinction is that Quirk's changing demonstration parameter is not the same thing as QuantaScope's physical solver time.

## Audit table

| Concern | Intended meaning | Actual implementation | Evidence | Status | Risk | Recommended action |
|---|---|---|---|---|---|---|
| Stable simulation entry point | One config-to-result boundary | Gate-aware execution flows through `run_simulation` and returns `SimulationResult` | `core/simulator.py`: `run_simulation`; `core/results.py`: `SimulationConfig`, `SimulationResult` | Already implemented | Low | Preserve boundary |
| Current backend architecture | Python/Rust share response semantics | Model registry selects Gate-aware runner; `simulation_backend` selects Python dense or optional Rust kernel with fallback | `core/simulation_backends.py`: `register_simulation_backend`; `core/backend_boundary.py`: `backend_metadata` | Already implemented | Medium | Keep timeline backend-neutral |
| Gate-aware versus pulse-level separation | Different physical model domains | Gate-aware uses `/api/simulate`; Pulse uses `/api/pulse/simulate` and separate pulse services/models | `api/main.py`: `simulate`, `pulse_simulate`; `api/pulse_models.py`: `PulseApiRequest` | Already implemented | Low | Do not share schemas silently |
| Circuit column representation | Logical circuit position | `CircuitConfig.columns` contains `GateColumn(step, gates)` | `core/circuit_model.py`: `CircuitConfig`, `GateColumn` | Already implemented | Low | Use column boundaries for probes |
| Operation identity | Stable gate identity for UI | Editor gates have frontend `CircuitGate.id`; backend `GateOperation` has no persistent id | `frontend/src/types/circuit.ts`: `CircuitGate.id`; `core/circuit_model.py`: `GateOperation` | Partially implemented | Medium | Use column/source mapping until backend gate IDs are required |
| Gate-duration representation | Declared physical duration | `params.duration_us` overrides defaults; API supplies `GateDurationDefaultsRequest` | `core/gates.py`: `gate_duration_us`; `api/main.py`: `GateDurationDefaultsRequest` | Already implemented | Low | Expose declared duration as metadata |
| Column-duration semantics | One physical duration per solver column | Maximum gate duration in a column | `core/gates.py`: `column_duration_us` | Already implemented | High if misrepresented | Keep column event active for full duration |
| Parallel-gate semantics | Match actual solver | Parallel gates are combined into one column unitary/effective Hamiltonian | `core/simulator.py`: `_gate_aware_segments` | Already implemented | High | Do not show shorter gates finishing independently |
| Idle-time semantics | Noise after circuit completion | Actual duration is max(requested duration,total gate duration); remainder is idle evolution | `core/simulator.py`: `_simulate_circuit_gate_aware_hamiltonian` | Already implemented | Low | Expose explicit `idle` event |
| Physical simulation time grid | Solver time, not UI time | `SimulationResult.times` comes from `_simulation_times` and `_time_grid` | `core/simulator.py`: `_time_grid`, `_simulation_times` | Already implemented | Low | Use as physical timeline source |
| Ideal-state history | Same circuit without environment noise | Response conversion reruns config with `ideal_reference=True` | `core/ui_response.py`: `_ideal_reference_data` | Already implemented | Medium runtime | Keep ideal/noisy histories parallel |
| Noisy-state history | Backend-produced noisy states | Bounded `StateSnapshot` list with semantic event kinds | `core/state_snapshots.py`: `StateSnapshotCollector`; `core/results.py`: `SimulationResult.state_snapshots` | Already implemented | Payload bound | Never synthesize missing states in React |
| Fidelity timeline | Fidelity versus physical time | API `timeline[].time_us/fidelity` | `core/ui_response.py`: `_timeline`; `frontend/src/types/simulation.ts`: `MetricPoint` | Already implemented | Low | Cursor now shares simulation time |
| Purity timeline | Purity versus physical time | API `timeline[].time_us/purity` | `core/ui_response.py`: `_timeline`; `frontend/src/components/MetricTimeline.tsx`: `MetricTimeline` | Already implemented | Low | Cursor now shares simulation time |
| Density-matrix history | Full state at selected boundaries | Serialized real/imag matrices, bounded by snapshot policy | `core/state_snapshots.py`: `serialize_state_snapshots`; `frontend/src/components/DensityMatrixViewer.tsx` | Already implemented | 4^n payload growth | Select nearest snapshot only |
| Reduced-density-matrix support | Local state for each qubit | Frontend derives reduced local states from density snapshot | `frontend/src/utils/blochSphere.ts`: `blochStatesFromSnapshot` | Already implemented under another name | Low | Do not label global entangled state as one Bloch sphere |
| Bloch-vector support | Local Bloch vectors | `BlochSphereExplorer` renders each reduced qubit state | `frontend/src/components/BlochSphereExplorer.tsx` | Already implemented | Low | Reuse for probe snapshots |
| Measurement semantics | Actual measurement meaning | Main trajectory uses non-selective computational measurement; conditional execution also computes bounded classical branches | `core/gates.py`: `apply_non_selective_computational_measurement`; `core/classical_branching.py`; `core/simulator.py`: `execute_classical_branches` | Already implemented | High communication risk | Label ensemble branches accurately |
| Deferred-measurement support | Quirk-style coherent/deferred behavior | No dedicated deferred-measurement mode was found | `rg deferred_measurement` repository search; `core/circuit_model.py`: `GateOperation` | Not implemented | High | Do not claim deferred measurement |
| Classical-bit support | Store measurement bits | Classical targets, conditions, branch records and shot previews exist | `core/circuit_model.py`: `ClassicalCondition`, `GateOperation.conditions`; `frontend/src/types/simulation.ts`: `MeasurementResult` | Already implemented | Medium | Reuse existing branch records |
| Conditional-gate support | Classical feed-forward | Conditions are executed through bounded branch evolution/statevector branches | `core/classical_branching.py`; `core/statevector.py`: `execute_statevector_branches` | Already implemented | Medium | Keep branch UI ensemble-based |
| API response schema | Additive probe/timeline fields | Response now includes optional frontend `physical_timeline` and `circuit_probes` plus existing fields | `core/ui_response.py`: `simulation_result_to_ui_response`; `frontend/src/types/simulation.ts`: `SimulationResponse` | Already implemented | Low | Keep fields additive |
| Frontend response types | Match API without requiring old fixtures to change | `physical_timeline` and `circuit_probes` are optional | `frontend/src/types/simulation.ts`: `PhysicalTimeline`, `CircuitProbe`, `SimulationResponse` | Already implemented | Low | Preserve fixture fallback |
| Existing playback implementation | Physical-time playback | `PhysicalTimelinePlayback` uses backend timeline; it is not a Quirk parameter animation | `frontend/src/components/PhysicalTimelinePlayback.tsx` | Already implemented | Low | Keep separate labels |
| Existing probe implementation | Select logical circuit boundary | New read-only probe selector uses available snapshot references | `frontend/src/components/CircuitProbeView.tsx`; `core/ui_response.py`: `_circuit_probes` | Minimum safe foundation implemented | Medium | Add all boundaries only if snapshot policy permits |
| Existing animated-parameter implementation | Reevaluate whole circuit for changing λ | Explicit `animation_parameter.name/value/column_index/gate_index` is accepted by `/api/simulate`; the frontend throttles slider requests and cancels stale requests | `api/main.py`: `AnimationParameterRequest`, `apply_animation_parameter`; `frontend/src/components/ParameterAnimationView.tsx`: `handleThetaChange`, `requestFrame` | Minimum safe foundation implemented | API cost per frame | Keep it separate from physical playback and add parameter sweeps only with a budget |
| Backward compatibility | Old response/fixtures remain valid | New fields are additive; absent fields render safe empty states | `frontend/src/pages/SimulatePage.tsx`: `hasRequiredResponseKeys`; tests under `tests/test_*response*` | Already implemented | Low | Keep optional fields |

## Feature classification

1. **Circuit Probe View**: implemented at minimum safe level. `CircuitProbeView` selects available backend boundary snapshots and shows logical position, circuit highlight, ideal/noisy probabilities, and local Bloch views.
2. **Physical Timeline View**: implemented. `PhysicalTimelinePlayback`, `MetricTimeline`, probability transition, Bloch, and density views use `simulationTimeUs` from the physical timeline.
3. **Parameter-driven whole-circuit reevaluation**: minimum safe foundation implemented for `theta_rad` on RX/RY/RZ/CP. Each selected value reuses `/api/simulate`; no frontend physics is duplicated.
4. **Static result visualization**: implemented by `StateExplorerPage`, `MetricTimeline`, `StateProbabilityComparison`, `BlochSphereExplorer`, and `DensityMatrixViewer`.
5. **Measurement or branch visualization**: implemented as backend branch ensemble badges in `PhysicalTimelinePlayback`, using `MeasurementResult.classical_branches`.
6. **Not implemented**: arbitrary input-state-angle animation, continuous two-dimensional `rho(simulation_time; animation_parameter)` storage, and a precomputed parameter sweep cache.

## Mismatches between requested design and actual implementation

- **Already implemented under another name**: physical simulation time is `SimulationResult.times`; logical position is `GateColumn.step`; UI playback is `PhysicalTimelinePlayback`.
- **Partially implemented**: probe availability is bounded by the existing snapshot cap, so not every logical boundary is guaranteed in every response.
- **Missing but safe to add**: explicit operation IDs in the backend probe contract. Current source-column mapping is deterministic enough for the minimum UI.
- **Requires API extension**: richer probe payloads containing per-probe reduced matrices or Bloch vectors. Current implementation intentionally sends snapshot references instead of duplicating matrices.
- **Already implemented under another name**: the first Quirk-style parameter slider is `ParameterAnimationView`; it reevaluates all probes through the API but intentionally does not share the physical timeline clock.
- **Requires physics-model change**: any claim that short parallel gates complete independently inside a column, or that a parameter animation is physical time.
- **Requires measurement-model change**: deferred-measurement semantics if they are desired in addition to current explicit measurement/branch handling.
- **Requires unresolved product decision**: whether bounded missing boundaries should trigger an optional higher snapshot budget, whether probe selection should also move the physical-timeline cursor, and whether future parameter sweeps should be cached server-side.

## Concept separation

| Concept | Meaning | Controlled by | Changes physics? |
|---|---|---|---|
| `circuit_position` | Logical prefix/boundary of the circuit | Probe selection | Selects an existing checkpoint |
| `simulation_time` | Physical solver evolution time | Backend solver | Yes |
| `playback_time` | Wall-clock display rate | Frontend | No |
| `animation_parameter` | Input or gate parameter for a Quirk-style demo | Future parameter animation | Yes, if simulated |

The implementation deliberately does not identify these dimensions.

## Decision gates

- Circuit Probe View gates 1, 3, 4, and 5 pass. Gate 2 passes only for boundaries retained by the existing bounded snapshot policy; therefore the implementation exposes available probes and does not invent omitted ones.
- Physical Timeline View gates all pass; the existing solver grid and column segmentation are sufficient.
- Parameter Animation gates pass for the bounded `theta_rad` implementation: parameterized gates exist, the parameter is explicit, requests reuse `/api/simulate`, and stale requests are cancelled/debounced. Arbitrary input-state animation remains future work.

## Documentation and scope notes

`docs/development/physical_timeline_implementation_audit.md` documents the prior physical timeline foundation. `docs/development/ext2-3a-state-snapshots.md` remains accurate for bounded snapshots but should reference `circuit_probes` in a future documentation pass. Older requirements describing measurement as terminal-only or Gate-aware as only one/two qubits are outdated relative to `core/classical_branching.py` and current API validation.
