import { NextResponse } from 'next/server'

import { createLocalAgent, getCursorApiKey } from '@/lib/agent/cursor-runtime'
import { createAgentSession } from '@/lib/agent/session-store'
import { isAgentMode, isAgentModel, type CreateSessionRequest } from '@/lib/agent/types'
import { getPlaygroundRoot } from '@/lib/workspace/files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateSessionRequest>
    const mode = isAgentMode(body.mode) ? body.mode : 'agent'
    const model = isAgentModel(body.model) ? body.model : 'composer-2.5'
    const cwd = typeof body.cwd === 'string' && body.cwd.trim() ? body.cwd : getPlaygroundRoot()
    const apiKey = getCursorApiKey()
    const session = createAgentSession({
      mode,
      model,
      cwd,
      demo: !apiKey,
    })

    if (apiKey) {
      try {
        const created = await createLocalAgent(session)
        session.cursorAgentId = created.agentId
        session.runtime = 'sdk'
      } catch {
        // Run route will try Cloud Agents REST, then demo.
      }
    }

    return NextResponse.json({
      sessionId: session.id,
      cursorAgentId: session.cursorAgentId,
      demo: session.demo,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
