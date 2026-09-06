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
  return process.exit(code)
}

// ---------------------------------------------------------------------------
// TUI session helpers
// ---------------------------------------------------------------------------

/**
 * Key sink callback type.
 *
 * @param key - The raw key buffer received from stdin.
 */
export type KeySink = (key: Buffer) => void

/**
 * Options for a TUI session.
 */
export interface TuiSessionOptions {
  /** Whether to enable ANSI color output. */
  readonly colorsEnabled: boolean
  /** Called for every key press (raw buffer). */
  readonly onKey: (key: Buffer) => void
  /** Called to render the current frame. */
  readonly render: () => void
}

/**
 * Handle returned by {@link runTuiSession} for programmatic control.
 */
export interface TuiRunner {
  /** Enter alt screen, hide cursor, and render once. */
  draw(): void
  /** Show cursor, leave alt screen, restore raw mode. Idempotent. */
  cleanup(): void
  /** Start listening for keys and signals until cleanup. */
  run(): Promise<void>
}

/**
 * Creates and runs a TUI session.
 *
 * Handles raw mode, alt screen, and signal cleanup.
 * - `draw()` enters alt screen and renders.
 * - `cleanup()` restores the terminal. Idempotent.
 * - `run()` sets raw mode, listens for key data, and handles SIGINT/SIGTERM.
 *
 * @param opts - Session configuration.
 * @returns A {@link TuiRunner} for controlling the session.
 *
 * @example
 * const runner = runTuiSession({
 *   colorsEnabled: true,
 *   onKey: (key) => { if (key[0] === 0x03) runner.cleanup() },
 *   render: () => drawBoard(),
 * })
 * runner.draw()
 * await runner.run()
 */
export function runTuiSession(opts: TuiSessionOptions): TuiRunner {
  let cleanedUp = false
  let previousRawMode: boolean | undefined

  const ALT_SCREEN_ENTER = '\x1b[?1049h'
  const ALT_SCREEN_EXIT = '\x1b[?1049l'
  const CURSOR_HIDE = '\x1b[?25l'
  const CURSOR_SHOW = '\x1b[?25h'

  function draw(): void {
    process.stdout.write(ALT_SCREEN_ENTER)
    process.stdout.write(CURSOR_HIDE)
    opts.render()
  }

  function cleanup(): void {
    if (cleanedUp) {
      return
    }
    cleanedUp = true

    process.stdout.write(CURSOR_SHOW)
    process.stdout.write(ALT_SCREEN_EXIT)

    // Restore previous raw mode
    if (process.stdin.isTTY && previousRawMode !== undefined) {
      process.stdin.setRawMode(previousRawMode)
    }

    // Remove event listeners
    process.stdin.removeListener('data', onStdinData)
    process.removeListener('SIGINT', onSigint)
    process.removeListener('SIGTERM', onSigterm)
    process.removeListener('exit', onExit)
  }

  function onStdinData(chunk: Buffer): void {
    opts.onKey(chunk)
  }

  function onSigint(): void {
    cleanup()
    process.exit(130)
  }

  function onSigterm(): void {
    cleanup()
    process.exit(0)
  }

  function onExit(): void {
    cleanup()
  }

  function run(): Promise<void> {
    // Save and enter raw mode
    if (process.stdin.isTTY) {
      previousRawMode = process.stdin.isRaw
      process.stdin.setRawMode(true)
    }

    process.stdin.resume()
    process.stdin.on('data', onStdinData)

    process.on('SIGINT', onSigint)
    process.on('SIGTERM', onSigterm)
    process.on('exit', onExit)

    return new Promise<void>((_resolve) => {
      // Resolved externally via cleanup; the promise lives for signal handling.
    })
  }

  return { draw, cleanup, run }
}
