// Prints the release notes for one version: its CHANGELOG.md section plus install/update
// instructions. Used by the release workflow and by scripts/release.mjs.
//   node scripts/changelog-section.mjs 0.5.0
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('usage: node scripts/changelog-section.mjs <version>');
  process.exit(1);
}

export function changelogSection(text, v) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${v} `) || l === `## ${v}`);
  if (start < 0) return undefined;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

const section = changelogSection(readFileSync('CHANGELOG.md', 'utf8'), version);
if (!section) {
  console.error(`CHANGELOG.md has no "## ${version}" section`);
  process.exit(1);
}

const repo = 'kratner/agent-workspace-dashboard';
const raw = `https://raw.githubusercontent.com/${repo}/main/scripts`;
console.log(`${section}

---

### Install or update

**Windows** (PowerShell):

\`\`\`powershell
irm ${raw}/install.ps1 | iex
\`\`\`

**macOS / Linux**:

\`\`\`sh
curl -fsSL ${raw}/install.sh | sh
\`\`\`

The installer fetches the latest release, verifies its SHA-256 checksum, and installs it with the \`code\` command.

**Manual install:** download the \`.vsix\` below, then run \`code --install-extension agent-workspace-dashboard-${version}.vsix --force\`.

After installing or updating, run **Developer: Reload Window** in VS Code.

Once installed, the extension checks for new releases itself, about once a day, and offers to update. To turn that off, set \`agentWorkspace.checkForUpdates\` to false.`);
