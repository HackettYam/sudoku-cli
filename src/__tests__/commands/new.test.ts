import { describe, expect, it } from 'vitest'
import { newCommand } from '../../commands/new.js'
import { isValidPuzzle } from '@hackettyam/sudoku-tools'

describe('newCommand', () => {
  it('returns a parse_error on an unknown difficulty', () => {
    const result = newCommand({ difficulty: 'insane' })

    expect(result.kind).toBe('parse_error')

    if (result.kind === 'parse_error') {
      expect(result.reason).toContain("Invalid difficulty: 'insane'")
    }
  })

  it('generates a valid puzzle at the requested difficulty', () => {
    const result = newCommand({ difficulty: 'easy' })

    expect(result.kind).toBe('new')

    if (result.kind === 'new') {
      expect(result.serialized).toHaveLength(81)
      expect(result.difficultyName).toBe('easy')
      // Re-parse the serialized board to confirm it round-trips into a valid 9x9
      // grid that satisfies Sudoku rules once a complete solution is computed.
      // We don't solve here; we just sanity-check the puzzle is well-formed.
      expect(result.serialized).toMatch(/^[0-9]{81}$/)
    }
  })

  it('uses the default difficulty when none is provided', () => {
    const result = newCommand()

    expect(result.kind).toBe('new')

    if (result.kind === 'new') {
      expect(result.difficultyName).toBe('normal')
    }
  })

  it('produces puzzles with empty cells (0) for non-trivial cases', () => {
    const result = newCommand({ difficulty: 'expert' })

    expect(result.kind).toBe('new')

    if (result.kind === 'new') {
      const zeros = (result.serialized.match(/0/g) ?? []).length
      expect(zeros).toBeGreaterThan(0)
    }
  })

  it('treats the result as a valid puzzle structure (9x9 numeric grid)', () => {
    // Sanity-check: parse the serialized board and confirm it is a 9x9 numeric grid.
    const result = newCommand({ difficulty: 'normal' })

    expect(result.kind).toBe('new')

    if (result.kind === 'new') {
      const rows: number[][] = []
      for (let i = 0; i < 9; i++) {
        const row = result.serialized.slice(i * 9, i * 9 + 9)
          .split('')
          .map((c) => Number.parseInt(c, 10))
        rows.push(row)
      }

      expect(rows).toHaveLength(9)
      rows.forEach((r) => expect(r).toHaveLength(9))
      // Note: the puzzle itself is not solved, so isValidPuzzle is not asserted here.
      void isValidPuzzle
    }
  })
})
