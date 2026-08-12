// ANSI colour, with the usual escape hatches.
//
// NO_COLOR is honoured for *any* value including the empty string, per
// https://no-color.org. FORCE_COLOR overrides it, which is what lets the dev
// orchestrator keep colour alive in child processes whose stdout is a pipe.

const forced = process.env.FORCE_COLOR
const disabled = process.env.NO_COLOR !== undefined || process.env.TERM === 'dumb'

export const useColor =
  forced !== undefined && forced !== '0' ? true : !disabled && Boolean(process.stdout.isTTY)

// Built rather than written literally: a bare escape byte in source is
// invisible in most editors and does not survive copy/paste reliably.
const ESC = String.fromCharCode(27)
const sgr = (n) => `${ESC}[${n}m`

const wrap = (open, close) => (s) => (useColor ? sgr(open) + s + sgr(close) : String(s))

export const bold = wrap(1, 22)
export const dim = wrap(2, 22)
export const red = wrap(31, 39)
export const green = wrap(32, 39)
export const yellow = wrap(33, 39)
export const blue = wrap(34, 39)
export const magenta = wrap(35, 39)
export const cyan = wrap(36, 39)

// Distinguishable foreground colours for per-process log prefixes.
const PALETTE = [36, 35, 33, 32, 34, 31]

/** Returns a colouriser for slot `i`, cycling through the palette. */
export function tag(i) {
  return wrap(PALETTE[i % PALETTE.length], 39)
}

// Status glyphs. cmd.exe at codepage 437 mangles Unicode box and check
// characters, so only opt into them where the terminal is known to cope.
// Equal width keeps columns aligned either way.
const unicodeOk = process.platform !== 'win32' || Boolean(process.env.WT_SESSION)

export const GLYPH = {
  ok: unicodeOk ? '✓' : '+',
  info: '-',
  warn: '!',
  fail: unicodeOk ? '✗' : 'x',
}
