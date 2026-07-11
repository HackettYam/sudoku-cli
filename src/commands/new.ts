import { parseArgs as parseUtilArgs } from 'node:util'
import { createSudoku, serializeBoard } from '@hackettyam/sudoku-tools'
import { parseDifficulty, difficultyToName } from '../format/difficulty.js'
import { errorMessage } from './_error-message.js'
import type { CommandContract, CommandContext, ParseResult } from './contract.js'
import type { CommandResult } from './result.js'

/**
 * Options accepted by the `new` subcommand.
 */
export interface NewOptions {
  /** Raw difficulty flag value (case-insensitive). `undefined` ⇒ default. */
  difficulty?: string
}

/**
 * Parsed args shape for the `new` contract.
 *
 * `pretty` is a CLI-rendering flag consumed by `cli.ts` (via object spread
 * before calling `run`); `run` itself only receives the library-level
 * `difficulty` field.
 */
export interface NewArgs {
  readonly difficulty?: string | undefined
  readonly pretty: boolean
}

/**
 * Generates a new Sudoku puzzle at the requested difficulty.
 *
 * @param options - Optional difficulty flag value.
 * @returns A `new` result carrying the serialized puzzle and difficulty name,
 *          or `parse_error` if the difficulty flag is invalid.
 *
 * @example
 * newCommand({ difficulty: 'hard' })
 */
export function newCommand(options: NewOptions = {}): CommandResult {
  let difficulty: ReturnType<typeof parseDifficulty>

  try {
    difficulty = parseDifficulty(options.difficulty)
  } catch (cause) {
    return {
      kind: 'parse_error',
      reason: cause instanceof Error ? cause.message : String(cause),
    }
  }

  const puzzle = createSudoku(difficulty)

  return {
    kind: 'new',
    serialized: serializeBoard(puzzle.original),
    difficultyName: difficultyToName(difficulty),
  }
}

/**
 * Contract for the `new` subcommand.
 *
 * The `parse` method strips `--help`/`-h` before delegating to
 * `parseUtilArgs` (which is configured `strict: true`); the contract's
 * `options` metadata intentionally omits `help` so the help-text renderer
 * does not advertise it for this command.
 *
 * @see requirements.md AC-3
 * @see design.md D1, D2, D3
 * @see tasks.md T-002
 */
export const newContract: CommandContract<NewArgs> = {
  name: 'new',
  summary: 'Generate a new puzzle',
  options: {
    difficulty: { type: 'string', desc: 'Difficulty level' },
    pretty: { type: 'boolean', desc: 'Print a 9x9 ASCII grid to stderr' },
  },
  parse(rest: readonly string[]): ParseResult<NewArgs> {
    if (rest.includes('--help') || rest.includes('-h')) {
      return { ok: 'help' }
    }

    let parsed: ReturnType<typeof parseUtilArgs>

    try {
      parsed = parseUtilArgs({
        args: [...rest],
        options: {
          difficulty: { type: 'string' },
          pretty: { type: 'boolean' },
        },
        allowPositionals: true,
        strict: true,
      })
    } catch (cause) {
      return { ok: false, message: errorMessage(cause) }
    }

    return {
      ok: true,
      args: {
        difficulty: typeof parsed.values.difficulty === 'string'
          ? parsed.values.difficulty
          : undefined,
        pretty: parsed.values.pretty === true,
      },
    }
  },
  run(args: NewArgs, _ctx: CommandContext): Promise<CommandResult> {
    return Promise.resolve(
      newCommand(args.difficulty !== undefined ? { difficulty: args.difficulty } : {}),
    )
  },
}
