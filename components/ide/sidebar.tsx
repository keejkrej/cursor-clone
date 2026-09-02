'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  SearchIcon,
} from 'lucide-react'

import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  formatRelativeTime,
  loadStoredSessions,
  subscribeStoredSessions,
  type StoredAgentSession,
} from '@/lib/agent/session-memory'
import { cn } from '@/lib/utils'
import { statusLabel } from '@/lib/workspace/git'
import { useWorkspace } from '@/lib/workspace/store'
import type { FileNode, GitStatus } from '@/lib/workspace/types'

export function Sidebar() {
  const workspace = useWorkspace()

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      {workspace.sidebarPanel === 'explorer' ? <ExplorerPanel /> : null}
      {workspace.sidebarPanel === 'search' ? <SearchPanel /> : null}
      {workspace.sidebarPanel === 'scm' ? <ScmPanel /> : null}
      {workspace.sidebarPanel === 'agent' ? <AgentPanel /> : null}
      {workspace.sidebarPanel === 'extensions' ? <ExtensionsPanel /> : null}
    </div>
  )
}

function PanelHeader({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-2 px-3">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </span>
      {action}
    </div>
  )
}

function ExplorerPanel() {
  const workspace = useWorkspace()
  const [name, setName] = useState('src/')

  return (
    <>
      <PanelHeader
        title="Explorer"
        action={
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label="New File"
            onClick={() => workspace.setNewFileOpen(true)}
          >
            <PlusIcon />
            <span className="sr-only">New File</span>
          </Button>
        }
      />
      <div className="px-3 pb-2 text-[11px] font-medium">playground</div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="pb-3">
          {!workspace.hydrated ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading playground…</p>
          ) : workspace.tree.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No files</p>
          ) : (
            workspace.tree.map((node) => <TreeNode key={node.path} node={node} depth={0} />)
          )}
        </div>
      </ScrollArea>
      <Dialog open={workspace.newFileOpen} onOpenChange={workspace.setNewFileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="src/utils.ts"
            aria-label="New file path"
            onKeyDown={(event) => {
              if (event.key === 'Enter') void workspace.createFile(name.trim())
            }}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => workspace.setNewFileOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void workspace.createFile(name.trim())}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TreeNode({ node, depth }: { node: FileNode; depth: number }) {
  const workspace = useWorkspace()
  const [open, setOpen] = useState(
    node.type === 'folder' && (node.path === 'src' || node.path.startsWith('.cursor')),
  )
  const active = workspace.activeFile === node.path
  const dirty = node.type === 'file' && workspace.isDirty(node.path)

  if (node.type === 'folder') {
    return (
      <div>
        <button
          type="button"
          className="flex h-6 w-full items-center gap-1 pr-2 text-left text-[13px] text-foreground/90 hover:bg-sidebar-accent"
          style={{ paddingLeft: 8 + depth * 8 }}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-3.5 text-muted-foreground" />
          )}
          {open ? (
            <FolderOpenIcon className="size-3.5 text-muted-foreground" />
          ) : (
            <FolderIcon className="size-3.5 text-muted-foreground" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open
          ? node.children?.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} />
            ))
          : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex h-6 w-full items-center gap-1.5 pr-2 text-left text-[13px] hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground',
      )}
      style={{ paddingLeft: 24 + depth * 8 }}
      onClick={() => workspace.openFile(node.path)}
    >
      <FileGlyph path={node.path} />
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      {dirty ? <span className="size-1.5 shrink-0 rounded-full bg-foreground/70" /> : null}
    </button>
  )
}

function FileGlyph({ path }: { path: string }) {
  const ext = path.split('.').pop()
  const className = 'size-3.5 text-muted-foreground'
  if (ext === 'json') return <FileJsonIcon className={className} />
  if (ext === 'md' || ext === 'mdc') return <FileTextIcon className={className} />
  if (ext === 'ts' || ext === 'tsx' || ext === 'js') return <FileCodeIcon className={className} />
  return <FileIcon className={className} />
}

function SearchPanel() {
  const workspace = useWorkspace()
  const hits = useMemo(() => {
    const query = workspace.searchQuery.trim().toLowerCase()
    if (!query) return []
    const results: { path: string; line: number; preview: string }[] = []

    for (const [path, content] of Object.entries(workspace.files)) {
      if (path.toLowerCase().includes(query)) {
        results.push({ path, line: 1, preview: path })
      }
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? ''
        if (line.toLowerCase().includes(query)) {
          results.push({ path, line: i + 1, preview: line.trim() })
          if (results.length >= 80) return results
        }
      }
    }

    return results
  }, [workspace.files, workspace.searchQuery])

  return (
    <>
      <PanelHeader title="Search" />
      <div className="px-2 pb-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1.5 left-2 size-3.5 text-muted-foreground" />
          <Input
            value={workspace.searchQuery}
            onChange={(event) => workspace.setSearchQuery(event.target.value)}
            placeholder="Search playground"
            aria-label="Search playground"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-1 pb-3">
          {workspace.searchQuery.trim() === '' ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Search files and contents in the playground.
            </p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No results</p>
          ) : (
            hits.map((hit, index) => (
              <button
                key={`${hit.path}:${hit.line}:${index}`}
                type="button"
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1 text-left hover:bg-sidebar-accent"
                onClick={() =>
                  workspace.revealInEditor({
                    path: hit.path,
                    line: hit.line,
                    column: 1,
                  })
                }
              >
                <span className="text-[12px] text-foreground">{hit.path}</span>
                <span className="w-full truncate font-mono text-[11px] text-muted-foreground">
                  {hit.line}: {hit.preview}
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  )
}

function ScmPanel() {
  const workspace = useWorkspace()
  const staged = workspace.changes.filter((change) => workspace.staged.includes(change.path))
  const unstaged = workspace.changes.filter((change) => !workspace.staged.includes(change.path))

  return (
    <>
      <PanelHeader
        title="Source Control"
        action={
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {workspace.changes.length}
          </Badge>
        }
      />
      <div className="flex flex-col gap-2 px-2 pb-2">
        <Textarea
          value={workspace.commitMessage}
          onChange={(event) => workspace.setCommitMessage(event.target.value)}
          placeholder="Message (⌘Enter to commit)"
          className="min-h-16 text-xs"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void workspace.commit()
            }
          }}
        />
        <Button
          size="sm"
          className="w-full"
          disabled={workspace.staged.length === 0}
          onClick={() => void workspace.commit()}
        >
          Commit
        </Button>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 py-2">
          <ChangeGroup
            title="Staged Changes"
            empty="No staged changes"
            items={staged}
            onToggleAll={workspace.unstageAll}
            allLabel="Unstage All"
          />
          <ChangeGroup
            title="Changes"
            empty="No changes"
            items={unstaged}
            onToggleAll={workspace.stageAll}
            allLabel="Stage All"
          />
        </div>
      </ScrollArea>
    </>
  )
}

function ChangeGroup({
  title,
  empty,
  items,
  onToggleAll,
  allLabel,
}: {
  title: string
  empty: string
  items: { path: string; status: GitStatus }[]
  onToggleAll: () => void
  allLabel: string
}) {
  const workspace = useWorkspace()

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[11px] font-medium text-muted-foreground uppercase">
          {title}
        </span>
        {items.length > 0 ? (
          <Button variant="ghost" size="xs" className="h-5 px-1.5 text-[10px]" onClick={onToggleAll}>
            {allLabel}
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="px-1 py-1 text-[11px] text-muted-foreground">{empty}</p>
      ) : (
        items.map((item) => (
          <div
            key={item.path}
            className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-sidebar-accent"
          >
            <Checkbox
              checked={workspace.staged.includes(item.path)}
              onCheckedChange={() => workspace.toggleStaged(item.path)}
              className="size-3.5"
            />
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-[12px]"
              onClick={() => workspace.openFile(item.path)}
              title={statusLabel(item.status)}
            >
              {item.path}
            </button>
            <span
              className={cn(
                'w-3 text-right font-mono text-[10px] font-medium',
                item.status === 'M' && 'text-amber-500',
                item.status === 'A' && 'text-emerald-500',
                item.status === 'D' && 'text-red-400',
              )}
            >
              {item.status}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

function AgentPanel() {
  const workspace = useWorkspace()
  const [sessions, setSessions] = useState<StoredAgentSession[]>([])

  useEffect(() => {
    setSessions(loadStoredSessions())
    return subscribeStoredSessions(() => setSessions(loadStoredSessions()))
  }, [])

  return (
    <>
      <PanelHeader title="Agent" />
      <div className="flex flex-col gap-2 px-3 py-2">
        <Button
          size="sm"
          onClick={() => {
            workspace.newChat()
            workspace.focusChat()
          }}
        >
          New Chat
        </Button>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/agents" />}>
          Open Agents Window
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Agent can edit. Ask is read-only. Plan drafts a plan, then waits for approval.
        </p>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 py-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase">Sessions</p>
          {sessions.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No local agent sessions yet.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-0.5">
              {sessions.slice(0, 12).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={cn(
                    'flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent',
                    workspace.agentSessionId === session.id && 'bg-sidebar-accent',
                  )}
                  onClick={() => workspace.openAgentSession(session.id)}
                >
                  <span className="truncate text-[12px]">{session.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {session.mode} · {formatRelativeTime(session.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  )
}

function ExtensionsPanel() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const builtins = [
    { name: 'TypeScript and JavaScript', status: 'Built-in' },
    { name: 'Cursor Tab', status: 'Heuristic' },
  ]
  const installable = [
    { id: 'eslint', name: 'ESLint' },
    { id: 'prettier', name: 'Prettier' },
    { id: 'tailwind', name: 'Tailwind CSS' },
  ]

  return (
    <>
      <PanelHeader title="Extensions" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 px-2 pb-3">
          {builtins.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-sidebar-accent"
            >
              <span className="text-[12px]">{item.name}</span>
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                {item.status}
              </Badge>
            </div>
          ))}
          {installable.map((item) => {
            const on = Boolean(enabled[item.id])
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent"
              >
                <span className="text-[12px]">{item.name}</span>
                <Button
                  size="xs"
                  variant={on ? 'secondary' : 'outline'}
                  className="h-5 px-1.5 text-[10px]"
                  aria-pressed={on}
                  aria-label={on ? `Disable ${item.name}` : `Enable ${item.name}`}
                  onClick={() => {
                    const next = !on
                    setEnabled((current) => ({ ...current, [item.id]: next }))
                    toast.success(next ? `${item.name} enabled` : `${item.name} disabled`)
                  }}
                >
                  {on ? 'Enabled' : 'Enable'}
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </>
  )
}
