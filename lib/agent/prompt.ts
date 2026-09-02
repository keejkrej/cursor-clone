import { readWorkspaceFile } from '@/lib/workspace/files'

import type { AgentMode, ContextChip, FileMap } from './types'

export async function loadProjectRules(): Promise<string | null> {
  try {
    return await readWorkspaceFile('.cursor/rules/project.mdc')
  } catch {
    return null
  }
}

export function listCodebase(files: FileMap): string {
  const paths = Object.keys(files).sort()
  if (paths.length === 0) return '(empty playground)'
  return paths.map((path) => `- ${path}`).join('\n')
}

function folderListing(files: FileMap, folder: string): string {
  const prefix = folder.replace(/\/+$/, '')
  const hits = Object.keys(files)
    .filter((path) => path === prefix || path.startsWith(`${prefix}/`))
    .sort()
  return hits.length > 0 ? hits.join('\n') : `(no files under ${prefix})`
}

function resolveChipContent(chip: ContextChip, files: FileMap): string {
  if (chip.content && chip.content.trim()) return chip.content
  if (chip.kind === 'file' && chip.path && files[chip.path] !== undefined) {
    return files[chip.path] ?? ''
  }
  if (chip.kind === 'folder' && chip.path) {
    return folderListing(files, chip.path)
  }
  if (chip.kind === 'codebase') {
    return listCodebase(files)
  }
  return ''
}

export function composeUserPrompt(input: {
  prompt: string
  mode: AgentMode
  context: ContextChip[]
  files: FileMap
  rules: string | null
  inline?: boolean
}): string {
  const sections: string[] = []

  if (input.inline) {
    sections.push(
      input.mode === 'ask'
        ? 'Inline edit in Ask mode. Rewrite ONLY the provided @selection. Do not write, create, or delete files.'
        : 'Inline edit in Agent mode. Rewrite ONLY the provided @selection. Do not edit other files or ranges.',
    )
    sections.push(
      'Return the complete replacement text for the selection. Do not wrap it in markdown fences. Do not include commentary, explanations, or the rest of the file.',
    )
  } else if (input.mode === 'ask') {
    sections.push(
      'You are in Ask mode. Answer questions about this playground. Do not edit, write, create, or delete files. Do not run mutating shell commands.',
    )
  } else if (input.mode === 'plan') {
    sections.push(
      'You are in Plan mode. Explore the playground and produce a markdown implementation plan. Wait for the user to approve before making edits.',
    )
  } else {
    sections.push(
      'You are in Agent mode. You may read the playground and apply focused edits. Show your work via tools.',
    )
  }

  if (input.mode !== 'ask' && input.rules?.trim()) {
    sections.push(`Project rules:\n${input.rules.trim()}`)
  }

  const wantsCodebase =
    input.mode !== 'ask' || input.context.some((chip) => chip.kind === 'codebase')
  if (wantsCodebase) {
    sections.push(`Playground codebase files:\n${listCodebase(input.files)}`)
  }

  for (const chip of input.context) {
    const body = resolveChipContent(chip, input.files)
    const label = chip.label || chip.path || chip.kind
    if (chip.kind === 'file') {
      sections.push(`@file ${label}\n\`\`\`\n${body}\n\`\`\``)
    } else if (chip.kind === 'selection') {
      const loc =
        chip.path && chip.startLine
          ? `${chip.path}:${chip.startLine}${chip.endLine ? `-${chip.endLine}` : ''}`
          : label
      sections.push(`@selection ${loc}\n\`\`\`\n${body}\n\`\`\``)
    } else if (chip.kind === 'folder') {
      sections.push(`@folder ${label}\n${body}`)
    } else {
      sections.push(`@codebase\n${body}`)
    }
  }

  sections.push(`User request:\n${input.prompt}`)
  return sections.join('\n\n')
}
