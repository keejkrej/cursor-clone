import type { FileMap, FileNode } from './types'

export function buildTree(paths: string[]): FileNode[] {
  const root: FileNode[] = []
  const map = new Map<string, FileNode>()

  for (const filePath of [...paths].sort()) {
    const parts = filePath.split('/').filter(Boolean)
    let parentPath = ''
    let siblings = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!
      const currentPath = parentPath ? `${parentPath}/${name}` : name
      const isFile = i === parts.length - 1
      let node = map.get(currentPath)

      if (!node) {
        node = {
          name,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
        }
        map.set(currentPath, node)
        siblings.push(node)
      }

      parentPath = currentPath
      siblings = node.children ?? []
    }
  }

  sortNodes(root)
  return root
}

function sortNodes(nodes: FileNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  for (const node of nodes) {
    if (node.children) sortNodes(node.children)
  }
}

export function listDir(files: FileMap, cwd: string): string[] {
  const prefix = normalizeDir(cwd)
  const names = new Set<string>()

  for (const filePath of Object.keys(files)) {
    if (prefix && !filePath.startsWith(prefix)) continue
    const rest = prefix ? filePath.slice(prefix.length) : filePath
    if (!rest) continue
    names.add(rest.split('/')[0]!)
  }

  return [...names].sort((a, b) => a.localeCompare(b))
}

export function pathExists(files: FileMap, target: string): boolean {
  if (files[target] !== undefined) return true
  const prefix = `${target}/`
  return Object.keys(files).some((filePath) => filePath.startsWith(prefix))
}

export function normalizeDir(cwd: string): string {
  if (!cwd || cwd === '.' || cwd === '/') return ''
  return cwd.replace(/^\/+|\/+$/g, '') + '/'
}

export function joinPath(cwd: string, segment: string): string {
  if (!segment || segment === '.') return cwd === '/' ? '' : cwd
  if (segment.startsWith('/')) return segment.replace(/^\/+/, '')
  if (segment === '..') {
    if (!cwd) return ''
    const parts = cwd.split('/')
    parts.pop()
    return parts.join('/')
  }

  return cwd ? `${cwd}/${segment}` : segment
}

export function languageForPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'json':
      return 'json'
    case 'md':
    case 'mdc':
      return 'markdown'
    case 'css':
      return 'css'
    case 'html':
      return 'html'
    case 'yml':
    case 'yaml':
      return 'yaml'
    default:
      return 'plaintext'
  }
}

export function fileLabel(filePath: string): string {
  return filePath.split('/').pop() || filePath
}
