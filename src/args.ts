import type { CommandContract, OptionDef, PositionalDef } from './commands/contract.js'
import { commands, commandsByName, type CommandName } from './commands/index.js'

/**
 * Discriminated union over the registry.
 *
 * Computed via four explicit variants (rather than a mapped type) so the
 * dispatcher in `cli.ts` can branch on `kind` without narrowing `unknown`
 * at every case. The `cmd` variant carries the parsed `args: unknown`;
 * `cli.ts` casts to the contract-specific type when dispatching.
 *
 * @see requirements.md AC-3
 * @see design.md Decision 3
 */
export type ParsedArgs =
  | { readonly kind: 'top_help' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'cmd_help'; readonly command: CommandName; readonly helpText: string }
  | { readonly kind: 'cmd'; readonly command: CommandName; readonly args: unknown }

/** Pad `s` to `width` with trailing spaces. */
function padEnd(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length)
}

/**
 * Hardcoded placeholder map for byte-equal HELP_TEXT promise (AC-4).
 *
 * Options with a `string` type get a placeholder shown in help text.
 * Most options use the generic `<value>`; a few are named for clarity.
 */
function getOptionPlaceholder(name: string, def: OptionDef): string | undefined {
  if (def.type === 'boolean') return undefined
  const placeholders: Readonly<Record<string, string>> = {
    difficulty: '<level>',
    load: '<id>',
  }
  return placeholders[name] ?? '<value>'
}

/** Format a positional argument for a usage line. */
function formatPositional(positional: PositionalDef): string {
  const opening = positional.required ? '<' : '[<'
  const closing = positional.required ? '>' : '>]'
  return `${opening}${positional.name}${closing}`
}

/** Format the "name [options/positional]" portion of a top-level help row. */
function formatName(contract: CommandContract<unknown>): string {
  const userOptions = Object.entries(contract.options).filter(([n]) => n !== 'help')

  if (userOptions.length >= 3) {
    return `${contract.name} [options]`
  }

  const parts: string[] = [contract.name]

  if (contract.positional !== undefined) {
    parts.push(formatPositional(contract.positional))
  }

  for (const [optName, optDef] of userOptions) {
    const placeholder = getOptionPlaceholder(optName, optDef)
    if (optDef.type === 'string' && placeholder !== undefined) {
      parts.push(`[--${optName} ${placeholder}]`)
    } else {
      parts.push(`[--${optName}]`)
    }
  }

  return parts.join(' ')
}

/** Format the usage line for a command-specific help page. */
function formatCommandUsage(contract: CommandContract<unknown>): string {
  const usageParts: string[] = [contract.name]

  if (contract.positional !== undefined) {
    usageParts.push(formatPositional(contract.positional))
  }
  if (Object.keys(contract.options).length > 0) {
    usageParts.push('[options]')
  }

  return `Usage: sudoku-cli ${usageParts.join(' ')}`
}

/** Append an optional command description to help lines. */
function appendDescription(lines: string[], contract: CommandContract<unknown>): void {
  if (contract.description === undefined) {
    return
  }
  lines.push('', contract.description)
}

/** Append the user-facing option table to help lines. */
function appendOptionHelp(lines: string[], contract: CommandContract<unknown>): void {
  const userOptions = Object.entries(contract.options).filter(([name]) => name !== 'help')
  if (userOptions.length === 0) {
    return
  }

  lines.push('', 'Options:')
  for (const [optName, optDef] of userOptions) {
    const placeholder = getOptionPlaceholder(optName, optDef)
    const valueSuffix = optDef.type === 'string' && placeholder !== undefined ? ` ${placeholder}` : ''
    const longFlag = `--${optName}${valueSuffix}`
    lines.push(`  ${padEnd(longFlag, 24)}${optDef.desc}`)
  }
}

/** Append the standard short help option, when one is defined. */
function appendHelpOption(lines: string[], contract: CommandContract<unknown>): void {
  const helpOpt = contract.options.help
  if (helpOpt === undefined || helpOpt.short === undefined) {
    return
  }
  lines.push(`  ${padEnd('-' + helpOpt.short + ', --help', 24)}${helpOpt.desc}`)
}

/** Append an optional command footer to help lines. */
function appendFooter(lines: string[], contract: CommandContract<unknown>): void {
  if (contract.footer === undefined) {
    return
  }
  lines.push('', contract.footer)
}

/**
 * Render the top-level CLI usage text.
 *
 * @param cmds - The full command registry (from `src/commands/index.js`).
 * @returns A multi-line string with column-aligned command rows.
 *
 * @see requirements.md AC-4
 */
export function renderTopHelp(cmds: readonly CommandContract<unknown>[]): string {
  const COL_WIDTH = 42
  const rows = cmds.map((c) => {
    const name = formatName(c)
    return `  ${padEnd(name, COL_WIDTH - 2)}${c.summary}`
  })
  return [
    'Usage: sudoku-cli <command> [options]',
    '',
    'Commands:',
    ...rows,
    '',
    'Difficulty levels: novice, easy, normal, hard, expert (default: normal)',
    "Run 'sudoku-cli <command> --help' for command-specific help.",
    '',
  ].join('\n')
}

/**
 * Render per-command help text.
 *
 * @param contract - The command contract to render help for.
 * @returns A multi-line string with usage, description, options table, and footer.
 *
 * @see requirements.md AC-5
 */
export function renderCommandHelp(contract: CommandContract<unknown>): string {
  const lines: string[] = [formatCommandUsage(contract)]

  appendDescription(lines, contract)
  appendOptionHelp(lines, contract)
  appendHelpOption(lines, contract)
  appendFooter(lines, contract)

  return lines.join('\n') + '\n'
}

/**
 * Parses the process argv vector (excluding `node` and script path).
 *
 * @param argv - Typically `process.argv.slice(2)`.
 * @returns A {@link ParsedArgs} discriminated union.
 *
 * @example
 * parseArgs(['new', '--difficulty', 'hard'])
 * // { kind: 'cmd', command: 'new', args: { difficulty: 'hard', pretty: false } }
 *
 * @example
 * parseArgs(['--help'])
 * // { kind: 'top_help' }
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const name = argv[0]

  if (name === undefined || name === '--help' || name === '-h') {
    return { kind: 'top_help' }
  }

  if (name === '--version' || name === '-v') {
    return { kind: 'error', message: 'handled by bin wrapper' }
  }

  const contract = commandsByName.get(name)
  if (contract === undefined) {
    return { kind: 'error', message: `Unknown command: '${name}'. Run 'sudoku-cli --help'.` }
  }

  const result = contract.parse(argv.slice(1))

  if (result.ok === 'help') {
    return {
      kind: 'cmd_help',
      command: name,
      helpText: renderCommandHelp(contract),
    }
  }

  if (!result.ok) {
    return { kind: 'error', message: result.message }
  }

  return { kind: 'cmd', command: name, args: result.args }
}

/** Top-level usage text, printed for `--help` and on error. */
export const HELP_TEXT: string = renderTopHelp(commands)

/** Per-command help text, keyed by command name. */
export const HELP_TEXT_BY_NAME: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(commands.map((c) => [c.name, renderCommandHelp(c)])),
)

/** @deprecated Use {@link HELP_TEXT_BY_NAME} `['play']` instead. */
export const HELP_TEXT_PLAY: string = HELP_TEXT_BY_NAME['play'] ?? ''
