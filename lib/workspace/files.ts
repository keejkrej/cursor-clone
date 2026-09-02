import { promises as fs } from 'node:fs'
import path from 'node:path'

import { buildTree } from './tree'
import type { FileMap, FileNode } from './types'

const SKIP_DIR = new Set(['node_modules', '.git', '.next', 'dist', 'coverage'])

export function getPlaygroundRoot(): string {
  return path.join(process.cwd(), 'playground')
}

export function normalizeWorkspacePath(filePath: string): string {
  const cleaned = filePath.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+/g, '/')
  if (!cleaned || cleaned.split('/').includes('..')) {
    throw new Error('Invalid workspace path')
  }
  return cleaned
}

export async function loadWorkspace(): Promise<{
  cwd: string
  branch: string
  files: FileMap
  tree: FileNode[]
}> {
  const root = getPlaygroundRoot()
  await fs.mkdir(root, { recursive: true })
  const files: FileMap = {}
  await walk(root, root, files)

  return {
    cwd: 'playground',
    branch: 'main',
    files,
    tree: buildTree(Object.keys(files)),
  }
}

export async function readWorkspaceFile(filePath: string): Promise<string> {
  const relative = normalizeWorkspacePath(filePath)
  const root = path.resolve(getPlaygroundRoot())
  const abs = path.resolve(root, relative)
  if (!abs.startsWith(root)) {
    throw new Error('Invalid workspace path')
  }
  return fs.readFile(abs, 'utf8')
}

export async function writeWorkspaceFile(
  filePath: string,
  content: string,
): Promise<string> {
  const relative = normalizeWorkspacePath(filePath)
  const abs = path.join(getPlaygroundRoot(), relative)
  const root = getPlaygroundRoot()
  if (!abs.startsWith(root)) {
    throw new Error('Invalid workspace path')
  }

  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, 'utf8')
  return relative
}

export async function deleteWorkspaceFile(filePath: string): Promise<void> {
  const relative = normalizeWorkspacePath(filePath)
  const abs = path.join(getPlaygroundRoot(), relative)
  const root = getPlaygroundRoot()
  if (!abs.startsWith(root)) {
    throw new Error('Invalid workspace path')
  }

  await fs.rm(abs, { force: true })
}

async function walk(absDir: string, root: string, files: FileMap) {
  const entries = await fs.readdir(absDir, { withFileTypes: true })

  for (const entry of entries) {
    if (SKIP_DIR.has(entry.name)) continue
    const abs = path.join(absDir, entry.name)

    if (entry.isDirectory()) {
      await walk(abs, root, files)
      continue
    }

    if (!entry.isFile()) continue

    const relative = path.relative(root, abs).replaceAll('\\', '/')
    files[relative] = await fs.readFile(abs, 'utf8')
  }
}
