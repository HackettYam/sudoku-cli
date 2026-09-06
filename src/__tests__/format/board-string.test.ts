import { describe, expect, it } from 'vitest'

import { normalizeBoardString, parseBoard } from '../../format/board-string.js'

const VALID_BOARD = '123456789456789123789123456234567891567891234891234567345678912678912345912345678'

describe('normalizeBoardString', () => {
  it('strips whitespace and validates length', () => {
    const spaced = '123456789 456789123 789123456 234567891 567891234 891234567 345678912 678912345 912345678'

    expect(normalizeBoardString(spaced)).toBe(VALID_BOARD)
  })

  it('strips newlines and tabs', () => {
    const multiline = `123456789
456789123
789123456
234567891
567891234
891234567
345678912
678912345
912345678`

    expect(normalizeBoardString(multiline)).toBe(VALID_BOARD)
  })

  it('throws when length is not 81 after stripping', () => {
    expect(() => normalizeBoardString('123')).toThrowError(/must be exactly 81 characters/)
  })

  it('throws when string contains non-digit characters', () => {
    const bad = 'a'.repeat(81)

    expect(() => normalizeBoardString(bad)).toThrowError(/only digits 0-9/)
  })
})

describe('parseBoard', () => {
  it('parses a valid 81-character string into a 9x9 board', () => {
    const board = parseBoard(VALID_BOARD)

    expect(board).toHaveLength(9)
    expect(board[0]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(board[8]).toEqual([9, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('rejects strings with non-digit characters', () => {
    expect(() => parseBoard('12345678945678912378912345623456789156789123489123456734567891267891234591234567X'))
      .toThrowError(/only digits 0-9/)
  })

  it('rejects empty input', () => {
    expect(() => parseBoard('')).toThrowError(/must be exactly 81 characters/)
  })
})
