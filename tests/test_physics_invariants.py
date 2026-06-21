import unittest

from tests.physics_test_helpers import (
    EIGENVALUE_LOWER_TOL,
    FIDELITY_PURITY_TOL,
    HERMITICITY_TOL,
    PROBABILITY_SUM_TOL,
    TRACE_TOL,
    assert_no_nan_or_inf,
    finite_numeric_derived_values,
    hermitian_eigenvalues,
    make_bell_config,
    make_normalized_environment,
    make_one_qubit_h_config,
    make_physical_environment,
    matrix_trace,
    max_hermiticity_error,
    run_and_reconstruct,
)


class PhysicsInvariantsTest(unittest.TestCase):
    def test_representative_simulations_preserve_quantum_state_invariants(self) -> None:
        configs = [
            make_one_qubit_h_config(make_physical_environment(
                device_quality=1.0,
                temperature_mk=0.0,
                flux_noise_phi0=0.0,
                t1_max_us=1e6,
                tphi_max_us=1e6,
            )),
            make_one_qubit_h_config(make_normalized_environment(0.3, 0.4, 0.5)),
            make_bell_config(make_physical_environment(
                device_quality=0.8,
                temperature_mk=80.0,
                flux_noise_phi0=5e-6,
            )),
        ]

        for config in configs:
            with self.subTest(config=config.to_dict()):
                result, density = run_and_reconstruct(config)
                dimension = 2 ** config.circuit.logical_qubits

                self.assertAlmostEqual(matrix_trace(density).real, 1.0, delta=TRACE_TOL)
                self.assertAlmostEqual(matrix_trace(density).imag, 0.0, delta=TRACE_TOL)
                self.assertLessEqual(max_hermiticity_error(density), HERMITICITY_TOL)
                self.assertGreaterEqual(
                    min(hermitian_eigenvalues(density)),
                    EIGENVALUE_LOWER_TOL,
                )

                assert_no_nan_or_inf(result.times)
                assert_no_nan_or_inf(result.fidelity)
                assert_no_nan_or_inf(result.purity)
                assert_no_nan_or_inf(result.output_probabilities.values())
                assert_no_nan_or_inf(finite_numeric_derived_values(result))

                for fidelity in result.fidelity:
                    self.assertGreaterEqual(fidelity, -FIDELITY_PURITY_TOL)
                    self.assertLessEqual(fidelity, 1.0 + FIDELITY_PURITY_TOL)
                for purity in result.purity:
                    self.assertGreaterEqual(
                        purity,
                        (1.0 / dimension) - FIDELITY_PURITY_TOL,
                    )
                    self.assertLessEqual(purity, 1.0 + FIDELITY_PURITY_TOL)
                for probability in result.output_probabilities.values():
                    self.assertGreaterEqual(probability, -FIDELITY_PURITY_TOL)
                self.assertAlmostEqual(
                    sum(result.output_probabilities.values()),
                    1.0,
                    delta=PROBABILITY_SUM_TOL,
                )


if __name__ == "__main__":
    unittest.main()
