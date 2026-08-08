# Phase 0: Python Reference Freeze

## Status

**COMPLETE**

Phase 0 fixes the Python/NumPy implementation that later Rust, CPTP, QuTiP,
and hardware-audit phases will use as their reference. The current source is
not frozen yet because it is based on commit
`7ba959a050423d64805e6b64dcbcbf805df068a1` with a dirty working tree.

The scoped commit sequence was explicitly approved after the inventory and
validation results were reviewed. The Python reference source commit is
`28b28a5aa82ddbcef1ae22c974846f7ea5ff2c0d`, and the release tag is
`yuragi-strider-python-reference-pulse-b-v1`.

## Inventory Snapshot

Inventory date: 2026-07-25

`git status --porcelain=v1 -uall` expands the current work into 280 file-level
changes:

| Area | Files | Classification |
|---|---:|---|
| `core/` | 9 | Python reference physics and pulse execution |
| `api/` | 4 | API contract and bounded pulse execution |
| `frontend/` | 50 | React gate-aware and independent Pulse Lab clients |
| `tests/` | 23 | Regression and physics-verification tests |
| `scripts/` | 15 | Validation, audit, and freeze entry points |
| `validation_pulse/` | 12 | Reusable independent validation helpers |
| `validation_results/` | 54 | Generated JSON, CSV, and PNG evidence |
| `docs/` | 82 | Contracts, model descriptions, plans, and reports |
| `app/` | 17 | Intentional removal of the obsolete Streamlit UI |
| dependency and root files | 14 | Environment, setup, policy, and legacy cleanup |
| **Total** | **280** | 80 modified, 33 deleted, 167 untracked |

The B-7 freeze manifest uses Git's collapsed untracked-directory view and
therefore reports a smaller working-tree change count. The file-level count
above is used for commit-scope review.

## Freeze Scope

### 1. Python reference physics and API

Include:

- the existing gate-aware Python/NumPy implementation,
- two-level Pulse Baseline A,
- qutrit Pulse Extension B,
- pulse request/response contracts,
- bounded API execution,
- capability declarations,
- runtime and validation dependency manifests.

Primary paths:

```text
core/
api/
requirements.txt
requirements-runtime.txt
requirements-validation.txt
requirements-lock.txt
.python-version
```

### 2. Validation implementation and evidence

Include:

```text
tests/
scripts/
validation_pulse/
validation_results/
```

Generated validation artifacts are included only when their producing script,
pass/fail status, and hash are present in the freeze manifest. They are
scientific evidence, not disposable build output.

### 3. React and API-facing contract

Include `frontend/` because the Phase 0 acceptance gate requires frontend
contract validation, lint, and build. Pulse Lab must remain independent from
Circuit Studio and the gate-aware State Explorer.

### 4. Documentation

Include current architecture, physics, validation, requirements, and
development documentation under `docs/`. Deleted historical prompt copies and
superseded status documents remain deletions only after the canonical Markdown
link audit confirms no active document depends on them.

### 5. Legacy cleanup

The following removals are intentional but should be a distinct review unit:

- obsolete `app/` Streamlit UI,
- `streamlit.err.log` and `streamlit.out.log`,
- obsolete `test1.py`,
- obsolete `scripts/plot_results.py`,
- replaced `validation/qutip_adapter.py`,
- obsolete `tests/test_config_ui_sync.py`,
- superseded prompt and limitation documents.

The tag describes the React/FastAPI/Python reference system, not the removed
Streamlit client.

## Exclusion Audit

Do not add any of the following if they appear before commit:

```text
.env
.env.*
secrets/
*.pem
*.key
__pycache__/
*.pyc
frontend/node_modules/
frontend/dist/
.streamlit/
```

The repository currently exposes no untracked secret file in
`git status --porcelain=v1 -uall`. Secret contents must never be inspected or
committed.

## Commit Stack

The freeze was split into the following reviewed commits, with the tag placed
on the final clean documentation commit:

1. `65a7818` `chore: retire obsolete Streamlit surface and stale artifacts`
2. `6f539c6` `feat: freeze Python gate-aware and pulse reference models`
3. `317af13` `feat: freeze React simulation and Pulse Lab contracts`
4. `28b28a5` `test: freeze validation suite and reproducible evidence`
5. `docs: record Python reference freeze`

The exact staged file list must be inspected before every commit. Do not use a
blind `git add .`.

Recommended final tag:

```text
yuragi-strider-python-reference-pulse-b-v1
```

## Reproducibility Snapshot

| Item | Value |
|---|---|
| Base commit | `7ba959a050423d64805e6b64dcbcbf805df068a1` |
| Branch | `React-phase` |
| Python | `3.14.4` |
| NumPy | `2.4.4` |
| SciPy | `1.17.1` |
| QuTiP | `5.2.3` |
| FastAPI | `0.138.1` |
| Pydantic | `2.13.4` |
| Node.js | `24.15.0` |
| npm | `11.12.1` |
| OpenAPI hash | `531ce1b5dd6e399fb21bb7f98b8ae6ab61e1dc5b068a1e85aa8a56f0e8b48c3f` |

## Validation Gate

Phase 0 must record fresh results for:

```text
gate-aware V1-V7
Pulse Baseline A
Pulse Extension B
full Python unittest discovery
Pulse Lab contract validation
frontend lint
frontend production build
API smoke checks
canonical Markdown link audit
freeze manifest regeneration
git diff --check
```

The machine-readable freeze record is
[`../../../validation_results/phase0_python_reference_freeze.json`](../../../validation_results/phase0_python_reference_freeze.json).

## Completion Checklist

- [x] File-level working-tree inventory created
- [x] Freeze scope classified
- [x] Legacy cleanup isolated as a review unit
- [x] Reproducibility versions recorded
- [x] Gate-aware V1-V7 freshly regenerated
- [x] Pulse Baseline A freshly regenerated
- [x] Pulse Extension B freshly regenerated
- [x] Full Python regression passed: 471 tests in 526.510 seconds
- [x] Frontend contract, lint, and build passed
- [x] API smoke checks passed: 39 tests in 9.496 seconds
- [x] Canonical Markdown audit passed: 24 documents, 44 links
- [x] Dirty-tree freeze artifact regenerated from the current source state
- [x] Phase 0 candidate manifest generated
- [x] Final Phase 0 freeze artifact records the reference source
- [x] Exact staged scope reviewed
- [x] Commit approval received
- [x] Working tree clean after release commit
- [x] Reference tag created

## Go / No-Go

Current decision: **GO FOR PHASE 1**

Reason: the source scope is classified, all Phase 0 validation passed, the
reference source is uniquely committed, and the release tag is fixed.
