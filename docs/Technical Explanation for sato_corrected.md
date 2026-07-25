# QuantaScope 技術説明（監査修正版）

> **Scope update**
>
> This audited explanation covers the gate-aware model and V1-V7. Pulse
> Baseline A was added later as a separate endpoint and model; see
> `docs/physics/pulse-baseline-a-model.md` and
> `docs/validation/pulse-baseline-a-report.md`. The gate-aware statements in
> this document remain applicable to their stated scope.

## 0. 文書の位置づけ

本書は、QuantaScope の現行コード、実行環境、物理量の定義、数値検証 V1〜V7 を対応付けた技術説明である。監査対象の原文は提出項目のチェックリストであり、定義への回答や検証結果が未記入だったため、本書で現行実装に基づく回答を補完した。

QuantaScope は、小規模量子回路に対する環境効果を理解するための教育用・比較用シミュレータである。特定実機に校正された予測器ではなく、弱結合・Markov 近似・二準位近似に基づく現象論的モデルである。

## 1. 実際に動くコードと実行環境

現行の計算経路は次のとおりである。

```text
React UI
  -> POST /api/simulate
  -> EnvironmentConfig / CircuitConfig
  -> 物理入力から散逸率を計算
  -> 回路列から有限時間 Hamiltonian を構築
  -> Lindblad 方程式を密度行列で時間積分
  -> SimulationResponse
```

主要実装は以下にある。

| 役割 | 実装 |
|---|---|
| API 入力と simulation 起動 | `api/main.py` |
| 物理入力から散逸率への変換 | `core/physical_environment.py` |
| gate、Hamiltonian、collapse operator | `core/gates.py` |
| gate-aware 時間発展と RK4 policy | `core/simulator.py` |
| NumPy dense kernel | `core/dense_numpy.py` |
| React の物理入力欄 | `frontend/src/components/ParameterPanel.tsx` |

VALIDATION-7 実行時に記録された環境は次のとおりである。

| 項目 | 記録値 |
|---|---|
| OS | Windows 11 |
| Python | 3.14.4 |
| NumPy | 2.4.4 |
| SciPy | 1.17.1 |
| QuTiP | 5.2.3 |
| 検証対象 backend | Python dense / NumPy RK4 |
| 検証時 Git commit | `8b98eb43284d4fb518b9015455a168d47e4af053` |

環境は更新され得るため、再提出時には `validation_results/validation7_qutip_comparison.json` の記録を再生成して確認する。

## 2. 採用している物理モデル

密度演算子 \(\rho\) を、次の GKSL/Lindblad 型マスター方程式で時間発展させる。

$$
\frac{d\rho}{dt}
=-i[H,\rho]
+\sum_j\left(
L_j\rho L_j^\dagger
-\frac12\{L_j^\dagger L_j,\rho\}
\right).
$$

ここでコード上の \(H\) はエネルギー [J] ではなく、\(\hbar=1\) とした角周波数 generator である。時間を \(\mu\mathrm{s}\) で扱うため、数値単位は \(\mathrm{rad}/\mu\mathrm{s}\)（次元としては \(1/\mu\mathrm{s}\)）である。したがって時間発展項に明示的な \(1/\hbar\) はない。

### 2.1 有限時間 gate Hamiltonian

第 \(k\) 列の unitary を \(U_k\)、列の実行時間を \(\tau_k\) とする。現行の involutory gate では、

$$
H_k=\frac{\pi}{2\tau_k}(I-U_k)
$$

を使う。このとき、

$$
e^{-iH_k\tau_k}=U_k
$$

が成立する。各列は piecewise-constant segment として順番に解かれ、その実行中にも散逸が作用する。実装は `core/gates.py::effective_hamiltonian_from_involution` にある。

この方式は現在の \(H,X,Z,\mathrm{CNOT}\) のような Hermitian involution を対象とする。任意角回転やパルス波形を一般に再現する方式ではない。

### 2.2 熱占有数と有限温度の遷移率

UI の qubit frequency は通常周波数 \(f_q\) [GHz] であり、角周波数 \(\omega_q\) ではない。コードは

$$
\bar n_{\mathrm{th}}
=\frac{1}{\exp\!\left(\frac{h f_q}{k_{\mathrm B}T}\right)-1}
$$

を使う。これは \(\hbar\omega_q=h f_q\) を用いれば角周波数表記と同値である。

ゼロ温度の基準遷移率を

$$
\gamma_0=\frac{1}{T_{1,0}}
$$

とし、有限温度では

$$
\gamma_\downarrow=\gamma_0(\bar n_{\mathrm{th}}+1),
\qquad
\gamma_\uparrow=\gamma_0\bar n_{\mathrm{th}}
$$

とする。

### 2.3 有限温度での \(T_1\) の定義

現行コードで population が平衡値へ近づく速度は、

$$
\Gamma_1=\gamma_\downarrow+\gamma_\uparrow
$$

である。したがって有効な population relaxation time は、

$$
T_{1,\mathrm{eff}}
=\frac{1}{\gamma_\downarrow+\gamma_\uparrow}
$$

である。\(1/\gamma_\downarrow\) は downward jump 単独の時定数であり、有限温度での population relaxation time とは区別する。\(T=0\) では \(\gamma_\uparrow=0\) なので両者は一致する。

### 2.4 純粋位相緩和の規約

現行コードは、

$$
L_\phi=\sqrt{\frac{\gamma_\phi}{2}}\,\sigma_z
$$

を採用する。この規約では、Hamiltonian と population relaxation がない場合、

$$
\rho_{01}(t)=\rho_{01}(0)e^{-\gamma_\phi t}
$$

となる。\(L_\phi=\sqrt{\gamma_\phi}\sigma_z\) と書く別規約では coherence decay rate が \(2\gamma_\phi\) になるため、本書とコードでは混在させない。

### 2.5 Collapse operators

各 qubit について、実際に solver へ渡す行列は次である。

$$
L_\downarrow=\sqrt{\gamma_\downarrow}\,\sigma_-,
\qquad
L_\uparrow=\sqrt{\gamma_\uparrow}\,\sigma_+,
\qquad
L_\phi=\sqrt{\frac{\gamma_\phi}{2}}\,\sigma_z.
$$

QuTiP 比較では温度や device quality を QuTiP に直接渡していない。QuantaScope が生成した同一の \(H,\rho_0,L_j,t_k\) を QuantaScope solver と QuTiP `mesolve` の双方へ渡している。これは数値積分器の比較として適切だが、入力から rate への変換を QuTiP が独立検証したことを意味しない。

## 3. UI 入力、定義、単位、実装の対応

| UI 入力 | 内部名 | 単位 | 現行実装での意味 | 主な実装 |
|---|---|---:|---|---|
| デバイス品質 | `device_quality` | 0〜1 | 教育用 profile の最小・最大 coherence time 間を対数補間する抽象値 | `compute_device_quality_times` |
| 温度 | `temperature_mk` | mK | K に変換し、Bose 熱占有数を計算 | `compute_thermal_occupation` |
| 磁束ノイズ | `flux_noise_phi0` | \(\Phi_0\) | profile の基準値に対して追加 \(\gamma_{\phi,\mathrm{flux}}\) を線形評価 | `_compute_rates_from_physical_inputs` |
| qubit frequency | `qubit_frequency_ghz` | GHz | \(h f_q/(k_BT)\) を通じて熱占有数へ作用 | `compute_thermal_occupation` |
| 最大 \(T_1\) | `t1_max_us` | \(\mu\mathrm{s}\) | device-quality profile の上限。入力値そのものが常に実効 \(T_1\) になるわけではない | `_profile_from_environment` |
| 最大 \(T_\phi\) | `tphi_max_us` | \(\mu\mathrm{s}\) | device-quality profile の上限。flux dephasing を加える前の基準 | `_profile_from_environment` |
| 総 simulation 時間 | `duration_us` | \(\mu\mathrm{s}\) | gate 動作時間と回路完了後の idle/観測時間を含む | `SimulationConfig` / scheduler |
| 時間ステップ数 | `time_steps` | 個 | 主に出力 snapshot grid を決める。内部 RK4 substep は別 policy により追加され得る | `core/simulator.py` |
| fidelity threshold | `fidelity_threshold` | 0〜1 | usable lifetime 判定用の表示・評価 threshold | result calculation |
| gate duration | gate `duration_us` | \(\mu\mathrm{s}\) | 各 gate/column の有限操作時間と \(H_k\) の強さを決める | `core/gates.py` |

### 3.1 Device quality から基準時定数への変換

device quality を \(q\in[0,1]\) とすると、

$$
T_{1,0}=T_{1,\min}
\left(\frac{T_{1,\max}}{T_{1,\min}}\right)^q,
$$

$$
T_{\phi,0}=T_{\phi,\min}
\left(\frac{T_{\phi,\max}}{T_{\phi,\min}}\right)^q.
$$

既定 profile は \(T_{1,\min}=T_{\phi,\min}=1\,\mu\mathrm{s}\)、上限の既定値は \(100\,\mu\mathrm{s}\) である。これは特定実機から校正された経験式ではなく、教育用 profile である。

### 3.2 位相緩和率と \(T_2\)

基準純粋位相緩和率と flux-noise 寄与を、

$$
\gamma_{\phi,\mathrm{base}}=\frac{1}{T_{\phi,0}},
$$

$$
\gamma_{\phi,\mathrm{flux}}
=0.05\,\mu\mathrm{s}^{-1}
\frac{\mathrm{flux\ noise}}{10^{-5}\Phi_0}
$$

として、

$$
\gamma_\phi
=\gamma_{\phi,\mathrm{base}}+\gamma_{\phi,\mathrm{flux}}
$$

とする。実効時定数は、

$$
T_{\phi,\mathrm{eff}}=\frac{1}{\gamma_\phi},
$$

$$
\frac{1}{T_{2,\mathrm{eff}}}
=\frac12(\gamma_\downarrow+\gamma_\uparrow)+\gamma_\phi
$$

である。UI は \(T_2\) を直接入力させず、計算結果として導出する。

## 4. V1〜V7 の検証結果

| 検証 | 検査対象 | 結果 | この検証だけでは保証しないこと |
|---|---|---|---|
| V1 | 散逸ゼロで有限時間 gate が直接 unitary reference と一致するか | V1-1〜V1-8 PASS | 散逸モデルの正しさ |
| V2 | \(T=0\) で \(\bar n_{\mathrm{th}}=0\)、\(\gamma_\uparrow=0\) か | 全ケース PASS | 有限温度 profile の実機校正 |
| V3 | \(|1\rangle\) が \(e^{-\gamma_\downarrow t}\) で減衰するか | 全ケース PASS | 有限温度平衡 |
| V4 | 純粋位相緩和で population が一定、coherence が \(e^{-\gamma_\phi t}\) で減衰するか | 全ケース PASS | population relaxation との複合全条件 |
| V5 | 有限温度で \(P_1^{\mathrm{eq}}=\gamma_\uparrow/(\gamma_\downarrow+\gamma_\uparrow)\) へ近づくか | 全ケース PASS | 非 Markov 熱浴 |
| V6 | 内部 RK4 刻みを細分化したときに結果が収束するか | V6-1〜V6-5 PASS、観測次数は概ね 4 | 任意 step での CPTP 保証 |
| V7 | 同一の \(H,\rho_0,L_j,t_k\) で QuTiP `mesolve` と一致するか | V7-0〜V7-6 PASS、最大要素差 \(2.10\times10^{-10}\) 以下 | rate 変換や gate 行列の独立再導出 |

V1〜V7 は相補的である。V7 は solver の独立比較だが前処理行列を共有するため、V1〜V5 の解析解・直接 unitary 比較と組み合わせて評価する必要がある。V6 は「数値精度の型を変更した」検証ではなく、同じ RK4 法の内部時間刻みを系統的に細分化した収束検証である。

詳細と生データは以下にある。

- `docs/validation/validation-1-zero-dissipation-unitary-limit.md`
- `docs/validation/validation-2-zero-temperature-thermal-excitation.md`
- `docs/validation/validation-3-excited-state-exponential-decay.md`
- `docs/validation/validation-4-pure-dephasing.md`
- `docs/validation/validation-5-finite-temperature-equilibrium.md`
- `docs/validation/validation-6-time-step-convergence.md`
- `docs/validation/validation-7-qutip-comparison.md`
- `validation_results/validation1_*` 〜 `validation_results/validation7_*`

## 5. 図の分類

提出時には各図の caption に、次のいずれかを明記する。

| 分類 | 意味 | 例 |
|---|---|---|
| 概念図 | 理論、構成、情報の流れを説明する模式図。数値結果ではない | Lindblad 計算フロー、UI と core の関係 |
| UI モック | 画面設計案または画面 capture。物理計算結果の証拠ではない | Circuit Studio のレイアウト案 |
| 実際の計算結果 | validation script が保存した数値から描画した図 | `validation_results/validation6_time_step_convergence.png`、`validation7_qutip_comparison.png` |

matplotlib で validation JSON/CSV から生成したグラフは「実際の計算結果」であり、生成AIによる概念画像とは区別する。

## 6. 生成AIの利用範囲

本プロジェクトでは生成AIを、コード調査、検証計画、テスト・script の実装補助、文書の整理と表現改善に利用した。数値グラフは生成AI画像ではなく、実行した validation script が実データから生成したものである。

生成AIの出力はそれ自体を検証根拠とはせず、次の方法で監査した。

- 実装箇所をコード上で確認した。
- 解析解、直接 unitary reference、時間刻み収束、QuTiP との比較を自動テスト化した。
- JSON/CSV に入力、環境、許容誤差、実測値を保存した。
- 全 regression test と frontend build を実行した。

画像生成AIを概念図または UI モックに使用した場合は、該当する図ごとに別途明記する必要がある。本監査では、その利用履歴までは確認していない。

## 7. 適用範囲と限界

本検証から主張できるのは、現行の教育用モデルが、定義した GKSL/Lindblad 方程式と rate 規約に従って数値的に一貫して動作することである。

次は証明していない。

- 特定メーカー・特定実機に対する定量予測精度
- device quality や flux noise mapping の実験校正
- 強結合、非 Markov 過程、環境記憶
- 漏れ準位、パルス波形、実機固有クロストーク
- 任意回路・任意時間刻みにおける完全正値性の一般証明
- QuTiP が温度から rate への変換を独立に確認したこと

したがって、結果は「指定した教育用仮定のもとでの比較・理解」に使用し、実機性能の保証値として扱わない。

## 8. 参考資料

- G. Lindblad, “On the Generators of Quantum Dynamical Semigroups,” *Communications in Mathematical Physics* 48, 119–130 (1976).
- V. Gorini, A. Kossakowski, and E. C. G. Sudarshan, “Completely Positive Dynamical Semigroups of N-Level Systems,” *Journal of Mathematical Physics* 17, 821 (1976).
- H.-P. Breuer and F. Petruccione, *The Theory of Open Quantum Systems*, Oxford University Press (2002).
- M. A. Nielsen and I. L. Chuang, *Quantum Computation and Quantum Information*, Cambridge University Press.
- QuTiP documentation, “Lindblad Master Equation Solver” and `mesolve` solver options.
- `docs/physics/model_identity.md`
- `docs/validation/validation-1-zero-dissipation-unitary-limit.md` 〜 `validation-7-qutip-comparison.md`

## 9. 監査で修正した表現

| 原文の状態 | 修正内容 |
|---|---|
| 提出項目の列挙だけで回答がない | 定義、単位、実装、検証結果を本文として追加 |
| `(T_1)` などが Markdown 数式になっていない | \(T_1\) の数式表記へ統一 |
| 有限温度 \(T_1\) の二つの候補が未解決 | \(T_{1,\mathrm{eff}}=1/(\gamma_\downarrow+\gamma_\uparrow)\) と確定 |
| 純粋位相緩和 operator の候補が未解決 | \(L_\phi=\sqrt{\gamma_\phi/2}\sigma_z\) と確定 |
| Hamiltonian の単位が未解決 | \(\hbar=1\) の角周波数 generator、数値単位 \(1/\mu\mathrm{s}\) と確定 |
| 「数値精度を変える」と記載 | V6 の実態に合わせ「内部 RK4 刻みを細分化」へ修正 |
| 「QuTiP と同じ条件」の範囲が曖昧 | 同一の \(H,\rho_0,L_j,t_k\) に対する solver 比較と限定 |
| \(T_2\) が入力値に見える可能性 | \(T_2\) は直接入力ではなく導出値と明記 |
