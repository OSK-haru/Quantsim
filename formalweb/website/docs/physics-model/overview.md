---
title: 物理モデルの概要
sidebar_position: 1
---

# シミュレートの中の物理モデル

QuantaScopeでは、ユーザーが設定した量子回路と、温度・磁束ノイズ・量子ビット周波数・デバイス品質などの環境パラメータから、制御項と散逸項を構成します。

制御モデルとして **Gate-awareモデル** または **Pulse-levelモデル** を選択し、各時間区間のハミルトニアンを決定します。さらに環境パラメータから緩和・熱励起・位相緩和のレートと崩壊演算子を導出し、Lindblad型(GKSL型)の時間発展方程式を構成します。

この方程式を **RK4による数値積分**、**明示的CPTP写像による時間発展**、または理想条件下での**状態ベクトル発展**のいずれかで計算し、密度行列、Fidelity、Purity、出力確率などを可視化します。

![QuantaScopeの物理モデル概要](/img/quantascope-physics-model.png)

## モデルの構成

| 段階 | 内容 | 詳細 |
|---|---|---|
| 入力 | 環境パラメータ → 物理レート | [入力とパラメータ](./input_and_parameters.md) |
| 制御 | 回路 → 時間区間ごとのハミルトニアン | [Gate-aware](./control_models/gate-awaremodel.md) / [Pulse-level](./control_models/pulse-levelmodel.md) |
| 散逸 | レート → 崩壊演算子 | [散逸モデル](./dissipation-model.md) |
| 方程式 | GKSL方程式の構成 | [Lindblad方程式](./lindblad.md) |
| 時間発展 | 数値解法の選択 | [RK4](./propagation/RK4.md) / [CPTP](./propagation/CPTP.md) / [状態ベクトル](./propagation/statevector.md) |
| 出力 | 指標の算出 | [出力](./outputs.md) |

## 現在のモデル識別子

実装が宣言している既定のモデル識別子は次のとおりです。

```text
evolution_mode:   gate_aware_hamiltonian_lindblad_v1
environment:      generic_superconducting_open_system_v1
hamiltonian_mode: effective_unitary_spectral_generator_v2
native_gate_set:  gate_aware_hxyzst_rz_cnot_v3
```

## 適用範囲について

QuantaScopeは**校正済みのハードウェアモデルではありません**。実装しているデバイスプロファイルは一般的なトランズモンを模した学習用のものであり、特定の実機を定量的に再現することを目的としていません。

前提と適用範囲の詳細は[前提と適用範囲](./assumuptions.md)を、各モデルがどのように検証されたかは[妥当性検証](./validations/index.md)を参照してください。
