export type AgentMode = 'agent' | 'ask' | 'plan'

export type AgentModel = 'composer-2.5' | 'grok-4.5' | 'auto-smart'

export const DEFAULT_AGENT_MODEL: AgentModel = 'composer-2.5'

export const AGENT_MODELS: AgentModel[] = ['composer-2.5', 'grok-4.5', 'auto-smart']

export const AGENT_MODEL_LABELS: Record<AgentModel, string> = {
  'composer-2.5': 'Composer 2.5',
  'grok-4.5': 'Grok 4.5',
  'auto-smart': 'Auto',
}

export type ContextChipKind = 'file' | 'selection' | 'folder' | 'codebase'

export type ContextChip = {
  id?: string
  kind: ContextChipKind
  path?: string
  label?: string
  content?: string
  startLine?: number
  endLine?: number
}

export type ToolCallStatus = 'running' | 'completed' | 'error'

export type AgentToolName = string

export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  totalTokens?: number
  reasoningTokens?: number
}

export type PendingDiff = {
  id: string
  path: string
  before: string
  after: string
  unified: string
}

export type PlanPayload = {
  markdown: string
  approve: {
    action: 'approve_plan'
    mode: 'agent'
  }
}

export type AgentEvent =
  | {
      type: 'system'
      text: string
      sessionId?: string
      demo?: boolean
      cursorAgentId?: string
    }
  | {
      type: 'user'
      text: string
    }
  | {
      type: 'assistant'
      text: string
      delta?: boolean
    }
  | {
      type: 'thinking'
      text: string
      durationMs?: number
    }
  | ToolCallEvent
  | {
      type: 'status'
      status: string
      message?: string
    }
  | {
      type: 'usage'
      usage: TokenUsage
    }
  | {
      type: 'error'
      message: string
      code?: string
    }
  | {
      type: 'diff'
      diff: PendingDiff
    }
  | {
      type: 'plan'
      plan: PlanPayload
    }

export type ToolCallEvent = {
  type: 'tool_call'
  id: string
  name: AgentToolName
  status: ToolCallStatus
  args?: Record<string, unknown>
  result?: string
  error?: string
}

export type FileMap = Record<string, string>

export type AgentSession = {
  id: string
  mode: AgentMode
  model: AgentModel
  cursorAgentId?: string
  cloudRunId?: string
  runtime?: 'sdk' | 'cloud' | 'demo'
  demo: boolean
  playgroundPath: string
  checkpoint: FileMap | null
  createdAt: number
  history: Array<{ role: 'user' | 'assistant'; text: string }>
}

export type CreateSessionRequest = {
  mode: AgentMode
  model: AgentModel
  cwd?: string
}

export type CreateSessionResponse = {
  sessionId: string
  cursorAgentId?: string
  demo: boolean
}

export type RunPromptRequest = {
  sessionId: string
  prompt: string
  mode?: AgentMode
  model?: AgentModel
  context?: ContextChip[]
  inline?: boolean
}

export type CancelRunRequest = {
  sessionId: string
}

export function isAgentMode(value: unknown): value is AgentMode {
  return value === 'agent' || value === 'ask' || value === 'plan'
}

export function isAgentModel(value: unknown): value is AgentModel {
  return value === 'composer-2.5' || value === 'grok-4.5' || value === 'auto-smart'
}

export function resolveModelId(model: AgentModel): string {
  if (model === 'auto-smart') return 'auto'
  return model
}

export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!value || typeof value !== 'object') return false
  const type = (value as { type?: unknown }).type
  return (
    type === 'system' ||
    type === 'user' ||
    type === 'assistant' ||
    type === 'thinking' ||
    type === 'tool_call' ||
    type === 'status' ||
    type === 'usage' ||
    type === 'error' ||
    type === 'diff' ||
    type === 'plan'
  )
}
