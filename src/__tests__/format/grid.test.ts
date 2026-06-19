import { describe, expect, it } from 'vitest'
import { renderGrid } from '../../format/grid.js'

describe('renderGrid', () => {
  const SOLVED = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [4, 5, 6, 7, 8, 9, 1, 2, 3],
    [7, 8, 9, 1, 2, 3, 4, 5, 6],
    [2, 3, 4, 5, 6, 7, 8, 9, 1],
    [5, 6, 7, 8, 9, 1, 2, 3, 4],
    [8, 9, 1, 2, 3, 4, 5, 6, 7],
    [3, 4, 5, 6, 7, 8, 9, 1, 2],
    [6, 7, 8, 9, 1, 2, 3, 4, 5],
    [9, 1, 2, 3, 4, 5, 6, 7, 8],
  ]

  it('renders a complete board as a 9x9 grid with separators', () => {
    const output = renderGrid(SOLVED)

    expect(output).toBe(
      [
        '1 2 3 | 4 5 6 | 7 8 9',
        '4 5 6 | 7 8 9 | 1 2 3',
        '7 8 9 | 1 2 3 | 4 5 6',
        '------+-------+------',
        '2 3 4 | 5 6 7 | 8 9 1',
        '5 6 7 | 8 9 1 | 2 3 4',
        '8 9 1 | 2 3 4 | 5 6 7',
        '------+-------+------',
        '3 4 5 | 6 7 8 | 9 1 2',
        '6 7 8 | 9 1 2 | 3 4 5',
        '9 1 2 | 3 4 5 | 6 7 8',
      ].join('\n'),
    )
  })

  it('renders empty cells (0) as dots', () => {
    const PARTIAL: typeof SOLVED = SOLVED.map((row) => row.slice()) as typeof SOLVED
    PARTIAL[0] = [0, 0, 0, 0, 0, 0, 0, 0, 0]

    const output = renderGrid(PARTIAL)

    expect(output).toContain('. . . | . . . | . . .')
  })

  it('throws when the board does not have 9 rows', () => {
    expect(() => renderGrid([[1, 2, 3]] as never)).toThrowError(/Board must have 9 rows/)
  })

  it('throws when a row does not have 9 cells', () => {
    const BAD = SOLVED.map((row) => row.slice()) as typeof SOLVED
    BAD[0] = [1, 2, 3] as never

    expect(() => renderGrid(BAD)).toThrowError(/Board row 0 must have 9 cells/)
  })

  it('throws when a row is missing entirely (undefined)', () => {
    // Construct a length-9 array whose slots are all `undefined`.
    // `board.length === 9` passes the outer check, then `board[r] === undefined`
    // triggers the per-row guard.
    const SPARSE: typeof SOLVED = new Array(9) as unknown as typeof SOLVED

    expect(() => renderGrid(SPARSE)).toThrowError(/Board row 0 must have 9 cells/)
  })
})
