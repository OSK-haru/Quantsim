"""Generate the C8 RK4 versus explicit-CPTP comparison report."""

from __future__ import annotations

import argparse
import json
import math
import platform
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.cptp_comparison import compare_rk4_and_cptp
from core.gates import Matrix, SIGMA_MINUS, X, Z, scale
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    TwoLevelPulseHamiltonian,
)
from core.pulse_evolution import ConstantHamiltonian
from core.pulse_qutrit import QutritPulseHamiltonian
from core.pulse_qutrit_contract import (
    mhz_to_rad_per_us,
    qutrit_rotating_frame_hamiltonian,
)
from core.pulse_qutrit_open_system import (
    QutritDissipationRates,
    qutrit_collapse_operator_matrices,
)
from core.rust_dense_kernel import is_rust_kernel_available


DEFAULT_JSON_PATH = Path(
    "validation_results/cptp_rk4_comparison.json"
)
DEFAULT_MARKDOWN_PATH = Path(
    "docs/validation/cptp-rk4-comparison.md"
)
PHYSICALITY_TOLERANCE = 1e-10


@dataclass(frozen=True)
class ComparisonCase:
    case_id: str
    description: str
    state: Matrix
    hamiltonian: object
    collapse_operators: tuple[Matrix, ...]
    duration_us: float
    step_sizes_us: tuple[float, ...]
    finest_trace_distance_limit: float
    parameters: dict[str, object]


def main() -> int:
    arguments = _parse_arguments()
    cases = _cases()
    backends = ["python"]
    if is_rust_kernel_available():
        backends.append("rust")

    case_records = [
        _evaluate_case(
            case,
            backends,
            arguments.repetitions,
        )
        for case in cases
    ]
    stress_observation = _qutrit_coarse_step_stress(
        backends,
        repetitions=1,
    )
    all_comparisons = [
        comparison
        for case in case_records
        for backend in case["backends"]
        for comparison in backend["comparisons"]
    ]
    report = {
        "schema_version": "cptp-rk4-comparison-v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "environment": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "rust_extension_available": is_rust_kernel_available(),
        },
        "methodology": {
            "rk4": (
                "Fixed-step RK4 with stage-time Hamiltonian evaluation and "
                "the existing post-step cleanup."
            ),
            "cptp": (
                "Midpoint piecewise-constant GKSL exponentials, interval and "
                "composed Choi audits, and state application without cleanup."
            ),
            "timing": (
                "Median wall time. RK4 includes complete evolution. CPTP "
                "includes map construction, audits, and state application."
            ),
            "matched_grid": True,
            "timing_repetitions": arguments.repetitions,
            "physicality_tolerance": PHYSICALITY_TOLERANCE,
            "speed_is_acceptance_criterion": False,
        },
        "cases": case_records,
        "non_acceptance_stress_observation": stress_observation,
        "summary": {
            "all_cases_pass": all(
                case["case_pass"] for case in case_records
            ),
            "maximum_trace_distance": max(
                item["trace_distance"] for item in all_comparisons
            ),
            "maximum_cptp_trace_error": max(
                item["cptp_physicality"]["trace_error"]
                for item in all_comparisons
            ),
            "minimum_cptp_state_eigenvalue": min(
                item["cptp_physicality"]["minimum_eigenvalue"]
                for item in all_comparisons
            ),
            "minimum_cptp_choi_eigenvalue": min(
                item["cptp_choi_minimum_eigenvalue"]
                for item in all_comparisons
            ),
            "maximum_cptp_tp_error": max(
                item["cptp_trace_preservation_error"]
                for item in all_comparisons
            ),
        },
    }

    arguments.json_path.parent.mkdir(parents=True, exist_ok=True)
    arguments.markdown_path.parent.mkdir(parents=True, exist_ok=True)
    arguments.json_path.write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    arguments.markdown_path.write_text(
        _markdown(report),
        encoding="utf-8",
    )
    print(json.dumps(report["summary"], indent=2))
    return 0 if report["summary"]["all_cases_pass"] else 1


def _evaluate_case(
    case: ComparisonCase,
    backends: list[str],
    repetitions: int,
) -> dict[str, object]:
    backend_records = []
    for backend in backends:
        comparisons = [
            compare_rk4_and_cptp(
                case.state,
                case.hamiltonian,
                case.collapse_operators,
                case.duration_us,
                step,
                backend=backend,
                timing_repetitions=repetitions,
                warmup=True,
            ).to_dict()
            for step in case.step_sizes_us
        ]
        distances = [
            comparison["trace_distance"]
            for comparison in comparisons
        ]
        convergence_monotonic = all(
            later < earlier
            for earlier, later in zip(distances, distances[1:])
        )
        physicality_pass = all(
            _physicality_pass(comparison)
            for comparison in comparisons
        )
        backend_pass = (
            convergence_monotonic
            and physicality_pass
            and distances[-1] <= case.finest_trace_distance_limit
        )
        backend_records.append({
            "backend": backend,
            "comparisons": comparisons,
            "convergence_monotonic": convergence_monotonic,
            "physicality_pass": physicality_pass,
            "finest_trace_distance_limit": (
                case.finest_trace_distance_limit
            ),
            "backend_pass": backend_pass,
        })

    return {
        "case_id": case.case_id,
        "description": case.description,
        "duration_us": case.duration_us,
        "step_sizes_us": list(case.step_sizes_us),
        "parameters": case.parameters,
        "backends": backend_records,
        "case_pass": all(
            backend["backend_pass"] for backend in backend_records
        ),
    }


def _physicality_pass(comparison: dict[str, object]) -> bool:
    rk4 = comparison["rk4_physicality"]
    cptp = comparison["cptp_physicality"]
    return (
        rk4["trace_error"] <= PHYSICALITY_TOLERANCE
        and rk4["hermiticity_error"] <= PHYSICALITY_TOLERANCE
        and rk4["minimum_eigenvalue"] >= -PHYSICALITY_TOLERANCE
        and cptp["trace_error"] <= PHYSICALITY_TOLERANCE
        and cptp["hermiticity_error"] <= PHYSICALITY_TOLERANCE
        and cptp["minimum_eigenvalue"] >= -PHYSICALITY_TOLERANCE
        and comparison["cptp_choi_minimum_eigenvalue"]
        >= -PHYSICALITY_TOLERANCE
        and comparison["cptp_trace_preservation_error"]
        <= PHYSICALITY_TOLERANCE
    )


def _qutrit_coarse_step_stress(
    backends: list[str],
    repetitions: int,
) -> dict[str, object]:
    envelope = GaussianPulseEnvelope.from_target_rotation_angle(
        target_rotation_angle_rad=1.05,
        sigma_us=0.055,
        truncation_sigma=3.0,
    )
    rates = QutritDissipationRates(
        input_mode="direct_rates",
        gamma_10_down_per_us=0.028,
        gamma_01_up_per_us=0.004,
        gamma_21_down_per_us=0.047,
        gamma_12_up_per_us=0.006,
        gamma_phi_adjacent_per_us=0.018,
    )
    provider = QutritPulseHamiltonian(
        envelope=envelope,
        anharmonicity_rad_per_us=mhz_to_rad_per_us(-215.0),
        phase_rad=-0.23,
        detuning_rad_per_us=0.17,
        drag_beta_us=0.012,
    )
    comparisons = [
        compare_rk4_and_cptp(
            _qutrit_state(),
            provider,
            qutrit_collapse_operator_matrices(rates),
            envelope.duration_us,
            0.006,
            backend=backend,
            timing_repetitions=repetitions,
        ).to_dict()
        for backend in backends
    ]
    return {
        "case_id": "qutrit_drag_intentionally_coarse_step",
        "included_in_acceptance": False,
        "purpose": (
            "Expose the RK4 stability boundary; this step is far above the "
            "frozen qutrit step-policy limit for -215 MHz anharmonicity."
        ),
        "max_step_us": 0.006,
        "anharmonicity_mhz": -215.0,
        "comparisons": comparisons,
        "rk4_instability_observed": any(
            comparison["rk4_minimum_observed_raw_eigenvalue"]
            < -PHYSICALITY_TOLERANCE
            for comparison in comparisons
        ),
        "cptp_physicality_preserved": all(
            comparison["cptp_physicality"]["minimum_eigenvalue"]
            >= -PHYSICALITY_TOLERANCE
            for comparison in comparisons
        ),
    }


def _cases() -> tuple[ComparisonCase, ...]:
    gaussian = GaussianPulseEnvelope.from_target_rotation_angle(
        target_rotation_angle_rad=1.1,
        sigma_us=0.07,
        truncation_sigma=3.0,
    )
    qutrit_rates = QutritDissipationRates(
        input_mode="direct_rates",
        gamma_10_down_per_us=0.028,
        gamma_01_up_per_us=0.004,
        gamma_21_down_per_us=0.047,
        gamma_12_up_per_us=0.006,
        gamma_phi_adjacent_per_us=0.018,
    )
    return (
        ComparisonCase(
            case_id="constant_qubit_open_system",
            description="Constant qubit Hamiltonian with relaxation and dephasing.",
            state=_state_plus(),
            hamiltonian=ConstantHamiltonian(scale(0.41, X)),
            collapse_operators=(
                scale(math.sqrt(0.17), SIGMA_MINUS),
                scale(math.sqrt(0.06 / 2.0), Z),
            ),
            duration_us=0.8,
            step_sizes_us=(0.2, 0.1, 0.05),
            finest_trace_distance_limit=1e-7,
            parameters={
                "hamiltonian_x_coefficient_rad_per_us": 0.41,
                "gamma_down_per_us": 0.17,
                "gamma_phi_per_us": 0.06,
            },
        ),
        ComparisonCase(
            case_id="two_level_gaussian_open_system",
            description="Gaussian qubit pulse with phase, detuning, and relaxation.",
            state=_state_zero(),
            hamiltonian=TwoLevelPulseHamiltonian(
                envelope=gaussian,
                phase_rad=0.27,
                detuning_rad_per_us=-0.19,
            ),
            collapse_operators=(
                scale(math.sqrt(0.025), SIGMA_MINUS),
                scale(math.sqrt(0.012 / 2.0), Z),
            ),
            duration_us=gaussian.duration_us,
            step_sizes_us=(0.04, 0.02, 0.01),
            finest_trace_distance_limit=2e-3,
            parameters={
                "pulse_duration_us": gaussian.duration_us,
                "sigma_us": gaussian.sigma_us,
                "phase_rad": 0.27,
                "detuning_rad_per_us": -0.19,
                "gamma_down_per_us": 0.025,
                "gamma_phi_per_us": 0.012,
            },
        ),
        ComparisonCase(
            case_id="constant_qutrit_open_system",
            description=(
                "Constant qutrit transmon Hamiltonian with thermal "
                "transitions and dephasing."
            ),
            state=_qutrit_state(),
            hamiltonian=ConstantHamiltonian(
                qutrit_rotating_frame_hamiltonian(
                    detuning_rad_per_us=0.17,
                    anharmonicity_rad_per_us=mhz_to_rad_per_us(-215.0),
                    omega_x_rad_per_us=math.cos(-0.23),
                    omega_y_rad_per_us=math.sin(-0.23),
                )
            ),
            collapse_operators=qutrit_collapse_operator_matrices(
                qutrit_rates
            ),
            duration_us=0.01,
            step_sizes_us=(0.0002, 0.0001, 0.00005),
            finest_trace_distance_limit=1e-6,
            parameters={
                "duration_us": 0.01,
                "anharmonicity_mhz": -215.0,
                "phase_rad": -0.23,
                "detuning_rad_per_us": 0.17,
                "drive_amplitude_rad_per_us": 1.0,
                "rates": {
                    "gamma_10_down_per_us": 0.028,
                    "gamma_01_up_per_us": 0.004,
                    "gamma_21_down_per_us": 0.047,
                    "gamma_12_up_per_us": 0.006,
                    "gamma_phi_adjacent_per_us": 0.018,
                },
            },
        ),
    )


def _markdown(report: dict[str, object]) -> str:
    lines = [
        "# C8 RK4 and Explicit CPTP Comparison",
        "",
        "## Result",
        "",
        f"**{'PASS' if report['summary']['all_cases_pass'] else 'FAIL'}**",
        "",
        "## Method",
        "",
        "- RK4 uses stage-time Hamiltonian evaluation and existing post-step cleanup.",
        "- CPTP uses midpoint-frozen GKSL exponentials and no state cleanup.",
        "- Both methods use the same maximum step for each row.",
        "- CPTP timing includes map construction, Choi audits, and state application.",
        "- Runtime is observational and is not a pass/fail criterion.",
        "",
        "## Results",
        "",
        "| Case | Backend | Step [us] | Trace distance | RK4 raw min eig | Cleanup norm | CPTP min eig | RK4 [ms] | CPTP [ms] | RK4/CPTP |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for case in report["cases"]:
        for backend in case["backends"]:
            for comparison in backend["comparisons"]:
                lines.append(
                    f"| `{case['case_id']}` | `{backend['backend']}` | "
                    f"{comparison['max_step_us']:.6g} | "
                    f"{comparison['trace_distance']:.6e} | "
                    f"{comparison['rk4_minimum_observed_raw_eigenvalue']:.6e} | "
                    f"{comparison['rk4_maximum_cleanup_correction_norm']:.6e} | "
                    f"{comparison['cptp_physicality']['minimum_eigenvalue']:.6e} | "
                    f"{comparison['rk4_runtime_median_ms']:.3f} | "
                    f"{comparison['cptp_runtime_median_ms']:.3f} | "
                    f"{comparison['rk4_to_cptp_runtime_ratio']:.3f} |"
                )
    lines.extend([
        "",
        "## Non-acceptance Stress Observation",
        "",
        "A qutrit DRAG case with `-215 MHz` anharmonicity was intentionally run at a coarse `0.006 us` step, far outside the frozen qutrit step policy.",
        "",
        "| Backend | Trace distance | RK4 raw minimum eigenvalue | CPTP minimum eigenvalue |",
        "|---|---:|---:|---:|",
    ])
    stress = report["non_acceptance_stress_observation"]
    for comparison in stress["comparisons"]:
        lines.append(
            f"| `{comparison['backend']}` | "
            f"{comparison['trace_distance']:.6e} | "
            f"{comparison['rk4_minimum_observed_raw_eigenvalue']:.6e} | "
            f"{comparison['cptp_physicality']['minimum_eigenvalue']:.6e} |"
        )
    lines.extend([
        "",
        "This stress case is excluded from acceptance. It demonstrates that post-step cleanup does not make an unstable coarse RK4 trajectory trustworthy, while each explicit CPTP interval remains physical.",
        "",
        "## Interpretation",
        "",
        "- Trace distance decreases under matched-grid refinement for every tested case.",
        "- The explicit CPTP path preserves trace, Hermiticity, positivity, and the Choi CPTP conditions without cleanup.",
        "- RK4 final displayed states are physical after the existing cleanup; raw diagnostics and cleanup corrections remain reported separately.",
        "- A speed ratio above 1 means the measured CPTP path was faster; below 1 means RK4 was faster.",
        "- These timings are local observations, not universal performance guarantees.",
        "",
        "## Scope",
        "",
        "This validates the tested small-system trajectories. It does not prove that arbitrary finite RK4 steps are CPTP, nor does it establish calibrated-hardware accuracy.",
        "",
    ])
    return "\n".join(lines)


def _parse_arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--repetitions",
        type=int,
        default=5,
    )
    parser.add_argument(
        "--json-path",
        type=Path,
        default=DEFAULT_JSON_PATH,
    )
    parser.add_argument(
        "--markdown-path",
        type=Path,
        default=DEFAULT_MARKDOWN_PATH,
    )
    arguments = parser.parse_args()
    if arguments.repetitions <= 0:
        parser.error("--repetitions must be positive")
    return arguments


def _state_zero() -> Matrix:
    return (
        (1.0 + 0.0j, 0.0 + 0.0j),
        (0.0 + 0.0j, 0.0 + 0.0j),
    )


def _state_plus() -> Matrix:
    return (
        (0.5 + 0.0j, 0.5 + 0.0j),
        (0.5 + 0.0j, 0.5 + 0.0j),
    )


def _qutrit_state() -> Matrix:
    return (
        (0.58 + 0.0j, 0.13 + 0.0j, 0.0 + 0.0j),
        (0.13 + 0.0j, 0.32 + 0.0j, 0.0 + 0.0j),
        (0.0 + 0.0j, 0.0 + 0.0j, 0.1 + 0.0j),
    )


if __name__ == "__main__":
    raise SystemExit(main())
