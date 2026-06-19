/**
 * Centralized stdout/stderr/exit surface.
 *
 * This module is the ONLY place in the codebase that may write to
 * `process.stdout`, `process.stderr`, or call `process.exit`. All other
 * modules return values; the CLI dispatcher is responsible for routing
 * those values through this module.
 *
 * Tests can intercept by spying on the underlying process methods.
 */

/**
 * Writes a single line to stdout, appending a trailing newline if missing.
 *
 * @param text - The line to write. May or may not end in a newline.
 *
 * @example
 * stdout('hello')      // prints "hello\n"
 * stdout('hello\n')    // prints "hello\n" (no double newline)
 */
export function stdout(text: string): void {
  process.stdout.write(text.endsWith('\n') ? text : `${text}\n`)
}

/**
 * Writes a single line to stderr, appending a trailing newline if missing.
 *
 * @param text - The line to write. May or may not end in a newline.
 */
export function stderr(text: string): void {
  process.stderr.write(text.endsWith('\n') ? text : `${text}\n`)
}

/**
 * Terminates the process with the given exit code.
 *
 * Marked `never` so callers must handle the control-flow termination
 * (TypeScript narrows subsequent statements as unreachable).
 *
 * @param code - Process exit code (0 for success, non-zero for failure).
 */
export function exit(code: number): never {
  return process.exit(code) as never
}
