'use client'

import { useState } from 'react'
import {
  Bell,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Cloud,
  Code2,
  Command,
  FileCode2,
  FileJson,
  Files,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Hash,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  TerminalSquare,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const files = [
  { name: 'page.tsx', icon: FileCode2, active: true },
  { name: 'layout.tsx', icon: FileCode2 },
  { name: 'globals.css', icon: Hash },
  { name: 'package.json', icon: FileJson },
]

const codeLines = [
  ['keyword', 'import'], ['plain', " { useState } from 'react'"],
  ['plain', ''],
  ['keyword', 'export default function'], ['plain', ' Home() {'],
  ['plain', '  '], ['keyword', 'const'], ['plain', ' [count, setCount] = '], ['keyword', 'useState'], ['plain', '(0)'],
  ['plain', ''],
  ['keyword', 'return'], ['plain', ' ('],
  ['plain', '    <'], ['tag', 'main'], ['plain', ' className='], ['string', '"min-h-screen p-8"'], ['plain', '>'],
  ['plain', '      <'], ['tag', 'h1'], ['plain', '>'], ['plain', 'Welcome back'], ['plain', '</'], ['tag', 'h1'], ['plain', '>'],
  ['plain', '      <'], ['tag', 'button'], ['plain', ' onClick={() => setCount(count + 1)}'],
  ['plain', '>'],
  ['plain', '        Clicked '], ['expression', '{count}'], ['plain', ' times'],
  ['plain', '      </'], ['tag', 'button'], ['plain', '>'],
  ['plain', '    </'], ['tag', 'main'], ['plain', '>'],
  ['plain', '  )'],
  ['plain', '}'],
]

export default function Page() {
  const [activeFile, setActiveFile] = useState('page.tsx')
  const [chatOpen, setChatOpen] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [activeTab, setActiveTab] = useState<'explorer' | 'search'>('explorer')

  return (
    <main className="flex h-screen min-h-[620px] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-3 text-xs">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8"><Menu data-icon="inline-start" /></Button>
          <div className="flex items-center gap-2 font-semibold"><span className="flex size-5 items-center justify-center rounded bg-primary text-[10px] text-primary-foreground">⌁</span> Cursor</div>
          <div className="hidden items-center gap-1 text-muted-foreground sm:flex"><ChevronRight className="size-3" /> playground</div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Button variant="ghost" size="sm" className="hidden gap-2 sm:flex"><GitBranch data-icon="inline-start" /> main <ChevronDown /></Button>
          <Button variant="ghost" size="icon" className="size-8"><Cloud /></Button>
          <Button variant="ghost" size="icon" className="size-8"><Settings /></Button>
          <div className="ml-2 size-5 rounded-full bg-accent ring-2 ring-background" aria-label="User avatar" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-12 shrink-0 flex-col items-center border-r bg-card py-3 md:flex">
          <Button variant="ghost" size="icon" className="size-9 text-foreground"><Files /></Button>
          <Button variant="ghost" size="icon" className="size-9 text-muted-foreground"><Search /></Button>
          <Button variant="ghost" size="icon" className="size-9 text-muted-foreground"><GitPullRequest /></Button>
          <Button variant="ghost" size="icon" className="size-9 text-muted-foreground"><Bot /></Button>
          <div className="mt-auto flex flex-col gap-1"><Button variant="ghost" size="icon" className="size-9 text-muted-foreground"><Bell /></Button><Button variant="ghost" size="icon" className="size-9 text-muted-foreground"><PanelLeft /></Button></div>
        </aside>

        <section className="flex w-60 shrink-0 flex-col border-r bg-card max-md:hidden">
          <div className="flex h-11 items-center justify-between border-b px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="flex gap-1"><button onClick={() => setActiveTab('explorer')} className={activeTab === 'explorer' ? 'text-foreground' : ''}>Explorer</button><button onClick={() => setActiveTab('search')} className={activeTab === 'search' ? 'ml-3 text-foreground' : 'ml-3'}>Search</button></div>
            <MoreHorizontal className="size-4" />
          </div>
          {activeTab === 'explorer' ? <div className="flex flex-col gap-1 p-2 text-sm"><div className="flex items-center gap-1 px-1 py-2 text-xs font-semibold"><ChevronDown className="size-3" /> PLAYGROUND</div><div className="flex items-center gap-2 px-2 py-1 text-muted-foreground"><Folder className="size-4" /> app</div>{files.map((file) => <button key={file.name} onClick={() => setActiveFile(file.name)} className={`flex items-center gap-2 rounded px-7 py-1.5 text-left text-xs ${activeFile === file.name ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60'}`}><file.icon className="size-3.5" />{file.name}</button>)}</div> : <div className="p-3 text-xs text-muted-foreground">Search across your project</div>}
          <div className="mt-auto border-t p-3 text-xs text-muted-foreground"><div className="flex items-center gap-2"><GitCommitHorizontal className="size-3.5" /> 3 changes</div><div className="mt-3 flex items-center gap-2"><CircleDot className="size-3.5" /> No problems</div></div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex h-11 shrink-0 items-center border-b bg-card px-3"><div className="flex h-full items-center gap-2 border-b-2 border-primary px-3 text-xs"><FileCode2 className="size-3.5" />{activeFile}<X className="ml-4 size-3 text-muted-foreground" /></div><Button variant="ghost" size="icon" className="ml-auto size-8"><Plus /></Button></div>
          <div className="flex min-h-0 flex-1 overflow-auto"><div className="w-12 shrink-0 select-none border-r py-4 text-right font-mono text-xs leading-6 text-muted-foreground/60">{codeLines.map((_, i) => <div key={i} className="px-3">{i + 1}</div>)}</div><pre className="min-w-[520px] flex-1 p-4 font-mono text-[13px] leading-6"><code>{codeLines.map(([kind, text], i) => <span key={i} className={`token-${kind}`}>{text}{i < codeLines.length - 1 && '\n'}</span>)}</code></pre></div>
          <div className="flex h-10 shrink-0 items-center justify-between border-t bg-card px-3 text-xs text-muted-foreground"><div className="flex items-center gap-3"><span className="flex items-center gap-1"><GitBranch className="size-3.5" /> main</span><span>Ln 4, Col 28</span><span className="hidden sm:inline">Spaces: 2</span></div><div className="flex items-center gap-3"><span>TypeScript JSX</span><span>UTF-8</span></div></div>
        </section>

        {chatOpen && <aside className="flex w-80 shrink-0 flex-col border-l bg-card max-lg:hidden"><div className="flex h-11 items-center justify-between border-b px-4"><div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4" /> Ask Cursor</div><Button variant="ghost" size="icon" className="size-8" onClick={() => setChatOpen(false)}><X /></Button></div><div className="flex flex-1 flex-col justify-end gap-4 overflow-auto p-4"><div className="rounded-lg border bg-background p-3 text-sm leading-6">How can I help with your code today?</div><div className="flex flex-wrap gap-2"><button className="rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent">Explain this file</button><button className="rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent">Find bugs</button></div></div><div className="border-t p-3"><div className="rounded-lg border bg-background p-2 shadow-sm"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask anything..." className="min-h-16 w-full resize-none bg-transparent p-1 text-sm outline-none placeholder:text-muted-foreground" /><div className="flex items-center justify-between"><div className="flex gap-1"><Button variant="ghost" size="icon" className="size-7"><Plus /></Button><Button variant="ghost" size="icon" className="size-7"><TerminalSquare /></Button></div><Button size="icon" className="size-7" disabled={!prompt.trim()}><Play /></Button></div></div><div className="mt-2 text-center text-[10px] text-muted-foreground">Cursor can make mistakes. Check important info.</div></div></aside>}
        {!chatOpen && <Button onClick={() => setChatOpen(true)} size="icon" className="fixed bottom-5 right-5 rounded-full shadow-lg"><MessageSquare /></Button>}
      </div>
      <div className="flex h-6 shrink-0 items-center justify-between border-t bg-primary px-3 text-[10px] text-primary-foreground"><span className="flex items-center gap-2"><Code2 className="size-3" /> Ready</span><span className="flex items-center gap-3"><span>Prettier</span><span>0 errors</span><Command className="size-3" /></span></div>
    </main>
  )
}
