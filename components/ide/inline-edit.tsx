'use client'

import { useEffect, useRef, useState } from 'react'
import { SparklesIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Textarea } from '@/components/ui/textarea'
import { cancelRun, createSession, runPrompt } from '@/lib/agent/client'
import { unwrapFences } from '@/lib/agent/inline-rewrite'
import type { AgentEvent, AgentMode } from '@/lib/agent/types'
import { useWorkspace } from '@/lib/workspace/store'

type InlineEditOverlayProps = {
  onAccept: (text: string) => void
}

export function InlineEditOverlay({ onAccept }: InlineEditOverlayProps) {
  const workspace = useWorkspace()
  const [prompt, setPrompt] = useState('')
  const [proposed, setProposed] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (workspace.inlineEditOpen) return
    abortRef.current?.abort()
    abortRef.current = null
    setPrompt('')
    setProposed(null)
    setStreaming(false)
    setError(null)
  }, [workspace.inlineEditOpen])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  if (!workspace.inlineEditOpen) return null

  const selection = workspace.selection
  const path = workspace.activeFile
  const preview = selection?.text?.trim() ? selection.text : ''

  async function stop() {
    abortRef.current?.abort()
    const id = sessionIdRef.current
    if (id) await cancelRun(id).catch(() => undefined)
  }

  async function generate() {
    if (!prompt.trim() || streaming) return
    setStreaming(true)
    setError(null)
    setProposed('')

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const mode: AgentMode = workspace.agentMode === 'ask' ? 'ask' : 'agent'
    let output = ''

    try {
      const created = await createSession({ mode, model: workspace.model })
      sessionIdRef.current = created.sessionId

      await runPrompt(
        {
          sessionId: created.sessionId,
          prompt: prompt.trim(),
          mode,
          model: workspace.model,
          inline: true,
          context:
            selection && path
              ? [
                  {
                    kind: 'selection',
                    path,
                    label: `${path}:${selection.startLine}-${selection.endLine}`,
                    content: selection.text,
                    startLine: selection.startLine,
                    endLine: selection.endLine,
                  },
                ]
              : [],
        },
        {
          signal: controller.signal,
          onEvent: (event: AgentEvent) => {
            if (event.type === 'assistant' && event.text) {
              output = event.delta ? output + event.text : event.text
              setProposed(output)
            }
            if (event.type === 'tool_call' && event.status === 'completed') {
              const next = event.args?.new_string
              if (typeof next === 'string' && next && !output) {
                output = next
                setProposed(next)
              }
            }
            if (event.type === 'error') {
              setError(event.message)
            }
          },
        },
      )

      if (controller.signal.aborted) return
      const final = unwrapFences(output)
      setProposed(final || null)
      if (!final) setError('No replacement returned')
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Inline edit failed')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setStreaming(false)
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-4">
      <div
        role="dialog"
        aria-label="Inline edit"
        aria-modal="true"
        className="pointer-events-auto w-full max-w-xl rounded-lg border bg-popover p-2 shadow-md ring-1 ring-foreground/10"
      >
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
          <SparklesIcon className="size-3" />
          Inline edit
          {path && selection ? (
            <span className="truncate font-mono">
              {path}:{selection.startLine}-{selection.endLine}
            </span>
          ) : null}
          <span className="ml-auto font-mono">{workspace.model}</span>
        </div>
        {preview ? (
          <pre className="mb-2 max-h-16 overflow-auto rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] leading-4 text-muted-foreground">
            {preview.split('\n').slice(0, 4).join('\n')}
            {preview.split('\n').length > 4 ? '\n…' : ''}
          </pre>
        ) : (
          <p className="mb-2 px-1 text-[11px] text-muted-foreground">No selection — edit will insert at the cursor.</p>
        )}
        <Textarea
          autoFocus
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Edit the selection…"
          aria-label="Inline edit prompt"
          className="min-h-12 text-xs"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              void stop()
              workspace.setInlineEditOpen(false)
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              if (proposed && !streaming) {
                onAccept(proposed)
                workspace.setInlineEditOpen(false)
                workspace.setNotice('Applied inline edit')
                return
              }
              void generate()
            }
          }}
        />
        {error ? (
          <p role="alert" className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
            {error}
          </p>
        ) : null}
        {proposed !== null ? (
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/60 p-2 font-mono text-[11px] leading-5 whitespace-pre-wrap">
            {proposed || (streaming ? '…' : '')}
          </pre>
        ) : null}
        <div className="mt-2 flex items-center gap-1.5">
          <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:inline-flex">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
            {proposed && !streaming ? 'accept' : 'run'}
            <Kbd className="ml-1">esc</Kbd>
            cancel
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                void stop()
                workspace.setInlineEditOpen(false)
              }}
            >
              Cancel
            </Button>
            {streaming ? (
              <Button size="xs" variant="secondary" onClick={() => void stop()}>
                Stop
              </Button>
            ) : null}
            {proposed && !streaming ? (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setProposed(null)
                    workspace.setInlineEditOpen(false)
                  }}
                >
                  Reject
                </Button>
                <Button
                  size="xs"
                  onClick={() => {
                    onAccept(proposed)
                    workspace.setInlineEditOpen(false)
                    workspace.setNotice('Applied inline edit')
                  }}
                >
                  Accept
                </Button>
              </>
            ) : (
              <Button size="xs" disabled={streaming || !prompt.trim()} onClick={() => void generate()}>
                {streaming ? 'Editing…' : 'Edit'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
