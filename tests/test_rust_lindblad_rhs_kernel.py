import math
import unittest


try:
    import quantascope_rust
except Exception:  # pragma: no cover - optional local Rust extension.
    quantascope_rust = None


@unittest.skipIf(quantascope_rust is None, "quantascope_rust is not importable")
class RustLindbladRhsKernelTest(unittest.TestCase):
    def test_zero_h_and_zero_collapse_ops_returns_zero_matrix(self) -> None:
        rho = [
            [0.5 + 0.0j, 0.25 + 0.1j],
            [0.25 - 0.1j, 0.5 + 0.0j],
        ]
        zero = _zero_matrix(2)

        result = quantascope_rust.lindblad_rhs_flat(
            _flatten(rho),
            _flatten(zero),
            [],
            0,
            2,
        )

        _assert_flat_close(self, result, _flatten(zero))

    def test_hamiltonian_only_matches_python_reference(self) -> None:
        rho = [
            [0.6 + 0.0j, 0.2 + 0.15j],
            [0.2 - 0.15j, 0.4 + 0.0j],
        ]
        hamiltonian = [
            [1.0 + 0.0j, 0.3 - 0.2j],
            [0.3 + 0.2j, -0.5 + 0.0j],
        ]

        result = quantascope_rust.lindblad_rhs_flat(
            _flatten(rho),
            _flatten(hamiltonian),
            [],
            0,
            2,
        )
        expected = _flatten(_python_lindblad_rhs(rho, hamiltonian, []))

        _assert_flat_close(self, result, expected)

    def test_pure_dephasing_z_collapse_matches_python_reference(self) -> None:
        rho = [
            [0.5 + 0.0j, 0.4 + 0.1j],
            [0.4 - 0.1j, 0.5 + 0.0j],
        ]
        hamiltonian = _zero_matrix(2)
        collapse = [
            [0.2 + 0.0j, 0.0 + 0.0j],
            [0.0 + 0.0j, -0.2 + 0.0j],
        ]

        result = quantascope_rust.lindblad_rhs_flat(
            _flatten(rho),
            _flatten(hamiltonian),
            _flatten(collapse),
            1,
            2,
        )
        expected = _flatten(_python_lindblad_rhs(rho, hamiltonian, [collapse]))

        _assert_flat_close(self, result, expected)

    def test_amplitude_damping_sigma_minus_matches_python_reference(self) -> None:
        rho = [
            [0.2 + 0.0j, 0.1 - 0.05j],
            [0.1 + 0.05j, 0.8 + 0.0j],
        ]
        hamiltonian = _zero_matrix(2)
        scale = math.sqrt(0.3)
        sigma_minus = [
            [0.0 + 0.0j, scale + 0.0j],
            [0.0 + 0.0j, 0.0 + 0.0j],
        ]

        result = quantascope_rust.lindblad_rhs_flat(
            _flatten(rho),
            _flatten(hamiltonian),
            _flatten(sigma_minus),
            1,
            2,
        )
        expected = _flatten(_python_lindblad_rhs(rho, hamiltonian, [sigma_minus]))

        _assert_flat_close(self, result, expected)

    def test_multiple_collapse_operators_match_python_reference(self) -> None:
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

        result = quantascope_rust.lindblad_rhs_flat(
            _flatten(rho),
            _flatten(hamiltonian),
            _flatten_many(collapse_ops),
            len(collapse_ops),
            2,
        )
        expected = _flatten(_python_lindblad_rhs(rho, hamiltonian, collapse_ops))

        _assert_flat_close(self, result, expected)

    def test_invalid_inputs_raise_value_error(self) -> None:
        valid = _flatten([
            [1.0 + 0.0j, 0.0 + 0.0j],
            [0.0 + 0.0j, 1.0 + 0.0j],
        ])

        with self.assertRaises(ValueError):
            quantascope_rust.lindblad_rhs_flat([1.0, 0.0], valid, [], 0, 2)

        with self.assertRaises(ValueError):
            quantascope_rust.lindblad_rhs_flat(valid, [1.0, 0.0], [], 0, 2)

        with self.assertRaises(ValueError):
            quantascope_rust.lindblad_rhs_flat(valid, valid, [1.0, 0.0], 1, 2)

        with self.assertRaises(ValueError):
            quantascope_rust.lindblad_rhs_flat([], [], [], 0, 0)


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


def _python_lindblad_rhs(
    rho: list[list[complex]],
    hamiltonian: list[list[complex]],
    collapse_ops: list[list[list[complex]]],
) -> list[list[complex]]:
    commutator = _subtract(
        _matmul(hamiltonian, rho),
        _matmul(rho, hamiltonian),
    )
    derivative = _scale(-1.0j, commutator)

    for collapse_op in collapse_ops:
        collapse_adjoint = _adjoint(collapse_op)
        ldl = _matmul(collapse_adjoint, collapse_op)
        term1 = _matmul(_matmul(collapse_op, rho), collapse_adjoint)
        term2 = _matmul(ldl, rho)
        term3 = _matmul(rho, ldl)
        dissipator = _subtract(
            term1,
            _scale(0.5, _add(term2, term3)),
        )
        derivative = _add(derivative, dissipator)

    return derivative


def _matmul(
    left: list[list[complex]],
    right: list[list[complex]],
) -> list[list[complex]]:
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


def _add(
    left: list[list[complex]],
    right: list[list[complex]],
) -> list[list[complex]]:
    return [
        [
            left[row][column] + right[row][column]
            for column in range(len(left[row]))
        ]
        for row in range(len(left))
    ]


def _subtract(
    left: list[list[complex]],
    right: list[list[complex]],
) -> list[list[complex]]:
    return [
        [
            left[row][column] - right[row][column]
            for column in range(len(left[row]))
        ]
        for row in range(len(left))
    ]


def _scale(value: complex, matrix: list[list[complex]]) -> list[list[complex]]:
    return [
        [value * entry for entry in row]
        for row in matrix
    ]


def _assert_flat_close(
    test_case: unittest.TestCase,
    actual: list[float],
    expected: list[float],
) -> None:
    test_case.assertEqual(len(actual), len(expected))
    for actual_value, expected_value in zip(actual, expected):
        test_case.assertAlmostEqual(actual_value, expected_value, delta=1e-12)


if __name__ == "__main__":
    unittest.main()
