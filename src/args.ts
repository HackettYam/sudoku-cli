import { parseArgs as parseUtilArgs } from 'node:util'

/**
 * Discriminator for CLI subcommands.
 */
export type Subcommand = 'new' | 'solve' | 'validate' | 'hint'

/**
 * Parsed, type-safe CLI arguments.
 *
 * Exactly one of the four subcommand fields is set.
 */
export type ParsedArgs =
  | { kind: 'new'; difficulty: string | undefined; pretty: boolean }
  | { kind: 'solve'; board: string }
  | { kind: 'validate'; board: string }
  | { kind: 'hint'; board: string }
  | { kind: 'help' }
  | { kind: 'error'; message: string }

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
