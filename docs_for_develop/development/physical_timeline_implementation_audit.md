# Physical Timeline Implementation Audit

Date: 2026-08-02
Branch inspected: `React-phase`

## Scope and repository state

This audit was completed before the physical-timeline production changes described in the final column below. The worktree already contained extensive uncommitted Gate-aware, Pulse Lab, Rust, measurement, compilation, and UI work. Those changes were treated as user-owned and were not reverted. Recent committed anchors were `f306fbf` (`feat: freeze gate-aware explicit CPTP path`), `ad7521f`, `4a82e75`, `06d1c46`, and `4dc5110`.

The repository is the source of truth. In particular, the current implementation is substantially beyond several older design notes: it has mid-circuit measurement branching, classical registers and conditional gates, automatic gate decomposition, a Rust dense preview kernel, and separate pulse APIs.

## Audit table

| Concern | Expected direction | Actual implementation | Evidence | Status | Risk | Recommended action |
|---|---|---|---|---|---|---|
| Stable simulation entry point | One stable config-to-result boundary | `run_simulation(config) -> SimulationResult` validates, selects representation, compiles, runs, and attaches diagnostics | `core/simulator.py`: `run_simulation`; `core/results.py`: `SimulationConfig`, `SimulationResult` | Already implemented | Low | Keep this boundary; attach playback metadata to `SimulationResult` |
| Current backend architecture | Backend choice must not alter response semantics | Model runners are selected by `simulation_backends`; `simulation_backend` selects Python dense or optional Rust kernels with fallback metadata | `core/simulation_backends.py`: `register_simulation_backend`, `get_simulation_backend`; `core/backend_boundary.py`: `backend_metadata`; `core/simulator.py`: `_KernelStats` | Already implemented | Medium | Build one backend-neutral timeline before restoring the logical config |
| Gate-aware versus pulse-level separation | Separate timing/model domains | Gate-aware uses `/api/simulate` and `core.simulator`; pulse uses `/api/pulse/simulate`, `api.pulse_service`, strict `PulseApiRequest`, and pulse-specific cores | `api/main.py`: `simulate`, `pulse_simulate`; `api/pulse_models.py`: `PulseApiRequest`; `api/pulse_service.py`: `run_pulse_api_request` | Already implemented | Low | Limit this contract to Gate-aware; design a separate pulse timeline later |
| Gate-duration representation | Physical durations originate in backend input/model | Per-gate `params.duration_us` overrides `DEFAULT_GATE_DURATIONS_US`; API fills missing durations from `GateDurationDefaultsRequest` | `core/gates.py`: `gate_duration_us`; `api/main.py`: `GateDurationDefaultsRequest`, `build_custom_circuit` | Already implemented | Low | Expose declared duration as metadata, not a UI-derived value |
| Column duration semantics | Reflect solver semantics exactly | A column duration is the maximum duration of its gates | `core/gates.py`: `column_duration_us` | Already implemented | Low | State this explicitly in the timeline schema |
| Parallel-gate semantics | Do not imply independent early completion | A column unitary is combined and converted to one effective Hamiltonian for the full column duration | `core/simulator.py`: `_gate_aware_segments`, `_column_unitary_cached`, `_effective_hamiltonian_cached` | Already implemented | High if UI shows short gate ending early | Keep the entire column active; include individual declared durations only as explanatory metadata |
| Idle-time semantics | Playback must include actual noise evolution after circuit | `actual_duration=max(requested duration,total gate duration)` and idle is the remainder after sequential gate columns | `core/simulator.py`: `_simulate_circuit_gate_aware_hamiltonian`; diagnostics `completion_time_us`, `idle_duration_us` | Already implemented | Low | Add an explicit post-circuit idle event |
| Physical time grid | Solver time is source of truth | `_time_grid` builds the base grid; `_simulation_times` adds requested snapshot times deterministically | `core/simulator.py`: `_time_grid`, `_simulation_times`; `SimulationResult.times` | Already implemented | Low | Expose `SimulationResult.times` as sampled physical times |
| Ideal-state timeline | Same circuit and timing, noise disabled | UI conversion reruns the same config with `ideal_reference=True` and returns ideal scalar timeline and bounded snapshots | `core/ui_response.py`: `_ideal_reference_data` | Already implemented | Medium (extra runtime) | Reuse the same physical timeline; do not create a second playback clock |
| Noisy-state timeline | Solver-produced scalar and state samples | Fidelity/purity exist at all `result.times`; density matrices exist only at bounded semantic snapshots | `core/results.py`: `SimulationResult.times/fidelity/purity/state_snapshots`; `core/state_snapshots.py`: `StateSnapshotCollector` | Partially implemented | Low | Use scalar interpolation only if needed; select nearest state snapshot |
| Fidelity/purity timeline | Synchronize to simulation time | API already emits `{time_us,fidelity,purity}` | `core/ui_response.py`: `_timeline`; `frontend/src/components/MetricTimeline.tsx`: `MetricTimeline` | Already implemented | Low | Add a cursor driven by shared simulation time |
| Density-matrix availability over time | Backend state only; bounded payload | Initial, column-boundary, measurement, after-circuit, idle and final snapshots are bounded and serialized as real/imag matrices | `core/state_snapshots.py`: `StateSnapshot`, `StateSnapshotCollector`, `serialize_state_snapshots`; `docs/development/ext2-3a-state-snapshots.md` | Already implemented | Payload grows as 4^n | Select nearest snapshot; never interpolate matrices |
| Bloch-vector availability over time | Derive display from backend state | API does not send Bloch vectors; frontend computes reduced single-qubit Bloch vectors from a selected density snapshot | `frontend/src/components/BlochSphereExplorer.tsx`: `BlochSphereExplorer`; `frontend/src/utils/blochSphere.ts` | Already implemented under a different representation | Low | Drive its snapshot index from playback time |
| Measurement semantics | Document reality; do not overclaim | Main trajectory applies non-selective computational measurement. Conditional circuits additionally use bounded selective branches with classical bits and feed-forward; final shots are sampled from probabilities | `core/gates.py`: `apply_non_selective_computational_measurement`; `core/simulator.py`: `_apply_segment_measurements`, `execute_classical_branches`; `core/classical_branching.py`; `core/ui_response.py`: `_measurement_response` | Already implemented, prompt assumption outdated | Medium | Preserve current semantics; animation must display backend branch data, not invent outcomes |
| API timeline schema | Additive, backward-compatible contract | Before Phase 2 only scalar `timeline` and `state_snapshots` existed; no operation timing contract existed | `core/ui_response.py`: `simulation_result_to_ui_response`; `frontend/src/types/simulation.ts`: `SimulationResponse` | Missing but safe to add | Low | Add optional `physical_timeline`; keep all existing keys |
| Frontend timeline consumption | One shared simulation time | Metric graph used its own static x-axis; Bloch and density shared a snapshot index, but no circuit/playhead clock existed | `frontend/src/pages/StateExplorerPage.tsx`; `frontend/src/components/MetricTimeline.tsx`; `frontend/src/components/DensityMatrixViewer.tsx` | Partially implemented | High UX inconsistency | Lift `simulationTimeUs` into the results page and map to nearest snapshot |
| Existing animation/playback implementation | Physics-driven generic playback | The just-added `TeleportationGuide` used a fixed 1.1 s per explanatory step and selected snapshots by step/column heuristics. It was algorithm-specific and not solver-time-driven | pre-Phase-2 `frontend/src/components/TeleportationGuide.tsx`: `TeleportationGuide` | Missing safe foundation | High; could be mistaken for physics | Remove it and replace it with a generic read-only physical timeline player |
| Existing backward-compatibility requirements | Existing fixtures and consumers keep working | UI has a static fixture fallback and TypeScript response contract; adapter/API tests assert existing fields. `SimulationResult.to_dict/from_dict` is a save/load boundary | `frontend/src/mock/uiResponseExample.ts`; `tests/test_ui_response_adapter.py`; `tests/test_api_simulate_circuit_config.py`; `core/results.py`: `to_dict`, `from_dict` | Already implemented | Medium | Make new frontend field optional and new backend/result field default to `{}` |

## Mismatches between requested design and actual implementation

### Naming mismatch only

- The repository calls the physical scalar sample array `SimulationResult.times` and API entries `timeline[].time_us`; it did not use the proposed generic `simulation_time` name.
- Circuit ordering is represented by `GateColumn.step` and by sorted column position. The execution path also has a separate compiled-column index after automatic decomposition.

### Already implemented

- A physical solver time grid, ideal/noisy scalar timelines, bounded density snapshots, column boundaries, completion time, and post-circuit idle evolution already existed.
- Bloch views already derive from backend density snapshots.
- Contrary to the task's conservative measurement assumption, selective branches, classical-bit storage, conditional gates, teleportation, and noisy feed-forward are implemented. This task does not change them.

### Partially implemented

- Graphs, Bloch spheres, and density matrices could inspect time, but did not share a playback time or circuit active-column indicator.
- Automatic decomposition retained a source map, but no playback schema used it to map executed columns back to logical editor columns.

### Missing but safe to add

- A backend-produced operation-event timeline.
- A shared, read-only `simulationTimeUs` UI state, playback controls, circuit highlighting, graph cursor, and nearest-snapshot selection.

### Requires API redesign

- None for the minimum Gate-aware foundation. A richer per-substep state stream would require payload/version decisions, but is not needed here.

### Requires physics-model change

- Independent completion of gates with different durations inside one parallel column. The current solver treats the column as one effective-Hamiltonian segment.
- Continuous statevector trajectories for the adaptive endpoint-only representation.

### Requires unresolved product decision

- Whether automatic decomposition playback should primarily show the logical source gate or expand the UI into native execution columns. The minimum implementation highlights the logical source column while reporting execution-column metadata.
- Whether Gate-aware and Pulse Lab should eventually share one visual playback shell while retaining separate physical timeline schemas.
- Whether measurement branch playback should select one sampled trajectory or show the ensemble/branch distribution. The minimum implementation keeps ensemble state snapshots and existing branch results separate.

## Decision gate

1. Physical time grid exists: **yes**, `SimulationResult.times`.
2. Gate timing is unambiguous: **yes**, sorted sequential columns with `column_duration_us=max(gate durations)`; automatic decomposition exposes the executed circuit and source map.
3. API extension can be additive: **yes**, response dictionaries are not closed Pydantic response models for `/api/simulate`.
4. Frontend can consume it without editor rewrite: **yes**, `CircuitPreview` already accepts `highlightedColumnIndex` and read-only callbacks are optional.
5. No physics change is required: **yes**.

Phase 2 was therefore authorized.

## Phase 2 implementation contract

`core/physical_timeline.py:build_physical_timeline` now creates `physical_timeline_v1` from the **executed** circuit. Its event boundaries match the sequential-column model. Each event contains `source_circuit_columns` so compiled execution columns can highlight the corresponding logical editor column. `idle` is explicit. `sampled_times_us` is copied from `SimulationResult.times`.

The three time concepts are kept distinct:

- `circuit_step` / `source_circuit_columns`: logical ordering and UI mapping.
- `simulation_time_us`: solver-domain physical time shown by the player and graph cursor.
- wall-clock playback time: used only inside `PhysicalTimelinePlayback` to advance `simulation_time_us`; it never computes a state or duration.

`frontend/src/pages/StateExplorerPage.tsx:StateExplorerPage` owns the current simulation time. `PhysicalTimelinePlayback` highlights the active logical column, `MetricTimeline` and `StateProbabilityComparison` render the same-time cursor, and `nearestSnapshotIndex` selects the backend density snapshot used by the probability, Bloch, and density-matrix views.

When the playhead reaches a measurement event, `PhysicalTimelinePlayback` also renders the existing `measurement.classical_branches` as an explicitly labelled ensemble distribution. It does not select a fake single trajectory or recompute measurement backaction in React.

No Lindblad equation, Hamiltonian, collapse operator, environment mapping, solver, fidelity/purity definition, circuit editor representation, endpoint, or backend fallback was changed.

## Documentation freshness

- `docs/development/ext2-3a-state-snapshots.md` remains accurate for bounded snapshots but should later reference `physical_timeline_v1`.
- `docs/physics/gate-aware-measurement-model.md` contains the implemented advanced measurement model, but portions render with mojibake and should be encoding-repaired separately.
- Older requirements that describe measurement as terminal-only or Gate-aware as one/two-qubit-only are outdated relative to `core/classical_branching.py`, `core/execution_representation.py`, and current API validation.
