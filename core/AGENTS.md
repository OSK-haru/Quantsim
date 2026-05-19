# core/AGENTS.md

This folder contains the simulation core.

Rules:
- No Streamlit or UI code here.
- Keep logic modular and testable.
- Prefer small pure functions where possible.
- Stay within the MVP model:
  - 1 qubit
  - H gate
  - environment -> T1/T2 mapping
  - Lindblad-style evolution
  - fidelity / purity / effective time
- Do not expand into a generic solver framework.
