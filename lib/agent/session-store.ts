import { getPlaygroundRoot } from '@/lib/workspace/files'

import {
  DEFAULT_AGENT_MODEL,
  type AgentMode,
  type AgentModel,
  type AgentSession,
  type FileMap,
} from './types'

type LiveSession = AgentSession & {
  abort: AbortController | null
}

type SessionStore = Map<string, LiveSession>

const globalForSessions = globalThis as typeof globalThis & {
  __cursorCloneSessions?: SessionStore
}

function store(): SessionStore {
  if (!globalForSessions.__cursorCloneSessions) {
    globalForSessions.__cursorCloneSessions = new Map()
  }
  return globalForSessions.__cursorCloneSessions
}

export function createAgentSession(input: {
  mode: AgentMode
  model: AgentModel
  cwd?: string
  demo: boolean
}): LiveSession {
  const session: LiveSession = {
    id: crypto.randomUUID(),
    mode: input.mode,
    model: input.model || DEFAULT_AGENT_MODEL,
    demo: input.demo,
    playgroundPath: input.cwd || getPlaygroundRoot(),
    checkpoint: null,
    createdAt: Date.now(),
    history: [],
    abort: null,
  }
  store().set(session.id, session)
  return session
}

export function getAgentSession(id: string): LiveSession | undefined {
  return store().get(id)
}

export function saveAgentSession(session: LiveSession): void {
  store().set(session.id, session)
}

export function beginRun(session: LiveSession): AbortController {
  session.abort?.abort()
  const abort = new AbortController()
  session.abort = abort
  saveAgentSession(session)
  return abort
}

export function endRun(session: LiveSession, abort?: AbortController): void {
  if (abort && session.abort === abort) session.abort = null
  saveAgentSession(session)
}

export function requestCancel(sessionId: string): boolean {
  const session = store().get(sessionId)
  if (!session) return false
  session.abort?.abort()
  return true
}

export function snapshotCheckpoint(session: LiveSession, files: FileMap): FileMap {
  session.checkpoint = { ...files }
  saveAgentSession(session)
  return session.checkpoint
}

export type { LiveSession }
