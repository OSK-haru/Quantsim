---
title: 制御モデルの検証
sidebar_position: 4
---

# 制御モデルの検証

Gate-awareモデルと3つのPulse-levelモデルが、解析解および独立ソルバーと一致することを検証します。

## Gate-aware CPTP の凍結

```text
freeze_id : yuragi_strider_gate_aware_cptp_v1
tag       : yuragi-strider-gate-aware-cptp-v1
method    : gate_aware_constant_gksl_exponential_v1
判定       : PASS WITH RESTRICTIONS
日付       : 2026-07-29
```

ゲート列・待機区間ごとに1つの定数GKSL指数写像を構成し、Choi監査を通します。整形(cleanup)は適用しません。

### 証拠

| 項目 | 内容 |
|---|---|
| テスト | 91件が通過 |
| 独立QuTiP Bell軌跡 | 密度行列許容 **2e-9** で通過 |
| 3量子ビット・4量子ビット有限ノイズスモーク | Choi監査通過 |
| 4量子ビットスモーク | 3出力サンプルで約 2.11 秒 |

対象テスト: `tests.test_gate_aware_cptp`、`test_gate_aware_hamiltonian_lindblad`、`test_validation_qutip_comparison`、`test_cptp_rust_parity`、およびAPI・スナップショット・UIの回帰テスト。

:::warning 機械可読アーティファクトが存在しない
Gate-aware CPTP凍結には、他の検証と異なり `validation_results/` 配下に対応するJSONファイルが**ありません**(`gate_aware_cptp_freeze.json` は存在しない)。

上記の「91テスト」「2e-9」「2.11秒」はドキュメント上の記述のみを根拠としています。他の検証項目のように機械可読な形で追跡できないため、再検証時は該当テストを直接実行して確認してください。
:::

Gate-awareモデルの基本的な正しさ自体は、[V1(ゼロ散逸極限)](./propagation.md#v1-ゼロ散逸のユニタリ極限)と[V7(QuTiP比較)](./propagation.md#v7-gate-awareモデルのqutip比較)で担保されています。V7にはBell回路(2量子ビット・2区間・6崩壊演算子)が含まれます。

---

## Pulse Baseline A(2準位)

```text
model_id : driven_two_level_rwa_experimental_v1
contract : pulse-baseline-a-v1
判定      : PASS
凍結日時   : 2026-07-25T11:20:59Z
```

凍結時にPulse OpenAPIのSHA-256(`5ae21f2d5f4d7e...`)を記録し、12個の前提アーティファクトを監査しています。

### BA-2: 解析解との比較

許容誤差 **2e-8**。

| ケース | 最大誤差 |
|---|---|
| square_x_pi | 7.968573e-10(終端Fidelity 0.999999999990) |
| square_x_pi_over_2 | 3.984285e-10 |
| square_two_rabi_periods | 3.187426e-09 |
| gaussian_x_pi | 5.666531e-09 |
| gaussian_x_pi_over_2 | 1.928587e-10 |

**有限erf正規化の効果**: 打ち切りGaussianを打ち切り後の面積で正規化した場合、誤差は打ち切り 3σ / 4σ / 5σ のいずれでも **0.0**。無限台の正規化を使うと 8.481659e-03 / 1.989963e-04 / 1.801085e-06 の誤差が生じます。

**収束次数**: ステップ 0.08 → 0.01 μs で誤差 3.014373e-04 → 9.007611e-08、観測次数 3.7754 / 3.9463 / 3.9867(理論値 4)。

パルス後の待機 1.0 μs における状態誤差 **0.0**。

### BA-3: 位相・離調・ゲート等価性

| 項目 | 結果 |
|---|---|
| 4つの位相軸 | 各 2.490408e-11(要素)/ 4.980794e-11(Bloch) |
| 離調符号の解析誤差 | 1.675756e-09 |
| 反対称性・対称性・population対の誤差 | **0.0** |

ゲート等価性(X-πパルスを、既存のXゲート・ゲート有効ハミルトニアン・独立な $R_x(\pi)$ の3つと4つのプローブ状態で比較):

```text
x_pi     : 7.968575e-10
x_pi/2   : 2.490413e-11
y_pi     : 7.968574e-10
y_pi/2   : 2.490413e-11
```

### BA-4: 開放系と待機

要求: トレース誤差・Hermite性 ≤ 1e-12、最小固有値 ≥ −1e-10、整形量 ≤ 1e-12。

```text
生のトレース誤差    : 2.220446e-16
生のHermite性誤差   : 0.0
生の最小固有値      : 2.472403e-14
最大整形量          : 2.775558e-16
```

ゼロレート極限の誤差 5.642694e-09。physical入力と direct_rates の等価性 **0.0**。

### BA-5: QuTiP比較

```text
許容誤差   : max_matrix_difference 5e-7、trace_error 1e-10、min_eigenvalue -1e-10
QuTiP      : mesolve / DOP853、atol=rtol=1e-12、max_step 0.00125 μs、
             normalize_output=false
```

| ケース | 最大要素誤差 |
|---|---|
| resonant_gaussian | 3.657785e-08 |
| nonzero_phase | 1.555641e-08 |
| positive_detuning | 6.613549e-08 |
| negative_detuning | 6.613549e-08 |
| dissipative_gaussian | **2.820964e-09** |
| pulse_then_idle | 5.400107e-08 |

**PASS**(`overall_pass: true`)。実行時間はYuragi-Strider 26.9〜433.8 ms に対しQuTiP 726〜5364 ms。

### 収束検証(PULSE-CONV-2LEVEL)

許容 2e-7。4ケースすべてで観測次数が 3.85〜4.05 の範囲。

:::note
意図的に粗いステップの点では**整形前の固有値が負**になります。これはRK4が本質的にCPTPではないことの直接的な確認です。
:::

### 制限事項

2準位のみ(漏れなし)、RWAのみ、マルコフ的Lindbladのみ、DRAG・伝達関数・クロストーク・多量子ビットパルス非対応、RK4は各ステップで密度行列を整形。

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\validate_pulse_envelopes_analytic.py
.\.venv\Scripts\python.exe scripts\validate_pulse_phase_detuning_gate_equivalence.py
.\.venv\Scripts\python.exe scripts\validate_pulse_open_system_and_idle.py
.\.venv\Scripts\python.exe scripts\validate_pulse_qutip_2level.py
.\.venv\Scripts\python.exe scripts\validate_pulse_baseline_a_freeze.py
```

---

## Pulse Extension B(qutrit)

```text
model_id : driven_transmon_qutrit_rwa_experimental_v1
contract : pulse-extension-b-v1
判定      : PASS WITH RESTRICTIONS
日付      : 2026-07-23(Phase B-7)
```

### B-1: 閉じた系のqutrit発展

5ケース、PASS。

```text
自由発展の0-2コヒーレンス誤差 : 1.304463e-12
弱パルスの2準位ブロック誤差    : 1.464747e-03
弱パルスの終端漏れ             : 1.787193e-12
−100 MHz での最大漏れ          : 3.648533e-01
−300 MHz での最大漏れ          : 4.101598e-02
```

非調和性が小さい(−100 MHz)ほど漏れが大きくなるという物理的に期待される傾向が再現されています。

### B-2: 遷移別の散逸

7ケース、PASS。

```text
詳細釣り合い誤差 0-1  : 5.551115e-17
詳細釣り合い誤差 1-2  : 0.0
カスケードpopulation誤差 : 3.208545e-14
純位相緩和のコヒーレンス誤差 : 1.217082e-14
Gibbs population誤差   : 4.521927e-10
physical / direct 等価性 : 0.0
```

$\gamma_{21}(T{=}0) = 2\gamma_{10}(T{=}0)$ は「教育用の調和行列要素近似」と明記されています。

### B-3: 収束と安全ステップ

方針 `qutrit_fixed_rk4_v1`($\varepsilon_H = \varepsilon_D = 0.02$、σ あたり32サンプル、最大内部ステップ 25,000)。

```text
最大行列誤差        : 5.006523e-09
最大population誤差  : 8.595430e-11
最大漏れ誤差        : 7.179329e-11
生の最小固有値      : -3.849658e-10
最大整形量          : 2.819873e-16
```

性能: 32,381ステップ / 29,717.07 ms(1ステップあたり 0.917732 ms)。

### B-4: DRAG制御

$\beta = 0.001\ \mu\mathrm{s}$。微分の最大絶対誤差 3.257133e-06(許容 1e-5)、相対誤差 8.579654e-11(許容 1e-9)。

**π パルス**:

| 指標 | β = 0 | β = 0.001 | 判定基準 |
|---|---|---|---|
| 最大漏れ | 0.364853 | 0.170083 | — |
| 終端漏れ | 0.260634 | **0.022695**(比 0.087) | 比 ≤ 0.2 |
| 目標Fidelity | 0.647631 | **0.936293** | ≥ 0.9 |

**π/2 パルス**:

| 指標 | β = 0 | β = 0.001 | 判定基準 |
|---|---|---|---|
| 漏れ | 0.046973 | 0.007777 | — |
| Fidelity | 0.945103 | **0.991033** | ≥ 0.98 |
| 位相誤差 | 0.148707 rad | **0.060433 rad** | ≤ 0.08 rad |

収束次数はDRAGの有無によらず 3.900〜4.080。

### B-5: QuTiP比較

事前登録許容 **5e-7**、8ケース、17〜35チェックポイント。

| ケース | 最大要素誤差 |
|---|---|
| closed_gaussian_qutrit_pulse | 2.422391e-10 |
| detuned_leakage_trajectory | 4.187593e-10 |
| transition_specific_qutrit_dissipation | 9.992007e-16 |
| finite_temperature_excitation | 1.221245e-15 |
| pure_number_noise_dephasing | 2.401907e-10 |
| pulse_followed_by_idle | **5.026931e-10** |
| drag_beta_zero | 2.922777e-10 |
| drag_nonzero_both_quadratures | 1.194395e-10 |

全体の最大値:

```text
最大要素誤差   : 5.026931e-10
Frobenius誤差  : 9.631863e-10
トレース距離   : 6.821996e-10
漏れ誤差       : 7.533142e-11
純度誤差       : 3.210543e-12
```

**PASS**

### B-7: 統合と凍結

```text
テスト        : 471件 / 526.510 秒
APIスモーク   : 39件 / 9.496 秒
Markdown監査  : 24文書・44リンク・破損 0
```

:::warning ステップ上限の記述が古い箇所があります
B-7の凍結レポートには、qutritの公開API上限が「core側 25,000 に対してより厳しい 4,000」と記載されていますが、**これは現在の実装と異なります**。

現在は `core/pulse_step_policy.py` と `api/pulse_qutrit_service.py` の双方が **25,000** を使用しており、API側の独立した上限は統合されて存在しません。凍結JSONにも旧値(`qutrit_api_work_ceiling: 4000`)が残っています。

現行の値は 25,000 です。
:::

なお凍結マニフェストには `working_tree_dirty: true`(59変更)が明示的に記録されています。

### 制限事項

単一qutritのみ、3準位切り詰め、RWAのみ、準静的Gaussian離調が唯一の非マルコフ的ノイズ、**固定ステップRK4は厳密な有限ステップCPTP積分ではない**、伝達関数・クロストーク・校正は非対応。

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\validate_pulse_qutrit_closed.py
.\.venv\Scripts\python.exe scripts\validate_pulse_qutrit_dissipation.py
.\.venv\Scripts\python.exe scripts\validate_pulse_qutrit_convergence.py
.\.venv\Scripts\python.exe scripts\validate_pulse_qutrit_drag.py
.\.venv\Scripts\python.exe scripts\validate_pulse_qutip_qutrit.py
.\.venv\Scripts\python.exe scripts\validate_pulse_extension_b_freeze.py
```

---

## Coupled transmon pair(結合2トランズモン)

```text
model_id : driven_coupled_transmon_pair_rwa_experimental_v1
contract : pulse-coupled-pair-v1
capability status : experimental
日付      : 2026-08-01
```

### 数値監査(v1)

8項目すべて通過。

| 検査 | 基準 | 実測 |
|---|---|---|
| ステップ半減(細 &lt; 粗) | — | 2.79e-10 &lt; 4.75e-09 |
| 交換振動 vs $\sin^2(Jt)$ | &lt; 2e-5 | **8.88e-16** |
| J=0 での独立極限 | &lt; 2e-3 | 4.37e-06 |
| Python / Rust(Frobenius) | &lt; 1e-10 | 6.18e-19 |
| Python / Rust(CPTP) | &lt; 1e-9 | 7.99e-16 |
| RK4 / CPTP | &lt; 5e-4 | 1.04e-11 |
| Choi監査(16区間) | CP かつ TP | 最小Choi固有値 −6.7545e-15、最大TP誤差 2.4116e-15 |
| 二変量Gaussian共分散 | &lt; 1e-12 | 1.78e-15(25サンプル) |

交換結合の振動が解析解 $\sin^2(Jt)$ と機械精度で一致する点は、結合項の実装の強い裏付けです。

### QuTiP独立監査(v2)

```text
本番ソルバー : Rust 固定ステップRK4
参照         : QuTiP 5.2.3 mesolve / DOP853
              atol = rtol = 1e-12、nsteps = 100000、normalize_output = false
              最大ステップ ≥ σ/64(Gaussian)または duration/128(square)
```

:::info 独立性の境界
QuTiP側は**公開リクエスト契約から $H(t)$・崩壊演算子・Gaussian包絡線・DRAGクアドラチャ・Gauss-Hermiteノードを独立に再構成**しています。Yuragi-Strider内部の行列をそのまま受け取るのではありません。

これはV7やBA-5より強い独立性であり、契約の解釈自体も検証対象に含まれます。
:::

**7ケース・93チェックポイント、全PASS。**

| ケース | 許容誤差 | 最大要素誤差 | 記録された最大漏れ |
|---|---|---|---|
| sweep_uncoupled_resonant | 2e-6 | 5.462013e-10 | 0.1459 |
| sweep_moderate_exchange_detuned | 2e-6 | 5.045240e-10 | 0.1455 |
| sweep_strong_exchange_opposite_detuning | 2e-6 | 3.815999e-10 | 0.1559 |
| nonzero_dissipation_long_idle | 8e-6 | 1.356055e-09 | 0.0281 |
| simultaneous_two_channel_drag | 1.2e-5 | **1.507155e-07** | 0.1267 |
| strong_drive_high_leakage | 2e-5 | 1.677340e-09 | **0.9399** |
| correlated_quasi_static_ensemble | 1.2e-5 | 5.203560e-10 | 0.1166 |

全体の最大値:

```text
最大要素誤差   : 1.507155e-07
Frobenius誤差  : 4.022127e-07
トレース距離   : 2.852272e-07
population誤差 : 7.094205e-08
漏れ誤差       : 9.048295e-08
純度誤差       : 9.285042e-10
```

### 監査中に発見・修正された不具合

一様チェックポイント時刻とパルス終端が浮動小数点精度の範囲で一致した場合、待機区間に重複した時刻が渡され、`checkpoint_times_us must be strictly increasing` で失敗する問題が発見されました。**1e-14 μs の許容で時刻を正規化**することで修正し、回帰テストを追加しています。

独立監査が実装の不具合を実際に検出した事例です。

### 制限事項

- 厳密に N = 2、交換結合とRWAのみ
- クロストーク・可変結合器・校正は非対応
- **両トランズモンが単一のレートプロファイルを共有**(APIの警告として通知)

:::warning 高漏れ領域について
`strong_drive_high_leakage` では漏れが **約94%** に達します。この領域では3準位切り詰めそのものが妥当でなく、**ハードウェアの予測器としては使用できません**。数値的にQuTiPと一致していることは、切り詰めモデル内部での整合性を示すにすぎません。
:::

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\validate_pulse_transmon_pair.py
.\.venv\Scripts\python.exe scripts\validate_pulse_transmon_pair_qutip.py
```

アーティファクト: `validation_results/pulse_transmon_pair_numerical_audit.json`、`pulse_transmon_pair_qutip_audit.json` / `.csv`

---

## まとめ

| モデル | 独立比較 | ケース数 | 最大誤差 | 判定 |
|---|---|---|---|---|
| Gate-aware | QuTiP(V7) | 7 | 2.10e-10 | PASS |
| Gate-aware CPTP | 内部テスト | 91テスト | 2e-9(Bell) | PASS WITH RESTRICTIONS |
| Pulse Baseline A | QuTiP | 6 | 6.61e-08 | PASS |
| Pulse Extension B | QuTiP | 8 | 5.03e-10 | PASS WITH RESTRICTIONS |
| Coupled pair | QuTiP | 7(93点) | 1.51e-07 | PASS |

これらはいずれも**独立ソルバーとの数値的一致**を示すものであり、実機の再現性を示すものではありません。実機との比較は[実機比較](./hardware-comparison.md)を参照してください。
