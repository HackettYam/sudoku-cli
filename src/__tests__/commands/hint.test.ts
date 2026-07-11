import { describe, expect, it } from 'vitest'
import { hintCommand, hintContract } from '../../commands/hint.js'

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

describe('hintContract', () => {
  // A valid fully-solved board — `hintCommand` returns `no_hint` because there
  // are no empty cells to suggest a value for. (Using `'1'.repeat(81)` would
  // make the solver return `unsolvable` since the board violates Sudoku rules.)
  const BOARD = '123456789456789123789123456234567891567891234891234567345678912678912345912345678'

  describe('parse', () => {
    it('returns help on -h', () => {
      expect(hintContract.parse(['-h'])).toEqual({ ok: 'help' })
    })
    it('returns help on --help', () => {
      expect(hintContract.parse(['--help'])).toEqual({ ok: 'help' })
    })
    it('parses a board', () => {
      const r = hintContract.parse([BOARD])
      expect(r).toEqual({ ok: true, args: { board: BOARD } })
    })
    it('returns error on unknown option', () => {
      const r = hintContract.parse(['--frobnicate'])
      expect(r).toEqual({ ok: false, message: expect.stringContaining('Unknown option') })
    })
    it('returns error when board missing', () => {
      const r = hintContract.parse([])
      expect(r).toEqual({ ok: false, message: "'hint' requires a board string argument." })
    })
  })

  describe('run', () => {
    it('delegates to hintCommand and returns the result', async () => {
      const result = await hintContract.run({ board: BOARD } as never, {} as never)
      expect(result.kind).toBe('no_hint')
    })
  })
})
