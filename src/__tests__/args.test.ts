import { describe, expect, it } from 'vitest'

import { parseArgs, HELP_TEXT, HELP_TEXT_BY_NAME } from '../args.js'

const BOARD = '1'.repeat(81)

describe('parseArgs', () => {
  describe('top-level', () => {
    it.each([
      { argv: [], desc: 'no args' },
      { argv: ['--help'], desc: '--help' },
      { argv: ['-h'], desc: '-h' },
    ])('returns top_help on $desc', ({ argv }) => {
      expect(parseArgs(argv)).toEqual({ kind: 'top_help' })
    })

    it.each([
      { argv: ['--version'], desc: '--version' },
      { argv: ['-v'], desc: '-v' },
    ])('returns error (handled by bin wrapper) on $desc', ({ argv }) => {
      expect(parseArgs(argv)).toEqual({ kind: 'error', message: 'handled by bin wrapper' })
    })

    it('returns error on unknown subcommand', () => {
      expect(parseArgs(['frobnicate'])).toEqual({
        kind: 'error',
        message: "Unknown command: 'frobnicate'. Run 'sudoku-cli --help'.",
      })
    })
  })

  describe('new', () => {
    it('parses --difficulty', () => {
      expect(parseArgs(['new', '--difficulty', 'hard'])).toEqual({
        kind: 'cmd',
        command: 'new',
        args: { difficulty: 'hard', pretty: false },
      })
    })

    it('parses --pretty', () => {
      expect(parseArgs(['new', '--pretty'])).toEqual({
        kind: 'cmd',
        command: 'new',
        args: { difficulty: undefined, pretty: true },
      })
    })

    it('returns cmd_help on -h', () => {
      expect(parseArgs(['new', '-h'])).toEqual({
        kind: 'cmd_help',
        command: 'new',
        helpText: HELP_TEXT_BY_NAME['new'],
      })
    })

    it.each([
      { argv: ['new', '--frobnicate'], desc: 'unknown option' },
      { argv: ['new', '--difficulty'], desc: 'missing --difficulty value' },
    ])('returns error on $desc', ({ argv }) => {
      const result = parseArgs(argv)

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toMatch(/Unknown option|argument missing/)
      }
    })
  })

  describe.each([
    { cmd: 'solve', missingMsg: "'solve' requires a board string argument." },
    { cmd: 'validate', missingMsg: "'validate' requires a board string argument." },
    { cmd: 'hint', missingMsg: "'hint' requires a board string argument." },
  ])('$cmd', ({ cmd, missingMsg }) => {
    it('parses board positional', () => {
      expect(parseArgs([cmd, BOARD])).toEqual({
        kind: 'cmd',
        command: cmd,
        args: { board: BOARD },
      })
    })

    it('returns cmd_help on -h', () => {
      expect(parseArgs([cmd, '-h'])).toEqual({
        kind: 'cmd_help',
        command: cmd,
        helpText: HELP_TEXT_BY_NAME[cmd],
      })
    })

    it('returns error when board is missing', () => {
      expect(parseArgs([cmd])).toEqual({ kind: 'error', message: missingMsg })
    })
  })

  describe('solve', () => {
    it('returns error on unknown option', () => {
      const result = parseArgs(['solve', BOARD, '--frobnicate'])

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toContain('Unknown option')
      }
    })
  })

  describe('play', () => {
    it('returns play_tui with no args', () => {
      expect(parseArgs(['play'])).toEqual({
        kind: 'cmd',
        command: 'play',
        args: { kind: 'play_tui', resumeLast: false, help: false },
      })
    })

    it('parses --difficulty', () => {
      expect(parseArgs(['play', '--difficulty', 'hard'])).toEqual({
        kind: 'cmd',
        command: 'play',
        args: { kind: 'play_tui', difficulty: 'hard', resumeLast: false, help: false },
      })
    })

    it('parses --load', () => {
      expect(parseArgs(['play', '--load', 'puzzle-42'])).toEqual({
        kind: 'cmd',
        command: 'play',
        args: { kind: 'play_tui', load: 'puzzle-42', resumeLast: false, help: false },
      })
    })

    it('parses --resume', () => {
      expect(parseArgs(['play', '--resume'])).toEqual({
        kind: 'cmd',
        command: 'play',
        args: { kind: 'play_tui', resumeLast: true, help: false },
      })
    })

    it.each([
      { argv: ['play', '--stats'], kind: 'play_stats' },
      { argv: ['play', '--achievements'], kind: 'play_achievements' },
      { argv: ['play', '--leaderboard'], kind: 'play_leaderboard' },
    ])('parses $argv[1] as $kind mode', ({ argv, kind }) => {
      expect(parseArgs(argv)).toEqual({
        kind: 'cmd',
        command: 'play',
        args: { kind, resumeLast: false, help: false },
      })
    })

    it.each([
      { argv: ['play', '--help'] },
      { argv: ['play', '-h'] },
    ])('returns cmd_help on $argv[1]', ({ argv }) => {
      expect(parseArgs(argv)).toEqual({
        kind: 'cmd_help',
        command: 'play',
        helpText: HELP_TEXT_BY_NAME['play'],
      })
    })

    it.each([
      { argv: ['play', '--frobnicate'] },
      { argv: ['play', '--difficulty'] },
    ])('returns error on $argv[1]', ({ argv }) => {
      const result = parseArgs(argv)

      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.message).toMatch(/Unknown option|argument missing/)
      }
    })

    it('combines --stats with --difficulty', () => {
      expect(parseArgs(['play', '--stats', '--difficulty', 'expert'])).toEqual({
        kind: 'cmd',
        command: 'play',
        args: { kind: 'play_stats', difficulty: 'expert', resumeLast: false, help: false },
      })
    })

    it('prioritizes --stats over --achievements when both given', () => {
      expect(parseArgs(['play', '--stats', '--achievements'])).toEqual({
        kind: 'cmd',
        command: 'play',
        args: { kind: 'play_stats', resumeLast: false, help: false },
      })
    })
  })
})

describe('HELP_TEXT content', () => {
  it('starts with the usage line', () => {
    expect(HELP_TEXT.startsWith('Usage: sudoku-cli <command> [options]')).toBe(true)
  })

  it('lists all five subcommands', () => {
    for (const cmd of ['new ', 'solve ', 'validate ', 'hint ', 'play ']) {
      expect(HELP_TEXT).toContain(cmd)
    }
  })

  it('mentions difficulty levels', () => {
    expect(HELP_TEXT).toContain('Difficulty levels: novice, easy, normal, hard, expert (default: normal)')
  })

  it('ends with a help hint', () => {
    expect(HELP_TEXT).toContain("Run 'sudoku-cli <command> --help' for command-specific help.")
  })
})
