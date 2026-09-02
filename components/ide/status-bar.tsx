'use client'

import { GitBranchIcon, TriangleAlertIcon, XCircleIcon } from 'lucide-react'

import { Separator } from '@/components/ui/separator'
import { useDemoMode } from '@/lib/agent/use-demo-mode'
import { useWorkspace } from '@/lib/workspace/store'

export function StatusBar() {
  const workspace = useWorkspace()
  const demo = useDemoMode()
  const errors = workspace.problems.filter((problem) => problem.severity === 'error').length
  const warnings = workspace.problems.filter((problem) => problem.severity === 'warning').length

  return (
    <footer className="flex h-6 shrink-0 select-none items-center gap-2 border-t bg-muted/40 px-2 text-[11px] text-muted-foreground">
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground"
        onClick={() => workspace.setSidebarPanel('scm')}
      >
        <GitBranchIcon className="size-3" />
        main
      </button>
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground"
        onClick={() => {
          workspace.setBottomPanel('problems')
          workspace.setBottomOpen(true)
        }}
      >
        <XCircleIcon className="size-3" />
        {errors}
        <TriangleAlertIcon className="size-3" />
        {warnings}
      </button>
      <Separator orientation="vertical" className="h-3" />
      <span className="truncate">{workspace.notice ?? 'Ready'}</span>
      <span className="ml-auto flex min-w-0 items-center gap-3 overflow-hidden">
        {demo ? <span className="hidden sm:inline">Demo</span> : null}
        <span className="shrink-0">
          Ln {workspace.cursor.line}, Col {workspace.cursor.column}
        </span>
        <span className="hidden md:inline">Spaces: 2</span>
        <span className="hidden sm:inline">UTF-8</span>
        <span className="hidden sm:inline capitalize">{workspace.language}</span>
        <span className="capitalize">{workspace.agentMode}</span>
      </span>
    </footer>
  )
}
