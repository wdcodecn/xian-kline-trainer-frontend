import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type HistogramData,
  HistogramSeries,
  type IPriceLine,
  LineSeries,
  LineStyle,
  type LineData,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
} from 'lightweight-charts'
import * as React from 'react'
import type { Candle, Position, TradingEvent } from '~/lib/types'

type Props = {
  contextBars: Candle[]
  revealBars?: Candle[]
  showEma20?: boolean
  showEma60?: boolean
  showMacd?: boolean
  position?: Position
  events?: TradingEvent[]
}

export function KlineChart({ contextBars, revealBars = [], showEma20 = true, showEma60 = false, showMacd = true, position, events = [] }: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const chartRef = React.useRef<IChartApi | null>(null)
  const seriesRef = React.useRef<ISeriesApi<'Candlestick'> | null>(null)
  const ema20Ref = React.useRef<ISeriesApi<'Line'> | null>(null)
  const ema60Ref = React.useRef<ISeriesApi<'Line'> | null>(null)
  const macdRef = React.useRef<ISeriesApi<'Histogram'> | null>(null)
  const macdLineRef = React.useRef<ISeriesApi<'Line'> | null>(null)
  const signalLineRef = React.useRef<ISeriesApi<'Line'> | null>(null)
  const markersRef = React.useRef<ISeriesMarkersPluginApi<CandlestickData['time']> | null>(null)
  const priceLinesRef = React.useRef<IPriceLine[]>([])
  const barCountRef = React.useRef(0)

  React.useEffect(() => {
    if (!containerRef.current) {
      return
    }
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: '#11171f' },
        textColor: '#d7e1ea',
      },
      grid: {
        vertLines: { color: '#1f2b36' },
        horzLines: { color: '#1f2b36' },
      },
      rightPriceScale: { borderColor: '#263543' },
      timeScale: {
        barSpacing: 9.5,
        borderColor: '#263543',
        rightOffset: 28,
        timeVisible: true,
      },
      localization: {
        priceFormatter: formatPrice,
      },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#20c997',
      downColor: '#ff6b6b',
      wickUpColor: '#20c997',
      wickDownColor: '#ff6b6b',
      borderVisible: false,
    })
    const ema20 = chart.addSeries(LineSeries, { color: '#ffc857', lineWidth: 1, priceLineVisible: false })
    const ema60 = chart.addSeries(LineSeries, { color: '#7aa2ff', lineWidth: 1, priceLineVisible: false })
    const macd = chart.addSeries(HistogramSeries, { priceFormat: { type: 'price', precision: 3 }, priceLineVisible: false }, 1)
    const macdLine = chart.addSeries(LineSeries, { color: '#ffc857', lineWidth: 1, priceLineVisible: false }, 1)
    const signalLine = chart.addSeries(LineSeries, { color: '#7aa2ff', lineWidth: 1, priceLineVisible: false }, 1)
    chart.panes()[0]?.setStretchFactor(4)
    chart.panes()[1]?.setStretchFactor(1)
    chartRef.current = chart
    seriesRef.current = series
    ema20Ref.current = ema20
    ema60Ref.current = ema60
    macdRef.current = macd
    macdLineRef.current = macdLine
    signalLineRef.current = signalLine
    markersRef.current = createSeriesMarkers(series, [])
    return () => chart.remove()
  }, [])

  React.useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    const ema20 = ema20Ref.current
    const ema60 = ema60Ref.current
    const macd = macdRef.current
    const macdLine = macdLineRef.current
    const signalLine = signalLineRef.current
    if (!series || !chart) {
      return
    }
    const allBars = [...contextBars, ...revealBars]
    series.setData(allBars.map(toChartCandle))
    ema20?.setData(showEma20 ? exponentialAverage(allBars, 20) : [])
    ema60?.setData(showEma60 ? exponentialAverage(allBars, 60) : [])
    const macdData = macdValues(allBars)
    macd?.setData(showMacd ? macdData.histogram : [])
    macdLine?.setData(showMacd ? macdData.macd : [])
    signalLine?.setData(showMacd ? macdData.signal : [])
    if (barCountRef.current !== allBars.length) {
      setDefaultViewport(chart, allBars.length)
      barCountRef.current = allBars.length
    }
  }, [contextBars, revealBars, showEma20, showEma60, showMacd])

  React.useEffect(() => {
    const series = seriesRef.current
    if (!series) {
      return
    }
    markersRef.current?.setMarkers(chartMarkers(contextBars, revealBars, events))
    replaceTradeLines(series, priceLinesRef.current, position)
  }, [contextBars, revealBars, events, position])

  return (
    <div className="chartStage">
      <div ref={containerRef} className="chartSurface" />
      {position ? <TradeBadge position={position} /> : null}
    </div>
  )
}

function toChartCandle(candle: Candle): CandlestickData {
  return {
    time: Math.floor(candle.openTime / 1000) as CandlestickData['time'],
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  }
}

function exponentialAverage(candles: Candle[], length: number): LineData[] {
  if (candles.length === 0) {
    return []
  }
  const alpha = 2 / (length + 1)
  let ema = Number(candles[0].close)
  return candles.map((candle) => {
    ema = Number(candle.close) * alpha + ema * (1 - alpha)
    return {
      time: Math.floor(candle.openTime / 1000) as LineData['time'],
      value: ema,
    }
  })
}

function macdValues(candles: Candle[]) {
  const closes = candles.map((candle) => Number(candle.close))
  const fast = emaNumbers(closes, 12)
  const slow = emaNumbers(closes, 26)
  const macdRaw = fast.map((value, index) => value - slow[index])
  const signalRaw = emaNumbers(macdRaw, 9)
  return {
    histogram: candles.map((candle, index) => ({
      time: Math.floor(candle.openTime / 1000) as HistogramData['time'],
      value: macdRaw[index] - signalRaw[index],
      color: macdRaw[index] >= signalRaw[index] ? 'rgba(32, 201, 151, 0.8)' : 'rgba(255, 107, 107, 0.8)',
    })),
    macd: candles.map((candle, index) => ({
      time: Math.floor(candle.openTime / 1000) as LineData['time'],
      value: macdRaw[index],
    })),
    signal: candles.map((candle, index) => ({
      time: Math.floor(candle.openTime / 1000) as LineData['time'],
      value: signalRaw[index],
    })),
  }
}

function emaNumbers(values: number[], length: number) {
  if (values.length === 0) {
    return []
  }
  const alpha = 2 / (length + 1)
  let ema = values[0]
  return values.map((value) => {
    ema = value * alpha + ema * (1 - alpha)
    return ema
  })
}

function chartMarkers(contextBars: Candle[], revealBars: Candle[], events: TradingEvent[]) {
  const decision = contextBars[contextBars.length - 1]
  if (!decision) {
    return []
  }
  const firstReveal = revealBars[0]
  const lastReveal = revealBars[revealBars.length - 1]
  const markers: SeriesMarker<CandlestickData['time']>[] = [
    {
      time: Math.floor(decision.openTime / 1000) as CandlestickData['time'],
      position: 'aboveBar' as const,
      shape: 'square' as const,
      color: '#ffc857',
      text: '回放开始',
    },
  ]
  if (firstReveal) {
    markers.push({
      time: Math.floor(firstReveal.openTime / 1000) as CandlestickData['time'],
      position: 'belowBar' as const,
      shape: 'circle' as const,
      color: '#7aa2ff',
      text: '后续开始',
    })
  }
  if (lastReveal) {
    markers.push({
      time: Math.floor(lastReveal.openTime / 1000) as CandlestickData['time'],
      position: 'aboveBar' as const,
      shape: 'circle' as const,
      color: '#f4f7fa',
      text: '当前 K',
    })
  }
  for (const event of events) {
    markers.push({
      time: Math.floor(event.time / 1000) as CandlestickData['time'],
      position: markerPosition(event),
      shape: markerShape(event),
      color: markerColor(event),
      text: event.kind === 'OPEN' ? '' : event.note,
    })
  }
  return markers
}

function markerPosition(event: TradingEvent) {
  if (event.kind === 'OPEN') {
    return event.side === 'SHORT' ? 'aboveBar' as const : 'belowBar' as const
  }
  if (event.kind === 'STOP') {
    return event.side === 'SHORT' ? 'aboveBar' as const : 'belowBar' as const
  }
  if (event.kind === 'TAKE') {
    return event.side === 'SHORT' ? 'belowBar' as const : 'aboveBar' as const
  }
  return 'inBar' as const
}

function markerShape(event: TradingEvent) {
  if (event.kind === 'OPEN') {
    return event.side === 'SHORT' ? 'arrowDown' as const : 'arrowUp' as const
  }
  if (event.kind === 'STOP') {
    return 'square' as const
  }
  if (event.kind === 'TAKE') {
    return 'circle' as const
  }
  return 'square' as const
}

function markerColor(event: TradingEvent) {
  if (event.kind === 'OPEN') {
    return '#f4f7fa'
  }
  if (event.kind === 'STOP') {
    return '#ff2f92'
  }
  if (event.kind === 'TAKE') {
    return '#00d5ff'
  }
  if (event.kind === 'PARTIAL') {
    return '#c084fc'
  }
  return '#ffc857'
}

function setDefaultViewport(chart: IChartApi, barCount: number) {
  if (barCount <= 0) {
    return
  }
  const visibleBars = Math.min(115, barCount)
  const rightPaddingBars = 28
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, barCount - visibleBars),
    to: barCount - 1 + rightPaddingBars,
  })
}

function replaceTradeLines(
  series: ISeriesApi<'Candlestick'>,
  currentLines: IPriceLine[],
  position: Position | undefined,
) {
  for (const line of currentLines) {
    series.removePriceLine(line)
  }
  currentLines.length = 0
  if (!position) {
    return
  }
  const levels = [
    { label: entryLabel(position), price: position.entryPrice, color: '#f4f7fa' },
    { label: '止损', price: position.stopPrice, color: '#ff6b6b' },
    { label: '止盈', price: position.targetPrice, color: '#20c997' },
  ]
  for (const level of levels) {
    if (level.price == null) {
      continue
    }
    currentLines.push(series.createPriceLine({
      price: Number(level.price),
      color: level.color,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: level.label,
    }))
  }
}

function TradeBadge({ position }: { position: Position }) {
  return (
    <div className={`chartTradeBadge ${position.side === 'LONG' ? 'long' : 'short'}`}>
      <strong>{entryLabel(position)}</strong>
      <span>入场 {formatPrice(position.entryPrice)}</span>
      <span>止损 {formatPrice(position.stopPrice)}</span>
      <span>止盈 {formatPrice(position.targetPrice)}</span>
    </div>
  )
}

function entryLabel(position: Position) {
  return position.side === 'LONG' ? '开多' : '开空'
}

function formatPrice(price: number) {
  return price >= 1000 ? price.toFixed(1) : price >= 10 ? price.toFixed(2) : price.toFixed(4)
}
