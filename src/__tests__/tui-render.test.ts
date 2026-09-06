import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, expect, it } from 'vitest'

import { makeEmptyBoard, makeReadOnly, makeState } from './tui-test-helpers.js'
import { createGame } from '../game/state.js'
import { renderGame, renderSavePrompt, renderWinBanner } from '../tui.js'

describe('renderGame', () => {
  it('renders without colors', () => {
    const state = createGame(Difficulty.Easy)
    const output = renderGame(state)
    expect(output).toContain('Sudoku CLI — easy')
    expect(output).toContain('Time: 00:00')
    expect(output).toContain('Moves: 00')
    expect(output).toContain('Errors: 00')
    expect(output).toContain('←→↑↓ Move')
  })

  it('renders with colors', () => {
    const state = createGame(Difficulty.Normal)
    const output = renderGame(state, { colorsEnabled: true })
    expect(output).toContain('Sudoku CLI — normal')
    expect(output).toContain('\x1b[')
  })

  it('renders grid with box-drawing characters', () => {
    const state = createGame(Difficulty.Easy)
    const output = renderGame(state)
    expect(output).toContain('╔')
    expect(output).toContain('╗')
    expect(output).toContain('╚')
    expect(output).toContain('╝')
    expect(output).toContain('═')
    expect(output).toContain('─')
    expect(output).toContain('│')
  })

  it('renders 9x9 grid rows', () => {
    const state = createGame(Difficulty.Easy)
    const lines = renderGame(state).split('\n')
    const gridRows = lines.filter((line) => line.includes('│'))
    expect(gridRows.length).toBe(9)
  })

  it('shows empty cells as dots', () => {
    const board = makeEmptyBoard()
    const solution = makeEmptyBoard()
    const state = makeState({ board, solution, readOnly: makeReadOnly() })
    expect(renderGame(state)).toContain('.')
  })

  it('renders a sparse row without a missing cell', () => {
    const board = makeEmptyBoard()
    const firstRow = board[0]
    if (firstRow === undefined) throw new Error('Expected first board row to exist')
    firstRow.pop()

    const output = renderGame(makeState({ board }))
    const firstGridRow = output.split('\n').find((line) => line.startsWith('║'))

    expect(firstGridRow).toBe('║ . │ . │ . ║ . │ . │ . ║ . │ . ║')
  })

  it('shows read-only cells as bold (with colors)', () => {
    const board = makeEmptyBoard()
    const solution = makeEmptyBoard()
    const readOnly = makeReadOnly()
    const boardRow = board[0]
    const solutionRow = solution[0]
    const readOnlyRow = readOnly[0]
    if (boardRow !== undefined) boardRow[0] = 5
    if (solutionRow !== undefined) solutionRow[0] = 5
    if (readOnlyRow !== undefined) readOnlyRow[0] = true

    const state = makeState({ board, solution, readOnly })
    expect(renderGame(state, { colorsEnabled: true })).toContain('\x1b[')
  })

  it('shows user-filled correct cells as dim cyan (with colors)', () => {
    const board = makeEmptyBoard()
    const solution = makeEmptyBoard()
    const readOnly = makeReadOnly([[0, 0]])
    const boardRow = board[0]
    const solutionRow = solution[0]
    if (boardRow !== undefined) boardRow[0] = 5
    if (solutionRow !== undefined) solutionRow[0] = 5

    const state = makeState({ board, solution, readOnly, cursor: { row: 1, col: 1 } })
    const output = renderGame(state, { colorsEnabled: true })
    expect(output).toContain('\x1b[2m')
    expect(output).toContain('\x1b[36m')
  })

  it('shows user-filled error cells as red+reverse (with colors)', () => {
    const board = makeEmptyBoard()
    const solution = makeEmptyBoard()
    const readOnly = makeReadOnly([[0, 0]])
    const boardRow = board[0]
    const solutionRow = solution[0]
    if (boardRow !== undefined) boardRow[0] = 5
    if (solutionRow !== undefined) solutionRow[0] = 3

    const state = makeState({ board, solution, readOnly, cursor: { row: 1, col: 1 } })
    const output = renderGame(state, { colorsEnabled: true })
    expect(output).toContain('\x1b[31m')
    expect(output).toContain('\x1b[7m')
  })

  it('shows cursor with reverse video (with colors)', () => {
    const state = makeState({ cursor: { row: 0, col: 0 } })
    expect(renderGame(state, { colorsEnabled: true })).toContain('\x1b[')
  })

  it('shows move count in stats', () => {
    const state = makeState({ moveCount: 12 })
    expect(renderGame(state)).toContain('Moves: 12')
  })

  it('shows error count in stats', () => {
    const state = makeState({ errorCount: 3 })
    expect(renderGame(state)).toContain('Errors: 03')
  })
})

describe('renderWinBanner', () => {
  it('renders win message without colors', () => {
    const output = renderWinBanner(makeState({ status: 'won' }))
    expect(output).toContain('Congratulations! You won!')
    expect(output).toContain('N New Game')
    expect(output).toContain('A Achievements')
    expect(output).toContain('Q Quit')
  })

  it('renders with colors', () => {
    const output = renderWinBanner(makeState({ status: 'won' }), { colorsEnabled: true })
    expect(output).toContain('Congratulations! You won!')
    expect(output).toContain('\x1b[')
  })

  it('shows achievement count when achievements unlocked', () => {
    const output = renderWinBanner(makeState({ status: 'won' }), undefined, ['first_win'])
    expect(output).toContain('1 achievement unlocked!')
  })

  it('shows plural when multiple achievements', () => {
    const output = renderWinBanner(
      makeState({ status: 'won' }),
      undefined,
      ['first_win', 'speed_demon'],
    )
    expect(output).toContain('2 achievements unlocked!')
  })

  it('renders colored achievement count with multiple achievements', () => {
    const output = renderWinBanner(
      makeState({ status: 'won' }),
      { colorsEnabled: true },
      ['first_win', 'speed_demon'],
    )
    expect(output).toContain('2')
    expect(output).toContain('\x1b[')
  })

  it('omits achievement line when none', () => {
    expect(renderWinBanner(makeState({ status: 'won' }))).not.toContain('unlocked')
  })

  it('shows stats', () => {
    const output = renderWinBanner(makeState({ status: 'won', moveCount: 42, errorCount: 3 }))
    expect(output).toContain('Moves: 42')
    expect(output).toContain('Errors: 3')
  })
})

describe('renderSavePrompt', () => {
  it('renders without colors', () => {
    const output = renderSavePrompt(makeState())
    expect(output).toContain('Save game')
    expect(output).toContain('normal')
    expect(output).toContain('Y/N')
  })

  it('renders with colors', () => {
    const output = renderSavePrompt(makeState({ difficulty: Difficulty.Hard }), { colorsEnabled: true })
    expect(output).toContain('Save game')
    expect(output).toContain('hard')
    expect(output).toContain('\x1b[')
  })
})

describe('colors disabled', () => {
  it('renderGame has no ANSI escapes', () => {
    expect(renderGame(createGame(Difficulty.Easy), { colorsEnabled: false })).not.toContain('\x1b[')
  })

  it('renderWinBanner has no ANSI escapes', () => {
    expect(renderWinBanner(makeState({ status: 'won' }), { colorsEnabled: false })).not.toContain('\x1b[')
  })

  it('renderSavePrompt has no ANSI escapes', () => {
    expect(renderSavePrompt(makeState(), { colorsEnabled: false })).not.toContain('\x1b[')
  })
})
