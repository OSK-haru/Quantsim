# Phase 8 Validation Report

Phase 8 adds regression, numerical sanity, physical sanity, export/load, preset,
performance, and expert data checks for the Phase 1-7 MVP.

## Covered Workflows

- 1-qubit `I`, `X`, `Z`, and `H` simulations
- 2-qubit Bell circuit simulation
- Low-noise vs high-noise comparison
- Config save, load, and run
- Result JSON, CSV, and Markdown export
- Preset loading
- Expert Inspector data generation

## Safety Scope

The validation work does not change environment-to-T1/T2 mapping,
T1/T2-to-gamma mapping, Lindblad evolution, fidelity definitions, or purity
definitions.
