'use client'

import { Button } from '@/components/ui/button'
import type { SuggestionChip } from '@/lib/agent/suggestions'

export function SuggestionChips({
  chips,
  onSelect,
}: {
  chips: SuggestionChip[]
  onSelect: (prompt: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <Button
          key={chip.label}
          type="button"
          variant="outline"
          size="xs"
          className="h-7 rounded-full px-3 text-xs"
          onClick={() => onSelect(chip.prompt)}
        >
          {chip.label}
        </Button>
      ))}
    </div>
  )
}
