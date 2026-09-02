import { joinPath, listDir, normalizeDir, pathExists } from './tree'
import type { FileMap } from './types'

export type TerminalCommandResult = {
  output: string
  cwd: string
  clear?: boolean
}

export function runTerminalCommand(
  raw: string,
  files: FileMap,
  cwd: string,
): TerminalCommandResult {
  const input = raw.trim()
  if (!input) return { output: '', cwd }

  const [command, ...rest] = tokenize(input)
  const arg = rest.join(' ')

  switch (command) {
    case 'help':
      return {
        cwd,
        output: [
          'Virtual workspace terminal. Host shell is not executed.',
          '  help              Show this message',
          '  ls [path]         List files in the playground tree',
          '  cat <file>        Print a file',
          '  cd [path]         Change directory',
          '  pwd               Print working directory',
          '  clear             Clear the buffer',
          '  echo [text]       Print text',
        ].join('\n'),
      }
    case 'clear':
      return { cwd, output: '', clear: true }
    case 'pwd':
      return { cwd, output: cwd ? `/playground/${cwd}` : '/playground' }
    case 'echo':
      return { cwd, output: arg }
    case 'ls': {
      const target = resolvePath(cwd, arg)
      if (target && files[target] !== undefined) return { cwd, output: fileName(target) }
      if (target && !pathExists(files, target) && target !== '') {
        return { cwd, output: `ls: ${arg || target}: No such file or directory` }
      }
      const names = listDir(files, target)
      if (names.length === 0) return { cwd, output: '' }
      return { cwd, output: names.join('  ') }
    }
    case 'cat': {
      if (!arg) return { cwd, output: 'cat: missing file operand' }
      const target = resolvePath(cwd, arg)
      if (files[target] === undefined) {
        return { cwd, output: `cat: ${arg}: No such file or directory` }
      }
      return { cwd, output: files[target] ?? '' }
    }
    case 'cd': {
      if (!arg || arg === '~' || arg === '/') return { cwd: '', output: '' }
      const target = resolvePath(cwd, arg)
      if (target === '') return { cwd: '', output: '' }
      if (files[target] !== undefined) {
        return { cwd, output: `cd: not a directory: ${arg}` }
      }
      if (!pathExists(files, target)) {
        return { cwd, output: `cd: no such file or directory: ${arg}` }
      }
      return { cwd: target, output: '' }
    }
    default:
      return {
        cwd,
        output: `${command}: command not found. This terminal is virtual — try \`help\`.`,
      }
  }
}

function resolvePath(cwd: string, input: string): string {
  if (!input) return cwd
  if (input === '/' || input === '~') return ''
  const trimmed = input.replace(/^\/playground\/?/, '').replace(/^\/+/, '')
  return joinPath(cwd, trimmed)
}

function fileName(filePath: string): string {
  return filePath.split('/').pop() || filePath
}

function tokenize(input: string): string[] {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g)
  if (!matches) return []
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ''))
}

export function promptPath(cwd: string): string {
  const dir = normalizeDir(cwd).replace(/\/$/, '')
  return dir ? `playground/${dir}` : 'playground'
}
