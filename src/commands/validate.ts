import { parseArgs as parseUtilArgs } from 'node:util'

import { isValidPuzzle } from '@hackettyam/sudoku-tools'

import { errorMessage } from './_error-message.js'
import type { CommandContract, CommandContext, ParseResult } from './contract.js'
import type { CommandResult } from './result.js'
import { parseBoard } from '../format/board-string.js'

/**
 * Validates a user-supplied Sudoku board against Sudoku rules.
 *
 * Empty cells (value 0) are ignored; the check is whether each row,
 * column, and 3x3 box contains no duplicate digits 1-9.
 *
 * @param input - Raw CLI input; whitespace is stripped before validation.
 * @returns `valid` if the board follows Sudoku rules, `invalid` with a
 *          human-readable reason otherwise, or `parse_error` on bad input.
 *
 * @example
 * validateCommand('123456789456789123789123456234567891567891234891234567345678912678912345912345678')
 */
export function validateCommand(input: string): CommandResult {
  let board: ReturnType<typeof parseBoard>

  try {
    board = parseBoard(input)
  } catch (cause) {
    return {
      kind: 'parse_error',
      reason: cause instanceof Error ? cause.message : String(cause),
    }
  }

  if (isValidPuzzle(board)) {
    return { kind: 'valid' }
  }

  return { kind: 'invalid', reason: 'Board violates Sudoku rules (duplicate digit in a row, column, or 3x3 box).' }
}

/**
 * Parsed args shape for the `validate` contract.
 *
 * The single positional `board` is an 81-char digit string; whitespace is
 * stripped by `parseBoard` inside `validateCommand`.
 */
export interface ValidateArgs {
  readonly board: string
}

/**
 * Contract for the `validate` subcommand.
 *
 * Accepts exactly one positional (the 81-char board string) and no
 * options. The `parse` method strips `--help`/`-h` before delegating to
 * `parseUtilArgs` (configured `strict: true` with `options: {}`); unknown
 * flags therefore surface as parse errors via `errorMessage`.
 *
 * @see requirements.md AC-2
 * @see design.md Interfaces
 * @see tasks.md T-004
 */
export const validateContract: CommandContract<ValidateArgs> = {
  name: 'validate',
  summary: 'Validate a puzzle',
  options: {},
  positional: { name: 'board', required: true, desc: '81-char board string' },
  parse(rest: readonly string[]): ParseResult<ValidateArgs> {
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
      return { ok: false, message: "'validate' requires a board string argument." }
    }

    return { ok: true, args: { board } }
  },
  run(args: ValidateArgs, _ctx: CommandContext): Promise<CommandResult> {
    return Promise.resolve(validateCommand(args.board))
  },
}
