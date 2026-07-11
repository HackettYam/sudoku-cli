import { newContract } from './new.js'
import { solveContract } from './solve.js'
import { validateContract } from './validate.js'
import { hintContract } from './hint.js'
import { playContract } from './play-contract.js'
import type { CommandContract } from './contract.js'

/**
 * The single source of truth for CLI dispatch.
 *
 * Order matters: it determines the order of commands in the top-level
 * help listing. Adding a 6th command is a 2-file change (a new
 * `commands/<n>.ts` and one entry here); `src/args.ts` and `src/cli.ts`
 * are not edited.
 *
 * @see requirements.md AC-2
 * @see design.md Decision 7
 */
export const commands = [
  newContract,
  solveContract,
  validateContract,
  hintContract,
  playContract,
] as const satisfies readonly CommandContract<unknown>[]

/**
 * The union of all command names registered in {@link commands}.
 */
export type CommandName = (typeof commands)[number]['name']

/**
 * Lookup table: command name → contract. Built once at module load.
 */
export const commandsByName: ReadonlyMap<string, CommandContract<unknown>> = new Map(
  commands.map((cmd) => [cmd.name, cmd]),
)
