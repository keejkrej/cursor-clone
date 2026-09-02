# Cursor clone

An agentic coding workspace modeled on Cursor: talk to an agent that reads the repo, runs tools, edits files, and shows diffs for review. This is not a generic VS Code skin.

## Surfaces

- `/` — desktop IDE analog (dark, `html.dark` + default shadcn dark tokens). Activity bar, explorer, editor tabs, agent chat rail, bottom panel, status bar.
- `/agents` — cloud agents window analog (light, default `:root` tokens). Search agents, New Agent, Today session list, transcript, sticky follow-up, Review + Files Changed diff rail.

## Modes

- **Agent** — may read and edit the workspace. Proposed edits show as unified diffs with Apply / Reject. A checkpoint is taken before each run; Undo restores it.
- **Ask** — read-only Q&A. No writes.
- **Plan** — produce a markdown plan, wait for approval, then switch to Agent and implement.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

`pnpm` works if you have it (`pnpm install` / `pnpm dev`). This repo includes a `pnpm-lock.yaml` but does not require pnpm.

Open [http://localhost:3000](http://localhost:3000).

### `CURSOR_API_KEY`

Set a Cursor API key for the live Agent SDK / Cloud Agents. Server-only — never put this in client bundles.

```bash
# .env
CURSOR_API_KEY=…
```

The run route tries, in order:

1. Local `@cursor/sdk` (`Agent.create` / `Agent.resume` with `local.cwd` = `playground/`)
2. Cloud Agents REST at `https://api.cursor.com` (Bearer `CURSOR_API_KEY`) if the SDK native binary cannot load
3. Demo runtime over the same SSE event protocol

### Demo mode

If `CURSOR_API_KEY` is missing or the SDK/cloud call fails, the product still runs. A banner reads:

> Demo mode — set CURSOR_API_KEY for the real Cursor agent

A simulated agent streams thinking, Read/Grep/Glob/Edit/Shell tool cards, and either an answer (Ask), a markdown plan with Approve (Plan), or a unified diff (Agent) against the virtual playground.

## Playground

The agent’s cwd is `playground/` — a tiny TypeScript app with an intentional auth bug in `src/auth.ts`. Rules in `playground/.cursor/rules/project.mdc` are prepended to Agent/Plan system context.

## Agent protocol

Typed SSE events: `system`, `user`, `assistant` (text deltas), `thinking`, `tool_call`, `status`, `usage`, `error`, plus `diff` and `plan` payloads.

| Route | Purpose |
| --- | --- |
| `GET /api/agent/status` | `{ demo }` — whether `CURSOR_API_KEY` is unset |
| `POST /api/agent/session` | Create a durable session (`{ mode, model }` → `{ sessionId, cursorAgentId?, demo }`) |
| `POST /api/agent/run` | Stream `AgentEvent` SSE for a prompt (follow-ups reuse `sessionId`; `inline: true` rewrites a selection) |
| `POST /api/agent/cancel` | Cancel the in-flight run |
| `GET /api/workspace` | Playground file tree + contents |
| `PUT /api/workspace/file` | Write a file |
| `POST /api/workspace/apply` | Apply an accepted agent diff |

Context chips `@file`, `@selection`, `@folder`, and `@codebase` are attached to the prompt. Agent runs snapshot the file map first; Undo restores that checkpoint. In Agent mode, proposed edits auto-apply after the stream, remain listed as diffs, and can still be rejected or undone.

Inline edit (`⌘K` with a selection) streams a replacement through `/api/agent/run` constrained to that range. Accept writes into the open editor; Reject drops it.

## Shortcuts

Works on both `/` and `/agents`. `⌘` is `Ctrl` on Windows/Linux.

| Shortcut | Action |
| --- | --- |
| `⌘K` | Command palette, or inline edit when the editor has a selection |
| `⌘⇧P` | Command palette |
| `⌘P` | Go to file (palette) |
| `⌘B` | Toggle sidebar |
| `⌘J` | Toggle / focus terminal |
| `⌘I` | Toggle agent chat (focus composer on `/agents`) |
| `⌘S` | Save file |
| `⌘⇧E` / `⌘⇧F` / `⌘⇧G` / `⌘⇧X` | Explorer / Search / Source Control / Extensions |
| `Esc` | Close overlays |

Tab after a typing pause accepts a local ghost completion (heuristic, not the SDK).

Command palette and the agent composer footer show `Kbd` hints for send, newline, context, and navigation.
