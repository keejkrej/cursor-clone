'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AGENT_MODEL_LABELS, AGENT_MODELS, type AgentModel } from '@/lib/agent/types'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/store'

export function ModelSelect({ compact = false, className }: { compact?: boolean; className?: string }) {
  const workspace = useWorkspace()
  return (
    <Select
      value={workspace.model}
      onValueChange={(value) => {
        if (value) workspace.setModel(value as AgentModel)
      }}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          'border-0 bg-transparent px-1.5 dark:bg-transparent',
          compact ? 'h-6 text-[11px]' : 'h-7 text-xs',
          className,
        )}
      >
        <SelectValue>{AGENT_MODEL_LABELS[workspace.model]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {AGENT_MODELS.map((model) => (
          <SelectItem key={model} value={model}>
            {AGENT_MODEL_LABELS[model]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
