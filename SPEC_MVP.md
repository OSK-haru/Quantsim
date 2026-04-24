# SPEC_MVP.md

## Project
Quantum-sim MVP

## Purpose
Build a beginner-friendly interactive simulator that shows how environmental conditions affect the effective behavior of a very small quantum circuit.

This MVP is not a general-purpose quantum SDK and not a production research simulator.
It exists to validate whether:
1. the internal model is understandable,
2. environmental parameters visibly affect the result,
3. the UI can communicate effective circuit lifetime intuitively.

## MVP scope
- 1 qubit only
- initial state: |0>
- single H gate
- inputs:
  - temperature
  - magnetic field
  - noise level
- outputs:
  - fidelity(t)
  - purity(t)
  - effective time
- simple Streamlit UI
- beginner-friendly wording

## Non-goals
- 2 qubits
- CNOT
- persistence / save-load
- production UI polish
- full expert mode
- broad QuTiP-like general solver scope
- pulse-level simulation
- database introduction
- Godot implementation in MVP

## Internal model
### State
Use a density matrix for a 1-qubit system.

### Gate model
Use an effective Hamiltonian for the H gate.

### Noise model
Use Lindblad-style evolution with:
- relaxation-like effect
- dephasing-like effect

### Environment mapping
Map:
- temperature
- magnetic field
- noise level

to:
- T1
- T2
- derived gamma values

### Metrics
Compute:
- fidelity against ideal evolution
- purity
- effective time defined by:
  - first time fidelity drops below threshold

## Default threshold
- fidelity threshold = 0.90

## UI requirements
The MVP UI should allow the user to:
1. change temperature
2. change magnetic field
3. change noise level
4. run simulation
5. view fidelity and purity plots
6. view effective time
7. read a short beginner explanation

## Beginner wording
Map internal quantities to simple labels:
- fidelity -> effectiveness
- purity -> stability
- effective time -> usable time

## Success criteria
The MVP is complete when:
1. a user can change temperature, magnetic field, and noise level,
2. run a 1-qubit H-gate simulation,
3. view fidelity, purity, and effective time,
4. and observe visible differences when inputs change.
