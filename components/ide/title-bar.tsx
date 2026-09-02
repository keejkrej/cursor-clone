'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GitBranchIcon, SettingsIcon, CircleUserIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { useWorkspace } from '@/lib/workspace/store'

import { CursorMark } from './cursor-mark'

export function TitleBar() {
  const router = useRouter()
  const workspace = useWorkspace()

  return (
    <header className="flex h-9 shrink-0 select-none items-center gap-2 border-b bg-background px-2 text-xs">
      <div className="flex min-w-0 items-center gap-1">
        <span className="flex size-6 items-center justify-center text-foreground">
          <CursorMark className="size-3.5" />
        </span>
        <span className="pr-1 text-[13px] font-medium tracking-tight">Cursor</span>
        <TitleMenu
          label="File"
          items={[
            { label: 'New File…', shortcut: 'N', onSelect: () => workspace.setNewFileOpen(true) },
            { label: 'Save', shortcut: '⌘S', onSelect: () => void workspace.saveFile() },
            { type: 'sep' },
            { label: 'Open Agents Window', onSelect: () => router.push('/agents') },
          ]}
        />
        <TitleMenu
          label="View"
          items={[
            { label: 'Toggle Sidebar', shortcut: '⌘B', onSelect: workspace.toggleSidebar },
            { label: 'Toggle Panel', shortcut: '⌘J', onSelect: workspace.toggleBottom },
            {
              label: 'Toggle Agent',
              shortcut: '⌘I',
              onSelect: () => {
                if (workspace.chatOpen) workspace.setChatOpen(false)
                else workspace.focusChat()
              },
            },
            { type: 'sep' },
            { label: 'Command Palette…', shortcut: '⌘K', onSelect: workspace.openCommandK },
          ]}
        />
        <TitleMenu
          label="Go"
          items={[
            { label: 'Go to File…', shortcut: '⌘P', onSelect: () => workspace.setCommandPaletteOpen(true) },
            { label: 'Focus Terminal', shortcut: '⌘J', onSelect: workspace.focusTerminal },
            { label: 'Agents Window', onSelect: () => router.push('/agents') },
          ]}
        />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">playground</span>
          <Separator orientation="vertical" className="h-3" />
          <GitBranchIcon className="size-3" />
          <span>main</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label="Settings" />
            }
          >
            <SettingsIcon />
            <span className="sr-only">Settings</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={() => workspace.setCommandPaletteOpen(true)}>
              Command Palette
              <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => workspace.setNotice('Using default shadcn dark tokens')}>
              Color Theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/agents" />}>Open Agents</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label="Account" />
            }
          >
            <CircleUserIcon />
            <span className="sr-only">Account</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem disabled>Sign in</DropdownMenuItem>
            <DropdownMenuItem onClick={() => workspace.setNotice('Local playground account')}>
              Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

type MenuEntry =
  | { type: 'sep' }
  | { type?: 'item'; label: string; shortcut?: string; onSelect: () => void }

function TitleMenu({ label, items }: { label: string; items: MenuEntry[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="hidden px-1.5 text-muted-foreground hover:text-foreground sm:inline-flex"
          />
        }
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {items.map((item, index) =>
          item.type === 'sep' ? (
            <DropdownMenuSeparator key={`sep-${index}`} />
          ) : (
            <DropdownMenuItem key={item.label} onClick={item.onSelect}>
              {item.label}
              {item.shortcut ? (
                <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
