import { unifiedDiff } from './diff'
import { rewriteSelection } from './inline-rewrite'
import { truncateOutput } from './protocol'
import type {
  AgentEvent,
  AgentMode,
  AgentSession,
  ContextChip,
  FileMap,
  PendingDiff,
  ToolCallEvent,
} from './types'

export class RunAbortedError extends Error {
  constructor() {
    super('Run cancelled')
    this.name = 'RunAbortedError'
  }
}

type DemoInput = {
  session: AgentSession
  prompt: string
  composedPrompt: string
  context: ContextChip[]
  files: FileMap
  signal?: AbortSignal
  inline?: boolean
}

const AUTH_PATH = 'src/auth.ts'
const ADMIN_PASSWORD = 'secret'

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new RunAbortedError()
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RunAbortedError())
      return
    }
    const timer = setTimeout(() => resolve(), ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new RunAbortedError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function globToRegExp(pattern: string): RegExp {
  let i = 0
  let out = '^'
  while (i < pattern.length) {
    if (pattern.startsWith('**/', i)) {
      out += '(?:.*)?'
      i += 3
      continue
    }
    if (pattern.startsWith('**', i)) {
      out += '.*'
      i += 2
      continue
    }
    const ch = pattern[i] ?? ''
    if (ch === '*') out += '[^/]*'
    else if (ch === '?') out += '[^/]'
    else out += escapeRegExp(ch)
    i += 1
  }
  return new RegExp(`${out}$`, 'i')
}

function matchGlob(filePath: string, pattern: string): boolean {
  const rx = globToRegExp(pattern)
  const base = filePath.split('/').pop() ?? filePath
  return rx.test(filePath) || rx.test(base)
}

function grepFiles(files: FileMap, query: string, glob = '*.ts'): string {
  const rx = new RegExp(escapeRegExp(query), 'i')
  const hits: string[] = []
  for (const [filePath, content] of Object.entries(files)) {
    if (glob && !matchGlob(filePath, glob)) continue
    const lines = content.split('\n')
    lines.forEach((line, index) => {
      if (rx.test(line)) hits.push(`${filePath}:${index + 1}: ${line}`)
    })
  }
  return hits.slice(0, 40).join('\n') || 'No matches'
}

function globFiles(files: FileMap, pattern: string): string {
  const hits = Object.keys(files)
    .filter((path) => matchGlob(path, pattern))
    .sort()
  return hits.join('\n') || 'No files'
}

function numbered(content: string): string {
  return content
    .split('\n')
    .map((line, index) => `${String(index + 1).padStart(4, ' ')}| ${line}`)
    .join('\n')
}

function grepQuery(prompt: string): string {
  if (/\bpassword\b/i.test(prompt)) return 'password'
  if (/\blogin\b/i.test(prompt)) return 'login'
  if (/\bauth\b/i.test(prompt)) return 'auth'
  const ident = prompt.match(/\b[A-Za-z_][A-Za-z0-9_]{3,}\b/)
  return ident?.[0] ?? 'login'
}

function wantsEdit(prompt: string, mode: AgentMode): boolean {
  if (mode !== 'agent') return false
  if (/\b(approve|implement the plan|go ahead|apply the plan)\b/i.test(prompt)) return true
  const mutating = /\b(fix|change|edit|implement|write|add|patch|update|refactor)\b/i.test(prompt)
  const question =
    /\b(what|why|how|explain|where|describe|summarize)\b/i.test(prompt) && !mutating
  return !question
}

function proposedAuthFix(before: string): string {
  if (!before.includes('password === password')) return before
  let next = before
  if (!next.includes('ADMIN_PASSWORD')) {
    next = next.replace(
      /const ADMIN = 'admin'/,
      `const ADMIN = 'admin'\nconst ADMIN_PASSWORD = '${ADMIN_PASSWORD}'`,
    )
  }
  next = next.replace(
    'if (user === ADMIN && password === password)',
    'if (user === ADMIN && password === ADMIN_PASSWORD)',
  )
  return next
}

function makeDiff(path: string, before: string, after: string): PendingDiff {
  return {
    id: crypto.randomUUID(),
    path,
    before,
    after,
    unified: unifiedDiff(path, before, after),
  }
}

async function* streamAssistant(text: string, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
  const parts = text.split(/(\s+)/).filter((part) => part.length > 0)
  for (const part of parts) {
    assertNotAborted(signal)
    await sleep(16, signal)
    yield { type: 'assistant', text: part, delta: true }
  }
}

async function* emitTool(input: {
  id: string
  name: ToolCallEvent['name']
  args: Record<string, unknown>
  result: string
  signal?: AbortSignal
}): AsyncGenerator<AgentEvent> {
  const { id, name, args, result, signal } = input
  yield { type: 'tool_call', id, name, status: 'running', args }
  await sleep(40, signal)
  yield {
    type: 'tool_call',
    id,
    name,
    status: 'completed',
    args,
    result: truncateOutput(result),
  }
}

async function* runDemoInline(input: DemoInput): AsyncGenerator<AgentEvent> {
  const { session, prompt, context, files, signal } = input
  const selectionChip = context.find((chip) => chip.kind === 'selection')
  const selection = selectionChip?.content ?? ''
  const path = selectionChip?.path ?? AUTH_PATH

  yield {
    type: 'system',
    text: `Demo runtime · inline ${session.mode} · ${session.model}`,
    sessionId: session.id,
    demo: true,
  }
  yield { type: 'user', text: prompt }
  yield { type: 'status', status: 'RUNNING', message: 'Inline edit' }

  const thinkingStarted = Date.now()
  yield { type: 'thinking', text: 'Rewriting the selected range only.' }
  await sleep(140, signal)
  yield {
    type: 'thinking',
    text: '',
    durationMs: Date.now() - thinkingStarted,
  }

  if (path && files[path] !== undefined) {
    yield* emitTool({
      id: 'tool-read-inline',
      name: 'Read',
      args: { path },
      result: numbered(files[path] ?? ''),
      signal,
    })
  }

  const next = rewriteSelection(selection, prompt)
  yield* streamAssistant(next, signal)
  session.history.push({ role: 'user', text: prompt })
  session.history.push({ role: 'assistant', text: next })
  yield { type: 'status', status: 'FINISHED' }
}

export async function* runDemoAgent(input: DemoInput): AsyncGenerator<AgentEvent> {
  if (input.inline) {
    yield* runDemoInline(input)
    return
  }

  const { session, prompt, files, signal } = input
  const mode = session.mode
  const authBefore = files[AUTH_PATH] ?? ''
  const query = grepQuery(prompt)

  yield {
    type: 'system',
    text: `Demo runtime · ${mode} · ${session.model}`,
    sessionId: session.id,
    demo: true,
  }
  yield { type: 'user', text: prompt }
  yield { type: 'status', status: 'RUNNING', message: 'Working' }

  await sleep(50, signal)
  const thinkingStarted = Date.now()
  yield {
    type: 'thinking',
    text:
      mode === 'ask'
        ? 'I will read the playground sources and answer without changing files.'
        : mode === 'plan'
          ? 'I will inspect the auth bug and draft a plan, without editing yet.'
          : 'I will inspect the playground auth code, then propose a focused edit.',
  }
  await sleep(220, signal)
  yield {
    type: 'thinking',
    text: '',
    durationMs: Date.now() - thinkingStarted,
  }

  yield* emitTool({
    id: 'tool-read-auth',
    name: 'Read',
    args: { path: AUTH_PATH },
    result: numbered(authBefore || '(missing)'),
    signal,
  })

  yield* emitTool({
    id: 'tool-grep',
    name: 'Grep',
    args: { pattern: query, glob: '*.ts' },
    result: grepFiles(files, query, '*.ts'),
    signal,
  })

  yield* emitTool({
    id: 'tool-glob',
    name: 'Glob',
    args: { glob: 'src/**/*.ts' },
    result: globFiles(files, 'src/**/*.ts'),
    signal,
  })

  yield* emitTool({
    id: 'tool-shell-ls',
    name: 'Shell',
    args: { command: 'ls src' },
    result: globFiles(files, 'src/**/*'),
    signal,
  })

  if (mode === 'plan') {
    const markdown = [
      '# Plan: Fix admin login',
      '',
      'The playground `login` helper compares `password === password`, so any password works for `admin`.',
      '',
      '1. Read `src/auth.ts` and confirm the self-comparison.',
      '2. Introduce a stored `ADMIN_PASSWORD` and compare against it.',
      '3. Keep the `AuthResult` union and `login` / `requireUser` signatures unchanged.',
      '4. Leave `src/index.ts` as a thin caller.',
      '',
      'Approve this plan to switch to Agent mode and apply the change.',
    ].join('\n')
    yield {
      type: 'plan',
      plan: {
        markdown,
        approve: { action: 'approve_plan', mode: 'agent' },
      },
    }
    yield* streamAssistant(
      'Drafted a plan to fix the always-true admin password check in `src/auth.ts`. Approve to implement.',
      signal,
    )
    session.history.push({ role: 'user', text: prompt })
    session.history.push({ role: 'assistant', text: markdown })
    yield { type: 'status', status: 'FINISHED' }
    return
  }

  if (mode === 'ask' || !wantsEdit(prompt, mode)) {
    const answer = authBefore.includes('password === password')
      ? 'In `src/auth.ts`, `login` checks `user === ADMIN && password === password`. The password is compared to itself, so any password succeeds for `admin`. `src/index.ts` then calls `requireUser` and logs the session. Ask mode is read-only — switch to Agent to apply a fix.'
      : 'The playground is a tiny TypeScript app. `src/auth.ts` exports `login` / `requireUser`, and `src/index.ts` signs in as admin. I did not change any files (Ask / read-only).'
    yield* streamAssistant(answer, signal)
    session.history.push({ role: 'user', text: prompt })
    session.history.push({ role: 'assistant', text: answer })
    yield {
      type: 'usage',
      usage: { inputTokens: 800, outputTokens: 180, totalTokens: 980 },
    }
    yield { type: 'status', status: 'FINISHED' }
    return
  }

  const after = proposedAuthFix(authBefore)
  const alreadyFixed = after === authBefore
  if (alreadyFixed) {
    const answer =
      '`src/auth.ts` no longer compares the password to itself. No further edit is required.'
    yield* streamAssistant(answer, signal)
    session.history.push({ role: 'user', text: prompt })
    session.history.push({ role: 'assistant', text: answer })
    yield { type: 'status', status: 'FINISHED' }
    return
  }

  const diff = makeDiff(AUTH_PATH, authBefore, after)
  yield* emitTool({
    id: 'tool-edit-auth',
    name: 'Edit',
    args: {
      path: AUTH_PATH,
      old_string: 'if (user === ADMIN && password === password)',
      new_string: 'if (user === ADMIN && password === ADMIN_PASSWORD)',
    },
    result: diff.unified,
    signal,
  })
  yield { type: 'diff', diff }
  yield* streamAssistant(
    'Proposed a fix in `src/auth.ts`: compare the admin password against `ADMIN_PASSWORD` instead of itself. Review the diff and Apply to write it into the playground.',
    signal,
  )
  session.history.push({ role: 'user', text: prompt })
  session.history.push({
    role: 'assistant',
    text: `Proposed edit to ${AUTH_PATH}`,
  })
  yield {
    type: 'usage',
    usage: { inputTokens: 1200, outputTokens: 260, totalTokens: 1460 },
  }
  yield { type: 'status', status: 'FINISHED' }
}
