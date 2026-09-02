import { cn } from '@/lib/utils'

export function UnifiedDiffView({
  unified,
  className,
}: {
  unified: string
  className?: string
}) {
  const lines = unified.split('\n')
  return (
    <pre
      className={cn(
        'overflow-auto rounded-md bg-muted/40 font-mono text-[11px] leading-[18px]',
        className,
      )}
    >
      {lines.map((line, index) => {
        const kind =
          line.startsWith('+') && !line.startsWith('+++')
            ? 'add'
            : line.startsWith('-') && !line.startsWith('---')
              ? 'del'
              : line.startsWith('@@')
                ? 'hunk'
                : 'ctx'
        return (
          <div
            key={`${index}-${line.slice(0, 24)}`}
            className={cn(
              'whitespace-pre-wrap px-2',
              kind === 'add' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
              kind === 'del' && 'bg-red-500/15 text-red-800 dark:text-red-300',
              kind === 'hunk' && 'bg-sky-500/10 text-sky-800 dark:text-sky-300',
              kind === 'ctx' && 'text-muted-foreground',
            )}
          >
            {line || ' '}
          </div>
        )
      })}
    </pre>
  )
}
