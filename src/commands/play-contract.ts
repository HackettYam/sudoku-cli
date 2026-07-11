import { parseArgs as parseUtilArgs } from 'node:util'
import { errorMessage } from './_error-message.js'
import { playCommand } from './play.js'
import { playStatsCommand } from './play-stats.js'
import { playAchievementsCommand } from './play-achievements.js'
import { playLeaderboardCommand } from './play-leaderboard.js'
import type { CommandContract, ParseResult } from './contract.js'
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

    let kind: PlayContractArgs['kind'] = 'play_tui'

    if (parsed.values.stats === true) {
      kind = 'play_stats'
    } else if (parsed.values.achievements === true) {
      kind = 'play_achievements'
    } else if (parsed.values.leaderboard === true) {
      kind = 'play_leaderboard'
    }

    const difficulty = typeof parsed.values.difficulty === 'string' ? parsed.values.difficulty : undefined
    const load = typeof parsed.values.load === 'string' ? parsed.values.load : undefined

    return {
      ok: true,
      args: {
        kind,
        ...(difficulty !== undefined ? { difficulty } : {}),
        ...(load !== undefined ? { load } : {}),
        resumeLast: parsed.values.resume === true,
        help: parsed.values.help === true,
      },
    }
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
