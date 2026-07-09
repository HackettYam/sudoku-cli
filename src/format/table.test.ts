import { describe, expect, it } from 'vitest'
import { displayWidth, formatTable } from './table.js'

describe('displayWidth', () => {
  it('returns string length for ASCII', () => {
    expect(displayWidth('abc')).toBe(3)
  })

  it('counts CJK as width 2', () => {
    expect(displayWidth('你好')).toBe(4)
    expect(displayWidth('x你')).toBe(3)
  })

  it('counts emoji as width 2', () => {
    expect(displayWidth('🎉')).toBe(2)
    expect(displayWidth('a🎉b')).toBe(4)
  })

  it('returns 0 for empty string', () => {
    expect(displayWidth('')).toBe(0)
  })
})

describe('formatTable', () => {
  it('returns empty string when no columns', () => {
    expect(formatTable([], [])).toBe('')
  })

  it('formats with mixed alignment columns', () => {
    const columns = [
      { header: 'Name' },
      { header: 'Score', align: 'right' as const },
    ]
    const rows = [['Alice', '100'], ['Bob', '42']]

    expect(formatTable(columns, rows)).toMatchInlineSnapshot(`
"+-------+-------+
| Name  | Score |
+-------+-------+
| Alice |   100 |
| Bob   |    42 |
+-------+-------+"
`)
  })

  it('formats with empty rows', () => {
    const columns = [{ header: 'A' }, { header: 'B' }]

    expect(formatTable(columns, [])).toMatchInlineSnapshot(`
"+---+---+
| A | B |
+---+---+"
`)
  })

  it('formats with explicit widths', () => {
    const columns = [
      { header: 'Col', width: 6 },
      { header: 'Val' },
    ]
    const rows = [['x', '1']]

    expect(formatTable(columns, rows)).toMatchInlineSnapshot(`
"+--------+-----+
| Col    | Val |
+--------+-----+
| x      | 1   |
+--------+-----+"
`)
  })
})
