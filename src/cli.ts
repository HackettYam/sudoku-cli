#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseArgs, HELP_TEXT } from './args.js'
import type { CommandContext } from './commands/contract.js'
import { commandsByName } from './commands/index.js'
import { defaultPlayIO, defaultPlayPersistence } from './commands/play.js'
import type { CommandResult, ExitCodeValue } from './commands/result.js'
import { parseBoard } from './format/board-string.js'
import { renderGrid } from './format/grid.js'
import { stdout, stderr, exit } from './output.js'

/** Reads the package version from `package.json` next to this file. */
function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version?: string }
  return typeof pkg.version === 'string' ? pkg.version : 'unknown'
}

/** Build the shared `CommandContext` (only `play` consumes its deps). */
function buildContext(): CommandContext {
  return {
    io: defaultPlayIO(),
    persistence: defaultPlayPersistence(),
  }
}

/**
 * Pop the `pretty` flag from a `new` subcommand's parsed args.
 *
 * The `new` contract carries `pretty` in its `NewArgs` shape (a CLI-rendering
 * concern) but its `run` ignores it. The dispatcher reads the flag here and
 * passes it to {@link handleResult} after `run` returns, so the contract
 * stays free of presentation logic.
 */
function extractPretty(args: unknown): { pretty: boolean; rest: unknown } {
  if (typeof args === 'object' && args !== null && 'pretty' in args) {
    const obj = args as Record<string, unknown>
    const { pretty, ...rest } = obj
    return { pretty: pretty === true, rest }
  }
  return { pretty: false, rest: args }
}

type NewResult = Extract<CommandResult, { kind: 'new' }>
type PlayExitResult = Extract<CommandResult, { kind: 'play_exit' }>
type LinesResult = Extract<CommandResult, { lines: readonly string[] }>
type SimpleResult = Exclude<CommandResult, NewResult | PlayExitResult | LinesResult>

/** Route a generated puzzle to the requested output streams. */
function handleNewResult(result: NewResult, pretty: boolean): ExitCodeValue {
  stdout(result.serialized)
  if (!pretty) {
    return 0
  }

  stderr('')
  stderr(`Difficulty: ${result.difficultyName}`)
  stderr(renderGrid(parseBoard(result.serialized)))
  return 0
}

/** Route the interactive command's exit result. */
function handlePlayExit(result: PlayExitResult): ExitCodeValue {
  if (result.reason === 'error') {
    stderr(result.message ?? 'Unknown error')
    return 2
  }
  return 0
}

/** Route line-oriented play subcommand output. */
function handleLinesResult(result: LinesResult): ExitCodeValue {
  for (const line of result.lines) {
    stdout(line)
  }
  return 0
}

/** Route the non-play command results. */
function handleSimpleResult(result: SimpleResult): ExitCodeValue {
  switch (result.kind) {
    case 'solved':
      stdout(result.serialized)
      return 0
    case 'valid':
      stdout('valid')
      return 0
    case 'invalid':
      stderr(result.reason)
      return 1
    case 'unsolvable':
      stderr(result.reason)
      return 2
    case 'parse_error':
      stderr(result.reason)
      return 2
    case 'hint':
      stdout(`Hint: row=${String(result.row)} col=${String(result.col)} value=${String(result.value)}`)
      return 0
    case 'no_hint':
      stderr('No hint available (puzzle is already complete).')
      return 1
  }
}

/** Identify results that contain already-formatted output lines. */
function hasOutputLines(result: CommandResult): result is LinesResult {
  return 'lines' in result
}

/** Routes a {@link CommandResult} to stdout/stderr and the right exit code. */
function handleResult(result: CommandResult, pretty: boolean): ExitCodeValue {
  if (result.kind === 'new') {
    return handleNewResult(result, pretty)
  }
  if (result.kind === 'play_exit') {
    return handlePlayExit(result)
  }
  if (hasOutputLines(result)) {
    return handleLinesResult(result)
  }
  return handleSimpleResult(result)
}

/**
 * CLI entry point. Parses argv, dispatches to the matching command via the
 * registry, formats output, and returns the desired process exit code.
 *
 * @param argv - Typically `process.argv.slice(2)`.
 * @returns The process exit code (0 for success, non-zero for failure).
 *
 * @example
 * const code = await run(['new', '--difficulty', 'hard'])
 * // → 0, with the puzzle printed to stdout
 */
export async function run(argv: readonly string[]): Promise<ExitCodeValue> {
  const parsed = parseArgs(argv)
  const ctx = buildContext()

  switch (parsed.kind) {
    case 'top_help':
      stdout(HELP_TEXT)
      return 0
    case 'cmd_help':
      stdout(parsed.helpText)
      return 0
    case 'error':
      stderr(parsed.message)
      return 2
    case 'cmd': {
      const contract = commandsByName.get(parsed.command)
      if (contract === undefined) {
        stderr(`Internal error: command '${parsed.command}' not found in registry.`)
        return 2
      }

      const { pretty, rest } = parsed.command === 'new'
        ? extractPretty(parsed.args)
        : { pretty: false, rest: parsed.args }
      const result = await contract.run(rest, ctx)
      return handleResult(result, pretty)
    }
  }
}

// Bin entry: only executed when this file is the script invoked by Node.
// `realpathSync` resolves symlinks so npm-installed bins (which link into
// the global bin directory) still match.
const entryFile = process.argv[1]

if (entryFile !== undefined) {
  let isMain = false

  try {
    isMain = realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entryFile)
  } catch {
    isMain = false
  }

  if (isMain) {
    const wantsVersion = process.argv.includes('--version') || process.argv.includes('-v')

    if (wantsVersion) {
      stdout(`@hackettyam/sudoku-cli v${readVersion()}`)
      exit(0)
    }

    run(process.argv.slice(2)).then(
      (code) => exit(code),
      (cause: unknown) => {
        stderr(`Unexpected error: ${cause instanceof Error ? cause.message : String(cause)}`)
        exit(1)
      },
    )
  }
}
