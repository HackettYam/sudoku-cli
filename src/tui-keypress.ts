/** Discriminated union of parsed key events. */
export type ParsedKey =
  | { readonly kind: 'arrow-up' }
  | { readonly kind: 'arrow-down' }
  | { readonly kind: 'arrow-left' }
  | { readonly kind: 'arrow-right' }
  | { readonly kind: 'home' }
  | { readonly kind: 'end' }
  | { readonly kind: 'ctrl-home' }
  | { readonly kind: 'ctrl-end' }
  | { readonly kind: 'digit'; readonly value: number }
  | { readonly kind: 'backspace' }
  | { readonly kind: 'delete' }
  | { readonly kind: 'char'; readonly char: string }
  | { readonly kind: 'escape' }
  | { readonly kind: 'ctrl-c' }

interface KeypressParseResult {
  readonly keys: readonly ParsedKey[]
  readonly nextIndex: number
}

interface CsiParseResult {
  readonly key: ParsedKey | null
  readonly nextIndex: number
}

/**
 * Parse raw terminal input bytes into structured key events.
 * Handles ANSI CSI sequences. Unknown sequences return [].
 *
 * @param buf - Raw input buffer from stdin.
 * @returns Array of parsed key events (usually 0 or 1).
 *
 * @example
 * ```ts
 * parseKeypress(Buffer.from('\x1b[A')) // [{ kind: 'arrow-up' }]
 * ```
 */
export function parseKeypress(buf: Buffer): readonly ParsedKey[] {
  const result: ParsedKey[] = []
  let i = 0

  while (i < buf.length) {
    const parsed = parseKeypressAt(buf, i)
    result.push(...parsed.keys)
    i = parsed.nextIndex
  }

  return result
}

/** Parse one non-CSI escape sequence. */
function parseEscapeSequence(buf: Buffer, index: number): KeypressParseResult {
  const next = buf[index + 1]
  if (next !== undefined && next === 0x5b) {
    const parsed = parseCsiSequence(buf, index + 2)
    const keys = parsed.key === null ? [] : [parsed.key]
    return { keys, nextIndex: parsed.nextIndex }
  }
  if (index + 1 === buf.length) {
    return { keys: [{ kind: 'escape' }], nextIndex: index + 1 }
  }
  return { keys: [], nextIndex: index + 1 }
}

/** Parse the byte at one input position and return the next position. */
function parseKeypressAt(buf: Buffer, index: number): KeypressParseResult {
  const byte = buf[index] as number

  if (byte === 0x03) {
    return { keys: [{ kind: 'ctrl-c' }], nextIndex: index + 1 }
  }
  if (byte === 0x1b) {
    return parseEscapeSequence(buf, index)
  }
  if (byte === 0x7f || byte === 0x08) {
    return { keys: [{ kind: 'backspace' }], nextIndex: index + 1 }
  }
  if (byte >= 0x31 && byte <= 0x39) {
    return { keys: [{ kind: 'digit', value: byte - 0x30 }], nextIndex: index + 1 }
  }
  if (byte >= 0x20 && byte <= 0x7e) {
    return { keys: [{ kind: 'char', char: String.fromCharCode(byte) }], nextIndex: index + 1 }
  }
  return { keys: [], nextIndex: index + 1 }
}

interface CsiParameters {
  readonly values: readonly number[]
  readonly nextIndex: number
}

/** Collect CSI numeric parameters and stop at the final byte. */
function collectCsiParameters(buf: Buffer, from: number): CsiParameters {
  let i = from
  const params: number[] = []
  let current = ''

  while (i < buf.length) {
    const ch = buf[i] as number
    if (ch >= 0x30 && ch <= 0x3b) {
      if (ch === 0x3b) {
        params.push(current === '' ? 0 : Number(current))
        current = ''
      } else {
        current += String.fromCharCode(ch)
      }
      i++
    } else {
      break
    }
  }

  if (current !== '') {
    params.push(Number(current))
  }

  return { values: params, nextIndex: i }
}

/** Parse CSI H (home and control-home/end) sequences. */
function parseHomeSequence(params: readonly number[], nextIndex: number): CsiParseResult {
  if (params.length === 2 && params[1] === 5) {
    if (params[0] === 1) {
      return { key: { kind: 'ctrl-home' }, nextIndex }
    }
    if (params[0] === 8) {
      return { key: { kind: 'ctrl-end' }, nextIndex }
    }
  }
  return { key: { kind: 'home' }, nextIndex }
}

/** Parse CSI F (end and control-end) sequences. */
function parseEndSequence(params: readonly number[], nextIndex: number): CsiParseResult {
  if (params.length === 2 && params[0] === 8 && params[1] === 5) {
    return { key: { kind: 'ctrl-end' }, nextIndex }
  }
  return { key: { kind: 'end' }, nextIndex }
}

/** Parse CSI tilde sequences. */
function parseTildeSequence(params: readonly number[], nextIndex: number): CsiParseResult {
  if (params[0] === 3) {
    return { key: { kind: 'delete' }, nextIndex }
  }
  if (params.length === 2 && params[1] === 5) {
    if (params[0] === 1) {
      return { key: { kind: 'ctrl-home' }, nextIndex }
    }
    if (params[0] === 4) {
      return { key: { kind: 'ctrl-end' }, nextIndex }
    }
  }
  return { key: null, nextIndex }
}

/** Dispatch a CSI final byte to its sequence-specific parser. */
function parseCsiFinalByte(
  finalByte: number | undefined,
  params: readonly number[],
  nextIndex: number,
): CsiParseResult {
  switch (finalByte) {
    case 0x41: return { key: { kind: 'arrow-up' }, nextIndex }
    case 0x42: return { key: { kind: 'arrow-down' }, nextIndex }
    case 0x43: return { key: { kind: 'arrow-right' }, nextIndex }
    case 0x44: return { key: { kind: 'arrow-left' }, nextIndex }
    case 0x48: return parseHomeSequence(params, nextIndex)
    case 0x46: return parseEndSequence(params, nextIndex)
    case 0x7e: return parseTildeSequence(params, nextIndex)
    default: return { key: null, nextIndex }
  }
}

/** Parse one CSI sequence after its parameter bytes have been collected. */
function parseCsiSequence(buf: Buffer, from: number): CsiParseResult {
  const { values: params, nextIndex } = collectCsiParameters(buf, from)
  if (nextIndex >= buf.length) {
    return { key: null, nextIndex }
  }

  return parseCsiFinalByte(buf[nextIndex], params, nextIndex + 1)
}
