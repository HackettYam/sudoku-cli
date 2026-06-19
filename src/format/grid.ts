import type { BoardType } from '@hackettyam/sudoku-tools'

/**
 * Renders a 9x9 Sudoku board as a human-readable ASCII grid.
 *
 * Empty cells (`0`) are rendered as dots for readability. Rows, columns,
 * and 3x3 boxes are visually separated by `|` and `-` characters.
 *
 * @param board - A 9x9 board as a 2D number array.
 * @returns A multi-line string suitable for printing to a terminal.
 * @throws Error if the board is not 9x9 or if any row is missing/short.
 *
 * @example
 * renderGrid([
 *   [5, 3, 0, 0, 7, 0, 0, 0, 0],
 *   [6, 0, 0, 1, 9, 5, 0, 0, 0],
 *   // ...
 * ])
 */
export function renderGrid(board: BoardType): string {
  if (board.length !== 9) {
    throw new Error(`Board must have 9 rows; got ${board.length}.`)
  }

  for (let r = 0; r < 9; r++) {
    const row = board[r]

    if (row === undefined || row.length !== 9) {
      throw new Error(`Board row ${r} must have 9 cells.`)
    }
  }

  const cell = (v: number): string => (v === 0 ? '.' : String(v))
  const lineSep = '------+-------+------'
  const lines: string[] = []

  for (let r = 0; r < 9; r++) {
    const row = board[r] ?? Array.from({ length: 9 }, () => 0)
    const segments: string[] = []

    for (let box = 0; box < 3; box++) {
      const c0 = box * 3
      const c1 = c0 + 1
      const c2 = c0 + 2
      const v0 = row[c0] ?? 0
      const v1 = row[c1] ?? 0
      const v2 = row[c2] ?? 0
      segments.push(`${cell(v0)} ${cell(v1)} ${cell(v2)}`)
    }

    lines.push(segments.join(' | '))

    if (r === 2 || r === 5) {
      lines.push(lineSep)
    }
  }

  return lines.join('\n')
}
