import {
  ArrowDownToLine,
  CirclePause,
  Gauge,
  Pause,
  Play,
  RefreshCw,
  Shield,
  SkipForward,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import * as React from 'react'
import type { Candle, Position, Question, TradeSide } from '~/lib/types'

type Props = {
  question: Question
  currentCandle: Candle
  disabled: boolean
  finished: boolean
  isPlaying: boolean
  playedCount: number
  totalCount: number
  position?: Position
  onStep: () => void
  onTogglePlay: () => void
  onOpen: (side: TradeSide, stopPct: number, targetPct: number) => void
  onClose: (qty: number) => void
  onMoveStop: (mode: 'BREAKEVEN' | 'TRAIL') => void
  onMoveTarget: () => void
  onFinish: () => void
  onNextQuestion: () => void
}

export function ActionPanel({
  question,
  currentCandle,
  disabled,
  finished,
  isPlaying,
  playedCount,
  totalCount,
  position,
  onStep,
  onTogglePlay,
  onOpen,
  onClose,
  onMoveStop,
  onMoveTarget,
  onFinish,
  onNextQuestion,
}: Props) {
  const preset = riskPreset(question.mode, question.interval)
  const [stopPct, setStopPct] = React.useState(preset.stopPct)
  const [targetPct, setTargetPct] = React.useState(preset.targetPct)
  const canTrade = !disabled && !finished
  const progress = totalCount > 0 ? (playedCount / totalCount) * 100 : 0

  React.useEffect(() => {
    if (!position) {
      setStopPct(preset.stopPct)
      setTargetPct(preset.targetPct)
    }
  }, [position, preset.stopPct, preset.targetPct, question.id])

  return (
    <aside className="orderTicket">
      <div className="panelHeader ticketHead">
        <div>
          <p className="eyebrow">Execution</p>
          <h2>{position ? '持仓管理' : '计划开仓'}</h2>
        </div>
        <span className="hiddenCount">{question.interval}</span>
      </div>

      <div className="progressCard">
        <div className="positionHeader">
          <span>Replay</span>
          <strong className="monoStat">{playedCount}/{totalCount}</strong>
        </div>
        <div className="progressTrack"><span style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="replayControls actionStrip">
        <button className="iconTextBtn replayPrimary" disabled={disabled || finished} onClick={onTogglePlay} type="button">
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          {isPlaying ? '暂停' : '播放'}
        </button>
        <button className="iconTextBtn replayStep" disabled={disabled || finished} onClick={onStep} type="button">
          <SkipForward size={18} />
          下一根
        </button>
      </div>

      <div className="quoteCard">
        <span>当前成交参考</span>
        <strong className="monoPrice">{formatPrice(Number(currentCandle.close))}</strong>
      </div>

      {position ? (
        <PositionBox
          currentCandle={currentCandle}
          disabled={!canTrade}
          onClose={onClose}
          onMoveStop={onMoveStop}
          onMoveTarget={onMoveTarget}
          position={position}
        />
      ) : (
        <OpenBox
          disabled={!canTrade}
          maxStopPct={preset.maxStopPct}
          maxTargetPct={preset.maxTargetPct}
          onOpen={onOpen}
          setStopPct={setStopPct}
          setTargetPct={setTargetPct}
          stopPct={stopPct}
          targetPct={targetPct}
        />
      )}

      <button className="submitBtn nextQuestionBtn fullWidth" onClick={onNextQuestion} type="button">
        <RefreshCw size={18} />
        换一题
      </button>

      <button className="submitBtn reviewBtn fullWidth" disabled={disabled || finished} onClick={onFinish} type="button">
        <CirclePause size={18} />
        复盘
      </button>
    </aside>
  )
}

function OpenBox({
  disabled,
  stopPct,
  targetPct,
  maxStopPct,
  maxTargetPct,
  setStopPct,
  setTargetPct,
  onOpen,
}: {
  disabled: boolean
  stopPct: number
  targetPct: number
  maxStopPct: number
  maxTargetPct: number
  setStopPct: (value: number) => void
  setTargetPct: (value: number) => void
  onOpen: (side: TradeSide, stopPct: number, targetPct: number) => void
}) {
  return (
    <>
      <div className="ticketSection">
        <div className="sectionTitle">
          <Gauge size={16} />
          <span>风险模板</span>
        </div>
        <label>
          <span>初始止损 <strong>{stopPct.toFixed(1)}%</strong></span>
          <input disabled={disabled} max={maxStopPct} min="0.3" onChange={(event) => setStopPct(Number(event.target.value))} step="0.1" type="range" value={stopPct} />
        </label>
        <label>
          <span>目标空间 <strong>{targetPct.toFixed(1)}%</strong></span>
          <input disabled={disabled} max={maxTargetPct} min="0.8" onChange={(event) => setTargetPct(Number(event.target.value))} step="0.1" type="range" value={targetPct} />
        </label>
      </div>
      <div className="actionGrid">
        <button className="action long" disabled={disabled} onClick={() => onOpen('LONG', stopPct, targetPct)} type="button">
          <TrendingUp size={18} />
          开多
        </button>
        <button className="action short" disabled={disabled} onClick={() => onOpen('SHORT', stopPct, targetPct)} type="button">
          <TrendingDown size={18} />
          开空
        </button>
      </div>
    </>
  )
}

function PositionBox({
  position,
  currentCandle,
  disabled,
  onClose,
  onMoveStop,
  onMoveTarget,
}: {
  position: Position
  currentCandle: Candle
  disabled: boolean
  onClose: (qty: number) => void
  onMoveStop: (mode: 'BREAKEVEN' | 'TRAIL') => void
  onMoveTarget: () => void
}) {
  const pnl = positionPnl(position, Number(currentCandle.close))
  return (
    <div className="positionBox">
      <div className="positionHeader">
        <strong>{position.side === 'LONG' ? '多单' : '空单'} · {position.qty}%</strong>
        <span className={pnl >= 0 ? 'profit' : 'loss'}>{signed(pnl)}</span>
      </div>
      <div className="levelGrid">
        <span>入场 {formatPrice(position.entryPrice)}</span>
        <span>止损 {formatPrice(position.stopPrice)}</span>
        <span>止盈 {formatPrice(position.targetPrice)}</span>
      </div>
      <div className="actionGrid">
        <button className="action" disabled={disabled} onClick={() => onClose(100)} type="button">
          <X size={18} />
          全平
        </button>
        <button className="action" disabled={disabled} onClick={() => onClose(50)} type="button">
          <ArrowDownToLine size={18} />
          平 50%
        </button>
        <button className="action" disabled={disabled} onClick={() => onClose(25)} type="button">
          <ArrowDownToLine size={18} />
          平 25%
        </button>
        <button className="action" disabled={disabled} onClick={() => onMoveStop('BREAKEVEN')} type="button">
          <Shield size={18} />
          保本
        </button>
      </div>
      <div className="replayControls">
        <button className="iconTextBtn" disabled={disabled} onClick={() => onMoveStop('TRAIL')} type="button">止损跟随</button>
        <button className="iconTextBtn" disabled={disabled} onClick={onMoveTarget} type="button">目标到当前价</button>
      </div>
    </div>
  )
}

function positionPnl(position: Position, price: number) {
  const raw = ((price - position.entryPrice) / position.entryPrice) * 100
  return position.side === 'LONG' ? raw : -raw
}

function signed(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function riskPreset(mode: string, interval: string) {
  if (mode === 'SCALP') {
    return { stopPct: 1.0, targetPct: 2.2, maxStopPct: 4, maxTargetPct: 10 }
  }
  if (interval === '15m') {
    return { stopPct: 1.4, targetPct: 3.2, maxStopPct: 6, maxTargetPct: 14 }
  }
  if (interval === '1h') {
    return { stopPct: 2.2, targetPct: 5.0, maxStopPct: 10, maxTargetPct: 22 }
  }
  if (interval === '4h') {
    return { stopPct: 3.5, targetPct: 8.0, maxStopPct: 14, maxTargetPct: 30 }
  }
  if (interval === '12h') {
    return { stopPct: 5.5, targetPct: 12.0, maxStopPct: 20, maxTargetPct: 42 }
  }
  return { stopPct: 8.0, targetPct: 18.0, maxStopPct: 28, maxTargetPct: 60 }
}

function formatPrice(value: number) {
  if (value >= 1000) {
    return value.toFixed(1)
  }
  if (value >= 10) {
    return value.toFixed(2)
  }
  return value.toFixed(4)
}
