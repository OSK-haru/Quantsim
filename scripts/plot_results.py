"""Plot Day 5 MVP fidelity and purity comparisons."""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib.pyplot as plt

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.evolution import simulate_once
from core.metrics import (
    effective_time,
    fidelity_series,
    ideal_state_series,
    purity_series,
)


GOOD = (0.1, 0.1, 0.1)
BAD = (0.9, 0.2, 0.9)
THRESHOLD = 0.9


def main() -> None:
    good = _run_condition(GOOD)
    bad = _run_condition(BAD)

    print(f"GOOD effective_time: {good['effective_time']:.4f} us")
    print(f"BAD effective_time: {bad['effective_time']:.4f} us")

    _, axes = plt.subplots(2, 1, sharex=True, figsize=(8, 6))

    _plot_metric(
        axes[0],
        good,
        bad,
        metric_name="fidelity",
        y_label="Fidelity",
    )
    axes[0].axhline(
        THRESHOLD,
        color="gray",
        linestyle="--",
        linewidth=1.0,
        label="threshold",
    )

    _plot_metric(
        axes[1],
        good,
        bad,
        metric_name="purity",
        y_label="Purity",
    )

    for axis in axes:
        axis.axvline(
            good["effective_time"],
            color="tab:blue",
            linestyle=":",
            linewidth=1.2,
            label="GOOD effective time",
        )
        axis.axvline(
            bad["effective_time"],
            color="tab:red",
            linestyle=":",
            linewidth=1.2,
            label="BAD effective time",
        )
        axis.set_ylim(0.0, 1.05)
        axis.grid(True, alpha=0.3)
        axis.legend()

    axes[1].set_xlabel("Time (us)")
    axes[0].set_title("1-qubit H-gate under two environment conditions")
    plt.tight_layout()
    plt.show()


def _run_condition(condition: tuple[float, float, float]) -> dict[str, object]:
    times, states = simulate_once(*condition)
    ideal_states = ideal_state_series(times)
    fidelities = fidelity_series(states, ideal_states)
    purities = purity_series(states)

    return {
        "times": times,
        "fidelity": fidelities,
        "purity": purities,
        "effective_time": effective_time(times, fidelities, THRESHOLD),
    }


def _plot_metric(
    axis,
    good: dict[str, object],
    bad: dict[str, object],
    metric_name: str,
    y_label: str,
) -> None:
    axis.plot(
        good["times"],
        good[metric_name],
        color="tab:blue",
        label=f"GOOD {metric_name}",
    )
    axis.plot(
        bad["times"],
        bad[metric_name],
        color="tab:red",
        label=f"BAD {metric_name}",
    )
    axis.set_ylabel(y_label)


if __name__ == "__main__":
    main()
