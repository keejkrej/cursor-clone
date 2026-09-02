'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'

import { applyCommit, computeChanges } from './git'
import { scanProblems } from './problems'
import { buildTree, languageForPath } from './tree'
import type {
  AgentMode,
  AgentModel,
  BottomPanel,
  CursorPosition,
  EditorSelection,
  FileMap,
  FileNode,
  GitChange,
  Problem,
  RevealTarget,
  SidebarPanel,
  WorkspaceLog,
} from './types'

const DEFAULT_OPEN = 'src/index.ts'

type WorkspaceState = {
  hydrated: boolean
  files: FileMap
  saved: FileMap
  head: FileMap
  staged: string[]
  openFiles: string[]
  activeFile: string | null
  sidebarPanel: SidebarPanel
  sidebarOpen: boolean
  bottomPanel: BottomPanel
  bottomOpen: boolean
  chatOpen: boolean
  commandPaletteOpen: boolean
  inlineEditOpen: boolean
  newFileOpen: boolean
  searchQuery: string
  commitMessage: string
  selection: EditorSelection | null
  cursor: CursorPosition
  notice: string | null
  logs: WorkspaceLog[]
  reveal: RevealTarget | null
  terminalFocus: number
  chatNonce: number
  chatFocus: number
  agentSessionId: string | null
  agentMode: AgentMode
  model: AgentModel
}

type WorkspaceAction =
  | { type: 'hydrate'; files: FileMap }
  | { type: 'setFileContent'; path: string; content: string }
  | { type: 'markSaved'; path: string }
  | { type: 'openFile'; path: string }
  | { type: 'closeFile'; path: string }
  | { type: 'setActiveFile'; path: string | null }
  | { type: 'createFile'; path: string }
  | { type: 'setSidebarPanel'; panel: SidebarPanel }
  | { type: 'setSidebarOpen'; open: boolean }
  | { type: 'toggleSidebar' }
  | { type: 'setBottomPanel'; panel: BottomPanel }
  | { type: 'setBottomOpen'; open: boolean }
  | { type: 'toggleBottom' }
  | { type: 'setChatOpen'; open: boolean }
  | { type: 'toggleChat' }
  | { type: 'setCommandPaletteOpen'; open: boolean }
  | { type: 'setInlineEditOpen'; open: boolean }
  | { type: 'setNewFileOpen'; open: boolean }
  | { type: 'setSearchQuery'; query: string }
  | { type: 'setCommitMessage'; message: string }
  | { type: 'setSelection'; selection: EditorSelection | null }
  | { type: 'setCursor'; cursor: CursorPosition }
  | { type: 'setNotice'; notice: string | null }
  | { type: 'pushLog'; source: WorkspaceLog['source']; message: string }
  | { type: 'setReveal'; reveal: RevealTarget | null }
  | { type: 'focusTerminal' }
  | { type: 'newChat' }
  | { type: 'focusChat' }
  | { type: 'openAgentSession'; id: string | null }
  | { type: 'setAgentMode'; mode: AgentMode }
  | { type: 'setModel'; model: AgentModel }
  | { type: 'refreshFiles'; files: FileMap }
  | { type: 'toggleStaged'; path: string }
  | { type: 'stageAll'; paths: string[] }
  | { type: 'unstageAll' }
  | { type: 'commit'; paths: string[] }
  | { type: 'applyFile'; path: string; content: string }
  | { type: 'restoreFiles'; files: FileMap }

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function reducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'hydrate': {
      const files = action.files
      const openFiles = files[DEFAULT_OPEN] !== undefined ? [DEFAULT_OPEN] : Object.keys(files).slice(0, 1)
      return {
        ...state,
        hydrated: true,
        files,
        saved: { ...files },
        head: { ...files },
        openFiles,
        activeFile: openFiles[0] ?? null,
      }
    }
    case 'setFileContent':
      return {
        ...state,
        files: { ...state.files, [action.path]: action.content },
      }
    case 'markSaved':
      return {
        ...state,
        saved: { ...state.saved, [action.path]: state.files[action.path] ?? '' },
      }
    case 'openFile': {
      const openFiles = state.openFiles.includes(action.path)
        ? state.openFiles
        : [...state.openFiles, action.path]
      return { ...state, openFiles, activeFile: action.path }
    }
    case 'closeFile': {
      const openFiles = state.openFiles.filter((path) => path !== action.path)
      const activeFile =
        state.activeFile === action.path
          ? (openFiles.at(-1) ?? null)
          : state.activeFile
      return { ...state, openFiles, activeFile }
    }
    case 'setActiveFile':
      return { ...state, activeFile: action.path }
    case 'createFile': {
      if (state.files[action.path] !== undefined) return state
      const files = { ...state.files, [action.path]: '' }
      const openFiles = state.openFiles.includes(action.path)
        ? state.openFiles
        : [...state.openFiles, action.path]
      return {
        ...state,
        files,
        openFiles,
        activeFile: action.path,
        newFileOpen: false,
      }
    }
    case 'setSidebarPanel':
      return { ...state, sidebarPanel: action.panel, sidebarOpen: true }
    case 'setSidebarOpen':
      return { ...state, sidebarOpen: action.open }
    case 'toggleSidebar':
      return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'setBottomPanel':
      return { ...state, bottomPanel: action.panel, bottomOpen: true }
    case 'setBottomOpen':
      return { ...state, bottomOpen: action.open }
    case 'toggleBottom':
      return { ...state, bottomOpen: !state.bottomOpen }
    case 'setChatOpen':
      return { ...state, chatOpen: action.open }
    case 'toggleChat':
      return { ...state, chatOpen: !state.chatOpen }
    case 'setCommandPaletteOpen':
      return { ...state, commandPaletteOpen: action.open }
    case 'setInlineEditOpen':
      return { ...state, inlineEditOpen: action.open }
    case 'setNewFileOpen':
      return { ...state, newFileOpen: action.open }
    case 'setSearchQuery':
      return { ...state, searchQuery: action.query, sidebarPanel: 'search', sidebarOpen: true }
    case 'setCommitMessage':
      return { ...state, commitMessage: action.message }
    case 'setSelection':
      return { ...state, selection: action.selection }
    case 'setCursor':
      return { ...state, cursor: action.cursor }
    case 'setNotice':
      return { ...state, notice: action.notice }
    case 'pushLog':
      return {
        ...state,
        logs: [
          ...state.logs.slice(-199),
          { id: uid(), time: nowTime(), source: action.source, message: action.message },
        ],
      }
    case 'setReveal':
      return { ...state, reveal: action.reveal }
    case 'focusTerminal':
      return {
        ...state,
        bottomOpen: true,
        bottomPanel: 'terminal',
        terminalFocus: state.terminalFocus + 1,
      }
    case 'newChat':
      return {
        ...state,
        chatOpen: true,
        chatNonce: state.chatNonce + 1,
        chatFocus: state.chatFocus + 1,
        agentSessionId: null,
      }
    case 'focusChat':
      return { ...state, chatOpen: true, chatFocus: state.chatFocus + 1 }
    case 'openAgentSession':
      return {
        ...state,
        chatOpen: true,
        chatFocus: state.chatFocus + 1,
        agentSessionId: action.id,
      }
    case 'refreshFiles': {
      const files = action.files
      const openFiles = state.openFiles.filter((path) => files[path] !== undefined)
      const activeFile =
        state.activeFile && files[state.activeFile] !== undefined
          ? state.activeFile
          : (openFiles[0] ?? Object.keys(files)[0] ?? null)
      return {
        ...state,
        files,
        saved: { ...files },
        openFiles,
        activeFile,
      }
    }
    case 'setAgentMode':
      return { ...state, agentMode: action.mode }
    case 'setModel':
      return { ...state, model: action.model }
    case 'toggleStaged': {
      const staged = state.staged.includes(action.path)
        ? state.staged.filter((path) => path !== action.path)
        : [...state.staged, action.path]
      return { ...state, staged }
    }
    case 'stageAll':
      return { ...state, staged: [...new Set(action.paths)] }
    case 'unstageAll':
      return { ...state, staged: [] }
    case 'commit': {
      const head = applyCommit(state.head, state.files, action.paths)
      const saved = { ...state.saved }
      for (const filePath of action.paths) {
        if (state.files[filePath] !== undefined) saved[filePath] = state.files[filePath]!
        else delete saved[filePath]
      }
      return {
        ...state,
        head,
        saved,
        staged: [],
        commitMessage: '',
      }
    }
    case 'applyFile': {
      const openFiles = state.openFiles.includes(action.path)
        ? state.openFiles
        : [...state.openFiles, action.path]
      return {
        ...state,
        files: { ...state.files, [action.path]: action.content },
        saved: { ...state.saved, [action.path]: action.content },
        openFiles,
        activeFile: action.path,
      }
    }
    case 'restoreFiles':
      return {
        ...state,
        files: { ...action.files },
        saved: { ...action.files },
      }
    default:
      return state
  }
}

const initialState: WorkspaceState = {
  hydrated: false,
  files: {},
  saved: {},
  head: {},
  staged: [],
  openFiles: [],
  activeFile: null,
  sidebarPanel: 'explorer',
  sidebarOpen: true,
  bottomPanel: 'terminal',
  bottomOpen: true,
  chatOpen: true,
  commandPaletteOpen: false,
  inlineEditOpen: false,
  newFileOpen: false,
  searchQuery: '',
  commitMessage: '',
  selection: null,
  cursor: { line: 1, column: 1 },
  notice: null,
  logs: [],
  reveal: null,
  terminalFocus: 0,
  chatNonce: 0,
  chatFocus: 0,
  agentSessionId: null,
  agentMode: 'agent',
  model: 'composer-2.5',
}

type WorkspaceContextValue = WorkspaceState & {
  tree: FileNode[]
  changes: GitChange[]
  problems: Problem[]
  language: string
  isDirty: (path: string) => boolean
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void
  setFileContent: (path: string, content: string) => void
  saveFile: (path?: string) => Promise<void>
  createFile: (path: string) => Promise<void>
  setSidebarPanel: (panel: SidebarPanel) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setBottomPanel: (panel: BottomPanel) => void
  setBottomOpen: (open: boolean) => void
  toggleBottom: () => void
  setChatOpen: (open: boolean) => void
  toggleChat: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setInlineEditOpen: (open: boolean) => void
  setNewFileOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  setCommitMessage: (message: string) => void
  setSelection: (selection: EditorSelection | null) => void
  setCursor: (cursor: CursorPosition) => void
  setNotice: (notice: string | null) => void
  pushLog: (source: WorkspaceLog['source'], message: string) => void
  revealInEditor: (target: RevealTarget) => void
  clearReveal: () => void
  focusTerminal: () => void
  newChat: () => void
  focusChat: () => void
  openAgentSession: (id: string) => void
  refreshWorkspace: () => Promise<void>
  setAgentMode: (mode: AgentMode) => void
  setModel: (model: AgentModel) => void
  toggleStaged: (path: string) => void
  stageAll: () => void
  unstageAll: () => void
  commit: () => Promise<void>
  openCommandK: () => void
  applyFile: (path: string, content: string) => void
  restoreFiles: (files: FileMap) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

async function putFile(path: string, content: string) {
  const response = await fetch('/api/workspace/file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Failed to save file')
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/workspace')
        if (!response.ok) throw new Error('Failed to load workspace')
        const data = (await response.json()) as { files: FileMap }
        if (!cancelled) {
          dispatch({ type: 'hydrate', files: data.files ?? {} })
          dispatch({ type: 'pushLog', source: 'system', message: 'Loaded playground workspace' })
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: 'hydrate', files: {} })
          dispatch({
            type: 'setNotice',
            notice: error instanceof Error ? error.message : 'Failed to load workspace',
          })
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const tree = useMemo(() => buildTree(Object.keys(state.files)), [state.files])
  const changes = useMemo(
    () => computeChanges(state.head, state.files),
    [state.head, state.files],
  )
  const problems = useMemo(() => scanProblems(state.files), [state.files])
  const language = state.activeFile ? languageForPath(state.activeFile) : 'plaintext'

  const isDirty = useCallback(
    (path: string) => (state.files[path] ?? '') !== (state.saved[path] ?? ''),
    [state.files, state.saved],
  )

  const saveFile = useCallback(
    async (path?: string) => {
      const target = path ?? state.activeFile
      if (!target) return
      const content = state.files[target] ?? ''
      try {
        await putFile(target, content)
        dispatch({ type: 'markSaved', path: target })
        dispatch({ type: 'pushLog', source: 'editor', message: `Saved ${target}` })
        dispatch({ type: 'setNotice', notice: `Saved ${target}` })
      } catch (error) {
        dispatch({
          type: 'setNotice',
          notice: error instanceof Error ? error.message : 'Save failed',
        })
      }
    },
    [state.activeFile, state.files],
  )

  const createFile = useCallback(async (filePath: string) => {
    const path = filePath.replace(/^\/+/, '').replace(/\\/g, '/')
    if (!path || path.split('/').includes('..')) {
      dispatch({ type: 'setNotice', notice: 'Invalid path' })
      return
    }
    try {
      dispatch({ type: 'createFile', path })
      await putFile(path, '')
      dispatch({ type: 'markSaved', path })
      dispatch({ type: 'pushLog', source: 'editor', message: `Created ${path}` })
      dispatch({ type: 'setNotice', notice: `Created ${path}` })
    } catch (error) {
      dispatch({
        type: 'setNotice',
        notice: error instanceof Error ? error.message : 'Create failed',
      })
    }
  }, [])

  const commit = useCallback(async () => {
    if (state.staged.length === 0) {
      dispatch({ type: 'setNotice', notice: 'Stage files before committing' })
      return
    }

    try {
      for (const filePath of state.staged) {
        const content = state.files[filePath]
        if (content !== undefined) await putFile(filePath, content)
      }

      const message = state.commitMessage.trim() || 'Update playground'
      const count = state.staged.length
      dispatch({ type: 'commit', paths: state.staged })
      dispatch({
        type: 'pushLog',
        source: 'git',
        message: `Committed ${count} file(s): ${message}`,
      })
      dispatch({ type: 'setNotice', notice: 'Committed to main' })
    } catch (error) {
      dispatch({
        type: 'setNotice',
        notice: error instanceof Error ? error.message : 'Commit failed',
      })
    }
  }, [state.commitMessage, state.files, state.staged])

  const openCommandK = useCallback(() => {
    const hasSelection = Boolean(state.selection?.text)
    if (hasSelection) {
      dispatch({ type: 'setInlineEditOpen', open: true })
      dispatch({ type: 'setCommandPaletteOpen', open: false })
      return
    }
    dispatch({ type: 'setCommandPaletteOpen', open: true })
  }, [state.selection])

  const refreshWorkspace = useCallback(async () => {
    try {
      const response = await fetch('/api/workspace')
      if (!response.ok) throw new Error('Failed to refresh workspace')
      const data = (await response.json()) as { files?: FileMap }
      dispatch({ type: 'refreshFiles', files: data.files ?? {} })
    } catch (error) {
      dispatch({
        type: 'setNotice',
        notice: error instanceof Error ? error.message : 'Failed to refresh workspace',
      })
    }
  }, [])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...state,
      tree,
      changes,
      problems,
      language,
      isDirty,
      openFile: (path) => dispatch({ type: 'openFile', path }),
      closeFile: (path) => dispatch({ type: 'closeFile', path }),
      setActiveFile: (path) => dispatch({ type: 'setActiveFile', path }),
      setFileContent: (path, content) => dispatch({ type: 'setFileContent', path, content }),
      saveFile,
      createFile,
      setSidebarPanel: (panel) => dispatch({ type: 'setSidebarPanel', panel }),
      setSidebarOpen: (open) => dispatch({ type: 'setSidebarOpen', open }),
      toggleSidebar: () => dispatch({ type: 'toggleSidebar' }),
      setBottomPanel: (panel) => dispatch({ type: 'setBottomPanel', panel }),
      setBottomOpen: (open) => dispatch({ type: 'setBottomOpen', open }),
      toggleBottom: () => dispatch({ type: 'toggleBottom' }),
      setChatOpen: (open) => dispatch({ type: 'setChatOpen', open }),
      toggleChat: () => dispatch({ type: 'toggleChat' }),
      setCommandPaletteOpen: (open) => dispatch({ type: 'setCommandPaletteOpen', open }),
      setInlineEditOpen: (open) => dispatch({ type: 'setInlineEditOpen', open }),
      setNewFileOpen: (open) => dispatch({ type: 'setNewFileOpen', open }),
      setSearchQuery: (query) => dispatch({ type: 'setSearchQuery', query }),
      setCommitMessage: (message) => dispatch({ type: 'setCommitMessage', message }),
      setSelection: (selection) => dispatch({ type: 'setSelection', selection }),
      setCursor: (cursor) => dispatch({ type: 'setCursor', cursor }),
      setNotice: (notice) => dispatch({ type: 'setNotice', notice }),
      pushLog: (source, message) => dispatch({ type: 'pushLog', source, message }),
      revealInEditor: (target) => {
        dispatch({ type: 'openFile', path: target.path })
        dispatch({ type: 'setReveal', reveal: target })
      },
      clearReveal: () => dispatch({ type: 'setReveal', reveal: null }),
      focusTerminal: () => dispatch({ type: 'focusTerminal' }),
      newChat: () => dispatch({ type: 'newChat' }),
      focusChat: () => dispatch({ type: 'focusChat' }),
      openAgentSession: (id) => dispatch({ type: 'openAgentSession', id }),
      refreshWorkspace,
      setAgentMode: (mode) => dispatch({ type: 'setAgentMode', mode }),
      setModel: (model) => dispatch({ type: 'setModel', model }),
      toggleStaged: (path) => dispatch({ type: 'toggleStaged', path }),
      stageAll: () => dispatch({ type: 'stageAll', paths: changes.map((change) => change.path) }),
      unstageAll: () => dispatch({ type: 'unstageAll' }),
      applyFile: (path, content) => dispatch({ type: 'applyFile', path, content }),
      restoreFiles: (files) => dispatch({ type: 'restoreFiles', files }),
      commit,
      openCommandK,
    }),
    [
      state,
      tree,
      changes,
      problems,
      language,
      isDirty,
      saveFile,
      createFile,
      commit,
      openCommandK,
      refreshWorkspace,
    ],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider')
  }
  return context
}
