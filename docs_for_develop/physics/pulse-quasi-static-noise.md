# Pulse準静的離調ノイズモデル

## 目的と適用範囲

Pulse Labの単一トランズモンqutritモデルに、測定ショットより十分遅く変動する周波数ノイズを追加する。ここでの準静的とは、離調オフセットが1ショットの時間発展中は一定で、ショット間では独立に変わるという意味である。時間波形としての低周波ノイズや一般の非Markov過程を直接生成するモデルではない。

## 一般論からの式

計算基底の数演算子を

```text
n = |1><1| + 2|2><2| = diag(0, 1, 2)
```

とする。回転座標系の既存Hamiltonianを `H0(t)`、ユーザーが指定した決定論的離調を `Delta`、準静的な確率変数を `delta` とすると、各ショットのHamiltonianは

```text
H(t; delta) = H0(t) - (Delta + delta) n
```

である。符号はプロジェクト既存の離調規約 `diag(0, -Delta, -2 Delta + alpha)` に合わせている。これは新しい物理仮定ではなく、既存の `Delta` を `Delta + delta` に置き換えただけである。

ノイズ分布は平均0のGaussianとする。

```text
delta ~ Normal(0, sigma_omega^2)
p(delta) = exp[-delta^2/(2 sigma_omega^2)]
           / (sqrt(2 pi) sigma_omega)
```

観測される密度行列は各ショットの結果のアンサンブル平均である。

```text
rho_bar(t) = E_delta[rho(t; delta)]
           = integral rho(t; delta) p(delta) d delta
```

各 `rho(t; delta)` は、既存の時間依存HamiltonianとLindblad散逸を用いて計算する。準静的ノイズを一定の `gamma_phi` に置き換えない。Gaussian準静的離調は、自由発展では一般に `exp[-sigma_omega^2 t^2 / 2]` 型のcoherence包絡を生み、一定rateのMarkov位相緩和が生む `exp[-gamma_phi t]` とは時間依存性が異なるためである。

## 数値計算用の変形

変数を

```text
delta = sqrt(2) sigma_omega x
```

と置くと、正規分布による期待値は

```text
rho_bar(t)
  = 1/sqrt(pi) integral exp(-x^2)
    rho(t; sqrt(2) sigma_omega x) dx
```

へ変形できる。したがってN点Gauss-Hermite求積を使い、

```text
rho_bar(t) ~= sum_i [w_i / sqrt(pi)]
                    rho(t; sqrt(2) sigma_omega x_i)
```

と計算する。`x_i, w_i` はHermite求積のnodeとweightである。

この変形を採用する理由は次の通り。

1. 変数変換後の重み `exp(-x^2)` がGauss-Hermite求積の定義と一致する。
2. Monte Carlo法と違って乱数seedやshot noiseがなく、同じ入力から同じ結果を得られる。
3. 小規模な対話UIでは、少ない発展回数で滑らかなアンサンブル平均を得やすい。

これはGaussian分布を別の分布へ置き換える近似ではない。連続積分を有限個のnodeで評価する数値積分近似である。UIでは次数3、5、7、9を選べる。次数を上げるほど積分精度が改善し得る一方、時間発展回数と計算量はほぼ比例して増える。

## 密度行列を平均する理由

確率的に異なるショットを観測前に区別できない場合、物理的な混合状態は密度演算子の凸結合で表される。このためpopulationやpurityを先に平均せず、まず

```text
rho_bar = sum_i W_i rho_i,  W_i >= 0,  sum_i W_i = 1
```

を作り、population、leakage、purityを `rho_bar` から再計算する。特にpurityは非線形量なので、`sum_i W_i Tr(rho_i^2)` ではなく `Tr(rho_bar^2)` を返す。

## 現在の制限

- qutrit Pulseモデルのみを対象とする。
- ノイズは全Pulseシーケンスの各APIブロック内で準静的だが、現在の逐次API実行ではブロックごとに再度アンサンブル平均される。単一の離調サンプルをシーケンス全体で保持する相関ノイズは将来課題である。
- Gaussianな加法的周波数離調だけを扱う。振幅ノイズ、1/f spectrumの明示生成、telegraph noise、cross-talkは含まない。
- プロファイル値は実機校正値ではない。
