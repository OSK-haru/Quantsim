
> **Document status: requirements and historical design rationale**
>
> References to Streamlit, Godot, or a future FastAPI migration describe the
> earlier architecture. The active stack is React/Vite + FastAPI + Python/NumPy.
> Use `docs_for_develop/README.md` and `docs_for_develop/architecture/module_structure.md` for current
> runtime structure.

## N01 性能・応答性

### 概要

小規模量子回路に対して、利用者が環境条件や回路を変更した際に、試行錯誤を妨げない時間でシミュレーション結果を返す。

### 基本方針

- 入門モードでは、操作後すぐに結果が見えることを重視する
- エキスパートモードでは、多少時間がかかっても詳細な結果を許容する
- 6論理量子ビットは実験的上限であり、全機能で高速動作を保証しない

| 対象         |    目標応答時間 | 備考              |
| ---------- | --------: | --------------- |
| 1論理量子ビット   |      1秒以内 | 入門モード標準         |
| 2論理量子ビット   |    1〜2秒以内 | 本開発必達           |
| 3〜4論理量子ビット |    3〜5秒以内 | 標準目標            |
| 5〜6論理量子ビット |  10秒以内を目標 | エキスパート実験枠       |
| 条件A/B比較    | 単一実行の2倍以内 | 並列化は後回し         |
| UI再描画      | 体感で遅くないこと | Streamlitでは限界あり |
### 受け入れ条件

- 1量子ビットH回路は1秒以内に実行できる
- 2量子ビットBell回路は2秒以内を目標に実行できる
- 条件A/B比較は5秒以内を目標に実行できる
- 5〜6量子ビットでは、処理中表示または警告を出す
- 実行時間が長い場合、UIが完全に無反応にならないようにする



## N02 数値的正当性・安定性

### 概要

シミュレーション結果が物理的・数値的に破綻しないよう、密度行列、時間発展、指標計算に対して検証を行う。

### 基本方針

- 密度行列はtrace 1を保つ
- 密度行列はHermitianである
- purityは原則として0〜1の範囲に収まる
- state fidelityは0〜1の範囲に収まる
- 出力確率分布は非負かつ総和1に近い
- NaN/infを検出する
- 数値補正を行う場合は、その事実をwarningsに記録する

| 項目          | 条件                            | 扱い    |
| ----------- | ----------------------------- | ----- |
| trace       | (\mathrm{Tr}(\rho) \approx 1) | 必須    |
| Hermiticity | (\rho \approx \rho^\dagger)   | 必須    |
| positivity  | 固有値が大きく負でない                   | 警告    |
| purity      | 0〜1付近                         | 必須    |
| fidelity    | 0〜1付近                         | 必須    |
| probability | 非負・総和1                        | 必須    |
| NaN/inf     | 存在しない                         | Fatal |
| time grid   | duration > 0, steps >= 2      | 必須    |

### 許容誤差

- trace error tolerance: 1e-8
- Hermiticity error tolerance: 1e-8
- probability sum tolerance: 1e-8
- small negative eigenvalue tolerance: -1e-10
- fidelity/purity clipping tolerance: 1e-10

### 受け入れ条件

- テストでtraceが1付近に保たれることを確認する
- テストで密度行列がHermitianであることを確認する
- fidelity/purityがNaN/infにならないことを確認する
- 低ノイズ条件より高ノイズ条件でeffective operation timeが短くなるケースを確認する
- 数値異常時にはwarningsまたはerrorを返す



## N03 モデル透明性・説明可能性

### 概要

利用者が、現在のシミュレーションがどの物理モデル・近似・パラメータ変換に基づいているかを確認できるようにする。

### 基本方針

- デフォルトモデルは弱結合開放系と明示する
- Born-Markov近似、Lindblad型時間発展を明示する
- 温度・磁場・ノイズが正規化パラメータであることを明示する
- T1/T2/gammaへの写像が現象論的モデルであることを明示する
- 厳密な実機再現ではないことを明示する
- Expertモードではモデル仮定と限界を表示する

| 項目                         | 表示                     |
| -------------------------- | ---------------------- |
| open_system_model          | weak_coupling_lindblad |
| approximation              | Born-Markov            |
| noise model                | phenomenological T1/T2 |
| temperature/magnetic_field | normalized parameters  |
| strong coupling            | not supported          |
| non-Markovian effects      | not supported          |
| hardware calibration       | not supported          |



## N04 ユーザビリティ

### 概要

初学者が迷わず操作でき、上級者が詳細情報にアクセスできるUIを提供する。

### 基本方針

- 入門モードとExpertモードを分ける
- 入門モードでは操作対象を絞る
- Expertモードでは物理量インスペクタを提供する
- 正式な指標名を使い、補助説明を併記する
- 回路編集はドラッグ&ドロップを必須とする
- Undo/Redoを必須とする


| 項目        | 要件                            |
| --------- | ----------------------------- |
| 回路編集      | DnD必須                         |
| Undo/Redo | 必須                            |
| プリセット     | 必須                            |
| 初期説明      | 必須                            |
| 入門モード     | 専門用語を補助説明つき表示                 |
| Expertモード | 物理量検索・詳細パネル                   |
| エラー表示     | 原因と修正方法を表示                    |
| 比較        | Low noise / High noise をすぐ試せる |


### 受け入れ条件

- 初見ユーザーがLow noise / High noise比較を実行できる
- ゲートパレットからドラッグ&ドロップでゲートを配置できる
- 誤操作をUndoで戻せる
- Clear circuit後もUndoで復元できる
- State fidelity / Purity / Effective operation timeの正式名称と補助説明が表示される
- ExpertモードでT1/T2/gammaを検索または確認できる


## N05 保守性・拡張性

### 概要

シミュレーションコア、UI、可視化、保存/出力、検証を分離し、将来の拡張やAIエージェントによる開発に耐える構造にする。

### 基本方針

- coreはStreamlitやGodotに依存しない
- UIはcoreのpublic APIを呼ぶ
- 回路データ構造はJSON化可能にする
- 保存形式にはschema_versionを持たせる
- 物理モデル変更は明示的なタスクとして扱う
- 新機能追加時はテストを追加する

推奨構成
core/
  simulator.py
  circuit_model.py
  environment.py
  evolution.py
  metrics.py
  validation.py
  errors.py

visualization/
  plots.py
  tables.py

app/
  app.py
  pages/

data/
  presets/

docs/
  config_format.md
  result_log_format.md
  model_notes.md

tests/


### 受け入れ条件

- core配下にStreamlit依存がない
- run_simulation(config)がUI非依存で呼べる
- CircuitConfig / EnvironmentConfig / SimulationConfig がJSON化可能
- 主要機能にテストがある
- Codexタスクで物理モデルを勝手に変更しない運用ができる



## N06 セキュリティ・安全性

### 概要

ローカル開発・ローカル実行を前提としつつ、ファイル読込、結果出力、AIエージェント利用に伴うリスクを抑える。

### 基本方針

- 外部ネットワーク接続は初期状態では不要
- secretsをリポジトリに含めない
- 読み込むJSONはschema検証する
- 任意コード実行につながる形式は読み込まない
- export先はユーザー指定または安全なディレクトリに限定する
- AIエージェントに大規模ファイル削除や秘密情報操作をさせない


### 受け入れ条件

- pre-commitが動作する
- detect-secretsを導入または導入予定として管理する
- .envや秘密鍵をGit管理しない
- JSON読込で任意コード実行しない
- FastAPI導入時は初期状態でlocalhost限定にする


## N07 再現性・ログ管理

### 概要

シミュレーション条件、モデルバージョン、出力指標、時系列データを保存し、後から同じ条件で再実行または確認できるようにする。

### 基本方針

- 設定保存は .qscope.json
- 結果ログは .qscope.result.json
- 時系列データは CSV 出力
- Obsidian用Markdownレポート出力を検討する
- 結果にはschema_versionとmodel_versionを含める
- プリセットを用意する



## N08 配布性・提出容易性

### 概要

U-22提出や第三者レビューのため、環境構築・起動・デモ再現・説明資料作成が容易な状態にする。

### 基本方針

- まずはローカル起動を標準とする
- READMEにセットアップ手順を書く
- デモ用プリセットを用意する
- スクリーンショットと動画を用意する
- 単体exe化は後段検討
- Godot UIはPoC扱いとし、提出時に間に合えば利用する

### 受け入れ条件

- READMEから環境構築できる
- READMEからアプリ起動できる
- デモプリセットを選ぶだけで主要機能を確認できる
- 3分以内のデモ動画を構成できる
- U-22向け技術説明に使う出力ログ・図を生成できる

---

# N09 移植性・バックエンド拡張性

## 概要

Yuragi-Strider は、初期実装では Python / Streamlit を中心に開発するが、将来的に Godot UI、FastAPI 連携、Rust backend、QuTiP optional backend などへ拡張できる構造を維持する。

本要件は、現在の本開発必達範囲に Godot や Rust backend を含めるものではない。
ただし、将来拡張時に既存の core / UI / データ形式を大きく破壊しないよう、設計上の制約を定義する。

---

## 基本方針

- `core` は UI 技術に依存しない
- UI は `run_simulation(config)` を通じて core を呼び出す
- 回路・環境条件・実行設定は JSON 化可能な構造で扱う
- 実行結果は、将来的に他言語・他プロセスへ渡せる形式を意識する
- Python 実装、QuTiP backend、Rust backend は、同じ `SimulationConfig` を入力とし、同じ `SimulationResult` 互換の出力を返すことを目標とする
- Godot UI は数値計算を再実装せず、Python または Rust backend を呼び出すフロントエンド候補として扱う
- Rust backend は高速化・安定化・将来拡張のための候補であり、本開発初期の必達範囲には含めない

---

## 設計制約

### core と UI の分離

以下を禁止する。

- `core/` 配下から Streamlit を import する
- `core/` 配下から Godot 固有処理を参照する
- `core/` 配下から UI の状態管理に依存する
- UI から `evolution.py` や `environment.py` の内部関数を直接多用する

UI は原則として以下の流れで実行する。

```text
UI
  ↓
CircuitState / Environment入力
  ↓
SimulationConfig
  ↓
run_simulation(config)
  ↓
SimulationResult
  ↓
UI表示
```
