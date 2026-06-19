import { describe, expect, it } from 'vitest'
import { solveCommand } from '../../commands/solve.js'
import { isValidPuzzle } from '@hackettyam/sudoku-tools'

// A valid 81-char board with a known solution (rows 0,1,2,...8 of a Latin square).
const VALID = '123456789456789123789123456234567891567891234891234567345678912678912345912345678'

// An unsolvable 81-char board: two 5s in the top row, no valid completion.
const UNSOLVABLE = '550000000' + '0'.repeat(72)

describe('solveCommand', () => {
  it('solves a valid puzzle and returns the serialized solution', () => {
    const result = solveCommand(VALID)

    expect(result.kind).toBe('solved')

    if (result.kind === 'solved') {
      expect(result.serialized).toHaveLength(81)
      expect(result.serialized).toMatch(/^[1-9]{81}$/)

      // Re-parse and confirm the solution is itself a valid Sudoku board.
      const board: number[][] = []

      for (let i = 0; i < 9; i++) {
        board.push(result.serialized.slice(i * 9, i * 9 + 9)
          .split('')
          .map((c) => Number.parseInt(c, 10)))
      }

      expect(isValidPuzzle(board)).toBe(true)
    }
  })

  it('returns unsolvable for a board with rule violations', () => {
    const result = solveCommand(UNSOLVABLE)

    expect(result.kind).toBe('unsolvable')

    if (result.kind === 'unsolvable') {
      expect(result.reason).toMatch(/No solution exists/)
    }
  })

  it('returns parse_error on bad input', () => {
    const result = solveCommand('garbage')

    expect(result.kind).toBe('parse_error')

    if (result.kind === 'parse_error') {
      expect(result.reason).toContain('Board string must be exactly')
    }
  })
})
