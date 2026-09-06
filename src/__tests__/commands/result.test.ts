import { describe, expect, it } from 'vitest'

import { ExitCode } from '../../commands/result.js'

describe('ExitCode', () => {
  it('exposes the documented exit codes', () => {
    expect(ExitCode.SUCCESS).toBe(0)
    expect(ExitCode.INVALID).toBe(1)
    expect(ExitCode.UNSOLVABLE).toBe(2)
  })
})
