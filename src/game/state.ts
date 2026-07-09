import {
  clearCell,
  cloneBoard,
  createSudoku,
  getHint,
  getInvalidCells,
  isSolved,
  setCellValue,
} from '@hackettyam/sudoku-tools'
import type {
  BoardReadOnlyType,
  BoardType,
  CellValue,
  DifficultyType,
} from '@hackettyam/sudoku-tools'

/** Immutable cell position on the board. */
export interface CellPosition {
  readonly row: number
  readonly col: number
}

/** Discriminated union of all player actions. */
export type Move =
  | { readonly kind: 'place'; readonly row: number; readonly col: number; readonly value: number }
  | { readonly kind: 'clear'; readonly row: number; readonly col: number }
  | { readonly kind: 'move-cursor'; readonly row: number; readonly col: number }
  | { readonly kind: 'undo' }
  | { readonly kind: 'hint' }
  | { readonly kind: 'new-game' }
  | { readonly kind: 'quit' }
  | { readonly kind: 'toggle-achievements' }

/** High-level game lifecycle status. */
export type GameStatus = 'playing' | 'won' | 'quit'

/** View shown on the win screen. */
export type WinView = 'menu' | 'achievements'

/** Complete immutable snapshot of the interactive game state. */
export interface GameState {
  readonly board: BoardType
  readonly solution: BoardType
  readonly original: BoardType
  readonly readOnly: BoardReadOnlyType
  readonly difficulty: DifficultyType
  readonly cursor: CellPosition
  readonly status: GameStatus
  readonly winView: WinView
  readonly history: readonly BoardType[]
  readonly moveCount: number
  readonly hintCount: number
  readonly undoCount: number
  readonly errorCount: number
  readonly startedAt: number
}

/**
 * Creates a fresh game state for the given difficulty.
 *
 * @param difficulty - The difficulty level for the new puzzle.
 * @returns A new immutable game state ready for play.
 *
 * @example
 * ```ts
 * const state = createGame(Difficulty.Normal)
 * state.status // 'playing'
 * ```
 */
export function createGame(difficulty: DifficultyType): GameState {
  const puzzle = createSudoku(difficulty)
  return {
    board: cloneBoard(puzzle.current),
    solution: cloneBoard(puzzle.solution),
    original: cloneBoard(puzzle.original),
    readOnly: puzzle.readOnly.map((row: boolean[]) => [...row]),
    difficulty,
    cursor: { row: 0, col: 0 },
    status: 'playing',
    winView: 'menu',
    history: [],
    moveCount: 0,
    hintCount: 0,
    undoCount: 0,
    errorCount: 0,
    startedAt: Date.now(),
  }
}

/**
 * Applies a player move and returns the new immutable state.
 *
 * @param state - The current game state.
 * @param move  - The player action to apply.
 * @returns A new state reflecting the move, or the same state if the move is a no-op.
 *
 * @example
 * ```ts
 * const next = applyMove(state, { kind: 'place', row: 0, col: 0, value: 5 })
 * ```
 */
export function applyMove(state: GameState, move: Move): GameState {
  switch (move.kind) {
    case 'place':
      return applyPlace(state, move.row, move.col, move.value)
    case 'clear':
      return applyClear(state, move.row, move.col)
    case 'move-cursor':
      return applyMoveCursor(state, move.row, move.col)
    case 'undo':
      return undo(state)
    case 'hint':
      return applyHint(state)
    case 'new-game':
      return applyNewGame(state)
    case 'quit':
      return { ...state, status: 'quit' }
    case 'toggle-achievements':
      return applyToggleAchievements(state)
  }
}

/**
 * Checks whether the game has been won.
 *
 * @param state - The current game state.
 * @returns `true` when `status` is `'won'`.
 *
 * @example
 * ```ts
 * if (isWon(state)) showVictoryScreen()
 * ```
 */
export function isWon(state: GameState): boolean {
  return state.status === 'won'
}

/**
 * Undoes the most recent move. Returns the state unchanged when history is empty.
 *
 * @param state - The current game state.
 * @returns The state with the last move reverted, or the same state if nothing to undo.
 *
 * @example
 * ```ts
 * const prev = undo(state)
 * ```
 */
export function undo(state: GameState): GameState {
  if (state.history.length === 0) {
    return state
  }
  const previousBoard = state.history[state.history.length - 1]
  if (previousBoard === undefined) {
    return state
  }
  const newHistory = state.history.slice(0, -1)
  return {
    ...state,
    board: previousBoard,
    history: newHistory,
    moveCount: newHistory.length,
    undoCount: state.undoCount + 1,
    errorCount: getInvalidCells(previousBoard, state.solution).length,
  }
}

/**
 * Returns whether a cell is part of the original puzzle (immutable).
 *
 * @param state - The current game state.
 * @param row   - Row index (0-8).
 * @param col   - Column index (0-8).
 * @returns `true` if the cell is read-only.
 *
 * @example
 * ```ts
 * if (isReadOnly(state, 0, 0)) console.log('Cannot edit this cell')
 * ```
 */
export function isReadOnly(state: GameState, row: number, col: number): boolean {
  return state.readOnly[row]?.[col] ?? true
}

/**
 * Returns runtime statistics for the current game.
 *
 * @param state - The current game state.
 * @returns An object with elapsed time, move counts, and error count.
 *
 * @example
 * ```ts
 * const stats = getStats(state)
 * console.log(`Moves: ${stats.moveCount}, Errors: ${stats.errorCount}`)
 * ```
 */
export function getStats(state: GameState): {
  readonly elapsedMs: number
  readonly moveCount: number
  readonly hintCount: number
  readonly undoCount: number
  readonly errorCount: number
} {
  return {
    elapsedMs: Date.now() - state.startedAt,
    moveCount: state.moveCount,
    hintCount: state.hintCount,
    undoCount: state.undoCount,
    errorCount: state.errorCount,
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Whether the given cell position is out of bounds or marked read-only. */
function isReadOnlyCell(state: GameState, row: number, col: number): boolean {
  return state.readOnly[row]?.[col] ?? true
}

/** Recompute errorCount from the current board and solution. */
function computeErrorCount(board: BoardType, solution: BoardType): number {
  return getInvalidCells(board, solution).length
}

/** Apply a `place` move. No-op if the cell is read-only. */
function applyPlace(
  state: GameState,
  row: number,
  col: number,
  value: number,
): GameState {
  if (isReadOnlyCell(state, row, col)) {
    return state
  }
  const newBoard = setCellValue(state.board, {
    row,
    col,
    value: value as CellValue,
  })
  const won = isSolved(newBoard, state.solution)
  return {
    ...state,
    board: newBoard,
    history: [...state.history, state.board],
    moveCount: state.moveCount + 1,
    errorCount: computeErrorCount(newBoard, state.solution),
    status: won ? 'won' : state.status,
  }
}

/** Apply a `clear` move. No-op if the cell is read-only. */
function applyClear(state: GameState, row: number, col: number): GameState {
  if (isReadOnlyCell(state, row, col)) {
    return state
  }
  const newBoard = clearCell(state.board, row, col)
  return {
    ...state,
    board: newBoard,
    history: [...state.history, state.board],
    moveCount: state.moveCount + 1,
    errorCount: computeErrorCount(newBoard, state.solution),
  }
}

/** Apply a `move-cursor` move. Clamps coordinates to [0, 8]. */
function applyMoveCursor(
  state: GameState,
  row: number,
  col: number,
): GameState {
  const clampedRow = Math.max(0, Math.min(8, row))
  const clampedCol = Math.max(0, Math.min(8, col))
  return {
    ...state,
    cursor: { row: clampedRow, col: clampedCol },
  }
}

/** Apply a `hint` move. Places the solution value in the first empty editable cell. */
function applyHint(state: GameState): GameState {
  if (state.status !== 'playing') {
    return state
  }
  const hint = getHint(state.board, state.solution)
  if (hint === null) {
    return state
  }
  if (isReadOnlyCell(state, hint.row, hint.col)) {
    return state
  }
  const newBoard = setCellValue(state.board, {
    row: hint.row,
    col: hint.col,
    value: hint.value,
  })
  const won = isSolved(newBoard, state.solution)
  return {
    ...state,
    board: newBoard,
    history: [...state.history, state.board],
    hintCount: state.hintCount + 1,
    errorCount: computeErrorCount(newBoard, state.solution),
    status: won ? 'won' : state.status,
  }
}

/** Apply a `new-game` move. Only allowed when status is not `'playing'`. */
function applyNewGame(state: GameState): GameState {
  if (state.status === 'playing') {
    return state
  }
  return createGame(state.difficulty)
}

/** Apply a `toggle-achievements` move. Only allowed when status is `'won'`. */
function applyToggleAchievements(state: GameState): GameState {
  if (state.status !== 'won') {
    return state
  }
  return {
    ...state,
    winView: state.winView === 'menu' ? 'achievements' : 'menu',
  }
}
