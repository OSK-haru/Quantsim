# 実行環境・技術スタック台帳

最終監査日: 2026-07-22
監査環境: Windows / PowerShell

## 1. 実行経路

### 標準: React UI + FastAPI + Python core

```text
Browser :5173
  -> Vite dev server
  -> /api proxy :8001
  -> FastAPI (api/main.py)
  -> Python simulator (core/)
  -> JSON response
```

- UI 開発 server: `npm run dev`
- API server: `python -m uvicorn api.main:app --host 127.0.0.1 --port 8001`
- health check: `GET /api/health`
- 主な API: `GET /api/simulation/example`, `POST /api/simulate`
- Vite proxy の接続先は `frontend/vite.config.ts` に固定されています。

### 任意: Rust dense preview

`rust_kernels/quantascope_rust` は PyO3 の Python 拡張です。未導入時は `python_dense` が標準 backend として動作します。API の現行 request model は `python_dense` のみを受け付けるため、Rust は開発・比較試験向けです。

## 2. toolchain

| tool | 監査済み version | 必須範囲 | 用途 |
|---|---:|---|---|
| Python | 3.14.4 | Python 全経路 | core、API、test |
| pip | 26.1.2 | Python 導入時 | Python package 管理 |
| Node.js | 24.15.0 | React UI のみ | Vite/TypeScript 実行 |
| npm | 11.12.1 | React UI のみ | `package-lock.json` による再現 |
| rustc / Cargo | 1.96.0 | Rust preview のみ | native extension build |
| Git | 任意 | clone、検証 metadata | 一部検証結果へ commit ID を記録 |

Python と Node.js はそれぞれ `.python-version` と `.nvmrc` に監査済み version を記録しています。Rust crate は edition 2024 を使用します。

## 3. 直接依存

### Python runtime

| library | 固定版 | 使用箇所・役割 |
|---|---:|---|
| NumPy | 2.4.4 | dense 行列演算。純 Python fallback はあるが標準環境では必須扱い |
| FastAPI | 0.138.1 | HTTP API |
| Pydantic | 2.13.4 | API request model と入力検証 |
| Uvicorn | 0.49.0 | ASGI 開発 server |

定義元: `requirements-runtime.txt`

### Python validation（任意）

| library | 固定版 | 役割 |
|---|---:|---|
| QuTiP | 5.2.3 | 独立 solver との数値比較。本番 core は import しない |
| SciPy | 1.17.1 | QuTiP 比較 script の検証 metadata と数値基盤 |
| Matplotlib | 3.10.9 | 検証結果の plot |

定義元: `requirements-validation.txt`

### Frontend

| 区分 | 主な library | 固定方法 |
|---|---|---|
| runtime | React 19.2.7、React DOM 19.2.7 | `package-lock.json` |
| build | TypeScript 6.0.2、Vite 8.1.0、React plugin 6.0.2 | `package-lock.json` |
| lint | ESLint 10.5.0、typescript-eslint 8.61.0 | `package-lock.json` |

`package.json` の `^` / `~` は許容範囲を表します。外部再現時の実 version は `npm ci` が `package-lock.json` から決定します。

### Rust preview（任意）

| library | 固定版 | 役割 |
|---|---:|---|
| PyO3 | 0.29.0 | Rust/Python binding |
| maturin | 1.14.1（監査環境） | PEP 517 build backend。`pyproject.toml` は `>=1.14,<2.0` |

Cargo 依存は `rust_kernels/quantascope_rust/Cargo.lock` で固定されています。

## 4. 依存ファイルの使い分け

| file | 用途 |
|---|---|
| `requirements-runtime.txt` | 通常実行に必要な Python の直接依存 |
| `requirements-validation.txt` | QuTiP 比較を行う場合に追加導入 |
| `requirements-lock.txt` | 監査済み Python 開発環境の推移依存まで含む再現 |
| `requirements.txt` | 既存環境との互換用。新規構築には非推奨 |
| `frontend/package.json` | Frontend の直接依存と npm scripts |
| `frontend/package-lock.json` | Frontend の完全な依存解決結果 |
| `rust_kernels/quantascope_rust/pyproject.toml` | Python extension の build 設定 |
| `rust_kernels/quantascope_rust/Cargo.toml` | Rust crate の直接依存 |
| `rust_kernels/quantascope_rust/Cargo.lock` | Rust の完全な依存解決結果 |

## 5. 環境変数・port・外部 service

- 必須環境変数: なし
- 必須 secret/API key: なし
- database: なし
- 外部 API/SaaS: なし
- API port: `8001`
- Vite dev port: 通常 `5173`

Vite の port が使用中の場合は別 port へ移動しますが、診断 script は `5173` を確認します。

## 6. 再現後の検証

```powershell
# Python dependency consistency
.\.venv\Scripts\python.exe -m pip check

# Python tests
.\.venv\Scripts\python.exe -m unittest discover -s tests

# Frontend checks
cd frontend
npm run lint
npm run build
```

server 起動後:

```powershell
.\.venv\Scripts\python.exe scripts\dev_server_doctor.py
```

期待値は direct API と Vite proxy の health check がともに `ok` になることです。

## 7. 既知の再現性上の境界

- `requirements-lock.txt` は Windows/Python 3.14.4 で監査した固定版一覧です。OS 固有 wheel の hash までは固定していません。
- React の production 配信 server や container 定義は現時点ではありません。`npm run build` は `frontend/dist/` を生成します。
- API と Vite の開発起動は別 process です。一括起動 script はありません。
- Rust preview は任意で、標準 API/UI の再現条件には含めません。
