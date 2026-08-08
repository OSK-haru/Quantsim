# VALIDATION-8: 実機観測量によるGate-Awareモデル外部妥当性監査

## 0. 文書状態

```text
validation_id: VALIDATION-8
short_name: V8 real-hardware observable validation
status: In progress / dataset contract frozen
target_model: gate-aware open-system model
formal_execution: blocked pending gate-aware evolution-method decision
```

本書はVALIDATION-8の監査方針を先に固定するための計画書である。
`QHAD-v1`を主datasetとして選定し、calibration / holdout分離を含むdataset
contractをfreezeした。現時点では実機データを取得せず、正式な合否判定も
行わない。

正式監査は、Pulse Baseline AおよびPulse Extension B、Rustエンジン、
CPTP-preservingな時間発展経路、既存回帰検証が完了した後に実施する。

ただし、現行のexplicit CPTP経路はPulse modeに限定され、V8の主対象である
gate-aware実行には接続されていない。したがってformal実行前に、

1. gate-aware explicit CPTPを実装する
2. validated RK4 pathをV8で許容するよう監査契約を正式改訂する

のいずれかを決定する。

---

# 1. 目的

VALIDATION-1からVALIDATION-7は、解析解、既知極限、時間刻み収束、
QuTiPとの同一条件比較によって、Yuragi-Striderの内部妥当性と数値妥当性を
監査する。

VALIDATION-8では、それらとは異なる問いを扱う。

> Yuragi-Striderのgate-aware開放系モデルは、実量子プロセッサから得られる
> 測定確率、緩和曲線、コヒーレンス減衰、回路出力を、事前に定めた誤差範囲で
> 予測できるか。

V8はQuTiPとの再比較ではない。実機または実機由来の公開データを外部参照として
使用し、モデルの外部妥当性を監査する。

---

# 2. V7との違い

## 2.1 VALIDATION-7

VALIDATION-7では、Yuragi-StriderとQuTiPに同一の

$$
\rho(0),\quad H(t),\quad L_k,\quad t_j
$$

を渡し、同じ数学的問題に対する数値解を比較する。

この比較から確認できるのは、主として次である。

- Lindblad方程式の実装
- Hamiltonianおよびcollapse operatorの規約
- 基底順序
- 時間発展ソルバー
- 数値許容誤差内での独立実装一致

## 2.2 VALIDATION-8

実機は内部密度行列や真のcollapse operatorを直接返さない。
実機から得られるのは、有限shotの測定結果と、そこから推定した観測量である。

したがってV8では、

$$
\rho_{\mathrm{sim}}(t)
\longrightarrow
p_{\mathrm{sim}}(x|t)
$$

と変換し、実機の測定頻度

$$
\hat p_{\mathrm{hw}}(x|t)
=
\frac{n_x(t)}{N_{\mathrm{shots}}}
$$

と比較する。

V8が監査するのは、同一方程式のsolver一致ではなく、モデルが外部観測を
説明または予測する能力である。

---

# 3. 正式実行の前提条件

V8の正式実行は、以下をすべて満たした後に行う。

1. Pulse Baseline Aが完了している。
2. Pulse Extension Bが完了している。
3. 本番候補のRustエンジンが実装されている。
4. Python参照経路とRust経路の結果が、固定した許容誤差内で一致している。
5. 採用する時間発展経路が、監査対象範囲でCPTP-preservingである。
6. VALIDATION-1からVALIDATION-7が再実行され、すべて合格している。
7. Pulse系の解析解、収束、QuTiP比較が再実行され、すべて合格している。
8. API、モデル規約、単位、bit order、gate durationの意味がfreezeされている。
9. 正式監査に使用するgit commitが記録されている。
10. 実験回路、shot数、評価指標、合否基準が実機結果を見る前に固定されている。

ここでいうCPTP-preservingとは、採用した離散時間発展が監査対象範囲で
完全正値かつトレース保存の写像として構成されることを意味する。
時間依存問題の厳密解そのものを保証するという意味ではない。

Rust化は計算性能と本番経路の監査であり、それ自体が物理モデルの正しさを
保証するものではない。CPTP保証も同様に数値的物理性の保証であって、
実機一致の保証ではない。外部妥当性を判定する役割はV8が担う。

---

# 4. 監査対象

## 4.1 主対象

V8の主対象は、既存のgate-aware open-system modelとする。

対象には次を含む。

- 一量子ビットの有限時間ゲート
- ゲート実行中のLindblad散逸
- 回路完了後のidleまたは観測時間
- 下向き緩和
- 上向き遷移
- 純粋位相緩和
- 一量子ビット回路
- 二量子ビットBell型回路
- 出力確率
- 必要に応じた一量子ビットまたは二量子ビット状態トモグラフィー

## 4.2 Pulseモデルとの分離

V8は、Yuragi-StriderのGaussianまたはSquare pulse波形が実機制御線上の
実波形と一致することを監査しない。

Pulse-level実機検証には、少なくとも次が必要になる。

- 任意pulseまたは低レベル制御へのアクセス
- 実機のchannel、carrier、振幅、位相、sampling intervalの規約
- 波形歪みまたはtransfer functionに関する情報
- qutrit leakageを観測できる測定
- DRAG等の実機側制御条件

これらを満たす実機または公開データが得られた場合は、
V8とは別に次の監査を立てる。

```text
PULSE-HW-1:
Hardware-facing pulse and leakage validation
```

Gate-awareモデルの実機監査とpulse波形の実機監査を、一つの合否判定へ
混在させてはならない。

---

# 5. 実機または外部データの取得方針

研究所との個人的な接点は前提にしない。

候補は次とする。

1. 個人登録可能なクラウドQPU
2. 従量課金型クラウドQPU
3. 公式に公開された実機測定データセット
4. 再現可能な論文付属データ

主dataset `QHAD-v1`のprovider候補はIBM Quantumとする。ただしdataset schemaは
provider-neutralに保ち、正式実行時に利用可能性、利用規約、費用、回路機能、
データ取得可能性を再確認する。条件を満たさない場合は、同じschemaを維持した
ままproviderを変更する。

Dataset選定と外部証拠の役割分担は次に固定する。

- `QHAD-v1`: formal calibration / holdout判定
- NPL Zenodo `10.5281/zenodo.8363718`: model-discrepancy stress
- Aalto Zenodo `10.5281/zenodo.7773981`: T1 / Ramsey / SPAM補助証拠

機械可読registry:

[`../../../validation_results/phase3b_hardware_dataset_registry.json`](../../../validation_results/phase3b_hardware_dataset_registry.json)

実行記録:

[`../../development/physical-model-finalization/phase3b-dataset-selection.md`](../../development/physical-model-finalization/phase3b-dataset-selection.md)

クラウドQPUを利用する場合、API key等の秘密情報は環境変数またはローカルの
secret storeだけで扱い、リポジトリ、JSON成果物、ログへ保存してはならない。

実機ジョブを送信する前に、次を固定する。

- 最大費用
- 最大QPU時間
- 最大job数
- 最大shot数
- timeout
- retry回数
- 中断条件

無制限retryは禁止する。

---

# 6. 二段階のパラメータ監査

V8では、数値ダイナミクスと物理入力変換を混同しない。

## 6.1 V8-A: Effective-rate validation

実機から測定または同時刻の校正値として得た

$$
T_1,\quad T_2,\quad T_\phi,\quad \Delta,\quad \tau_g
$$

を、明示的なrateへ変換して使用する。

有限温度でのpopulation relaxationは、

$$
\Gamma_1
=
\gamma_\downarrow+\gamma_\uparrow
$$

とする。

純粋位相緩和規約は、

$$
\frac{1}{T_2}
=
\frac{\Gamma_1}{2}
+
\frac{1}{T_\phi}
$$

および

$$
L_\phi
=
\sqrt{\frac{\gamma_\phi}{2}}\,\sigma_z,
\qquad
\gamma_\phi=\frac{1}{T_\phi}
$$

に固定する。

V8-Aは、測定済みの有効rateを与えたときに、gate-awareモデルが未使用の
実機観測を予測できるかを調べる。

## 6.2 V8-B: Physical-input mapping audit

温度、qubit frequency、`device_quality`、flux noise等からrateを生成する
Yuragi-Strider固有のmappingは、V8-Aとは別に評価する。

特に`device_quality`は教育用の抽象パラメータであり、実機の単一校正値と
直接同一視してはならない。

V8-BをV8全体の必須合格条件に含めるかは、外部から取得可能な物理入力と
校正情報を確認した後に決定する。情報が不足する場合は、

```text
not externally identifiable
```

として報告し、都合のよい自由フィットで合格扱いにしてはならない。

---

# 7. 監査ケース

## V8-0: 実機・時刻・compile情報のfreeze

各正式runについて、少なくとも次を保存する。

- provider
- backendまたはdevice ID
- 実行日時とtimezone
- job ID
- qubit index
- coupling map
- basis gates
- transpiled circuit
- optimization level
- gate duration
- reported frequency
- reported T1およびT2
- readout error
- gate error
- shot数
- calibration timestamp
- Yuragi-Strider commit
- Python/Rust backend ID
- model ID

API key、account token、個人決済情報は保存しない。

## V8-1: 一量子ビットT1緩和

回路は概念的に、

```text
|0> -- X -- delay(t) -- measure
```

とする。

複数のdelayで励起状態確率を測定し、

$$
P_1(t)
=
P_1(\infty)
+
\left[
P_1(0)-P_1(\infty)
\right]
e^{-\Gamma_1t}
$$

と比較する。

単にfitしたT1を同じデータへ再代入するだけでは合格としない。
一部のdelayをparameter estimationへ使い、残りをholdout予測に使用する。

## V8-2: Ramsey、T2およびdetuning

RamseyまたはRamseyXY相当の回路を使用し、次を比較する。

- 振動周波数
- detuningの符号
- envelopeの減衰
- X/Y観測量

$T_2^*$には準静的ノイズやinhomogeneous broadeningが含まれる可能性がある。
したがって、Markov型の$T_\phi$と無条件に同一視してはならない。

可能であればT2 Hahnまたは別のhomogeneous coherence指標も取得し、
どの値をYuragi-Striderの$\gamma_\phi$へ対応させたか明記する。

## V8-3: Idle中のpopulationとcoherence

初期状態として少なくとも、

```text
|0>
|1>
|+>
```

を使用し、idle時間を変化させる。

これにより、

- 下向き緩和
- 上向き遷移
- population equilibrium
- coherence decay

を分離して監査する。

## V8-4: 一量子ビットgate-aware予測

少なくとも次を含む。

- X
- X/2または実機で対応するfractional rotation
- H相当回路
- Zまたはvirtual-Z相当操作
- gate後に異なる長さのidleを付けた回路

実機のnative gateとYuragi-Striderの論理gateが同じ操作を意味するか、
transpiled circuitを監査する。

論理ゲート名が同じであることだけを根拠に、同一Hamiltonianとみなしてはならない。

## V8-5: 二量子ビットBell型回路

概念的に、

```text
H(q0)
CNOT(q0, q1)
measure(q0, q1)
```

を使用する。

比較対象は少なくとも次とする。

- 全bit stringの出力分布
- parity
- ideal Bell distributionからの距離
- Yuragi-Strider予測分布からの距離

実機ではnative entangling gateへtranspileされるため、CNOT一個という表示だけで
実機のgate durationやnoise exposureを決めてはならない。

## V8-6: 状態トモグラフィー

利用可能な場合、一量子ビットおよび小規模二量子ビット状態について、
tomographically completeな測定から密度行列を推定する。

比較指標は、

$$
F(\rho_{\mathrm{sim}},\rho_{\mathrm{hw}})
$$

および

$$
D(\rho_{\mathrm{sim}},\rho_{\mathrm{hw}})
=
\frac{1}{2}
\left\|
\rho_{\mathrm{sim}}-\rho_{\mathrm{hw}}
\right\|_1
$$

とする。

トモグラフィー結果は真の密度行列そのものではなく、有限shotと再構成法に依存する
推定値である。再構成法、物理性制約、bootstrap方法を記録する。

## V8-7: Holdout予測

V8の中心的な合否判定はholdout予測で行う。

calibration subsetで推定したパラメータを固定した後、次のいずれかを
未使用条件として予測する。

- 未使用のdelay
- 未使用の初期状態
- 未使用のgate sequence length
- 未使用の回路
- 別の実行時刻

実機結果を見た後にパラメータを再調整した場合、その結果はexploratory analysisへ
降格し、formal holdout passとして扱わない。

---

# 8. SPAMとreadout error

実機比較では、state preparation and measurement errorを無視してはならない。

少なくとも次の二種類を保存する。

1. raw measured distribution
2. readout mitigation後のdistribution

Yuragi-Striderの状態発展と比較する主対象は、原則としてmitigation後の推定値とする。
ただし、raw結果も必ず残し、補正によって不一致が隠れていないか監査する。

必要に応じて、Yuragi-Striderの最終確率へ独立したmeasurement confusion matrixを
作用させ、raw hardware distributionとの比較も行う。

状態発展ノイズと測定ノイズを一つのrateへ吸収してはならない。

---

# 9. 統計設計

## 9.1 Shot noise

二値測定の標準誤差は概ね、

$$
\operatorname{SE}(\hat p)
=
\sqrt{
\frac{\hat p(1-\hat p)}{N_{\mathrm{shots}}}
}
$$

で評価できる。

正式評価では、境界付近も扱えるbinomial confidence intervalまたはbootstrapを
使用する。単一の点推定だけで合否判定しない。

## 9.2 分布比較

少なくとも次から適切な指標を事前選択する。

- total variation distance
- Hellinger distanceまたはHellinger fidelity
- negative log likelihood
- Pearson residualまたはdeviance
- density matrix fidelity
- trace distance

複数指標を計算してもよいが、primary endpointは実機結果を見る前に固定する。

## 9.3 Drift

実機校正値は時間変動する。

可能であれば、

- calibration circuit
- target circuit
- calibration circuit

の順に実行し、実験区間内のdriftを監査する。

異なる日または異なるcalibration cycleのデータを無条件に結合してはならない。

正式監査では、可能な範囲で複数sessionを使用し、単一sessionへの過学習を避ける。

---

# 10. 合否基準の決定方法

最終的な数値閾値は、実機結果を見る前に固定する。

ただし、provider、shot数、readout error、利用可能な回路によって統計精度が
変わるため、本計画段階では一律の数値を確定しない。

正式実行前に、次を含むpre-registration sectionを作成する。

```text
primary endpoint
secondary endpoints
shot count
confidence level
calibration subset
holdout subset
maximum accepted predictive error
minimum improvement over ideal/no-noise baseline
handling of failed jobs
handling of hardware drift
multiple-comparison policy
```

合格には少なくとも次を要求する。

1. V8-0のprovenanceが完全である。
2. calibration subsetとholdout subsetが分離されている。
3. holdoutのprimary endpointが事前閾値内である。
4. Yuragi-Strider予測が、少なくとも対象ケースでideal/no-noise baselineより改善する。
5. raw結果とmitigated結果の両方が保存されている。
6. 実機driftが結果を無効化する水準でない。
7. 不合格ケースが削除されず、理由とともに保存されている。
8. 閾値変更がある場合、旧値、新値、理由、影響範囲が記録されている。

pilot runは正式閾値の設計に利用してよいが、同じデータをformal holdoutへ
再利用してはならない。

---

# 11. 比較baseline

V8では、Yuragi-Striderだけを単独評価せず、少なくとも次と比較する。

1. ideal/no-noise circuit prediction
2. Yuragi-Strider gate-aware prediction
3. 必要に応じて単純なgate depolarizing model
4. hardware measurement

Yuragi-Striderが複雑であること自体を価値とみなさない。
単純baselineと同等または劣る場合は、その事実を報告する。

---

# 12. 不一致の分類

V8で不一致が見つかった場合、直ちにrateを再fitして解消してはならない。

不一致を次に分類する。

| 分類 | 例 |
|---|---|
| Numerical | Rust/Python差、時間刻み、CPTP経路、精度不足 |
| Convention | bit order、detuning符号、単位、gate duration |
| Compilation | native gate分解、layout、routing、追加gate |
| SPAM | preparation error、readout error、mitigation誤差 |
| Drift | T1/T2、frequency、gate errorの時間変動 |
| Model-form | non-Markovian noise、leakage、crosstalk、coherent error |
| Parameter mapping | temperature、device_quality、flux noiseからrateへの変換 |
| Data quality | shot不足、failed job、欠損metadata |

model-form discrepancyが示唆された場合、V8の結果を変更して合格させるのではなく、
新しいモデル候補と追加監査を別タスクとして立てる。

---

# 13. 成果物

正式実行時は、少なくとも次を作成する。

```text
scripts/
  validate_real_hardware_gate_model.py

tests/
  test_validation_real_hardware_contract.py

validation_results/
  validation8_real_hardware_gate_model.json
  validation8_real_hardware_gate_model.csv
  validation8_t1_holdout.png
  validation8_ramsey_holdout.png
  validation8_gate_distributions.png
  validation8_bell_distribution.png
  validation8_tomography.png

docs/validation/
  validation-8-real-hardware-observable-validation.md
```

raw shot countsは、providerの利用規約とデータ保持条件を確認したうえで、
個人情報やsecretを含まない形式で保存する。

JSONには少なくとも次を含める。

```text
validation_id
base_git_commit
model_id
backend_engine_id
python_version
rust_version
provider
device_id
job_ids
execution_timestamps
calibration_timestamps
compiled_circuits
qubit_mapping
shot_counts
parameter_sources
step_policy
CPTP_policy
SPAM_policy
pre_registered_thresholds
calibration_results
holdout_results
drift_audit
pass_fail
scope_and_limitations
```

---

# 14. V8で主張できること

合格した場合、次のように限定して主張できる。

> 固定した実機、qubit、校正時刻、回路群、shot数、評価指標の範囲で、
> Yuragi-Striderのgate-aware open-system modelは、未使用条件の実機観測量を
> 事前に定めた誤差範囲で予測した。

---

# 15. V8で主張してはいけないこと

V8が合格しても、次は主張しない。

- すべての量子コンピュータで精度が保証される
- 実機内部の真の密度行列を直接観測した
- collapse operatorが実機の微視的機構を一意に表す
- Yuragi-Striderのpulse波形が実機pulseと一致する
- non-Markovian noiseを再現している
- qutrit leakageやcrosstalkを再現している
- 特定メーカーの校正用シミュレーターになった
- 将来時刻のhardware性能を保証できる

---

# 16. 実行順序

```text
Protocol definition                 COMPLETE
  |
Pulse Baseline A completion
  |
Pulse Extension B completion
  |
Rust engine implementation
  |
Python/Rust parity audit
  |
CPTP-preserving evolution audit
  |
V1-V7 and pulse regression rerun
  |
Model/API/commit freeze
  |
Dataset contract freeze             COMPLETE
  |
Gate-aware evolution-method decision <- current stage
  |
Provider-neutral pilot
  |
Pre-registration freeze
  |
Formal V8 hardware runs
  |
Independent report and limitation audit
```

pilot結果を見た後に正式プロトコルを修正した場合は、修正履歴を残し、
pilotとformal datasetを分離する。

---

# 17. 実行前チェックリスト

- [x] Pulse Baseline Aが完了している
- [x] Pulse Extension Bが完了している
- [x] Rust本番候補経路が実装されている
- [x] Python/Rust parityが確認されている
- [ ] Gate-aware監査で使用するevolution methodが決定している
- [ ] Gate-aware対象範囲でCPTP-preserving経路が確認されている、またはV8契約が正式改訂されている
- [ ] VALIDATION-1からVALIDATION-7が再合格している
- [ ] Pulse解析解・収束・QuTiP比較が再合格している
- [ ] model IDとcommitがfreezeされている
- [ ] providerとdeviceが記録されている
- [ ] 費用、QPU時間、retry、timeoutが固定されている
- [x] calibration case IDとholdout case IDがdataset contractで分離されている
- [ ] primary endpointと合否閾値が固定されている
- [ ] transpiled circuitを保存する
- [ ] calibration timestampを保存する
- [ ] rawとmitigated結果を両方保存する
- [ ] secretが成果物へ入らないことを確認する
- [ ] Pulse実機検証と混同していない

---

# 18. 参考情報

正式実行時には、利用するproviderの最新公式文書を再確認する。

- IBM Quantum access plans:
  <https://quantum.cloud.ibm.com/docs/en/guides/plans-overview>
- Qiskit Experiments:
  <https://qiskit-community.github.io/qiskit-experiments/>
- Qiskit Experiments manuals:
  <https://qiskit-community.github.io/qiskit-experiments/manuals/>
- RamseyXY:
  <https://qiskit-community.github.io/qiskit-experiments/stubs/qiskit_experiments.library.characterization.RamseyXY.html>
- Amazon Braket documentation:
  <https://docs.aws.amazon.com/braket/>

サービス内容、無料枠、API、pulse accessは変更される可能性があるため、
本計画書の記述だけを根拠にせず、正式実行時点の公式情報を使用する。

---

# 19. 現時点の決定

1. VALIDATION-8は新しい独立監査として立てる。
2. 対象はgate-aware open-system modelの外部妥当性とする。
3. QuTiP比較の延長ではなく、実機観測量との予測比較とする。
4. 主datasetは`QHAD-v1`、外部stress datasetはNPL、補助datasetはAaltoとする。
5. 正式実行はPulse A/B、Rust parity、gate-aware evolution-method決定、全回帰後とする。
6. 現時点ではdataset contractまでをfreezeし、実機jobは送信しない。
7. Pulse-level実機監査はV8から分離する。
