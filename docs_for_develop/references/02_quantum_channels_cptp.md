# 量子チャネル・CPTP・Choi監査

## 対象

この文書は、Kraus表現、完全正値性、trace preservation、Choi行列、
measurement instrument、およびexplicit CPTP pathの根拠を扱う。

## 1. Kraus

**区分:** `FOUNDATIONAL`

K. Kraus, "General state changes in quantum theory,"
*Annals of Physics* 64, 311-335 (1971).
[DOI: 10.1016/0003-4916(71)90108-4](https://doi.org/10.1016/0003-4916%2871%2990108-4)

### 文献の内容

密度演算子に対する一般的な量子操作を線形写像として扱い、演算子和表現の
基礎を与える。

### QuantaScopeで使用した内容

$$
\mathcal E(\rho)
=
\sum_k K_k\rho K_k^\dagger
$$

$$
\sum_k K_k^\dagger K_k=I
$$

を、明示的qubit/qutrit channelの構成とtrace-preservation検査に使用した。

### 使用箇所

- `core/cptp.py`
- `core/cptp_qutrit.py`
- `tests/test_cptp_qubit_channels.py`
- `tests/test_cptp_qutrit_channels.py`
- `tests/test_cptp_composition.py`

### この文献だけでは支えないもの

- QuantaScopeが選んだ各channelのパラメータ値
- 連続GKSL発展と複数Kraus channelのoperator splittingが厳密に同一であること
- resetやmeasurementを連続散逸へ混ぜる設計

## 2. Choi

**区分:** `FOUNDATIONAL`

M.-D. Choi, "Completely positive linear maps on complex matrices,"
*Linear Algebra and its Applications* 10, 285-290 (1975).
[DOI: 10.1016/0024-3795(75)90075-0](https://doi.org/10.1016/0024-3795%2875%2990075-0)

### 文献の内容

有限次元線形写像の完全正値性を、対応するblock matrixの正半定値性によって
判定できることを示す。

### QuantaScopeで使用した内容

$$
J(\mathcal E)
=
\sum_{i,j}|i\rangle\langle j|
\otimes
\mathcal E(|i\rangle\langle j|)
$$

の最小固有値からcomplete positivityを監査する。

### 使用箇所

- `core/cptp.py`
- `core/cptp_liouvillian.py`
- `core/cptp_piecewise.py`
- `core/cptp_rust.py`
- `tests/test_cptp_choi_audit.py`
- `validation_results/cptp_model_freeze.json`

### QuantaScopeで固定した追加規約

```text
choi_convention_id: unnormalized_input_output_row_major_v1
normalization: unnormalized
basis order: input tensor output
Tr(J) = d for trace-preserving maps
```

Choi論文は完全正値性の判定を支えるが、上記の配列順序や正規化方式そのものは
QuantaScopeが相互運用のために固定した実装規約である。

## 3. GKS/Lindblad semigroupから有限時間channelへ

**区分:** `MODEL BASIS`

参照:

- [Gorini-Kossakowski-Sudarshan (1976)](https://doi.org/10.1063/1.522979)
- [Lindblad (1976)](https://doi.org/10.1007/BF01608499)

### QuantaScopeで使用した内容

時間一定GKSL generatorに対して、

$$
\mathcal E_{\Delta t}
=
\exp(\Delta t\mathcal L)
$$

を構成する。非負rateを持つ有限次元GKSL generatorの指数写像を、
各intervalのCPTP mapとして扱う。

時間依存Pulseでは、

$$
\mathcal E(T)
\approx
\mathcal E_N\circ\cdots\circ\mathcal E_1
$$

とし、各区間の中点でHamiltonianを固定する。

### 使用箇所

- `core/cptp_liouvillian.py`
- `core/cptp_piecewise.py`
- `core/cptp_evolution.py`
- `core/cptp_rust.py`

### 主張境界

- 各区間mapとその合成のCPTP性はChoi監査する。
- 中点固定近似が連続時間解と一致する精度はstep refinementで別に検証する。
- CPTP性と時間離散化誤差の小ささは同じ主張ではない。

## 4. Gate-aware CPTPへ使用する方針

**区分:** `PROJECT DECISION`

今後のGate-aware CPTPでは、次を区別する。

1. 有限時間gate columnのGKSL exponential map
2. idle/environment map
3. reset・measurement等の離散event
4. column順序に従うchannel composition

Gate-aware Hamiltonianとcollapse operatorsを同じLiouvillianへ入れる区間では、
個別channelを任意順に分割せず、原則としてgenerator全体の指数写像を構成する。

この方針はGKSL、Kraus、Choiの理論と整合するが、具体的なcolumn semantics、
measurement timing、zero-duration gateの扱いはQuantaScope固有のcontractとして
別途freezeする必要がある。
