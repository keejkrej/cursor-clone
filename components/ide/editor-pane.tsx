'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { XIcon } from 'lucide-react'
import type { CancellationToken, Position, editor, languages } from 'monaco-editor'
import type { Monaco, OnMount } from '@monaco-editor/react'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { fileLabel, languageForPath } from '@/lib/workspace/tree'
import { useWorkspace } from '@/lib/workspace/store'

import { InlineEditOverlay } from './inline-edit'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading editor…
    </div>
  ),
})

let ghostRegistered = false

export function EditorPane() {
  const workspace = useWorkspace()
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const active = workspace.activeFile
  const value = active ? (workspace.files[active] ?? '') : ''

  useEffect(() => {
    const instance = editorRef.current
    const target = workspace.reveal
    if (!instance || !target || !active || target.path !== active) return
    instance.revealLineInCenter(target.line)
    instance.setPosition({ lineNumber: target.line, column: target.column })
    instance.focus()
    workspaceRef.current.clearReveal()
  }, [workspace.reveal, active])

  const handleMount: OnMount = (instance, monaco) => {
    editorRef.current = instance
    registerGhostCompletion(monaco)

    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      workspaceRef.current.openCommandK()
    })
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void workspaceRef.current.saveFile()
    })

    instance.onDidChangeCursorSelection((event) => {
      const model = instance.getModel()
      const selection = event.selection
      const text = model?.getValueInRange(selection) ?? ''
      workspaceRef.current.setCursor({
        line: selection.positionLineNumber,
        column: selection.positionColumn,
      })
      workspaceRef.current.setSelection(
        selection.isEmpty()
          ? null
          : {
              startLine: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLine: selection.endLineNumber,
              endColumn: selection.endColumn,
              text,
            },
      )
    })
  }

  function acceptInline(text: string) {
    const instance = editorRef.current
    const selection = workspaceRef.current.selection
    if (!instance || !selection || !active) {
      workspaceRef.current.setFileContent(active ?? '', text)
      return
    }

    instance.executeEdits('inline-edit', [
      {
        range: {
          startLineNumber: selection.startLine,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLine,
          endColumn: selection.endColumn,
        },
        text,
      },
    ])
    instance.focus()
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="flex h-8 shrink-0 items-end gap-px overflow-x-auto border-b bg-muted/30" role="tablist" aria-label="Open editors">
        {workspace.openFiles.map((path) => {
          const selected = path === active
          const dirty = workspace.isDirty(path)
          return (
            <div
              key={path}
              className={cn(
                'group flex h-8 shrink-0 items-center gap-1 border-r px-2 text-[12px]',
                selected
                  ? 'bg-background text-foreground'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <button
                type="button"
                role="tab"
                className="max-w-[160px] truncate"
                aria-selected={selected}
                onClick={() => workspace.openFile(path)}
              >
                {fileLabel(path)}
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Close ${fileLabel(path)}`}
                className={cn(
                  'size-4 rounded-sm opacity-0 group-hover:opacity-100',
                  dirty && 'opacity-100',
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  workspace.closeFile(path)
                }}
              >
                {dirty ? (
                  <span className="size-1.5 rounded-full bg-foreground/80" />
                ) : (
                  <XIcon className="size-3" />
                )}
                <span className="sr-only">Close</span>
              </Button>
            </div>
          )
        })}
      </div>

      <div className="relative min-h-0 flex-1">
        {active ? (
          <MonacoEditor
            theme="vs-dark"
            path={active}
            language={languageForPath(active)}
            value={value}
            onChange={(next) => {
              if (active && next !== undefined) workspace.setFileContent(active, next)
            }}
            onMount={handleMount}
            options={{
              fontSize: 13,
              fontLigatures: true,
              tabSize: 2,
              insertSpaces: true,
              wordWrap: 'off',
              minimap: { enabled: true, scale: 1, renderCharacters: false },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              renderLineHighlight: 'all',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8 },
              lineNumbers: 'on',
              folding: true,
              glyphMargin: false,
              inlineSuggest: { enabled: true },
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              tabCompletion: 'on',
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
            loading={
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Loading editor…
              </div>
            }
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <p>Open a file from the explorer</p>
            <p className="inline-flex items-center gap-1 text-xs">
              or press <Kbd>⌘K</Kbd> to search
            </p>
          </div>
        )}
        <InlineEditOverlay onAccept={acceptInline} />
      </div>
    </div>
  )
}

function registerGhostCompletion(monaco: Monaco) {
  if (ghostRegistered) return
  ghostRegistered = true

  const languages = [
    'typescript',
    'javascript',
    'typescriptreact',
    'javascriptreact',
    'json',
    'markdown',
    'plaintext',
    'yaml',
  ]
  for (const language of languages) {
    monaco.languages.registerInlineCompletionsProvider(language, {
      provideInlineCompletions(
        model: editor.ITextModel,
        position: Position,
        _context: languages.InlineCompletionContext,
        token: CancellationToken,
      ) {
        return new Promise<languages.InlineCompletions>((resolve) => {
          const timer = window.setTimeout(() => {
            if (token.isCancellationRequested) {
              resolve({ items: [] })
              return
            }
            const line = model.getLineContent(position.lineNumber)
            const prefix = line.slice(0, position.column - 1)
            const suggestion = suggestGhost(prefix, model, position.lineNumber)
            if (!suggestion) {
              resolve({ items: [] })
              return
            }
            resolve({
              items: [
                {
                  insertText: suggestion,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                },
              ],
            })
          }, 420)

          token.onCancellationRequested(() => {
            window.clearTimeout(timer)
            resolve({ items: [] })
          })
        })
      },
      disposeInlineCompletions() {},
    })
  }
}

function suggestGhost(
  prefix: string,
  model: editor.ITextModel,
  lineNumber: number,
): string | null {
  if (!prefix.trim()) return null

  const lineCount = Math.min(model.getLineCount(), 400)
  for (let i = 1; i <= lineCount; i++) {
    if (i === lineNumber) continue
    const other = model.getLineContent(i)
    if (other.startsWith(prefix) && other.length > prefix.length) {
      return other.slice(prefix.length)
    }
  }

  if (/\bconsole\.l$/.test(prefix)) return 'og()'
  if (/\bconso$/.test(prefix)) return 'le.log()'
  if (/\bret$/.test(prefix)) return 'urn '
  if (/\bimp$/.test(prefix)) return "ort {  } from ''"
  if (/\bexp$/.test(prefix)) return 'ort function '
  if (/password === pass$/.test(prefix)) return 'word'
  if (/\bfunction $/.test(prefix)) return 'name() {\n  \n}'
  if (/:$/.test(prefix) && !prefix.includes(';')) return ' '
  return null
}
