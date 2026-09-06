import { Difficulty, type BoardReadOnlyType, type BoardType } from '@hackettyam/sudoku-tools'

import { createGame, type GameState } from '../game/state.js'

/** Create a normal-difficulty game state with optional test overrides. */
export function makeState(overrides?: Partial<GameState>): GameState {
  const base = createGame(Difficulty.Normal)
  return { ...base, ...overrides }
}

/** Create a mutable empty nine-by-nine board for rendering tests. */
export function makeEmptyBoard(): BoardType {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(0))
}

/** Create a read-only board mask with optional editable cells. */
export function makeReadOnly(editableCells?: Array<[number, number]>): BoardReadOnlyType {
  const board = Array.from({ length: 9 }, () => Array<boolean>(9).fill(true))
  if (editableCells) {
    for (const [row, col] of editableCells) {
      const boardRow = board[row]
      if (boardRow !== undefined) {
        boardRow[col] = false
      }
    }
  }
  return board
}
