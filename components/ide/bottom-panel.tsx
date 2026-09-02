'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, TerminalIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { promptPath, runTerminalCommand } from '@/lib/workspace/terminal'
import { useWorkspace } from '@/lib/workspace/store'
import type { BottomPanel as BottomPanelId, TerminalLine } from '@/lib/workspace/types'

export function BottomPanel() {
  const workspace = useWorkspace()

  return (
    <div className="flex h-full min-h-0 flex-col border-t bg-background">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b px-2">
        <Tabs
          value={workspace.bottomPanel}
          onValueChange={(value) => workspace.setBottomPanel(value as BottomPanelId)}
          className="gap-0"
        >
          <TabsList variant="line" className="h-8 bg-transparent p-0">
            <TabsTrigger value="problems" className="px-2 text-[11px]">
              Problems
              {workspace.problems.length > 0 ? (
                <span className="ml-1 text-muted-foreground">{workspace.problems.length}</span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="output" className="px-2 text-[11px]">
              Output
            </TabsTrigger>
            <TabsTrigger value="terminal" className="px-2 text-[11px]">
              Terminal
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label="Hide panel"
            onClick={() => workspace.setBottomOpen(false)}
          >
            <ChevronDownIcon />
            <span className="sr-only">Hide panel</span>
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {workspace.bottomPanel === 'terminal' ? <TerminalView /> : null}
        {workspace.bottomPanel === 'problems' ? <ProblemsView /> : null}
        {workspace.bottomPanel === 'output' ? <OutputView /> : null}
      </div>
    </div>
  )
}

function TerminalView() {
  const workspace = useWorkspace()
  const [cwd, setCwd] = useState('')
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      kind: 'system',
      text: 'Virtual terminal for the playground. Type `help`. Host shell is not executed.',
    },
  ])
  const formRef = useRef<HTMLFormElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (workspace.terminalFocus > 0) {
      formRef.current?.querySelector('input')?.focus()
    }
  }, [workspace.terminalFocus])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lines])

  function run(command: string) {
    const result = runTerminalCommand(command, workspace.files, cwd)
    setCwd(result.cwd)
    if (result.clear) {
      setLines([])
      return
    }
    setLines((current) => [
      ...current,
      { id: `in-${Date.now()}`, kind: 'input', text: `${promptPath(cwd)} $ ${command}` },
      ...(result.output
        ? [{ id: `out-${Date.now()}`, kind: 'output' as const, text: result.output }]
        : []),
    ])
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 items-center gap-2 border-b px-2 text-[11px] text-muted-foreground">
        <TerminalIcon className="size-3" />
        playground
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          aria-label="Clear terminal"
          onClick={() => setLines([])}
        >
          <XIcon />
          <span className="sr-only">Clear</span>
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2 font-mono text-[12px] leading-5">
          {lines.map((line) => (
            <pre
              key={line.id}
              className={cn(
                'whitespace-pre-wrap',
                line.kind === 'input' && 'text-foreground',
                line.kind === 'system' && 'text-muted-foreground',
                line.kind === 'output' && 'text-foreground/90',
              )}
            >
              {line.text}
            </pre>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <form
        ref={formRef}
        className="flex items-center gap-2 border-t px-2 py-1.5"
        onSubmit={(event) => {
          event.preventDefault()
          const command = input
          if (!command.trim()) return
          setHistory((current) => [...current, command])
          setHistoryIndex(-1)
          setInput('')
          run(command)
        }}
      >
        <span className="font-mono text-[12px] text-muted-foreground">
          {promptPath(cwd)} $
        </span>
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label="Terminal command"
          className="h-7 border-0 bg-transparent px-0 font-mono text-[12px] shadow-none focus-visible:ring-0 dark:bg-transparent"
          spellCheck={false}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              if (history.length === 0) return
              const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1)
              setHistoryIndex(next)
              setInput(history[next] ?? '')
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              if (historyIndex < 0) return
              const next = historyIndex + 1
              if (next >= history.length) {
                setHistoryIndex(-1)
                setInput('')
              } else {
                setHistoryIndex(next)
                setInput(history[next] ?? '')
              }
            }
          }}
        />
      </form>
    </div>
  )
}

function ProblemsView() {
  const workspace = useWorkspace()

  if (workspace.problems.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">No problems have been detected in the playground.</p>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-1">
        {workspace.problems.map((problem, index) => (
          <button
            key={`${problem.path}:${problem.line}:${index}`}
            type="button"
            className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-[12px] hover:bg-muted"
            onClick={() =>
              workspace.revealInEditor({
                path: problem.path,
                line: problem.line,
                column: problem.column,
              })
            }
          >
            <span
              className={cn(
                'mt-0.5 size-2 shrink-0 rounded-full',
                problem.severity === 'error' && 'bg-destructive',
                problem.severity === 'warning' && 'bg-amber-500',
                problem.severity === 'info' && 'bg-sky-500',
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="text-foreground">{problem.message}</span>
              <span className="ml-2 text-muted-foreground">
                {problem.path}:{problem.line}
              </span>
            </span>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

function OutputView() {
  const workspace = useWorkspace()

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2 font-mono text-[12px]">
        {workspace.logs.length === 0 ? (
          <p className="text-muted-foreground">No output yet.</p>
        ) : (
          workspace.logs.map((log) => (
            <div key={log.id} className="flex gap-2">
              <span className="text-muted-foreground">{log.time}</span>
              <span className="w-14 shrink-0 uppercase text-muted-foreground">{log.source}</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  )
}
