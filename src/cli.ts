#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { deserializeBoard } from '@hackettyam/sudoku-tools'
import { parseArgs, HELP_TEXT } from './args.js'
import { newCommand } from './commands/new.js'
import { solveCommand } from './commands/solve.js'
import { validateCommand } from './commands/validate.js'
import { hintCommand } from './commands/hint.js'
import { renderGrid } from './format/grid.js'
import { stdout, stderr, exit } from './output.js'
import type { CommandResult, ExitCodeValue } from './commands/result.js'

/**
 * Reads the package version from the nearest `package.json`.
 *
 * Resolves relative to this file's location so it works both in source
 * (`src/cli.ts` → `../package.json`) and after build (`dist/cli.js` →
 * `../package.json`).
 */
function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version?: string }

  return typeof pkg.version === 'string' ? pkg.version : 'unknown'
}

/**
 * Entry point for the CLI. Parses argv, dispatches to the appropriate
 * command, formats output, and returns the desired process exit code.
 *
 * Pure with respect to its arguments: no global state, no `process.exit`
 * calls. The bin wrapper at the bottom of this file is responsible for
 * calling `process.exit` with the returned code.
 *
 * @param argv - Typically `process.argv.slice(2)`.
 * @returns The process exit code (0 for success, non-zero for failure).
 *
 * @example
 * const code = await run(['new', '--difficulty', 'hard'])
 * // → 0, with the puzzle printed to stdout
 */
export async function run(argv: readonly string[]): Promise<ExitCodeValue> {
  const args = parseArgs(argv)

  switch (args.kind) {
    case 'help':
      stdout(HELP_TEXT)
      return 0
    case 'error':
      stderr(args.message)
      return 2
    case 'new':
      return handleResult(newCommand(args.difficulty !== undefined ? { difficulty: args.difficulty } : {}), args.pretty)
    case 'solve':
      return handleResult(solveCommand(args.board), false)
    case 'validate':
      return handleResult(validateCommand(args.board), false)
    case 'hint':
      return handleResult(hintCommand(args.board), false)
  }
}

/**
 * Routes a {@link CommandResult} to stdout/stderr and the right exit code.
 *
 * @param result - Output of a pure command function.
 * @param pretty - If true, `new` results also print a 9x9 ASCII grid.
 * @returns The process exit code.
 */
function handleResult(result: CommandResult, pretty: boolean): ExitCodeValue {
  switch (result.kind) {
    case 'new':
      stdout(result.serialized)

      if (pretty) {
        stderr('')
        stderr(`Difficulty: ${result.difficultyName}`)
        stderr(renderGrid(deserializeBoard(result.serialized)))
      }

      return 0
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
      stdout(`Hint: row=${result.row} col=${result.col} value=${result.value}`)
      return 0
    case 'no_hint':
      stderr('No hint available (puzzle is already complete).')
      return 1
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
      (cause) => {
        stderr(`Unexpected error: ${cause instanceof Error ? cause.message : String(cause)}`)
        exit(1)
      },
    )
  }
}
