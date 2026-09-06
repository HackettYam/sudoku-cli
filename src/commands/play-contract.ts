import { parseArgs as parseUtilArgs } from 'node:util'

import { errorMessage } from './_error-message.js'
import type { CommandContract, ParseResult } from './contract.js'
import { playAchievementsCommand } from './play-achievements.js'
import { playLeaderboardCommand } from './play-leaderboard.js'
import { playStatsCommand } from './play-stats.js'
import { playCommand } from './play.js'
import type { CommandResult } from './result.js'

/**
 * The `play` subcommand contract.
 *
 * @see requirements.md AC-2, AC-5
 * @see design.md D2, D6
 */
type PlayContractArgs = {
  readonly kind: 'play_tui' | 'play_stats' | 'play_achievements' | 'play_leaderboard'
  readonly difficulty?: string
  readonly load?: string
  readonly resumeLast?: boolean
  readonly help?: boolean
}

type PlayValues = Record<string, string | boolean | (string | boolean)[] | undefined>

/** Select the play sub-mode represented by parsed flags. */
function getPlayKind(values: PlayValues): PlayContractArgs['kind'] {
  if (values.stats === true) {
    return 'play_stats'
  }
  if (values.achievements === true) {
    return 'play_achievements'
  }
  if (values.leaderboard === true) {
    return 'play_leaderboard'
  }
  return 'play_tui'
}

/** Build the typed play arguments without retaining absent optional flags. */
function buildPlayArgs(values: PlayValues): PlayContractArgs {
  const args: {
    kind: PlayContractArgs['kind']
    resumeLast: boolean
    help: boolean
    difficulty?: string
    load?: string
  } = {
    kind: getPlayKind(values),
    resumeLast: values.resume === true,
    help: values.help === true,
  }

  if (typeof values.difficulty === 'string') {
    args.difficulty = values.difficulty
  }
  if (typeof values.load === 'string') {
    args.load = values.load
  }

  return args
}

/** Parse play flags and convert them to the command's typed argument shape. */
function parsePlayOptions(rest: readonly string[]): ParseResult<PlayContractArgs> {
  let parsed: ReturnType<typeof parseUtilArgs>

  try {
    parsed = parseUtilArgs({
      args: [...rest],
      options: {
        difficulty:   { type: 'string' },
        load:         { type: 'string' },
        resume:       { type: 'boolean' },
        stats:        { type: 'boolean' },
        achievements: { type: 'boolean' },
        leaderboard:  { type: 'boolean' },
        help:         { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    })
  } catch (cause) {
    return { ok: false, message: errorMessage(cause) }
  }

  return { ok: true, args: buildPlayArgs(parsed.values) }
}

/**
 * `play` subcommand: interactive Sudoku TUI session with optional
 * stats / achievements / leaderboard sub-modes.
 *
 * @see requirements.md AC-2
 * @see design.md Decision 2 (sub-mode dispatch lives in the contract's `run`)
 */
export const playContract: CommandContract<PlayContractArgs> = {
  name: 'play',
  summary: 'Start an interactive game (TUI)',
  description: 'Start an interactive Sudoku game in the terminal.',
  footer: 'Difficulty levels: novice, easy, normal, hard, expert (default: normal)',
  options: {
    difficulty:   { type: 'string',  desc: 'Start a new game at the given difficulty' },
    load:         { type: 'string',  desc: 'Load a saved game by ID' },
    resume:       { type: 'boolean', desc: 'Resume the most recent saved game' },
    stats:        { type: 'boolean', desc: 'Show statistics grouped by difficulty' },
    achievements: { type: 'boolean', desc: 'List unlocked and locked achievements' },
    leaderboard:  { type: 'boolean', desc: 'Show fastest solves and fewest moves' },
    help:         { type: 'boolean', short: 'h', desc: 'Show this help' },
  },
  parse(rest): ParseResult<PlayContractArgs> {
    if (rest.includes('--help') || rest.includes('-h')) {
      return { ok: 'help' }
    }
    return parsePlayOptions(rest)
  },
  async run(args, ctx): Promise<CommandResult> {
    switch (args.kind) {
      case 'play_tui': {
        const result = await playCommand(
          {
            difficulty: args.difficulty,
            loadId: args.load,
            resumeLast: args.resumeLast,
          },
          { io: ctx.io, persistence: ctx.persistence },
        )
        return {
          kind: 'play_exit',
          reason: result.reason,
          ...(result.message !== undefined ? { message: result.message } : {}),
        }
      }
      case 'play_stats': {
        const result = await playStatsCommand()
        return { kind: 'play_stats', lines: result.lines }
      }
      case 'play_achievements': {
        const result = await playAchievementsCommand()
        return { kind: 'play_achievements', lines: result.lines }
      }
      case 'play_leaderboard': {
        const result = await playLeaderboardCommand()
        return { kind: 'play_leaderboard', lines: result.lines }
      }
    }
  },
}
