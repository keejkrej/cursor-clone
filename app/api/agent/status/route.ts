import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const key = process.env.CURSOR_API_KEY?.trim()
  return NextResponse.json({ demo: !key })
}
