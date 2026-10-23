# Roadmap

## Shipped

| Version | Date | What |
| --- | --- | --- |
| 0.1.0 | 2026-10-21 | Kanban and List views of Claude Code sessions, live updates, click to open or resume |
| 0.2.x | 2026-10-22 | KR brand appearance, extension page, diagnostics log |
| 0.3.0 | 2026-10-23 | Search across the sessions on the dashboard |

The "Waiting on you" column was confirmed working in real use on 2026-10-23. Claude Code's status files do report sessions waiting for approval, so no hook is needed.

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

### Large result sets: short list first

- **Up to 150 matches:** all of them show.
- **More than 150:** you get a short list first, the 25 most recent matches, with the note "Showing 25 of 340 matches". A **Show all 340 results** button opens the extended list.
- **The extended list** loads in pages of 100 as you scroll, so a common word never sends thousands of results to the dashboard at once.
- **Narrowing the search** (adding a word) goes back to the short list.
- **Settings:**
  - `agentWorkspace.historyResultThreshold` (default 150, allowed 100–200) sets where the short list starts.
  - The short list size, 25, is fixed for now.

### Subagent sessions: shown under their parent

Claude Code stores each subagent's transcript under its parent session:

- **The transcript:** `projects/<folder>/<parent session id>/subagents/agent-<id>.jsonl`. Every record in it carries the parent's session id and `isSidechain: true`.
- **A `.meta.json` beside it**, with:
  - the subagent's short task description
  - its agent type
  - its nesting depth
  - whether it finished

Subagent transcripts are searched too. A match inside one rolls up to its **parent** session, and the results show it this way:

- **One result per parent session**, never a separate card per subagent. It shows the parent's title, folder and date, the same as any other result.
- **A subagent indicator on that result.** It reads, for example, "↳ Found in subagent: *Refactor the parser* (general-purpose)", using the task description from `.meta.json`. If there's no description, it falls back to the agent type, then to the subagent's first prompt. The matching line from the subagent's transcript is shown with the search terms highlighted.
- **Several matching subagents** list the first one, then "+2 more subagents". Expanding it lists each subagent with its own matching line.
- **Matches in both the parent and a subagent** show both: the parent's matching prompt, then the subagent indicator.
- **Nested subagents** (a subagent's own subagents) say so, for example "↳ subagent of a subagent", and still roll up to the top-level session.
- **Opening or resuming** a result acts on the parent session. Subagents can't be resumed on their own.
- **A History filter** lets you show only top-level matches, or include subagent matches. Subagent matches are included by default.

Caveat: `.meta.json` is internal to Claude Code and undocumented, like the session status files. The source reads it defensively. If its format changes, the indicator falls back to "subagent" with no description.

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
- [ ] A query with more than 150 matches shows the 25 most recent first. **Show all** then pages through the rest without freezing the dashboard.
- [ ] A word that appears only in a subagent's transcript finds the parent session, with the subagent indicator naming that subagent and showing the matching line.
- [ ] A transcript that's deleted, or still being written, doesn't break the index.
- [ ] History off behaves exactly like 0.3.0.
- [ ] README, CHANGELOG and the preview harness cover it, with neutral sample data only.

### Decided (2026-10-23)

- **Large result sets:** a short list first, with an option to see all results, rather than a hard cap. See "Large result sets: short list first" above.
- **Subagents:** searched, and shown under their parent session with an indicator. See "Subagent sessions: shown under their parent" above.

## Later

- **More agent systems.** Add `SessionSource` implementations for other agents with VS Code extensions, such as Copilot or ChatGPT.
- **Session actions.** Stop, archive or rename a session from its card.
- **Publish to the Visual Studio Marketplace** under a `kratner` publisher, so the extension page shows the publisher as Keith Ratner and installs update automatically.
- **Test on macOS.** It's built for macOS, but only tested on Windows so far.
