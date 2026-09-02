import { isAgentEvent, type AgentEvent } from './types'

export function encodeSse(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export function parseSse(chunk: string, carry = ''): { events: AgentEvent[]; rest: string } {
  const text = carry + chunk
  const parts = text.split('\n\n')
  const rest = parts.pop() ?? ''
  const events: AgentEvent[] = []

  for (const part of parts) {
    const data = part
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
      .trim()
    if (!data || data === '[DONE]') continue
    try {
      const parsed: unknown = JSON.parse(data)
      if (isAgentEvent(parsed)) events.push(parsed)
    } catch {
      // Ignore malformed SSE frames; the next chunk may complete them via `rest`.
    }
  }

  return { events, rest }
}

export function truncateOutput(text: string, max = 4000): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n…(truncated)`
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export function resultToString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
