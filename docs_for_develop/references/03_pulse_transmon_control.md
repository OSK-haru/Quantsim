# Pulse・transmon・qutrit・DRAG

## 対象

この文書は、two-level rotating-frame Pulse model、transmonの弱非調和性、
三準位打ち切り、leakage、およびDRAG controlの根拠を扱う。

## 1. Koch et al.

**区分:** `MODEL BASIS`

J. Koch et al., "Charge-insensitive qubit design derived from the Cooper pair
box," *Physical Review A* 76, 042319 (2007).
[DOI: 10.1103/PhysRevA.76.042319](https://doi.org/10.1103/PhysRevA.76.042319)

### 文献の内容

transmonをJosephson energyとcharging energyの比が大きい弱非調和oscillator
として導出し、charge dispersionとanharmonicityのtrade-offを示す。

### QuantaScopeで使用した内容

- transmonを完全な二準位系ではなく弱非調和多準位系として扱う。
- 最低三準位`|0>, |1>, |2>`を保持してleakageを表示する。
- `alpha = omega_12 - omega_01`を負のanharmonicityとして扱う。
- ladder operatorによる隣接準位driveを用いる。

### 使用箇所

- `core/pulse_qutrit_contract.py`
- `core/pulse_qutrit.py`
- `core/pulse_qutrit_open_system.py`
- `docs/physics/pulse-extension-b-qutrit-model.md`

### この文献だけでは支えないもの

- 任意の強driveで三準位打ち切りが十分であること
- QuantaScopeのdefault anharmonicity
- 特定chipのmatrix elementsや周波数
- RWA外のBloch-Siegert shiftやlaboratory-frame carrier

## 2. Motzoi et al.

**区分:** `MODEL BASIS`

F. Motzoi, J. M. Gambetta, P. Rebentrost, and F. K. Wilhelm,
"Simple pulses for elimination of leakage in weakly nonlinear qubits,"
*Physical Review Letters* 103, 110501 (2009).
[DOI: 10.1103/PhysRevLett.103.110501](https://doi.org/10.1103/PhysRevLett.103.110501)

### 文献の内容

弱非調和qubitで短いcontrol pulseがleakage準位を励起する問題に対し、
主quadratureの時間微分に比例する補助quadratureを加えてleakageを抑える
DRAGの基本構成を示す。

### QuantaScopeで使用した内容

$$
\Omega_y(t)
=
\beta\frac{d\Omega_x(t)}{dt}
$$

というGaussian derivative quadratureを実装した。

### 使用箇所

- `core/pulse_envelopes.py`
- `core/pulse_qutrit.py`
- `validation_pulse/qutrit_drag.py`
- `docs/validation/pulse-b-drag.md`

### この文献だけでは支えないもの

- QuantaScopeの固定`beta`が任意の実機で最適であること
- transfer function、IQ imbalance、mixer distortion
- Gaussian pulse以外への現行DRAG実装

## 3. Gambetta et al.

**区分:** `MODEL BASIS`

J. M. Gambetta, F. Motzoi, S. T. Merkel, and F. K. Wilhelm,
"Analytic control methods for high-fidelity unitary operations in a weakly
nonlinear oscillator," *Physical Review A* 83, 012308 (2011).
[DOI: 10.1103/PhysRevA.83.012308](https://doi.org/10.1103/PhysRevA.83.012308)

### 文献の内容

弱非調和oscillatorに対するadiabatic expansionから、DRAGを含む解析的な
control correctionの族を導く。

### QuantaScopeで使用した内容

- DRAGを単なるUI上の補助波形ではなく、leakage抑制の制御モデルとして扱う。
- leakageだけでなくtarget fidelityとphase errorも同時評価する。
- `beta` sweepを最適化ではなく比較実験として表示する。

### 使用箇所

- `validation_pulse/qutrit_drag.py`
- `validation_results/pulse_b_drag.json`
- `docs/validation/pulse-b-drag.md`
- `frontend/src/pages/PulseLabPage.tsx`

### この文献だけでは支えないもの

- QuantaScopeが全てのanalytic correction termを実装していること
- hardware-calibrated DRAG
- multi-qubit cross-resonance pulse

## 4. Rotating frame / RWAの位置づけ

**区分:** `PROJECT DECISION` + `MODEL BASIS`

QuantaScopeのtwo-level Pulse Hamiltonianは、

$$
H_{\mathrm{rot}}(t)
=
\frac{\Delta}{2}\sigma_z
+
\frac{\Omega(t)}{2}
\left(
\cos\phi\,\sigma_x+\sin\phi\,\sigma_y
\right)
$$

を使用する。qutritでは、

$$
H(t)
=
-\Delta n
+
\frac{\alpha}{2}n(n-1)
+
\frac{\Omega_x(t)}{2}(a+a^\dagger)
+
\frac{\Omega_y(t)}{2}[-i(a-a^\dagger)]
$$

を使用する。

Koch、Motzoi、Gambetta各論文は弱非調和transmonとcontrolの物理的背景を
支える。一方、次はQuantaScopeがfreezeした規約である。

```text
frame: rotating
approximation: RWA
detuning: Delta = omega_d - omega_q
time unit: us
Hamiltonian unit: rad/us
basis order: |0>, |1>, |2>
```

### 使用箇所

- `core/pulse_contract.py`
- `core/pulse_qutrit_contract.py`
- `docs/physics/model_identity.md`
- `validation_results/pulse_baseline_a_freeze.json`
- `validation_results/pulse_extension_b_freeze.json`
