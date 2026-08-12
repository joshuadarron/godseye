import { ROOT, which } from './platform.mjs'
import { run } from './proc.mjs'

/**
 * Work out what is wrong with Docker, if anything.
 *
 * "Not installed" and "installed but not running" need completely different
 * remediation, and the two are easy to conflate. `docker version` is the right
 * probe: it exits non-zero when the daemon is unreachable, whereas some
 * releases of `docker info` exit 0 and only mention the problem on stderr.
 *
 * Returns one of: ok | no-cli | daemon-down | no-compose | error.
 */
export async function dockerState() {
  if (!which('docker')) return { state: 'no-cli' }

  const version = await run('docker', ['version', '--format', '{{.Server.Version}}'], {
    timeout: 20000,
  })
  if (version.code !== 0) {
    const text = `${version.stderr}${version.stdout}`.toLowerCase()
    // Windows names a pipe; Linux and macOS name a unix socket.
    const daemonDown =
      /cannot connect|docker_engine|dockerdesktop|the docker daemon|during connect|is the docker daemon running|pipe/.test(
        text,
      )
    if (daemonDown) return { state: 'daemon-down' }
    return { state: 'error', detail: (version.stderr || version.stdout).trim() }
  }

  const compose = await run('docker', ['compose', 'version', '--short'], { timeout: 20000 })
  if (compose.code !== 0) return { state: 'no-compose', server: version.stdout.trim() }

  return { state: 'ok', server: version.stdout.trim(), compose: compose.stdout.trim() }
}

/** Per-platform remediation lines for a given dockerState(). */
export function dockerRemediation(state) {
  switch (state) {
    case 'no-cli':
      return [
        'Docker CLI not found on PATH.',
        'macOS:   brew install --cask docker',
        'Windows: winget install Docker.DockerDesktop',
        'Linux:   https://docs.docker.com/engine/install/',
      ]
    case 'daemon-down':
      return [
        'Docker is installed, but the daemon is not running.',
        'Windows/macOS: start Docker Desktop and wait for it to finish starting.',
        'Linux:         sudo systemctl start docker',
      ]
    case 'no-compose':
      return [
        'Docker Compose v2 is missing (the standalone docker-compose v1 does not count).',
        'https://docs.docker.com/compose/install/',
      ]
    default:
      return []
  }
}

/**
 * Bring up infrastructure and block until it is actually usable.
 *
 * --wait names its services explicitly on purpose. Waiting on everything would
 * let Memgraph — optional, slowest to start, and historically the service with
 * the flakiest healthcheck — gate the whole stack.
 */
export async function composeUpInfra({ stream = true, timeoutSec = 120 } = {}) {
  const required = await run(
    'docker',
    ['compose', 'up', '-d', '--wait', '--wait-timeout', String(timeoutSec), 'timescaledb', 'redis'],
    { cwd: ROOT, stream, timeout: (timeoutSec + 30) * 1000 },
  )
  if (required.code !== 0) return required

  // Optional: started without --wait, and its failure is not fatal.
  await run('docker', ['compose', 'up', '-d', 'memgraph'], {
    cwd: ROOT,
    stream,
    timeout: 180000,
  })
  return required
}

/**
 * Current state of every compose service.
 *
 * `docker compose ps --format json` emits NDJSON in some versions and a single
 * JSON array in others, so handle both rather than pinning a compose version.
 */
export async function composePs() {
  const { stdout, code } = await run('docker', ['compose', 'ps', '--all', '--format', 'json'], {
    cwd: ROOT,
    timeout: 20000,
  })
  if (code !== 0) return []

  const text = stdout.trim()
  if (!text) return []
  try {
    if (text.startsWith('[')) return JSON.parse(text)
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch {
    return []
  }
}
