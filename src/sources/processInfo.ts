import { execFile } from 'child_process';

// Process facts the dashboard can't get from Node directly. No `vscode` imports.
//  - startTimes: when processes started, to catch a reused PID. Windows recycles PIDs, so an
//    old session file can point at an unrelated process that happens to have the same PID.
//  - ancestors: a process's parent chain, to find which VS Code terminal hosts a CLI session.

const TIMEOUT_MS = 8000;

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: TIMEOUT_MS, windowsHide: true }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

function powershell(script: string): Promise<string> {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]);
}

/**
 * Start times of running processes, as Windows FILETIME strings (100 ns ticks since 1601, UTC),
 * the same format Claude Code writes as `procStart`. Windows only; elsewhere returns an empty map.
 */
export async function startTimes(pids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (process.platform !== 'win32' || pids.length === 0) return out;
  const filter = pids.map((p) => `ProcessId=${Math.trunc(p)}`).join(' OR ');
  const stdout = await powershell(
    `Get-CimInstance Win32_Process -Filter '${filter}' | ForEach-Object { "$($_.ProcessId) $($_.CreationDate.ToFileTimeUtc())" }`,
  );
  for (const line of stdout.split(/\r?\n/)) {
    const [pid, ft] = line.trim().split(' ');
    if (pid && ft) out.set(Number(pid), ft);
  }
  return out;
}

/** True if two FILETIME strings are within a second of each other. */
export function sameStart(a: string, b: string): boolean {
  try {
    const diff = BigInt(a) - BigInt(b);
    return (diff < 0n ? -diff : diff) <= 10_000_000n;
  } catch {
    return false;
  }
}

/** The PIDs above `pid`, nearest first, up to `depth` levels. */
export async function ancestors(pid: number, depth = 5): Promise<number[]> {
  const chain: number[] = [];
  if (process.platform === 'win32') {
    const stdout = await powershell(
      `$id=${Math.trunc(pid)}; for($i=0; $i -lt ${depth}; $i++){ $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id"; if(-not $p){ break }; $id = $p.ParentProcessId; if(-not $id){ break }; $id }`,
    );
    for (const line of stdout.split(/\r?\n/)) if (line.trim()) chain.push(Number(line.trim()));
  } else {
    let current = pid;
    for (let i = 0; i < depth; i++) {
      const parent = Number((await run('ps', ['-o', 'ppid=', '-p', String(current)])).trim());
      if (!parent || parent <= 1) break;
      chain.push(parent);
      current = parent;
    }
  }
  return chain;
}
