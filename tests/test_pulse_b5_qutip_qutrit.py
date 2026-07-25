import unittest

from validation_pulse.qutip_adapter import (
    QUTIP_AVAILABLE,
    as_qutip_operator,
)
from validation_pulse.qutrit_qutip import (
    QUTRIT_QUTIP_TOLERANCE,
    run_qutrit_qutip_comparison,
)


@unittest.skipUnless(QUTIP_AVAILABLE, "validation-only QuTiP is unavailable")
class PulseB5QutritQutipTests(unittest.TestCase):
    def test_qutrit_adapter_preserves_dimensions_and_basis(self) -> None:
        operator = as_qutip_operator(
            [[1, 0, 0], [0, 2, 0], [0, 0, 3]],
            None,
            subsystem_dimensions=(3,),
        )
        self.assertEqual(operator.dims, [[3], [3]])
        self.assertEqual(operator.shape, (3, 3))

    def test_all_preregistered_qutrit_cases_match_qutip(self) -> None:
        report, rows = run_qutrit_qutip_comparison()
        self.assertTrue(report["pass"])
        self.assertEqual(report["subsystem_dimensions"], [3])
        self.assertEqual(report["basis_order"], ["0", "1", "2"])
        self.assertEqual(len(report["cases"]), 8)
        self.assertTrue(rows)
        self.assertLessEqual(
            report["maximum_errors"]["max_element_difference"],
            QUTRIT_QUTIP_TOLERANCE,
        )


if __name__ == "__main__":
    unittest.main()
