import { deserializeBoard, type BoardType } from '@hackettyam/sudoku-tools'
import { BOARD_LENGTH } from './constants.js'

/**
 * Normalizes a raw CLI board string by stripping whitespace and validating
 * the resulting length.
 *
 * @param input - Raw input from the user (may contain spaces or newlines).
 * @returns A trimmed, 81-character string of digits 0-9.
 * @throws Error if the cleaned input is not exactly {@link BOARD_LENGTH} characters.
 *
 * @example
 * normalizeBoardString('530070000 600195000 ...') // 81 chars, no spaces
 */
export function normalizeBoardString(input: string): string {
  const cleaned = input.replace(/\s+/g, '')

  if (cleaned.length !== BOARD_LENGTH) {
    throw new Error(
      `Board string must be exactly ${BOARD_LENGTH} characters after whitespace removal; got ${cleaned.length}.`,
    )
  }

  if (!/^[0-9]+$/.test(cleaned)) {
    throw new Error('Board string must contain only digits 0-9.')
  }

  return cleaned
}

/**
 * Parses a CLI-provided board string into a {@link BoardType}.
 *
 * Combines {@link normalizeBoardString} with the library's `deserializeBoard`.
 * The library's `deserializeBoard` is treated as infallible here: if input
 * passed {@link normalizeBoardString} it is a valid 81-character digit string.
 *
 * @param input - Raw input from the user.
 * @returns A 9x9 numeric board.
 * @throws Error with a user-facing message if normalization fails.
 *
 * @example
 * parseBoard('530070000600195000098000060800060003400803001700020006060000280000419005000080079')
 */
export function parseBoard(input: string): BoardType {
  const normalized = normalizeBoardString(input)

  return deserializeBoard(normalized)
}
