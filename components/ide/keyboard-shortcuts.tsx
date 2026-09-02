'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { useWorkspace } from '@/lib/workspace/store'

export function KeyboardShortcuts() {
  const workspace = useWorkspace()
  const pathname = usePathname()
  const isAgents = pathname.startsWith('/agents')

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const target = event.target
      const inField =
        target instanceof HTMLElement &&
        (target.closest('textarea, input, [contenteditable=true], [role="combobox"]') !== null)

      if (event.key === 'Escape') {
        if (workspace.inlineEditOpen) {
          workspace.setInlineEditOpen(false)
          event.preventDefault()
          return
        }
        if (workspace.commandPaletteOpen) {
          workspace.setCommandPaletteOpen(false)
          event.preventDefault()
          return
        }
        if (workspace.newFileOpen) {
          workspace.setNewFileOpen(false)
          event.preventDefault()
        }
        return
      }

      if (!mod || event.repeat) return

      if (key === 'k') {
        if (inField && workspace.inlineEditOpen) return
        event.preventDefault()
        if (!isAgents && workspace.selection?.text && !event.shiftKey) {
          workspace.setInlineEditOpen(true)
          workspace.setCommandPaletteOpen(false)
          return
        }
        workspace.setCommandPaletteOpen(true)
        return
      }

      if (key === 'p') {
        event.preventDefault()
        workspace.setCommandPaletteOpen(true)
        return
      }

      if (isAgents) {
        if (key === 'i') {
          event.preventDefault()
          workspace.focusChat()
        }
        return
      }

      if (key === 's') {
        event.preventDefault()
        void workspace.saveFile()
        return
      }

      if (event.shiftKey && key === 'f') {
        event.preventDefault()
        workspace.setSearchQuery(workspace.searchQuery)
        return
      }

      if (event.shiftKey && key === 'e') {
        event.preventDefault()
        workspace.setSidebarPanel('explorer')
        return
      }

      if (event.shiftKey && key === 'g') {
        event.preventDefault()
        workspace.setSidebarPanel('scm')
        return
      }

      if (event.shiftKey && key === 'x') {
        event.preventDefault()
        workspace.setSidebarPanel('extensions')
        return
      }

      if (key === 'b') {
        event.preventDefault()
        workspace.toggleSidebar()
        return
      }

      if (key === 'j') {
        event.preventDefault()
        if (workspace.bottomOpen && workspace.bottomPanel === 'terminal') {
          workspace.toggleBottom()
        } else {
          workspace.focusTerminal()
        }
        return
      }

      if (key === 'i') {
        event.preventDefault()
        if (workspace.chatOpen) workspace.setChatOpen(false)
        else workspace.focusChat()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isAgents, workspace])

  return null
}
