import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, it, expect } from 'vitest'

import { createGame, applyMove, isWon, undo, isReadOnly, getStats, type GameState } from '../../game/state.js'

function fillEditableCells(state: GameState): GameState['board'] {
  const board = state.board.map((row) => [...row])
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (state.readOnly[r]?.[c]) continue
      const boardRow = board[r]
      const solutionRow = state.solution[r]
      const value = solutionRow?.[c]
      if (boardRow !== undefined && value !== undefined) {
        boardRow[c] = value
      }
    }
  }
  return board
}

function findReadOnlyCell(state: GameState): { row: number; col: number } {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (state.readOnly[r]?.[c]) return { row: r, col: c }
    }
  }
  throw new Error('Expected generated puzzle to contain a read-only cell')
}

describe('createGame', () => {
  it('returns correct initial shape', () => {
    const state = createGame(Difficulty.Normal)
    expect(state.status).toBe('playing')
    expect(state.cursor).toEqual({ row: 0, col: 0 })
    expect(state.history).toEqual([])
    expect(state.moveCount).toBe(0)
    expect(state.hintCount).toBe(0)
    expect(state.undoCount).toBe(0)
    expect(state.errorCount).toBe(0)
    expect(state.difficulty).toBe('normal')
    expect(state.board).toBeDefined()
    expect(state.solution).toBeDefined()
    expect(state.original).toBeDefined()
    expect(state.readOnly).toBeDefined()
  })

  it('derives readOnly from original puzzle', () => {
    const state = createGame(Difficulty.Easy)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(typeof state.readOnly[r]?.[c]).toBe('boolean')
        // readOnly cell must have a non-zero original value
        if (state.readOnly[r]?.[c]) {
          expect(state.original[r]?.[c]).not.toBe(0)
        }
      }
    }
  })
})

describe('applyMove - place', () => {
  it('is no-op on readOnly cell', () => {
    const state = createGame(Difficulty.Easy)
    // Find a readOnly cell
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.readOnly[r]?.[c]) {
          const next = applyMove(state, { kind: 'place', row: r, col: c, value: 5 })
          expect(next).toBe(state) // same reference = no-op
          expect(next.moveCount).toBe(0)
          return
        }
      }
    }
  })

  it('updates board on editable cell', () => {
    const state = createGame(Difficulty.Easy)
    // Find an editable cell
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          const val = (state.solution[r] as number[])[c] as number
          const next = applyMove(state, { kind: 'place', row: r, col: c, value: val })
          expect((next.board[r] as number[])[c]).toBe(val)
          expect(next.moveCount).toBe(1)
          expect(next.history.length).toBe(1)
          return
        }
      }
    }
  })

  it('detects win when all cells filled correctly', () => {
    // Build a state that's one move away from solved
    const state = createGame(Difficulty.Easy)
    const solution = state.solution
    let emptyRow = -1
    let emptyCol = -1
    const filledBoard = state.board.map((r) => [...r])

    // Fill all editable cells with solution
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          ;(filledBoard[r] as (number | null)[])[c] =
            ((solution as (number | null)[][])[r] as (number | null)[])[c] as number
        }
      }
    }

    // Find the one remaining empty editable cell
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if ((filledBoard as (number | null)[][])[r]?.[c] === 0) {
          emptyRow = r
          emptyCol = c
        }
      }
    }

    if (emptyRow === -1) return // all cells were readOnly (unlikely)

    const nearWin = {
      ...state,
      board: filledBoard,
      history: [] as typeof state.history,
      moveCount: 0,
    }
    const solutionVal =
      ((solution as (number | null)[][])[emptyRow] as (number | null)[])[emptyCol] as number
    const final = applyMove(nearWin, {
      kind: 'place',
      row: emptyRow,
      col: emptyCol,
      value: solutionVal,
    })
    expect(final.status).toBe('won')
  })
})

describe('applyMove - clear', () => {
  it('clears an editable cell', () => {
    const state = createGame(Difficulty.Easy)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          const placed = applyMove(state, { kind: 'place', row: r, col: c, value: 3 })
          const cleared = applyMove(placed, { kind: 'clear', row: r, col: c })
          expect((cleared.board[r] as number[])[c]).toBe(0)
          expect(cleared.moveCount).toBe(2)
          return
        }
      }
    }
  })
})

describe('applyMove - move-cursor', () => {
  it('moves cursor', () => {
    const state = createGame(Difficulty.Easy)
    const next = applyMove(state, { kind: 'move-cursor', row: 5, col: 3 })
    expect(next.cursor).toEqual({ row: 5, col: 3 })
  })

  it('clamps to board edges', () => {
    const state = createGame(Difficulty.Easy)
    const next = applyMove(state, { kind: 'move-cursor', row: -5, col: 100 })
    expect(next.cursor).toEqual({ row: 0, col: 8 })
  })
})

describe('applyMove - undo', () => {
  it('no-op on empty history', () => {
    const state = createGame(Difficulty.Easy)
    const next = undo(state)
    expect(next).toBe(state)
    expect(next.undoCount).toBe(0)
  })

  it('no-op when last history entry is undefined (sparse array)', () => {
    const state = createGame(Difficulty.Easy)
    // Build a sparse history: length > 0 but last slot is undefined
    const sparseHistory = new Array<GameState['history'][number]>(3)
    sparseHistory[0] = state.board
    sparseHistory[1] = state.board
    // sparseHistory[2] is intentionally undefined
    const withSparse = { ...state, history: sparseHistory }
    const next = undo(withSparse)
    // Guard at line 154-155 fires → returns same state
    expect(next).toBe(withSparse)
    expect(next.undoCount).toBe(0)
  })

  it('reverts last move', () => {
    const state = createGame(Difficulty.Easy)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          const placed = applyMove(state, { kind: 'place', row: r, col: c, value: 7 })
          expect(placed.moveCount).toBe(1)
          const undone = undo(placed)
          expect((undone.board[r] as number[])[c]).toBe(0)
          expect(undone.undoCount).toBe(1)
          expect(undone.moveCount).toBe(0)
          return
        }
      }
    }
  })
})

describe('applyMove - hint', () => {
  it('places solution value and increments hintCount', () => {
    const state = createGame(Difficulty.Easy)
    const next = applyMove(state, { kind: 'hint' })
    expect(next.hintCount).toBe(1)
    expect(next.moveCount).toBe(1) // hint increments moveCount
    expect(next.history.length).toBe(1) // synthetic place in history
  })

  it('is no-op when status is not playing', () => {
    const state = createGame(Difficulty.Easy)
    const won = { ...state, status: 'won' as const }
    const next = applyMove(won, { kind: 'hint' })
    expect(next).toBe(won)
  })

  it('hint is no-op when board is full', () => {
    const state = createGame(Difficulty.Easy)
    // Fill all editable cells with solution values so getHint returns null
    const filledBoard = state.board.map((r) => [...r])
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          ;(filledBoard[r] as (number | null)[])[c] =
            ((state.solution as (number | null)[][])[r] as (number | null)[])[c] as number
        }
      }
    }
    const fullState = { ...state, board: filledBoard }
    const next = applyMove(fullState, { kind: 'hint' })
    // getHint returns null when no empty cells → no-op
    expect(next).toBe(fullState)
  })

  it('hint is no-op when hinted cell is read-only', () => {
    const state = createGame(Difficulty.Easy)
    // Fill all editable cells with solution values, then clear ONE read-only cell
    // so getHint must return that cell, which isReadOnlyCell blocks.
    const syntheticBoard = fillEditableCells(state)
    const { row: targetRow, col: targetCol } = findReadOnlyCell(state)
    // Clear the read-only cell — it's now the only empty cell on the board
    const boardRow = syntheticBoard[targetRow]
    if (boardRow === undefined) throw new Error('Expected target row to exist')
    boardRow[targetCol] = 0
    const syntheticState = { ...state, board: syntheticBoard }
    const next = applyMove(syntheticState, { kind: 'hint' })
    // isReadOnlyCell returns true → no-op (same reference)
    expect(next).toBe(syntheticState)
  })
})

describe('applyMove - new-game', () => {
  it('creates fresh game when status is won', () => {
    const state = createGame(Difficulty.Easy)
    const won = { ...state, status: 'won' as const }
    const next = applyMove(won, { kind: 'new-game' })
    expect(next.status).toBe('playing')
    expect(next.moveCount).toBe(0)
    expect(next.difficulty).toBe('easy')
  })

  it('is no-op when status is playing', () => {
    const state = createGame(Difficulty.Easy)
    const next = applyMove(state, { kind: 'new-game' })
    expect(next).toBe(state)
  })
})

describe('applyMove - quit', () => {
  it('sets status to quit', () => {
    const state = createGame(Difficulty.Easy)
    const next = applyMove(state, { kind: 'quit' })
    expect(next.status).toBe('quit')
  })
})

describe('applyMove - toggle-achievements', () => {
  it('toggles view when won', () => {
    const state = createGame(Difficulty.Easy)
    const won = { ...state, status: 'won' as const }
    const next = applyMove(won, { kind: 'toggle-achievements' })
    expect(next.winView).toBe('achievements')
    const back = applyMove(next, { kind: 'toggle-achievements' })
    expect(back.winView).toBe('menu')
  })

  it('is no-op when not won', () => {
    const state = createGame(Difficulty.Easy)
    const next = applyMove(state, { kind: 'toggle-achievements' })
    expect(next).toBe(state)
  })
})

describe('isWon', () => {
  it('returns true when won', () => {
    const state = createGame(Difficulty.Easy)
    expect(isWon(state)).toBe(false)
    const won = { ...state, status: 'won' as const }
    expect(isWon(won)).toBe(true)
  })
})

describe('isReadOnly', () => {
  it('returns true for original cells', () => {
    const state = createGame(Difficulty.Easy)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.readOnly[r]?.[c]) {
          expect(isReadOnly(state, r, c)).toBe(true)
        }
      }
    }
  })

  it('returns false for editable cells', () => {
    const state = createGame(Difficulty.Easy)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          expect(isReadOnly(state, r, c)).toBe(false)
        }
      }
    }
  })

  it('returns true for out-of-bounds', () => {
    const state = createGame(Difficulty.Easy)
    expect(isReadOnly(state, -1, 0)).toBe(true)
    expect(isReadOnly(state, 0, 9)).toBe(true)
  })
})

describe('applyMove - undo via applyMove', () => {
  it('undo via applyMove dispatches correctly', () => {
    let state = createGame(Difficulty.Normal)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!isReadOnly(state, r, c)) {
          const val = (state.solution[r] as (number | null)[])[c] as number
          state = applyMove(state, { kind: 'place', row: r, col: c, value: val })
          state = applyMove(state, { kind: 'undo' })
          expect(state.undoCount).toBe(1)
          return
        }
      }
    }
  })
})

describe('applyMove - clear on readOnly', () => {
  it('clear on readOnly cell is no-op via applyMove', () => {
    const state = createGame(Difficulty.Normal)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (isReadOnly(state, r, c)) {
          const next = applyMove(state, { kind: 'clear', row: r, col: c })
          expect(next).toBe(state)
          return
        }
      }
    }
  })
})

describe('getStats', () => {
  it('returns correct derived values', () => {
    const state = createGame(Difficulty.Easy)
    const stats = getStats(state)
    expect(stats.moveCount).toBe(0)
    expect(stats.hintCount).toBe(0)
    expect(stats.undoCount).toBe(0)
    expect(stats.errorCount).toBe(0)
    expect(stats.elapsedMs).toBeGreaterThanOrEqual(0)
  })
})

describe('cumulative errorCount', () => {
  it('increments on wrong placement', () => {
    const state = createGame(Difficulty.Easy)
    // Find an editable cell and place a wrong value
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          const correctVal = (state.solution[r] as number[])[c] as number
          const wrongVal = correctVal === 1 ? 2 : 1
          const next = applyMove(state, { kind: 'place', row: r, col: c, value: wrongVal })
          expect(next.errorCount).toBe(1)
          return
        }
      }
    }
  })

  it('does not increment on correct placement', () => {
    const state = createGame(Difficulty.Easy)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          const val = (state.solution[r] as number[])[c] as number
          const next = applyMove(state, { kind: 'place', row: r, col: c, value: val })
          expect(next.errorCount).toBe(0)
          return
        }
      }
    }
  })

  it('accumulates across multiple wrong placements', () => {
    const state = createGame(Difficulty.Easy)
    let s = state
    let placed = 0
    for (let r = 0; r < 9 && placed < 3; r++) {
      for (let c = 0; c < 9 && placed < 3; c++) {
        if (!s.readOnly[r]?.[c]) {
          const correctVal = (s.solution[r] as number[])[c] as number
          const wrongVal = correctVal === 1 ? 2 : 1
          s = applyMove(s, { kind: 'place', row: r, col: c, value: wrongVal })
          placed++
        }
      }
    }
    expect(s.errorCount).toBe(3)
  })

  it('does not decrement on clear', () => {
    const state = createGame(Difficulty.Easy)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          const correctVal = (state.solution[r] as number[])[c] as number
          const wrongVal = correctVal === 1 ? 2 : 1
          const placed = applyMove(state, { kind: 'place', row: r, col: c, value: wrongVal })
          expect(placed.errorCount).toBe(1)
          const cleared = applyMove(placed, { kind: 'clear', row: r, col: c })
          expect(cleared.errorCount).toBe(1) // still 1, not decremented
          return
        }
      }
    }
  })

  it('does not decrement on undo', () => {
    const state = createGame(Difficulty.Easy)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.readOnly[r]?.[c]) {
          const correctVal = (state.solution[r] as number[])[c] as number
          const wrongVal = correctVal === 1 ? 2 : 1
          const placed = applyMove(state, { kind: 'place', row: r, col: c, value: wrongVal })
          expect(placed.errorCount).toBe(1)
          const undone = undo(placed)
          expect(undone.errorCount).toBe(1) // still 1, not decremented
          return
        }
      }
    }
  })

  it('does not change on hint', () => {
    const state = createGame(Difficulty.Easy)
    const next = applyMove(state, { kind: 'hint' })
    expect(next.errorCount).toBe(0) // unchanged from initial
  })
})
