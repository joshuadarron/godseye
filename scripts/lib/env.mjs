import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// Matches an assignment line, tolerating leading whitespace and an `export`
// prefix. Anything else (comment, blank line) is carried through untouched.
const ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/

/** Split a .env file into ordered lines, tagging the ones that assign a key. */
export function parseEnvFile(text) {
  return String(text)
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((raw) => {
      const m = ASSIGNMENT.exec(raw)
      return m ? { kind: 'kv', key: m[1], raw } : { kind: 'raw', raw }
    })
}

/** Extract the value from an assignment line, unquoting and dropping comments. */
export function valueOf(raw) {
  const v = raw.slice(raw.indexOf('=') + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  // A trailing `# comment` only counts when whitespace separates it, so values
  // that legitimately contain '#' (passwords, URLs with fragments) survive.
  return v.split(/\s+#/)[0].trim()
}

/** Read one key's value from a .env file, or null if absent/unset. */
export function readEnvKey(path, key) {
  if (!existsSync(path)) return null
  for (const line of parseEnvFile(readFileSync(path, 'utf8'))) {
    if (line.kind === 'kv' && line.key === key) return valueOf(line.raw)
  }
  return null
}

/** Parse a whole .env file into a plain object. */
export function readEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const line of parseEnvFile(readFileSync(path, 'utf8'))) {
    if (line.kind === 'kv') out[line.key] = valueOf(line.raw)
  }
  return out
}

/**
 * Render a .env file using the example as the skeleton and the existing file as
 * the source of values.
 *
 * The rules, in priority order:
 *   1. A key the user has already set to a non-empty value is copied through
 *      byte for byte. We never overwrite a real value.
 *   2. Otherwise, if `defaults` supplies the key, use that.
 *   3. Otherwise, keep the example's line, comments and all.
 * Keys present only in the user's file are appended rather than dropped.
 *
 * This is what makes setup re-runnable: the example provides structure and
 * documentation, the user's edits always win.
 */
export function mergeEnv(exampleText, existingText, defaults = {}) {
  const existing = new Map()
  for (const line of parseEnvFile(existingText || '')) {
    if (line.kind === 'kv') existing.set(line.key, line.raw)
  }

  const seen = new Set()
  const out = []

  for (const line of parseEnvFile(exampleText)) {
    if (line.kind !== 'kv') {
      out.push(line.raw)
      continue
    }
    seen.add(line.key)

    const prior = existing.get(line.key)
    if (prior !== undefined && valueOf(prior) !== '') {
      out.push(prior)
    } else if (defaults[line.key] !== undefined && defaults[line.key] !== '') {
      out.push(`${line.key}=${defaults[line.key]}`)
    } else {
      out.push(line.raw)
    }
  }

  const extras = [...existing.entries()].filter(([key]) => !seen.has(key))
  if (extras.length > 0) {
    while (out.length > 0 && out[out.length - 1].trim() === '') out.pop()
    out.push('', '# --- keys not in .env.example, kept from your file ---')
    for (const [, raw] of extras) out.push(raw)
  }

  return out.join('\n').replace(/\n+$/, '\n')
}

/**
 * Write only when the content actually differs.
 *
 * Always LF: .env is gitignored, so core.autocrlf never normalises it, and a
 * stray CR inside JWT_SECRET would give the two services different secrets —
 * exactly the failure this tooling exists to prevent.
 */
export function writeIfChanged(path, next) {
  const normalised = String(next).replace(/\r\n/g, '\n')
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : null
  if (prev === normalised) return 'unchanged'
  writeFileSync(path, normalised, { encoding: 'utf8' })
  return prev === null ? 'created' : 'updated'
}

/** Insert or replace keys in a .env file, preserving everything else. */
export function upsertEnv(path, values) {
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const lines = parseEnvFile(existing)
  const remaining = { ...values }

  const out = lines.map((line) => {
    if (line.kind === 'kv' && Object.prototype.hasOwnProperty.call(remaining, line.key)) {
      const value = remaining[line.key]
      delete remaining[line.key]
      return `${line.key}=${value}`
    }
    return line.raw
  })

  for (const [key, value] of Object.entries(remaining)) out.push(`${key}=${value}`)

  return writeIfChanged(path, out.join('\n').replace(/\n+$/, '') + '\n')
}
