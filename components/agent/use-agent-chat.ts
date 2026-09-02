'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { cancelRun, createSession, runPrompt } from '@/lib/agent/client'
import {
  getStoredSession,
  loadStoredSessions,
  subscribeStoredSessions,
  upsertStoredSession,
  type StoredAgentSession,
} from '@/lib/agent/session-memory'
import {
  collectDiffs,
  markDiff,
  markPlanApproved,
  reduceEvent,
  titleFromPrompt,
  uid,
  type TranscriptItem,
} from '@/lib/agent/transcript'
import type { AgentEvent, AgentMode, ContextChip, ContextChipKind, PendingDiff } from '@/lib/agent/types'
import { useWorkspace } from '@/lib/workspace/store'
import type { FileMap } from '@/lib/workspace/types'

export type ComposerContextState = {
  kinds: Record<ContextChipKind, boolean>
  extra: ContextChip[]
}

const DEFAULT_KINDS: Record<ContextChipKind, boolean> = {
  file: true,
  selection: true,
  folder: false,
  codebase: false,
}

export function useAgentChat(options: { resetSignal?: number } = {}) {
  const workspace = useWorkspace()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [demo, setDemo] = useState<boolean | null>(null)
  const [running, setRunning] = useState(false)
  const [items, setItems] = useState<TranscriptItem[]>([])
  const [draft, setDraft] = useState('')
  const [checkpoint, setCheckpoint] = useState<FileMap | null>(null)
  const [createdAt, setCreatedAt] = useState(() => Date.now())
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [sessions, setSessions] = useState<StoredAgentSession[]>([])
  const [contextState, setContextState] = useState<ComposerContextState>({
    kinds: DEFAULT_KINDS,
    extra: [],
  })
  const abortRef = useRef<AbortController | null>(null)
  const itemsRef = useRef(items)
  const sessionIdRef = useRef(sessionId)
  const skipReset = useRef(true)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const persistCurrentRef = useRef<() => void>(() => undefined)
  const resetLocalRef = useRef<() => void>(() => undefined)

  itemsRef.current = items
  sessionIdRef.current = sessionId

  const patchItems = useCallback((updater: (current: TranscriptItem[]) => TranscriptItem[]) => {
    setItems((current) => {
      const next = updater(current)
      itemsRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    setSessions(loadStoredSessions())
    return subscribeStoredSessions(() => setSessions(loadStoredSessions()))
  }, [])

  useEffect(() => {
    if (workspace.chatFocus > 0) composerRef.current?.focus()
  }, [workspace.chatFocus])

  const context = useMemo(
    () => (workspace.hydrated ? buildContext(workspace, contextState) : []),
    [workspace, contextState],
  )

  const diffs = useMemo(() => collectDiffs(items), [items])
  const title = useMemo(() => {
    const user = items.find((item) => item.kind === 'user')
    return user ? titleFromPrompt(user.text) : 'New Agent'
  }, [items])

  const applyEvent = useCallback((event: AgentEvent) => {
    patchItems((current) => reduceEvent(current, event))
    if (event.type === 'system') {
      if (event.demo != null) setDemo(event.demo)
      if (event.sessionId) setSessionId(event.sessionId)
    }
  }, [patchItems])

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current
    const created = await createSession({
      mode: workspace.agentMode,
      model: workspace.model,
    })
    sessionIdRef.current = created.sessionId
    setSessionId(created.sessionId)
    setDemo(created.demo)
    return created.sessionId
  }, [workspace.agentMode, workspace.model])

  const applyDiff = useCallback(
    async (diff: PendingDiff, options?: { revert?: boolean }) => {
      const content = options?.revert ? diff.before : diff.after
      try {
        const response = await fetch('/api/workspace/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: diff.path, content }),
        })
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || 'Apply failed')
        }
        workspace.applyFile(diff.path, content)
        patchItems((current) =>
          markDiff(current, diff.id, options?.revert ? { rejected: true, applied: false } : { applied: true, rejected: false }),
        )
        workspace.setNotice(options?.revert ? `Reverted ${diff.path}` : `Applied ${diff.path}`)
        workspace.pushLog('editor', `${options?.revert ? 'Reverted' : 'Applied'} agent edit ${diff.path}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Apply failed')
      }
    },
    [patchItems, workspace],
  )

  const rejectDiff = useCallback(
    (diff: PendingDiff) => {
      const item = itemsRef.current.find((entry) => entry.kind === 'diff' && entry.diff.id === diff.id)
      if (item?.kind === 'diff' && item.applied) {
        void applyDiff(diff, { revert: true })
        return
      }
      patchItems((current) => markDiff(current, diff.id, { rejected: true }))
      workspace.setNotice(`Rejected ${diff.path}`)
    },
    [applyDiff, patchItems, workspace],
  )

  const autoApplyPending = useCallback(async () => {
    const pending = collectDiffs(itemsRef.current).filter((item) => !item.rejected && !item.applied)
    for (const item of pending) {
      await applyDiff(item.diff)
    }
  }, [applyDiff])

  const submit = useCallback(
    async (nextPrompt?: string, nextMode?: AgentMode) => {
      const text = (nextPrompt ?? draft).trim()
      if (!text || running) return
      if (!nextPrompt) setDraft('')
      const mode = nextMode ?? workspace.agentMode
      if (nextMode) workspace.setAgentMode(nextMode)

      setRunning(true)
      setRunStartedAt(Date.now())
      patchItems((current) => [...current, { kind: 'user', id: uid(), text }])
      if (mode === 'agent') setCheckpoint({ ...workspace.files })
      workspace.pushLog('system', `Running ${mode} on ${workspace.model}`)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        let id = await ensureSession()
        const payload = {
          sessionId: id,
          prompt: text,
          mode,
          model: workspace.model,
          context,
        }
        try {
          await runPrompt(payload, { signal: controller.signal, onEvent: applyEvent })
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          if (!controller.signal.aborted && /session not found/i.test(message)) {
            sessionIdRef.current = null
            setSessionId(null)
            id = await ensureSession()
            await runPrompt(
              { ...payload, sessionId: id },
              { signal: controller.signal, onEvent: applyEvent },
            )
          } else {
            throw error
          }
        }
        if (mode === 'agent') await autoApplyPending()
        await workspace.refreshWorkspace()
      } catch (error) {
        if (controller.signal.aborted) {
          patchItems((current) => [...current, { kind: 'status', id: uid(), text: 'Cancelled' }])
        } else {
          const message = error instanceof Error ? error.message : 'Agent run failed'
          patchItems((current) => [...current, { kind: 'error', id: uid(), text: message }])
          toast.error(message)
        }
      } finally {
        setRunning(false)
        setRunStartedAt(null)
        abortRef.current = null
      }
    },
    [
      applyEvent,
      autoApplyPending,
      context,
      draft,
      ensureSession,
      patchItems,
      running,
      workspace,
    ],
  )

  const stop = useCallback(async () => {
    abortRef.current?.abort()
    const id = sessionIdRef.current
    if (id) await cancelRun(id).catch(() => undefined)
  }, [])

  const undoCheckpoint = useCallback(async () => {
    if (!checkpoint) return
    try {
      for (const [path, content] of Object.entries(checkpoint)) {
        await fetch('/api/workspace/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, content }),
        })
      }
      workspace.restoreFiles(checkpoint)
      setCheckpoint(null)
      workspace.setNotice('Restored checkpoint')
      workspace.pushLog('system', 'Restored files from last Agent checkpoint')
      await workspace.refreshWorkspace()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Undo failed')
    }
  }, [checkpoint, workspace])

  const approvePlan = useCallback(
    async (item: Extract<TranscriptItem, { kind: 'plan' }>) => {
      patchItems((current) => markPlanApproved(current, item.id))
      workspace.setAgentMode('agent')
      await submit(`Approve this plan and implement it.\n\n${item.markdown}`, 'agent')
    },
    [patchItems, submit, workspace],
  )

  const resetLocal = useCallback(() => {
    abortRef.current?.abort()
    sessionIdRef.current = null
    itemsRef.current = []
    setSessionId(null)
    setDemo(null)
    setItems([])
    setRunning(false)
    setCheckpoint(null)
    setDraft('')
    setCreatedAt(Date.now())
    setRunStartedAt(null)
    setContextState({ kinds: DEFAULT_KINDS, extra: [] })
  }, [])

  const persistCurrent = useCallback(() => {
    const id = sessionIdRef.current
    const currentItems = itemsRef.current
    if (!id || currentItems.length === 0) return
    upsertStoredSession({
      id,
      title: titleFromPrompt(currentItems.find((item) => item.kind === 'user')?.text ?? 'New Agent'),
      mode: workspace.agentMode,
      model: workspace.model,
      demo: Boolean(demo),
      createdAt,
      updatedAt: Date.now(),
      items: currentItems,
      checkpoint,
    })
  }, [checkpoint, createdAt, demo, workspace.agentMode, workspace.model])

  persistCurrentRef.current = persistCurrent
  resetLocalRef.current = resetLocal

  const newSession = useCallback(() => {
    persistCurrent()
    resetLocal()
    workspace.focusChat()
  }, [persistCurrent, resetLocal, workspace])

  const loadSession = useCallback(
    (id: string) => {
      persistCurrent()
      const stored = getStoredSession(id)
      if (!stored) return
      abortRef.current?.abort()
      sessionIdRef.current = stored.id
      setSessionId(stored.id)
      setDemo(stored.demo)
      itemsRef.current = stored.items
      setItems(stored.items)
      setCheckpoint(stored.checkpoint)
      setCreatedAt(stored.createdAt)
      setRunning(false)
      setRunStartedAt(null)
      setDraft('')
      workspace.setAgentMode(stored.mode)
      workspace.setModel(stored.model)
    },
    [persistCurrent, workspace],
  )

  useEffect(() => {
    if (options.resetSignal === undefined) return
    if (skipReset.current) {
      skipReset.current = false
      return
    }
    persistCurrentRef.current()
    resetLocalRef.current()
  }, [options.resetSignal])

  useEffect(() => {
    if (!sessionId && items.length === 0) return
    const timer = window.setTimeout(() => persistCurrent(), 160)
    return () => window.clearTimeout(timer)
  }, [items, sessionId, demo, checkpoint, persistCurrent])

  const toggleKind = useCallback((kind: ContextChipKind) => {
    setContextState((current) => ({
      ...current,
      kinds: { ...current.kinds, [kind]: !current.kinds[kind] },
    }))
  }, [])

  const attachChip = useCallback((chip: ContextChip) => {
    setContextState((current) => {
      const id = chip.id ?? uid()
      const next: ContextChip = { ...chip, id }
      const exists = current.extra.some(
        (item) => item.kind === next.kind && item.path === next.path && item.label === next.label,
      )
      if (exists) return current
      return { ...current, extra: [...current.extra, next] }
    })
  }, [])

  const removeChip = useCallback((chip: ContextChip) => {
    if (chip.id) {
      setContextState((current) => ({
        ...current,
        extra: current.extra.filter((item) => item.id !== chip.id),
      }))
      return
    }
    setContextState((current) => ({
      ...current,
      kinds: { ...current.kinds, [chip.kind]: false },
    }))
  }, [])

  return {
    sessionId,
    demo,
    running,
    items,
    draft,
    setDraft,
    checkpoint,
    context,
    contextState,
    diffs,
    title,
    runStartedAt,
    sessions,
    composerRef,
    submit,
    stop,
    applyDiff,
    rejectDiff,
    undoCheckpoint,
    approvePlan,
    newSession,
    loadSession,
    toggleKind,
    attachChip,
    removeChip,
  }
}

function buildContext(
  workspace: ReturnType<typeof useWorkspace>,
  state: ComposerContextState,
): ContextChip[] {
  const chips: ContextChip[] = []
  if (state.kinds.file && workspace.activeFile) {
    chips.push({
      kind: 'file',
      path: workspace.activeFile,
      label: workspace.activeFile,
      content: workspace.files[workspace.activeFile],
    })
  }
  if (state.kinds.selection && workspace.selection?.text && workspace.activeFile) {
    chips.push({
      kind: 'selection',
      path: workspace.activeFile,
      label: `${workspace.activeFile}:${workspace.selection.startLine}-${workspace.selection.endLine}`,
      content: workspace.selection.text,
      startLine: workspace.selection.startLine,
      endLine: workspace.selection.endLine,
    })
  }
  if (state.kinds.folder && workspace.activeFile) {
    const folder = workspace.activeFile.includes('/')
      ? workspace.activeFile.slice(0, workspace.activeFile.lastIndexOf('/'))
      : '.'
    chips.push({ kind: 'folder', path: folder, label: folder })
  }
  if (state.kinds.codebase) {
    chips.push({ kind: 'codebase', label: 'playground' })
  }
  for (const extra of state.extra) {
    const exists = chips.some(
      (chip) => chip.kind === extra.kind && (chip.path ?? chip.label) === (extra.path ?? extra.label),
    )
    if (exists) continue
    if (extra.kind === 'file' && extra.path && workspace.files[extra.path] !== undefined) {
      chips.push({ ...extra, content: extra.content ?? workspace.files[extra.path] })
    } else {
      chips.push(extra)
    }
  }
  return chips
}
