# Numerical Sanity Checks

The Phase 8 numerical sanity tests check standard circuits for:

- no NaN or infinity in times, fidelity, purity, or output probabilities
- fidelity values within `[0, 1]` up to numerical tolerance
- purity values within `[0, 1]` up to numerical tolerance
- output probabilities summing to 1
- density matrix trace close to 1 when reconstructed for expert data
- small Hermiticity error when reconstructed for expert data
- no strongly negative minimum eigenvalue diagnostic

These checks are intended to catch regressions in data plumbing and numerical
stability. They are not intended to certify research-grade simulation accuracy.
