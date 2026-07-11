/**
 * Type module: CommandContract + helpers.
 *
 * This module is the foundation of the command registry refactor. It
 * declares the type-level shape that every `src/commands/<name>.ts`
 * file must satisfy. There is zero runtime code here: every export is
 * erased at compile time, so importing this module adds nothing to the
 * bundled `dist/cli.js` binary.
 *
 * @see requirements.md AC-1
 * @see design.md Interfaces
 * @see tasks.md T-001
 */

import type { PlayIO, PlayPersistence } from './play.js'
import type { CommandResult } from './result.js'

/**
 * Metadata for a single CLI flag (e.g. `--difficulty`).
 *
 * Consumed by the help-text renderer in `src/args.ts`; not used by
 * {@link CommandContract.parse} itself (which still delegates to
 * `node:util.parseArgs` with `strict: true`).
 */
export interface OptionDef {
  /** Underlying type, as expected by `node:util.parseArgs`. */
  readonly type: 'string' | 'boolean'
  /** Optional single-letter short form (e.g. `'h'` for `-h`). */
  readonly short?: string
  /** Human-readable description shown in the per-command help. */
  readonly desc: string
}

/**
 * Metadata for a single positional argument (e.g. the 81-char board
 * string consumed by `solve`, `validate`, and `hint`).
 */
export interface PositionalDef {
  /** Name used in `parsed.positionals`. */
  readonly name: string
  /** Whether a missing value is a hard error or merely `undefined`. */
  readonly required: boolean
  /** Human-readable description shown in the per-command help. */
  readonly desc: string
}

/**
 * Outcome of {@link CommandContract.parse}.
 *
 * A discriminated union with three variants:
 * - `ok: true` — parse succeeded; carry the typed `args` payload.
 * - `ok: false` — parse failed; carry a user-facing error message.
 * - `ok: 'help'` — caller requested help; render per-command help.
 *
 * @typeParam A - The contract's parsed-args type.
 */
export type ParseResult<A> =
  | { readonly ok: true; readonly args: A }
  | { readonly ok: false; readonly message: string }
  | { readonly ok: 'help' }

/**
 * Runtime dependencies injected into every command runner.
 *
 * Only the `play` command consumes `persistence`; the other commands
 * ignore both fields. Carrying the same shape for every command keeps
 * `cli.ts` free of per-command `CommandContext` variants and lets a
 * future command that needs persistence get it for free.
 *
 * @example
 * ```ts
 * const ctx: CommandContext = {
 *   io: defaultPlayIO(),
 *   persistence: defaultPlayPersistence(),
 * }
 * ```
 */
export interface CommandContext {
  /** I/O surface for the `play` TUI; ignored by other commands. */
  readonly io: PlayIO
  /** Persistence dependencies for the `play` TUI; ignored by others. */
  readonly persistence: PlayPersistence
}

/**
 * The unit of extension: a single CLI subcommand's full contract.
 *
 * Each `src/commands/<name>.ts` exports a `CommandContract<A>` singleton
 * together with its pure `xxxCommand` runner. The `args.ts` parser and
 * the `cli.ts` dispatcher iterate over the registry exported from
 * `src/commands/index.ts` and never branch on the command name.
 *
 * @typeParam A - The contract's parsed-args type (consumed by `run`).
 *
 * @example
 * ```ts
 * export const newContract: CommandContract<NewArgs> = {
 *   name: 'new',
 *   summary: 'Generate a new puzzle',
 *   options: { difficulty: { type: 'string', desc: 'Difficulty level' } },
 *   parse(rest) { return { ok: true, args: { pretty: false } } },
 *   async run(args, ctx) { return newCommand(args) },
 * }
 * ```
 */
export interface CommandContract<A> {
  /** Subcommand name (the first argv element after the bin path). */
  readonly name: string
  /** One-line description shown in the top-level help listing. */
  readonly summary: string
  /** Flag metadata keyed by long form (e.g. `'difficulty'`). */
  readonly options: Readonly<Record<string, OptionDef>>
  /** Optional positional argument metadata. */
  readonly positional?: PositionalDef
  /** Optional header text for per-command help. */
  readonly description?: string
  /** Optional footer text for per-command help. */
  readonly footer?: string
  /**
   * Parse the tail of argv (`process.argv.slice(2)` minus the command
   * name) into the contract's typed `A`. Pure; performs no I/O.
   */
  parse(rest: readonly string[]): ParseResult<A>
  /**
   * Execute the command and return a discriminated {@link CommandResult}
   * that the CLI dispatcher routes to stdout / stderr / exit.
   */
  run(args: A, ctx: CommandContext): Promise<CommandResult>
}
