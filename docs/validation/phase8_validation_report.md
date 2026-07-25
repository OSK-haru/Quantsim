# Phase 8 Validation Report

> **Historical validation snapshot**
>
> This report covers the Phase 1-7 feature set at the time Phase 8 was run.
> It predates 3-4 qubit API support, the React Circuit Studio expansion, state
> snapshots, NumPy dense optimization, V1-V7, and Pulse Baseline A. It remains
> valid for the cases listed below but is not the current project-wide status
> report. See `docs/README.md`.

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
