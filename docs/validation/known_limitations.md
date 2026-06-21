# Known Limitations

QuantaScope is a beginner-friendly educational simulator, not a research-grade
open quantum systems package.

Current limitations:

- Supports only small circuits, currently 1-2 logical qubits.
- Uses normalized environment parameters, not calibrated hardware controls.
- Uses phenomenological T1/T2 noise.
- Does not model pulse-level control.
- The standard circuit simulation is a gate-aware effective-Hamiltonian
  Lindblad model, not calibrated pulse-level hardware control.
- The legacy post-circuit degradation model is retained only for comparison
  and compatibility with older regression cases.
- Does not model strong-coupling memory effects.
- Does not model leakage, crosstalk, drive calibration error, readout error,
  or non-Markovian memory.
- Does not implement no-jump trajectory simulation or full `H_eff` evolution.
- Does not implement a QuTiP, Rust, FastAPI, or Godot backend.
- Long-time relaxation behavior is documented as a qualitative limitation and
  is not used as a strict regression assertion in Phase 8.

These limits are deliberate for the MVP scope and keep the tool focused on
interpretable cause-and-effect for small noisy circuits.
