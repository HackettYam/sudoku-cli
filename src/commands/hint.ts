import { parseArgs as parseUtilArgs } from 'node:util'

import { errorMessage } from './_error-message.js'
import type { CommandContract, CommandContext, ParseResult } from './contract.js'
import type { CommandResult } from './result.js'
import { parseBoard } from '../format/board-string.js'
import { getHint, solvePuzzle } from '../sudoku-tools.js'

/**
 * Suggests the next move on a user-supplied board.
 *
 * Internally solves the puzzle first to obtain the target solution, then
 * returns the first empty cell with its correct value. This is more
 * expensive than a hypothetical seeded hint but works for any valid input.
 *
 * @param input - Raw CLI input; whitespace is stripped before validation.
 * @returns `hint` with `row`, `col`, and `value`; `no_hint` if the puzzle
 *          is already complete; `unsolvable` if the puzzle has no solution;
 *          or `parse_error` on bad input.
 *
 * @example
 * hintCommand('530070000600195000098000060800060003400803001700020006060000280000419005000080079')
 */
export function hintCommand(input: string): CommandResult {
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

  const hint = getHint(board, solution)

  if (hint === null) {
    return { kind: 'no_hint' }
  }

  return { kind: 'hint', row: hint.row, col: hint.col, value: hint.value }
}

/**
 * Parsed args shape for the `hint` contract.
 *
 * The single positional `board` is an 81-char digit string; whitespace is
 * stripped by `parseBoard` inside `hintCommand`.
 */
export interface HintArgs {
  readonly board: string
}

/**
 * Contract for the `hint` subcommand.
 *
 * Accepts exactly one positional (the 81-char board string) and no
 * options. The `parse` method strips `--help`/`-h` before delegating to
 * `parseUtilArgs` (configured `strict: true` with `options: {}`); unknown
 * flags therefore surface as parse errors via `errorMessage`.
 *
 * @see requirements.md AC-2
 * @see design.md Interfaces
 * @see tasks.md T-005
 */
export const hintContract: CommandContract<HintArgs> = {
  name: 'hint',
  summary: 'Suggest the next move',
  options: {},
  positional: { name: 'board', required: true, desc: '81-char board string' },
  parse(rest: readonly string[]): ParseResult<HintArgs> {
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
      return { ok: false, message: "'hint' requires a board string argument." }
    }

    return { ok: true, args: { board } }
  },
  run(args: HintArgs, _ctx: CommandContext): Promise<CommandResult> {
    return Promise.resolve(hintCommand(args.board))
  },
}
