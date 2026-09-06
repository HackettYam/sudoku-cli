import { isValidPuzzle } from '@hackettyam/sudoku-tools'
import { describe, expect, it } from 'vitest'

import { solveCommand, solveContract } from '../../commands/solve.js'

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

describe('solveContract', () => {
  describe('parse', () => {
    it('returns help on -h', () => {
      expect(solveContract.parse(['-h'])).toEqual({ ok: 'help' })
    })
    it('returns help on --help', () => {
      expect(solveContract.parse(['--help'])).toEqual({ ok: 'help' })
    })
    it('parses a board', () => {
      const r = solveContract.parse([VALID])
      expect(r).toEqual({ ok: true, args: { board: VALID } })
    })
    it('returns error on unknown option', () => {
      const r = solveContract.parse(['--frobnicate'])
      expect(r.ok).toBe(false)
      if (r.ok === false) {
        expect(r.message).toContain('Unknown option')
      }
    })
    it('returns error when board missing', () => {
      const r = solveContract.parse([])
      expect(r).toEqual({ ok: false, message: "'solve' requires a board string argument." })
    })
  })

  describe('run', () => {
    it('delegates to solveCommand and returns a solved result', async () => {
      const result = await solveContract.run({ board: VALID }, {} as never)
      expect(result.kind).toBe('solved')
      if (result.kind === 'solved') {
        expect(result.serialized).toHaveLength(81)
        expect(result.serialized).toMatch(/^[1-9]{81}$/)
      }
    })
  })
})
