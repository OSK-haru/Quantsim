/*
 * 右下のペットがガイド役として喋る文言。
 * ページごとに内容を差し替える。
 */

import type { GateType } from '../types/circuit'
import {
  isControlledGateType,
  isPairGateType,
  isRegisterGateType,
  isThetaGateType,
} from './circuitEditing'

export type QuantumPetStage = {
  label: string
  afterMs: number
}

/* 実行中は経過時間に応じて、いま何をしているかを伝える。 */

export const gateAwareRunningStages: QuantumPetStage[] = [
  { label: '回路を物理パラメータへ変換しているよ…', afterMs: 0 },
  { label: 'Lindblad方程式で時間発展を解いているよ…', afterMs: 600 },
  { label: '密度行列のスナップショットを集めているよ…', afterMs: 2500 },
  { label: '測定統計とダイアグノスティクスを計算中…', afterMs: 6000 },
  { label: 'まだ計算中…重い回路みたい。もう少し待ってね。', afterMs: 12000 },
]

export const pulseRunningStages: QuantumPetStage[] = [
  { label: 'パルス波形を組み立てているよ…', afterMs: 0 },
  { label: '駆動ハミルトニアンで時間発展を解いているよ…', afterMs: 600 },
  { label: '各準位の占有数を追いかけているよ…', afterMs: 2500 },
  { label: '占有数と密度行列をまとめているよ…', afterMs: 6000 },
  { label: 'まだ計算中…長いパルス列みたい。もう少し待ってね。', afterMs: 12000 },
]

/* 計算していないあいだに巡回させるヒント。 */

export const homeTips = [
  'はじめてなら「はじめての量子回路」からどうぞ。ぼくが案内するよ。',
  '2本目の「ゆらぎ実験」では、条件を変えて答えが濁るのを実際に比べるよ。',
  '通常モードは、ゲートを並べて回路を組むところから始まるよ。',
  'PULSEモードは、ゲートより下の層…マイクロ波の波形そのものを扱うよ。',
  'このアプリの見どころは、理想の答えと現実の答えのズレだよ。',
  'ぼくはどのページにもいるから、迷ったらつついてね。',
]

export const simulateTips = [
  '回路を組んだら「シミュレーションを実行」を押してね。',
  'ゲート時間が長いほど、T1・Tφによる減衰を強く受けるよ。',
  '温度を上げると熱励起が増えて、忠実度が下がりやすいよ。',
  'スナップショットを増やすと、途中の密度行列まで覗けるよ。',
  'デバイス品質を下げると、ノイズの影響を試せるよ。',
]

export const stateExplorerTips = [
  '「表示項目」から、見たいパネルだけ選べるよ。',
  'Bloch球は左が実際の状態、右がノイズなしの理想状態だよ。',
  'RZの位相変化は絶対値に出ないから、密度行列は実部・虚部・位相を切り替えてね。',
  '物理時間の再生バーを動かすと、他のパネルの時刻も一緒に動くよ。',
  '純度が1から下がっていたら、混合状態になった証拠だよ。',
]

export const pulseStateExplorerTips = [
  '「表示項目」から、見たいパネルだけ選べるよ。',
  '物理時間の再生バーを動かすと、指標も確率も密度行列も同じ時刻に揃うよ。',
  '最初のカーソル位置はPulse終了時刻。駆動を切った直後の状態から見るのがいちばん早いよ。',
  'リーケージは計算部分空間の外に出た確率。正規化では消えないから、そのまま読めるよ。',
  '純度が1から下がっていたら、環境と混ざって混合状態になった証拠だよ。',
  'Bloch球が無いのは、3準位以上の状態を球に潰すとリーケージが隠れてしまうからだよ。',
]

export const pulseLabTips = [
  '振幅の指定は「目標回転角」と「ピーク振幅」を切り替えられるよ。',
  '離調が残っていると、Rabi振動が1まで届かなくなるよ。',
  'DRAG係数βは、第3準位への漏れを抑えるための補正だよ。',
  '非調和性が小さいほど、|2⟩へ漏れやすくなるよ。',
  'ガウシアンパルスは truncation σ の外側を切り落としているよ。',
  '準静的な離調ゆらぎを入れると、ショットごとのばらつきを見られるよ。',
]

export const circuitStudioTips = [
  'パレットのゲートを選ぶと、その置きかたをここで案内するよ。',
  'パレットで選んでからスロットをクリックしても置けるし、ドラッグでも置けるよ。',
  'ドラッグ中に列と列のあいだへ落とすと、そこに新しい列が割り込むよ。',
  '置いたゲートをクリックして選ぶと、Delete か Backspace で消せるよ。',
  '選んだゲートの下に出る ← → ⧉ × で、列の移動・複製・削除ができるよ。',
  '回路の外で放したドラッグは取りやめ。まちがえて消えることはないよ。',
  'Escape を押すと、選択中のゲートや作りかけの制御点をまとめて解除できるよ。',
  'Ctrl（⌘）+ ＋ / − で拡大・縮小、Ctrl（⌘）+ 0 で等倍に戻せるよ。',
  'F キーで回路全体が画面に収まるよ。Home で先頭列、End で最終列へ飛べる。',
  'ショートカットは、入力欄にカーソルがあるあいだは効かないよ。',
]

/*
 * ゲートの種類ごとの置きかた。
 * パレットのツールチップやエディタのヒントと同じ操作を案内する。
 */
export function gatePlacementGuide(gateType: GateType): string {
  if (isRegisterGateType(gateType)) {
    return (
      `${gateType}：ビット0(最下位)にする量子ビットをクリックして、`
      + '上位ビットにしたい順にクリックしていくよ。'
      + '選択済みの量子ビットをもう一度クリックすると確定。'
      + 'パレットからドラッグすると、落とした行から下をまとめて指定できるよ。'
      + (gateType === 'ORACLE'
        ? ' 置いたあと、インスペクターでマークする状態を選んでね。'
        : '')
    )
  }

  if (isControlledGateType(gateType)) {
    return (
      `${gateType}：制御にする量子ビットをクリックしてから、`
      + '同じ列で標的の量子ビットをクリックしてね。'
      + 'パレットから直接ドラッグしても置けるよ。'
      + (gateType === 'CP' ? ' 置いたあと、インスペクターで角度θを入れてね。' : '')
    )
  }

  if (isPairGateType(gateType)) {
    return (
      `${gateType}：入れ替える2つの量子ビットを、同じ列で順にクリックしてね。`
      + 'パレットから直接ドラッグしても置けるよ。'
    )
  }

  if (gateType === 'CCX') {
    return (
      'CCX：置きたいスロットをクリックするか、パレットからドラッグして置いてね。'
      + '3量子ビット以上の回路でだけ使えるよ。'
    )
  }

  if (gateType === 'MEASURE') {
    return 'MEASURE：パレットの「M」を選んで測定したい行をクリック、またはドラッグして落としてね。'
  }

  if (gateType === 'MESSAGE' || gateType === 'RECEIVED') {
    return (
      `${gateType}：テレポーテーションの通信を図に示すための表示マーカーだよ。`
      + 'パレットからドラッグして置いてね。'
    )
  }

  if (isThetaGateType(gateType)) {
    return `${gateType}：クリックかドラッグで置いたあと、インスペクターで角度θを入れてね。`
  }

  return (
    `${gateType}：置きたいスロットをクリックするか、パレットからドラッグして落としてね。`
    + '列と列のあいだに落とすと、そこに新しい列が入るよ。'
  )
}

/*
 * パレットの制御点（● / ○）ツールを選んでいる間の案内。
 * こちらは selectedGateType を経由しないので、gatePlacementGuide とは別に扱う。
 */
export function controlMarkerPlacementGuide(controlValue: 0 | 1, hasPending: boolean): string {
  const symbol = controlValue === 1 ? '制御 ●' : '反制御 ○'
  if (hasPending) {
    return `${symbol}を仮置き中：続けて制御点を置くか、同じ列へ X をドロップして接続してね。`
  }
  return `${symbol}を配置中：X、または既存CNOTの縦線内へドロップすると自動接続、単独ならクリックで置けるよ。`
}

/*
 * クリック配置の途中（1つ目を選んだ状態）で、次の操作を伝える。
 */
export function gatePlacementProgressGuide(gateType: GateType): string {
  if (isRegisterGateType(gateType)) {
    return (
      `${gateType}：続けて上位ビットにする量子ビットをクリックしてね。`
      + '選択済みの量子ビットをもう一度クリックすると確定だよ。'
    )
  }

  return `${gateType}：あと1つ、同じ列で接続先の量子ビットをクリックしてね。`
}

export const pulseCircuitStudioTips = [
  'パルスを選ぶと、そのままPulse Labへ持っていって実行できるよ。',
  'Virtual-Zは実際に駆動せず、以降のパルスの位相をずらすだけだよ。',
  'レーンごとにトランズモンが分かれているよ。',
  'パルスの間隔が短すぎないか、実行制約が見張ってくれるよ。',
  '装置プロファイルを選ぶと、振幅や離調の上限がそれに合わせて変わるよ。',
]
