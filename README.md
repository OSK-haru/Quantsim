# Quantum-Sim

Quantum-Sim is a beginner-friendly MVP for exploring how environmental conditions affect a very small quantum circuit.

The app simulates a 1-qubit H gate and shows how quickly the result loses effectiveness as temperature, magnetic field, and noise level change.

## MVP Scope

- 1 qubit only
- initial state: `|0>`
- H gate only
- environment inputs:
  - temperature
  - magnetic field
  - noise level
- outputs:
  - fidelity over time
  - purity over time
  - effective time

## Setup

Create or activate a Python environment, then install the project requirements:

```powershell
python -m pip install -r requirements.txt
```

If you are using the included local virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Run

Start the Streamlit app:

```powershell
.\.venv\Scripts\python.exe -m streamlit run app\app.py
```

Then open the local URL shown by Streamlit.

## What To Try First

Start with low noise:

- temperature = `0.1`
- magnetic field = `0.1`
- noise level = `0.1`

Then try high noise:

- temperature = `0.8`
- magnetic field = `0.1`
- noise level = `0.8`

The high-noise case should show a shorter effective time because the simulated circuit loses fidelity faster.

## Known Limitations

- 1 qubit only
- H gate only
- simplified environment-to-noise model
- not a research-grade simulator
- no expert mode yet
- no save/load yet

## Project Layout

- `app/`: Streamlit UI
- `core/`: circuit, environment, evolution, and metrics logic
- `data/`: reference values and sensitivity coefficients
- `scripts/`: simple plotting scripts
- `tests/`: MVP tests
