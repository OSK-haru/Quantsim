
---


# MVPは完了済

> **Document status: requirements baseline**
>
> This file contains original MVP and expansion requirements, not a live
> implementation checklist. Current implementation status is maintained in
> `docs/README.md`.

## MVP スコープ定義 (MVP Scope Definition)

QuantaScope の開発において、MVPリリース時の必達範囲を以下のように定義する。これ以外の多量子ビット対応や複雑なゲートセットは、Phase 1 以降の拡張対象とする。

| 区分 | MVP対象 |
|---|---|
| 論理量子ビット数 | 1論理量子ビット |
| ゲートセット | I, H, X, Z |
| シミュレーションモデル | 密度行列を用いたLindblad型マスター方程式 |
| 環境条件 | 正規化パラメータからT1/T2/gammaへ変換 |
| 主要指標 | State Fidelity, Purity, Effective Operation Time |
| 比較機能 | Low noise / High noise のプリセット比較 |

---

## F01 モード選択機能

### 概要

利用者が入門モードまたはエキスパートモードを選択できる。

### 要件

- 起動時またはメニューから切替可能
- 入門モードでは用語と操作を簡略化する
- エキスパートモードでは詳細パラメータを表示する
- 内部では同一シミュレーションモデルを使用する
-

### 優先度

高

### MVP対象

一部対象

---

## F02 チュートリアル表示機能(入門モード)

### 概要

初心者が段階的にシステムの意味と操作を理解できるようにする。

### 要件

最低6段階のチュートリアルを構成する。

1. **ようこそ**: QuantaScope の目的（環境による計算劣化の観察）を説明。
2. **UIツアー**: 回路エリア、環境設定スライダー、グラフエリアの配置を解説。
3. **はじめてのゲート**: Hadamard (H) ゲートを配置し、理想的な重ね合わせ状態を確認。
4. **環境の導入**: 「ノイズ強度」スライダーを上げ、グラフ（Fidelity/Purity）が下がる様子を観察。
5. **有効時間の発見**: 有効動作時間 (Effective Time) マーカーが左に移動する（計算可能時間が短くなる）現象を体験。
6. **比較の実行**: 条件A/B比較機能を使い、ノイズが少ない場合と多い場合の差を視認。

### 詳細

- 各段階で操作対象を限定する（ハイライトまたはマスキング）。
- テキストガイド（吹き出し形式）を表示する。
- いつでもスキップ・再開を可能にする。
- ドラッグ&ドロップ操作のガイドアニメーションを付与する。

### 優先度

高

### MVP対象

対象（1量子ビット範囲内）

---

## F03 回路入力機能

### 概要

利用者が、小規模な量子回路を UI 上で作成・選択・編集できる機能。

本機能では、量子回路を「論理量子ビットの行」と「時間方向のゲート列」で構成されるグリッドとして扱う。利用者は、ゲートパレットから基本ゲートを選択し、回路グリッド上に配置することで、シミュレーション対象となる量子回路を作成する。

### 基本要件

- 利用者は量子ビット数を指定できる（MVPは1固定）。
- 量子ビット数は論理量子ビット数として扱う。
- 利用者はゲート列を時間方向に順番に配置できる（最大 10〜20ステップ程度）。
- 利用者はゲートパレットから基本ゲートを選択し、ドラッグ&ドロップまたはクリックで配置できる。
- 配置済みゲートの削除、変更、Undo/Redo が可能。
- 各論理量子ビットの初期状態（|0>, |1>, |+>, |-> 等）を選択できる。

### 対応量子ビット数（スコープ）

| フェーズ | 論理量子ビット数 | 備考 |
| :--- | :--- | :--- |
| **MVP** | **1** | 1量子ビットの緩和・脱コヒーレンス観察に集中 |
| 必達目標 | 2 | CNOT/Bell回路等の2体相互作用を含む |
| 標準目標 | 3〜4 | 小規模アルゴリズムの挙動確認 |
| 上限目標 | 6 | 密度行列シミュレーションの計算限界付近 |

### ゲートパレット

MVP対象:
- I
- H
- X
- Z

Phase 1以降:
- CNOT
- Measure
- S/T
- RX/RY/RZ

### 回路データ構造

内部表現として以下の JSON 形式を採用し、保存・AI連携を容易にする。

```json
{
  "version": "1.0",
  "logical_qubits": 1,
  "initial_states": ["0"],
  "columns": [
    {"step": 0, "gates": [{"type": "H", "target": 0}]},
    {"step": 1, "gates": [{"type": "X", "target": 0}]}
  ]
}
```

### 優先度

高

### MVP対象

対象（1量子ビットゲートのみ）

---

## F04 環境\条件入力機能

### 概要

利用者が、量子回路に作用する外部環境条件を設定できる機能。

本機能では、直感的な「ノイズ強度」などの正規化パラメータを入力し、それらをシミュレーション内部で用いる物理的な開放系パラメータ（T1/T2, gamma）へ変換する。

### 基本要件

- 入門モードでは、0.0〜1.0 のスライダーで環境条件を操作する。
- エキスパートモードでは、物理量（T1, T2 等）を直接数値入力できる。
- 入力値から Lindblad 係数への変換式を明記する。

### 入力パラメータと物理量への変換

利用者が入力する `noise_level` 等の正規化パラメータは、以下の式を用いて物理パラメータへ変換される。

```text
L = clamp(noise_level, 0.0, 1.0)

gamma_min = 1e-6
gamma_scale = 0.1

temperature_factor = 0.5 + temperature
magnetic_field_factor = 0.5 + magnetic_field

gamma1 = gamma_min + gamma_scale * L * temperature_factor
gammaphi = gamma_min + gamma_scale * L * magnetic_field_factor

T1 = 1 / gamma1
T2 = 1 / (1 / (2 * T1) + gammaphi)
```

| 入力名 | 意味 | 備考 |
| :--- | :--- | :--- |
| **temperature** | 環境温度 | gamma1 (緩和率) に影響 |
| **magnetic_field** | 磁場変動 | gammaphi (脱位相率) に影響 |
| **noise_level** | 総合ノイズ強度 | 全体的な gamma のスケールを決定 |
この変換式はMVPおよび本開発初期の現象論的モデルであり、
特定の実機・材料・温度単位・磁場単位との厳密対応を意味しない。
### 優先度

高

### MVP対象

対象（正規化パラメータからの変換実装）

---
## F05 シミュレーション実行機能

### 概要

量子回路、初期状態、および環境条件に基づいて、量子状態（密度行列）の時間発展を計算する機能。

### 基本要件

- **シミュレーションモデル**: Born-Markov 近似に基づく Lindblad 型マスター方程式を採用。
- **状態表現**: 密度行列 $\rho$ を用い、混合状態を扱う。
- **時系列計算**: ゲート操作中およびゲート間のアイドル時間を含めた連続的な時間発展を計算。
- **比較用理想データ**: ノイズのない理想的なユニタリ発展結果も同時に計算し、Fidelity 計算の参照とする。

### 主要指標の定義

シミュレーション実行中に以下の指標を逐次算出する。

#### State Fidelity (状態忠実度)
理想状態 $\sigma$ とノイズあり状態 $\rho$ の類似度を表す指標。1.0 に近いほど理想に近い。
```text
F(rho, sigma) = Tr(sqrt(sqrt(sigma) * rho * sqrt(sigma)))
```

MVPでは、理想状態が純粋状態である場合を主対象とし、
State Fidelity を F = <ψ_ideal|ρ_noisy|ψ_ideal> として計算する。

混合状態同士の一般的なUhlmann fidelityは、本開発後半またはExpert機能で扱う。
#### Purity (純粋度)
量子状態がどれだけ純粋状態に近いかを表す指標。1.0 で純粋状態、低下すると混合状態。
```text
P = Tr(rho^2)
```

#### Effective Time (有効動作時間)
Fidelity があらかじめ設定した閾値を下回るまでの時間。
```text
t s.t. F(t) < F_threshold
```

### シミュレーションの流れ

1. 回路JSONと環境パラメータをロード。
2. 正規化パラメータから $\gamma_1, \gamma_\phi$ を算出。
3. 初期状態 $\rho_0$ を設定。
4. 各タイムステップにおいて、Lindblad 項を含む時間発展を ODE ソルバ等で実行。
5. 指標（Fidelity, Purity等）を保存し、可視化モジュールへ渡す。

### 優先度

最高

### MVP対象

対象（1量子ビット・Lindblad モデル）

---


## F06 状態可視化・分析機能

### 概要

シミュレーション結果（Fidelity, Purity, 有効動作時間等）をグラフおよび数値で可視化し、量子状態の劣化を分析する機能。

### 可視化スコープ定義

| スコープ | 項目 | 内容 |
| :--- | :--- | :--- |
| **MVP** | **時系列グラフ** | Fidelity および Purity の時間変化を表示 |
| | **有効時間表示** | Fidelity 閾値を横切るポイントにマーカーと数値を表示 |
| | **最終指標サマリ** | 計算終了時点の Fidelity, Purity, 劣化要因を表示 |
| **必達目標** | **条件比較表示** | 条件A/Bのグラフを重ね書きして比較 |
| | **確率分布比較** | 理想状態とノイズあり状態の測定確率分布（棒グラフ） |
| **標準目標** | **Bloch球表示** | 1量子ビット状態の Bloch 球上での軌跡をアニメーション表示 |
| | **密度行列表示** | $\rho$ の実部・虚部をヒートマップで表示 |
| **上限目標** | **多量子ビット対応** | 2量子ビット以上の密度行列・相関可視化 |
| **非対象** | **実機キャリブレーション** | 実機データとの直接的な重ね合わせ表示 |

### 主要可視化要素 (MVP)

1. **State Fidelity グラフ**: 縦軸 Fidelity (0.0-1.0)、横軸 時間の折れ線グラフ。
2. **Purity グラフ**: MVPでは1量子ビットを対象とするため、Purityの表示範囲は0.5〜1.0を基本とする。
　　2量子ビット以上では、最小値1/2^nを考慮して表示範囲を自動調整する。
3. **Effective Time マーカー**: Fidelity グラフ上に $F_{threshold}$ 線を引き、交点を強調表示。
4. **劣化要因ラベル**: $\gamma_1$ と $\gamma_\phi$ の比率から、「Relaxation 支配」「Dephasing 支配」などの判定を表示。

### 優先度

高

### MVP対象

対象（時系列グラフおよび有効時間表示）

---

## F07 デコヒーレンス影響表示機能 (F06に統合)

## F08 有効動作時間推定機能 (F06に統合)

---
## F09 条件比較・差分分析機能

### 概要

同一の量子回路に対して、2つの異なる環境条件（Condition A / Condition B）を適用し、結果の差分を比較する機能。

### 基本要件

- **比較対象**: 原則として同一の回路構成・初期状態。環境パラメータ（Temperature, Magnetic Field, Noise Level）のみを可変とする。
- **視覚的比較**: Fidelity/Purity グラフを重ねて表示し、劣化の速さの違いを直感的に示す。
- **差分指標**: 以下の差分値を算出・表示する。

```text
delta_Fidelity = F_A(t_final) - F_B(t_final)
delta_Effective_Time = t_eff_A - t_eff_B
```
- **制約**: 量子ビット数が異なる回路同士の比較は、原則として不可とする。

### 優先度

中（MVP必達）

### MVP対象

対象（同一回路における環境パラメータ差の比較）

---


## F10 エキスパート物理量インスペクタ機能

### 概要

上級者向けに、現在の回路・環境条件・シミュレーション結果に紐づく物理量、内部モデル、近似条件、数値診断情報を表示・検索できる機能。

本機能は、Expertモードで利用できる詳細表示パネルとして提供する。利用者は横サイドバーまたは詳細パネルを開き、現在のシミュレーションにおいて計算された T1/T2、gamma、Lindblad演算子、密度行列、有効非エルミートハミルトニアン、近似条件、モデル限界を確認できる。

---

### 基本方針

- 入門モードでは表示しない、または折りたたむ
- Expertモードで表示する
- 現在の回路と環境条件に紐づいた値を表示する
- 値だけでなく、意味・単位・生成元を表示する
- 検索またはフィルタで物理量を探せるようにする
- 近似条件とモデル限界を明示する
- UI上の値とシミュレーション結果が一致している必要がある

---

### 表示カテゴリ

#### E01 Overview

現在のシミュレーション概要を表示する。

- 論理量子ビット数
- Hilbert空間次元
- 密度行列サイズ
- ゲート数
- シミュレーションモデル
- 時間ステップ数
- シミュレーション時間

---

#### E02 Environment-derived quantities

環境条件から導出された物理量を表示する。

- temperature parameter
- magnetic field parameter
- noise level
- T1 relaxation time
- T2 dephasing time

注記:
MVPおよび本開発初期では、temperature / magnetic_field / noise_level は正規化パラメータであり、実機単位との厳密対応は持たない。

---

#### E03 Noise rates

T1/T2から導かれるノイズ率を表示する。

- gamma1
- gammaphi
- gamma ratio
- dominant decoherence source

---

#### E04 Lindblad operators

Lindblad型マスター方程式で使用されるcollapse operatorを表示する。

- relaxation operator
- pure dephasing operator
- operator matrix
- target qubit
- enabled/disabled

---

#### E05 Effective non-Hermitian Hamiltonian

実装済みの場合、有効非エルミートハミルトニアンを表示する。

- H_eff
- Re(H_eff)
- Im(H_eff)
- complex eigenvalues
- no-jump interpretation

注記:
H_eff は no-jump 条件付き発展を表すものであり、Lindblad型のアンサンブル平均発展とは区別する。

---

#### E06 Density matrix and state diagnostics

現在または最終時刻の状態診断を表示する。

- density matrix
- Re(ρ)
- Im(ρ)
- |ρ|
- trace
- Hermiticity error
- minimum eigenvalue
- final purity
- final state fidelity
- output probability distribution

---

#### E07 Approximation and limitations

現在のモデルの仮定と限界を表示する。

- weak-coupling open quantum system
- Born-Markov approximation
- Lindblad-type master equation
- phenomenological T1/T2 noise
- no strict hardware calibration
- no strong-coupling memory effects
- no pulse-level control
- not a research-grade full simulator

---

### 検索・フィルタ機能

Expertインスペクタでは、物理量やモデル要素を検索できる。

#### 検索対象

- T1
- T2
- gamma1
- gammaphi
- fidelity
- purity
- Lindblad
- collapse operator
- relaxation
- dephasing
- density matrix
- Hamiltonian
- H_eff
- threshold
- trace
- Hermiticity
- approximation
- limitation

#### フィルタ候補

- Environment
- Noise
- Operators
- State
- Diagnostics
- Assumptions

---

### UI要件

- Expertモードでのみ表示する
- 横サイドバーまたは折りたたみ式詳細パネルとして表示する
- 検索ボックスを持つ
- カテゴリごとに折りたためる
- 数値には単位または「正規化パラメータ」を明記する
- 数式または短い説明を併記する
- 行列表示は必要に応じて展開式にする
- 1〜2量子ビットでは密度行列を直接表示する
- 3量子ビット以上では密度行列全体表示を任意または折りたたみにする

---

### MVP範囲

MVPでは対象外。

---

### 本開発必達

- T1表示
- T2表示
- gamma1表示
- gammaphi表示
- dominant decoherence source表示
- final fidelity / final purity表示
- effective operation time表示
- モデル仮定・限界表示
- Expertモード内の折りたたみ式詳細パネル

---

### 本開発標準目標

- Lindblad演算子表示
- collapse operator matrix表示
- density matrix表示
- trace / Hermiticity診断
- 検索ボックス
- カテゴリフィルタ

---

### 本開発上限目標

- 有効非エルミートハミルトニアン表示
- H_effの固有値表示
- no-jump発展との比較
- reduced density matrix表示
- 用語辞書との連携

---

### 非対象

本開発初期では以下を対象外とする。

- 強結合開放系の厳密な内部量表示
- 非Markov記憶核の表示
- 実機キャリブレーションデータとの照合
- Pulseレベル制御パラメータ表示
- 大規模量子回路の全演算子表示
- fault-tolerant thresholdの厳密判定

---

### 受け入れ条件

- Expertモードで詳細パネルを開ける
- 現在の回路・環境条件に対応するT1/T2を表示できる
- gamma1/gammaphiを表示できる
- 支配的劣化要因を表示できる
- final fidelity / final purity / effective operation timeを表示できる
- モデル仮定と限界を表示できる
- Lindblad演算子を折りたたみ表示できる
- 検索またはカテゴリフィルタで項目を絞り込める

---

## F11 保存/読込・プリセット管理機能



### 概要



利用者が作成した回路、環境条件、シミュレーション設定、表示設定、シミュレーション結果を保存・読込・出力できる機能。



本機能では、QuantaScope上で作成した設定を再利用可能な形式で保存し、後から同じ条件で再実行できるようにする。また、シミュレーション結果をJSONまたはCSVとして出力し、比較・記録・外部解析に利用できるようにする。



---



### 基本方針



- 設定保存と結果保存を分離する

- 設定はJSON形式で保存する

- 結果はJSONおよびCSVで出力できる

- プリセットはJSONとして管理する

- 保存形式にはschema_versionを含める

- 将来の形式変更に備えてバージョン管理する

- 回路・環境条件・シミュレーション設定を1つの設定ファイルで再現できるようにする



---



### 保存対象



#### S01 設定保存



以下を保存する。



- 回路データ

- 論理量子ビット数

- 初期状態

- ゲート列

- 環境条件

- 環境プロファイル

- シミュレーションモデル

- simulation duration

- time steps

- fidelity threshold

- 表示モード



標準形式:



- `.qscope.json`



---



#### S02 結果保存



以下を保存する。



- 入力設定

- times

- state_fidelity

- purity

- effective_operation_time

- final_state_fidelity

- final_purity

- output probability distribution

- T1/T2

- gamma1/gammaphi

- dominant decoherence source

- warnings



標準形式:



- `.qscope.result.json`



---



#### S03 CSV出力



時系列データをCSV形式で出力する。



出力候補:



- time_us

- state_fidelity

- purity

- output_probability_distance

- condition labels if comparison mode



用途:



- 表計算

- レポート作成

- 外部解析

- U-22提出資料作成



---



#### S04 プリセット読込



あらかじめ用意された回路・環境条件・デモ設定を読み込める。



プリセット候補:



- 1-qubit H

- Bell state

- Low noise

- High noise

- Strong dephasing

- Strong relaxation

- Dephasing demo

- Bell under high noise



---



### UI配置



#### Project操作



画面上部または左サイドバーに配置する。



- New

- Open

- Save settings

- Export result

- Export CSV



#### プリセット



ゲートパレット付近または左サイドバーに配置する。



- Circuit presets

- Environment presets

- Example presets



#### 注意



ゲートパレット上には、回路プリセットのみを置く。  

保存/読込全体はプロジェクト操作として扱う。



---



### ファイル形式



#### 設定ファイル



`.qscope.json`



用途:



- 回路と条件を保存

- 後から同じ条件で再実行

- プリセットとして利用



#### 結果ファイル



`.qscope.result.json`



用途:



- シミュレーション結果の保存

- 再現性の確保

- 解析記録



#### CSV



`.csv`



用途:



- 時系列データ出力

- 外部ツールでの解析

- レポート作成



---



### 入力検証



読込時には以下を検証する。



- schema_version が対応範囲内か

- logical_qubits が上限以内か

- gate が対応済みか

- initial_state が対応済みか

- environment値が範囲内か

- simulation設定が妥当か

- 必須キーが存在するか

- 不明キーがある場合は警告する



---



### MVP範囲



MVPでは対象外。



ただし、内部データ構造は将来的にJSON保存できる形を意識する。



---



### 本開発必達



- 設定JSONの保存

- 設定JSONの読込

- Low noise / High noise プリセット読込

- 1-qubit H / Bell state プリセット読込

- CSV結果出力

- schema_version付き形式

- 読込時の入力検証



---



### 本開発標準目標



- `.qscope.json` 形式の導入

- `.qscope.result.json` 形式の導入

- 比較結果CSV出力

- UIからのプリセット選択

- 保存ファイルの説明表示

- export用ファイル名自動生成



---



### 本開発上限目標



- URL共有形式

- 最近使ったファイル一覧

- Obsidian用Markdownレポート出力

- U-22提出用サマリ出力

- 実験ログ自動生成



---



### 非対象



本開発初期では以下を対象外とする。



- クラウド保存

- ユーザーアカウント

- マルチユーザー共有

- データベース管理

- 自動同期

- 外部実機データとの自動連携



---



### 受け入れ条件



- 現在の回路と環境条件をJSONとして保存できる

- 保存したJSONを読み込んで同じ設定を復元できる

- プリセットを選択して回路または環境条件を読み込める

- シミュレーション結果をCSVとして出力できる

- 読込時に不正な形式を検出できる

- schema_versionを持つ



---



## F12 結果ログ出力機能



### 概要



シミュレーション結果を外部ファイルとして出力する。



### 要件



- 入力条件

- 出力指標

- 時系列データ

- 実行時刻

- モデルバージョン



### 優先度



中



### MVP対象



非対象



---
## F13 入力検証・数値異常ハンドリング機能

### 概要

不正な入力、計算失敗、および数値的な異常を検出し、利用者へ適切に通知する機能。

###
検証項目

1. **入力範囲検証**: `noise_level` 等が 0.0〜1.0 の範囲内であるか。
2. **回路整合性**: 未定義ゲートの有無、量子ビットインデックスの超過。
3. **数値異常検出**:
    - **NaN / Inf**: 計算過程で発生した場合、即座に停止し通知。
    - **Trace 違反**: 密度行列の Trace ($\text{Tr}(\rho)$) が 1.0 から許容誤差を超えて乖離していないか。
    - **Hermiticity 違反**: $\rho = \rho^\dagger$ が維持されているか。

### 数値許容誤差 (Tolerance)

計算の物理的妥当性を担保するため、以下の許容誤差を設定する。これらを超える乖離が発生した場合は数値異常として扱う。

#### Trace (トレース)
密度行列のトレース（全確率の総和）の許容範囲。
```text
Tr(rho) = 1.0 +/- 1e-6
```

#### Hermiticity (エルミート性)
密度行列の複素共役転置との差のノルム。
```text
||rho - rho_dagger|| < 1e-8
```

#### Probability Sum (測定確率総和)
出力確率分布の総和。
```text
Sum(P_i) = 1.0 +/- 1e-6
```

### 優先度

高

### MVP対象

対象（基本的な範囲検証および NaN 検出）

---

## F14 正常動作判定機能 (サマリー表示)

### 概要

F06 で算出された各種指標に基づき、現在の量子回路が「正常に動作しているか（理想に近いか）」のサマリーを表示する機能。

### 要件

- **動作ステータス表示**: Fidelity が閾値以上の場合は「正常 (Healthy)」、下回った場合は「劣化 (Degraded)」等のラベルを表示。
- **指標サマリー**: Fidelity, Purity, 有効動作時間をカード形式で一箇所に表示。
- **失敗分析**: 有効動作時間が極端に短い場合、支配的なノイズ源（Relaxation / Dephasing）を強調表示。

### 優先度

中（F06 の結果を利用するフロントエンド機能）

### MVP対象

対象（サマリーカードとしての表示）
