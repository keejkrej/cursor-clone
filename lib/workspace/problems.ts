import type { FileMap, Problem } from './types'

export function scanProblems(files: FileMap): Problem[] {
  const problems: Problem[] = []

  for (const [filePath, content] of Object.entries(files)) {
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const lineNumber = i + 1

      if (line.includes('password === password')) {
        problems.push({
          path: filePath,
          line: lineNumber,
          column: Math.max(1, line.indexOf('password === password') + 1),
          message: 'Password is compared to itself; authentication always succeeds.',
          severity: 'error',
        })
      }

      const todo = line.match(/\b(TODO|FIXME)\b/)
      if (todo) {
        problems.push({
          path: filePath,
          line: lineNumber,
          column: Math.max(1, (todo.index ?? 0) + 1),
          message: `${todo[1]} comment`,
          severity: todo[1] === 'FIXME' ? 'warning' : 'info',
        })
      }
    }
  }

  return problems.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line)
}
