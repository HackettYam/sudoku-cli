import { getHint, solvePuzzle } from '@hackettyam/sudoku-tools'
import { parseBoard } from '../format/board-string.js'
import type { CommandResult } from './result.js'

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
