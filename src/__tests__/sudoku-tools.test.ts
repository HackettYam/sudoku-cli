import {
  Difficulty,
  SUDOKU_BASE_BOARD,
  type BoardType,
} from '@hackettyam/sudoku-tools'
import * as sudokuToolsLibrary from '@hackettyam/sudoku-tools'
import { describe, expect, it, vi } from 'vitest'

import {
  cloneBoard,
  createSudoku,
  getHint,
  isSolved,
  serializeBoard,
  setCellValue,
} from '../sudoku-tools.js'

vi.mock('@hackettyam/sudoku-tools', async (importOriginal) => {
  const mod = await importOriginal<typeof sudokuToolsLibrary>()
  return {
    ...mod,
    cloneBoard: vi.fn(mod.cloneBoard),
    createSudoku: vi.fn(mod.createSudoku),
    getHint: vi.fn(mod.getHint),
    isSolved: vi.fn(mod.isSolved),
    serializeBoard: vi.fn(mod.serializeBoard),
    setCellValue: vi.fn(mod.setCellValue),
  }
})

const VALID_BOARD: BoardType = SUDOKU_BASE_BOARD.map((row) => [...row])

describe('sudoku-tools boundary validation', () => {
  it('rejects a non-boolean isSolved result', () => {
    // Arrange
    vi.mocked(sudokuToolsLibrary.isSolved).mockReturnValue(
      'invalid' as unknown as ReturnType<typeof sudokuToolsLibrary.isSolved>,
    )

    // Act and Assert
    expect(() => isSolved(VALID_BOARD, VALID_BOARD)).toThrow(
      'sudoku-tools returned an invalid solved-state result.',
    )
  })

  it('rejects a non-string serializeBoard result', () => {
    // Arrange
    vi.mocked(sudokuToolsLibrary.serializeBoard).mockReturnValue(
      42 as unknown as ReturnType<typeof sudokuToolsLibrary.serializeBoard>,
    )

    // Act and Assert
    expect(() => serializeBoard(VALID_BOARD)).toThrow(
      'sudoku-tools returned an invalid serialized board.',
    )
  })

  it('rejects an invalid cloneBoard result', () => {
    // Arrange
    vi.mocked(sudokuToolsLibrary.cloneBoard).mockReturnValue(
      [[]],
    )

    // Act and Assert
    expect(() => cloneBoard(VALID_BOARD)).toThrow(
      'sudoku-tools returned an invalid board from cloneBoard.',
    )
  })

  it('rejects an invalid getHint result', () => {
    // Arrange
    vi.mocked(sudokuToolsLibrary.getHint).mockReturnValue(
      { row: 9, col: 0, value: 1 },
    )

    // Act and Assert
    expect(() => getHint(VALID_BOARD, VALID_BOARD)).toThrow(
      'sudoku-tools returned an invalid hint.',
    )
  })

  it('rejects an invalid createSudoku result', () => {
    // Arrange
    vi.mocked(sudokuToolsLibrary.createSudoku).mockReturnValue(
      {},
    )

    // Act and Assert
    expect(() => createSudoku(Difficulty.Easy)).toThrow(
      'sudoku-tools returned an invalid game state from createSudoku.',
    )
  })

  it('rejects an out-of-range setCellValue value', () => {
    // Arrange
    const update = { row: 0, col: 0, value: 10 }

    // Act and Assert
    expect(() => setCellValue(VALID_BOARD, update)).toThrow(
      'Cell value must be an integer from 0 through 9.',
    )
    expect(sudokuToolsLibrary.setCellValue).not.toHaveBeenCalled()
  })
})
