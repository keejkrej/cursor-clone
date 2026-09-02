'use client'

import { useEffect, useMemo, useState, type RefObject } from 'react'
import { ArrowUpIcon, AtSignIcon, PaperclipIcon, SquareIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import type { SuggestionChip } from '@/lib/agent/suggestions'
import type { ContextChip, ContextChipKind } from '@/lib/agent/types'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/store'

import { ModeToggle } from './mode-toggle'
import { ModelSelect } from './model-select'
import { SuggestionChips } from './suggestion-chips'
import type { ComposerContextState } from './use-agent-chat'

const KIND_LABEL: Record<ContextChipKind, string> = {
  file: '@file',
  selection: '@selection',
  folder: '@folder',
  codebase: '@codebase',
}

export function AgentComposer({
  variant = 'ide',
  draft,
  setDraft,
  running,
  placeholder,
  context,
  contextState,
  composerRef,
  showModel = false,
  suggestions,
  onSubmit,
  onStop,
  onToggleKind,
  onAttach,
  onRemove,
}: {
  variant?: 'ide' | 'agents' | 'followup'
  draft: string
  setDraft: (value: string) => void
  running: boolean
  placeholder: string
  context: ContextChip[]
  contextState: ComposerContextState
  composerRef: RefObject<HTMLTextAreaElement | null>
  showModel?: boolean
  suggestions?: SuggestionChip[]
  onSubmit: (prompt?: string) => void
  onStop: () => void
  onToggleKind: (kind: ContextChipKind) => void
  onAttach: (chip: ContextChip) => void
  onRemove: (chip: ContextChip) => void
}) {
  const workspace = useWorkspace()
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const rounded = variant === 'ide' ? 'rounded-xl' : 'rounded-[18px]'
  const chips = mounted ? context : []

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleChange(value: string) {
    setDraft(value)
    if (value.endsWith('@')) setMentionOpen(true)
  }

  function attachAndClose(chip: ContextChip) {
    onAttach(chip)
    if (draft.endsWith('@')) setDraft(draft.slice(0, -1))
    setMentionOpen(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={`${chip.kind}-${chip.path ?? chip.label}-${chip.id ?? ''}`}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px]"
            >
              {chip.label ?? KIND_LABEL[chip.kind]}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${chip.label ?? chip.kind}`}
                onClick={() => onRemove(chip)}
              >
                <XIcon className="size-3" />
                <span className="sr-only">Remove {chip.label ?? chip.kind}</span>
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className={cn('border bg-card p-2 shadow-sm', rounded, variant === 'followup' && 'shadow-none')}>
        <Textarea
          ref={composerRef}
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          aria-label="Agent prompt"
          disabled={running}
          className={cn(
            'resize-none border-0 bg-transparent p-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent',
            variant === 'ide' ? 'min-h-16 text-xs' : 'min-h-20 text-sm',
          )}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Enter' && !event.shiftKey) {
              if (mentionOpen) return
              event.preventDefault()
              if (!running) onSubmit()
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              if (!running) onSubmit()
            }
            if (event.key === '@' && !event.metaKey && !event.ctrlKey) {
              setMentionOpen(true)
            }
          }}
        />
        <div className="mt-1 flex items-center gap-1 overflow-x-auto">
          <ContextPopover
            open={mentionOpen}
            onOpenChange={setMentionOpen}
            kinds={contextState.kinds}
            files={Object.keys(workspace.files)}
            activeFile={workspace.activeFile}
            hasSelection={Boolean(workspace.selection?.text)}
            onToggleKind={onToggleKind}
            onAttachFile={(path) =>
              attachAndClose({
                kind: 'file',
                path,
                label: path,
                content: workspace.files[path],
              })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label="Attach selection"
            disabled={!workspace.selection?.text || !workspace.activeFile}
            onClick={() => {
              if (!workspace.selection?.text || !workspace.activeFile) return
              onAttach({
                kind: 'selection',
                path: workspace.activeFile,
                label: `${workspace.activeFile}:${workspace.selection.startLine}-${workspace.selection.endLine}`,
                content: workspace.selection.text,
                startLine: workspace.selection.startLine,
                endLine: workspace.selection.endLine,
              })
            }}
          >
            <PaperclipIcon />
            <span className="sr-only">Attach selection</span>
          </Button>
          {showModel ? (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <ModeToggle className="min-w-0" />
              <ModelSelect compact={variant === 'ide'} className="min-w-0" />
            </div>
          ) : (
            <span className="flex-1" />
          )}
          {running ? (
            <Button
              size="icon-sm"
              variant="secondary"
              className="ml-auto rounded-full"
              aria-label="Stop"
              onClick={() => void onStop()}
            >
              <SquareIcon />
              <span className="sr-only">Stop</span>
            </Button>
          ) : (
            <Button
              size="icon-sm"
              className="ml-auto rounded-full"
              disabled={!draft.trim()}
              aria-label="Send"
              onClick={() => onSubmit()}
            >
              <ArrowUpIcon />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Kbd>↵</Kbd>
          send
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>⇧↵</Kbd>
          newline
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>@</Kbd>
          context
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Kbd>⌘K</Kbd>
          commands
        </span>
      </div>
      {suggestions && suggestions.length > 0 ? (
        <SuggestionChips chips={suggestions} onSelect={(prompt) => onSubmit(prompt)} />
      ) : null}
    </div>
  )
}

function ContextPopover({
  open,
  onOpenChange,
  kinds,
  files,
  activeFile,
  hasSelection,
  onToggleKind,
  onAttachFile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kinds: Record<ContextChipKind, boolean>
  files: string[]
  activeFile: string | null
  hasSelection: boolean
  onToggleKind: (kind: ContextChipKind) => void
  onAttachFile: (path: string) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return files.filter((path) => !q || path.toLowerCase().includes(q)).slice(0, 40)
  }, [files, query])

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label="Add context"
          />
        }
      >
        <AtSignIcon />
        <span className="sr-only">Add context</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Files and context"
          className="mb-2 h-7 text-xs"
        />
        <div className="mb-1.5 flex flex-wrap gap-1">
          {(Object.keys(KIND_LABEL) as ContextChipKind[]).map((kind) => (
            <Button
              key={kind}
              size="xs"
              variant={kinds[kind] ? 'secondary' : 'ghost'}
              className="h-5 px-1.5 text-[10px]"
              disabled={kind === 'selection' && !hasSelection}
              onClick={() => onToggleKind(kind)}
            >
              {KIND_LABEL[kind]}
            </Button>
          ))}
        </div>
        <ScrollArea className="h-40">
          <div className="flex flex-col">
            {activeFile ? (
              <button
                type="button"
                className="rounded-md px-1.5 py-1 text-left text-xs hover:bg-muted"
                onClick={() => onAttachFile(activeFile)}
              >
                Active file · {activeFile}
              </button>
            ) : null}
            {filtered.map((path) => (
              <button
                key={path}
                type="button"
                className="rounded-md px-1.5 py-1 text-left text-xs hover:bg-muted"
                onClick={() => onAttachFile(path)}
              >
                {path}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
