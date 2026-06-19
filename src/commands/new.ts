import { createSudoku, serializeBoard } from '@hackettyam/sudoku-tools'
import { parseDifficulty, difficultyToName } from '../format/difficulty.js'
import type { CommandResult } from './result.js'

/**
 * Options accepted by the `new` subcommand.
 */
export interface NewOptions {
  /** Raw difficulty flag value (case-insensitive). `undefined` ⇒ default. */
  difficulty?: string
}

/**
 * Generates a new Sudoku puzzle at the requested difficulty.
 *
 * @param options - Optional difficulty flag value.
 * @returns A `new` result carrying the serialized puzzle and difficulty name,
 *          or `parse_error` if the difficulty flag is invalid.
 *
 * @example
 * newCommand({ difficulty: 'hard' })
 */
export function newCommand(options: NewOptions = {}): CommandResult {
  let difficulty: ReturnType<typeof parseDifficulty>

  try {
    difficulty = parseDifficulty(options.difficulty)
  } catch (cause) {
    return {
      kind: 'parse_error',
      reason: cause instanceof Error ? cause.message : String(cause),
    }
  }

  const puzzle = createSudoku(difficulty)

  return {
    kind: 'new',
    serialized: serializeBoard(puzzle.original),
    difficultyName: difficultyToName(difficulty),
  }
}
