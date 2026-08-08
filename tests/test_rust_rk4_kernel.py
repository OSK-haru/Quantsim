import math
import unittest


try:
    import yuragi_strider_rust
except Exception:  # pragma: no cover - optional local Rust extension.
    yuragi_strider_rust = None


@unittest.skipIf(yuragi_strider_rust is None, "yuragi_strider_rust is not importable")
class RustRk4KernelTest(unittest.TestCase):
    def test_zero_rhs_leaves_rho_unchanged(self) -> None:
        rho = [
            [0.5 + 0.0j, 0.25 + 0.1j],
            [0.25 - 0.1j, 0.5 + 0.0j],
        ]
        hamiltonian = _zero_matrix(2)

        result = yuragi_strider_rust.rk4_evolve_flat(
            _flatten(rho),
            _flatten(hamiltonian),
            [],
            0,
            2,
            0.01,
            3,
        )

        _assert_flat_close(self, result, _flatten(rho))

    def test_hamiltonian_only_matches_python_reference(self) -> None:
        rho = [
            [0.6 + 0.0j, 0.2 + 0.15j],
            [0.2 - 0.15j, 0.4 + 0.0j],
        ]
        hamiltonian = [
            [1.0 + 0.0j, 0.3 - 0.2j],
            [0.3 + 0.2j, -0.5 + 0.0j],
        ]

        result = yuragi_strider_rust.rk4_evolve_flat(
            _flatten(rho),
            _flatten(hamiltonian),
            [],
            0,
            2,
            0.005,
            1,
        )
        expected = _flatten(_python_rk4_evolve(rho, hamiltonian, [], 0.005, 1))

        _assert_flat_close(self, result, expected)

    def test_pure_dephasing_matches_python_reference(self) -> None:
        rho = [
            [0.5 + 0.0j, 0.4 + 0.1j],
            [0.4 - 0.1j, 0.5 + 0.0j],
        ]
        hamiltonian = _zero_matrix(2)
        collapse = [
            [0.2 + 0.0j, 0.0 + 0.0j],
            [0.0 + 0.0j, -0.2 + 0.0j],
        ]

        result = yuragi_strider_rust.rk4_evolve_flat(
            _flatten(rho),
            _flatten(hamiltonian),
            _flatten(collapse),
            1,
            2,
            0.01,
            1,
        )
        expected = _flatten(_python_rk4_evolve(rho, hamiltonian, [collapse], 0.01, 1))

        _assert_flat_close(self, result, expected)

    def test_amplitude_damping_matches_python_reference(self) -> None:
        rho = [
            [0.2 + 0.0j, 0.1 - 0.05j],
            [0.1 + 0.05j, 0.8 + 0.0j],
        ]
        hamiltonian = _zero_matrix(2)
        sigma_minus = [
            [0.0 + 0.0j, math.sqrt(0.3) + 0.0j],
            [0.0 + 0.0j, 0.0 + 0.0j],
        ]

        result = yuragi_strider_rust.rk4_evolve_flat(
            _flatten(rho),
            _flatten(hamiltonian),
            _flatten(sigma_minus),
            1,
            2,
            0.01,
            1,
        )
        expected = _flatten(_python_rk4_evolve(rho, hamiltonian, [sigma_minus], 0.01, 1))

        _assert_flat_close(self, result, expected)

    def test_multiple_substeps_match_python_reference(self) -> None:
        rho = [
            [0.35 + 0.0j, -0.2 + 0.25j],
            [-0.2 - 0.25j, 0.65 + 0.0j],
        ]
        hamiltonian = [
            [0.0 + 0.0j, 0.1 + 0.2j],
            [0.1 - 0.2j, 0.25 + 0.0j],
        ]
        sigma_minus = [
            [0.0 + 0.0j, math.sqrt(0.4) + 0.0j],
            [0.0 + 0.0j, 0.0 + 0.0j],
        ]
        dephasing_z = [
            [math.sqrt(0.2) + 0.0j, 0.0 + 0.0j],
            [0.0 + 0.0j, -math.sqrt(0.2) + 0.0j],
        ]
        collapse_ops = [sigma_minus, dephasing_z]

        result = yuragi_strider_rust.rk4_evolve_flat(
            _flatten(rho),
            _flatten(hamiltonian),
            _flatten_many(collapse_ops),
            len(collapse_ops),
            2,
            0.004,
            5,
        )
        expected = _flatten(_python_rk4_evolve(
            rho,
            hamiltonian,
            collapse_ops,
            0.004,
            5,
        ))

        _assert_flat_close(self, result, expected, delta=1e-10)

    def test_invalid_inputs_raise_value_error(self) -> None:
        valid = _flatten([
            [1.0 + 0.0j, 0.0 + 0.0j],
            [0.0 + 0.0j, 1.0 + 0.0j],
        ])

        with self.assertRaises(ValueError):
            yuragi_strider_rust.rk4_evolve_flat([1.0, 0.0], valid, [], 0, 2, 0.01, 1)

        with self.assertRaises(ValueError):
            yuragi_strider_rust.rk4_evolve_flat(valid, [1.0, 0.0], [], 0, 2, 0.01, 1)

        with self.assertRaises(ValueError):
            yuragi_strider_rust.rk4_evolve_flat(valid, valid, [1.0, 0.0], 1, 2, 0.01, 1)

        with self.assertRaises(ValueError):
            yuragi_strider_rust.rk4_evolve_flat([], [], [], 0, 0, 0.01, 1)

        with self.assertRaises(ValueError):
            yuragi_strider_rust.rk4_evolve_flat(valid, valid, [], 0, 2, 0.01, 0)

        with self.assertRaises(ValueError):
            yuragi_strider_rust.rk4_evolve_flat(valid, valid, [], 0, 2, math.nan, 1)

        with self.assertRaises(ValueError):
            yuragi_strider_rust.rk4_evolve_flat(valid, valid, [], 0, 2, math.inf, 1)


def _flatten(matrix: list[list[complex]]) -> list[float]:
    values: list[float] = []
    for row in matrix:
        for value in row:
            values.extend([float(value.real), float(value.imag)])
    return values


def _flatten_many(matrices: list[list[list[complex]]]) -> list[float]:
    values: list[float] = []
    for matrix in matrices:
        values.extend(_flatten(matrix))
    return values


def _zero_matrix(dimension: int) -> list[list[complex]]:
    return [
        [0.0 + 0.0j for _ in range(dimension)]
        for _ in range(dimension)
    ]


def _python_rk4_evolve(
    rho: list[list[complex]],
    hamiltonian: list[list[complex]],
    collapse_ops: list[list[list[complex]]],
    dt: float,
    substeps: int,
) -> list[list[complex]]:
    evolved = [row[:] for row in rho]
    for _ in range(substeps):
        k1 = _python_lindblad_rhs(evolved, hamiltonian, collapse_ops)
        k2 = _python_lindblad_rhs(_add_scaled(evolved, k1, 0.5 * dt), hamiltonian, collapse_ops)
        k3 = _python_lindblad_rhs(_add_scaled(evolved, k2, 0.5 * dt), hamiltonian, collapse_ops)
        k4 = _python_lindblad_rhs(_add_scaled(evolved, k3, dt), hamiltonian, collapse_ops)
        evolved = [
            [
                evolved[row][column]
                + dt / 6.0 * (
                    k1[row][column]
                    + 2.0 * k2[row][column]
                    + 2.0 * k3[row][column]
                    + k4[row][column]
                )
                for column in range(len(evolved[row]))
            ]
            for row in range(len(evolved))
        ]
    return evolved


def _python_lindblad_rhs(
    rho: list[list[complex]],
    hamiltonian: list[list[complex]],
    collapse_ops: list[list[list[complex]]],
) -> list[list[complex]]:
    derivative = _scale(
        -1.0j,
        _subtract(_matmul(hamiltonian, rho), _matmul(rho, hamiltonian)),
    )
    for collapse_op in collapse_ops:
        collapse_adjoint = _adjoint(collapse_op)
        ldl = _matmul(collapse_adjoint, collapse_op)
        dissipator = _subtract(
            _matmul(_matmul(collapse_op, rho), collapse_adjoint),
            _scale(0.5, _add(_matmul(ldl, rho), _matmul(rho, ldl))),
        )
        derivative = _add(derivative, dissipator)
    return derivative


def _matmul(left: list[list[complex]], right: list[list[complex]]) -> list[list[complex]]:
    dimension = len(left)
    return [
        [
            sum(left[row][inner] * right[inner][column] for inner in range(dimension))
            for column in range(dimension)
        ]
        for row in range(dimension)
    ]


def _adjoint(matrix: list[list[complex]]) -> list[list[complex]]:
    return [
        [matrix[row][column].conjugate() for row in range(len(matrix))]
        for column in range(len(matrix))
    ]


def _add(left: list[list[complex]], right: list[list[complex]]) -> list[list[complex]]:
    return [
        [left[row][column] + right[row][column] for column in range(len(left[row]))]
        for row in range(len(left))
    ]


def _subtract(left: list[list[complex]], right: list[list[complex]]) -> list[list[complex]]:
    return [
        [left[row][column] - right[row][column] for column in range(len(left[row]))]
        for row in range(len(left))
    ]


def _scale(value: complex, matrix: list[list[complex]]) -> list[list[complex]]:
    return [[value * entry for entry in row] for row in matrix]


def _add_scaled(
    base: list[list[complex]],
    delta: list[list[complex]],
    scale: float,
) -> list[list[complex]]:
    return [
        [
            base[row][column] + scale * delta[row][column]
            for column in range(len(base[row]))
        ]
        for row in range(len(base))
    ]


def _assert_flat_close(
    test_case: unittest.TestCase,
    actual: list[float],
    expected: list[float],
    delta: float = 1e-12,
) -> None:
    test_case.assertEqual(len(actual), len(expected))
    for actual_value, expected_value in zip(actual, expected):
        test_case.assertAlmostEqual(actual_value, expected_value, delta=delta)


if __name__ == "__main__":
    unittest.main()
