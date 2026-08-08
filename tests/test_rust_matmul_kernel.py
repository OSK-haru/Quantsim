import math
import unittest


try:
    import yuragi_strider_rust
except Exception:  # pragma: no cover - optional local Rust extension.
    yuragi_strider_rust = None


@unittest.skipIf(yuragi_strider_rust is None, "yuragi_strider_rust is not importable")
class RustMatmulKernelTest(unittest.TestCase):
    def test_matmul_complex_flat_identity_1q(self) -> None:
        identity = _flatten([
            [1.0 + 0.0j, 0.0 + 0.0j],
            [0.0 + 0.0j, 1.0 + 0.0j],
        ])

        result = yuragi_strider_rust.matmul_complex_flat(identity, identity, 2)

        _assert_flat_close(self, result, identity)

    def test_matmul_complex_flat_pauli_x_squared_is_identity(self) -> None:
        pauli_x = _flatten([
            [0.0 + 0.0j, 1.0 + 0.0j],
            [1.0 + 0.0j, 0.0 + 0.0j],
        ])
        identity = _flatten([
            [1.0 + 0.0j, 0.0 + 0.0j],
            [0.0 + 0.0j, 1.0 + 0.0j],
        ])

        result = yuragi_strider_rust.matmul_complex_flat(pauli_x, pauli_x, 2)

        _assert_flat_close(self, result, identity)

    def test_matmul_complex_flat_h_squared_is_identity(self) -> None:
        inv_sqrt2 = 1.0 / math.sqrt(2.0)
        h_gate = _flatten([
            [inv_sqrt2 + 0.0j, inv_sqrt2 + 0.0j],
            [inv_sqrt2 + 0.0j, -inv_sqrt2 + 0.0j],
        ])
        identity = _flatten([
            [1.0 + 0.0j, 0.0 + 0.0j],
            [0.0 + 0.0j, 1.0 + 0.0j],
        ])

        result = yuragi_strider_rust.matmul_complex_flat(h_gate, h_gate, 2)

        _assert_flat_close(self, result, identity)

    def test_matmul_complex_flat_matches_python_for_small_complex_matrix(self) -> None:
        left = [
            [1.0 + 2.0j, -3.0 + 0.5j],
            [0.25 - 1.5j, 2.0 - 2.0j],
        ]
        right = [
            [-1.0 + 0.25j, 4.0 - 1.0j],
            [0.5 + 3.0j, -2.0 + 0.75j],
        ]

        result = yuragi_strider_rust.matmul_complex_flat(
            _flatten(left),
            _flatten(right),
            2,
        )
        expected = _flatten(_python_matmul(left, right))

        _assert_flat_close(self, result, expected)

    def test_matmul_complex_flat_rejects_bad_lengths(self) -> None:
        with self.assertRaises(ValueError):
            yuragi_strider_rust.matmul_complex_flat([1.0, 0.0], [1.0, 0.0], 2)

        with self.assertRaises(ValueError):
            yuragi_strider_rust.matmul_complex_flat(
                _flatten([[1.0 + 0.0j]]),
                [1.0, 0.0],
                2,
            )

    def test_matmul_complex_flat_rejects_zero_dimension(self) -> None:
        with self.assertRaises(ValueError):
            yuragi_strider_rust.matmul_complex_flat([], [], 0)


def _flatten(matrix: list[list[complex]]) -> list[float]:
    values: list[float] = []
    for row in matrix:
        for value in row:
            values.extend([float(value.real), float(value.imag)])
    return values


def _python_matmul(
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
