# Roadmap

## Shipped

| Version | Date | What |
| --- | --- | --- |
| 0.1.0 | 2026-10-21 | Kanban and List views of Claude Code sessions, live updates, click to open or resume |
| 0.2.x | 2026-10-22 | KR brand appearance, extension page, diagnostics log |
| 0.3.0 | 2026-10-23 | Search across the sessions on the dashboard |

## Next milestone: search your full session history (0.4.0)

Today, search only covers what's on the dashboard: running sessions, plus those that ended within `agentWorkspace.endedWithinHours`. This milestone extends it to every past Claude Code session on the machine, so you can find the session where you worked on something weeks ago and pick it back up.

### Scope

- **What it searches:** every transcript in `~/.claude/projects/` (or `CLAUDE_CONFIG_DIR`), not just recent ones.
- **What it matches:**
  - each session's title, folder and **every prompt you typed**, not only the last one
  - not Claude's replies or tool output: they're most of a transcript's size and would bury the useful matches
- **Results:** past sessions that match show up as Ended cards and rows, marked as from history.
  - *Copy resume* and click-to-resume work on them as on any ended session.
  - The match is highlighted in the prompt that contains it.
- **Turning it on:** a **History** toggle next to the search box. When it's off, search stays as fast and as narrow as it is today.

### Approach

- A search index kept by the extension host, built from transcripts. It reuses the incremental reader in `claudeTranscripts.ts`, so after the first scan only new bytes are read.
- Index per session: id, folder, titles, the list of user prompts and their timestamps, last activity.
- The first full scan runs in the background in batches, so VS Code never stalls. The dashboard shows "Indexing history… (n of m)" until it's done.
- The index is cached on disk in the extension's global storage, so a restart doesn't rescan everything. It's invalidated per transcript by file size and modification time.
- Results come from the host in pages, not as one large message, so a common word doesn't flood the webview.

### Done when

- [ ] With History on, a word typed in a session's prompt from weeks ago finds that session.
- [ ] Clicking or *Copy resume* on a history result resumes the right session in the right folder.
- [ ] Measured on this machine's real history:
  - the first index finishes in under 10 seconds
  - later dashboard opens are ready in under 1 second
  - the UI stays responsive the whole time
- [ ] A transcript that's deleted, or still being written, doesn't break the index.
- [ ] History off behaves exactly like 0.3.0.
- [ ] README, CHANGELOG and the preview harness cover it, with neutral sample data only.

### Open questions

- Should history results be capped (for example, the 200 most recent matches), or paged in as you scroll?
- Include subagent transcripts (`projects/*/<id>/subagents/`), or only top-level sessions?

## Later

- **Confirm the "Waiting on you" state.** Check what Claude Code writes while a session waits for approval. If its status file doesn't show it reliably, report it through a Claude Code hook instead.
- **More agent systems.** Add `SessionSource` implementations for other agents with VS Code extensions, such as Copilot or ChatGPT.
- **Session actions.** Stop, archive or rename a session from its card.
- **Publish to the Visual Studio Marketplace** under a `kratner` publisher, so the extension page shows the publisher as Keith Ratner and installs update automatically.
- **Test on macOS.** It's built for macOS, but only tested on Windows so far.
