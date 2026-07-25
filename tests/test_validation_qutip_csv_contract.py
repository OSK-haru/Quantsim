"""Regression check for the VALIDATION-7 CSV metric contract."""

from __future__ import annotations

import unittest

import numpy as np

from scripts.validate_qutip_comparison import CSV_FIELDS
from validation_pulse.qutip_adapter import compare_density_matrices


class ValidationQutipCsvContractTests(unittest.TestCase):
    def test_csv_fields_include_every_density_comparison_metric(self) -> None:
        state = np.array([[1.0, 0.0], [0.0, 0.0]], dtype=complex)
        metrics = compare_density_matrices(state, state)

        self.assertTrue(set(metrics).issubset(CSV_FIELDS))


if __name__ == "__main__":
    unittest.main()
