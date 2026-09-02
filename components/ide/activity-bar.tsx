'use client'

import {
  BlocksIcon,
  FilesIcon,
  GitBranchIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/store'
import type { SidebarPanel } from '@/lib/workspace/types'

const ITEMS: {
  id: SidebarPanel
  label: string
  icon: typeof FilesIcon
  shortcut?: string
}[] = [
  { id: 'explorer', label: 'Explorer', icon: FilesIcon, shortcut: '⇧⌘E' },
  { id: 'search', label: 'Search', icon: SearchIcon, shortcut: '⇧⌘F' },
  { id: 'scm', label: 'Source Control', icon: GitBranchIcon, shortcut: '⇧⌘G' },
  { id: 'agent', label: 'Agent', icon: SparklesIcon, shortcut: '⌘I' },
  { id: 'extensions', label: 'Extensions', icon: BlocksIcon, shortcut: '⇧⌘X' },
]

export function ActivityBar() {
  const workspace = useWorkspace()

  return (
    <nav aria-label="Activity bar" className="flex w-12 shrink-0 select-none flex-col items-center border-r bg-background py-1">
      <div className="flex flex-1 flex-col items-center gap-0.5">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const active = workspace.sidebarOpen && workspace.sidebarPanel === item.id
          const badge =
            item.id === 'scm' && workspace.changes.length > 0
              ? workspace.changes.length
              : undefined

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={item.label}
                    aria-pressed={active}
                    className={cn(
                      'relative size-10 rounded-none text-muted-foreground hover:bg-transparent hover:text-foreground',
                      active && 'text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground',
                    )}
                    onClick={() => {
                      if (item.id === 'agent') {
                        workspace.focusChat()
                        workspace.setSidebarPanel('agent')
                        return
                      }
                      if (active) workspace.setSidebarOpen(false)
                      else workspace.setSidebarPanel(item.id)
                    }}
                  />
                }
              >
                <Icon className="size-5" />
                {badge ? (
                  <span className="absolute top-1.5 right-1.5 flex size-3.5 items-center justify-center rounded-full bg-foreground text-[9px] font-medium text-background">
                    {badge}
                  </span>
                ) : null}
                <span className="sr-only">{item.label}</span>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-2">
                {item.label}
                {item.shortcut ? <Kbd>{item.shortcut}</Kbd> : null}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Settings"
              className="size-10 rounded-none text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => workspace.setCommandPaletteOpen(true)}
            />
          }
        >
          <SettingsIcon className="size-5" />
          <span className="sr-only">Settings</span>
        </TooltipTrigger>
        <TooltipContent side="right">Settings</TooltipContent>
      </Tooltip>
    </nav>
  )
}
