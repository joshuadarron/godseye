import { existsSync } from 'node:fs'
import { delimiter, dirname, extname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const isWin = process.platform === 'win32'

/** Absolute path to the repository root, derived from this file's location. */
export const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

/**
 * Resolve an executable the way a shell would, walking PATH and (on Windows)
 * PATHEXT. Returns an absolute path, or null when nothing matches.
 *
 * Node's spawn() does its own lookup, but it will not tell us *what* it found,
 * and we need that: the extension decides whether a command has to be routed
 * through cmd.exe. See normaliseSpawn.
 */
export function which(cmd) {
  if (isAbsolute(cmd) || cmd.includes('/') || cmd.includes('\\')) {
    return existsSync(cmd) ? cmd : null
  }
  const exts = isWin ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : ['']
  const dirs = (process.env.PATH || '').split(delimiter).filter(Boolean)
  // cmd.exe searches the working directory before PATH; POSIX shells do not.
  if (isWin) dirs.unshift(process.cwd())

  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, cmd + ext)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

/**
 * Quote one argv element for `cmd.exe /c`, which has its own escaping rules on
 * top of the C runtime's. Backslash runs before a quote must be doubled, then
 * cmd's own metacharacters need caret escapes.
 */
function quoteForCmd(arg) {
  const quoted = `"${String(arg)
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\*)$/, '$1$1')}"`
  return quoted.replace(/[()%!^"<>&|]/g, '^$&')
}

/**
 * Normalise (command, args) into something spawn() accepts everywhere.
 *
 * Since CVE-2024-27980, Node refuses to spawn .cmd/.bat files without
 * `shell: true` — it throws EINVAL. But `shell: true` re-parses the whole
 * command line through cmd.exe, mangling any argument containing & ^ | " or a
 * space. So we do what cross-spawn does: invoke cmd.exe ourselves, quote each
 * argument by hand, and set windowsVerbatimArguments so libuv does not quote on
 * top of our quoting.
 *
 * Returns null when the command is not installed, so callers can print a useful
 * "not found" message instead of catching an opaque ENOENT.
 */
export function normaliseSpawn(cmd, args = []) {
  const resolved = which(cmd)
  if (!resolved) return null

  const ext = extname(resolved).toLowerCase()
  if (isWin && (ext === '.cmd' || ext === '.bat')) {
    const line = [quoteForCmd(resolved), ...args.map(quoteForCmd)].join(' ')
    return {
      file: process.env.ComSpec || 'cmd.exe',
      // /d skips AutoRun registry hooks, a real source of "works on my machine".
      // /s gives predictable stripping of the outermost quotes.
      args: ['/d', '/s', '/c', line],
      opts: { windowsVerbatimArguments: true },
    }
  }
  return { file: resolved, args, opts: {} }
}

/**
 * Compare dotted version strings numerically. Returns a negative number when
 * `a < b`, zero when equal, positive when `a > b`.
 *
 * String comparison gets this wrong in the way that matters most here: "1.9"
 * sorts after "1.10".
 */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

/** Extract the first dotted version number from arbitrary tool output. */
export function parseVersion(text) {
  const m = String(text).match(/(\d+)\.(\d+)(?:\.(\d+))?/)
  return m ? `${m[1]}.${m[2]}.${m[3] ?? 0}` : null
}
