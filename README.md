# Agent Workspace Dashboard

A VS Code extension that shows your running agent sessions as a Kanban board or a list. It starts with Claude Code. Other agent systems (Copilot, ChatGPT, …) can be added as sources later.

## What it shows

Each card is one session. **Columns:** Waiting on you · Working · Idle · Ended.

- **Title.** The session's custom title, else its agent name, else Claude's auto title.
- **Last prompt, folder and surface.** Surface is VS Code, Terminal or Background.
- **Time since last activity.**

Click a card to open the session:

- **Claude Code panel in this window:** the session's tab opens or comes to the front.
- **Ended session from this folder:** the session is resumed.
- **Anything else:** a message says where the session is running and offers to open its folder. An ended session also offers to copy a `claude --resume` command.

The status bar shows how many sessions are working or waiting, and turns yellow when any session is waiting on you.

**Command:** `Agent Workspace: Open Dashboard`.

**Settings:**

- `agentWorkspace.endedWithinHours` (default 24) sets how far back ended sessions go.
- `agentWorkspace.showStatusBar` turns the status bar item on or off.

## Where the data comes from

The extension only reads files. It never runs or changes an agent.

| Source | Reads |
| --- | --- |
| Claude Code | `~/.claude/sessions/<pid>.json` (one per running process: id, folder, status) and `~/.claude/projects/*/<sessionId>.jsonl` (titles, last prompt). Honors `CLAUDE_CONFIG_DIR`. |

The session status files are internal to Claude Code and not a documented API, so a Claude Code update can change them. `src/sources/claudeCode.ts` reads them defensively. If a status word isn't recognised, the session shows as Idle and keeps the original word.

## Adding an agent system

1. Implement `SessionSource` (`src/sources/SessionSource.ts`). It converts that system's records into `AgentSession` cards.
2. Register it in the `SessionStore` list in `src/extension.ts`.

## Adding a view

1. Create a component in `src/webview/components/` that takes `ViewProps`.
2. Add one entry to `VIEWS` in `src/webview/viewRegistry.ts`.

The active view's id is saved in `workspaceState`, so the dashboard reopens on the same view after a restart.

## Develop

```sh
npm install
npm run build        # dev build with sourcemaps
npm run watch        # rebuild on change
npm run production   # typecheck + clean minified build + dependency-leak check
npm run package      # build a .vsix
```

Press **F5** to launch an Extension Development Host. All of these work the same on Windows and macOS.

To install the packaged build, run `code --install-extension agent-workspace-dashboard-<version>.vsix`.
