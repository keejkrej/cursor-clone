const CONTEXT_LINES = 3

type DiffOp =
  | { kind: 'equal'; line: string }
  | { kind: 'remove'; line: string }
  | { kind: 'add'; line: string }

function toLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function lcsTable(a: string[], b: string[]): Int32Array[] {
  const rows = a.length + 1
  const cols = b.length + 1
  const table: Int32Array[] = Array.from({ length: rows }, () => new Int32Array(cols))
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      table[i]![j] =
        a[i - 1] === b[j - 1]
          ? (table[i - 1]![j - 1] ?? 0) + 1
          : Math.max(table[i - 1]![j] ?? 0, table[i]![j - 1] ?? 0)
    }
  }
  return table
}

function backtrack(a: string[], b: string[]): DiffOp[] {
  const table = lcsTable(a, b)
  const ops: DiffOp[] = []
  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ kind: 'equal', line: a[i - 1]! })
      i -= 1
      j -= 1
    } else if (j > 0 && (i === 0 || (table[i]![j - 1] ?? 0) >= (table[i - 1]![j] ?? 0))) {
      ops.push({ kind: 'add', line: b[j - 1]! })
      j -= 1
    } else {
      ops.push({ kind: 'remove', line: a[i - 1]! })
      i -= 1
    }
  }
  ops.reverse()
  return ops
}

function formatHunk(
  aStart: number,
  aCount: number,
  bStart: number,
  bCount: number,
  lines: string[],
): string {
  return `@@ -${aStart},${aCount} +${bStart},${bCount} @@\n${lines.join('\n')}${lines.length ? '\n' : ''}`
}

/**
 * Unified diff between two file snapshots. Line-based LCS; playground files are small.
 */
export function unifiedDiff(path: string, before: string, after: string): string {
  const a = toLines(before)
  const b = toLines(after)
  const header = `--- a/${path}\n+++ b/${path}\n`
  if (before === after) return header

  const ops = backtrack(a, b)
  const hunks: string[] = []

  let aLine = 0
  let bLine = 0
  let index = 0

  while (index < ops.length) {
    while (index < ops.length && ops[index]?.kind === 'equal') {
      aLine += 1
      bLine += 1
      index += 1
    }
    if (index >= ops.length) break

    const changeStart = index
    let changeEnd = index
    let lookahead = index
    while (lookahead < ops.length) {
      const op = ops[lookahead]!
      if (op.kind !== 'equal') {
        changeEnd = lookahead + 1
        lookahead += 1
        continue
      }
      let equalRun = 0
      let cursor = lookahead
      while (cursor < ops.length && ops[cursor]?.kind === 'equal') {
        equalRun += 1
        cursor += 1
      }
      if (equalRun > CONTEXT_LINES * 2) break
      changeEnd = cursor
      lookahead = cursor
    }

    const preContext = Math.min(CONTEXT_LINES, changeStart)
    const hunkOpsStart = changeStart - preContext
    const postEqual = (() => {
      let count = 0
      let cursor = changeEnd
      while (cursor < ops.length && ops[cursor]?.kind === 'equal' && count < CONTEXT_LINES) {
        count += 1
        cursor += 1
      }
      return count
    })()
    const hunkOpsEnd = changeEnd + postEqual

    let aStart = aLine - preContext + 1
    let bStart = bLine - preContext + 1
    let aCount = 0
    let bCount = 0
    const lines: string[] = []

    for (let i = hunkOpsStart; i < hunkOpsEnd; i++) {
      const op = ops[i]!
      if (op.kind === 'equal') {
        lines.push(` ${op.line}`)
        aCount += 1
        bCount += 1
        if (i >= changeStart) {
          aLine += 1
          bLine += 1
        }
      } else if (op.kind === 'remove') {
        lines.push(`-${op.line}`)
        aCount += 1
        aLine += 1
      } else {
        lines.push(`+${op.line}`)
        bCount += 1
        bLine += 1
      }
    }

    if (aStart < 1) aStart = a.length === 0 ? 0 : 1
    if (bStart < 1) bStart = b.length === 0 ? 0 : 1
    hunks.push(formatHunk(aStart, aCount, bStart, bCount, lines))
    index = changeEnd
  }

  return header + hunks.join('')
}

export function fileChanged(before: string | undefined, after: string | undefined): boolean {
  return (before ?? '') !== (after ?? '')
}
