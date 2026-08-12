import { GLYPH, bold, cyan, dim, green, red, yellow } from './color.mjs'

let quiet = false

/** Suppress ok/info output; warnings, failures and headings still print. */
export function setQuiet(value) {
  quiet = Boolean(value)
}

export function heading(text) {
  process.stdout.write(`\n${bold(text)}\n`)
}

export function ok(text, detail) {
  if (quiet) return
  process.stdout.write(`  ${green(GLYPH.ok)} ${text}${detail ? ' ' + dim(detail) : ''}\n`)
}

export function info(text, detail) {
  if (quiet) return
  process.stdout.write(`  ${dim(GLYPH.info)} ${text}${detail ? ' ' + dim(detail) : ''}\n`)
}

export function warn(text, ...hints) {
  process.stdout.write(`  ${yellow(GLYPH.warn)} ${text}\n`)
  for (const hint of hints) process.stdout.write(`      ${dim(hint)}\n`)
}

export function step(text) {
  if (quiet) return
  process.stdout.write(`  ${cyan('>')} ${text}\n`)
}

export function note(text) {
  process.stdout.write(`${dim(text)}\n`)
}

/** Print a failure and its remediation. Does not exit — callers decide. */
export function failure(text, ...hints) {
  process.stderr.write(`  ${red(GLYPH.fail)} ${red(text)}\n`)
  for (const hint of hints) process.stderr.write(`      ${hint}\n`)
}

/** Print a failure and stop. Used for conditions with no sensible fallback. */
export function fatal(text, ...hints) {
  failure(text, ...hints)
  process.exit(1)
}

/** Human-readable elapsed time from a Date.now() stamp. */
export function since(startedAt) {
  const ms = Date.now() - startedAt
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}
