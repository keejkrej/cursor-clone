'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AgentMode } from '@/lib/agent/types'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/store'

const MODES: AgentMode[] = ['agent', 'ask', 'plan']

const LABELS: Record<AgentMode, string> = {
  agent: 'Agent',
  ask: 'Ask',
  plan: 'Plan',
}

export function ModeToggle({
  className,
  itemClassName,
}: {
  className?: string
  itemClassName?: string
}) {
  const workspace = useWorkspace()

  return (
    <ToggleGroup
      size="sm"
      className={className}
      value={[workspace.agentMode]}
      onValueChange={(value) => {
        const next = value[0] as AgentMode | undefined
        if (next) workspace.setAgentMode(next)
      }}
    >
      {MODES.map((mode) => (
        <ToggleGroupItem key={mode} value={mode} className={cn('flex-1', itemClassName)}>
          {LABELS[mode]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
