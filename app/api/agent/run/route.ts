import { RunAbortedError, runDemoAgent } from '@/lib/agent/demo-runtime'
import { CursorRuntimeUnavailableError, getCursorApiKey, streamCursorRun } from '@/lib/agent/cursor-runtime'
import { encodeSse } from '@/lib/agent/protocol'
import { composeUserPrompt, loadProjectRules } from '@/lib/agent/prompt'
import { beginRun, endRun, getAgentSession, snapshotCheckpoint } from '@/lib/agent/session-store'
import {
  isAgentMode,
  isAgentModel,
  type AgentEvent,
  type ContextChip,
  type RunPromptRequest,
} from '@/lib/agent/types'
import { loadWorkspace } from '@/lib/workspace/files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asContext(value: unknown): ContextChip[] {
  if (!Array.isArray(value)) return []
  const chips: ContextChip[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const kind = record.kind
    if (kind !== 'file' && kind !== 'selection' && kind !== 'folder' && kind !== 'codebase') {
      continue
    }
    chips.push({
      id: typeof record.id === 'string' ? record.id : undefined,
      kind,
      path: typeof record.path === 'string' ? record.path : undefined,
      label: typeof record.label === 'string' ? record.label : undefined,
      content: typeof record.content === 'string' ? record.content : undefined,
      startLine: typeof record.startLine === 'number' ? record.startLine : undefined,
      endLine: typeof record.endLine === 'number' ? record.endLine : undefined,
    })
  }
  return chips
}

export async function POST(request: Request) {
  let body: Partial<RunPromptRequest>
  try {
    body = (await request.json()) as Partial<RunPromptRequest>
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const sessionId = String(body.sessionId ?? '')
  const prompt = String(body.prompt ?? '').trim()
  if (!sessionId || !prompt) {
    return new Response(JSON.stringify({ error: 'sessionId and prompt are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const session = getAgentSession(sessionId)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (isAgentMode(body.mode)) session.mode = body.mode
  if (isAgentModel(body.model)) session.model = body.model
  const context = asContext(body.context)
  const inline = body.inline === true

  const workspace = await loadWorkspace()
  const rules = await loadProjectRules()
  if (session.mode === 'agent' && !inline) {
    snapshotCheckpoint(session, workspace.files)
  }

  const composed = composeUserPrompt({
    prompt,
    mode: session.mode,
    context,
    files: workspace.files,
    rules,
    inline,
  })

  const abort = beginRun(session)
  const signal = abort.signal
  const encoder = new TextEncoder()
  const apiKey = getCursorApiKey()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(encodeSse(event)))
      }

      const onClientAbort = () => abort.abort()
      request.signal.addEventListener('abort', onClientAbort)

      try {
        if (apiKey && !session.demo) {
          try {
            for await (const event of streamCursorRun({
              session,
              prompt: composed,
              model: session.model,
              signal,
            })) {
              send(event)
            }
            return
          } catch (error) {
            if (error instanceof RunAbortedError || signal.aborted) {
              send({ type: 'status', status: 'CANCELLED', message: 'Run cancelled' })
              return
            }
            const message =
              error instanceof CursorRuntimeUnavailableError || error instanceof Error
                ? error.message
                : 'Cursor runtime failed'
            send({
              type: 'status',
              status: 'RUNNING',
              message: `SDK/cloud unavailable (${message}). Falling back to demo.`,
            })
          }
        }

        for await (const event of runDemoAgent({
          session,
          prompt,
          composedPrompt: composed,
          context,
          files: workspace.files,
          signal,
          inline,
        })) {
          send(event)
        }
      } catch (error) {
        if (error instanceof RunAbortedError || signal.aborted) {
          send({ type: 'status', status: 'CANCELLED', message: 'Run cancelled' })
        } else {
          const message = error instanceof Error ? error.message : 'Agent run failed'
          send({ type: 'error', message })
          send({ type: 'status', status: 'ERROR', message })
        }
      } finally {
        request.signal.removeEventListener('abort', onClientAbort)
        endRun(session, abort)
        controller.close()
      }
    },
    cancel() {
      abort.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
