'use client'

import { useEffect } from 'react'
import { usePanelRef } from 'react-resizable-panels'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace/store'

import { ActivityBar } from './activity-bar'
import { BottomPanel } from './bottom-panel'
import { ChatRail } from '@/components/agent/chat-rail'
import { CommandPalette } from './command-palette'
import { EditorPane } from './editor-pane'
import { KeyboardShortcuts } from './keyboard-shortcuts'
import { Sidebar } from './sidebar'
import { StatusBar } from './status-bar'
import { TitleBar } from './title-bar'

export function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <IdeLayout />
    </WorkspaceProvider>
  )
}

function IdeLayout() {
  const workspace = useWorkspace()
  const sidebarRef = usePanelRef()
  const chatRef = usePanelRef()
  const bottomRef = usePanelRef()

  useEffect(() => {
    const panel = sidebarRef.current
    if (!panel) return
    if (workspace.sidebarOpen) panel.expand()
    else panel.collapse()
  }, [workspace.sidebarOpen, sidebarRef])

  useEffect(() => {
    const panel = chatRef.current
    if (!panel) return
    if (workspace.chatOpen) panel.expand()
    else panel.collapse()
  }, [workspace.chatOpen, chatRef])

  useEffect(() => {
    const panel = bottomRef.current
    if (!panel) return
    if (workspace.bottomOpen) panel.expand()
    else panel.collapse()
  }, [workspace.bottomOpen, bottomRef])

  useEffect(() => {
    if (!workspace.hydrated) return
    const params = new URLSearchParams(window.location.search)
    const file = params.get('file')
    if (file && workspace.files[file] !== undefined) workspace.openFile(file)
    if (window.innerWidth < 900) {
      workspace.setSidebarOpen(false)
      workspace.setChatOpen(false)
      workspace.setBottomOpen(false)
    }
    // Open deep-linked file once after hydrate; collapse chrome on narrow viewports.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.hydrated])

  return (
    <div className="flex h-dvh min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <KeyboardShortcuts />
      <CommandPalette />
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <ResizablePanelGroup id="ide-root" className="min-w-0 flex-1" orientation="horizontal">
          <ResizablePanel
            id="sidebar"
            panelRef={sidebarRef}
            defaultSize={240}
            minSize={160}
            maxSize={420}
            collapsible
            collapsedSize={0}
            groupResizeBehavior="preserve-pixel-size"
            className="h-full min-h-0 overflow-hidden"
          >
            <Sidebar />
          </ResizablePanel>
          <ResizableHandle className="bg-border" />
          <ResizablePanel id="center" minSize={280} className="h-full min-h-0 min-w-0 overflow-hidden">
            <ResizablePanelGroup id="center-group" orientation="vertical" className="h-full">
              <ResizablePanel id="editor" minSize={120} className="h-full min-h-0 overflow-hidden">
                <EditorPane />
              </ResizablePanel>
              <ResizableHandle className="bg-border" />
              <ResizablePanel
                id="bottom"
                panelRef={bottomRef}
                defaultSize={180}
                minSize={96}
                maxSize={360}
                collapsible
                collapsedSize={0}
                groupResizeBehavior="preserve-pixel-size"
                className="h-full min-h-0 overflow-hidden"
              >
                <BottomPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle className="bg-border" />
          <ResizablePanel
            id="chat"
            panelRef={chatRef}
            defaultSize={360}
            minSize={280}
            maxSize={520}
            collapsible
            collapsedSize={0}
            groupResizeBehavior="preserve-pixel-size"
            className="h-full min-h-0 overflow-hidden"
          >
            <ChatRail />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <StatusBar />
    </div>
  )
}
