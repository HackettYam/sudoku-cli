import { describe, expect, it } from 'vitest'

import { shouldEnableColors, colors } from '../../format/colors.js'

describe('shouldEnableColors', () => {
  it('returns true when FORCE_COLOR is set', () => {
    expect(shouldEnableColors({ FORCE_COLOR: '1' }, false)).toBe(true)
  })

  it('returns false when NO_COLOR is set (non-empty)', () => {
    expect(shouldEnableColors({ NO_COLOR: '1' }, true)).toBe(false)
  })

  it('returns false when NO_COLOR is empty string', () => {
    expect(shouldEnableColors({ NO_COLOR: '' }, true)).toBe(false)
  })

  it('returns true when no env flags and TTY is true', () => {
    expect(shouldEnableColors({}, true)).toBe(true)
  })

  it('returns false when no env flags and TTY is false', () => {
    expect(shouldEnableColors({}, false)).toBe(false)
  })
})

describe('colors', () => {
  it('colors.red returns plain text when colors are disabled', () => {
    const disabled = colors.red('x')
    // When colors are disabled, picocolors strips ANSI sequences
    expect(disabled).toBe('x')
  })

  it('colors is a picocolors Colors instance', () => {
    expect(typeof colors.red).toBe('function')
    expect(typeof colors.bold).toBe('function')
    expect(typeof colors.green).toBe('function')
  })
})
