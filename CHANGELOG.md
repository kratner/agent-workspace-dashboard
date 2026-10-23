# Changelog

## 0.5.0 (2026-10-23)

- **Releases.** Every version is now published on the repository's [Releases page](https://github.com/kratner/agent-workspace-dashboard/releases), with its `.vsix` and notes. GitHub Actions builds each release from its version tag.
- **One-line install:** `irm …/install.ps1 | iex` on Windows, or `curl …/install.sh | sh` on macOS and Linux. It downloads the latest release, verifies its SHA-256 checksum and installs it. Running it again updates.
- **Updates from inside VS Code.**
  - About once a day the extension checks for a newer release, and offers **Update**, **Release Notes** or **Skip This Version**.
  - **Update** downloads it, verifies the checksum, installs it and offers to reload.
  - There's also a **Check for Updates** command, and the setting `agentWorkspace.checkForUpdates` turns the daily check off.

## 0.4.0 (2026-10-23)

- **History search.** A **History** toggle next to the search box also searches every past Claude Code session on the machine.
  - It matches each session's title, folder and every prompt you typed, but not Claude's replies or tool output.
  - Matching past sessions appear in a **From history** section below the current ones, newest first, with the matching line. Click to resume, or **Copy resume**.
- **Subagents:** matches inside subagent transcripts appear under their parent session.
  - Each shows "↳ Found in subagent: *description*" and the matching line. "+N more subagents" expands the rest, and nested subagents are labelled.
  - **Include subagents** turns them off.
- **Large result sets:** up to 150 matches all show. Above that you get the 25 most recent and **Show all N results**, after which the rest load as you scroll. The new setting `agentWorkspace.historyResultThreshold` (100–200, default 150) moves the cut-off.
- **The index:** built in the background on first use, read incrementally afterwards, and cached in the extension's storage.
  - On a 1.09 GB history of 86 transcripts, the first build took 1.4 s and a cached start 17 ms.
- `npm test` runs the new history tests.

## 0.3.0 (2026-10-23)

- **Search.** A search box in the header filters the Kanban and List views as you type.
  - It matches title, last prompt, folder, where the session runs and state.
  - With several words, a session must contain all of them.
  - Matches are highlighted, and the List view shows a matching prompt under the title.
  - Press `/` or Ctrl+F (⌘F) to jump to the box, and Esc to clear it.
  - The search is kept when you switch tabs.
- The "waiting" count in the header is only filled yellow when something is waiting.

## 0.2.2 (2026-10-22)

- The images on the extension's Details page now link to the GitHub repository, because VS Code doesn't load relative image paths there. They display once the repository is public.
- The dashboard no longer sends updates while its tab is hidden. It gets fresh state when you return to it, so the log no longer fills with "not delivered" errors.

## 0.2.1 (2026-10-22)

- New **Agent Workspace** log in the Output panel. It records the dashboard's startup, the messages between the extension and the dashboard, and any error, including errors inside the dashboard itself.
- The dashboard now starts listening for messages before it loads.

## 0.2.0 (2026-10-22)

- KR brand appearance, now the default:
  - black panel with the KR mark
  - Archivo Black headings
  - yellow reserved for sessions waiting on you
  - white, steel and iron for working, idle and ended
- New setting `agentWorkspace.appearance`: `brand` or `vscode` (follow the color theme).
- The extension icon and the dashboard tab icon use the KR colors.
- Extension page: author, screenshots, features, commands and settings.

## 0.1.0 (2026-10-21)

- First version: Kanban and List views of Claude Code sessions, grouped by state.
- Live updates from Claude Code's session files, with a status bar count of working and waiting sessions.
- Click a card to open or resume its session; **Copy resume** for ended sessions.
- The active view is remembered per workspace.
