# 2トランズモンPulseモデル数値監査 v1（廃止モデルの記録）

> **記録用。** 対象の `driven_coupled_transmon_pair_rwa_experimental_v1` は
> 廃止され、ネットワークモデルへ統合された。下記の監査スクリプトと成果物は
> モデルと一緒に削除済みで、いま実行することはできない。現行モデルの監査は
> [`../../formalweb/website/docs/physics-model/validations/control-models.md`](../../formalweb/website/docs/physics-model/validations/control-models.md)
> の結合ネットワークの節を参照する。

監査スクリプト: `scripts/validate_pulse_transmon_pair.py`（削除済み）

機械可読結果: `validation_results/pulse_transmon_pair_numerical_audit.json`（削除済み）

## 監査範囲

対象は各3準位、全9次元の短時間fixtureである。これは数値実装監査であり、実機校正や現実のデバイス再現性の検証ではない。

## 合格条件と結果

| 項目 | 合格条件 | 結果 |
| --- | --- | --- |
| step半減収束 | fine誤差 < coarse誤差 | `2.79e-10 < 4.75e-9` |
| 交換振動 | `P01 = sin^2(Jt)`との差 `< 2e-5` | `8.88e-16` |
| 同時drive独立極限 | `J=0`の積状態`P11`誤差 `< 2e-3` | `4.37e-6` |
| Python/Rust一致 | Frobenius差 `< 1e-10` | `6.18e-19` |
| Python/Rust CPTP一致 | Frobenius差 `< 1e-9` | `7.99e-16` |
| RK4/CPTP一致 | Frobenius差 `< 5e-4` | `1.04e-11` |
| CPTP Choi監査 | 全mapがCPかつTP | 合格 |
| 2変量Gaussian | 共分散最大誤差 `< 1e-12` | `1.78e-15` |

全項目が合格した。

## CPTP監査値

```text
interval count:                  16
minimum Choi eigenvalue:        -6.7545e-15
maximum TP Frobenius error:      2.4116e-15
all maps CPTP within tolerance:  true
```

最小Choi固有値の小さな負値は監査許容値より十分小さい浮動小数点丸めであり、物理的な負固有値を主張するものではない。

## 解釈上の注意

- 収束監査は短時間fixtureであり、全parameter領域を保証しない。
- RK4/CPTP一致は同一モデルと近い時間分割の比較であり、モデル妥当性の外部検証ではない。
- Python/Rust一致はbackend parityを示すが、両者が共有する式の誤りは検出できない。
- 次段階ではparameter sweep、長時間発展、非ゼロ散逸、強drive、leakage増大領域を監査する。
