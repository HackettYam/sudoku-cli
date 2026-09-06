import { describe, expect, it } from 'vitest'

import { validateCommand, validateContract } from '../../commands/validate.js'

const VALID = '123456789456789123789123456234567891567891234891234567345678912678912345912345678'

// Two 5s in the top row → violates Sudoku rules.
const INVALID = '550000000' + '0'.repeat(72)

describe('validateCommand', () => {
  it('returns valid for a board that follows Sudoku rules', () => {
    expect(validateCommand(VALID)).toEqual({ kind: 'valid' })
  })

  it('returns invalid for a board that violates the rules', () => {
    const result = validateCommand(INVALID)

    expect(result.kind).toBe('invalid')

    if (result.kind === 'invalid') {
      expect(result.reason).toMatch(/violates Sudoku rules/)
    }
  })

  it('returns parse_error on bad input', () => {
    const result = validateCommand('too short')

    expect(result.kind).toBe('parse_error')

    if (result.kind === 'parse_error') {
      expect(result.reason).toContain('Board string must be exactly')
    }
  })
})

describe('validateContract', () => {
  describe('parse', () => {
    it('returns help on -h', () => {
      expect(validateContract.parse(['-h'])).toEqual({ ok: 'help' })
    })
    it('returns help on --help', () => {
      expect(validateContract.parse(['--help'])).toEqual({ ok: 'help' })
    })
    it('parses a board', () => {
      const r = validateContract.parse([VALID])
      expect(r).toEqual({ ok: true, args: { board: VALID } })
    })
    it('returns error on unknown option', () => {
      const r = validateContract.parse(['--frobnicate'])
      expect(r.ok).toBe(false)
      if (r.ok === false) {
        expect(r.message).toContain('Unknown option')
      }
    })
    it('returns error when board missing', () => {
      const r = validateContract.parse([])
      expect(r).toEqual({ ok: false, message: "'validate' requires a board string argument." })
    })
  })

  describe('run', () => {
    it('delegates to validateCommand and returns a valid result', async () => {
      const result = await validateContract.run({ board: VALID }, {} as never)
      expect(result).toEqual({ kind: 'valid' })
    })
  })
})
