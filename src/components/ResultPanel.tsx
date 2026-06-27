import { BarChart3, Clock3, ListChecks } from 'lucide-react'
import type * as React from 'react'
import { eventRTotal, unrealizedR } from '~/lib/replayEngine'
import type { Candle, Position, Question, ReviewMeta, TradingEvent } from '~/lib/types'

type Props = {
  question: Question
  review?: ReviewMeta
  currentCandle: Candle
  revealBars: Candle[]
  events: TradingEvent[]
  finished: boolean
  playedCount: number
  totalCount: number
  position?: Position
}

export function ResultPanel({ question, review, currentCandle, revealBars, events, finished, playedCount, totalCount, position }: Props) {
  const closedR = eventRTotal(events)
  const liveR = unrealizedR(position, currentCandle) * ((position?.qty ?? 0) / 100)
  const totalR = closedR + liveR
  const tradeCount = events.filter((event) => event.kind === 'OPEN').length
  const behavior = behaviorReview(question, revealBars, events, totalR, tradeCount)

  return (
    <section className={finished ? 'accountPanel revealed' : 'accountPanel'}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">{finished ? 'Behavior Review' : 'Account'}</p>
          <h2>{finished ? '临盘行为复盘' : '持仓与成交'}</h2>
        </div>
        <span className="hiddenCount">{playedCount}/{totalCount}</span>
      </div>

      {finished ? (
        <div className="behaviorReview">
          <div className="reviewMission">
            <span>训练目的</span>
            <strong>不是猜涨跌，是校准入场、止损、持仓和认错行为，把大量真实走势压缩成盘感。</strong>
          </div>
          <div className="reviewGrid">
            <ReviewCard label="本题训练" value={trainingTarget(question)} />
            <ReviewCard label="行为判定" value={behavior.conclusion} strong />
            <ReviewCard label="主要问题" value={behavior.reason} />
            <ReviewCard label="下次规则" value={behavior.nextRule} strong />
          </div>
        </div>
      ) : null}

      {finished && review ? (
        <p className="quiet">
          题源：{pairLabel(review.symbol)} · {review.interval} · 回放起点 {formatTime(review.decisionTime)}
          {' '}· 可播放区间 {formatTime(review.revealStartTime)} - {formatTime(review.revealEndTime)}
        </p>
      ) : null}

      <div className="metricStrip">
        <Metric icon={<BarChart3 size={18} />} label="总 R" value={totalR.toFixed(2)} />
        <Metric icon={<ListChecks size={18} />} label="事件" value={`${events.length}`} />
        <Metric icon={<Clock3 size={18} />} label="已播放" value={`${playedCount}/${totalCount}`} />
      </div>

      {events.length > 0 ? (
        <div className="eventList">
          <div className="eventHead">
            <span>动作</span>
            <span>价格</span>
            <span>结果</span>
          </div>
          {events.slice(-6).map((event) => (
            <div className="eventRow" key={event.id}>
              <span>{event.note}</span>
              <span>{formatPrice(event.price)}</span>
              <strong>{event.rMultiple == null ? '--' : `${event.rMultiple.toFixed(2)}R`}</strong>
            </div>
          ))}
        </div>
      ) : <p className="quiet">等待回放和交易记录。</p>}
    </section>
  )
}

function behaviorReview(
  question: Question,
  revealBars: Candle[],
  events: TradingEvent[],
  totalR: number,
  tradeCount: number,
) {
  if (tradeCount === 0) {
    return {
      conclusion: '这轮核心是过滤，不是错过',
      reason: '如果整段都没有出现清晰优势，不开仓是有效训练；但如果后面出现明显突破，要复盘你缺的是触发条件还是执行勇气。',
      nextRule: '下次先写一句规则：只有突破后回踩不破、或假跌破收回，才允许进场；否则继续等。',
    }
  }
  const open = events.find((event) => event.kind === 'OPEN')
  const stopped = events.some((event) => event.kind === 'STOP')
  const take = events.some((event) => event.kind === 'TAKE')
  const partial = events.some((event) => event.kind === 'PARTIAL')
  const stop = events.find((event) => event.kind === 'STOP')
  const afterStop = open && stop ? postStopMove(open, stop, revealBars) : undefined
  const entry = open ? entryContext(question.contextBars, revealBars, open) : undefined
  if (stopped && afterStop?.wentYourWay) {
    return {
      conclusion: '方向可能没错，错在入场位置和止损处理',
      reason: `${entry?.chase ? '你是在近期区间偏高的位置追进，' : ''}价格先扫掉止损，后面又沿你的方向走出 ${afterStop.moveR.toFixed(1)}R 空间。这种亏损不是“看多/看空错”，而是没有等确认，止损也放在容易被波动清掉的位置。`,
      nextRule: '下次遇到这种走势，不要第一根冲动追；等回踩不破、重新站回开仓价上方，或止损被扫后再次收回关键位，再考虑重入。',
    }
  }
  if (stopped) {
    return {
      conclusion: '这笔主要是低质量入场',
      reason: `${entry?.chase ? '入场已经接近近期区间末端，' : ''}止损后行情没有快速修复，说明当时优势不够明确。亏损本身不是问题，问题是开仓前没有足够结构支持。`,
      nextRule: '下次先问一句：如果现在不追，市场给不给我更好的二次位置？给不出答案就不下单。',
    }
  }
  if (take && totalR >= 1) {
    return {
      conclusion: '这笔抓到了有效推进',
      reason: '入场后价格到达目标，说明方向和空间匹配。但仍要复盘入场是否来自结构确认，而不是刚好撞上行情。',
      nextRule: '保留这类样本：记录触发前 5-10 根 K 的共同点，训练以后快速识别同类位置。',
    }
  }
  if (partial) {
    return {
      conclusion: '重点复盘减仓后的持仓质量',
      reason: '部分平仓说明你开始管理仓位了，但训练重点是：减仓之后是否还保留了足够的趋势仓，还是太早把优势切掉。',
      nextRule: '下次部分止盈后，把剩余仓位的失效位写清楚；只要结构没坏，不要因为浮盈波动乱平。',
    }
  }
  return {
    conclusion: totalR >= 0 ? '结果可接受，但还要看过程' : '结果不好，先拆执行问题',
    reason: '复盘不要只看赚亏，要看入场、持仓、退出是否都能用当时已经出现的 K 线解释。',
    nextRule: '下次开仓前必须能说清楚三件事：为什么现在进、错了在哪里认错、对了在哪里减仓或持有。',
  }
}

function trainingTarget(question: Question) {
  if (question.feature === 'STRONG_TREND_PULLBACK') {
    return '顺势回调里等确认，不追第一根，止损要放在结构失效位。'
  }
  if (question.feature === 'BREAKOUT_PULLBACK') {
    return '突破后判断是否真跟随，重点练回踩确认和二次入场。'
  }
  if (question.feature === 'FALSE_BREAKOUT_HIGH' || question.feature === 'FALSE_BREAKOUT_LOW') {
    return '识别诱多/诱空，不被突破瞬间骗进去，训练反向确认。'
  }
  if (question.feature === 'RANGE_MIDDLE_NO_TRADE') {
    return '区间中部练不交易，等边界、假突破或明确失效信号。'
  }
  if (question.feature === 'CLIMAX_EXHAUSTION') {
    return '识别趋势末端加速，避免情绪化追单。'
  }
  if (question.feature === 'REVERSAL_ATTEMPT') {
    return '训练反转尝试的确认质量，不提前赌拐点。'
  }
  return '训练有限信息下的开仓、退出、风控和认错质量。'
}

function postStopMove(open: TradingEvent, stop: TradingEvent, revealBars: Candle[]) {
  const after = revealBars.filter((candle) => candle.openTime > stop.time)
  const risk = Math.abs(open.price - stop.price)
  if (risk <= 0 || after.length === 0) {
    return undefined
  }
  const best = open.side === 'LONG'
    ? Math.max(...after.map((candle) => Number(candle.high)))
    : Math.min(...after.map((candle) => Number(candle.low)))
  const moveR = open.side === 'LONG' ? (best - open.price) / risk : (open.price - best) / risk
  return { moveR, wentYourWay: moveR >= 1.2 }
}

function entryContext(contextBars: Candle[], revealBars: Candle[], open: TradingEvent) {
  const bars = [...contextBars, ...revealBars]
  const index = bars.findIndex((candle) => candle.openTime === open.time)
  const start = Math.max(0, index - 48)
  const window = bars.slice(start, index + 1)
  const high = Math.max(...window.map((candle) => Number(candle.high)))
  const low = Math.min(...window.map((candle) => Number(candle.low)))
  const range = Math.max(0.000001, high - low)
  const position = (open.price - low) / range
  const chase = open.side === 'LONG' ? position > 0.72 : position < 0.28
  return { chase }
}

function formatTime(time: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time))
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

function pairLabel(symbol: string) {
  return `${symbol.replace('USDT', '')}-PERP`
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ReviewCard({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'reviewCard strong' : 'reviewCard'}>
      <span>{label}</span>
      <p>{value}</p>
    </div>
  )
}
