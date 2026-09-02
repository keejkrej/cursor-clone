'use client'

import { useEffect, useRef } from 'react'
import { PlusIcon, SparklesIcon, Undo2Icon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IDE_SUGGESTIONS } from '@/lib/agent/suggestions'
import type { AgentMode } from '@/lib/agent/types'
import { useWorkspace } from '@/lib/workspace/store'

import { DemoBanner } from '@/components/ide/demo-banner'

import { AgentComposer } from './composer'
import { ModeToggle } from './mode-toggle'
import { ModelSelect } from './model-select'
import { FileChangedSummary, TranscriptList } from './transcript'
import { useAgentChat } from './use-agent-chat'

const PLACEHOLDER: Record<AgentMode, string> = {
  agent: 'Ask to build, fix, or edit…',
  ask: 'Ask a question about your code…',
  plan: 'Describe what you want to plan…',
}

export function ChatRail() {
  const workspace = useWorkspace()
  const chat = useAgentChat({ resetSignal: workspace.chatNonce })
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.items, chat.running])

  useEffect(() => {
    if (workspace.agentSessionId) chat.loadSession(workspace.agentSessionId)
    // loadSession is recreated with workspace; key off the selected session id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.agentSessionId])

  const empty = chat.items.length === 0 && !chat.running

  return (
    <aside className="flex h-full min-h-0 flex-col border-l bg-background">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b px-2">
        <SparklesIcon className="size-3.5 text-muted-foreground" />
        <span className="text-[12px] font-medium">Ask Cursor</span>
        {chat.demo ? (
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            demo
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Undo checkpoint"
            disabled={!chat.checkpoint}
            onClick={() => void chat.undoCheckpoint()}
          >
            <Undo2Icon />
            <span className="sr-only">Undo checkpoint</span>
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="New chat" onClick={workspace.newChat}>
            <PlusIcon />
            <span className="sr-only">New chat</span>
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1">
        <ModeToggle className="flex-1" />
        <ModelSelect compact />
      </div>
      <DemoBanner />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-3 py-3">
          {empty ? (
            <div className="flex flex-col items-center justify-center px-1 py-8 text-center">
              <p className="text-sm font-medium">How can I help with your code today?</p>
              <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
                Agent can edit. Ask is read-only. Plan waits for approval.
              </p>
            </div>
          ) : (
            <>
              <TranscriptList
                items={chat.items}
                density="compact"
                onApply={(diff) => void chat.applyDiff(diff)}
                onReject={chat.rejectDiff}
                onApprovePlan={(item) => void chat.approvePlan(item)}
              />
              {!chat.running ? (
                <FileChangedSummary
                  diffs={chat.diffs}
                  showEmpty
                  onSelect={(path) => workspace.openFile(path)}
                />
              ) : null}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <AgentComposer
          variant="ide"
          draft={chat.draft}
          setDraft={chat.setDraft}
          running={chat.running}
          placeholder={PLACEHOLDER[workspace.agentMode]}
          context={chat.context}
          contextState={chat.contextState}
          composerRef={chat.composerRef}
          suggestions={empty ? IDE_SUGGESTIONS : undefined}
          onSubmit={(prompt) => void chat.submit(prompt)}
          onStop={() => void chat.stop()}
          onToggleKind={chat.toggleKind}
          onAttach={chat.attachChip}
          onRemove={chat.removeChip}
        />
      </div>
    </aside>
  )
}
