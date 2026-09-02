import type { FileMap, GitChange, GitStatus } from './types'

export function computeChanges(head: FileMap, current: FileMap): GitChange[] {
  const paths = new Set([...Object.keys(head), ...Object.keys(current)])
  const changes: GitChange[] = []

  for (const filePath of paths) {
    const previous = head[filePath]
    const next = current[filePath]
    let status: GitStatus | null = null

    if (previous === undefined && next !== undefined) status = 'A'
    else if (previous !== undefined && next === undefined) status = 'D'
    else if (previous !== next) status = 'M'

    if (status) changes.push({ path: filePath, status })
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path))
}

export function applyCommit(
  head: FileMap,
  current: FileMap,
  staged: string[],
): FileMap {
  const next: FileMap = { ...head }

  for (const filePath of staged) {
    if (current[filePath] === undefined) delete next[filePath]
    else next[filePath] = current[filePath]
  }

  return next
}

export function statusLabel(status: GitStatus): string {
  switch (status) {
    case 'M':
      return 'Modified'
    case 'A':
      return 'Added'
    case 'D':
      return 'Deleted'
  }
}
