---
title: クイックスタート
sidebar_position: 2
---

# クイックスタート

Yuragi-Striderを始める方法は2つあります。インストールせずに公開アプリを試す方法と、GitHubからリポジトリをクローンしてローカルで起動する方法です。

## ブラウザですぐに試す

このドキュメントサイトの右上にある**「アプリを試してみる」**をクリックすると、公開中のYuragi-Striderアプリへ移動できます。環境構築やインストールは必要ありません。

ボタンが見つからない場合は、[Yuragi-Striderアプリを開く](https://yuragi-strider-app.23sam55781.workers.dev)から直接アクセスできます。

アプリが開いたら、まず「通常モードを開始」を選ぶとGate-awareシミュレーションを試せます。操作を確認しながら進めたい場合は、ホーム画面のガイドツアーを利用してください。

## GitHubからクローンして使う

手元でコードを確認・変更したい場合や、ローカル環境で実行したい場合は、計算APIとWeb UIの2つのプロセスを起動します。以下では、リポジトリを取得してからブラウザで画面が開くまでの手順を示します。

:::info[配布形式について]
ローカル版のインストーラー形式での配布は行っていません。GitHubからソースコードを取得して起動します。
:::

## 必要なツール

| ツール | バージョン | 用途 |
|---|---|---|
| Git | — | リポジトリの取得 |
| Python | `3.14.4` | 計算コアとAPI(監査済みの版。`.python-version` に記録) |
| Node.js / npm | `24.15.0` / `11.x` | Web UI(`.nvmrc` と `package-lock.json` に記録) |
| Rust | `1.96.0` | 任意。[Rustによる高速化](../performance/rust-acceleration.md)を使う場合のみ |

Rustは必須ではありません。導入しなくても標準のPython backend (`python_dense`) で全機能が動作します。

## セットアップ

以下はWindows PowerShellでの例です。macOS / Linuxでは仮想環境のPythonを `.venv/bin/python` に読み替えてください。

```powershell
git clone <repository-url>
cd Quantum-sim
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-runtime.txt
cd frontend
npm ci
cd ..
```

監査時とまったく同じPythonパッケージ群を再現する場合は、`requirements-runtime.txt` の代わりに `requirements-lock.txt` を使います。

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
```

## 起動

ターミナルを2つ開き、リポジトリ直下からAPIとUIをそれぞれ起動します。**両方が動いている必要があります。**

```powershell
# ターミナル 1: 計算API (http://127.0.0.1:8001)
.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8001
```

```powershell
# ターミナル 2: Web UI (http://127.0.0.1:5173)
cd frontend
npm run dev
```

ブラウザで `http://127.0.0.1:5173` を開くとホーム画面が表示されます。Viteが `/api` へのリクエストを `127.0.0.1:8001` にプロキシします。

接続がうまくいかない場合は、診断スクリプトで確認できます。

```powershell
.\.venv\Scripts\python.exe scripts\dev_server_doctor.py
```

## 動作確認

```powershell
.\.venv\Scripts\python.exe scripts/run_tests.py fast
```

`fast` のほかに `gate-aware`、`pulse`、`full-audit` のプロファイルがあります。`full-audit` はPulseと凍結監査を含むため時間がかかります。

## 任意: Rust preview backend

Rust toolchainがある環境では、高速化カーネルをPython仮想環境にビルドできます。

```powershell
.\.venv\Scripts\python.exe -m pip install -e .\rust_kernels\yuragi_strider_rust
.\.venv\Scripts\python.exe -c "import yuragi_strider_rust; print(yuragi_strider_rust.backend_name())"
```

適用範囲と実測値は[Rustによる高速化](../performance/rust-acceleration.md)を参照してください。

## 次に読む

起動できたら、[画面別チュートリアル](../tutorials/index.md)から操作を確認してください。まずはGate-awareモードの[シミュレーションワークスペース](../tutorials/gate-aware/simulate.md)が入口になります。
