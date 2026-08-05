import unittest

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.physical_timeline import build_physical_timeline
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulator import run_simulation
from core.ui_response import simulation_result_to_ui_response


class PhysicalTimelineTest(unittest.TestCase):
    def test_parallel_operations_share_column_duration_and_events_are_monotonic(self):
        circuit = CircuitConfig(
            logical_qubits=2,
            initial_states=["0", "0"],
            columns=[
                GateColumn(0, [
                    GateOperation("H", [0], params={"duration_us": 0.02}),
                    GateOperation("X", [1], params={"duration_us": 0.05}),
                ]),
                GateColumn(1, [
                    GateOperation("CNOT", [1], controls=[0], params={"duration_us": 0.2}),
                ]),
            ],
        )

        timeline = build_physical_timeline(
            circuit,
            sampled_times_us=[0.0, 0.125, 0.25, 0.5],
            requested_duration_us=0.5,
        )

        first, second, idle = timeline["events"]
        self.assertAlmostEqual(first["start_us"], 0.0)
        self.assertAlmostEqual(first["duration_us"], 0.05)
        self.assertAlmostEqual(first["end_us"], 0.05)
        self.assertAlmostEqual(first["operations"][0]["declared_duration_us"], 0.02)
        self.assertAlmostEqual(first["operations"][0]["effective_column_duration_us"], 0.05)
        self.assertAlmostEqual(second["start_us"], first["end_us"])
        self.assertAlmostEqual(second["end_us"], 0.25)
        self.assertEqual(idle["kind"], "idle")
        self.assertAlmostEqual(idle["end_us"], timeline["total_duration_us"])
        for event in timeline["events"]:
            self.assertAlmostEqual(
                event["end_us"],
                event["start_us"] + event["duration_us"],
            )

    def test_empty_circuit_is_idle_only(self):
        timeline = build_physical_timeline(
            CircuitConfig(logical_qubits=1, initial_states=["0"], columns=[]),
            sampled_times_us=[0.0, 1.0],
            requested_duration_us=1.0,
        )
        self.assertEqual([event["kind"] for event in timeline["events"]], ["idle"])
        self.assertAlmostEqual(timeline["circuit_completion_time_us"], 0.0)

    def test_run_result_and_ui_response_expose_same_additive_contract(self):
        config = SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=EnvironmentConfig(),
            duration_us=0.1,
            time_steps=3,
        )
        result = run_simulation(config)
        response = simulation_result_to_ui_response(result)

        self.assertEqual(response["physical_timeline"], result.physical_timeline)
        self.assertIn("circuit_probes", response)
        self.assertIn("timeline", response)
        self.assertIn("state_snapshots", response)
        restored = SimulationResult.from_dict(result.to_dict())
        self.assertEqual(restored.physical_timeline, result.physical_timeline)

    def test_circuit_probes_reference_available_logical_boundaries(self):
        result = run_simulation(SimulationConfig(
            circuit=CircuitConfig(
                logical_qubits=1,
                initial_states=["0"],
                columns=[
                    GateColumn(0, [GateOperation("H", [0], params={"duration_us": 0.02})]),
                    GateColumn(1, [GateOperation("X", [0], params={"duration_us": 0.02})]),
                ],
            ),
            environment=EnvironmentConfig(),
            duration_us=0.1,
            time_steps=5,
        ))
        response = simulation_result_to_ui_response(result)
        probes = response["circuit_probes"]
        self.assertEqual([probe["circuit_position"]["boundary"] for probe in probes], [
            "before", "after", "after", "completion", "final",
        ])
        self.assertEqual(
            [probe["circuit_position"]["column_index"] for probe in probes],
            [None, 0, 1, None, None],
        )
        self.assertTrue(all(probe["ideal_snapshot_index"] is not None for probe in probes))

    def test_auto_decomposition_maps_execution_columns_to_logical_column(self):
        config = SimulationConfig(
            circuit=CircuitConfig(
                logical_qubits=1,
                initial_states=["0"],
                columns=[GateColumn(0, [
                    GateOperation("RX", [0], params={"theta_rad": 0.5, "duration_us": 0.1}),
                ])],
            ),
            environment=EnvironmentConfig(ideal_reference=True),
            duration_us=0.2,
            time_steps=3,
            compilation_mode="auto_decompose",
            native_gate_durations_us={"H": 0.02, "RZ": 0.02},
        )
        result = run_simulation(config)
        column_events = [
            event for event in result.physical_timeline["events"]
            if event["kind"] == "circuit_column"
        ]
        self.assertEqual(len(column_events), 3)
        self.assertTrue(all(event["source_circuit_columns"] == [0] for event in column_events))


if __name__ == "__main__":
    unittest.main()
