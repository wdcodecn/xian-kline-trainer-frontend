import type { AnswerPayload, AnswerResult, BootstrapResponse, Question, ReplayResult } from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

export function getBootstrap() {
  return request<BootstrapResponse>('/api/bootstrap')
}

export function getQuestion(mode: string, interval?: string, symbol?: string) {
  const search = new URLSearchParams({ mode })
  if (interval) {
    search.set('interval', interval)
  }
  if (symbol) {
    search.set('symbol', symbol)
  }
  return request<Question>(`/api/questions/next?${search}`)
}

export function submitAnswer(questionId: string, mode: string, payload: AnswerPayload) {
  return request<AnswerResult>(`/api/questions/${encodeURIComponent(questionId)}/answer?mode=${mode}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getReplay(questionId: string, mode: string) {
  const search = new URLSearchParams({ id: questionId, mode })
  return request<ReplayResult>(`/api/questions/replay?${search}`)
}
