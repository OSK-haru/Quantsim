# VALIDATION-1: 散逸ゼロ極限で理想量子ゲートと一致するか

## Codex への依頼

QuantaScope の物理モデル検証の第1段階として、**散逸項を厳密にゼロにしたとき、gate-aware Hamiltonian evolution が理想量子回路のユニタリ作用と一致すること**を、解析的に既知な回路と数値指標で検証してください。

今回は物理モデルの変更や最適化ではなく、現行実装のユニタリ極限を監査し、再実行可能な検証コード・結果・文書を残すことが目的です。

---

## 1. 検証したい主張

現行の gate-aware model が、collapse operator を持たない極限で

\[
\frac{d\rho}{dt}=-i[H_k,\rho]
\]

となり、各回路列の終了時に

\[
\rho_{k+1}=U_k\rho_kU_k^\dagger
\]

を再現することを確認します。

現行方式が involutory unitary \(U_k^2=I\) に対して

\[
H_k=\frac{\pi}{2\tau_k}(I-U_k)
\]

を用いている場合は、

\[
e^{-iH_k\tau_k}=U_k
\]

が数値計算でも成立することを検証してください。

---

## 2. 最重要ルール

### 2.1 散逸は「近似的に小さく」ではなく厳密にゼロにする

以下のような代用は禁止です。

- 非常に大きな有限 \(T_1\), \(T_\phi\) を設定する
- 極低温にして熱励起だけを小さくする
- device quality を最大にするだけで済ませる

これらは散逸ゼロではありません。

検証時は、次のいずれかの既存経路を優先してください。

1. collapse operator list を空にする既存の internal/ideal mode
2. すべての散逸率を厳密に `0.0` にする既存の internal config
3. 既存の `ideal_reference` 相当の経路

適切な経路が存在しない場合のみ、**テスト・検証専用の内部 helper/context** を最小限追加してください。公開APIや通常UIの意味は変更しないでください。

### 2.2 idle時間を混ぜない

各ケースで、原則として

```text
total simulation time = circuit completion time
```

とし、回路終了後のidle evolutionを含めないでください。

検証対象は「ゲート実行中のユニタリ極限」です。idleを含む別テストは今回の対象外です。

### 2.3 duration 0 のゲートを避ける

Zなど既定durationが0の場合でも、Hamiltonian経路自体を検証するため、検証ケースでは正のdurationを明示的に設定してください。

例:

```text
H = 0.20 us
X = 0.20 us
Z = 0.20 us
CNOT = 0.40 us
```

MEASUREはユニタリゲートではないため今回の対象外です。

### 2.4 bit orderを記録する

QuantaScopeのbasis conventionを検証文書に明記してください。

例:

```text
q0 is the most significant bit
|q0 q1 q2 ...>
```

実コードが異なる場合は、コード上の実際の規約を記録してください。

---

## 3. 実装前に確認する箇所

まず以下を調査し、検証文書へ記載してください。

- gate-aware simulationの入口
- column unitaryの構築箇所
- effective Hamiltonianの構築箇所
- collapse operatorsの生成箇所
- RK4または時間発展solverの入口
- ideal reference stateの構築箇所
- gate durationの決定箇所
- basis / qubit orderingの実装箇所
- zero-dissipationを厳密に指定できる既存経路

コードを推測で変更せず、現行経路を確認してから作業してください。

---

## 4. 必須検証ケース

少なくとも以下を実施してください。

### V1-1: 1 qubit X

```text
initial: |0>
circuit: X(q0)
expected: |1>
```

理想密度行列:

\[
\rho_{\mathrm{ideal}}=|1\rangle\langle1|
\]

### V1-2: 1 qubit H

```text
initial: |0>
circuit: H(q0)
expected: |+> = (|0>+|1>)/sqrt(2)
```

理想密度行列を明示的に構築してください。

### V1-3: 1 qubit phase-sensitive sequence

```text
initial: |0>
circuit: H(q0) -> Z(q0)
expected: |-> = (|0>-|1>)/sqrt(2)
```

確率だけでは検出できない位相符号を、密度行列の非対角成分で確認してください。

### V1-4: 2 qubit Bell circuit

```text
initial: |00>
circuit:
  column 1: H(q0)
  column 2: CNOT(q0 -> q1)
expected: (|00>+|11>)/sqrt(2)
```

### V1-5: 3 qubit GHZ-style circuit

```text
initial: |000>
circuit:
  H(q0)
  CNOT(q0 -> q1)
  CNOT(q1 -> q2)
expected: (|000>+|111>)/sqrt(2)
```

### V1-6: 4 qubit multi-column circuit

少なくとも次を含む4-qubit回路を用意してください。

- 単一qubit gate
- CNOT
- 3列以上
- qubit orderingを検出できる非対称な出力

例:

```text
initial: |0000>
column 1: X(q3)
column 2: H(q0)
column 3: CNOT(q0 -> q2)
```

期待状態は解析的に明示してください。

### V1-7: 同一列の独立並列ゲート

```text
initial: |00>
column 1: H(q0) + X(q1)
```

同じ列の独立ゲートをまとめた \(U_k\) が理想作用を再現することを確認してください。

### V1-8: 同一列の独立した複数CNOT

4 qubitで衝突しない2つのCNOTを同じ列に配置できる現行仕様なら、次も検証してください。

```text
initial: 非対称なbasis state
column 1:
  CNOT(q0 -> q1)
  CNOT(q2 -> q3)
```

UI上で配置可能でも、coreのcolumn unitaryが両方を保持していることを確認します。

---

## 5. 参照解の作り方

### 5.1 循環検証を避ける

数値simulationと同じ `effective_hamiltonian` や同じ時間発展関数を使って参照解を作らないでください。

最低でも V1-1〜V1-5 は、解析的に既知の状態ベクトルまたは密度行列をテスト内で明示的に構築してください。

### 5.2 追加の一般参照

より複雑な回路については、独立な理想回路計算として

\[
\rho \leftarrow U\rho U^\dagger
\]

を列ごとに適用しても構いません。

ただし、可能ならsimulation側と完全に同じhelperを再利用せず、参照経路の独立性を保ってください。再利用した箇所は文書に明記してください。

---

## 6. 比較指標

各ケースで最低限、次を計算してください。

### 6.1 density matrix element maximum error

\[
\max_{i,j}|\rho^{\mathrm{sim}}_{ij}-\rho^{\mathrm{ideal}}_{ij}|
\]

### 6.2 Frobenius norm error

\[
\|\rho^{\mathrm{sim}}-\rho^{\mathrm{ideal}}\|_F
\]

### 6.3 trace distance

\[
D(\rho,\sigma)=\frac12\|\rho-\sigma\|_1
\]

NumPyで固有値または特異値を用いて計算して構いません。

### 6.4 fidelity

理想状態が純粋なら

\[
F=\langle\psi_{\mathrm{ideal}}|\rho_{\mathrm{sim}}|\psi_{\mathrm{ideal}}\rangle
\]

### 6.5 physical sanity

- `abs(trace(rho) - 1)`
- Hermiticity error
- probability sum error
- NaN / inf absence

---

## 7. 合格基準

既存の数値方式とtime-step policyを考慮しつつ、まず次を目標にしてください。

```text
max element error <= 1e-8
Frobenius error   <= 1e-8
trace distance    <= 1e-8
1 - fidelity      <= 1e-8
trace error       <= 1e-10
Hermiticity error <= 1e-10
```

現行RK4設定で達成できない場合は、物理式を変更せず、time-step設定を十分細かくした検証条件で再実行してください。

それでも達成できない場合は失敗を隠さず、

- ケース
- 誤差
- time steps
- gate duration
- 推定原因

を報告してください。

今回の目的は「全テストを無理に緑にすること」ではなく、ユニタリ極限の誤差を定量化することです。

---

## 8. time-stepの扱い

本格的な収束検証は別タスクですが、VALIDATION-1でも数値誤差と実装ミスを区別するため、少なくとも代表ケース2つで以下を比較してください。

```text
time_steps / subdivisions:
  coarse
  medium
  fine
```

推奨代表ケース:

- 1q H
- 2q Bell または 3q GHZ

誤差が刻みを細かくすると減る場合は数値積分誤差、減らない場合は規約・Hamiltonian・演算子展開の問題を疑ってください。

ただし、この結果は補助診断として扱い、正式な収束検証は後続タスクで実施します。

---

## 9. 作成する成果物

### 9.1 自動テスト

推奨ファイル名:

```text
tests/test_validation_zero_dissipation_unitary_limit.py
```

必須:

- V1-1〜V1-7
- 現行仕様が対応するならV1-8
- zero-dissipationが本当にcollapse operator 0件である確認
- idle time 0の確認
- density matrix比較
- phase-sensitive test

### 9.2 再実行スクリプト

推奨:

```text
scripts/validate_zero_dissipation_unitary_limit.py
```

実行例:

```powershell
.\.venv\Scripts\python.exe scripts\validate_zero_dissipation_unitary_limit.py
```

出力表:

```text
case | qubits | columns | max_abs | frobenius | trace_distance | fidelity | trace_error | result
```

可能ならJSON/CSVも保存してください。

推奨:

```text
validation_results/validation1_zero_dissipation.json
validation_results/validation1_zero_dissipation.csv
```

### 9.3 検証報告書

推奨:

```text
docs/validation/validation-1-zero-dissipation-unitary-limit.md
```

含める内容:

1. 検証目的
2. 実行環境
3. Git commit
4. zero-dissipationの実装方法
5. Hamiltonian規約と単位
6. gate durations
7. basis order
8. 各テスト回路
9. 解析的期待値
10. 数値結果表
11. time-step補助比較
12. 合否
13. 不一致があれば原因候補
14. 変更したコード一覧
15. 生成AI利用箇所

---

## 10. Hamiltonian単位の監査

今回の検証報告で、現行コードのHamiltonianが次のどちらかを明記してください。

```text
energy unit
angular-frequency generator unit
```

マスター方程式が

\[
\dot\rho=-i[H,\rho]+\mathcal D(\rho)
\]

で \(\hbar=1\) を採用し、時間単位が \(\mu s\) なら、通常は \(H\) の数値単位は `rad/us` 相当です。

コードの実際の規約を確認し、推測ではなく記録してください。

---

## 11. 変更してよい範囲

- tests
- validation scripts
- validation docs
- 検証専用のinternal helper/context
- 必要最小限のdiagnostic追加

---

## 12. 変更してはいけない範囲

- Lindblad方程式の形
- 散逸率の定義
- Hamiltonian生成式の意味
- gate semantics
- qubit orderingを結果に合わせて変更すること
- API request/responseの公開shape
- frontend UI
- Rust backend
- time-step policyの通常既定値
- 数値結果を合格させるための後処理・射影・丸め

不一致が見つかった場合は、今回のタスク内で物理ロジックを黙って修正せず、まず失敗するテストと診断結果を残してください。明白な実装バグを修正する必要がある場合は、原因・修正前後・回帰影響を報告してから最小修正してください。

---

## 13. 完了条件

以下をすべて満たしたら完了です。

- 散逸が厳密にゼロであることを確認できる
- idle時間を除いたゲート実行だけを比較できる
- 1/2/3/4 qubitの代表回路を検証できる
- 位相を含む密度行列比較がある
- 解析的期待値との非循環比較がある
- 数値誤差が表として出る
- representative time-step comparisonがある
- 自動テストが通る、または失敗を定量的に記録する
- 再実行可能なscriptがある
- 検証報告書がある
- 通常API・UI・物理モデルを変更していない

---

## 14. 最終報告フォーマット

実装後、次を報告してください。

```text
Changed files
Validation method
How zero dissipation was enforced
Hamiltonian unit convention
Basis order
Test cases
Numerical tolerances
Result table
Time-step comparison
Failures or discrepancies
Commands run
Physics/API/UI changes: yes/no
```
