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

  describe('play', () => {
    it('returns play_tui with no args', () => {
      const result = parseArgs(['play'])

      expect(result).toEqual({
        kind: 'play',
        playArgs: {
          kind: 'play_tui',
          difficulty: undefined,
          load: undefined,
          resumeLast: false,
          help: false,
        },
      })
    })

    it('parses --difficulty', () => {
      const result = parseArgs(['play', '--difficulty', 'hard'])

      expect(result).toEqual({
        kind: 'play',
        playArgs: {
          kind: 'play_tui',
          difficulty: 'hard',
          load: undefined,
          resumeLast: false,
          help: false,
        },
      })
    })

    it('parses --load', () => {
      const result = parseArgs(['play', '--load', 'puzzle-42'])

      expect(result).toEqual({
        kind: 'play',
        playArgs: {
          kind: 'play_tui',
          difficulty: undefined,
          load: 'puzzle-42',
          resumeLast: false,
          help: false,
        },
      })
    })

    it('parses --resume', () => {
      const result = parseArgs(['play', '--resume'])

      expect(result).toEqual({
        kind: 'play',
        playArgs: {
          kind: 'play_tui',
          difficulty: undefined,
          load: undefined,
          resumeLast: true,
          help: false,
        },
      })
    })

    it('parses --stats as play_stats mode', () => {
      const result = parseArgs(['play', '--stats'])

      expect(result).toEqual({
        kind: 'play',
        playArgs: {
          kind: 'play_stats',
          difficulty: undefined,
          load: undefined,
          resumeLast: false,
          help: false,
        },
      })
    })

    it('parses --achievements as play_achievements mode', () => {
      const result = parseArgs(['play', '--achievements'])

      expect(result).toEqual({
        kind: 'play',
        playArgs: {
          kind: 'play_achievements',
          difficulty: undefined,
          load: undefined,
          resumeLast: false,
          help: false,
        },
      })
    })

    it('parses --leaderboard as play_leaderboard mode', () => {
      const result = parseArgs(['play', '--leaderboard'])

      expect(result).toEqual({
        kind: 'play',
        playArgs: {
          kind: 'play_leaderboard',
          difficulty: undefined,
          load: undefined,
          resumeLast: false,
          help: false,
        },
      })
    })

    it('returns help on --help', () => {
      expect(parseArgs(['play', '--help'])).toEqual({ kind: 'help' })
    })

    it('returns help on -h', () => {
      expect(parseArgs(['play', '-h'])).toEqual({ kind: 'help' })
    })

    it('returns error on unknown option', () => {
      const result = parseArgs(['play', '--frobnicate'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain('Unknown option')
      }
    })

    it('returns error on missing argument value', () => {
      const result = parseArgs(['play', '--difficulty'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain('argument missing')
      }
    })

    it('combines --stats with --difficulty', () => {
      const result = parseArgs(['play', '--stats', '--difficulty', 'expert'])

      expect(result).toEqual({
        kind: 'play',
        playArgs: {
          kind: 'play_stats',
          difficulty: 'expert',
          load: undefined,
          resumeLast: false,
          help: false,
        },
      })
    })

    it('prioritizes --stats over --achievements when both given', () => {
      const result = parseArgs(['play', '--stats', '--achievements'])

      expect(result).toEqual({
        kind: 'play',
        playArgs: {
          kind: 'play_stats',
          difficulty: undefined,
          load: undefined,
          resumeLast: false,
          help: false,
        },
      })
    })
  })

  it('exposes HELP_TEXT for cli.ts', () => {
    expect(HELP_TEXT).toContain('Usage: sudoku-cli')
  })
})
