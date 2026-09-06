import pc from 'picocolors'

/**
 * Determines whether ANSI colors should be enabled.
 * Priority: FORCE_COLOR > NO_COLOR > TTY detection.
 * @param env - The environment object (process.env or custom)
 * @param isStdoutTty - Whether stdout is a TTY
 * @returns true if colors should be enabled
 * @example
 * shouldEnableColors({ FORCE_COLOR: '1' }, false)  // true
 * shouldEnableColors({ NO_COLOR: '1' }, true)       // false
 * shouldEnableColors({}, true)                       // true
 */
export function shouldEnableColors(
  env: Record<string, string | undefined>,
  isStdoutTty: boolean,
): boolean {
  if (env.FORCE_COLOR !== undefined) {
    return true
  }

  if (env.NO_COLOR !== undefined) {
    return false
  }

  return isStdoutTty
}

/**
 * picocolors singleton with colors enabled/disabled based on env.
 * Use this for all color output in the TUI.
 */
export const colors = pc.createColors(
  shouldEnableColors(process.env, process.stdout.isTTY ? true : false),
)
