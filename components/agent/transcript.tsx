'use client'

import { useState } from 'react'
import { ChevronRightIcon, FileIcon } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { clipOutput, formatToolCommand, thoughtLabel, type TranscriptItem } from '@/lib/agent/transcript'
import type { PendingDiff } from '@/lib/agent/types'
import { cn } from '@/lib/utils'

import { MarkdownText } from './markdown-text'
import { UnifiedDiffView } from './unified-diff'

export function TranscriptList({
  items,
  density = 'default',
  onApply,
  onReject,
  onApprovePlan,
}: {
  items: TranscriptItem[]
  density?: 'default' | 'compact'
  onApply: (diff: PendingDiff) => void
  onReject: (diff: PendingDiff) => void
  onApprovePlan: (item: Extract<TranscriptItem, { kind: 'plan' }>) => void
}) {
  return (
    <div className={cn('flex flex-col', density === 'compact' ? 'gap-2' : 'gap-3')}>
      {items.map((item) => (
        <TranscriptRow
          key={item.id}
          item={item}
          density={density}
          onApply={onApply}
          onReject={onReject}
          onApprovePlan={onApprovePlan}
        />
      ))}
    </div>
  )
}

function TranscriptRow({
  item,
  density,
  onApply,
  onReject,
  onApprovePlan,
}: {
  item: TranscriptItem
  density: 'default' | 'compact'
  onApply: (diff: PendingDiff) => void
  onReject: (diff: PendingDiff) => void
  onApprovePlan: (item: Extract<TranscriptItem, { kind: 'plan' }>) => void
}) {
  if (item.kind === 'user') {
    return (
      <div
        className={cn(
          'ml-auto max-w-[92%] rounded-2xl bg-muted px-3 py-2 text-[13px] leading-relaxed',
          density === 'compact' && 'rounded-lg px-2.5 py-1.5 text-xs',
        )}
      >
        {item.text}
      </div>
    )
  }
  if (item.kind === 'assistant') {
    return <MarkdownText text={item.text} className={density === 'compact' ? 'text-xs' : undefined} />
  }
  if (item.kind === 'thinking') {
    return <ThinkingCard item={item} compact={density === 'compact'} />
  }
  if (item.kind === 'tool') {
    return <ToolCard item={item} compact={density === 'compact'} />
  }
  if (item.kind === 'diff') {
    return (
      <DiffCard
        item={item}
        compact={density === 'compact'}
        onApply={onApply}
        onReject={onReject}
      />
    )
  }
  if (item.kind === 'plan') {
    return (
      <div className="rounded-lg border bg-card px-3 py-2.5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Plan</p>
        <MarkdownText text={item.markdown} className="mt-2" />
        <div className="mt-2 flex justify-end">
          <Button size="xs" disabled={item.approved} onClick={() => onApprovePlan(item)}>
            {item.approved ? 'Approved' : 'Approve & implement'}
          </Button>
        </div>
      </div>
    )
  }
  if (item.kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        {item.text}
      </div>
    )
  }
  return <p className="text-[11px] text-muted-foreground">{item.text}</p>
}

function ThinkingCard({
  item,
  compact,
}: {
  item: Extract<TranscriptItem, { kind: 'thinking' }>
  compact: boolean
}) {
  const done = Boolean(item.durationMs)
  const [open, setOpen] = useState(!done)
  return (
    <Accordion
      value={open ? [item.id] : []}
      onValueChange={(next) => {
        const values = Array.isArray(next) ? next : next ? [next] : []
        setOpen(values.includes(item.id))
      }}
      multiple
    >
      <AccordionItem value={item.id} className="border-0">
        <AccordionTrigger
          className={cn(
            'py-1 text-[12px] font-normal text-muted-foreground hover:no-underline',
            compact && 'text-[11px]',
          )}
        >
          {thoughtLabel(item.durationMs)}
        </AccordionTrigger>
        <AccordionContent className="text-[12px] text-muted-foreground">
          <p className="whitespace-pre-wrap leading-relaxed">{item.text || (done ? '' : 'Working…')}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function ToolCard({
  item,
  compact,
}: {
  item: Extract<TranscriptItem, { kind: 'tool' }>
  compact: boolean
}) {
  const command = formatToolCommand(item.event)
  const running = item.event.status === 'running'
  const [open, setOpen] = useState(running || compact)
  const result = item.event.result ? clipOutput(item.event.result) : ''
  const error = item.event.error

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px]"
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRightIcon className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <span className="font-medium">{item.event.name}</span>
        <span className="text-muted-foreground">
          {running ? 'running' : item.event.status === 'error' ? 'error' : 'done'}
        </span>
      </button>
      {open ? (
        <div className="space-y-1.5 px-2.5 pb-2">
          {command ? (
            <pre className="overflow-x-auto rounded-md bg-muted/70 px-2 py-1.5 font-mono text-[11px] leading-4">
              {command}
            </pre>
          ) : null}
          {result ? (
            <pre className="max-h-36 overflow-auto font-mono text-[11px] leading-4 text-muted-foreground">
              {result}
            </pre>
          ) : null}
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function DiffCard({
  item,
  compact,
  onApply,
  onReject,
}: {
  item: Extract<TranscriptItem, { kind: 'diff' }>
  compact: boolean
  onApply: (diff: PendingDiff) => void
  onReject: (diff: PendingDiff) => void
}) {
  return (
    <div className="rounded-lg border bg-card px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[12px]">
        <FileIcon className="size-3.5 text-muted-foreground" />
        <span className="font-medium">{item.diff.path}</span>
        <Badge variant="outline" className="ml-auto h-4 px-1.5 text-[10px]">
          {item.rejected ? 'rejected' : item.applied ? 'applied' : 'review'}
        </Badge>
      </div>
      <UnifiedDiffView unified={item.diff.unified} className={cn('mt-1.5 max-h-48', compact && 'max-h-40')} />
      {!item.rejected ? (
        <div className="mt-1.5 flex justify-end gap-1">
          <Button size="xs" variant="ghost" onClick={() => onReject(item.diff)}>
            Reject
          </Button>
          {!item.applied ? (
            <Button size="xs" onClick={() => onApply(item.diff)}>
              Apply
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function FileChangedSummary({
  diffs,
  onSelect,
  showEmpty = false,
}: {
  diffs: Array<Extract<TranscriptItem, { kind: 'diff' }>>
  onSelect?: (path: string) => void
  showEmpty?: boolean
}) {
  const visible = diffs.filter((item) => !item.rejected)
  if (visible.length === 0) {
    if (!showEmpty) return null
    return (
      <div className="rounded-lg border bg-card px-3 py-2">
        <p className="text-[12px] font-medium">0 files changed</p>
        <p className="mt-1 text-[11px] text-muted-foreground">No pending edits to review.</p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-[12px] font-medium">
        {visible.length} File{visible.length === 1 ? '' : 's'} Changed
      </p>
      <div className="mt-1.5 flex flex-col gap-1">
        {visible.map((item) => (
          <button
            key={item.diff.id}
            type="button"
            className="flex items-center gap-1.5 text-left text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => onSelect?.(item.diff.path)}
          >
            <FileIcon className="size-3.5" />
            <span className="truncate">{item.diff.path}</span>
            <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">
              {item.applied ? 'applied' : 'pending'}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  )
}
