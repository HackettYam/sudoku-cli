import { parseArgs as parseUtilArgs } from 'node:util'
import { serializeBoard, solvePuzzle } from '@hackettyam/sudoku-tools'
import { parseBoard } from '../format/board-string.js'
import { errorMessage } from './_error-message.js'
import type { CommandContract, CommandContext, ParseResult } from './contract.js'
import type { CommandResult } from './result.js'

/**
 * Solves a user-supplied Sudoku board.
 *
 * @param input - Raw CLI input; whitespace is stripped before validation.
 * @returns `solved` with the serialized solved board, `unsolvable` if the
 *          puzzle has no solution, or `parse_error` on bad input.
 *
 * @example
 * solveCommand('530070000600195000098000060800060003400803001700020006060000280000419005000080079')
 */
export function solveCommand(input: string): CommandResult {
  let board: ReturnType<typeof parseBoard>

  try {
    board = parseBoard(input)
  } catch (cause) {
    return {
      kind: 'parse_error',
      reason: cause instanceof Error ? cause.message : String(cause),
    }
  }

  const solution = solvePuzzle(board)

  if (solution === null) {
    return { kind: 'unsolvable', reason: 'No solution exists for the given board.' }
  }

  return { kind: 'solved', serialized: serializeBoard(solution) }
}

/**
 * Parsed args shape for the `solve` contract.
 *
 * The single positional `board` is an 81-char digit string; whitespace is
 * stripped by `parseBoard` inside `solveCommand`.
 */
export interface SolveArgs {
  readonly board: string
}

/**
 * Contract for the `solve` subcommand.
 *
 * Accepts exactly one positional (the 81-char board string) and no
 * options. The `parse` method strips `--help`/`-h` before delegating to
 * `parseUtilArgs` (configured `strict: true` with `options: {}`); unknown
 * flags therefore surface as parse errors via `errorMessage`.
 *
 * @see requirements.md AC-2
 * @see design.md Interfaces
 * @see tasks.md T-003
 */
export const solveContract: CommandContract<SolveArgs> = {
  name: 'solve',
  summary: 'Solve a puzzle',
  options: {},
  positional: { name: 'board', required: true, desc: '81-char board string' },
  parse(rest: readonly string[]): ParseResult<SolveArgs> {
    if (rest.includes('--help') || rest.includes('-h')) {
      return { ok: 'help' }
    }

    let parsed: ReturnType<typeof parseUtilArgs>

    try {
      parsed = parseUtilArgs({
        args: [...rest],
        options: {},
        allowPositionals: true,
        strict: true,
      })
    } catch (cause) {
      return { ok: false, message: errorMessage(cause) }
    }

    const board = parsed.positionals[0]

    if (board === undefined) {
      return { ok: false, message: "'solve' requires a board string argument." }
    }

    return { ok: true, args: { board } }
  },
  run(args: SolveArgs, _ctx: CommandContext): Promise<CommandResult> {
    return Promise.resolve(solveCommand(args.board))
  },
}
