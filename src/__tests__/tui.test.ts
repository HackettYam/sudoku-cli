import { describe, expect, it } from 'vitest'

import { formatTime, parseKeypress } from '../tui.js'

describe('parseKeypress navigation', () => {
  it('parses arrow up', () => {
    expect(parseKeypress(Buffer.from('\x1b[A'))).toEqual([{ kind: 'arrow-up' }])
  })

  it('parses arrow down', () => {
    expect(parseKeypress(Buffer.from('\x1b[B'))).toEqual([{ kind: 'arrow-down' }])
  })

  it('parses arrow right', () => {
    expect(parseKeypress(Buffer.from('\x1b[C'))).toEqual([{ kind: 'arrow-right' }])
  })

  it('parses arrow left', () => {
    expect(parseKeypress(Buffer.from('\x1b[D'))).toEqual([{ kind: 'arrow-left' }])
  })

  it('parses home', () => {
    expect(parseKeypress(Buffer.from('\x1b[H'))).toEqual([{ kind: 'home' }])
  })

  it('parses end', () => {
    expect(parseKeypress(Buffer.from('\x1b[F'))).toEqual([{ kind: 'end' }])
  })

  it('parses ctrl-home via CSI H', () => {
    expect(parseKeypress(Buffer.from('\x1b[1;5H'))).toEqual([{ kind: 'ctrl-home' }])
  })

  it('parses ctrl-end via CSI H', () => {
    expect(parseKeypress(Buffer.from('\x1b[8;5H'))).toEqual([{ kind: 'ctrl-end' }])
  })

  it('parses ctrl-end via F key', () => {
    expect(parseKeypress(Buffer.from('\x1b[8;5F'))).toEqual([{ kind: 'ctrl-end' }])
  })

  it('parses ctrl-home via tilde', () => {
    expect(parseKeypress(Buffer.from('\x1b[1;5~'))).toEqual([{ kind: 'ctrl-home' }])
  })

  it('parses ctrl-end via tilde', () => {
    expect(parseKeypress(Buffer.from('\x1b[4;5~'))).toEqual([{ kind: 'ctrl-end' }])
  })

  it('parses backspace (DEL)', () => {
    expect(parseKeypress(Buffer.from('\x7f'))).toEqual([{ kind: 'backspace' }])
  })

  it('parses backspace (BS)', () => {
    expect(parseKeypress(Buffer.from('\x08'))).toEqual([{ kind: 'backspace' }])
  })

  it('parses delete', () => {
    expect(parseKeypress(Buffer.from('\x1b[3~'))).toEqual([{ kind: 'delete' }])
  })

  it('parses ctrl-c', () => {
    expect(parseKeypress(Buffer.from('\x03'))).toEqual([{ kind: 'ctrl-c' }])
  })

  it('parses lone escape', () => {
    expect(parseKeypress(Buffer.from('\x1b'))).toEqual([{ kind: 'escape' }])
  })
})

describe('parseKeypress input', () => {
  it('parses digit 1', () => {
    expect(parseKeypress(Buffer.from('1'))).toEqual([{ kind: 'digit', value: 1 }])
  })

  it('parses digit 9', () => {
    expect(parseKeypress(Buffer.from('9'))).toEqual([{ kind: 'digit', value: 9 }])
  })

  it('parses printable char', () => {
    expect(parseKeypress(Buffer.from('a'))).toEqual([{ kind: 'char', char: 'a' }])
  })

  it('parses space', () => {
    expect(parseKeypress(Buffer.from(' '))).toEqual([{ kind: 'char', char: ' ' }])
  })

  it('returns [] for unknown CSI sequence', () => {
    expect(parseKeypress(Buffer.from('\x1b[999Z'))).toEqual([])
  })

  it('parses multiple keys from buffer', () => {
    expect(parseKeypress(Buffer.from('1\x1b[Aq'))).toEqual([
      { kind: 'digit', value: 1 },
      { kind: 'arrow-up' },
      { kind: 'char', char: 'q' },
    ])
  })

  it('returns [] for empty buffer', () => {
    expect(parseKeypress(Buffer.from(''))).toEqual([])
  })

  it('skips unknown bytes', () => {
    expect(parseKeypress(Buffer.from([0x01, 0x02, 0x7f]))).toEqual([{ kind: 'backspace' }])
  })

  it('returns empty for unrecognized escape sequence', () => {
    expect(parseKeypress(Buffer.from('\x1b[99;99z'))).toEqual([])
  })

  it('skips unknown escape byte (non-CSI)', () => {
    expect(parseKeypress(Buffer.from('\x1bX'))).toEqual([{ kind: 'char', char: 'X' }])
  })

  it('returns empty for incomplete CSI', () => {
    expect(parseKeypress(Buffer.from('\x1b['))).toEqual([])
  })

  it('returns empty for unrecognized tilde', () => {
    expect(parseKeypress(Buffer.from('\x1b[5z'))).toEqual([])
  })

  it('returns empty for unrecognized tilde number', () => {
    expect(parseKeypress(Buffer.from('\x1b[5~'))).toEqual([])
  })
})

describe('formatTime', () => {
  it('formats 0 ms as 00:00', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('formats 1 second', () => {
    expect(formatTime(1000)).toBe('00:01')
  })

  it('formats 59 seconds', () => {
    expect(formatTime(59_000)).toBe('00:59')
  })

  it('formats 1 minute', () => {
    expect(formatTime(60_000)).toBe('01:00')
  })

  it('formats 1 minute 5 seconds', () => {
    expect(formatTime(65_000)).toBe('01:05')
  })

  it('formats 1 hour', () => {
    expect(formatTime(3_600_000)).toBe('1:00:00')
  })

  it('formats 1 hour 1 minute 1 second', () => {
    expect(formatTime(3_661_000)).toBe('1:01:01')
  })

  it('formats negative as 00:00', () => {
    expect(formatTime(-1000)).toBe('00:00')
  })

  it('formats large time with hours', () => {
    expect(formatTime(10_800_000)).toBe('3:00:00')
  })
})
