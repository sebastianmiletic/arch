import { spawn } from 'node-pty';
import type { IPty } from 'node-pty';
import { homedir } from 'os';
import { execSync } from 'child_process';

interface TerminalSession {
  id: string;
  pty: IPty;
  cwd: string;
}

const sessions = new Map<string, TerminalSession>();

function getShell(): string {
  return process.env.SHELL || '/bin/zsh';
}

// ─── Capture the user's REAL shell environment ───
// Electron apps don't inherit the user's .zshrc/.bash_profile env,
// so we spawn a login shell to capture it and merge it in.
function getUserEnv(): Record<string, string> {
  const shell = getShell();
  try {
    // Run shell as interactive login, dump env, timeout after 3s
    const output = execSync(
      `${shell} -ilc 'env -0'`,
      { encoding: 'utf-8', timeout: 3000, env: { ...process.env, HOME: homedir() } }
    );
    const env: Record<string, string> = {};
    for (const pair of output.split('\0')) {
      const eq = pair.indexOf('=');
      if (eq > 0) {
        const key = pair.slice(0, eq);
        const val = pair.slice(eq + 1);
        env[key] = val;
      }
    }
    return env;
  } catch {
    return {};
  }
}

// Merge: process.env (Electron) < user shell env < our overrides
const REAL_ENV: Record<string, string> = {
  ...process.env,
  ...getUserEnv(),
  TERM: 'xterm-256color',
  COLORTERM: 'truecolor',
  FORCE_COLOR: '1',
  CLICOLOR: '1',
  CLICOLOR_FORCE: '1',
};

export function createTerminalSession(
  id: string,
  onOutput: (data: string) => void,
  onExit?: (code: number) => void
): TerminalSession {
  // Kill existing session with same id
  const existing = sessions.get(id);
  if (existing) {
    try { existing.pty.kill(); } catch {}
    sessions.delete(id);
  }

  const shell = getShell();
  const cwd = REAL_ENV.HOME || homedir();

  const pty = spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: REAL_ENV,
  });

  pty.onData((data: string) => {
    onOutput(data);
  });

  pty.onExit(({ exitCode }) => {
    sessions.delete(id);
    onExit?.(exitCode);
  });

  const session: TerminalSession = {
    id,
    pty,
    cwd,
  };

  sessions.set(id, session);
  return session;
}

export function getTerminalSession(id: string): TerminalSession | undefined {
  return sessions.get(id);
}

export function killTerminalSession(id: string) {
  const s = sessions.get(id);
  if (s) {
    try { s.pty.kill(); } catch {}
    sessions.delete(id);
  }
}

export function resizeTerminalSession(id: string, cols: number, rows: number) {
  const s = sessions.get(id);
  if (s) {
    try {
      s.pty.resize(Math.max(1, cols), Math.max(1, rows));
    } catch {}
  }
}

export function writeToTerminal(id: string, data: string) {
  const s = sessions.get(id);
  if (s) {
    try {
      s.pty.write(data);
    } catch {}
  }
}
