import { parseArgs as parseUtilArgs } from 'node:util'

/**
 * Discriminator for CLI subcommands.
 */
export type Subcommand = 'new' | 'solve' | 'validate' | 'hint' | 'play'

/**
 * Parsed, type-safe CLI arguments.
 *
 * Exactly one of the subcommand fields is set.
 */
export type ParsedArgs =
  | { kind: 'new'; difficulty: string | undefined; pretty: boolean }
  | { kind: 'solve'; board: string }
  | { kind: 'validate'; board: string }
  | { kind: 'hint'; board: string }
  | { kind: 'play'; playArgs: PlayArgs }
  | { kind: 'help' }
  | { kind: 'error'; message: string }

/**
 * Parsed play subcommand arguments.
 */
export interface PlayArgs {
  /** The play mode to launch. */
  readonly kind: 'play_tui' | 'play_stats' | 'play_achievements' | 'play_leaderboard'
  /** Optional difficulty level. */
  readonly difficulty?: string | undefined
  /** Optional puzzle ID to load. */
  readonly load?: string | undefined
  /** Resume the last played puzzle. */
  readonly resumeLast?: boolean | undefined
  /** Show help text. */
  readonly help?: boolean | undefined
}

/**
 * Top-level CLI usage text, printed for `--help` and on error.
 */
export const HELP_TEXT = `Usage: sudoku-cli <command> [options]

Commands:
  new [--difficulty <level>] [--pretty]   Generate a new puzzle
  solve <board>                           Solve a puzzle
  validate <board>                        Validate a puzzle
  hint <board>                            Suggest the next move

Difficulty levels: novice, easy, normal, hard, expert (default: normal)
Run 'sudoku-cli <command> --help' for command-specific help.
`

/**
 * Parses the process argv vector (excluding `node` and script path).
 *
 * @param argv - Typically `process.argv.slice(2)`.
 * @returns A {@link ParsedArgs} discriminated union.
 *
 * @example
 * parseArgs(['new', '--difficulty', 'hard'])
 * // { kind: 'new', difficulty: 'hard', pretty: false }
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const subcommand = argv[0]

  if (subcommand === undefined || subcommand === '--help' || subcommand === '-h') {
    return { kind: 'help' }
  }

  if (subcommand === '--version' || subcommand === '-v') {
    return { kind: 'error', message: 'handled by bin wrapper' }
  }

  switch (subcommand) {
    case 'new': return parseNewArgs(argv.slice(1))
    case 'solve': return parseBoardArg('solve', argv.slice(1))
    case 'validate': return parseBoardArg('validate', argv.slice(1))
    case 'hint': return parseBoardArg('hint', argv.slice(1))
    case 'play': return parsePlayArgs(argv.slice(1))
    default:
      return { kind: 'error', message: `Unknown command: '${subcommand}'. Run 'sudoku-cli --help'.` }
  }
}

function parseNewArgs(rest: readonly string[]): ParsedArgs {
  let parsed: ReturnType<typeof parseUtilArgs>

  try {
    parsed = parseUtilArgs({
      args: [...rest],
      options: {
        difficulty: { type: 'string' },
        pretty: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    })
  } catch (cause) {
    return { kind: 'error', message: errorMessage(cause) }
  }

  if (parsed.values.help === true) {
    return { kind: 'help' }
  }

  return {
    kind: 'new',
    difficulty: typeof parsed.values.difficulty === 'string' ? parsed.values.difficulty : undefined,
    pretty: parsed.values.pretty === true,
  }
}

function parseBoardArg(
  command: 'solve' | 'validate' | 'hint',
  rest: readonly string[],
): ParsedArgs {
  let parsed: ReturnType<typeof parseUtilArgs>

  try {
    parsed = parseUtilArgs({
      args: [...rest],
      options: {
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    })
  } catch (cause) {
    return { kind: 'error', message: errorMessage(cause) }
  }

  if (parsed.values.help === true) {
    return { kind: 'help' }
  }

  const positional = parsed.positionals[0]

  if (positional === undefined) {
    return { kind: 'error', message: `'${command}' requires a board string argument.` }
  }

  return { kind: command, board: positional }
}

function errorMessage(cause: unknown): string {
  const msg = cause instanceof Error ? cause.message : String(cause)

  if (msg.includes('argument missing')) {
    return `${msg}. Run 'sudoku-cli --help'.`
  }

  return `Invalid arguments: ${msg}. Run 'sudoku-cli --help'.`
}

/**
 * Parses the `play` subcommand arguments.
 *
 * @param rest - argv after the `play` subcommand.
 * @returns A {@link ParsedArgs} with play-specific options.
 */
function parsePlayArgs(rest: readonly string[]): ParsedArgs {
  let parsed: ReturnType<typeof parseUtilArgs>

  try {
    parsed = parseUtilArgs({
      args: [...rest],
      options: {
        difficulty: { type: 'string' },
        load: { type: 'string' },
        resume: { type: 'boolean' },
        stats: { type: 'boolean' },
        achievements: { type: 'boolean' },
        leaderboard: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    })
  } catch (cause) {
    return { kind: 'error', message: errorMessage(cause) }
  }

  if (parsed.values.help === true) {
    return { kind: 'help' }
  }

  // Determine play mode
  let kind: PlayArgs['kind'] = 'play_tui'

  if (parsed.values.stats === true) {
    kind = 'play_stats'
  } else if (parsed.values.achievements === true) {
    kind = 'play_achievements'
  } else if (parsed.values.leaderboard === true) {
    kind = 'play_leaderboard'
  }

  return {
    kind: 'play',
    playArgs: {
      kind,
      difficulty: typeof parsed.values.difficulty === 'string' ? parsed.values.difficulty : undefined,
      load: typeof parsed.values.load === 'string' ? parsed.values.load : undefined,
      resumeLast: parsed.values.resume === true,
      help: !!parsed.values.help,
    },
  }
}
