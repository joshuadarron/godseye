import { spawn } from 'node:child_process'
import { isWin, normaliseSpawn } from './platform.mjs'

/**
 * Run a command to completion.
 *
 * Never rejects: a missing binary or a non-zero exit is data, not an exception,
 * because every caller here wants to print its own remediation message. Check
 * `missing` to tell "not installed" apart from "ran and failed".
 */
export function run(cmd, args = [], { cwd, env, stream = false, timeout = 0 } = {}) {
  const norm = normaliseSpawn(cmd, args)
  if (!norm) {
    return Promise.resolve({ code: 127, stdout: '', stderr: '', missing: true })
  }

  return new Promise((resolve) => {
    const child = spawn(norm.file, norm.args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: stream ? 'inherit' : 'pipe',
      windowsHide: true,
      ...norm.opts,
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (d) => (stdout += d))
    child.stderr?.on('data', (d) => (stderr += d))

    let timedOut = false
    const timer = timeout
      ? setTimeout(() => {
          timedOut = true
          killTree(child.pid)
        }, timeout)
      : null

    child.on('error', (err) => {
      if (timer) clearTimeout(timer)
      resolve({ code: 127, stdout, stderr: String(err), missing: err.code === 'ENOENT' })
    })

    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr, missing: false, timedOut })
    })
  })
}

/**
 * Terminate a process and everything it spawned.
 *
 * Windows has no real signals: process.kill(pid) becomes TerminateProcess
 * against that one pid, so killing a wrapper (`go run`, a .cmd shim) leaves the
 * process actually holding the port alive. taskkill /T walks the tree by
 * parent pid instead.
 *
 * On POSIX, children spawned with detached:true lead their own process group,
 * so signalling the negated pid reaches the whole group in one call.
 */
export function killTree(pid, signal = 'SIGTERM') {
  if (!pid) return

  if (isWin) {
    // A non-zero exit here just means the process was already gone.
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    }).on('error', () => {})
    return
  }

  try {
    process.kill(-pid, signal)
  } catch (err) {
    if (err.code === 'ESRCH') return
    // Not a group leader after all — fall back to the single process.
    try {
      process.kill(pid, signal)
    } catch {
      /* already gone */
    }
  }
}

/**
 * Split a byte stream into whole lines.
 *
 * Chunks arrive on arbitrary boundaries, so a trailing fragment is held back
 * until more data (or flush) completes it. Call flush() on 'end': Go's slog and
 * Vite both emit an unterminated final line when they die abruptly, and that is
 * usually the line explaining why.
 */
export function lineSplitter(onLine) {
  let carry = ''
  return {
    push(chunk) {
      carry += chunk
      const parts = carry.split('\n')
      carry = parts.pop() ?? ''
      for (const part of parts) onLine(part.replace(/\r$/, ''))
    },
    flush() {
      if (carry) {
        onLine(carry)
        carry = ''
      }
    },
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
