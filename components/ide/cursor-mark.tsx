import { cn } from '@/lib/utils'

export function CursorMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-4', className)}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M3.1 1.4 14.2 8 3.1 14.6 5.7 8z"
      />
    </svg>
  )
}
