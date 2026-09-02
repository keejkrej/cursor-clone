export function unwrapFences(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/)
  if (match?.[1] !== undefined) return match[1]
  return text
}

export function rewriteSelection(selection: string, prompt: string): string {
  const lower = prompt.toLowerCase()
  const source = selection || ''

  if (lower.includes('uncomment')) {
    return source.replace(/^(\s*)\/\/\s?/gm, '$1')
  }

  if (/\bcomment\b/.test(lower) && source.trim()) {
    return source
      .split('\n')
      .map((line) => (line.trim() ? `// ${line}` : line))
      .join('\n')
  }

  if (
    (/\b(fix|bug|password|auth|login)\b/.test(lower) || lower.includes('always true')) &&
    source.includes('password === password')
  ) {
    let next = source
    if (!next.includes('ADMIN_PASSWORD') && /const ADMIN = 'admin'/.test(next)) {
      next = next.replace(
        /const ADMIN = 'admin'/,
        "const ADMIN = 'admin'\nconst ADMIN_PASSWORD = 'secret'",
      )
    }
    return next.replace('password === password', 'password === ADMIN_PASSWORD')
  }

  if (/\basync\b/.test(lower) && /\bfunction\b/.test(source) && !/\basync\s+function\b/.test(source)) {
    if (/\bexport function\b/.test(source)) {
      return source.replace(/\bexport function\b/g, 'export async function')
    }
    return source.replace(/\bfunction\b/g, 'async function')
  }

  if (/\b(extract)\b/.test(lower) && source.trim()) {
    const body = source
      .split('\n')
      .map((line) => (line.length ? `  ${line}` : line))
      .join('\n')
    return `function extracted() {\n${body}\n}\n`
  }

  if (/\b(log|debug)\b/.test(lower) && source.trim()) {
    const ident = source.match(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)?.at(-1) ?? 'value'
    return `${source.trimEnd()}\nconsole.log(${ident})`
  }

  if (!source.trim()) return `// ${prompt.trim()}`
  return `// ${prompt.trim()}\n${source}`
}
