import net from 'node:net'
import { isWin } from './platform.mjs'
import { run } from './proc.mjs'

// Always the literal address, never 'localhost'. Since Node 17 the OS resolver
// order is honoured, and on Windows 'localhost' usually resolves ::1 first — so
// a service bound to 127.0.0.1 would look unreachable.
const LOOPBACK = '127.0.0.1'

/** Is something accepting connections on this port right now? */
export function probePort(port, { host = LOOPBACK, timeoutMs = 500 } = {}) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const done = (result) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })
}

/**
 * Can *we* bind this port on `host`?
 *
 * Note this is genuinely per-interface, and the interfaces do not overlap the
 * way you might expect: on Windows, binding 0.0.0.0:N succeeds while another
 * process holds 127.0.0.1:N. So the default is the loopback address our
 * services actually bind, and probePort — which sees any listener reachable on
 * loopback, wildcard-bound ones included — stays the primary occupancy check.
 *
 * `exclusive: true` matters too: without it Node sets SO_REUSEADDR, and on
 * Linux binding can then succeed against a socket in TIME_WAIT, reporting a
 * port as free when it is not.
 */
export function canBind(port, { host = LOOPBACK } = {}) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen({ port, host, exclusive: true })
  })
}

/**
 * Poll an HTTP endpoint until it answers 2xx, or the deadline passes.
 *
 * Both Go services build their route mux only after migrations commit, so a
 * 200 from /healthz proves the migration transaction is done — which is what
 * lets the orchestrator start them in sequence without a blind sleep.
 */
export async function waitForHealth(port, { path = '/healthz', timeoutMs = 60000 } = {}) {
  const started = Date.now()
  const deadline = started + timeoutMs

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${LOOPBACK}:${port}${path}`, {
        signal: AbortSignal.timeout(1500),
      })
      if (res.ok) return { ok: true, ms: Date.now() - started }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return { ok: false, ms: Date.now() - started }
}

/**
 * Best-effort "which process owns this port", for error messages only.
 *
 * Every failure path returns null: lsof is absent on minimal Linux images, and
 * netstat's LISTENING column is localised on non-English Windows. A vague
 * message beats a crashed diagnostic.
 */
export async function whoHasPort(port) {
  try {
    if (isWin) {
      const { stdout } = await run('netstat', ['-ano', '-p', 'TCP'], { timeout: 10000 })
      const line = stdout
        .split(/\r?\n/)
        .find((l) => /LISTENING/i.test(l) && new RegExp(`[:.]${port}\\s`).test(l))
      if (!line) return null
      const pid = line.trim().split(/\s+/).pop()
      if (!/^\d+$/.test(pid)) return null
      const { stdout: tasks } = await run(
        'tasklist',
        ['/FI', `PID eq ${pid}`, '/NH', '/FO', 'CSV'],
        {
          timeout: 10000,
        },
      )
      return { pid, name: (tasks.match(/^"([^"]+)"/) || [])[1] ?? 'unknown' }
    }

    const { stdout, missing } = await run(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'],
      { timeout: 10000 },
    )
    if (missing) return null
    const pid = (stdout.match(/^p(\d+)/m) || [])[1]
    const name = (stdout.match(/^c(.+)$/m) || [])[1]
    return pid ? { pid, name: name ?? 'unknown' } : null
  } catch {
    return null
  }
}

/** Format a port conflict for humans, naming the culprit when we can find it. */
export async function describePortConflict(port) {
  const owner = await whoHasPort(port)
  return owner
    ? `port ${port} is in use by ${owner.name} (PID ${owner.pid})`
    : `port ${port} is in use`
}
