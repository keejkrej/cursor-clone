'use client'

import { cn } from '@/lib/utils'
import { useDemoMode } from '@/lib/agent/use-demo-mode'

export function DemoBanner({ className }: { className?: string }) {
  const demo = useDemoMode()
  if (!demo) return null

  return (
    <div
      role="status"
      className={cn(
        'border-b bg-muted/50 px-3 py-1.5 text-[11px] leading-snug text-muted-foreground',
        className,
      )}
    >
      Demo mode — set CURSOR_API_KEY for the real Cursor agent
    </div>
  )
}
