import { describe, expect, it } from 'vitest'
import { hintCommand } from '../../commands/hint.js'

// A valid solved board (no empty cells) → hint should report no hint available.
const SOLVED = '123456789456789123789123456234567891567891234891234567345678912678912345912345678'

// A valid puzzle with several empty cells; solvable.
const PUZZLE = '123456789456789123789123456234567891567891234891234567345678912678912345912345670'

// Unsolvable: two 5s in the top row.
const UNSOLVABLE = '550000000' + '0'.repeat(72)

describe('hintCommand', () => {
  it('returns a hint for a puzzle with empty cells', () => {
    const result = hintCommand(PUZZLE)

    expect(result.kind).toBe('hint')

    if (result.kind === 'hint') {
      expect(result.row).toBeGreaterThanOrEqual(0)
      expect(result.row).toBeLessThan(9)
      expect(result.col).toBeGreaterThanOrEqual(0)
      expect(result.col).toBeLessThan(9)
      expect(result.value).toBeGreaterThanOrEqual(1)
      expect(result.value).toBeLessThanOrEqual(9)
    }
  })

  it('returns no_hint for an already-solved board', () => {
    expect(hintCommand(SOLVED)).toEqual({ kind: 'no_hint' })
  })

  it('returns unsolvable for a board with rule violations', () => {
    const result = hintCommand(UNSOLVABLE)

    expect(result.kind).toBe('unsolvable')

    if (result.kind === 'unsolvable') {
      expect(result.reason).toMatch(/No solution exists/)
    }
  })

  it('returns parse_error on bad input', () => {
    const result = hintCommand('not a board')

    expect(result.kind).toBe('parse_error')

    if (result.kind === 'parse_error') {
      expect(result.reason).toContain('Board string must be exactly')
    }
  })
})
