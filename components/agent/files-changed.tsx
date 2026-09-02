'use client'

import { XIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { TranscriptItem } from '@/lib/agent/transcript'
import type { PendingDiff } from '@/lib/agent/types'

import { UnifiedDiffView } from './unified-diff'

export function FilesChangedRail({
  diffs,
  onClose,
  onApply,
  onReject,
}: {
  diffs: Array<Extract<TranscriptItem, { kind: 'diff' }>>
  onClose: () => void
  onApply: (diff: PendingDiff) => void
  onReject: (diff: PendingDiff) => void
}) {
  const visible = diffs.filter((item) => !item.rejected)
  return (
    <aside className="flex h-full min-h-0 w-[360px] shrink-0 flex-col border-l bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 px-3">
        <span className="text-[13px] font-medium">
          {visible.length} File{visible.length === 1 ? '' : 's'} Changed
        </span>
        <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label="Close files changed" onClick={onClose}>
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-3 py-3">
          {visible.length === 0 ? (
            <p className="text-xs text-muted-foreground">0 files changed</p>
          ) : (
            visible.map((item) => (
              <div key={item.diff.id} className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2 text-[12px]">
                  <span className="truncate font-medium">{item.diff.path}</span>
                  <Badge variant="outline" className="ml-auto h-4 px-1.5 text-[10px]">
                    {item.applied ? 'applied' : 'review'}
                  </Badge>
                </div>
                <UnifiedDiffView unified={item.diff.unified} className="max-h-[60vh]" />
                <div className="mt-2 flex justify-end gap-1">
                  <Button size="xs" variant="ghost" onClick={() => onReject(item.diff)}>
                    Reject
                  </Button>
                  {!item.applied ? (
                    <Button size="xs" onClick={() => onApply(item.diff)}>
                      Apply
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
