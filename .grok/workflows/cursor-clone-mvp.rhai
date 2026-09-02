let meta = #{
    name: "cursor-clone-mvp",
    description: "Finish an authentic Cursor clone MVP: shadcn default theme, Cursor core agent logic, Refero-informed UI, Cursor Agent SDK",
    when_to_use: "Build or finish the Cursor clone web MVP in this repo",
    phases: [
        #{ title: "Foundation", detail: "Default shadcn theme, primitives, app shell" },
        #{ title: "Workspace", detail: "Virtual FS, editor, explorer, tabs, terminal, git" },
        #{ title: "Agent-loop", detail: "Cursor SDK server, SSE, demo fallback" },
        #{ title: "Agent-ui", detail: "Chat, modes, tools, diffs, agents window" },
        #{ title: "Polish", detail: "Command palette, inline edit, shortcuts, copy" },
        #{ title: "Verify", detail: "Install, typecheck, build, fix gaps" },
    ],
};

let status_schema = #{
    "type": "object",
    "properties": #{
        "status": #{ "type": "string" },
        "notes": #{ "type": "string" },
        "files": #{ "type": "array", "items": #{ "type": "string" } },
    },
};

fn guard(r) {
    r != () && r.success
}

fn fail_pause(step, r) {
    let msg = step + " failed";
    if r != () {
        if r.output != () {
            msg += " — inspect agent output and retry";
        }
    }
    pause("verification", msg);
}

fn repo_rules() {
    let s = "";
    s += "REPO: /home/jack/workspace/cursor-clone\n";
    s += "This is a Next.js 16 App Router + React 19 + Tailwind v4 + shadcn (style base-nova, baseColor neutral) project.\n";
    s += "pnpm-lock exists but pnpm may be missing — use `npm install` / `npx shadcn@latest` / `npx tsc --noEmit`. Do not require pnpm.\n";
    s += "Work in the existing workspace. Do NOT use a separate git worktree. Do NOT commit unless asked.\n";
    s += "Do not invent placeholder TODOs that leave the MVP unfinished. Ship working code.\n";
    s += "Never put CURSOR_API_KEY in client bundles. Server-only.\n";
    s += "Keep TypeScript strict. Do not leave next.config ignoreBuildErrors true — set it false after types compile.\n";
    s += "Read existing files before editing. Integrate with current structure (app/, components/ui, lib/utils.ts).\n\n";
    s
}

fn product_spec() {
    let s = "";
    s += "GOAL: Authentic Cursor clone MVP. Not a generic VS Code skin. Cursor's core product is an agentic coding workspace: the user talks to an agent that reads the repo, runs tools, edits files, and shows diffs for review.\n\n";

    s += "SURFACES\n";
    s += "1) Editor workspace at `/` (Cursor desktop IDE analog, dark via html.dark + DEFAULT shadcn dark tokens).\n";
    s += "   Layout: activity bar | sidebar (explorer/search/scm/agent/extensions) | editor+tabs | agent chat rail | bottom panel (terminal/problems/output) | status bar.\n";
    s += "   Titlebar: Cursor wordmark, folder name, branch, settings, account.\n";
    s += "2) Agents window at `/agents` (cursor.com/agents analog, LIGHT using default :root tokens — no .dark on this route).\n";
    s += "   Refero flow 9924 + screens bd458136 and 8b09e132: left sidebar Search agents + New Agent + session list grouped Today; main transcript; right Files Changed diff rail; sticky follow-up composer.\n";
    s += "   Empty state: centered prompt card, model picker, suggestion chips (Refero step 1-2).\n";
    s += "   Running: model chips with Working timers, Thought for N seconds accordions, `$ command` tool cards, file-changed summary, Review action.\n\n";

    s += "CORE BUSINESS LOGIC (must be real, not fake labels)\n";
    s += "- Modes: Agent (may edit), Ask (read-only Q&A, no writes), Plan (produce a plan, wait for user to approve then switch to Agent).\n";
    s += "- Context chips: @file, @selection, @folder, @codebase. Include attached context in the prompt sent to the agent.\n";
    s += "- Conversation: durable session id; follow-ups continue the same agent; New chat creates a new session.\n";
    s += "- Streaming events (discriminated): system, user, assistant (text deltas), thinking, tool_call (running/completed/error with name+args+result), status, usage, error.\n";
    s += "- Tool visualization: Read/Grep/Glob/Edit/Write/Shell as collapsible cards like Cursor (command in a muted code block, output truncated).\n";
    s += "- Diffs: when the agent writes/edits, show unified diff, per-file Apply / Reject. Apply writes into the workspace store and updates the open editor. Reject drops the pending hunk.\n";
    s += "- Checkpoints: snapshot file map before each Agent run; Undo restores the snapshot.\n";
    s += "- Rules: playground/.cursor/rules/project.mdc is prepended to Agent/Plan system context.\n";
    s += "- Model picker: composer-2.5 (default), grok-4.5, auto-smart. Persist on the session.\n";
    s += "- Command palette (Ctrl/Cmd+K and Ctrl/Cmd+Shift+P): files, commands (Toggle Agent, New Chat, Focus Terminal, Go to Agents).\n";
    s += "- Inline edit (Ctrl/Cmd+K when editor has a selection): prompt overlay, stream a replacement, Accept/Reject.\n";
    s += "- Tab ghost: after typing pause, show a muted ghost completion for the current line (local heuristic is OK; do not call the SDK for Tab).\n";
    s += "- Git panel: stage/unstage, commit message, commit against the virtual git state (or playground git if present).\n";
    s += "- Search panel: filter playground files by query, click to open.\n";
    s += "- Terminal: local command log UI; `help`, `ls`, `cat <file>`, `clear` operate on the virtual FS. Do not exec arbitrary host shell.\n";
    s += "- Keyboard: Ctrl/Cmd+B toggle sidebar, Ctrl/Cmd+J toggle bottom, Ctrl/Cmd+I toggle chat, Escape closes overlays.\n";
    s += "- Demo mode: if CURSOR_API_KEY is missing or SDK/cloud fails, still stream a faithful simulated agent over the SAME event protocol that can read/search/edit the virtual workspace so the product is usable offline.\n\n";

    s += "CURSOR AGENT SDK\n";
    s += "Install `@cursor/sdk`. Server-only. next.config.mjs must set serverExternalPackages: ['@cursor/sdk'].\n";
    s += "Adapter in lib/agent/cursor-runtime.ts:\n";
    s += "  Agent.create({ apiKey: process.env.CURSOR_API_KEY, model: { id }, mode: 'agent'|'plan', local: { cwd: playgroundAbsPath } })\n";
    s += "  agent.send(prompt) then for-await run.stream() mapping SDKMessage -> our AgentEvent, then run.wait().\n";
    s += "  Resume via Agent.resume(agentId) when session.cursorAgentId is set.\n";
    s += "  Cancel via run.cancel().\n";
    s += "If local SDK cannot load (native binary / bundling), fall back to Cloud Agents REST at https://api.cursor.com with Bearer CURSOR_API_KEY (create agent + stream run). Document this in comments.\n";
    s += "API routes (App Router, nodejs runtime):\n";
    s += "  POST /api/agent/session  { mode, model, cwd? } -> { sessionId, cursorAgentId?, demo }\n";
    s += "  POST /api/agent/run      { sessionId, prompt, mode?, model?, context[] } -> text/event-stream of AgentEvent\n";
    s += "  POST /api/agent/cancel   { sessionId }\n";
    s += "  GET  /api/workspace      file tree + contents\n";
    s += "  PUT  /api/workspace/file { path, content }\n";
    s += "  POST /api/workspace/apply { path, content }  (after user Apply)\n";
    s += "Playground cwd: /home/jack/workspace/cursor-clone/playground  (sample app the agent edits).\n";
    s += "Never import @cursor/sdk from a 'use client' file.\n\n";

    s += "SHADCN / THEME (non-negotiable)\n";
    s += "Start from the DEFAULT shadcn theme. components.json already has baseColor: neutral, style: base-nova.\n";
    s += "Reset app/globals.css :root and .dark to official shadcn v4 OKLCH default tokens. Remove the custom blue-tinted :root and the prefers-color-scheme override that copies custom dark into :root.\n";
    s += "Default light :root uses oklch(1 0 0) background, oklch(0.145 0 0) foreground, oklch(0.205 0 0) primary, radius 0.625rem, etc.\n";
    s += "Default .dark uses oklch(0.145 0 0) background, oklch(0.985 0 0) foreground, oklch(0.922 0 0) primary — the stock shadcn dark, NOT a custom brand palette.\n";
    s += "html on `/` has class='dark'. `/agents` is light (no dark class) so both default themes are exercised.\n";
    s += "MUST build chrome from shadcn/ui primitives, not raw unstyled buttons/inputs except inside the code editor surface.\n";
    s += "Add via `npx shadcn@latest add -y` at least: input textarea tabs scroll-area tooltip dropdown-menu dialog command separator badge accordion select popover toggle toggle-group sonner resizable kbd sheet checkbox.\n";
    s += "If a registry item is missing, implement a thin primitive wrapper in components/ui matching existing button.tsx (base-ui + cva + cn).\n";
    s += "Use Button, Input, Textarea, Tabs, ScrollArea, Tooltip, DropdownMenu, Dialog, Command, Separator, Badge, Accordion, Select, Popover, Toggle, ToggleGroup, Sonner, Resizable panels, Kbd, Sheet, Checkbox.\n";
    s += "Density: compact. IDE chrome uses size sm/xs/icon-sm. 1px borders, no heavy shadows, tonal surfaces (bg-background / bg-card / bg-muted / bg-popover).\n";
    s += "Refero visual language for /agents: warm off-white page, 260px sidebar, white cards, 6-8px radius, pill model chips, rounded composer ~18px, dark circular send, monospace tool/code blocks, 'Thought for Ns' muted, Files Changed right rail.\n";
    s += "Refero visual language for `/`: VS Code/Cursor desktop — activity bar icons, explorer tree, editor tabs with close, status bar. Use default dark tokens only.\n\n";

    s += "SAMPLE PLAYGROUND\n";
    s += "Create playground/ with a tiny TypeScript app: package.json, src/index.ts, src/auth.ts (intentional simple bug), README.md, .cursor/rules/project.mdc.\n";
    s += "Seed the editor with these files so Agent/Ask/Plan have real code to talk about.\n\n";

    s += "README\n";
    s += "Rewrite README with: what this is, pnpm/npm dev, CURSOR_API_KEY, demo mode, surfaces, modes, shortcuts.\n";
    s
}

fn implement_prompt(slice, extra) {
    let p = "";
    p += repo_rules();
    p += product_spec();
    p += "YOUR SLICE: ";
    p += slice;
    p += "\n";
    p += extra;
    p += "\n\nBefore coding: list_dir + read existing app/page.tsx, app/layout.tsx, app/globals.css, components.json, package.json, components/ui/button.tsx.\n";
    p += "After coding: run `npx tsc --noEmit` if node_modules exists; if not, `npm install` first. Fix type errors you introduced.\n";
    p += "Do not stop with a plan. Implement the slice fully. Return a short notes list of files you created or changed.\n";
    p
}

// ---------------------------------------------------------------------------
phase("Foundation");
log("Installing shadcn primitives and restoring the default theme");

let foundation_extra = "";
foundation_extra += "Implement ONLY foundation (do not build the full IDE yet, but leave a compiling app):\n";
foundation_extra += "1. Reset app/globals.css to official shadcn v4 default OKLCH tokens for :root and .dark. Keep @import tailwindcss, tw-animate-css, shadcn/tailwind.css, @theme inline mappings, @layer base. Remove custom blue :root and prefers-color-scheme block.\n";
foundation_extra += "2. app/layout.tsx: wrap with TooltipProvider and Toaster. Keep metadata. Default html without dark class (routes set it). Import sonner.\n";
foundation_extra += "3. npx shadcn@latest add the primitives listed in the spec (-y). If the CLI asks, non-interactive.\n";
foundation_extra += "4. npm install dependencies you need now: @cursor/sdk, @monaco-editor/react, lucide-react (already), sonner if not pulled by shadcn.\n";
foundation_extra += "5. next.config.mjs: serverExternalPackages ['@cursor/sdk'], typescript.ignoreBuildErrors false.\n";
foundation_extra += "6. Replace app/page.tsx with a temporary dark full-viewport shell that says Cursor and links to /agents, so the app still renders.\n";
foundation_extra += "7. Add app/agents/page.tsx placeholder (light) with the same.\n";
foundation_extra += "8. .env.example with CURSOR_API_KEY=\n";
foundation_extra += "Do not customize theme colors. Default tokens only.\n";

let foundation = agent(implement_prompt("Foundation: theme + shadcn primitives + providers", foundation_extra), #{
    label: "foundation",
    capability_mode: "all",
    output_schema: status_schema,
});
if guard(foundation) == false { fail_pause("Foundation", foundation); }
log("Foundation complete");

// ---------------------------------------------------------------------------
phase("Workspace");
log("Building the IDE workspace: FS, explorer, editor, terminal, git");

let workspace_extra = "";
workspace_extra += "Implement the editor workspace at `/` (dark). Leave `/agents` as-is if it is only a placeholder.\n";
workspace_extra += "Create:\n";
workspace_extra += "- playground/ sample project as specified.\n";
workspace_extra += "- lib/workspace/types.ts, files.ts (seed tree from playground or a mirrored in-memory tree), git.ts (virtual changes: M/A/D).\n";
workspace_extra += "- lib/workspace/store.tsx client provider: open files, active file, dirty content, sidebar panel, bottom panel, chat open, notices, git staged, search query, selection range.\n";
workspace_extra += "- GET/PUT workspace API routes so the client can load/save playground files. Seed from playground/ on first load.\n";
workspace_extra += "- components/ide/activity-bar.tsx, title-bar.tsx, status-bar.tsx, sidebar.tsx (explorer tree, search, scm, agent shortcuts, extensions list UI), editor-pane.tsx (Monaco, tabs, line numbers, Ctrl/Cmd+K inline edit stub slot), bottom-panel.tsx (terminal/problems/output), command-palette.tsx (can be wired later but component should exist).\n";
workspace_extra += "- Use Resizable panels for sidebar | editor | chat (chat can be empty slot). Use shadcn Tabs, ScrollArea, Button, Input, Badge, Separator, Tooltip, DropdownMenu.\n";
workspace_extra += "- Explorer: nested folders, open on click, dirty dot, new file.\n";
workspace_extra += "- Editor: Monaco with vs-dark, word wrap off, tab size 2. Opening a file loads content from the store.\n";
workspace_extra += "- SCM: list changed files vs seed, stage checkboxes, commit message, commit button that snapshots the current contents as HEAD.\n";
workspace_extra += "- Terminal: prompt with ls/cat/help/clear against the file tree.\n";
workspace_extra += "- Status bar: branch main, Ln/Col from Monaco, language, notice.\n";
workspace_extra += "app/page.tsx should compose the full IDE chrome. html dark class: set in page via useEffect on document.documentElement, and also a small client DarkRoot component.\n";
workspace_extra += "Do not implement the live agent SDK in this slice, but leave a ChatRail slot on the right.\n";

let workspace = agent(implement_prompt("Workspace IDE chrome + virtual FS + Monaco + git/search/terminal", workspace_extra), #{
    label: "workspace",
    capability_mode: "all",
    output_schema: status_schema,
});
if guard(workspace) == false { fail_pause("Workspace", workspace); }
log("Workspace complete");

// ---------------------------------------------------------------------------
phase("Agent-loop");
log("Wiring Cursor Agent SDK, SSE, and demo fallback");

let loop_extra = "";
loop_extra += "Implement the agent loop backend and a typed event protocol. UI can stay partial.\n";
loop_extra += "Create:\n";
loop_extra += "- lib/agent/types.ts — AgentMode, AgentEvent, ToolCallEvent, Session, ContextChip, PendingDiff.\n";
loop_extra += "- lib/agent/demo-runtime.ts — deterministic simulator used when no CURSOR_API_KEY. It must: emit thinking, emit tool_call read/grep on playground files, then either answer (Ask) or propose an edit + diff (Agent) or a markdown plan with Approve CTA payload (Plan). Stream events with small delays via async generator.\n";
loop_extra += "- lib/agent/cursor-runtime.ts — wrap @cursor/sdk as specified. Map SDK messages to AgentEvent. Catch load failures and throw a typed error the route can use to fall back to demo.\n";
loop_extra += "- lib/agent/session-store.ts — server memory Map of sessions (id, mode, model, cursorAgentId, demo, playground path).\n";
loop_extra += "- app/api/agent/session/route.ts, run/route.ts (SSE), cancel/route.ts.\n";
loop_extra += "- lib/agent/diff.ts — compute unified diff between before/after file content.\n";
loop_extra += "Run route algorithm: load session; if CURSOR_API_KEY and runtime works, SDK; else demo. Always SSE. Include playground file listing in the prompt as codebase context when @codebase or Agent/Plan.\n";
loop_extra += "Ask mode: instruct SDK/demo not to edit files. Plan mode: mode:'plan' on Agent.create/send. Agent mode: mode:'agent'.\n";
loop_extra += "Write a tiny node script scripts/agent-smoke.mjs that imports types only, or skip if ESM hassle — prefer a lib/agent/protocol.test isn't required, but export a parseSse helper for the client.\n";
loop_extra += "Client helper lib/agent/client.ts: createSession, runPrompt (ReadableStream -> callbacks), cancelRun.\n";

let agent_loop = agent(implement_prompt("Agent SDK adapter + SSE API + demo runtime", loop_extra), #{
    label: "agent-loop",
    capability_mode: "all",
    output_schema: status_schema,
});
if guard(agent_loop) == false { fail_pause("Agent-loop", agent_loop); }
log("Agent loop complete");

// ---------------------------------------------------------------------------
phase("Agent-ui");
log("Building chat rail, tool cards, diffs, and /agents window");

let ui_extra = "";
ui_extra += "Implement the full agent UX on both surfaces, using the API from the previous slice.\n";
ui_extra += "Editor `/` right rail (components/agent/chat-rail.tsx):\n";
ui_extra += "- Header: Ask Cursor / mode ToggleGroup (Agent Ask Plan), model Select, New chat.\n";
ui_extra += "- Empty: 'How can I help with your code today?' + suggestion chips that send prompts.\n";
ui_extra += "- Transcript: user bubbles; assistant markdown-ish text; thinking accordion; tool cards; pending diffs with Apply/Reject; plan card with Approve & implement (sends follow-up mode=agent).\n";
ui_extra += "- Composer: Textarea, @ context popover (files from store), attach selection, mode-aware placeholder, send Button. Streaming disables send and shows stop (cancel).\n";
ui_extra += "- After Agent run, refresh workspace files from GET /api/workspace so Monaco shows new content when applied (auto-apply in Agent mode after stream, still list diffs + Undo checkpoint).\n";
ui_extra += "Agents window `/agents` (light, Refero):\n";
ui_extra += "- Sidebar search, New Agent button, session list.\n";
ui_extra += "- Empty main: centered prompt card + chips + model Select + send.\n";
ui_extra += "- Active session: breadcrumb, model chips, transcript, sticky follow-up composer, Review button, right Files Changed panel with unified diffs.\n";
ui_extra += "- documentElement.classList.remove('dark') on this route.\n";
ui_extra += "Reuse the same session/event components between IDE rail and Agents window.\n";
ui_extra += "Wire Agent sidebar icon and Agent panel shortcuts to focus the chat rail.\n";

let ui = agent(implement_prompt("Agent chat UI, diffs, plan approval, /agents window", ui_extra), #{
    label: "agent-ui",
    capability_mode: "all",
    output_schema: status_schema,
});
if guard(ui) == false { fail_pause("Agent-ui", ui); }
log("Agent UI complete");

// ---------------------------------------------------------------------------
phase("Polish");
log("Command palette, inline edit, shortcuts, README");

let polish_extra = "";
polish_extra += "Finish product details so the MVP feels like Cursor:\n";
polish_extra += "1. Command palette fully wired (cmdk/shadcn Command in a Dialog). File search + commands.\n";
polish_extra += "2. Inline edit overlay on Monaco selection: prompt, stream via /api/agent/run with Ask/Agent constrained to the selection (demo can rewrite the selection), Accept/Reject.\n";
polish_extra += "3. Global shortcuts on both routes as specified. Show Kbd hints in UI (composer footer, palette).\n";
polish_extra += "4. Tab ghost completion in Monaco (registerInlineCompletionProvider heuristic).\n";
polish_extra += "5. Empty/error states: missing API key banner 'Demo mode — set CURSOR_API_KEY for the real Cursor agent', SSE errors, no results in search, 0 files changed.\n";
polish_extra += "6. Extensions panel remains a static list (ESLint, Prettier, Tailwind) — OK for MVP, but enabling should toast via sonner.\n";
polish_extra += "7. Rewrite README.md. Add .env.example if missing.\n";
polish_extra += "8. Ensure layout does not overflow; min-h-screen h-dvh overflow-hidden on IDE root.\n";
polish_extra += "9. Accessibility: aria-labels on icon buttons, focus rings from shadcn, palette focus trap.\n";
polish_extra += "10. Remove the old monolithic mock in app/page.tsx if any remains; the IDE must be componentized.\n";
polish_extra += "Walk the app mentally: open file, search, stage+commit, ask agent about auth.ts, agent edits, apply diff, undo, open /agents, new agent, see tool cards.\n";

let polish = agent(implement_prompt("Polish: palette, inline edit, shortcuts, README, states", polish_extra), #{
    label: "polish",
    capability_mode: "all",
    output_schema: status_schema,
});
if guard(polish) == false { fail_pause("Polish", polish); }
log("Polish complete");

// ---------------------------------------------------------------------------
phase("Verify");
log("Installing, typechecking, building, and filling gaps");

let verify_prompt = "";
verify_prompt += repo_rules();
verify_prompt += "You are the verifier and fixer for the Cursor clone MVP.\n";
verify_prompt += "1. Read the repo (app/, components/, lib/, playground/, package.json, globals.css).\n";
verify_prompt += "2. Confirm ALL of the following; if missing, IMPLEMENT them now (do not only report):\n";
verify_prompt += "   - Default shadcn theme tokens (no custom blue :root). `/` uses dark class, `/agents` is light.\n";
verify_prompt += "   - shadcn primitives used for chrome.\n";
verify_prompt += "   - Agent/Ask/Plan modes, streaming events, tool cards, diffs Apply/Reject, checkpoints, context chips.\n";
verify_prompt += "   - Server Cursor SDK adapter + demo fallback + CURSOR_API_KEY never client-side.\n";
verify_prompt += "   - / and /agents both functional.\n";
verify_prompt += "   - playground sample + README + .env.example.\n";
verify_prompt += "3. npm install && npx tsc --noEmit && npm run build. Fix all errors you can.\n";
verify_prompt += "4. If @cursor/sdk fails to install or typecheck in Next, isolate imports behind try/catch dynamic import so the app still builds; demo mode must work without the package if install failed — but try to keep the dependency.\n";
verify_prompt += "5. Do not reintroduce ignoreBuildErrors unless the only blocker is the SDK's own shipped types; prefer wrapping SDK in a .ts file with minimal any casts on stream events.\n";
verify_prompt += "Return status=ok only if build succeeds or the remaining errors are strictly environmental (no network). Notes must list what you fixed.\n";

let verify = agent(verify_prompt, #{
    label: "verify",
    capability_mode: "all",
    output_schema: status_schema,
});
if guard(verify) == false { fail_pause("Verify", verify); }

let notes = "";
if verify.output != () && verify.output.notes != () {
    notes = verify.output.notes;
}

complete(#{
    summary: "Cursor clone MVP workflow finished",
    notes: notes,
});
