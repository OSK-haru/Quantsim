# Plus Requirements

## 目的

この文書は、QuantaScope の本開発必達範囲には含めないが、将来的な拡張候補として検討する機能を整理する。

ここに記載された機能は、MVPおよび本開発必達範囲には含めない。
U-22提出時点で未実装でも問題ない。
ただし、プロジェクトの発展性、技術的方向性、研究的拡張可能性を示すために記録する。

---

## 基本方針

- MVPまたは本開発必達範囲には含めない
- 実装優先度は Functional Requirements より低い
- 実装する場合は、別途 Functional Requirements へ昇格させる
- 物理モデルの妥当性が必要なものは、必ず仮定と限界を明記する
- QuTiP、Godot、FastAPIなどの外部技術は、本体価値を補助するものとして扱う
- QuantaScope の中核は、弱結合開放系に基づく小規模量子回路の劣化可視化である
- 強結合開放系、Circuit QED、測定トラジェクトリーなどは、Expert向け拡張または将来拡張として扱う

---

## Plus Requirements 一覧

| ID | 機能名 | 種別 | 優先度 |
|---|---|---|---:|
| P01 | Godot体験UI PoC | UI/UX拡張 | 中 |
| P02 | FastAPI連携 | アーキテクチャ拡張 | 中 |
| P03 | 測定・量子トラジェクトリー機能 | 物理モデル拡張 | 中 |
| P04 | 非エルミート no-jump 発展機能 | 物理モデル拡張 | 中〜高 |
| P05 | Cavity QED inspired mode | 物理モデル拡張 | 中 |
| P06 | Circuit QED inspired profile | 物理プロファイル拡張 | 中 |
| P07 | Strong-coupling preview mode | 物理モデル拡張 | 低〜中 |
| P08 | 簡易量子誤り訂正デモ | 教育・技術デモ | 中 |
| P09 | 3〜6論理量子ビット拡張 | 計算規模拡張 | 中 |
| P10 | パラメータスイープ・感度分析 | 分析拡張 | 中 |
| P11 | QuTiP optional backend / 検証モード | 数値計算・検証拡張 | 中〜高 |
| P12 | Obsidian Markdownレポート出力 | 運用・記録拡張 | 中 |
| P13 | グラフ画像エクスポート | 提出・資料化支援 | 低〜中 |
| P14 | Reduced density matrix 表示 | 可視化拡張 | 中 |
| P15 | Bloch球アニメーション | 可視化拡張 | 低〜中 |
| P16 | 用語辞書・理論ヘルプ機能 | 学習支援 | 中 |
| P17 | URL共有・設定共有機能 | 共有機能 | 低 |

---

# P01 Godot体験UI PoC

## 概要

Godotを用いて、QuantaScope の入門者向け体験UIを試作する。

Python側のシミュレーションコアを正本とし、Godot側では数値計算を再実装しない。Godotは、ノイズによる状態劣化、有効動作時間、State Fidelity、Purityの変化を直感的に示すためのフロントエンドとして扱う。

## 想定機能

- ノブまたはスライダーによる環境条件操作
- State Fidelity / Purity / Effective Operation Time のゲージ表示
- ノイズ強度に応じた状態劣化アニメーション
- Low noise / High noise の体験比較
- Python API との通信
- 入門者向けの簡易ガイド表示

## 非対象

- GodotでのLindbladシミュレーション再実装
- Godotを本体計算エンジンにすること
- 初期段階での完全な回路エディタ実装
- Godot側での物理モデル管理

## 実装条件

- Python側に安定した `run_simulation(config)` が存在すること
- `.qscope.json` 形式がある程度固まっていること
- FastAPIまたはローカルJSON連携が用意されていること

---

# P02 FastAPI連携

## 概要

PythonシミュレーションコアをHTTP APIとして公開し、Godotや将来の別フロントエンドから呼び出せるようにする。

## 想定機能

- `/simulate` エンドポイント
- JSON入力による回路・環境条件指定
- JSON出力による State Fidelity / Purity / Effective Operation Time 返却
- 条件比較用エンドポイント
- エラー時の構造化レスポンス
- ローカルホスト限定起動

## 非対象

- クラウド公開
- ユーザー認証
- マルチユーザー管理
- 実機バックエンド連携
- 外部公開APIとしての運用

## 実装条件

- `.qscope.json` 形式が固まっていること
- `SimulationConfig` / `SimulationResult` が安定していること
- F13の入力検証・エラーハンドリングが整っていること

---

# P03 測定・量子トラジェクトリー機能

## 概要

測定結果に条件づけた量子状態の時間発展を扱う拡張機能。

通常のLindblad型マスター方程式によるアンサンブル平均発展とは区別し、測定結果に依存する状態変化を可視化する。

## 想定機能

- projective measurement
- weak measurement
- quantum jump trajectory
- no-jump trajectory
- ensemble averageとの比較
- 測定結果ごとの状態変化表示
- 測定あり/なし比較

## 表示候補

- trajectoryごとの State Fidelity
- trajectoryごとの Purity
- ジャンプ時刻
- ジャンプ種別
- 測定結果の確率
- ensemble averageとの違い
- no-jump発展との比較

## 非対象

- 大量サンプルによる高精度統計
- 実機測定データとの比較
- 本格的な連続測定理論の完全実装
- 大規模多体系の測定誘起相転移解析

## 備考

本機能は本開発必達ではなく、Expert向けPoCまたは将来拡張として扱う。
QuTiPの `mcsolve` などを optional backend として利用できる可能性がある。

---

# P04 非エルミート no-jump 発展機能

## 概要

量子ジャンプが観測されない場合の条件付き発展として、有効非エルミートハミルトニアンによる時間発展を扱う。

弱結合Lindbladモデルから自然に派生するため、Expert向け拡張として優先度が比較的高い。

## 想定機能

- 有効非エルミートハミルトニアンの構成
- Re(H_eff) / Im(H_eff) の表示
- 複素固有値の表示
- no-jump発展とLindblad平均発展の比較
- ノルム減衰の可視化
- Expert Inspector内でのH_eff表示

## 数式

```text
H_eff = H - i/2 Σ L†
