import { Difficulty, type DifficultyType } from '@hackettyam/sudoku-tools'

/**
 * Difficulty flag values accepted on the CLI.
 *
 * Matches {@link Difficulty} enum members, lowercased.
 */
const CLI_DIFFICULTY_NAMES = ['novice', 'easy', 'normal', 'hard', 'expert'] as const

/**
 * Type of a difficulty value as accepted on the CLI.
 */
export type CliDifficultyName = (typeof CLI_DIFFICULTY_NAMES)[number]

/**
 * Default difficulty level used when `--difficulty` is not provided.
 */
export const DEFAULT_DIFFICULTY: Difficulty = Difficulty.Normal

/**
 * Parses a CLI difficulty flag value into a {@link Difficulty} enum member.
 *
 * Accepts case-insensitive input. Returns {@link DEFAULT_DIFFICULTY} when the
 * input is `undefined` or an empty string.
 *
 * @param value - The raw flag value, or `undefined`.
 * @returns The matching `Difficulty` value.
 * @throws Error if the value is non-empty but not a recognized difficulty name.
 *
 * @example
 * parseDifficulty('hard')    // Difficulty.Hard
 * parseDifficulty(undefined) // Difficulty.Normal
 */
export function parseDifficulty(value: string | undefined): Difficulty {
  if (value === undefined || value === '') {
    return DEFAULT_DIFFICULTY
  }

  const normalized = value.toLowerCase() as CliDifficultyName

  if (!(CLI_DIFFICULTY_NAMES as readonly string[]).includes(normalized)) {
    throw new Error(
      `Invalid difficulty: '${value}'. Must be one of: ${CLI_DIFFICULTY_NAMES.join(', ')}.`,
    )
  }

  return difficultyFromName(normalized)
}

/**
 * Maps a CLI difficulty name (lowercased) to its {@link Difficulty} value.
 *
 * @param name - A {@link CliDifficultyName}.
 * @returns The matching `Difficulty` value.
 */
function difficultyFromName(name: CliDifficultyName): Difficulty {
  switch (name) {
    case 'novice': return Difficulty.Novice
    case 'easy': return Difficulty.Easy
    case 'normal': return Difficulty.Normal
    case 'hard': return Difficulty.Hard
    case 'expert': return Difficulty.Expert
  }
}

/**
 * Returns the CLI-friendly name for a given {@link Difficulty} value.
 *
 * @param difficulty - A library `Difficulty` value.
 * @returns The lowercased name suitable for CLI output.
 */
export function difficultyToName(difficulty: DifficultyType): CliDifficultyName {
  switch (difficulty) {
    case Difficulty.Novice: return 'novice'
    case Difficulty.Easy: return 'easy'
    case Difficulty.Normal: return 'normal'
    case Difficulty.Hard: return 'hard'
    case Difficulty.Expert: return 'expert'
    default: return 'normal'
  }
}
