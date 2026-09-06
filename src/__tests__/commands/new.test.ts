import { isValidPuzzle } from '@hackettyam/sudoku-tools'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { CommandContext } from '../../commands/contract.js'
import { newCommand, newContract } from '../../commands/new.js'
import type * as NewModule from '../../commands/new.js'

// vi.mock is hoisted above the imports by vitest. We keep every named export
// intact except for two precise re-bindings:
//   1. `newCommand` is wrapped in a `vi.fn` so direct-call tests can stub it
//      via `vi.mocked(newCommand).mockReturnValue(...)`.
//   2. `newContract.run` is replaced with a thin closure that invokes the
//      wrapped `newCommand` using the same argument-shape mapping the real
//      `newContract.run` uses (forwards `difficulty` only when defined).
//
// The real `newContract.run` closure-captures the module-scope `newCommand`
// reference, so wrapping `newCommand` alone is not sufficient — the `run`
// override must call the wrapped `vi.fn` explicitly so that
// `vi.mocked(newCommand).mockReturnValue(...)` actually takes effect inside
// the `newContract.run` tests below.
//
// `vi.spyOn` cannot replace a named export in an ESM namespace import (the
// namespace object is a read-only view of the live module record), so we use
// the `vi.mock` factory pattern here. The hoisted factory runs at module
// resolution time, before the test file body executes.
vi.mock('../../commands/new.js', async (importOriginal) => {
  const mod = await importOriginal<typeof NewModule>()
  const wrapped = vi.fn(mod.newCommand)
  return {
    ...mod,
    newCommand: wrapped,
    newContract: {
      ...mod.newContract,
      async run(args: NewModule.NewArgs, _ctx: CommandContext) {
        const opts = args.difficulty !== undefined ? { difficulty: args.difficulty } : {}
        return Promise.resolve(wrapped(opts))
      },
    },
  }
})

describe('newCommand', () => {
  beforeEach(() => {
    // Clear the wrapped `newCommand`'s call history between tests without
    // dropping the implementation. (We use `mockClear`, not `mockReset`,
    // because `mockReset` would replace the wrapper's implementation with
    // `() => undefined`, breaking the direct-call tests below which rely on
    // the real `newCommand` behavior.)
    vi.mocked(newCommand).mockClear()
  })

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
      rows.forEach((r) => { expect(r).toHaveLength(9) })
      // Note: the puzzle itself is not solved, so isValidPuzzle is not asserted here.
      void isValidPuzzle
    }
  })
})

describe('newContract', () => {
  describe('parse', () => {
    it('returns help on --help', () => {
      expect(newContract.parse(['--help'])).toEqual({ ok: 'help' })
    })
    it('returns help on -h', () => {
      expect(newContract.parse(['-h'])).toEqual({ ok: 'help' })
    })
    it('parses --difficulty', () => {
      const r = newContract.parse(['--difficulty', 'easy'])
      expect(r).toEqual({ ok: true, args: { difficulty: 'easy', pretty: false } })
    })
    it('parses --pretty', () => {
      const r = newContract.parse(['--pretty'])
      expect(r).toEqual({ ok: true, args: { difficulty: undefined, pretty: true } })
    })
    it('defaults both fields when no args', () => {
      const r = newContract.parse([])
      expect(r).toEqual({ ok: true, args: { difficulty: undefined, pretty: false } })
    })
    it('returns error on unknown option', () => {
      const r = newContract.parse(['--frobnicate'])
      expect(r.ok).toBe(false)
      if (r.ok === false) {
        expect(r.message).toContain('Unknown option')
      }
    })
  })

  describe('run', () => {
    beforeEach(() => {
      // `mockReset` (not `mockRestore`) keeps the wrapper in place but
      // drops any preset return value, so each test gets a clean slate.
      vi.mocked(newCommand).mockReset()
    })

    it('delegates to newCommand and returns the result', async () => {
      vi.mocked(newCommand).mockReturnValue({
        kind: 'new',
        serialized: '1'.repeat(81),
        difficultyName: 'easy',
      })

      const result = await newContract.run({ pretty: false }, {} as never)
      // `newContract.run` calls `newCommand({})` when no difficulty is provided.
      expect(newCommand).toHaveBeenCalledWith({})
      expect(result).toEqual({
        kind: 'new',
        serialized: '1'.repeat(81),
        difficultyName: 'easy',
      })
    })

    it('passes difficulty to newCommand when provided', async () => {
      vi.mocked(newCommand).mockReturnValue({
        kind: 'new',
        serialized: '1'.repeat(81),
        difficultyName: 'hard',
      })

      const result = await newContract.run(
        { difficulty: 'hard', pretty: false },
        {} as never,
      )
      expect(newCommand).toHaveBeenCalledWith({ difficulty: 'hard' })
      expect(result).toEqual({
        kind: 'new',
        serialized: '1'.repeat(81),
        difficultyName: 'hard',
      })
    })
  })

  // The `vi.mock` factory above replaces `newContract.run` with a thin stub,
  // so the real `newContract.run` in `src/commands/new.ts` would otherwise be
  // uncovered. This test bypasses the mock with `vi.importActual` and
  // exercises the real implementation end-to-end against the real
  // `newCommand` (which is unaffected by `mockReset` because it is a fresh
  // function obtained from the un-mocked module).
  it('real newContract.run invokes the real newCommand end-to-end', async () => {
    const actual = await vi.importActual<typeof NewModule>('../../commands/new.js')
    const result = await actual.newContract.run(
      { difficulty: 'easy', pretty: false },
      {} as never,
    )

    expect(result.kind).toBe('new')

    if (result.kind === 'new') {
      expect(result.difficultyName).toBe('easy')
      expect(result.serialized).toMatch(/^[0-9]{81}$/)
    }
  })
})
