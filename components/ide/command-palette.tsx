'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  BlocksIcon,
  FileIcon,
  GitBranchIcon,
  MessageSquarePlusIcon,
  PanelBottomIcon,
  PanelLeftIcon,
  SaveIcon,
  SearchIcon,
  SparklesIcon,
  SquareTerminalIcon,
  WandSparklesIcon,
} from 'lucide-react'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/kbd'
import { fileLabel } from '@/lib/workspace/tree'
import { useWorkspace } from '@/lib/workspace/store'

export function CommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const workspace = useWorkspace()
  const isAgents = pathname.startsWith('/agents')

  function close() {
    workspace.setCommandPaletteOpen(false)
  }

  return (
    <CommandDialog
      open={workspace.commandPaletteOpen}
      onOpenChange={workspace.setCommandPaletteOpen}
      title="Command Palette"
      description="Search files and commands"
      className="sm:max-w-xl"
    >
      <Command loop>
        <CommandInput placeholder="Search files and commands…" aria-label="Search files and commands" />
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
          <CommandGroup heading="Commands">
            <CommandItem
              value="toggle agent chat"
              onSelect={() => {
                if (isAgents) workspace.focusChat()
                else if (workspace.chatOpen) workspace.setChatOpen(false)
                else workspace.focusChat()
                close()
              }}
            >
              <SparklesIcon />
              {isAgents ? 'Focus Composer' : 'Toggle Agent'}
              <CommandShortcut>⌘I</CommandShortcut>
            </CommandItem>
            <CommandItem
              value={isAgents ? 'new agent chat' : 'new chat'}
              onSelect={() => {
                workspace.newChat()
                close()
              }}
            >
              <MessageSquarePlusIcon />
              {isAgents ? 'New Agent' : 'New Chat'}
            </CommandItem>
            {workspace.selection?.text && !isAgents ? (
              <CommandItem
                value="inline edit selection"
                onSelect={() => {
                  workspace.setInlineEditOpen(true)
                  close()
                }}
              >
                <WandSparklesIcon />
                Inline Edit
                <CommandShortcut>⌘K</CommandShortcut>
              </CommandItem>
            ) : null}
            {isAgents ? (
              <CommandItem
                value="go to workspace"
                onSelect={() => {
                  close()
                  router.push('/')
                }}
              >
                <FileIcon />
                Go to Workspace
              </CommandItem>
            ) : (
              <>
                <CommandItem
                  value="focus terminal"
                  onSelect={() => {
                    workspace.focusTerminal()
                    close()
                  }}
                >
                  <SquareTerminalIcon />
                  Focus Terminal
                  <CommandShortcut>⌘J</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="go to agents"
                  onSelect={() => {
                    close()
                    router.push('/agents')
                  }}
                >
                  <WandSparklesIcon />
                  Go to Agents
                </CommandItem>
                <CommandItem
                  value="toggle sidebar"
                  onSelect={() => {
                    workspace.toggleSidebar()
                    close()
                  }}
                >
                  <PanelLeftIcon />
                  Toggle Sidebar
                  <CommandShortcut>⌘B</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="toggle bottom panel"
                  onSelect={() => {
                    workspace.toggleBottom()
                    close()
                  }}
                >
                  <PanelBottomIcon />
                  Toggle Panel
                  <CommandShortcut>⌘J</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="search playground"
                  onSelect={() => {
                    workspace.setSearchQuery(workspace.searchQuery)
                    close()
                  }}
                >
                  <SearchIcon />
                  Search
                  <CommandShortcut>⇧⌘F</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="source control git"
                  onSelect={() => {
                    workspace.setSidebarPanel('scm')
                    close()
                  }}
                >
                  <GitBranchIcon />
                  Source Control
                  <CommandShortcut>⇧⌘G</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="extensions"
                  onSelect={() => {
                    workspace.setSidebarPanel('extensions')
                    close()
                  }}
                >
                  <BlocksIcon />
                  Extensions
                  <CommandShortcut>⇧⌘X</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="save file"
                  onSelect={() => {
                    void workspace.saveFile()
                    close()
                  }}
                >
                  <SaveIcon />
                  Save File
                  <CommandShortcut>⌘S</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="new file"
                  onSelect={() => {
                    workspace.setNewFileOpen(true)
                    close()
                  }}
                >
                  <FileIcon />
                  New File
                </CommandItem>
              </>
            )}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Files">
            {Object.keys(workspace.files).length === 0 ? (
              <CommandItem value="no files" disabled>
                No files in playground
              </CommandItem>
            ) : (
              Object.keys(workspace.files).map((path) => (
                <CommandItem
                  key={path}
                  value={`file ${path} ${fileLabel(path)}`}
                  onSelect={() => {
                    if (isAgents) {
                      close()
                      router.push(`/?file=${encodeURIComponent(path)}`)
                      return
                    }
                    workspace.openFile(path)
                    close()
                  }}
                >
                  <FileIcon />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-foreground">{fileLabel(path)}</span>
                    <span className="ml-2 text-muted-foreground">{path}</span>
                  </span>
                </CommandItem>
              ))
            )}
          </CommandGroup>
        </CommandList>
      </Command>
      <div className="flex items-center gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          navigate
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>↵</Kbd>
          run
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Kbd>esc</Kbd>
          close
        </span>
      </div>
    </CommandDialog>
  )
}
