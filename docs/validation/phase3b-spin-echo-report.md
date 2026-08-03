# Phase 3B Spin-Echo Follow-up

## Purpose

This exploratory measurement tests whether the Ramsey oscillation is reduced
by a spin-echo refocusing pulse. The sequence was

```text
H -> delay(t/2) -> X -> delay(t/2) -> H -> measure
```

It used `ibm_kingston`, physical qubit `150`, the `0..400 us` grid with 21
points, and 256 shots per circuit (5,888 shots total). No production model or
`core/` code was changed.

## Result

- Job: `d9o12h8qs0bc73e3v590`
- Readout assignment span: `0.9844`
- A single-tone exploratory fit returned `0.05 MHz`, `T2 = 374.1 us`, and
  RMSE `0.0386`.
- The fitted amplitude was `3.22`, which is nonphysical for a normalized
  contrast and indicates that the single-tone fit is ill-conditioned here.

The fit therefore must not be interpreted as a measured spin-echo frequency.
The important observation is that the clear `6.8 MHz` and `9.55 MHz` Ramsey
oscillations were not recovered as a comparable spin-echo oscillation.

## Interpretation

The result is consistent with, but does not prove, a substantial quasi-static
detuning or frame-offset component in the Ramsey signal: a refocusing pulse
can cancel phase accumulated from a sufficiently static offset. Other effects
remain possible, including pulse errors, time-dependent frequency drift, and
the limited 21-point fit.

The correct model conclusion is:

- retain detuning as a local diagnostic only;
- do not add a fixed detuning to the production model;
- do not label this spin-echo result as a formal QPU holdout pass;
- use a bounded-contrast or non-oscillatory echo analysis in a future protocol
  if quantitative `T2_echo` is needed.

## Artifacts

- Raw result: `validation_hardware/raw/phase3b_spin_echo_followup_d9o12h8qs0bc73e3v590.json`
- Analysis: `validation_results/phase3b_spin_echo_d9o12h8qs0bc73e3v590.json`
- Runner: `scripts/run_phase3b_spin_echo_followup.py`
- Analyzer: `scripts/analyze_phase3b_spin_echo_followup.py`
