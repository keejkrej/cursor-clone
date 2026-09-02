import { NextResponse } from 'next/server'

import { writeWorkspaceFile } from '@/lib/workspace/files'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string; content?: string }
    const filePath = String(body.path ?? '')
    const content = String(body.content ?? '')
    const path = await writeWorkspaceFile(filePath, content)
    return NextResponse.json({ ok: true, path })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply file'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
