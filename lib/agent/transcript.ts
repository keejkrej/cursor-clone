import type { AgentEvent, PendingDiff, ToolCallEvent } from './types'

export type TranscriptItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'thinking'; id: string; text: string; durationMs?: number }
  | { kind: 'tool'; id: string; event: ToolCallEvent }
  | { kind: 'diff'; id: string; diff: PendingDiff; rejected?: boolean; applied?: boolean }
  | { kind: 'plan'; id: string; markdown: string; approved?: boolean }
  | { kind: 'error'; id: string; text: string }
  | { kind: 'status'; id: string; text: string }

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function titleFromPrompt(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return 'New Agent'
  return compact.length > 48 ? `${compact.slice(0, 45)}…` : compact
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

export function thoughtLabel(durationMs?: number): string {
  if (!durationMs || durationMs <= 0) return 'Thinking'
  const seconds = Math.max(1, Math.round(durationMs / 1000))
  return `Thought for ${seconds}s`
}

export function formatToolCommand(event: ToolCallEvent): string {
  const args = event.args ?? {}
  const name = event.name.toLowerCase()
  if ((name === 'shell' || name === 'bash') && typeof args.command === 'string') {
    return `$ ${args.command}`
  }
  if (typeof args.path === 'string') return args.path
  if (typeof args.pattern === 'string') {
    const glob = typeof args.glob === 'string' ? `  ${args.glob}` : ''
    return `${args.pattern}${glob}`
  }
  if (typeof args.glob === 'string') return args.glob
  const keys = Object.keys(args)
  if (keys.length === 0) return ''
  try {
    return JSON.stringify(args)
  } catch {
    return ''
  }
}

export function clipOutput(text: string, maxLines = 24, maxChars = 2400): string {
  if (text.length <= maxChars) {
    const lines = text.split('\n')
    if (lines.length <= maxLines) return text
    return `${lines.slice(0, maxLines).join('\n')}\n…`
  }
  const sliced = text.slice(0, maxChars)
  const lines = sliced.split('\n')
  const kept = lines.length > maxLines ? lines.slice(0, maxLines).join('\n') : sliced
  return `${kept}\n…`
}

export function collectDiffs(items: TranscriptItem[]): Array<Extract<TranscriptItem, { kind: 'diff' }>> {
  const latest = new Map<string, Extract<TranscriptItem, { kind: 'diff' }>>()
  for (const item of items) {
    if (item.kind === 'diff') latest.set(item.diff.path, item)
  }
  return [...latest.values()]
}

export function reduceEvent(current: TranscriptItem[], event: AgentEvent): TranscriptItem[] {
  if (event.type === 'user') {
    const last = current.at(-1)
    if (last?.kind === 'user' && last.text === event.text) return current
    return [...current, { kind: 'user', id: uid(), text: event.text }]
  }
  if (event.type === 'assistant') {
    const last = current.at(-1)
    if (last?.kind === 'assistant') {
      const nextText = event.delta
        ? last.text + event.text
        : event.text.startsWith(last.text)
          ? event.text
          : last.text + event.text
      return [...current.slice(0, -1), { ...last, text: nextText }]
    }
    return [...current, { kind: 'assistant', id: uid(), text: event.text }]
  }
  if (event.type === 'thinking') {
    const last = current.at(-1)
    if (last?.kind === 'thinking' && !event.durationMs) {
      const extra = event.text ? (last.text ? `${last.text}\n${event.text}` : event.text) : last.text
      return [...current.slice(0, -1), { ...last, text: extra }]
    }
    if (last?.kind === 'thinking' && event.durationMs) {
      return [
        ...current.slice(0, -1),
        { ...last, durationMs: event.durationMs, text: last.text || event.text },
      ]
    }
    return [...current, { kind: 'thinking', id: uid(), text: event.text, durationMs: event.durationMs }]
  }
  if (event.type === 'tool_call') {
    const index = current.findIndex((item) => item.kind === 'tool' && item.event.id === event.id)
    if (index >= 0) {
      const next = current.slice()
      next[index] = { kind: 'tool', id: current[index]!.id, event }
      return next
    }
    return [...current, { kind: 'tool', id: event.id, event }]
  }
  if (event.type === 'diff') {
    return [...current, { kind: 'diff', id: event.diff.id, diff: event.diff }]
  }
  if (event.type === 'plan') {
    return [...current, { kind: 'plan', id: uid(), markdown: event.plan.markdown }]
  }
  if (event.type === 'error') {
    return [...current, { kind: 'error', id: uid(), text: event.message }]
  }
  if (event.type === 'status' && event.message) {
    return [...current, { kind: 'status', id: uid(), text: event.message }]
  }
  return current
}

export function markDiff(
  items: TranscriptItem[],
  diffId: string,
  patch: { rejected?: boolean; applied?: boolean },
): TranscriptItem[] {
  return items.map((item) =>
    item.kind === 'diff' && item.diff.id === diffId ? { ...item, ...patch } : item,
  )
}

export function markPlanApproved(items: TranscriptItem[], planId: string): TranscriptItem[] {
  return items.map((item) => (item.kind === 'plan' && item.id === planId ? { ...item, approved: true } : item))
}
