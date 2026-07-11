/**
 * Map a `parseUtilArgs` failure to a user-facing message.
 *
 * Shared by every `CommandContract.parse` implementation. Copied
 * verbatim from the pre-registry `src/args.ts` private helper.
 *
 * @param cause - The thrown value from `parseUtilArgs` (in `strict: true` mode).
 * @returns A single-line message safe for stderr.
 */
export function errorMessage(cause: unknown): string {
  const msg = cause instanceof Error ? cause.message : String(cause)

  if (msg.includes('argument missing')) {
    return `${msg}. Run 'sudoku-cli --help'.`
  }

  return `Invalid arguments: ${msg}. Run 'sudoku-cli --help'.`
}
