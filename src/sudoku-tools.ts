import * as sudokuToolsLibrary from '@hackettyam/sudoku-tools'
import type {
  BoardReadOnlyType,
  BoardType,
  CellValue,
  DifficultyType,
  HintResult,
  SudokuState,
} from '@hackettyam/sudoku-tools'

interface CellUpdate {
  readonly row: number
  readonly col: number
  readonly value: number
}

interface SudokuToolsApi {
  readonly clearCell: (board: BoardType, row: number, col: number) => BoardType
  readonly cloneBoard: (board: BoardType) => BoardType
  readonly createSudoku: (difficulty: DifficultyType) => SudokuState
  readonly deserializeBoard: (serialized: string) => BoardType
  readonly getHint: (board: BoardType, solved: BoardType) => HintResult | null
  readonly isSolved: (board: BoardType, solved: BoardType) => boolean
  readonly serializeBoard: (board: BoardType) => string
  readonly setCellValue: (
    board: BoardType,
    options: { readonly row: number; readonly col: number; readonly value: CellValue },
  ) => BoardType
  readonly solvePuzzle: (board: BoardType) => BoardType | null
}

/*
 * sudoku-tools@1.0.0 publishes declarations with unresolved '@/...' imports.
 * Keep the compatibility assertion at this one boundary and validate every
 * structured value returned by the library before it reaches application code.
 */
const sudokuTools: SudokuToolsApi = sudokuToolsLibrary

/**
 * Creates a new Sudoku puzzle through the typed library boundary.
 *
 * @param difficulty - Difficulty level for the generated puzzle.
 * @returns A validated Sudoku game state.
 *
 * @example
 * createSudoku('normal' as DifficultyType)
 */
export function createSudoku(difficulty: DifficultyType): SudokuState {
  return assertSudokuState(sudokuTools.createSudoku(difficulty), 'createSudoku')
}

/**
 * Creates a deep copy of a Sudoku board.
 *
 * @param board - Board to copy.
 * @returns A validated board copy.
 *
 * @example
 * cloneBoard(board)
 */
export function cloneBoard(board: BoardType): BoardType {
  return assertBoard(sudokuTools.cloneBoard(board), 'cloneBoard')
}

/**
 * Clears one cell on a Sudoku board.
 *
 * @param board - Board to update.
 * @param row - Row index.
 * @param col - Column index.
 * @returns A validated board with the cell cleared.
 *
 * @example
 * clearCell(board, 0, 0)
 */
export function clearCell(board: BoardType, row: number, col: number): BoardType {
  return assertBoard(sudokuTools.clearCell(board, row, col), 'clearCell')
}

/**
 * Sets one cell on a Sudoku board after validating the library's cell-value contract.
 *
 * @param board - Board to update.
 * @param update - Cell coordinates and value.
 * @returns A validated board with the requested value.
 * @throws RangeError if the value is not an integer from 0 through 9.
 *
 * @example
 * setCellValue(board, { row: 0, col: 0, value: 5 })
 */
export function setCellValue(board: BoardType, update: CellUpdate): BoardType {
  const nextBoard = sudokuTools.setCellValue(board, {
    row: update.row,
    col: update.col,
    value: toCellValue(update.value),
  })
  return assertBoard(nextBoard, 'setCellValue')
}

/**
 * Deserializes a board string through the typed library boundary.
 *
 * @param serialized - Serialized 81-cell board.
 * @returns A validated board.
 *
 * @example
 * deserializeBoard(serialized)
 */
export function deserializeBoard(serialized: string): BoardType {
  return assertBoard(sudokuTools.deserializeBoard(serialized), 'deserializeBoard')
}

/**
 * Solves a Sudoku board through the typed library boundary.
 *
 * @param board - Board to solve.
 * @returns A validated solved board, or `null` when no solution exists.
 *
 * @example
 * solvePuzzle(board)
 */
export function solvePuzzle(board: BoardType): BoardType | null {
  const solution = sudokuTools.solvePuzzle(board)
  return solution === null ? null : assertBoard(solution, 'solvePuzzle')
}

/**
 * Gets the next hint through the typed library boundary.
 *
 * @param board - Current board.
 * @param solved - Solved board.
 * @returns A validated hint, or `null` when no hint is available.
 *
 * @example
 * getHint(board, solved)
 */
export function getHint(board: BoardType, solved: BoardType): HintResult | null {
  const hint = sudokuTools.getHint(board, solved)
  return hint === null ? null : assertHint(hint)
}

/**
 * Compares a board with its solved form through the typed library boundary.
 *
 * @param board - Current board.
 * @param solved - Solved board.
 * @returns `true` when the boards match.
 *
 * @example
 * isSolved(board, solved)
 */
export function isSolved(board: BoardType, solved: BoardType): boolean {
  const result = sudokuTools.isSolved(board, solved)
  if (typeof result !== 'boolean') {
    throw new Error('sudoku-tools returned an invalid solved-state result.')
  }
  return result
}

/**
 * Serializes a Sudoku board through the typed library boundary.
 *
 * @param board - Board to serialize.
 * @returns The serialized board string.
 *
 * @example
 * serializeBoard(board)
 */
export function serializeBoard(board: BoardType): string {
  const serialized = sudokuTools.serializeBoard(board)
  if (typeof serialized !== 'string') {
    throw new Error('sudoku-tools returned an invalid serialized board.')
  }
  return serialized
}

function assertBoard(value: unknown, operation: string): BoardType {
  if (!isBoard(value)) {
    throw new Error(`sudoku-tools returned an invalid board from ${operation}.`)
  }
  return value
}

function assertHint(value: unknown): HintResult {
  if (!isHint(value)) {
    throw new Error('sudoku-tools returned an invalid hint.')
  }
  return value
}

function assertSudokuState(value: unknown, operation: string): SudokuState {
  if (!isSudokuState(value)) {
    throw new Error(`sudoku-tools returned an invalid game state from ${operation}.`)
  }
  return value
}

function toCellValue(value: number): CellValue {
  if (!isCellValue(value)) {
    throw new RangeError('Cell value must be an integer from 0 through 9.')
  }
  return value
}

function isBoard(value: unknown): value is BoardType {
  return Array.isArray(value)
    && value.length === 9
    && value.every((row) => Array.isArray(row) && row.length === 9 && row.every(isCellValue))
}

function isReadOnlyBoard(value: unknown): value is BoardReadOnlyType {
  return Array.isArray(value)
    && value.length === 9
    && value.every((row) =>
      Array.isArray(row)
      && row.length === 9
      && row.every((cell) => typeof cell === 'boolean'),
    )
}

function isHint(value: unknown): value is HintResult {
  return isRecord(value)
    && isBoardIndex(value.row)
    && isBoardIndex(value.col)
    && isCellValue(value.value)
}

function isSudokuState(value: unknown): value is SudokuState {
  return isRecord(value)
    && isBoard(value.current)
    && isBoard(value.original)
    && isBoard(value.solution)
    && isReadOnlyBoard(value.readOnly)
}

function isBoardIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 9
}

function isCellValue(value: unknown): value is CellValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
