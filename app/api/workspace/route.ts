import { NextResponse } from 'next/server'

import { loadWorkspace } from '@/lib/workspace/files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const workspace = await loadWorkspace()
    return NextResponse.json(workspace)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load workspace'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
