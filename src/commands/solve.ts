import { serializeBoard, solvePuzzle } from '@hackettyam/sudoku-tools'
import { parseBoard } from '../format/board-string.js'
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
