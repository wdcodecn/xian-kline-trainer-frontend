import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Activity, BarChart3, RefreshCw } from 'lucide-react'
import * as React from 'react'
import { ActionPanel } from '~/components/ActionPanel'
import { KlineChart } from '~/components/KlineChart'
import { ResultPanel } from '~/components/ResultPanel'
import { getBootstrap, getQuestion, getReplay } from '~/lib/api'
import {
  closePosition,
  moveStop,
  moveTarget,
  openPosition,
  resolveAutoExit,
} from '~/lib/replayEngine'
import type { Candle, Position, TradeSide, TradingEvent } from '~/lib/types'

export const Route = createFileRoute('/')({
  component: TrainerPage,
})

function TrainerPage() {
  const [mode, setMode] = React.useState('INTRADAY')
  const [interval, setInterval] = React.useState<string | undefined>()
  const [showEma20, setShowEma20] = React.useState(true)
  const [showEma60, setShowEma60] = React.useState(false)
  const [showMacd, setShowMacd] = React.useState(true)
  const [playedCount, setPlayedCount] = React.useState(0)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [finished, setFinished] = React.useState(false)
  const [position, setPosition] = React.useState<Position | undefined>()
  const [lastPlan, setLastPlan] = React.useState<Position | undefined>()
  const [events, setEvents] = React.useState<TradingEvent[]>([])

  const bootstrap = useQuery({ queryKey: ['bootstrap'], queryFn: getBootstrap })
  const question = useQuery({
    queryKey: ['question', mode, interval],
    queryFn: () => getQuestion(mode, interval),
  })
  const replay = useQuery({
    enabled: Boolean(question.data?.id),
    queryKey: ['replay', question.data?.id, mode],
    queryFn: () => getReplay(question.data!.id, mode),
  })

  const activeMode = bootstrap.data?.modes.find((item) => item.key === mode)
  const revealBars = replay.data?.revealBars ?? []
  const visibleRevealBars = revealBars.slice(0, playedCount)
  const currentCandle = visibleRevealBars.at(-1) ?? question.data?.contextBars.at(-1)
  const isBusy = question.isLoading || replay.isLoading
  const progress = revealBars.length > 0 ? (playedCount / revealBars.length) * 100 : 0

  React.useEffect(() => {
    resetReplay()
  }, [question.data?.id])

  const advanceOne = React.useCallback(() => {
    if (finished || playedCount >= revealBars.length) {
      setIsPlaying(false)
      setFinished(true)
      return
    }
    const nextCandle = revealBars[playedCount]
    setPlayedCount((count) => count + 1)
    if (position) {
      const exit = resolveAutoExit(position, nextCandle)
      if (!exit) {
        return
      }
      setEvents((items) => [...items, exit.event])
      setLastPlan(position)
      setPosition(exit.next)
    }
  }, [finished, playedCount, position, revealBars])

  React.useEffect(() => {
    if (!isPlaying || finished) {
      return
    }
    const timer = window.setTimeout(advanceOne, 650)
    return () => window.clearTimeout(timer)
  }, [advanceOne, finished, isPlaying])

  function resetReplay() {
    setPlayedCount(0)
    setIsPlaying(false)
    setFinished(false)
    setPosition(undefined)
    setLastPlan(undefined)
    setEvents([])
  }

  function nextQuestion() {
    resetReplay()
    void question.refetch()
  }

  function changeMode(nextMode: string) {
    setMode(nextMode)
    setInterval(undefined)
    resetReplay()
  }

  function changeInterval(nextInterval: string) {
    setInterval(interval === nextInterval ? undefined : nextInterval)
    resetReplay()
  }

  function open(side: TradeSide, stopPct: number, targetPct: number) {
    if (!currentCandle || position || finished) {
      return
    }
    const opened = openPosition(side, currentCandle, stopPct, targetPct)
    setPosition(opened.position)
    setLastPlan(opened.position)
    setEvents((items) => [...items, opened.event])
  }

  function close(qty: number) {
    if (!position || !currentCandle || finished) {
      return
    }
    const closed = closePosition(position, currentCandle, qty, qty >= position.qty ? 'CLOSE' : 'PARTIAL')
    setPosition(closed.next)
    setLastPlan(closed.next ?? position)
    setEvents((items) => [...items, closed.event])
  }

  function updateStop(kind: 'BREAKEVEN' | 'TRAIL') {
    if (!position || !currentCandle || finished) {
      return
    }
    const moved = moveStop(position, currentCandle, kind)
    setPosition(moved.position)
    setLastPlan(moved.position)
    setEvents((items) => [...items, moved.event])
  }

  function updateTarget() {
    if (!position || !currentCandle || finished) {
      return
    }
    const moved = moveTarget(position, currentCandle)
    setPosition(moved.position)
    setLastPlan(moved.position)
    setEvents((items) => [...items, moved.event])
  }

  function finishReplay() {
    const result = playRemaining(position, revealBars.slice(playedCount))
    setPlayedCount(revealBars.length)
    setFinished(true)
    setIsPlaying(false)
    setPosition(result.position)
    setLastPlan(result.lastPlan ?? lastPlan)
    if (result.events.length > 0) {
      setEvents((items) => [...items, ...result.events])
    }
  }

  return (
    <main className="appShell">
      <header className="terminalHeader">
        <div className="brandBlock">
          <p className="eyebrow">Replay Perp</p>
          <h1>{question.data ? pairLabel(question.data.symbol) : 'PERP'}</h1>
        </div>
        <div className="marketStats">
          <Stat label="周期" value={question.data?.interval ?? interval ?? '--'} />
          <Stat label="阶段" value={activeMode?.label ?? '--'} />
          <Stat label="回放" value={`${playedCount}/${revealBars.length || '--'}`} />
        </div>
        <button className="iconBtn" onClick={nextQuestion} title="换一题" type="button">
          <RefreshCw size={20} />
        </button>
      </header>

      <section className="terminalControls">
        <div className="segmented">
          {bootstrap.data?.modes.map((item) => (
            <button className={mode === item.key ? 'seg selected' : 'seg'} key={item.key} onClick={() => changeMode(item.key)} type="button">
              {item.label}
            </button>
          ))}
        </div>
        <div className="segmented compact">
          {(activeMode?.intervals ?? ['15m', '1h']).map((item) => (
            <button className={interval === item ? 'seg selected' : 'seg'} key={item} onClick={() => changeInterval(item)} type="button">
              {item}
            </button>
          ))}
        </div>
        <div className="segmented compact">
          <button className={showEma20 ? 'seg selected' : 'seg'} onClick={() => setShowEma20(!showEma20)} type="button">EMA20</button>
          <button className={showEma60 ? 'seg selected' : 'seg'} onClick={() => setShowEma60(!showEma60)} type="button">EMA60</button>
          <button className={showMacd ? 'seg selected' : 'seg'} onClick={() => setShowMacd(!showMacd)} type="button">MACD</button>
        </div>
      </section>

      {isBusy ? <div className="panel loading">正在加载真实 K 线...</div> : null}
      {question.error || replay.error ? <div className="panel errorBox">{String(question.error ?? replay.error)}</div> : null}

      {question.data && currentCandle ? (
        <section className="terminalGrid">
          <div className="chartColumn">
            <section className="chartPanel">
              <div className="chartHeader">
                <div>
                  <p className="eyebrow">真实 K 线</p>
                  <h2>{finished ? question.data.featureLabel : '行情回放'}</h2>
                </div>
                <div className="chartBadges">
                  <span><Activity size={15} /> {finished ? question.data.marketState : '只显示已播放 K'}</span>
                  <span><BarChart3 size={15} /> {formatMove(question.data.contextBars, currentCandle)}</span>
                </div>
              </div>
              <KlineChart
                contextBars={question.data.contextBars}
                events={events}
                position={position ?? lastPlan}
                revealBars={visibleRevealBars}
                showEma20={showEma20}
                showEma60={showEma60}
                showMacd={showMacd}
              />
              <div className="replayBar">
                <span style={{ width: `${progress}%` }} />
              </div>
            </section>
            <ResultPanel
              currentCandle={currentCandle}
              events={events}
              finished={finished}
              playedCount={playedCount}
              position={position}
              question={question.data}
              revealBars={visibleRevealBars}
              review={replay.data?.review}
              totalCount={revealBars.length}
            />
          </div>
          <ActionPanel
            currentCandle={currentCandle}
            disabled={isBusy || revealBars.length === 0}
            finished={finished}
            isPlaying={isPlaying}
            onClose={close}
            onFinish={finishReplay}
            onMoveStop={updateStop}
            onMoveTarget={updateTarget}
            onNextQuestion={nextQuestion}
            onOpen={open}
            onStep={advanceOne}
            onTogglePlay={() => setIsPlaying((value) => !value)}
            playedCount={playedCount}
            position={position}
            question={question.data}
            totalCount={revealBars.length}
          />
        </section>
      ) : null}

      {finished ? (
        <button className="nextBtn" onClick={nextQuestion} type="button">
          继续下一题
        </button>
      ) : null}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatMove(contextBars: Candle[], candle: Candle) {
  const base = Number(contextBars[0]?.open ?? candle.open)
  const move = ((Number(candle.close) - base) / base) * 100
  return `${move > 0 ? '+' : ''}${move.toFixed(2)}%`
}

function pairLabel(symbol: string) {
  return `${symbol.replace('USDT', '')}-PERP`
}

function playRemaining(position: Position | undefined, candles: Candle[]) {
  let nextPosition = position
  let lastPlan = position
  const events: TradingEvent[] = []
  for (const candle of candles) {
    if (!nextPosition) {
      break
    }
    const exit = resolveAutoExit(nextPosition, candle)
    if (exit) {
      lastPlan = nextPosition
      events.push(exit.event)
      nextPosition = exit.next
    }
  }
  return { position: nextPosition, lastPlan, events }
}
