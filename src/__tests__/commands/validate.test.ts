import { describe, expect, it } from 'vitest'
import { validateCommand } from '../../commands/validate.js'

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
