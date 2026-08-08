# Phase 3B: Hardware Dataset Selection

## Status

```text
Phase 3B status: IN PROGRESS
Dataset selection: COMPLETE
Dataset contract: FROZEN
Pilot contract: FROZEN
Hardware collection: NOT STARTED
Formal holdout audit: NOT STARTED
Formal execution gate: BLOCKED BY ACCOUNT, NETWORK, AND BUDGET APPROVAL
```

Phase 3B begins by fixing what counts as trustworthy hardware evidence. No QPU
job has been submitted and no account credential is stored in the repository.

The dataset contract was frozen before provider execution. Gate-aware explicit
CPTP is now frozen separately; hardware collection remains blocked by account,
network, budget, and provider-execution approval.

## Decision

The formal Phase 3B PASS/FAIL decision will use a purpose-built,
preregistered dataset:

```text
dataset_id: yuragi_strider_hardware_audit_dataset_v1
short_name: QHAD-v1
provider candidate: IBM Quantum
```

Two third-party datasets are selected for separate supporting roles:

1. NPL driven-qubit data is a model-discrepancy stress dataset.
2. Aalto single-shot readout data is auxiliary T1, Ramsey, and SPAM evidence.

Third-party evidence does not replace the QHAD-v1 holdout because the existing
datasets do not simultaneously provide Yuragi-Strider's exact circuits,
same-session backend properties, preregistered calibration/holdout separation,
and all required gate-aware outputs.

## Why QHAD-v1 Is Primary

QHAD-v1 can preserve:

- exact submitted and compiled circuits;
- raw counts or bit arrays;
- job and device identifiers;
- execution timestamps;
- same-session calibration snapshots;
- qubit mapping and backend target data;
- fixed calibration and holdout case IDs;
- failed jobs and exclusions;
- Yuragi-Strider source revision and software versions.

IBM documents an Open Plan for limited free QPU access, backend properties
including T1, T2, gate length, and error, and persistent job result retrieval.
These capabilities make a small provider-neutral pilot feasible without a
research-laboratory connection:

- [IBM Quantum plans overview](https://quantum.cloud.ibm.com/docs/en/guides/plans-overview)
- [IBMBackend properties](https://quantum.cloud.ibm.com/docs/en/api/qiskit-ibm-runtime/0.33/ibm-backend)
- [Retrieve and save job results](https://quantum.cloud.ibm.com/docs/en/guides/save-jobs)
- [Monitoring and calibration](https://quantum.cloud.ibm.com/docs/en/guides/calibration-jobs)

IBM access remains a provider candidate rather than a permanent scientific
dependency. The on-disk schema must remain provider-neutral.

## Trust Criteria

A formal dataset must provide:

1. real superconducting-qubit observations;
2. primary-source provenance;
3. persistent dataset or provider job identifiers;
4. raw observations, not only plotted or fitted values;
5. circuit, timing, unit, basis, and bit-order semantics;
6. calibration and holdout separation;
7. checksums and transformation history;
8. uncertainty, SPAM, drift, failure, and exclusion records;
9. explicit rights review before redistribution;
10. enough information to reproduce documentation claims.

Simulated datasets can support internal validation but cannot satisfy Phase 3B.

## QHAD-v1 Split

Pilot data is permanently excluded from the formal holdout.

Calibration cases:

```text
readout_confusion_calibration
t1_parameter_subset
ramsey_parameter_subset
```

Formal holdout cases:

```text
t1_delay_holdout
ramsey_delay_holdout
idle_initial_state_holdout
single_qubit_sequence_holdout
bell_distribution_holdout
```

Parameters must not be refit after holdout results are inspected. Any such
analysis is labeled exploratory and cannot produce a formal PASS.

## External Stress Dataset

Selected record:

- [NPL: Modelling non-Markovian noise in driven superconducting qubits](https://zenodo.org/records/8363718)
- Dataset DOI: `10.5281/zenodo.8363718`
- Paper DOI: `10.1088/2058-9565/ad3d7e`

Reasons:

- real superconducting-qubit data;
- compact machine-readable CSV and README;
- immutable DOI and file checksums;
- idle and driven observations;
- associated peer-reviewed publication;
- known case where a purely Markovian model is insufficient.

This is valuable precisely because it may not agree with Yuragi-Strider. It is
used to document model-form limitations, not to tune the model until it passes.

The inspected record did not clearly expose a reuse license. The file metadata
is frozen, but raw files must not be committed or redistributed until rights
are confirmed.

## External T1/Ramsey/SPAM Dataset

Selected record:

- [Aalto: Data for Single-Shot Readout of a Superconducting Qubit Using a Thermal Detector](https://zenodo.org/records/7773981)
- Dataset DOI: `10.5281/zenodo.7773981`
- Paper DOI: `10.1038/s41928-024-01147-7`

Reasons:

- transmon T1 and Ramsey characterization;
- single-shot readout distributions;
- documented averaging and readout conditions;
- associated peer-reviewed publication;
- DOI and archive checksum.

Restrictions:

- specialized thermal-detector readout;
- large archive;
- some characterization followed a thermal cycle;
- not a matched Bell-circuit holdout;
- redistribution remains blocked until license review.

It is auxiliary evidence for SPAM and documentation methodology, not the
formal Yuragi-Strider prediction dataset.

## Rejected or Deferred Candidates

| Candidate | Decision | Reason |
|---|---|---|
| QDataSet | Reject for Phase 3B | Simulation-derived, not hardware evidence |
| Decoherence benchmarking of superconducting qubits | Defer | Data and code available only on request |
| Real-time low-latency QEC dataset | Defer as primary | Strong raw provenance, but circuit scope is not matched to primary endpoints |

## Documentation Readiness

Every formal result must be convertible into a documentation evidence card:

```text
Dataset identity
Why it is trusted
Hardware and execution scope
Calibration subset
Holdout subset
Primary metric and uncertainty
Comparison with ideal baseline
Comparison with simple-noise baseline
Known failures
Allowed claim
Prohibited claim
Citation
```

This prevents later product documentation from overstating a result or losing
the connection between a claim and its source data.

## Frozen Registry

Machine-readable selection:

[`../../../validation_results/phase3b_hardware_dataset_registry.json`](../../../validation_results/phase3b_hardware_dataset_registry.json)

Contract validator:

[`../../../validation_hardware/dataset_registry.py`](../../../validation_hardware/dataset_registry.py)

Regression tests:

[`../../../tests/test_phase3b_dataset_registry.py`](../../../tests/test_phase3b_dataset_registry.py)

## Next Gate

Before any network or QPU execution:

1. obtain explicit approval for account-backed network execution;
2. select a backend and record its properties, native `dt`, and calibration;
3. use the frozen pilot limits and cases in `phase3b-pilot-plan.md`;
4. freeze the provider-neutral raw-data manifest for the selected backend;
5. verify the source commit, software versions, bit order, and transpilation policy.

Only after this gate may the non-formal pilot be submitted.
