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
function validateBoard(board: BoardType): void {
  if (board.length !== 9) {
    throw new Error(`Board must have 9 rows; got ${String(board.length)}.`)
  }

  for (let r = 0; r < 9; r++) {
    const row = board[r]

    if (row === undefined || row.length !== 9) {
      throw new Error(`Board row ${String(r)} must have 9 cells.`)
    }
  }
}

/** Format one cell for the plain-text grid. */
function formatCell(value: number | undefined): string {
  return value === 0 ? '.' : String(value ?? 0)
}

/** Format one board row as three visually separated boxes. */
function renderRow(row: readonly number[]): string {
  const segments: string[] = []

  for (let box = 0; box < 3; box++) {
    const start = box * 3
    segments.push([
      formatCell(row[start]),
      formatCell(row[start + 1]),
      formatCell(row[start + 2]),
    ].join(' '))
  }

  return segments.join(' | ')
}

/** Render a validated 9x9 board as a plain-text grid. */
export function renderGrid(board: BoardType): string {
  validateBoard(board)

  const lineSep = '------+-------+------'
  const lines: string[] = []

  for (let r = 0; r < 9; r++) {
    lines.push(renderRow(board[r] ?? []))

    if (r === 2 || r === 5) {
      lines.push(lineSep)
    }
  }

  return lines.join('\n')
}
