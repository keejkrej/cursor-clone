import { Suspense } from 'react'

import { AgentsWindow } from '@/components/agent/agents-window'
import { HtmlTheme } from '@/components/html-theme'
import { WorkspaceProvider } from '@/lib/workspace/store'

export default function AgentsPage() {
  return (
    <>
      <HtmlTheme dark={false} />
      <WorkspaceProvider>
        <Suspense fallback={<AgentsFallback />}>
          <AgentsWindow />
        </Suspense>
      </WorkspaceProvider>
    </>
  )
}

function AgentsFallback() {
  return <div className="h-svh bg-background" />
}
