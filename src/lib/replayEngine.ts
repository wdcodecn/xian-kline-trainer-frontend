import type { Candle, Position, TradeSide, TradingEvent } from './types'

export function priceFor(candle: Candle) {
  return Number(candle.close)
}

export function openPosition(
  side: TradeSide,
  candle: Candle,
  stopPct: number,
  targetPct: number,
): { position: Position; event: TradingEvent } {
  const entryPrice = priceFor(candle)
  const stopPrice = side === 'LONG' ? entryPrice * (1 - stopPct / 100) : entryPrice * (1 + stopPct / 100)
  const targetPrice = side === 'LONG' ? entryPrice * (1 + targetPct / 100) : entryPrice * (1 - targetPct / 100)
  const initialRiskPct = Math.abs(entryPrice - stopPrice) / entryPrice * 100
  return {
    position: {
      side,
      entryPrice,
      qty: 100,
      stopPrice,
      targetPrice,
      openedAt: candle.openTime,
      initialRiskPct,
    },
    event: {
      id: eventId('open'),
      kind: 'OPEN',
      side,
      time: candle.openTime,
      price: entryPrice,
      qty: 100,
      note: side === 'LONG' ? '开多' : '开空',
    },
  }
}

export function closePosition(
  position: Position,
  candle: Candle,
  qty: number,
  kind: TradingEvent['kind'] = 'CLOSE',
): { next?: Position; event: TradingEvent } {
  const closeQty = Math.min(position.qty, qty)
  const price = priceFor(candle)
  const event = closeEvent(position, candle.openTime, price, closeQty, kind)
  const remaining = position.qty - closeQty
  return {
    next: remaining > 0 ? { ...position, qty: remaining } : undefined,
    event: {
      ...event,
      note: noteFor(kind, closeQty),
    },
  }
}

export function moveStop(position: Position, candle: Candle, mode: 'BREAKEVEN' | 'TRAIL') {
  const price = mode === 'BREAKEVEN'
    ? position.entryPrice
    : position.side === 'LONG'
      ? Number(candle.low)
      : Number(candle.high)
  return {
    position: { ...position, stopPrice: price },
    event: levelEvent(position, candle, price, 'MOVE_STOP', mode === 'BREAKEVEN' ? '止损移保本' : '止损跟随当前K'),
  }
}

export function moveTarget(position: Position, candle: Candle) {
  const price = priceFor(candle)
  return {
    position: { ...position, targetPrice: price },
    event: levelEvent(position, candle, price, 'MOVE_TARGET', '目标移到当前价'),
  }
}

export function resolveAutoExit(position: Position, candle: Candle) {
  const low = Number(candle.low)
  const high = Number(candle.high)
  if (position.side === 'LONG') {
    if (low <= position.stopPrice) {
      return closeAt(position, candle, position.stopPrice, 'STOP')
    }
    if (high >= position.targetPrice) {
      return closeAt(position, candle, position.targetPrice, 'TAKE')
    }
  } else {
    if (high >= position.stopPrice) {
      return closeAt(position, candle, position.stopPrice, 'STOP')
    }
    if (low <= position.targetPrice) {
      return closeAt(position, candle, position.targetPrice, 'TAKE')
    }
  }
  return undefined
}

export function unrealizedR(position: Position | undefined, candle: Candle | undefined) {
  if (!position || !candle || position.initialRiskPct <= 0) {
    return 0
  }
  return pnlPct(position, priceFor(candle)) / position.initialRiskPct
}

export function eventRTotal(events: TradingEvent[]) {
  return events.reduce((total, event) => total + (event.rMultiple ?? 0) * ((event.qty ?? 0) / 100), 0)
}

export function pnlPct(position: Position, exitPrice: number) {
  const raw = ((exitPrice - position.entryPrice) / position.entryPrice) * 100
  return position.side === 'LONG' ? raw : -raw
}

function closeAt(position: Position, candle: Candle, price: number, kind: 'STOP' | 'TAKE') {
  return {
    next: undefined,
    event: {
      ...closeEvent(position, candle.openTime, price, position.qty, kind),
      note: kind === 'STOP' ? '触发止损' : '触发止盈',
    },
  }
}

function closeEvent(position: Position, time: number, price: number, qty: number, kind: TradingEvent['kind']) {
  const pnl = pnlPct(position, price)
  return {
    id: eventId(kind.toLowerCase()),
    kind,
    side: position.side,
    time,
    price,
    qty,
    pnlPct: pnl,
    rMultiple: position.initialRiskPct > 0 ? pnl / position.initialRiskPct : 0,
    note: '',
  }
}

function levelEvent(position: Position, candle: Candle, price: number, kind: TradingEvent['kind'], note: string): TradingEvent {
  return {
    id: eventId(kind.toLowerCase()),
    kind,
    side: position.side,
    time: candle.openTime,
    price,
    qty: position.qty,
    note,
  }
}

function noteFor(kind: TradingEvent['kind'], qty: number) {
  if (kind === 'PARTIAL') {
    return `平 ${qty}%`
  }
  if (kind === 'STOP') {
    return '触发止损'
  }
  if (kind === 'TAKE') {
    return '触发止盈'
  }
  return '平仓'
}

function eventId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
