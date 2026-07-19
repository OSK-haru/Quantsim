# EXT2-3C: CPTP-ready snapshot policy

## Scope

The current simulator remains `gate_aware_hamiltonian_lindblad_v1` with the
existing dense NumPy/RK4 execution path. This change only adds snapshot request
selection, exact continuous-time capture, metadata, and bounded serialization.
It does not add CPTP channels or change the Lindblad physics.

## Request policy

`SimulationConfig.snapshot_options` is optional. When absent, the legacy
`bounded_semantic_v1` behavior is retained with a maximum of 10 snapshots.
When enabled, the policy accepts:

- `uniform_count`: `0` or `2..100`; uniform samples are internal points at
  `i/(count+1)` of the actual simulation interval.
- `custom_times_us`: up to 100 finite, non-negative values within the requested
  duration. Near-equal values are deduplicated deterministically.
- Event switches for initial, final, column-boundary, and after-circuit states.

The returned hard cap is always 100. Retention order is initial/final, custom
times, column and after-circuit events, then uniform or idle samples.

## Snapshot contract

Every current snapshot carries:

- `requested_time_us`: the requested time for time-based samples, otherwise
  `null` for pure events.
- `time_us`: the actual represented physical time.
- `kind`: `initial`, `uniform_time`, `custom_time`, `column_boundary`,
  `after_circuit`, `idle_sample`, or `final`.
- `capture_method`: currently `exact_integration_boundary` for requested
  times and `simulation_event_boundary` for events.
- `event_kind` and zero-based `column_index` where applicable.

The current continuous backend merges requested times into the integration
target list, so custom and uniform times are captured at exact integration
boundaries. Density matrices are not linearly interpolated between distant
states, and snapshot capture does not retain or convert every RK4 hot-loop
state.

## Future CPTP compatibility

The lightweight `SnapshotRequest`/`SnapshotPlan` separation keeps requested
times distinct from event captures. A future segment can therefore support
exact internal-time capture, boundary-only capture, or semigroup subdivision
without pretending that an arbitrary fractional-time CPTP state exists. Future
channel and measurement event labels are reserved conceptually but are not
emitted by the current implementation.

Diagnostics expose requested counts, candidate and returned counts,
deduplication/drop counts, exact/nearest capture counts, maximum time error,
policy, and hard cap.
