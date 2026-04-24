"""Interpretable metrics for the Quantum-Sim MVP."""


def effective_lifetime(decay_score: float) -> float:
    """Convert a decay score into a simple lifetime-style metric."""

    return 1.0 / (1.0 + max(decay_score, 0.0))
