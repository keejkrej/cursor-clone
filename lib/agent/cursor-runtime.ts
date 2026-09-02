/**
 * Server-only Cursor Agent adapter.
 *
 * Prefer the local `@cursor/sdk` (`Agent.create` / `Agent.resume` with
 * `local.cwd` = playground). If the SDK cannot load (native binary / bundler)
 * fall back to Cloud Agents REST at https://api.cursor.com with
 * `Authorization: Bearer $CURSOR_API_KEY` (create agent + stream run).
 *
 * Never import this module from a 'use client' file. CURSOR_API_KEY stays
 * server-side.
 */

import { unifiedDiff } from './diff'
import { asRecord, resultToString, truncateOutput } from './protocol'
import type { LiveSession } from './session-store'
import type { AgentEvent, AgentMode, AgentModel, FileMap, PendingDiff, ToolCallEvent, TokenUsage } from './types'
import { resolveModelId } from './types'

import { getPlaygroundRoot, readWorkspaceFile } from '@/lib/workspace/files'

type SdkUsage = Partial<TokenUsage>

type SdkRun = {
  id: string
  stream: () => AsyncIterable<unknown>
  wait: () => Promise<{
    status?: string
    error?: { message?: string; code?: string }
    usage?: SdkUsage
  }>
  cancel: () => Promise<void>
}

type SdkAgent = {
  agentId: string
  send: (prompt: string, options?: Record<string, unknown>) => Promise<SdkRun>
}

type SdkModule = {
  Agent: {
    create: (options: Record<string, unknown>) => Promise<SdkAgent>
    resume: (id: string, options?: Record<string, unknown>) => Promise<SdkAgent>
  }
}

type SdkStreamMessage = {
  type?: string
  agent_id?: string
  text?: string
  thinking_duration_ms?: number
  call_id?: string
  name?: string
  status?: string
  args?: unknown
  result?: unknown
  message?: string | { content?: Array<{ type?: string; text?: string }> }
  usage?: SdkUsage
}

const CLOUD_API = 'https://api.cursor.com'

export class CursorRuntimeUnavailableError extends Error {
  readonly code = 'CURSOR_RUNTIME_UNAVAILABLE'

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'CursorRuntimeUnavailableError'
  }
}

type LiveMaps = {
  agents: Map<string, SdkAgent>
  runs: Map<string, SdkRun>
}

const globalLive = globalThis as typeof globalThis & {
  __cursorCloneSdkLive?: LiveMaps
}

function live(): LiveMaps {
  if (!globalLive.__cursorCloneSdkLive) {
    globalLive.__cursorCloneSdkLive = {
      agents: new Map(),
      runs: new Map(),
    }
  }
  return globalLive.__cursorCloneSdkLive
}

export function getCursorApiKey(): string | undefined {
  const value = process.env.CURSOR_API_KEY?.trim()
  return value || undefined
}

function displayToolName(name: string): ToolCallEvent['name'] {
  const map: Record<string, ToolCallEvent['name']> = {
    read: 'Read',
    read_file: 'Read',
    grep: 'Grep',
    glob: 'Glob',
    ls: 'Glob',
    edit: 'Edit',
    write: 'Write',
    delete: 'Edit',
    shell: 'Shell',
    run_terminal_cmd: 'Shell',
  }
  return map[name] ?? name
}

function toolPath(args: Record<string, unknown> | undefined): string | undefined {
  if (!args) return undefined
  const value = args.path ?? args.file ?? args.file_path ?? args.target
  return typeof value === 'string' ? value : undefined
}

async function diffFromTool(input: {
  name: string
  args?: Record<string, unknown>
  checkpoint: FileMap | null
}): Promise<PendingDiff | null> {
  const normalized = displayToolName(input.name)
  if (normalized !== 'Edit' && normalized !== 'Write') return null
  const path = toolPath(input.args)
  if (!path) return null
  try {
    const after = await readWorkspaceFile(path)
    const before = input.checkpoint?.[path] ?? ''
    if (before === after) return null
    return {
      id: crypto.randomUUID(),
      path,
      before,
      after,
      unified: unifiedDiff(path, before, after),
    }
  } catch {
    return null
  }
}

async function loadCursorSdk(): Promise<SdkModule> {
  try {
    const loaded = (await import('@cursor/sdk')) as {
      Agent?: SdkModule['Agent']
      default?: { Agent?: SdkModule['Agent'] }
    }
    const Agent = loaded.Agent ?? loaded.default?.Agent
    if (typeof Agent?.create !== 'function' || typeof Agent?.resume !== 'function') {
      throw new Error('Agent.create / Agent.resume missing from @cursor/sdk')
    }
    return { Agent }
  } catch (error) {
    throw new CursorRuntimeUnavailableError(
      'Failed to load @cursor/sdk (native binary missing or bundling blocked).',
      { cause: error },
    )
  }
}

function sdkMode(mode: AgentMode): 'agent' | 'plan' {
  return mode === 'plan' ? 'plan' : 'agent'
}

function askTools(): Array<'read' | 'grep' | 'glob' | 'ls'> {
  return ['read', 'grep', 'glob', 'ls']
}

export async function createLocalAgent(session: LiveSession): Promise<{ agentId: string }> {
  const apiKey = getCursorApiKey()
  if (!apiKey) {
    throw new CursorRuntimeUnavailableError('CURSOR_API_KEY is not set.')
  }

  const sdk = await loadCursorSdk()
  const cwd = session.playgroundPath || getPlaygroundRoot()
  const agent = await sdk.Agent.create({
    apiKey,
    model: { id: resolveModelId(session.model) },
    mode: sdkMode(session.mode),
    local: { cwd },
    ...(session.mode === 'ask' ? { tools: askTools() } : {}),
  })
  live().agents.set(session.id, agent)
  session.cursorAgentId = agent.agentId
  session.runtime = 'sdk'
  return { agentId: agent.agentId }
}

async function resolveAgent(session: LiveSession, model: AgentModel): Promise<SdkAgent> {
  const existing = live().agents.get(session.id)
  if (existing) return existing

  const apiKey = getCursorApiKey()
  if (!apiKey) {
    throw new CursorRuntimeUnavailableError('CURSOR_API_KEY is not set.')
  }

  const sdk = await loadCursorSdk()
  const cwd = session.playgroundPath || getPlaygroundRoot()
  const options = {
    apiKey,
    model: { id: resolveModelId(model) },
    mode: sdkMode(session.mode),
    local: { cwd },
    ...(session.mode === 'ask' ? { tools: askTools() } : {}),
  }

  const agent = session.cursorAgentId
    ? await sdk.Agent.resume(session.cursorAgentId, options)
    : await sdk.Agent.create(options)

  live().agents.set(session.id, agent)
  session.cursorAgentId = agent.agentId
  session.runtime = 'sdk'
  return agent
}

function asSdkMessage(value: unknown): SdkStreamMessage {
  return (asRecord(value) ?? {}) as SdkStreamMessage
}

function contentText(message: SdkStreamMessage): string {
  const payload = message.message
  if (!payload || typeof payload === 'string') return ''
  return (payload.content ?? [])
    .map((block) => (typeof block.text === 'string' ? block.text : ''))
    .join('')
}

function statusMessage(message: SdkStreamMessage): string | undefined {
  if (typeof message.message === 'string' && message.message) return message.message
  if (typeof message.text === 'string' && message.text) return message.text
  return undefined
}

function usageFrom(raw: SdkUsage | undefined): TokenUsage | null {
  if (!raw) return null
  const inputTokens = Number(raw.inputTokens ?? 0)
  const outputTokens = Number(raw.outputTokens ?? 0)
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens: raw.cacheReadTokens,
    cacheWriteTokens: raw.cacheWriteTokens,
    totalTokens: raw.totalTokens,
    reasoningTokens: raw.reasoningTokens,
  }
}

function mapSdkMessage(raw: unknown): AgentEvent[] {
  const message = asSdkMessage(raw)
  switch (message.type) {
    case 'system':
      return [
        {
          type: 'system',
          text: 'Cursor agent started',
          cursorAgentId: typeof message.agent_id === 'string' ? message.agent_id : undefined,
        },
      ]
    case 'user': {
      const text = contentText(message)
      return text ? [{ type: 'user', text }] : []
    }
    case 'assistant': {
      const events: AgentEvent[] = []
      const payload = message.message
      const blocks = payload && typeof payload !== 'string' ? (payload.content ?? []) : []
      for (const block of blocks) {
        if (block.type === 'text' && block.text) {
          events.push({ type: 'assistant', text: block.text, delta: true })
        }
      }
      return events
    }
    case 'thinking':
      return [
        {
          type: 'thinking',
          text: typeof message.text === 'string' ? message.text : '',
          durationMs: typeof message.thinking_duration_ms === 'number' ? message.thinking_duration_ms : undefined,
        },
      ]
    case 'tool_call': {
      const status =
        message.status === 'completed' || message.status === 'error' ? message.status : 'running'
      return [
        {
          type: 'tool_call',
          id: typeof message.call_id === 'string' && message.call_id ? message.call_id : crypto.randomUUID(),
          name: displayToolName(typeof message.name === 'string' ? message.name : 'tool'),
          status,
          args: asRecord(message.args),
          result: message.result == null ? undefined : truncateOutput(resultToString(message.result)),
          error: status === 'error' ? resultToString(message.result) : undefined,
        },
      ]
    }
    case 'status':
      return [
        {
          type: 'status',
          status: typeof message.status === 'string' ? message.status : 'RUNNING',
          message: statusMessage(message),
        },
      ]
    case 'usage': {
      const usage = usageFrom(message.usage)
      return usage ? [{ type: 'usage', usage }] : []
    }
    case 'task':
      return [
        {
          type: 'status',
          status: typeof message.status === 'string' ? message.status : 'RUNNING',
          message: typeof message.text === 'string' ? message.text : undefined,
        },
      ]
    default:
      return []
  }
}

export async function* streamSdkRun(input: {
  session: LiveSession
  prompt: string
  model: AgentModel
  signal?: AbortSignal
}): AsyncGenerator<AgentEvent> {
  const { session, prompt, model, signal } = input
  const agent = await resolveAgent(session, model)
  const run = await agent.send(prompt, {
    model: { id: resolveModelId(model) },
    mode: sdkMode(session.mode),
  })
  live().runs.set(session.id, run)
  session.cloudRunId = run.id

  const onAbort = () => {
    void run.cancel().catch(() => undefined)
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    for await (const message of run.stream()) {
      if (signal?.aborted) break
      const events = mapSdkMessage(message)
      for (const event of events) {
        yield event
        if (event.type === 'tool_call' && event.status === 'completed') {
          const diff = await diffFromTool({
            name: String(event.name),
            args: event.args,
            checkpoint: session.checkpoint,
          })
          if (diff) yield { type: 'diff', diff }
        }
      }
    }

    const result = await run.wait()
    if (result.error?.message) {
      yield { type: 'error', message: result.error.message, code: result.error.code }
    }
    const usage = usageFrom(result.usage)
    if (usage) {
      yield { type: 'usage', usage }
    }
    yield {
      type: 'status',
      status: result.status === 'cancelled' ? 'CANCELLED' : result.status === 'error' ? 'ERROR' : 'FINISHED',
    }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    live().runs.delete(session.id)
  }
}

type CloudAgentResponse = {
  agent?: { id?: string }
  run?: { id?: string; agentId?: string; status?: string }
  id?: string
}

async function cloudFetch(path: string, init: RequestInit): Promise<Response> {
  const apiKey = getCursorApiKey()
  if (!apiKey) {
    throw new CursorRuntimeUnavailableError('CURSOR_API_KEY is not set.')
  }
  const response = await fetch(`${CLOUD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: init.headers && 'Accept' in init.headers ? String((init.headers as Record<string, string>).Accept) : 'application/json',
      ...(init.headers ?? {}),
    },
  })
  return response
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new CursorRuntimeUnavailableError(
      `Cloud Agents API returned non-JSON (${response.status}): ${text.slice(0, 200)}`,
    )
  }
}

export async function* streamCloudRun(input: {
  session: LiveSession
  prompt: string
  model: AgentModel
  signal?: AbortSignal
}): AsyncGenerator<AgentEvent> {
  const { session, prompt, model, signal } = input
  const body = {
    prompt: { text: prompt },
    model: { id: resolveModelId(model) },
    mode: sdkMode(session.mode),
  }

  let agentId = session.cursorAgentId
  let runId: string | undefined

  if (!agentId) {
    const created = await cloudFetch('/v1/agents', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!created.ok) {
      const errText = await created.text()
      throw new CursorRuntimeUnavailableError(
        `Cloud agent create failed (${created.status}): ${errText.slice(0, 280)}`,
      )
    }
    const payload = await parseJson<CloudAgentResponse>(created)
    agentId = payload.agent?.id
    runId = payload.run?.id
    if (!agentId || !runId) {
      throw new CursorRuntimeUnavailableError('Cloud agent create returned no agent/run id.')
    }
    session.cursorAgentId = agentId
    session.runtime = 'cloud'
  } else {
    const follow = await cloudFetch(`/v1/agents/${agentId}/runs`, {
      method: 'POST',
      body: JSON.stringify({
        prompt: { text: prompt },
        mode: sdkMode(session.mode),
      }),
    })
    if (!follow.ok) {
      const errText = await follow.text()
      throw new CursorRuntimeUnavailableError(
        `Cloud run create failed (${follow.status}): ${errText.slice(0, 280)}`,
      )
    }
    const payload = await parseJson<CloudAgentResponse>(follow)
    runId = payload.run?.id
    if (!runId) {
      throw new CursorRuntimeUnavailableError('Cloud run create returned no run id.')
    }
  }

  session.cloudRunId = runId
  yield {
    type: 'system',
    text: 'Cloud agent started',
    sessionId: session.id,
    cursorAgentId: agentId,
    demo: false,
  }

  const stream = await cloudFetch(`/v1/agents/${agentId}/runs/${runId}/stream`, {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
    signal,
  })
  if (!stream.ok || !stream.body) {
    const errText = await stream.text()
    throw new CursorRuntimeUnavailableError(
      `Cloud run stream failed (${stream.status}): ${errText.slice(0, 280)}`,
    )
  }

  const reader = stream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      let eventName = 'message'
      const dataLines: string[] = []
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      }
      if (dataLines.length === 0) continue
      let data: unknown = {}
      try {
        data = JSON.parse(dataLines.join('\n') || '{}')
      } catch {
        continue
      }
      yield* mapCloudEvent(eventName, data)
    }
  }
}

async function* mapCloudEvent(eventName: string, data: unknown): AsyncGenerator<AgentEvent> {
  const record = asRecord(data) ?? {}
  if (eventName === 'heartbeat') return
  if (eventName === 'status') {
    yield {
      type: 'status',
      status: String(record.status ?? 'RUNNING'),
    }
    return
  }
  if (eventName === 'assistant') {
    const text = typeof record.text === 'string' ? record.text : ''
    if (text) yield { type: 'assistant', text, delta: true }
    return
  }
  if (eventName === 'thinking') {
    const text = typeof record.text === 'string' ? record.text : ''
    yield { type: 'thinking', text }
    return
  }
  if (eventName === 'tool_call') {
    const name = typeof record.name === 'string' ? record.name : 'tool'
    const status = record.status === 'completed' || record.status === 'error' ? record.status : 'running'
    yield {
      type: 'tool_call',
      id: typeof record.callId === 'string' ? record.callId : crypto.randomUUID(),
      name: displayToolName(name),
      status,
      args: asRecord(record.args),
      result: record.result == null ? undefined : truncateOutput(resultToString(record.result)),
    }
    return
  }
  if (eventName === 'error') {
    yield {
      type: 'error',
      message: typeof record.message === 'string' ? record.message : 'Cloud agent error',
      code: typeof record.code === 'string' ? record.code : undefined,
    }
    return
  }
  if (eventName === 'result') {
    yield {
      type: 'status',
      status: String(record.status ?? 'FINISHED'),
    }
    return
  }
  if (eventName === 'done') {
    yield { type: 'status', status: 'FINISHED' }
  }
}

export async function cancelCursorRun(session: LiveSession): Promise<void> {
  const run = live().runs.get(session.id)
  if (run) {
    await run.cancel().catch(() => undefined)
    live().runs.delete(session.id)
    return
  }

  if (session.runtime === 'cloud' && session.cursorAgentId && session.cloudRunId) {
    await cloudFetch(`/v1/agents/${session.cursorAgentId}/runs/${session.cloudRunId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).catch(() => undefined)
  }
}

export async function* streamCursorRun(input: {
  session: LiveSession
  prompt: string
  model: AgentModel
  signal?: AbortSignal
}): AsyncGenerator<AgentEvent> {
  try {
    yield* streamSdkRun(input)
  } catch (error) {
    // Native binary / bundling / local runtime failure → Cloud Agents REST.
    if (error instanceof CursorRuntimeUnavailableError || error instanceof Error) {
      try {
        yield {
          type: 'status',
          status: 'RUNNING',
          message: 'Local SDK unavailable; trying Cloud Agents REST.',
        }
        yield* streamCloudRun(input)
        return
      } catch (cloudError) {
        const message =
          cloudError instanceof Error ? cloudError.message : 'Cloud Agents REST failed.'
        throw new CursorRuntimeUnavailableError(message, { cause: cloudError })
      }
    }
    throw error
  }
}
