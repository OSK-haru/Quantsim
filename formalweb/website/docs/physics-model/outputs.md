---
title: 出力
sidebar_position: 6
---

# 出力

シミュレーションの結果として得られる量と、その定義を示します。

## 密度行列

各サンプル時刻における密度行列 $\rho(t)$ が主たる出力です。$N$ 量子ビット系では $2^N \times 2^N$ の複素行列になります。

APIレスポンスでは複素数を次の形式で表現します。

```json
{"real": 0.5, "imag": -0.25}
```

## Fidelity(忠実度)

ノイズを含む状態 $\rho$ と、同一回路をノイズなしで実行した理想状態 $\rho_{\text{ideal}}$ の一致度です。

理想状態が純粋な場合(純度が $1$ から $10^{-8}$ 以内)は、次の簡約形を用います。

$$
F = \operatorname{Tr}\!\left(\rho\, \rho_{\text{ideal}}\right)
$$

理想状態が混合状態の場合(測定を含む回路など)は、Uhlmann忠実度を用います。

$$
F = \left(
\operatorname{Tr}\sqrt{
\sqrt{\rho_{\text{ideal}}}\, \rho \, \sqrt{\rho_{\text{ideal}}}
}
\right)^{2}
$$

射影測定は純度を大きく変えるため、測定を含む回路は自動的に後者の分岐を通ります。

## Purity(純度)

$$
P = \operatorname{Tr}\!\left(\rho^2\right)
$$

純粋状態で $1$、$d$ 次元の最大混合状態で $1/d$ をとります。デコヒーレンスの進行を示す指標です。

## 出力確率

計算基底における測定確率です。ビット列のラベルは **q0 が最上位ビット** の規約に従います。

```text
2量子ビットの例: "00", "01", "10", "11"
```

## 有効時間(effective time)

Fidelityが指定したしきい値を初めて下回る時刻です。

$$
t_{\text{eff}} = \min\left\{\, t_i \;\middle|\; F(t_i) < F_{\text{threshold}} \,\right\}
$$

しきい値を最後まで下回らなかった場合は、最終時刻が返されます。既定のしきい値は **0.9** です。

この量は「回路が実用的に機能しつづける時間」を直感的に示すための指標であり、標準的な物理量ではありません。

## 初学者向けの言い換え

UIでは次の対応で表示されます。

| 内部の量 | 表示 |
|---|---|
| Fidelity | 有効性 |
| Purity | 安定性 |
| Effective time | 使用可能時間 |

## 診断情報

物理量とは別に、数値的な健全性を確認するための診断が返されます。

| 項目 | 内容 |
|---|---|
| `evolution_mode` | 使用された発展モードの識別子 |
| `simulation_backend` | 実行バックエンド(`python_dense` / `rust_dense_preview`) |
| `integration_substeps` | 内部積分ステップ数 |
| `cleanup_applied` | 密度行列の整形が適用されたか |
| `max_trace_error` | トレースの $1$ からのずれの最大値 |
| `backend_fallback_used` | Rustカーネルからのフォールバックが発生したか |

実行表現の選択についても診断が返されます。

| 項目 | 内容 |
|---|---|
| `execution_representation` | `density_matrix` / `statevector` |
| `state_dimension` | $2^n$ |
| `density_matrix_dimension` | $(2^n)^2$ |
| `representation_policy` | `adaptive_representation_v1` |
| `density_matrix_qubit_limit` | ノイズあり密度行列経路の上限(現在 8) |
| `large_density_matrix_execution` | 密度行列経路を6量子ビット以上で実行したときに `true` |
| `evolution_method_fallback` | CPTPからRK4へフォールバックした理由(該当時のみ) |

`large_density_matrix_execution` は、次元 $64\times64$ 以上の密度行列を扱ったことを示す目印です。エラーではありませんが、実行時間とメモリが急増する領域に入ったことを意味します。

明示的CPTP経路では、加えてChoi行列の監査結果が返されます。

| 項目 | 内容 |
|---|---|
| `cptp_guaranteed_by_construction` | 構成上CPTP性が保証されているか |
| 最小Choi固有値 | 完全正値性の指標(許容 $10^{-12}$) |
| 最大TP誤差 | トレース保存性の指標(許容 $10^{-12}$) |
| `cptp_all_maps_passed_audit` | すべての区間写像が監査を通過したか |

Pulse-levelモデルでは、整形前の**生の状態**に対する物理性診断が別途保持されます。

| 項目 | 内容 |
|---|---|
| `raw_trace_error` | 整形前のトレース誤差 |
| `raw_hermiticity_error` | 整形前のHermite性の破れ |
| `raw_minimum_eigenvalue` | 整形前の最小固有値(負なら非物理) |
| `cleanup_correction_norm` | 整形による補正の大きさ |

整形前の値を保持しているのは、整形が数値誤差を隠してしまわないようにするためです。補正が大きい場合はステップが粗すぎることを示します。

## 警告と制限

レスポンスには `warnings` と `limitations` が含まれ、モデルの境界がクライアント側から見えるようになっています。たとえば次のような内容です。

- 5量子ビット以上の条件付き回路でCPTPからRK4へフォールバックした旨
- 古典分岐数が上限で制約されている旨
- Coupled transmon networkで直接レート入力時に全トランズモンが同じレートを共有している旨
- RK4が厳密な有限ステップCPTP積分ではない旨

## 未実装の出力

モンテカルロ軌跡(quantum trajectory)は**未実装**です。APIは `trajectory_available: false` を返します。この枠は、ジャンプ統計の監査が完了するまで予約されています。
