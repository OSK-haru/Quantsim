# QuantaScope 物理モデル検証プロセス計画

## 0. 文書の目的

本計画は、QuantaScope について次の三者を一致させ、物理シミュレータとしての透明性と再現性を確立するための作業計画である。

1. **理論上の定義と規約**
2. **実際に動作するコード**
3. **説明文書・概略図・UI表示**

本計画では、現行の弱結合・Born-Markov・Lindblad 型モデルを対象とする。新しい物理モデルを追加することより先に、現在のモデルが何を計算しているかを固定し、解析解・極限・数値収束・QuTiP比較によって検証する。

> 重要方針: QuTiPとの一致だけを正しさの根拠にしない。まず解析解と極限で確認し、その後に独立実装との比較を行う。

---

## 1. 最終成果物

検証終了時に、以下を一式として残す。

```text
docs/validation/
├─ 00_environment_and_reproduction.md
├─ 01_model_conventions.md
├─ 02_physical_quantity_traceability.md
├─ 03_analytic_validation_results.md
├─ 04_numerical_convergence_results.md
├─ 05_qutip_comparison_results.md
├─ 06_figure_classification.md
├─ 07_ai_usage_disclosure.md
├─ 08_discrepancy_resolution_log.md
└─ 09_research_question_candidates.md

tests/physics_validation/
├─ test_zero_dissipation_unitaries.py
├─ test_zero_temperature_excitation.py
├─ test_amplitude_damping_analytic.py
├─ test_pure_dephasing_analytic.py
├─ test_finite_temperature_equilibrium.py
├─ test_time_step_convergence.py
└─ test_qutip_equivalence.py

scripts/validation/
├─ run_analytic_validation.py
├─ run_convergence_sweep.py
├─ run_qutip_comparison.py
└─ export_validation_report.py

artifacts/validation/
├─ csv/
├─ figures/
├─ json/
└─ logs/
```

各結果には、最低限次を記録する。

- Git commit hash
- 実行日時
- OS、Python、Node、Rust、NumPyのバージョン
- 使用backend
- 入力パラメータ
- 回路JSON
- 時間刻み・出力時刻列
- 数値許容誤差
- PASS / FAIL
- 生成したCSV、図、ログへのパス

---

## 2. 検証開始前のモデル凍結

検証中に物理式が変わると結果を比較できないため、最初に検証対象を固定する。

### 2.1 対象モデル

- environment model: `generic_superconducting_open_system_v1`
- solver: 現行の gate-aware Hamiltonian + Lindblad 時間発展
- dense engine: `numpy_dense_v1`
- fallback: pure-Python dense path
- 対象qubit数: 原則1 qubit、ゲート一致試験のみ2〜4 qubitも使用
- 時間単位: `us`
- 散逸率単位: `1/us`
- 基底順序: q0をmost significant bitとするQuantaScope規約

### 2.2 凍結時に保存するもの

- `requirements.txt` またはlock相当
- `package-lock.json`
- Rust toolchain情報
- `python --version`
- `pip freeze`
- `npm --version`
- `rustc --version`
- `cargo --version`
- `git status`
- `git rev-parse HEAD`
- API起動コマンド
- frontend起動コマンド
- 検証スクリプト起動コマンド

### 2.3 実行環境の再現性確認

最低2回、可能なら別端末またはクリーン仮想環境で次を確認する。

1. 依存関係をインストールできる
2. APIが起動する
3. frontendが起動する
4. 同一検証JSONから同一結果が得られる
5. 全検証テストが実行できる

---

## 3. 最優先の規約監査

以下は、説明資料を更新する前にコード上の採用規約を確定させる。

## 3.1 現行コードから読み取れる暫定規約

以下は検証計画作成時点のコードから読み取れる内容であり、正式確定前に実リポジトリの最新commitで再監査する。

### A. 有限温度での縦緩和時間

現行実装は、

$$
\gamma_\downarrow = \gamma_{1,\mathrm{base}}(1+n_{\mathrm{th}}),
\qquad
\gamma_\uparrow = \gamma_{1,\mathrm{base}}n_{\mathrm{th}}
$$

とし、

$$
\frac{1}{T_{1,\mathrm{effective}}}
=\gamma_\downarrow+\gamma_\uparrow
$$

を採用しているように見える。

**確認事項**

- UIの `T1` が `T1_base` なのか `T1_effective` なのか
- `T1 max` が有限温度の実効値ではなく、device profileから得る基準時間の上限であること
- `gamma1_per_us` というlegacy aliasが `gamma_down_per_us` を指しており、有限温度では誤解を招くため廃止または明示的な注記が必要か

### B. 純粋位相緩和演算子

現行コードは、

$$
L_\phi=\sqrt{\frac{\gamma_\phi}{2}}\,\sigma_z
$$

を採用しているように見える。

この規約では、Hamiltonianと他の散逸をゼロにすると、非対角成分は

$$
\rho_{01}(t)=\rho_{01}(0)e^{-\gamma_\phi t}
$$

で減衰する。したがって、

$$
T_\phi=\frac{1}{\gamma_\phi}
$$

と解釈できる。

### C. Hamiltonianの単位

現行コードは、

$$
\frac{d\rho}{dt}=-i[H,\rho]+\mathcal D(\rho)
$$

を直接解き、ゲート生成子を

$$
H_k=\frac{\pi}{2\tau_k}(I-U_k)
$$

としている。この `H` はエネルギー[J]そのものではなく、

$$
\widetilde H=H_{\mathrm{physical}}/\hbar
$$

に相当する**角周波数単位の生成子**である。時間が `us` のため、コード上の単位は実質 `rad/us`、数値次元としては `1/us` と整理する。

説明資料では次のいずれかに統一する。

```text
方式1: Hを角周波数Hamiltonianと明記し、-i[H,rho] と書く
方式2: 物理Hamiltonian H_phys を使い、-(i/hbar)[H_phys,rho] と書く
```

現行コードとの一致を優先するなら方式1が自然である。

### D. 環境入力から散逸率への変換

現行コードの暫定的な流れは次の通り。

1. `device_quality` から `T1_base`, `Tphi_base` をprofileの最小値・最大値の間で指数補間
2. 温度[mK]をKへ、周波数[GHz]をHzへ変換
3. Bose-Einstein占有数

$$
n_{\mathrm{th}}
=\frac{1}{\exp\left(\frac{hf}{k_BT}\right)-1}
=\frac{1}{\exp\left(\frac{\hbar\omega}{k_BT}\right)-1}
$$

4. 基準率

$$
\gamma_{1,\mathrm{base}}=\frac{1}{T_{1,\mathrm{base}}},
\qquad
\gamma_{\phi,\mathrm{base}}=\frac{1}{T_{\phi,\mathrm{base}}}
$$

5. 熱緩和・熱励起

$$
\gamma_\downarrow=\gamma_{1,\mathrm{base}}(1+n_{\mathrm{th}}),
\qquad
\gamma_\uparrow=\gamma_{1,\mathrm{base}}n_{\mathrm{th}}
$$

6. flux noise寄与

$$
\gamma_{\phi,\mathrm{flux}}
=\gamma_{\phi,\mathrm{flux,max}}
\frac{A_\Phi}{A_{\Phi,\max}}
$$

7. 純粋位相緩和率

$$
\gamma_\phi
=\gamma_{\phi,\mathrm{base}}+\gamma_{\phi,\mathrm{flux}}
$$

8. 実効時間

$$
T_{1,\mathrm{effective}}
=\frac{1}{\gamma_\downarrow+\gamma_\uparrow}
$$

$$
T_{2,\mathrm{effective}}
=\frac{1}{\frac{1}{2}(\gamma_\downarrow+\gamma_\uparrow)+\gamma_\phi}
$$

### 3.2 規約確定チェックリスト

- [ ] すべての散逸率の記号をコードと資料で一致させた
- [ ] `T1_base` と `T1_effective` を区別した
- [ ] `Tphi_base` とtotal `gamma_phi`の関係を明記した
- [ ] `gamma1` という曖昧なaliasを整理した
- [ ] `H` がエネルギーか角周波数生成子かを明記した
- [ ] `f` [Hz] と `omega` [rad/s] を混在させていない
- [ ] `h f = hbar omega` の関係を説明した
- [ ] `us`, `GHz`, `mK`, `Phi0` の変換箇所を確認した
- [ ] ideal referenceと「T=0」の違いを説明した

> 注意: 現行モデルでは、T=0かつflux noise=0でも、device profile由来のbaseline relaxation/dephasingが残る場合がある。完全無散逸の検証には `ideal_reference` または散逸率を直接ゼロにする専用fixtureを使う。

---

## 4. 物理量トレーサビリティ表

`docs/validation/02_physical_quantity_traceability.md` に、次の形式で全項目を記載する。

| ID | UI表示名 | コード変数 | 記号 | 定義 | 入力/導出 | 単位 | 許容範囲 | 出典 | 実装ファイル・関数 | API field | UI component | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Q01 | Temperature | `temperature_mk` | $T$ | 熱浴温度 | 入力 | mK | $T\ge0$ | 文献 | `core/physical_environment.py` | `parameters.temperature_mk` | ParameterPanel | Kへ変換 |
| Q02 | Qubit frequency | `qubit_frequency_ghz` | $f_q$ | 二準位間遷移周波数 | 入力 | GHz | $f_q>0$ | 文献 | 同上 | 同上 | ParameterPanel | $\omega_q=2\pi f_q$ |
| Q03 | Thermal occupation | `n_th` | $n_{th}$ | Bose平均占有数 | 導出 | 無次元 | $\ge0$ | 文献 | `compute_thermal_occupation` | response derived | diagnostics | qubit励起確率ではない |
| Q04 | Downward rate | `gamma_down_per_us` | $\gamma_\downarrow$ | $\gamma_0(1+n_{th})$ | 導出 | 1/us | $\ge0$ | 文献 | rate builder | response derived | diagnostics |  |
| Q05 | Upward rate | `gamma_up_per_us` | $\gamma_\uparrow$ | $\gamma_0n_{th}$ | 導出 | 1/us | $\ge0$ | 文献 | rate builder | response derived | diagnostics | T=0で0 |
| Q06 | Pure dephasing rate | `gamma_phi_per_us` | $\gamma_\phi$ | baseline + flux | 導出 | 1/us | $\ge0$ | 文献/モデル定義 | rate builder | response derived | diagnostics | collapse係数規約を明記 |
| Q07 | Effective T1 | `t1_effective_us` | $T_1$ | $1/(\gamma_\downarrow+\gamma_\uparrow)$ | 導出 | us | $>0$ or inf | 文献 | rate builder | response derived | diagnostics | baseと区別 |
| Q08 | Effective T2 | `t2_effective_us` | $T_2$ | $1/[\frac12(\gamma_\downarrow+\gamma_\uparrow)+\gamma_\phi]$ | 導出 | us | $>0$ or inf | 文献 | rate builder | response derived | diagnostics |  |
| Q09 | Gate duration | `duration_us` | $\tau_k$ | 列中最大gate duration | 入力/導出 | us | $\ge0$ | 設計定義 | `core/gates.py` | gate params | Circuit Studio |  |
| Q10 | Effective generator | generated matrix | $\widetilde H_k$ | $\pi(I-U_k)/(2\tau_k)$ | 導出 | 1/us | gate依存 | 導出 | `effective_hamiltonian_from_involution` | model details | Expert UI | $U^2=I$制約 |

### 4.1 出典の階層

各式の出典は次の優先順位で記載する。

1. 標準的教科書・査読論文
2. QuTiP公式文書
3. QuantaScope固有の設計定義
4. 生成AIの説明は出典として扱わない

### 4.2 「モデル固有」と明記すべき項目

- device qualityからT1/Tphiへの補間
- flux noise振幅からdephasing rateへの線形変換
- profileのmin/max値
- normalized beginner inputからphysical inputへの写像
- gate duration defaults

これらは自然法則から一意に決まる式ではなく、教育用・現象論的profileの設計である。

---

## 5. 解析解・極限による検証

すべての検証は、最初に1 qubitの最小系で行う。複雑な回路は、最小系が通った後に追加する。

## V1. 散逸ゼロで理想量子ゲートと一致するか

### 目的

有効Hamiltonian時間発展が、理想ユニタリ

$$
\rho_{\mathrm{ideal}}=U\rho_0U^\dagger
$$

と一致することを確認する。

### 条件

- `gamma_down = gamma_up = gamma_phi = 0`
- idle時間なし
- H, X, Z, CNOT
- Bell回路
- 可能なら3〜4 qubitの複数ゲート列

### 比較量

- 最終密度行列の最大絶対誤差
- Frobenius norm
- output probabilities
- fidelity
- trace
- Hermiticity

### 暫定合格基準

```text
max |rho_sim - rho_ideal| <= 1e-9
trace error <= 1e-10
Hermiticity error <= 1e-10
fidelity >= 1 - 1e-9
```

時間刻み依存があるため、基準未達の場合はまずV6の収束試験へ送る。

---

## V2. T=0で熱励起率がゼロになるか

### 解析上の期待

$$
\lim_{T\to0}n_{\mathrm{th}}=0,
\qquad
\gamma_\uparrow=\gamma_0n_{\mathrm{th}}=0
$$

$$
\gamma_\downarrow=\gamma_0
$$

### 条件

- `temperature_mk = 0`
- `qubit_frequency_ghz > 0`
- ideal referenceは使わない
- baseline relaxationは有限でよい

### 確認

- `n_th == 0`
- `gamma_up == 0`
- `gamma_down == gamma1_base`
- NaN/infが出ない

### 境界値

- T=0
- 極低温
- f=0は入力エラーにするか、関数単体では0を返すかを仕様化
- 非常に大きな指数でoverflowしない

---

## V3. 初期状態 |1> の占有確率が指数関数に従うか

### T=0の解析解

Hamiltonianなし、pure dephasingなし、初期状態$|1\rangle$では、

$$
P_1(t)=e^{-\gamma_\downarrow t}
$$

$$
P_0(t)=1-e^{-\gamma_\downarrow t}
$$

### 有限温度への拡張

$$
\Gamma_1=\gamma_\downarrow+\gamma_\uparrow
$$

$$
P_{1,\mathrm{eq}}
=\frac{\gamma_\uparrow}{\gamma_\downarrow+\gamma_\uparrow}
=\frac{n_{\mathrm{th}}}{2n_{\mathrm{th}}+1}
$$

$$
P_1(t)=P_{1,\mathrm{eq}}
+[P_1(0)-P_{1,\mathrm{eq}}]e^{-\Gamma_1 t}
$$

### 比較方法

- 解析値と全snapshotを比較
- max absolute error
- RMSE
- fitted decay rateと入力rateの差

### 暫定合格基準

```text
max probability error <= 1e-6 at reference step setting
fitted rate relative error <= 1e-4
```

最終基準は収束試験後に固定する。

---

## V4. 純粋位相緩和のみで人口が不変か

### 条件

- 初期状態$|+\rangle$
- Hamiltonian=0
- `gamma_down = gamma_up = 0`
- `gamma_phi > 0`
- collapse operator: $\sqrt{\gamma_\phi/2}\sigma_z$

### 解析解

$$
\rho(0)=\frac12
\begin{pmatrix}
1&1\\
1&1
\end{pmatrix}
$$

$$
\rho_{00}(t)=\rho_{11}(t)=\frac12
$$

$$
\rho_{01}(t)=\rho_{10}(t)
=\frac12e^{-\gamma_\phi t}
$$

### 確認

- 対角成分が変化しない
- 非対角成分だけが指数減衰する
- trace=1
- Hermiticity維持
- Bloch vectorを後で使う場合、x成分が$e^{-\gamma_\phi t}$に従う

---

## V5. 有限温度・長時間で熱平衡へ近づくか

### 解析上の平衡

$$
P_{1,\mathrm{eq}}
=\frac{\gamma_\uparrow}{\gamma_\downarrow+\gamma_\uparrow}
=\frac{1}{e^{hf/(k_BT)}+1}
$$

$$
P_{0,\mathrm{eq}}
=\frac{\gamma_\downarrow}{\gamma_\downarrow+\gamma_\uparrow}
$$

これは二準位系のGibbs分布と一致する。

### 条件

- Hamiltonian=0
- pure dephasingは0または任意
- 異なる初期状態$|0\rangle$, $|1\rangle$, $|+\rangle$
- 十分長い時間、目安$8T_{1,\mathrm{effective}}$以上
- 複数のT, f

### 確認

- 初期状態によらず同じ対角平衡へ近づく
- off-diagonalは0へ近づく
- 実測平衡人口と解析値を比較
- detailed balance

$$
\frac{\gamma_\uparrow}{\gamma_\downarrow}
=e^{-hf/(k_BT)}
$$

を確認する。

---

## V6. 時間刻み・数値精度の収束

### 対象ケース

1. T=0 amplitude damping
2. pure dephasing
3. 有限温度thermalization
4. H gate + dissipation
5. CNOT + dissipation
6. 複数列 + idle

### sweep例

```text
time_steps = 26, 51, 101, 201, 401, 801
```

総時間を固定し、$\Delta t$を半分ずつにする。

### 比較量

- 解析解に対する誤差
- 最細分結果に対する誤差
- 最終密度行列
- timeline全体の最大誤差
- trace error
- Hermiticity error
- 最小固有値
- probability sum

### RK4の期待

滑らかな問題では、丸め誤差やcleaning処理が支配する前の領域で、global errorは概ね

$$
O(\Delta t^4)
$$

になることを期待する。刻みを半分にした際の誤差比が常に16になることを絶対条件にはせず、収束傾向とplateauを確認する。

### 合格条件

- 刻みを細かくすると主要出力が一定値へ収束する
- trace/Hermiticityが許容範囲内
- 負固有値が数値許容範囲を超えない
- UI defaultの刻みが、定めた許容誤差を満たす

---

## V7. QuTiPとの同条件比較

### 方針

QuTiPは独立solverとして使用し、QuantaScopeと同一の数学的入力を渡す。

- 同一初期密度行列
- 同一Hamiltonian生成子
- 同一時間単位
- 同一`tlist`
- 同一collapse operators
- 同一basis order

### QuTiP側のcollapse operators

```python
c_ops = [
    sqrt(gamma_down) * sigmam(),
    sqrt(gamma_up) * sigmap(),
    sqrt(gamma_phi / 2) * sigmaz(),
]
```

多qubitではQuantaScopeと同じtensor順序に展開する。

### 比較ケース

- zero-H amplitude damping
- pure dephasing
- finite-temperature thermalization
- H gate with zero dissipation
- H gate with dissipation
- CNOT with dissipation
- Bell/GHZ-style circuit
- gate interval + idle interval

### 比較量

- snapshotごとの密度行列
- population
- coherence
- fidelity
- purity
- final probabilities

### 注意事項

- QuTiPのODE toleranceを十分厳しくする
- QuTiPとQuantaScopeの時刻点を揃える
- `H`の単位規約を揃える
- `sigmam` / `sigmap` のbasis conventionを単体試験で確認する
- q0のMSB規約をtensor orderで確認する

### 暫定合格基準

```text
1-qubit analytic cases: max rho diff <= 1e-7
multi-qubit gate cases: max rho diff <= 1e-6
probability/fidelity/purity diff <= 1e-6
```

許容値は、QuTiP toleranceとV6の収束結果を見て正式決定する。

---

## 6. 単位整合性監査

次の単位表を作成し、全式の次元を確認する。

| 量 | UI単位 | 内部単位 | 変換 |
|---|---|---|---|
| Temperature | mK | K | `*1e-3` |
| Frequency | GHz | Hz | `*1e9` |
| Time | us | us | 原則そのまま |
| Rates | 1/us | 1/us | timeと整合 |
| Hamiltonian generator | 表示要検討 | 1/us | $H_{phys}/\hbar$ |
| Flux noise amplitude | $\Phi_0$比 | dimensionless ratio | profile依存 |
| $n_{th}$ | dimensionless | dimensionless | Bose式 |

### 6.1 必須テスト

- `h*f/(k_B*T)` が無次元になる
- GHzとHzを二重変換しない
- mKとKを二重変換しない
- gate durationとrateの積が無次元になる
- QuTiP比較時にus単位をそのまま採るなら、QuTiPへ渡すHとrateも1/usに統一する

---

## 7. 図の分類とラベル

各図には必ず次のいずれかを表示する。

```text
[概念図]
[UIモック]
[実際の計算結果]
```

### 7.1 現在添付された図の暫定分類

| 図 | 分類 | 必須注記 |
|---|---|---|
| `n_th の意味と注意事項` | 概念図 | 式・rate規約を最新コードに合わせて修正。AI生成図であることを記録 |
| `物理モデル概略図` | 概念図 | 表示された数値・グラフは実測結果ではなく説明用であると注記 |
| `リアル化レベルの位置づけ` | 概念図・位置づけ図 | Levelは便宜的分類で厳密な標準ではないと注記 |
| `システム概略図` | 概念図・アーキテクチャ図 | Rustが常に全計算を担うように誤読されない表現へ更新 |

### 7.2 実際の計算結果と呼べる条件

- QuantaScopeの実行で生成した
- 入力JSONを保存した
- commit hashを保存した
- 軸・単位・凡例がある
- 後処理スクリプトを保存した
- 手描き・AI生成・モック値を混ぜていない

概念図内に例示グラフを置く場合は、明確に次を付ける。

```text
Illustrative only / 計算結果ではありません
```

---

## 8. 生成AI利用の開示

`docs/validation/07_ai_usage_disclosure.md` に、工程別に記録する。

| 区分 | 利用内容 | AIの役割 | 人間による確認 | 成果物例 |
|---|---|---|---|---|
| 調査 | 文献候補・検証観点の洗い出し | 候補提示、要約補助 | 一次資料を本人が確認 | 調査メモ |
| 文章 | 説明文・計画書の草案 | 構成・表現補助 | 式、主張、出典を本人が確認 | Markdown/PDF |
| 画像 | 概念図作成 | レイアウト・画像生成 | 式、記号、分類を本人が確認 | 添付4図 |
| コード | Codex等による実装補助 | コード生成・修正案 | diff review、test実行、結果確認 | frontend/core/tests |
| 検証 | テストケース草案 | 解析式・ケース候補提示 | 解析導出、独立比較、結果判定は本人 | validation tests |

### 8.1 開示原則

- AI生成物を出典にしない
- AIが示した式は一次資料または自力導出で再確認する
- 実行していないコードを「検証済み」と書かない
- AI生成の概念図を「実際の計算結果」と表示しない
- 最終的な物理的主張と誤りの責任は開発者が負う
- 利用した主要prompt、採否、修正点を記録する

---

## 9. 不一致解消ログ

発見した不一致は、その場で黙って修正せずログに残す。

| ID | 対象 | 資料の記述 | コードの実装 | 正式採用 | 修正箇所 | 根拠 | 状態 |
|---|---|---|---|---|---|---|---|
| D01 | finite-T T1 | $1/\gamma_\downarrow$ と読める図 | $1/(\gamma_\downarrow+\gamma_\uparrow)$ | 未確定→監査後確定 | 図・本文・UI | 解析解/文献 | Open |
| D02 | dephasing | $\sqrt{\gamma_\phi}\sigma_z$ の図 | $\sqrt{\gamma_\phi/2}\sigma_z$ | 後者候補 | 図・本文 | coherence解析 | Open |
| D03 | Hamiltonian | energy表記の可能性 | angular-frequency generator | 後者候補 | 数式・単位表 | code/導出 | Open |
| D04 | `gamma1_per_us` | total relaxationに見える | gamma_down alias | rename/deprecate候補 | response/UI | semantic audit | Open |
| D05 | baseline noise | T=0なら全ノイズ0に見える | profile baselineは残る | 表示改善 | UI/説明 | code | Open |

修正後は、同じIDでテスト、文書、図、UIの変更を関連づける。

---

## 10. 実装と文書の対応監査

以下の順でコードを追跡する。

```text
UI input
  -> frontend request payload
  -> FastAPI schema / validation
  -> SimulationConfig
  -> environment mapping
  -> derived rates
  -> collapse operators
  -> Hamiltonian construction
  -> RK4 / NumPy evolution
  -> SimulationResult
  -> UI response adapter
  -> diagnostics / charts / State Explorer
```

各物理量について、この経路のどこで

- 単位変換されるか
- clampされるか
- defaultが入るか
- 別名へ変換されるか
- 表示値と計算値が分岐するか

を確認する。

---

## 11. 実行順序

### Phase 0: 再現環境固定

- commit hash固定
- 依存バージョン記録
- clean run確認

**完了条件:** 第三者がREADMEの手順で起動・テスト可能。

### Phase 1: 規約監査

- T1規約
- dephasing係数
- Hamiltonian単位
- rate mapping
- alias整理

**完了条件:** `01_model_conventions.md` に曖昧な記号が残らない。

### Phase 2: トレーサビリティ表

- UIからsolverまで全量を対応
- 出典を分類

**完了条件:** 主要入力・導出量・出力を全件追跡できる。

### Phase 3: 解析解検証

- V1〜V5実装
- CSV、図、PASS/FAIL出力

**完了条件:** 解析解と既定許容誤差内で一致。

### Phase 4: 数値収束

- V6 sweep
- default time_stepsの妥当性決定

**完了条件:** 収束傾向と推奨刻みを説明できる。

### Phase 5: QuTiP比較

- optional dev dependency
- V7比較

**完了条件:** 差分が許容範囲内、または差の原因を説明できる。

### Phase 6: 表示・資料監査

- 図の分類
- 既存概略図の式・文言修正
- AI利用記録

**完了条件:** 概念図と計算結果を混同する表示がない。

### Phase 7: 研究問い抽出

検証結果を次の4群に整理する。

1. 予想どおりだったこと
2. 予想と違ったこと
3. 二つの扱いで結果が大きく異なったこと
4. さらに理由を調べたいこと

その後、研究問い候補を2〜3個に絞る。

---

## 12. 検証後に検討する研究問い候補の作り方

研究問いは検証前に無理に固定しない。次の比較軸から、実測で差が見えたものを選ぶ。

### 候補軸

- ゲート終了後にノイズを適用するモデルと、ゲート中に散逸を同時作用させるモデルの差
- finite-temperatureで`T1_base`と`T1_effective`の差が回路成功率へ与える影響
- gate duration、temperature、device qualityのどれが劣化開始時刻を支配するか
- snapshotで観測する密度行列のcoherence消失とfidelity/purityの関係
- time-step設定が「物理的差」と「数値誤差」の判別へ与える影響
- QuTiPと一致しない条件が、solver差・規約差・model差のどれに由来するか

### 問いの書式

```text
どの条件でAとBは一致し、どのパラメータ領域から差が有意になるか。
その差は、どの物理量または数値近似によって説明できるか。
```

---

## 13. 検証完了の総合判定

次をすべて満たしたとき、現行物理モデルの最終詰めを完了とする。

- [ ] 実行環境とcommitが再現可能
- [ ] 物理量の定義・単位・出典・コード・UIが一対一で追跡可能
- [ ] T1規約が統一されている
- [ ] pure dephasing係数規約が統一されている
- [ ] Hamiltonianの単位規約が統一されている
- [ ] 温度・周波数・quality・flux noiseからrateへの写像が明文化されている
- [ ] 散逸ゼロで理想gateと一致
- [ ] T=0でthermal excitationがゼロ
- [ ] amplitude damping解析解と一致
- [ ] pure dephasing解析解と一致
- [ ] finite-temperature equilibriumと一致
- [ ] time-step convergenceを確認
- [ ] QuTiPと同条件で許容誤差内
- [ ] 全図が概念図・UIモック・実計算結果に分類済み
- [ ] AI利用を工程別に開示
- [ ] 不一致と修正履歴が残っている
- [ ] 研究問い候補を2〜3件、自分の言葉で作成

---

## 14. 参照資料

### 提供資料

- 佐藤先生からの指摘文
- `説明文 (2).pdf`
- `n_th の意味と注意事項`
- `物理モデル概略図`
- `QuantaScope におけるリアル化レベルの位置づけ`
- `システム概略図`

### 外部一次・公式資料候補

- QuTiP, Lindblad Master Equation Solver
  https://qutip.readthedocs.io/en/latest/guide/dynamics/dynamics-master.html
- Breuer & Petruccione, *The Theory of Open Quantum Systems*
- Krantz et al., *A Quantum Engineer's Guide to Superconducting Qubits*
- 蘆田祐人『開放系の物理』集中講義資料

---

## 15. 最初の実装タスク

最初のCodexタスクは、物理式を変更するものではなく、次の監査・fixture追加に限定する。

```text
VALIDATION-0:
  Freeze current physical conventions and build isolated rate fixtures
```

### 内容

- 現行のrate計算とcollapse operator係数をテストで固定
- `ideal_reference`とは別に、検証専用として各rateを明示指定できる内部fixtureを作る
- public APIや通常UIには露出しない
- `gamma_down`, `gamma_up`, `gamma_phi`, `H`を独立にゼロ/非ゼロ設定可能にする
- 現行挙動を変更せず、V1〜V5を孤立条件で実行できるようにする
- 規約監査結果を`01_model_conventions.md`へ出力する

この土台を作った後に、V1から順番に検証する。
