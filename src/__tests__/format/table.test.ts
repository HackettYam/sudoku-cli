import { describe, expect, it } from 'vitest'

import { displayWidth, formatTable } from '../../format/table.js'

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

  it('returns 2 for CJK characters', () => {
    expect(displayWidth('漢')).toBe(2)
    expect(displayWidth('字')).toBe(2)
    expect(displayWidth('漢字')).toBe(4)
  })

  it('returns 2 for emoji characters', () => {
    expect(displayWidth('🎉')).toBe(2)
    expect(displayWidth('🏆')).toBe(2)
  })

  it('handles mixed ASCII and CJK', () => {
    expect(displayWidth('a漢b')).toBe(4) // 1 + 2 + 1
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

  it('handles rows with fewer cells than columns', () => {
    const result = formatTable(
      [{ header: 'A' }, { header: 'B' }, { header: 'C' }],
      [['x']], // row has 1 cell, 3 columns defined
    )
    expect(result).toContain('x')
    expect(result).toContain('A')
  })
})
