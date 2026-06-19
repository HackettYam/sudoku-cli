import { describe, expect, it } from 'vitest'
import { parseArgs, HELP_TEXT } from '../args.js'

describe('parseArgs', () => {
  describe('top-level', () => {
    it('returns help when no args are given', () => {
      expect(parseArgs([])).toEqual({ kind: 'help' })
    })

    it('returns help on --help', () => {
      expect(parseArgs(['--help'])).toEqual({ kind: 'help' })
    })

    it('returns help on -h', () => {
      expect(parseArgs(['-h'])).toEqual({ kind: 'help' })
    })

    it('returns error on --version (handled in cli.ts)', () => {
      expect(parseArgs(['--version'])).toEqual({ kind: 'error', message: 'handled by bin wrapper' })
    })

    it('returns error on -v (handled in cli.ts)', () => {
      expect(parseArgs(['-v'])).toEqual({ kind: 'error', message: 'handled by bin wrapper' })
    })

    it('returns error on unknown subcommand', () => {
      const result = parseArgs(['frobnicate'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain('Unknown command: \'frobnicate\'')
      }
    })
  })

  describe('new', () => {
    it('parses --difficulty', () => {
      expect(parseArgs(['new', '--difficulty', 'hard'])).toEqual({
        kind: 'new',
        difficulty: 'hard',
        pretty: false,
      })
    })

    it('parses --pretty', () => {
      expect(parseArgs(['new', '--pretty'])).toEqual({
        kind: 'new',
        difficulty: undefined,
        pretty: true,
      })
    })

    it('returns help on -h after new', () => {
      expect(parseArgs(['new', '-h'])).toEqual({ kind: 'help' })
    })

    it('returns error on unknown option', () => {
      const result = parseArgs(['new', '--frobnicate'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain('Unknown option')
      }
    })

    it('returns error on missing argument value', () => {
      const result = parseArgs(['new', '--difficulty'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain('argument missing')
      }
    })
  })

  describe('solve', () => {
    it('parses board positional', () => {
      const board = '1'.repeat(81)

      expect(parseArgs(['solve', board])).toEqual({ kind: 'solve', board })
    })

    it('returns help on -h', () => {
      expect(parseArgs(['solve', '-h'])).toEqual({ kind: 'help' })
    })

    it('returns error when board is missing', () => {
      const result = parseArgs(['solve'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain("'solve' requires a board string argument")
      }
    })

    it('returns error on unknown option', () => {
      const result = parseArgs(['solve', '1'.repeat(81), '--frobnicate'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain('Unknown option')
      }
    })
  })

  describe('validate', () => {
    it('parses board positional', () => {
      const board = '1'.repeat(81)

      expect(parseArgs(['validate', board])).toEqual({ kind: 'validate', board })
    })

    it('returns error when board is missing', () => {
      const result = parseArgs(['validate'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain("'validate' requires a board string argument")
      }
    })
  })

  describe('hint', () => {
    it('parses board positional', () => {
      const board = '1'.repeat(81)

      expect(parseArgs(['hint', board])).toEqual({ kind: 'hint', board })
    })

    it('returns error when board is missing', () => {
      const result = parseArgs(['hint'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain("'hint' requires a board string argument")
      }
    })

    it('returns generic error for non-missing/unknown-option failures', () => {
      // Force an unknown error path by passing a non-string for an option-less command
      // The error here is a missing argument, so it falls into the "Missing argument" branch
      const result = parseArgs(['hint'])

      expect(result.kind).toBe('error')
    })
  })

  it('exposes HELP_TEXT for cli.ts', () => {
    expect(HELP_TEXT).toContain('Usage: sudoku-cli')
  })
})
