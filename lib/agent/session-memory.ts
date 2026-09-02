import type { AgentMode, AgentModel, FileMap } from './types'
import type { TranscriptItem } from './transcript'

export const AGENT_SESSIONS_EVENT = 'cursor-clone:agent-sessions'

const STORAGE_KEY = 'cursor-clone.agent-sessions.v1'

export type StoredAgentSession = {
  id: string
  title: string
  mode: AgentMode
  model: AgentModel
  demo: boolean
  createdAt: number
  updatedAt: number
  items: TranscriptItem[]
  checkpoint: FileMap | null
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadStoredSessions(): StoredAgentSession[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStoredSession)
  } catch {
    return []
  }
}

export function getStoredSession(id: string): StoredAgentSession | undefined {
  return loadStoredSessions().find((session) => session.id === id)
}

export function upsertStoredSession(session: StoredAgentSession): StoredAgentSession[] {
  const current = loadStoredSessions().filter((item) => item.id !== session.id)
  const next = [session, ...current].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40)
  persist(next)
  return next
}

export function removeStoredSession(id: string): StoredAgentSession[] {
  const next = loadStoredSessions().filter((session) => session.id !== id)
  persist(next)
  return next
}

export function subscribeStoredSessions(listener: () => void): () => void {
  if (!canUseStorage()) return () => undefined
  const onCustom = () => listener()
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener(AGENT_SESSIONS_EVENT, onCustom)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(AGENT_SESSIONS_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}

function persist(sessions: StoredAgentSession[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  window.dispatchEvent(new Event(AGENT_SESSIONS_EVENT))
}

function isStoredSession(value: unknown): value is StoredAgentSession {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    (record.mode === 'agent' || record.mode === 'ask' || record.mode === 'plan') &&
    (record.model === 'composer-2.5' || record.model === 'grok-4.5' || record.model === 'auto-smart') &&
    Array.isArray(record.items)
  )
}

export function isToday(ts: number): boolean {
  const date = new Date(ts)
  const now = new Date()
  return date.toDateString() === now.toDateString()
}

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const seconds = Math.max(1, Math.round((now - ts) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}
