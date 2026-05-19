

起動画面
├─ Start Tutorial
│   └─ Step 1: H回路
│   └─ Step 2: ノイズ変更
│   └─ Step 3: Fidelity/Purity確認
│
├─ Run Demo
│   └─ Compare Mode または Beginner result view
│
├─ Beginner Mode
│   └─ 回路エディタ + 環境条件 + 結果
│
├─ Compare Mode
│   └─ 条件A/B比較画面
│
├─ Expert Mode
│   └─ 通常画面 + Expert Inspector
│
└─ Open Config
    └─ 保存済み設定を復元

以下は、そのまま `UI Requirements.md` などに貼り付けられる形です。
現時点で議論した **Start Screen / Beginner Mode / Expert Mode / Compare Workflow / 共通UI要件** をまとめています。

````md
# UI Requirements

## 目的

この文書は、QuantaScope の各画面におけるUI要件を定義する。

QuantaScope は、小規模量子回路に対して環境条件を与え、開放系としての状態劣化・計算信頼性・有効動作時間を可視化するアプリケーションである。

UI設計では、以下を重視する。

- 初学者が迷わず操作できること
- Expert利用者が物理量・内部モデル・数値診断へ到達できること
- 回路編集・環境条件入力・結果確認が一連の流れとして理解できること
- 情報量を増やしすぎず、必要な情報を段階的に開示すること
- 正式な物理指標名を用いつつ、必要に応じて短い補助説明を付与すること

---

# UI全体方針

## UI-00 基本構成

### 概要

QuantaScope のUIは、起動画面、Beginner表示、Expert表示、比較ワークフローを中心に構成する。

### 基本画面

- Start Screen
- Beginner Mode
- Expert Mode
- Compare Workflow
- Configuration / Save / Load
- Export / Result Log
- Error / Warning Display

### 表示レベル

QuantaScopeでは、表示の詳しさを以下の2段階に分ける。

| 表示レベル | 対象 | 内容 |
|---|---|---|
| Beginner | 初学者・デモ利用者 | 回路、環境条件、主要指標を中心に表示 |
| Expert | 上級者・開発者・審査員 | T1/T2、gamma、Lindblad演算子、密度行列、近似条件を追加表示 |

### ワークフロー

表示レベルとは別に、実行ワークフローを以下に分ける。

| ワークフロー | 内容 |
|---|---|
| Single Run | 1つの回路と1つの環境条件で実行 |
| Compare | 同一回路に対して条件A/Bを比較 |

### 設計方針

- Beginner / Expert は「表示レベル」として扱う
- Single Run / Compare は「作業タイプ」として扱う
- CompareはBeginner/Expertと同列の第3モードではなく、ワークフローとして扱う
- Beginner + Compare、Expert + Compare の両方を許容する

---

# UI-01 Start Screen

## 概要

Start Screen は、起動直後に表示される開始画面である。

利用者が QuantaScope の目的を理解し、デモ実行、チュートリアル開始、保存済み設定の読込、表示レベル選択を行えるようにする。

---

## 目的

- アプリの目的を短く伝える
- 初回ユーザーをデモまたはチュートリアルへ誘導する
- Beginner / Expert の表示レベルを選択できるようにする
- 保存済み設定ファイルを開けるようにする
- 最近使った設定やシステム状態を確認できるようにする

---

## 画面構成

Start Screen は以下の領域で構成する。

```text
┌────────────────────────────────────┐
│ Header / App Title                 │
├────────────────────────────────────┤
│ Hero / App Description             │
├──────────────────┬─────────────────┤
│ Display Level    │ Recent / Status │
├──────────────────┴─────────────────┤
│ Start Actions                      │
└────────────────────────────────────┘
````

---

## 必須UI要素

### Header

- アプリ名 `QuantaScope`

- 設定アイコン

- ヘルプアイコン


### Hero

- 大きなタイトル

- 短い説明文


表示例:

```text
QuantaScope
Explore how environment conditions degrade quantum circuits.
```

日本語表示例:

```text
QuantaScope
環境条件が量子回路の状態忠実度・純度・有効動作時間に与える影響を可視化します。
```

### Display Level

- Beginner

- Expert


表示レベルはラジオボタンまたはカード選択とする。

### Start Actions

以下の操作を提供する。

|操作|表示名|内容|
|---|---|---|
|Run Demo|デモを実行|既定デモを即時実行|
|Start Tutorial|チュートリアルを開始|初回操作ガイドを開始|
|Open Config|保存済み設定を開く|`.qscope.json` を読み込む|

### Recent / Status

以下を表示する。

- 最近開いた設定ファイル

- Simulator status

- Backend status

- Version


ただし、初期版では Recent Configurations を優先し、詳細なBackend情報は省略してもよい。

---

## Open Config の扱い

`Open Config` は、保存済み設定ファイルを読み込んで回路・環境条件・シミュレーション設定を復元する機能である。

UI表示名は以下を推奨する。

- 保存済み設定を開く

- 設定ファイルを開く


読み込み対象:

- `.qscope.json`


復元対象:

- 回路

- 論理量子ビット数

- 初期状態

- 環境条件

- シミュレーション設定

- 表示設定


---

## 初回起動時の推奨表示

初回起動時は、以下を強調表示する。

- デモを実行

- チュートリアルを開始


初回ユーザーには、`1-qubit H circuit / Low noise vs High noise comparison` を推奨デモとして示す。

---

## Start Screen 受け入れ条件

- 起動直後にStart Screenが表示される

- Beginner / Expert を選択できる

- デモを実行できる

- チュートリアルを開始できる

- 保存済み設定ファイルを開ける

- アプリの目的が短い説明で分かる

- 初期版のモデル制約に関する注記を確認できる


---

# UI-02 Beginner Mode

## 概要

Beginner Mode は、初学者が量子回路・環境条件・状態劣化の関係を理解するための画面である。

開放系、Lindblad、T1/T2などを知らない利用者でも、回路を作成し、環境条件を変え、State Fidelity / Purity / Effective Operation Time の変化を確認できることを目的とする。

---

## 目的

- 簡単な量子回路を作成できる

- 温度・磁場・ノイズ強度を直感的に操作できる

- 実行結果を主要指標で確認できる

- Low noise / High noise の違いを理解できる

- 操作ミスからUndo/Redoで復帰できる


---

## 画面構成

Beginner Mode は以下の領域で構成する。

```text
┌──────────────────────────────────────────────┐
│ Header / Toolbar                             │
├───────────────┬──────────────────────────────┤
│ Gate Palette  │ Circuit Editor               │
├───────────────┼──────────────────────────────┤
│ Environment   │ Result Summary               │
├───────────────┴──────────────────────────────┤
│ Drawers: Graphs / Output / Explanation       │
└──────────────────────────────────────────────┘
```

または、横幅が十分ある場合は以下の構成とする。

```text
左: Gate Palette / Environment
中央: Circuit Editor
下: Result Summary + Drawers
```

---

## Header / Toolbar

### 必須要素

- 現在の表示レベル: Beginner

- Run

- Stop

- Save

- Open Config

- Settings

- Help


### 任意要素

- Compare toggle

- Tutorial progress

- Export


---

## Gate Palette

### 概要

利用者が回路に配置するゲートを選択する領域。

### MVP対象ゲート

- I

- H

- X

- Z

- Measure


### 本開発必達ゲート

- I

- H

- X

- Z

- CNOT

- Measure


### 表示方針

- ゲート名と簡単な説明を表示する

- 初期表示では基本ゲートのみ表示する

- 発展的ゲートは `More Gates...` に格納する

- CNOTは2量子ビット対応後に表示する


---

## Circuit Editor

### 概要

論理量子ビット行と時間列からなる回路グリッドを表示し、ゲートを配置する領域。

### 必須機能

- ゲートパレットからのドラッグ&ドロップ配置

- ゲート削除

- ゲート移動

- ゲート上書き

- Undo

- Redo

- Clear Circuit

- Measure配置

- 量子ビット数表示

- ゲート数表示

- 回路深さ表示


### Undo/Redo対象操作

- ゲート配置

- ゲート削除

- ゲート移動

- ゲート上書き

- Clear Circuit

- 初期状態変更

- 量子ビット数変更


### 表示方針

- 回路は `q0, q1, ...` の行として表示する

- 時間方向は `t0, t1, ...` の列として表示する

- 空セルは薄いガイド線で示す

- CNOTはcontrolとtargetを視覚的に接続する

- Measureは測定アイコンまたは `M` で表示する


---

## Environment Panel

### 概要

環境条件を入力するパネル。

Beginner Modeでは、物理単位ではなく正規化パラメータを中心に表示する。

### 必須入力

- Temperature parameter

- Magnetic field parameter

- Noise level


### 本開発で追加する入力候補

- Observation strength

- Observation frequency


### プリセット

必須プリセット:

- Low noise

- High noise


追加候補:

- Strong dephasing

- Almost ideal


### 表示方針

- 各値は 0.0〜1.0 のスライダーで入力する

- 実単位ではなく正規化パラメータであることを注記する

- `Temperature parameter` や `Magnetic field parameter` は実温度・実磁場ではないことを説明する

- 詳細パラメータはBeginnerでは表示しない


### 非表示または折りたたみ対象

- T1/T2

- gamma1/gammaphi

- Lindblad演算子

- Hamiltonian

- H_eff

- trace / Hermiticity


---

## Result Summary

### 概要

実行結果の最重要指標を常時表示する領域。

### 必須表示

- State Fidelity

- Purity

- Effective Operation Time

- Output Probability Distance


### 本開発で追加する表示

- Dominant Decoherence Source


### 表示例

```text
State Fidelity: 0.842
Purity: 0.797
Effective Operation Time: 15.0 μs
Output Probability Distance: 0.18
```

### 表示方針

- Summaryは常時表示し、折りたたまない

- 指標名は正式名称を用いる

- 必要に応じて日本語補助名を併記する


表示例:

```text
State Fidelity（状態忠実度）
Purity（純度）
Effective Operation Time（有効動作時間）
```

---

## Result Drawers

Beginner Modeでは、詳細結果は引き出し形式で表示する。

### 引き出し一覧

|Drawer|初期状態|内容|
|---|---|---|
|Graphs|開く|Fidelity / Purity グラフ|
|Output Probabilities|閉じる|Ideal vs Noisy 出力確率分布|
|Explanation|閉じる|指標の意味|
|Condition Details|閉じる|使用した環境条件|

---

## Graph Drawer

### 必須表示

- State Fidelity over Time

- Purity over Time


### Fidelityグラフの必須要素

- State Fidelity 曲線

- Fidelity threshold line

- Effective Operation Time marker


### 表示方針

- 初期表示は State Fidelity とする

- Purity はタブ切替または同一Drawer内で表示する

- 同時に大きなグラフを多数表示しない

- Compare時はA/Bを同一軸で比較する


---

## Output Probabilities Drawer

### 概要

理想回路とノイズ付き回路の測定結果確率分布を比較表示する。

### 必須表示

- Ideal output probabilities

- Noisy output probabilities

- Output Probability Total Variation Distance


### 表示例

```text
|0>  Ideal: 0.50   Noisy: 0.64
|1>  Ideal: 0.50   Noisy: 0.36
```

### Compare時

```text
|0>  Ideal: 0.50   Condition A: 0.52   Condition B: 0.64
|1>  Ideal: 0.50   Condition A: 0.48   Condition B: 0.36
```

---

## Explanation Drawer

### 概要

主要指標の短い説明を表示する。

### 説明対象

- State Fidelity

- Purity

- Effective Operation Time

- Output Probability Distance

- Noise level

- Temperature parameter

- Magnetic field parameter


### 表示方針

- 長文にしない

- 1項目あたり1〜2文に抑える

- 詳細理論はExpertまたはHelpに退避する


---

## Beginner Modeで表示しないもの

以下はBeginner Modeでは非表示、またはExpertに移動する。

- Lindblad演算子

- Hamiltonian行列

- H_eff

- collapse operator行列

- trace / Hermiticity

- density matrix詳細

- gamma1/gammaphi詳細

- Born-Markov近似の詳細

- 強結合開放系

- Circuit QED profile

- QuTiP backend選択


---

## Beginner Mode 受け入れ条件

- デモを実行できる

- チュートリアルを開始できる

- 基本ゲートを配置できる

- Drag & Dropで回路を編集できる

- Undo/Redo/Clearが動作する

- 温度・磁場・ノイズ強度をスライダーで変更できる

- Low noise / High noiseプリセットを適用できる

- Run Simulationで結果を表示できる

- State Fidelity / Purity / Effective Operation Time を確認できる

- グラフを引き出し形式で表示できる

- Output Probabilitiesを引き出し形式で表示できる

- エラー時に修正方法が分かる


---

# UI-03 Expert Mode

## 概要

Expert Mode は、上級者・開発者・審査員向けに、物理量、内部モデル、数値診断、近似条件を確認できる表示レベルである。

Beginner Modeに比べて情報量は多いが、すべてを常時表示せず、インスペクタ、タブ、折りたたみ、引き出しによって段階的に表示する。

---

## 目的

- 現在の回路・環境条件から導出された物理量を確認できる

- T1/T2、gamma1/gammaphiを表示できる

- Lindblad演算子を確認できる

- 密度行列や数値診断を確認できる

- モデル仮定と限界を明示できる

- no-jumpやH_effなどの発展的機能への入口を持てる


---

## 画面構成

Expert Mode は以下の領域で構成する。

```text
┌────────────────────────────────────────────────────┐
│ Header / Toolbar                                   │
├────────────┬────────────────────────┬──────────────┤
│ Left Panel │ Main Workspace          │ Inspector    │
│ Controls   │ Circuit + Results       │ Expert Info  │
└────────────┴────────────────────────┴──────────────┘
```

### 領域

|領域|内容|
|---|---|
|Left Panel|環境条件、シミュレーション設定、プリセット|
|Main Workspace|回路エディタ、結果サマリー、グラフ、出力|
|Right Panel|Expert Inspector|

---

## Expert Modeの情報階層

### 最優先表示

- Circuit Editor

- Run / Stop

- Result Summary

- State Fidelity graph


### 補助表示

- Environment parameters

- Simulation settings

- Output probabilities

- Density matrix summary


### 詳細表示

- T1/T2

- gamma1/gammaphi

- Lindblad operators

- H_eff

- trace / Hermiticity

- assumptions / limitations


---

## Left Panel

### Environment

Expert Modeでは、Beginnerより多くの環境設定を表示する。

#### 常時表示

- Temperature parameter

- Magnetic field parameter

- Noise level

- Observation strength

- Presets


#### 折りたたみ候補

- Observation frequency

- Physical parameter mode

- Advanced environment settings


### Simulation Settings

#### 常時表示

- Model

- Time span

- Time steps

- Fidelity threshold


#### 折りたたみ候補

- shots

- seed

- solver backend

- numerical tolerance

- advanced options


---

## Main Workspace

### Circuit Editor

Beginner Modeと同様に、回路編集を行う。

Expert Modeでは以下を追加表示してよい。

- 論理量子ビット数

- Hilbert space dimension

- Time steps

- Model name

- Circuit depth


### Result Summary

Expert Modeでは、Summary Cardsに以下を表示する。

- State Fidelity

- Purity

- Effective Operation Time

- Output Probability Distance

- Dominant Decoherence Source


### Graphs

Expert Modeでは、グラフの種類を増やす。

#### 表示候補

- State Fidelity

- Purity

- Trace Distance

- Expectation Values

- Population

- Time Trace


### 表示方針

- 初期表示は State Fidelity

- 他のグラフはタブで切り替える

- 同時に大きなグラフを3枚以上表示しない

- グラフ表示は引き出しまたはカード形式とする


### Output Probabilities

- Final Distribution

- Over Time

- Distance


### Density Matrix

Expert Modeでは密度行列表示を可能にする。

#### 表示候補

- Re(ρ)

- Im(ρ)

- |ρ|

- final density matrix

- selected time density matrix


### 表示制限

- 1〜2量子ビットでは標準表示可能

- 3〜4量子ビットでは折りたたみ表示

- 5〜6量子ビットでは全体表示を非推奨とし、部分系表示を優先する


---

# UI-04 Expert Inspector

## 概要

Expert Inspector は、Expert Mode の右パネルとして表示される詳細情報領域である。

現在の回路、環境条件、シミュレーション結果に紐づく物理量・内部モデル・数値診断・近似条件を表示する。

---

## タブ構成

Expert Inspector は以下のタブで構成する。

- Overview

- Noise

- Operators

- State

- Assumptions


---

## 初期表示

- 初期状態では Overview タブを表示する

- Overview以外の大型セクションは折りたたむ

- Lindblad Operators、Density Matrix、H_eff は初期状態で折りたたむ


---

## Overview タブ

### 表示項目

- Model

- Logical qubits

- Hilbert space dimension

- Simulation time

- Time steps

- Effective Operation Time

- Final State Fidelity

- Final Purity


---

## Noise タブ

### 表示項目

- Temperature parameter

- Magnetic field parameter

- Noise level

- T1

- T2

- gamma1

- gammaphi

- gamma ratio

- Dominant Decoherence Source


---

## Operators タブ

### 表示項目

- Hamiltonian

- Lindblad operators

- collapse operators

- relaxation operator

- pure dephasing operator


### 表示方針

- 行列は折りたたみ表示とする

- 大きな行列はスクロール可能にする

- 数式は簡潔に表示し、詳細説明はツールチップまたはヘルプに退避する


---

## State タブ

### 表示項目

- Density matrix

- Trace

- Hermiticity error

- Minimum eigenvalue

- Maximum eigenvalue

- Purity

- Output probabilities


---

## Assumptions タブ

### 表示項目

- weak-coupling model

- Born-Markov approximation

- Lindblad-type master equation

- phenomenological T1/T2 noise

- normalized environment parameters

- no non-Markovian memory effects

- no strict hardware calibration


---

## H_eff 表示

H_eff はPlus/Expert拡張として扱う。

### 表示項目

- Effective Non-Hermitian Hamiltonian

- Re(H_eff)

- Im(H_eff)

- complex eigenvalues

- norm decay


### 表示方針

- 初期状態では折りたたむ

- 未実装の場合は `not implemented` または `not enabled` と表示する

- Lindblad平均発展とno-jump発展を混同しない注記を表示する


---

## Expert Inspector 受け入れ条件

- Expert Modeで右側にInspectorを表示できる

- Overview / Noise / Operators / State / Assumptionsを切り替えられる

- T1/T2を確認できる

- gamma1/gammaphiを確認できる

- Dominant Decoherence Sourceを確認できる

- Lindblad Operatorsを折りたたみ表示できる

- Density Matrixを表示できる

- trace / Hermiticity / eigenvalue を確認できる

- モデル仮定と限界を表示できる

- 詳細情報を展開しない限り画面が過密にならない


---

# UI-05 Compare Workflow

## 概要

Compare Workflow は、同一回路に対して2つの環境条件または設定を与え、結果の差分を比較するワークフローである。

CompareはBeginner/Expertと同列の表示レベルではなく、作業タイプとして扱う。

---

## 対象

### Beginner + Compare

- Low noise vs High noise

- State Fidelity A/B

- Purity A/B

- Effective Operation Time A/B

- Output Probability A/B


### Expert + Compare

Beginner + Compare に加えて以下を表示する。

- T1/T2 A/B

- gamma1/gammaphi A/B

- Dominant Decoherence Source A/B

- density matrix difference

- model parameter difference


---

## 画面構成

```text
┌────────────────────────────────────────────┐
│ Compare Header                             │
├────────────────────┬───────────────────────┤
│ Condition A        │ Condition B           │
├────────────────────┴───────────────────────┤
│ Comparison Summary                         │
├────────────────────────────────────────────┤
│ Drawers: Graphs / Output / Details         │
└────────────────────────────────────────────┘
```

---

## Condition A/B

### 必須項目

- preset name

- temperature parameter

- magnetic field parameter

- noise level


### Expert表示時の追加項目

- T1

- T2

- gamma1

- gammaphi

- model

- threshold


---

## Comparison Summary

### 必須表示

- ΔFinal State Fidelity

- ΔFinal Purity

- ΔEffective Operation Time

- Better Condition

- ΔOutput Probability Distance


---

## Comparison Drawers

|Drawer|内容|
|---|---|
|Comparison Graphs|Fidelity A/B, Purity A/B|
|Output Probabilities|Ideal vs A vs B|
|Condition Details|A/Bの条件詳細|
|Expert Details|T1/T2/gamma差分|

---

## Compare Workflow 受け入れ条件

- 同一回路で条件A/Bを設定できる

- Low noise / High noise比較を実行できる

- State Fidelity A/Bを比較表示できる

- Purity A/Bを比較表示できる

- Effective Operation Time A/Bを比較表示できる

- Δ値をSummaryで確認できる

- Output ProbabilitiesをA/B比較できる

- Expert表示時にT1/T2/gamma差分を確認できる


---

# UI-06 Graph / Output Drawer 要件

## 概要

グラフ表示と出力表示は、画面をすっきり保つために引き出し形式で表示する。

---

## 基本方針

- Summaryは常時表示する

- 詳細グラフはDrawer内に表示する

- Output ProbabilitiesはGraphsとは別Drawerにする

- Explanationは折りたたみ表示にする

- 初期表示ではGraphsのみ開く

- Output ProbabilitiesとExplanationは初期状態で閉じる


---

## Single Run 初期状態

|領域|初期状態|
|---|---|
|Result Summary|表示|
|Graphs|開く|
|Output Probabilities|閉じる|
|Explanation|閉じる|
|Condition Details|閉じる|

---

## Compare 初期状態

|領域|初期状態|
|---|---|
|Comparison Summary|表示|
|Comparison Graphs|開く|
|Output Probabilities|閉じる|
|Condition Details|閉じる|
|Expert Details|閉じる|

---

# UI-07 Error / Warning Display

## 概要

不正入力、実行失敗、数値異常、保存失敗を利用者に表示する。

---

## エラーレベル

|レベル|用途|
|---|---|
|Info|補足情報|
|Warning|実行可能だが注意|
|Error|実行不可|
|Fatal|計算破綻・保存失敗|

---

## Beginner表示

Beginnerでは、原因と修正方法を短く表示する。

例:

```text
Noise level は 0.0〜1.0 の範囲で指定してください。
```

```text
CNOTには異なる2つの量子ビットが必要です。
```

---

## Expert表示

Expertでは、内部フィールド名や詳細情報を表示してよい。

例:

```text
Invalid noise_level: 1.42
Expected range: 0.0 <= noise_level <= 1.0
Source: EnvironmentConfig.noise_level
```

---

## 表示位置

- 入力近くのinline warning

- 画面下部のStatus Bar

- 実行時のError Panel

- ExpertではEvent Logに記録


---

## 受け入れ条件

- 範囲外入力を表示できる

- 不正ゲート配置を表示できる

- 実行失敗を表示できる

- NaN/inf検出時に表示できる

- 保存/読込失敗を表示できる

- Beginner/Expertで表示粒度を変えられる


---

# UI-08 Save / Load / Export

## 概要

設定保存、設定読込、結果出力の操作を提供する。

---

## 用語

|UI表示|意味|
|---|---|
|保存済み設定を開く|`.qscope.json` を読み込む|
|設定を保存|現在の回路・環境・実行設定を保存|
|結果を出力|実行結果をJSON/CSV/Markdown等で出力|
|プリセット読込|アプリ内蔵のサンプルを読み込む|

---

## 配置

### Start Screen

- 保存済み設定を開く


### Header / Toolbar

- Open

- Save

- Export


### Left Panel

- Presets

- Manage Presets


---

## 受け入れ条件

- `.qscope.json` を開ける

- 現在の設定を保存できる

- プリセットを読み込める

- 結果を出力できる

- 不正なファイル読込時にエラーを表示できる


---

# UI-09 Expert Modeをすっきりさせるための追加要件

## 概要

Expert Mode は情報量が多いため、画面を過密にしないための制約を設ける。

---

## 要件

- すべての詳細情報を常時表示しない

- Expert Inspectorはタブ構成とする

- 初期表示はOverviewのみとする

- Operators / Density Matrix / H_eff は初期折りたたみとする

- Advanced options は初期折りたたみとする

- 同時に表示する大型グラフは最大2枚程度とする

- 行列表示はスクロール可能領域に収める

- 下部の説明ボックスは初期折りたたみまたはHelpに退避する

- 色は意味のある用途に限定する

- 余白・整列・カードサイズを統一する

- 専門用語は正式名称を使い、説明はツールチップやHelpに退避する


---

## 設計原則

```text
Expertモードは「情報をすべて見せる画面」ではなく、
「必要な情報へ素早く到達できる画面」とする。
```

```text
高度な物理情報は表示可能であることが重要であり、
常時全面表示であることは要件ではない。
```

---

# UI-10 画面別対応機能

|画面|対応する主な機能要件|
|---|---|
|Start Screen|F01, F02, F11|
|Beginner Mode|F03, F04, F05, F06, F13, F14|
|Expert Mode|F03, F04, F05, F06, F10, F13, F14|
|Compare Workflow|F09, F06, F14|
|Save / Load|F11|
|Export|F12|
|Error Display|F13|

---

# UI-11 非対象

初期UIでは以下を非対象とする。

- 高品質3D Bloch球常時表示

- 強結合開放系の本格操作画面

- Circuit QED厳密パラメータ入力画面

- 大規模量子回路エディタ

- クラウド共有UI

- マルチユーザー編集

- 複雑なプロジェクト管理画面

- QuTiPの全機能を露出するUI


---

# UI-12 最終方針

QuantaScope のUIは、以下の方針で設計する。

1. Start Screenで目的と開始操作を明確にする

2. Beginner Modeでは回路・環境・主要結果を一画面で扱う

3. 結果詳細はDrawerで段階的に表示する

4. Compareは表示レベルではなくワークフローとして扱う

5. Expert Modeでは右Inspectorで物理量・内部モデル・数値診断を表示する

6. Expert Modeでも初期表示は過密にしない

7. 保存・読込・出力はHeaderまたはStart Screenからアクセスできるようにする

8. エラー表示は原因と修正方法を示す



## イメージ図



スタート画面とビギナーモード

![[Pasted image 20260516200009.png]]


エキスパートモード


![[Pasted image 20260516195953.png]]
