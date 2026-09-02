import { parseSse } from './protocol'
import type {
  AgentEvent,
  CancelRunRequest,
  CreateSessionRequest,
  CreateSessionResponse,
  RunPromptRequest,
} from './types'

export { parseSse } from './protocol'
export type { AgentEvent, CreateSessionResponse, RunPromptRequest }

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export async function createSession(
  input: CreateSessionRequest,
): Promise<CreateSessionResponse> {
  const response = await fetch('/api/agent/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await readJson<CreateSessionResponse & { error?: string }>(response)
  if (!response.ok) {
    throw new Error(body.error || 'Failed to create agent session')
  }
  return body
}

export type RunPromptHandlers = {
  onEvent: (event: AgentEvent) => void
  signal?: AbortSignal
}

export async function runPrompt(input: RunPromptRequest, handlers: RunPromptHandlers): Promise<void> {
  const response = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(input),
    signal: handlers.signal,
  })

  if (!response.ok) {
    const body = await readJson<{ error?: string }>(response).catch(() => ({ error: undefined }))
    throw new Error(body.error || `Agent run failed (${response.status})`)
  }

  if (!response.body) {
    throw new Error('Agent run returned an empty body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let rest = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const parsed = parseSse(decoder.decode(value, { stream: true }), rest)
    rest = parsed.rest
    for (const event of parsed.events) handlers.onEvent(event)
  }

  if (rest.trim()) {
    const parsed = parseSse('\n\n', rest)
    for (const event of parsed.events) handlers.onEvent(event)
  }
}

export async function cancelRun(sessionId: string): Promise<void> {
  const payload: CancelRunRequest = { sessionId }
  const response = await fetch('/api/agent/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const body = await readJson<{ error?: string }>(response).catch(() => ({ error: undefined }))
    throw new Error(body.error || 'Failed to cancel run')
  }
}
