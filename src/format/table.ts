/**
 * Pure ASCII table renderer.
 *
 * Produces bordered tables using `+`, `-`, and `|` characters.
 * Handles CJK/emoji wide characters via display-width calculation.
 */

/**
 * Table column definition.
 */
export interface Column {
  /** Header text displayed in the top row. */
  readonly header: string
  /** Explicit column width. If omitted, auto-sizes to content. */
  readonly width?: number
  /** Alignment within the column. Default: 'left'. */
  readonly align?: 'left' | 'right'
}

/**
 * Table row data — an array of cell values, one per column.
 */
export type Row = readonly string[]

type CodePointRange = readonly [number, number]

const CJK_RANGES: readonly CodePointRange[] = [
  [0x4e00, 0x9fff],
  [0x3400, 0x4dbf],
  [0xf900, 0xfaff],
  [0x20000, 0x2a6df],
  [0x2a700, 0x2b73f],
  [0x2b740, 0x2b81f],
  [0x2b820, 0x2ceaf],
  [0x2ceb0, 0x2ebef],
  [0x2f800, 0x2fa1f],
]

const EMOJI_RANGES: readonly CodePointRange[] = [
  [0x1f600, 0x1f64f],
  [0x1f300, 0x1f5ff],
  [0x1f680, 0x1f6ff],
  [0x1f1e0, 0x1f1ff],
  [0x2600, 0x26ff],
  [0x2700, 0x27bf],
  [0x1f900, 0x1f9ff],
  [0x1fa00, 0x1fa6f],
  [0x1fa70, 0x1faff],
]

/** Return whether a code point is inside any configured range. */
function isInRanges(cp: number, ranges: readonly CodePointRange[]): boolean {
  return ranges.some(([start, end]) => cp >= start && cp <= end)
}

/**
 * Checks whether a Unicode code point is a CJK character that occupies
 * 2 cells in a monospace terminal.
 *
 * @param cp - The Unicode code point.
 * @returns `true` if the character is CJK (wide).
 */
function isCjk(cp: number): boolean {
  return isInRanges(cp, CJK_RANGES)
}

/**
 * Checks whether a Unicode code point is a common emoji that occupies
 * 2 cells in a monospace terminal.
 *
 * @param cp - The Unicode code point.
 * @returns `true` if the character is an emoji (wide).
 */
function isEmoji(cp: number): boolean {
  return isInRanges(cp, EMOJI_RANGES)
}

/**
 * Calculates the display width of a string in a monospace terminal.
 *
 * CJK characters and common emoji count as 2 cells. All other characters
 * count as 1 cell.
 *
 * @param s - The string to measure.
 * @returns The number of monospace cells the string occupies.
 *
 * @example
 * displayWidth('abc')    // 3
 * displayWidth('你好')   // 4
 * displayWidth('🎉')    // 2
 */
export function displayWidth(s: string): number {
  let width = 0

  for (const char of s) {
    const cp = char.codePointAt(0)
    if (cp !== undefined && (isCjk(cp) || isEmoji(cp))) {
      width += 2
    } else {
      width += 1
    }
  }

  return width
}

/**
 * Pads a string to a target display width, respecting alignment.
 *
 * @param s - The string to pad.
 * @param targetWidth - The desired display width.
 * @param align - 'left' (default) or 'right'.
 * @returns The padded string.
 */
function pad(s: string, targetWidth: number, align: 'left' | 'right'): string {
  const diff = targetWidth - displayWidth(s)

  if (diff <= 0) {
    return s
  }

  const padding = ' '.repeat(diff)
  return align === 'right' ? `${padding}${s}` : `${s}${padding}`
}

/**
 * Formats rows into an ASCII table.
 *
 * Uses `+`, `-`, and `|` for borders. Column widths are auto-calculated
 * from the maximum display width of headers and cell values, or use
 * explicit `width` from the column definition.
 *
 * @param columns - Column definitions with headers and optional width/alignment.
 * @param rows - Table data rows.
 * @returns The formatted ASCII table string.
 *
 * @example
 * const table = formatTable(
 *   [{ header: 'Name' }, { header: 'Score', align: 'right' }],
 *   [['Alice', '100'], ['Bob', '42']],
 * )
 * // +-------+-------+
 * // | Name  | Score |
 * // +-------+-------+
 * // | Alice |   100 |
 * // | Bob   |    42 |
 * // +-------+-------+
 */
export function formatTable(columns: readonly Column[], rows: readonly Row[]): string {
  if (columns.length === 0) {
    return ''
  }

  // Calculate column widths
  const colWidths: number[] = columns.map((col, idx) => {
    const headerWidth = displayWidth(col.header)
    const maxContentWidth = rows.reduce((max, row) => {
      const cell = row[idx] ?? ''
      return Math.max(max, displayWidth(cell))
    }, 0)
    return col.width ?? Math.max(headerWidth, maxContentWidth)
  })

  // Build separator line: +-------+-------+
  const separator = `+${colWidths.map((w) => '-'.repeat(w + 2)).join('+')}+`

  // Build header line
  const headerLine = `|${columns.map((col, idx) => {
    const align = col.align ?? 'left'
    const width = colWidths[idx] ?? 0
    return ` ${pad(col.header, width, align)} `
  }).join('|')}|`

  // Build data lines
  const dataLines = rows.map((row) => {
    return `|${columns.map((_col, idx) => {
      const cell = row[idx] ?? ''
      const align = columns[idx]?.align ?? 'left'
      const width = colWidths[idx] ?? 0
      return ` ${pad(cell, width, align)} `
    }).join('|')}|`
  })

  // Assemble table (no trailing separator when there are no data rows)
  const parts = dataLines.length > 0
    ? [separator, headerLine, separator, ...dataLines, separator]
    : [separator, headerLine, separator]
  return parts.join('\n')
}
