export type TradeAction = 'LONG' | 'SHORT' | 'WAIT' | 'AVOID'
export type TradeSide = 'LONG' | 'SHORT'
export type TradingEventKind = 'OPEN' | 'CLOSE' | 'PARTIAL' | 'STOP' | 'TAKE' | 'MOVE_STOP' | 'MOVE_TARGET'

export type Candle = {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type PracticeMode = {
  key: string
  label: string
  intervals: string[]
  goal: string
}

export type BootstrapResponse = {
  modes: PracticeMode[]
  intervals: string[]
  symbols: string[]
}

export type Question = {
  id: string
  symbol: string
  interval: string
  mode: string
  modeLabel: string
  feature: string
  featureLabel: string
  marketState: string
  beginnerHint: string
  decisionTime: number
  currentPrice: number
  contextBars: Candle[]
  hiddenBarCount: number
}

export type AnswerPayload = {
  action: TradeAction
  entryPrice?: number
  stopPrice?: number
  targetPrice?: number
  confidence: number
  reasons: string[]
}

export type AnswerResult = {
  score: number
  verdict: string
  feedback: string
  review: {
    symbol: string
    interval: string
    decisionTime: number
    revealStartTime: number
    revealEndTime: number
    contextBarCount: number
    revealBarCount: number
  }
  breakdown: {
    result: number
    actionQuality: number
    riskPlan: number
    confidenceCalibration: number
    rmultiple: number
    rMultiple?: number
  }
  revealBars: Candle[]
}

export type ReviewMeta = {
  symbol: string
  interval: string
  decisionTime: number
  revealStartTime: number
  revealEndTime: number
  contextBarCount: number
  revealBarCount: number
}

export type ReplayResult = {
  review: ReviewMeta
  revealBars: Candle[]
}

export type Position = {
  side: TradeSide
  entryPrice: number
  qty: number
  stopPrice: number
  targetPrice: number
  openedAt: number
  initialRiskPct: number
}

export type TradingEvent = {
  id: string
  kind: TradingEventKind
  side?: TradeSide
  time: number
  price: number
  qty?: number
  pnlPct?: number
  rMultiple?: number
  note: string
}
