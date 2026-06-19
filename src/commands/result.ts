/**
 * Discriminated union of command results.
 *
 * Commands are pure: they never write to stdout/stderr or call process.exit.
 * The CLI dispatcher in `src/cli.ts` is responsible for converting each
 * variant into the appropriate user-facing output and exit code.
 */
export type CommandResult =
  | { kind: 'new'; serialized: string; difficultyName: string }
  | { kind: 'solved'; serialized: string }
  | { kind: 'valid' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'unsolvable'; reason: string }
  | { kind: 'parse_error'; reason: string }
  | { kind: 'hint'; row: number; col: number; value: number }
  | { kind: 'no_hint' }

/**
 * Process exit codes used by the CLI dispatcher.
 *
 * - 0: success (board produced, valid, or hint returned)
 * - 1: command completed but content was invalid or unavailable
 * - 2: input was unparseable, or a solver failed to find a solution
 */
export const ExitCode = {
  SUCCESS: 0,
  INVALID: 1,
  UNSOLVABLE: 2,
} as const

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]
