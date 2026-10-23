# Development

How to build, install and extend the Agent Workspace Dashboard. The steps are the same on Windows and macOS.

## Install from source

### Prerequisites

- [VS Code](https://code.visualstudio.com/) 1.94 or newer, with the `code` command on your PATH.
  - **macOS:** in VS Code, open the Command Palette and run **Shell Command: Install 'code' command in PATH**.
  - **Windows:** the installer adds it by default.
- [Node.js](https://nodejs.org/) 20 or newer, which includes npm.
- [Git](https://git-scm.com/).
- [Claude Code](https://claude.com/claude-code), CLI or VS Code extension.

### Install

```sh
git clone https://github.com/kratner/agent-workspace-dashboard.git
cd agent-workspace-dashboard
npm install
npm run package
code --install-extension agent-workspace-dashboard-0.3.0.vsix
```

`npm run package` type-checks the code, builds it and writes the `.vsix` file. Use the file name it prints; the version number changes with each release.

Then reload VS Code: Command Palette → **Developer: Reload Window**. Do this in every open window, or quit and reopen VS Code.

### Update

```sh
git pull
npm install
npm run package
code --install-extension agent-workspace-dashboard-<version>.vsix --force
```

Then reload the window.

### Uninstall

```sh
code --uninstall-extension kratner.agent-workspace-dashboard
```

### Troubleshooting

- **`code` is "not recognized" right after installing it.** VS Code's built-in terminal keeps the PATH VS Code started with. Quit every VS Code window and reopen, or use a standalone terminal.
- **The dashboard is empty.**
  - Check that `~/.claude` exists, or `CLAUDE_CONFIG_DIR` if you set it.
  - Check that a Claude Code session is running.
  - Ended sessions only show for `agentWorkspace.endedWithinHours`, 24 hours by default.

## Build

```sh
npm run build        # dev build with sourcemaps
npm run watch        # rebuild on change
npm run production   # typecheck + clean minified build + dependency-leak check
npm run package      # production build, then a .vsix
```

Press **F5** to launch an Extension Development Host.

One esbuild script (`esbuild.mjs`) builds both bundles:

- the extension host: Node, CommonJS
- the webview: browser, React

The production build fails if either bundle leaves an import unbundled. The host may only import `vscode` and Node built-ins; the webview may import nothing.

### Previewing the look

`preview/index.html` loads the built webview in a normal browser with sample sessions, so you can check the design without VS Code. Run `npm run build` first. URL options:

- `?appearance=vscode` shows the theme-following look (with VS Code Dark Modern colors).
- `?view=list` shows the List view.

The README screenshots in `media/screenshots/` are taken from this page.

## Architecture

| File | Role |
| --- | --- |
| `src/extension.ts` | Activation, commands, status bar |
| `src/sessionStore.ts` | Merges all sources into one sorted list; fires only when it changes |
| `src/sources/SessionSource.ts` | The interface every agent system implements |
| `src/sources/claudeCode.ts` | Reads `~/.claude/sessions/*.json`, checks the process is alive, maps the status |
| `src/sources/claudeTranscripts.ts` | Reads titles and last prompts from transcripts; after the first read it only reads what was appended |
| `src/dashboardPanel.ts` | The webview tab; stores the active view in `workspaceState` |
| `src/webview/` | React UI: `ViewManager`, `KanbanView`, `ListView`, `viewRegistry.ts` |

### Adding an agent system

1. Implement `SessionSource`. It converts that system's records into `AgentSession` cards.
2. Register it in the `SessionStore` list in `src/extension.ts`.

The views don't change.

### Adding a view

1. Create a component in `src/webview/components/` that takes `ViewProps`.
2. Add one entry to `VIEWS` in `src/webview/viewRegistry.ts`.

Don't change existing view ids. They're what's saved as each workspace's active view.

## Branding

The icon, colors and type come from Keith Ratner's KR brand kit:

- **Fonts:** `src/webview/fonts/` holds Archivo and Archivo Black, with their licenses in `licenses/`.
- **The KR glyph:** `src/webview/components/KrGlyph.tsx` holds a copy of the brand kit's glyph path.
- **Icon working files:** they're in `branding/`.
  - `npm run brand` re-renders the icon concepts and writes `media/icon.png`.
  - `npm run brand:compare` checks a vector trace against its source image.
