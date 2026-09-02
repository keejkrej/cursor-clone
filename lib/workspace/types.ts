export type FileType = 'file' | 'folder'

export type FileNode = {
  name: string
  path: string
  type: FileType
  children?: FileNode[]
}

export type FileMap = Record<string, string>

export type GitStatus = 'M' | 'A' | 'D'

export type GitChange = {
  path: string
  status: GitStatus
}

export type SidebarPanel =
  | 'explorer'
  | 'search'
  | 'scm'
  | 'agent'
  | 'extensions'

export type BottomPanel = 'terminal' | 'problems' | 'output'

export type AgentMode = 'agent' | 'ask' | 'plan'

export type AgentModel = 'composer-2.5' | 'grok-4.5' | 'auto-smart'

export type EditorSelection = {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  text: string
}

export type CursorPosition = {
  line: number
  column: number
}

export type ProblemSeverity = 'error' | 'warning' | 'info'

export type Problem = {
  path: string
  line: number
  column: number
  message: string
  severity: ProblemSeverity
}

export type WorkspaceLog = {
  id: string
  time: string
  source: 'terminal' | 'git' | 'editor' | 'system'
  message: string
}

export type TerminalLine = {
  id: string
  kind: 'input' | 'output' | 'system'
  text: string
}

export type RevealTarget = {
  path: string
  line: number
  column: number
}
