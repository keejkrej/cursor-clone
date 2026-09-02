'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckIcon, CircleUserIcon, MenuIcon, PlusIcon, SearchIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  formatRelativeTime,
  isToday,
  type StoredAgentSession,
} from '@/lib/agent/session-memory'
import { AGENTS_SUGGESTIONS } from '@/lib/agent/suggestions'
import { formatElapsed } from '@/lib/agent/transcript'
import { AGENT_MODEL_LABELS, type AgentMode } from '@/lib/agent/types'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/store'

import { CommandPalette } from '@/components/ide/command-palette'
import { CursorMark } from '@/components/ide/cursor-mark'
import { DemoBanner } from '@/components/ide/demo-banner'
import { KeyboardShortcuts } from '@/components/ide/keyboard-shortcuts'

import { AgentComposer } from './composer'
import { FilesChangedRail } from './files-changed'
import { ModeToggle } from './mode-toggle'
import { FileChangedSummary, TranscriptList } from './transcript'
import { useAgentChat } from './use-agent-chat'

const PLACEHOLDER: Record<AgentMode, string> = {
  agent: 'Ask Cursor to build, fix bugs, explore',
  ask: 'Ask Cursor about this repo…',
  plan: 'Ask Cursor to plan a change…',
}

export function AgentsWindow() {
  const workspace = useWorkspace()
  const searchParams = useSearchParams()
  const chat = useAgentChat({ resetSignal: workspace.chatNonce })
  const bottomRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [reviewOpen, setReviewOpen] = useState(true)
  const [mobileNav, setMobileNav] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const requested = searchParams.get('session')
  const loadedRef = useRef<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => {
    if (!requested || loadedRef.current === requested) return
    loadedRef.current = requested
    chat.loadSession(requested)
    // loadSession identity is stable enough for query hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested])

  useEffect(() => {
    if (!chat.running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [chat.running])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.items, chat.running])

  const empty = chat.items.length === 0 && !chat.running
  const visibleDiffs = chat.diffs.filter((item) => !item.rejected)
  const showReview = reviewOpen && visibleDiffs.length > 0
  const elapsed = chat.runStartedAt ? formatElapsed(now - chat.runStartedAt) : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return chat.sessions.filter((session) => {
      if (!q) return true
      return session.title.toLowerCase().includes(q) || session.model.toLowerCase().includes(q)
    })
  }, [chat.sessions, query])

  const today = filtered.filter((session) => isToday(session.updatedAt))
  const older = filtered.filter((session) => !isToday(session.updatedAt))

  return (
    <div className="flex h-dvh min-h-screen overflow-hidden bg-background text-foreground">
      <KeyboardShortcuts />
      <CommandPalette />
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-black/10 md:flex">
        <AgentList
          query={query}
          setQuery={setQuery}
          today={today}
          older={older}
          filteredCount={filtered.length}
          activeId={chat.sessionId}
          now={now}
          onNew={() => {
            chat.newSession()
            setReviewOpen(true)
          }}
          onSelect={(id) => {
            chat.loadSession(id)
            setReviewOpen(true)
          }}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 px-3 sm:px-5">
          <Sheet open={mobileNav} onOpenChange={setMobileNav}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open agent list" />
              }
            >
              <MenuIcon />
              <span className="sr-only">Open agent list</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetTitle className="sr-only">Agents</SheetTitle>
              <AgentList
                query={query}
                setQuery={setQuery}
                today={today}
                older={older}
                filteredCount={filtered.length}
                activeId={chat.sessionId}
                now={now}
                onNew={() => {
                  chat.newSession()
                  setReviewOpen(true)
                  setMobileNav(false)
                }}
                onSelect={(id) => {
                  chat.loadSession(id)
                  setReviewOpen(true)
                  setMobileNav(false)
                }}
              />
            </SheetContent>
          </Sheet>
          {!empty ? (
            <div className="min-w-0 text-[13px]">
              <span className="font-medium">{chat.title}</span>
              <span className="text-muted-foreground"> · playground</span>
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground">playground · main</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Link href="/agents" className="text-[13px] font-medium">
              Agents
            </Link>
            <Link href="/" className="text-[13px] text-muted-foreground hover:text-foreground">
              Workspace
            </Link>
            {visibleDiffs.length > 0 ? (
              <Button size="sm" className="rounded-full px-3" onClick={() => setReviewOpen((value) => !value)}>
                Review
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-full"
              aria-label="Account"
              nativeButton={false}
              render={<Link href="/" />}
            >
              <CircleUserIcon />
              <span className="sr-only">Account</span>
            </Button>
          </div>
        </header>
        <DemoBanner className="border-black/10" />

        {empty ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-24">
            <div className="w-full max-w-[560px]">
              <AgentComposer
                variant="agents"
                draft={chat.draft}
                setDraft={chat.setDraft}
                running={chat.running}
                placeholder={PLACEHOLDER[workspace.agentMode]}
                context={chat.context}
                contextState={chat.contextState}
                composerRef={chat.composerRef}
                showModel
                suggestions={AGENTS_SUGGESTIONS}
                onSubmit={(prompt) => void chat.submit(prompt)}
                onStop={() => void chat.stop()}
                onToggleKind={chat.toggleKind}
                onAttach={chat.attachChip}
                onRemove={chat.removeChip}
              />
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 px-8 pt-2 pb-3">
                <ModeToggle className="rounded-full border bg-card p-0.5" itemClassName="rounded-full" />
                <div className="rounded-full border bg-card px-3 py-1.5">
                  <p className="text-[12px] font-medium">{AGENT_MODEL_LABELS[workspace.model]}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {chat.running && elapsed ? `Working for ${elapsed}` : chat.demo ? 'Demo' : 'Ready'}
                  </p>
                </div>
                {chat.demo ? (
                  <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
                    demo
                  </Badge>
                ) : null}
                {chat.checkpoint ? (
                  <Button size="xs" variant="ghost" onClick={() => void chat.undoCheckpoint()}>
                    Undo checkpoint
                  </Button>
                ) : null}
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-8 pb-8">
                  <TranscriptList
                    items={chat.items}
                    onApply={(diff) => void chat.applyDiff(diff)}
                    onReject={chat.rejectDiff}
                    onApprovePlan={(item) => void chat.approvePlan(item)}
                  />
                  {!chat.running ? (
                    <FileChangedSummary
                      diffs={chat.diffs}
                      showEmpty
                      onSelect={() => setReviewOpen(true)}
                    />
                  ) : null}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
              <div className="mx-auto w-full max-w-[720px] px-8 py-4">
                <AgentComposer
                  variant="followup"
                  draft={chat.draft}
                  setDraft={chat.setDraft}
                  running={chat.running}
                  placeholder="Add a follow up"
                  context={chat.context}
                  contextState={chat.contextState}
                  composerRef={chat.composerRef}
                  showModel
                  onSubmit={(prompt) => void chat.submit(prompt)}
                  onStop={() => void chat.stop()}
                  onToggleKind={chat.toggleKind}
                  onAttach={chat.attachChip}
                  onRemove={chat.removeChip}
                />
              </div>
            </div>
            {showReview ? (
              <div className="hidden min-h-0 lg:flex">
                <FilesChangedRail
                  diffs={chat.diffs}
                  onClose={() => setReviewOpen(false)}
                  onApply={(diff) => void chat.applyDiff(diff)}
                  onReject={chat.rejectDiff}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function AgentList({
  query,
  setQuery,
  today,
  older,
  filteredCount,
  activeId,
  now,
  onNew,
  onSelect,
}: {
  query: string
  setQuery: (value: string) => void
  today: StoredAgentSession[]
  older: StoredAgentSession[]
  filteredCount: number
  activeId: string | null
  now: number
  onNew: () => void
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 px-3 pt-3">
        <span className="flex size-6 items-center justify-center">
          <CursorMark className="size-3.5" />
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto text-muted-foreground"
          aria-label="Open workspace"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <SearchIcon className="size-3.5" />
          <span className="sr-only">Workspace</span>
        </Button>
      </div>
      <div className="px-3 pt-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents…"
            aria-label="Search agents"
            className="h-8 rounded-lg bg-card pl-8 text-xs shadow-none"
          />
        </div>
        <Button variant="outline" size="sm" className="mt-2 w-full rounded-lg bg-card" onClick={onNew}>
          <PlusIcon data-icon="inline-start" />
          New Agent
        </Button>
      </div>
      <ScrollArea className="mt-3 min-h-0 flex-1">
        {query.trim() && filteredCount === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No results</p>
        ) : (
          <>
            <SessionGroup title="Today" sessions={today} activeId={activeId} now={now} onSelect={onSelect} />
            {older.length > 0 ? (
              <SessionGroup title="Older" sessions={older} activeId={activeId} now={now} onSelect={onSelect} />
            ) : null}
          </>
        )}
      </ScrollArea>
    </div>
  )
}

function SessionGroup({
  title,
  sessions,
  activeId,
  now,
  onSelect,
}: {
  title: string
  sessions: StoredAgentSession[]
  activeId: string | null
  now: number
  onSelect: (id: string) => void
}) {
  if (sessions.length === 0) {
    return title === 'Today' ? (
      <div className="px-3 py-4">
        <p className="px-1 text-[11px] font-medium text-muted-foreground uppercase">{title}</p>
        <p className="mt-2 px-1 text-xs text-muted-foreground">No agents yet.</p>
      </div>
    ) : null
  }
  return (
    <div className="px-2 py-2">
      <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground uppercase">{title}</p>
      <div className="flex flex-col">
        {sessions.map((session) => {
          const active = session.id === activeId
          return (
            <button
              key={session.id}
              type="button"
              className={cn(
                'flex items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-black/5',
                active && 'bg-card shadow-sm',
              )}
              onClick={() => onSelect(session.id)}
            >
              {active ? (
                <CheckIcon className="mt-0.5 size-3.5 text-muted-foreground" />
              ) : (
                <span className="mt-0.5 size-3.5" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{session.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {AGENT_MODEL_LABELS[session.model]} · playground
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formatRelativeTime(session.updatedAt, now)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
