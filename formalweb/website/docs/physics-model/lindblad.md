---
title: Lindblad方程式
sidebar_position: 4
---

# Lindblad方程式

Yuragi-Striderの時間発展は、開放量子系の標準的な記述であるGKSL(Gorini–Kossakowski–Sudarshan–Lindblad)方程式に従います。

## 方程式の形

密度行列 $\rho$ の時間発展は次式で与えられます。

$$
\frac{d\rho}{dt}
= -\frac{i}{\hbar}\left[H(t), \rho\right]
+ \sum_k \left(
L_k \rho L_k^\dagger
- \frac{1}{2}\left\{L_k^\dagger L_k, \rho\right\}
\right)
$$

第1項が制御(コヒーレントな発展)、第2項が環境との相互作用による散逸を表します。

実装では $\hbar = 1$ の単位系を採用し、ハミルトニアンは rad·μs⁻¹、レートは μs⁻¹ で扱います。

## 時間区間ごとの定数化

Yuragi-Striderは回路を**時間区間の列**に分解し、各区間内でハミルトニアンを定数として扱います。

```text
回路 → ゲート列 → 時間区間の列 → 各区間で H_k を構成 → 積分
```

Gate-awareモデルでは1つのゲート列(column)または待機区間が1区間に対応します。Pulse-levelモデルでは、時間依存の包絡線を中点区分定数近似で区間に分割します。

散逸子 $L_k$ は回路全体を通じて一定です(環境パラメータが時間変化しないため)。

## 有効ハミルトニアンの構成

Gate-awareモデルでは、ゲートのユニタリ行列 $U_k$ と所要時間 $\tau_k$ から、その区間の有効ハミルトニアン $H_k$ を逆算します。満たすべき条件は次式です。

$$
e^{-i H_k \tau_k} = U_k
$$

実装にはこれを解く2つの経路があります。

### 対合(involution)経路

$U^\dagger \approx U$ かつ $U^2 \approx I$ を満たすユニタリ(H, X, Z, CNOT など)に対しては、閉じた形が使えます。

$$
H_k = \frac{\pi}{2\tau_k}\left(I - U_k\right)
$$

判定の許容誤差は $10^{-9}$ です。

### スペクトル生成子経路

対合でない一般のユニタリ(S, T, RX, RY, RZ, CP など)に対しては、固有分解を用います。

$$
U_k = V \operatorname{diag}\!\left(e^{i\theta_j}\right) V^{-1}
\quad\Longrightarrow\quad
H_k = V \operatorname{diag}\!\left(-\frac{\theta_j}{\tau_k}\right) V^{-1}
$$

得られた $H_k$ はHermite化されたうえで、$e^{-iH_k\tau_k}$ が元の $U_k$ を許容誤差 $5\times10^{-9}$ 以内で再構成することを検証します。再構成に失敗した場合、または固有系の条件数が $10^9$ を超える場合は例外となります。

この2本立ての構成が `effective_unitary_spectral_generator_v2` として宣言されているモードです。

## 所要時間ゼロのゲート

Z, S, T, MEASURE の既定所要時間は 0 です。これらは仮想的な位相ゲート(フレーム更新)または瞬時操作として扱われ、有効ハミルトニアンを構成しません。所要時間が 0 の区間では散逸も発生しません。

## 散逸項

散逸子 $L_k$ の具体形とレートの導出は[散逸モデル](./dissipation-model.md)を参照してください。

## 数値解法

構成された方程式をどう解くかは3つの経路があります。

- [RK4](./propagation/RK4.md) — 既定の固定ステップ数値積分
- [明示的CPTP](./propagation/CPTP.md) — 区間ごとの厳密な指数写像
- [状態ベクトル](./propagation/statevector.md) — 理想条件下の純粋状態発展

## 検証状況

Lindblad発展そのものの妥当性は、解析解との比較(励起状態の指数減衰、純位相緩和、有限温度平衡)およびQuTiPとの独立比較で検証されています。[時間発展の検証](./validations/propagation.md)を参照してください。
