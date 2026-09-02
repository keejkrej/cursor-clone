import { NextResponse } from 'next/server'

import { cancelCursorRun, getCursorApiKey } from '@/lib/agent/cursor-runtime'
import { getAgentSession, requestCancel } from '@/lib/agent/session-store'
import type { CancelRunRequest } from '@/lib/agent/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CancelRunRequest>
    const sessionId = String(body.sessionId ?? '')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const found = requestCancel(sessionId)
    const session = getAgentSession(sessionId)
    if (session && getCursorApiKey()) {
      await cancelCursorRun(session).catch(() => undefined)
    }

    if (!found && !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, sessionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel run'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
