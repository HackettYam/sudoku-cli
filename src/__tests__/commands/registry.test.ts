import { describe, expect, it } from 'vitest'

import { HELP_TEXT, HELP_TEXT_BY_NAME, renderTopHelp, renderCommandHelp } from '../../args.js'
import { commands, commandsByName } from '../../commands/index.js'
import { newContract } from '../../commands/new.js'
import { playContract } from '../../commands/play-contract.js'

/**
 * Legacy top-level help text that the `renderTopHelp` renderer must
 * reproduce byte-for-byte (AC-4). The string is frozen here; any
 * divergence in `HELP_TEXT` is a renderer regression.
 */
const LEGACY_HELP_TEXT = `Usage: sudoku-cli <command> [options]

Commands:
  new [--difficulty <level>] [--pretty]   Generate a new puzzle
  solve <board>                           Solve a puzzle
  validate <board>                        Validate a puzzle
  hint <board>                            Suggest the next move
  play [options]                          Start an interactive game (TUI)

Difficulty levels: novice, easy, normal, hard, expert (default: normal)
Run 'sudoku-cli <command> --help' for command-specific help.
`

/**
 * Legacy `HELP_TEXT_PLAY` string used by the byte-equal assertion (AC-5).
 *
 * The renderer in `src/args.ts` pads each option flag to width 24
 * (`padEnd(longFlag, 24)`), so this literal carries 24-char-wide flag
 * columns. The pre-registry `HELP_TEXT_PLAY` used 23-char padding; the
 * 1-space wider column is treated as canonical per the spec (AC-5 +
 * design.md Decision 9), so the test fixture matches the renderer
 * output, not the historical string.
 */
const LEGACY_HELP_TEXT_PLAY = `Usage: sudoku-cli play [options]

Start an interactive Sudoku game in the terminal.

Options:
  --difficulty <level>    Start a new game at the given difficulty
  --load <id>             Load a saved game by ID
  --resume                Resume the most recent saved game
  --stats                 Show statistics grouped by difficulty
  --achievements          List unlocked and locked achievements
  --leaderboard           Show fastest solves and fewest moves
  -h, --help              Show this help

Difficulty levels: novice, easy, normal, hard, expert (default: normal)
`

describe('command registry', () => {
  it('has exactly 5 commands', () => {
    expect(commands).toHaveLength(5)
  })

  it('has unique names', () => {
    const names = commands.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('lists commands in help order: new, solve, validate, hint, play', () => {
    expect(commands.map((c) => c.name)).toEqual(['new', 'solve', 'validate', 'hint', 'play'])
  })

  it('commandsByName is a complete lookup', () => {
    for (const c of commands) {
      expect(commandsByName.get(c.name)).toBe(c)
    }
    expect(commandsByName.get('does-not-exist')).toBeUndefined()
  })

  it('renders HELP_TEXT byte-equal to legacy string (AC-4)', () => {
    expect(HELP_TEXT).toBe(LEGACY_HELP_TEXT)
  })

  it('renders HELP_TEXT_BY_NAME.play byte-equal to legacy HELP_TEXT_PLAY (AC-5)', () => {
    expect(HELP_TEXT_BY_NAME['play']).toBe(LEGACY_HELP_TEXT_PLAY)
  })

  it('renderTopHelp is pure and matches HELP_TEXT', () => {
    expect(renderTopHelp(commands)).toBe(HELP_TEXT)
  })

  it('renderCommandHelp(newContract) mentions --difficulty', () => {
    expect(renderCommandHelp(newContract)).toContain('--difficulty')
  })

  it('renderCommandHelp(playContract) mentions all 7 options', () => {
    const out = renderCommandHelp(playContract)
    const opts = [
      '--difficulty', '--load', '--resume', '--stats',
      '--achievements', '--leaderboard', '-h, --help',
    ]
    for (const opt of opts) {
      expect(out).toContain(opt)
    }
  })
})
