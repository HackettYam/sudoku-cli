import { isValidPuzzle } from '@hackettyam/sudoku-tools'
import { parseBoard } from '../format/board-string.js'
import type { CommandResult } from './result.js'

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
