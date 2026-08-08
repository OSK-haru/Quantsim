import type { GateType } from '../types/circuit'

export type GateFamily = 'rotation' | 'phase' | 'control' | 'register' | 'measurement' | 'annotation'

export type GateMatrix = {
  prefix?: string
  rows: string[][]
}

export type GateReferenceEntry = {
  family: GateFamily
  description: string
  matrix?: GateMatrix
  note?: string
}

export const gateReference: Record<GateType, GateReferenceEntry> = {
  H: {
    family: 'rotation',
    description: '|0⟩と|1⟩の等しい重ね合わせを作る。X軸とZ軸の中間の軸を中心にπ回転する。',
    matrix: { prefix: '1/√2 ×', rows: [['1', '1'], ['1', '-1']] },
  },
  X: {
    family: 'rotation',
    description: 'ビット反転(量子NOT)。Xブロッホ軸を中心にπ回転し、|0⟩と|1⟩を入れ替える。',
    matrix: { rows: [['0', '1'], ['1', '0']] },
  },
  Y: {
    family: 'rotation',
    description: 'ビットと位相を同時に反転する。Yブロッホ軸を中心にπ回転する。',
    matrix: { rows: [['0', '-i'], ['i', '0']] },
  },
  Z: {
    family: 'phase',
    description: '位相反転。|1⟩の振幅に-1をかける。Zブロッホ軸を中心にπ回転する。',
    matrix: { rows: [['1', '0'], ['0', '-1']] },
  },
  S: {
    family: 'phase',
    description: 'π/2位相ゲート(√Z)。|1⟩の振幅にiをかける。',
    matrix: { rows: [['1', '0'], ['0', 'i']] },
  },
  T: {
    family: 'phase',
    description: 'π/4位相ゲート(√S)。|1⟩の振幅に e^{iπ/4} をかける。',
    matrix: { rows: [['1', '0'], ['0', 'e^{iπ/4}']] },
  },
  RX: {
    family: 'rotation',
    description: 'Xブロッホ軸を中心とした角度θの回転。θは配置後にインスペクターで調整できる。',
    matrix: { rows: [['cos(θ/2)', '-i sin(θ/2)'], ['-i sin(θ/2)', 'cos(θ/2)']] },
  },
  RY: {
    family: 'rotation',
    description: 'Yブロッホ軸を中心とした角度θの回転。θは配置後にインスペクターで調整できる。',
    matrix: { rows: [['cos(θ/2)', '-sin(θ/2)'], ['sin(θ/2)', 'cos(θ/2)']] },
  },
  RZ: {
    family: 'rotation',
    description: 'Zブロッホ軸を中心とした角度θの回転(可変位相ゲート)。',
    matrix: { rows: [['e^{-iθ/2}', '0'], ['0', 'e^{iθ/2}']] },
  },
  CNOT: {
    family: 'control',
    description: '制御ビットが|1⟩のときのみ、標的ビットを反転する。',
    matrix: {
      rows: [
        ['1', '0', '0', '0'],
        ['0', '1', '0', '0'],
        ['0', '0', '0', '1'],
        ['0', '0', '1', '0'],
      ],
    },
  },
  CZ: {
    family: 'control',
    description: '両方のビットが|1⟩のときのみ-1の位相を付与する対称なゲート。',
    matrix: {
      rows: [
        ['1', '0', '0', '0'],
        ['0', '1', '0', '0'],
        ['0', '0', '1', '0'],
        ['0', '0', '0', '-1'],
      ],
    },
  },
  CP: {
    family: 'control',
    description: '両方のビットが|1⟩のときのみ角度θの位相を付与する。',
    matrix: {
      rows: [
        ['1', '0', '0', '0'],
        ['0', '1', '0', '0'],
        ['0', '0', '1', '0'],
        ['0', '0', '0', 'e^{iθ}'],
      ],
    },
  },
  CCX: {
    family: 'control',
    description: 'Toffoliゲート。2つの制御ビットが共に|1⟩のときのみ、標的ビットを反転する。',
    note: '8×8の置換行列になるため省略。|110⟩⇄|111⟩ を入れ替え、他の基底は不変。',
  },
  SWAP: {
    family: 'control',
    description: '2つの量子ビットの状態をそのまま入れ替える。',
    matrix: {
      rows: [
        ['1', '0', '0', '0'],
        ['0', '0', '1', '0'],
        ['0', '1', '0', '0'],
        ['0', '0', '0', '1'],
      ],
    },
  },
  QFT: {
    family: 'register',
    description: '量子フーリエ変換。またぐ量子ビット数が可変で、指定した順序をレジスタのビット順(先頭が最上位)として扱う。連続していない量子ビットにもかけられる。',
    note: 'N=2^m として |j⟩ を (1/√N)Σ_k e^{2πijk/N}|k⟩ に写す。自動分解ではH・CP梯子とビット反転SWAPに展開され、既定の所要時間は量子ビットあたり0.20μs。',
  },
  ORACLE: {
    family: 'register',
    description: '位相オラクル。指定した1つの計算基底状態の位相だけを反転し、他は変えない。またぐ量子ビット数は可変で、Grover探索の解の印付けと拡散演算子の両方に使える。',
    note: 'O = I - 2|m⟩⟨m|。対角の±1行列でエルミートかつ対合(O²=I)。拡散演算子は H^n · ORACLE(|0…0⟩) · H^n で作れる(全体符号を除く)。自動分解ではXと多重制御ZからCNOT・RZへ展開され、既定の所要時間は量子ビットあたり0.20μs。',
  },
  MEASURE: {
    family: 'measurement',
    description: '計算基底(Z基底)での射影測定。状態を|0⟩または|1⟩へ確率的に収縮させる非ユニタリ操作。',
  },
  MESSAGE: {
    family: 'annotation',
    description: 'テレポーテーションにおける古典通信の送信側を示す表示専用マーカー。量子操作ではない。',
  },
  RECEIVED: {
    family: 'annotation',
    description: 'テレポーテーションにおける古典通信の受信側を示す表示専用マーカー。量子操作ではない。',
  },
}
