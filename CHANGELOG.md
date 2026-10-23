# Changelog

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
