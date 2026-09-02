import { cn } from '@/lib/utils'

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const blocks = splitBlocks(text)
  return (
    <div className={cn('space-y-2 text-[13px] leading-relaxed', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-md bg-muted/70 px-2.5 py-2 font-mono text-[11px] leading-4 text-foreground"
            >
              {block.text}
            </pre>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className="list-disc space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            <InlineText text={block.text} />
          </p>
        )
      })}
    </div>
  )
}

type Block =
  | { type: 'p'; text: string }
  | { type: 'code'; text: string }
  | { type: 'list'; items: string[] }

function splitBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const parts = text.split(/```[\w-]*\n?/)
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i] ?? ''
    if (i % 2 === 1) {
      blocks.push({ type: 'code', text: chunk.replace(/\n$/, '') })
      continue
    }
    const paragraphs = chunk.split(/\n{2,}/)
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim()
      if (!trimmed) continue
      const lines = trimmed.split('\n')
      const listItems = lines
        .map((line) => line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/)?.[1])
        .filter((item): item is string => Boolean(item))
      if (listItems.length === lines.length && listItems.length > 0) {
        blocks.push({ type: 'list', items: listItems })
      } else {
        blocks.push({ type: 'p', text: trimmed })
      }
    }
  }
  return blocks.length > 0 ? blocks : [{ type: 'p', text }]
}

function InlineText({ text }: { text: string }) {
  const pieces = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter((piece) => piece.length > 0)
  return (
    <>
      {pieces.map((piece, index) => {
        if (piece.startsWith('`') && piece.endsWith('`')) {
          return (
            <code
              key={index}
              className="rounded bg-muted px-1 py-px font-mono text-[0.85em]"
            >
              {piece.slice(1, -1)}
            </code>
          )
        }
        if (piece.startsWith('**') && piece.endsWith('**')) {
          return (
            <strong key={index} className="font-medium">
              {piece.slice(2, -2)}
            </strong>
          )
        }
        return <span key={index}>{piece}</span>
      })}
    </>
  )
}
