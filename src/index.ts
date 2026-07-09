/**
 * @hackettyam/sudoku-cli — public programmatic API.
 *
 * The primary user-facing surface of this package is the `sudoku-cli`
 * command-line binary (see `dist/cli.js`). This module exposes a small
 * programmatic API for embedders who want to invoke the same logic
 * from another Node.js process without spawning a child.
 *
 * The package does NOT re-export the underlying `@hackettyam/sudoku-tools`
 * library; consumers should depend on that package directly when they need
 * lower-level access.
 */

export { run } from './cli.js'
export { newCommand, type NewOptions } from './commands/new.js'
export { solveCommand } from './commands/solve.js'
export { validateCommand } from './commands/validate.js'
export { hintCommand } from './commands/hint.js'
export { type CommandResult, ExitCode, type ExitCodeValue } from './commands/result.js'
export { parseBoard, normalizeBoardString } from './format/board-string.js'
export { renderGrid } from './format/grid.js'
export {
  parseDifficulty,
  difficultyToName,
  DEFAULT_DIFFICULTY,
  type CliDifficultyName,
} from './format/difficulty.js'
export { BOARD_LENGTH } from './format/constants.js'

// Play module — interactive TUI game
export { playCommand } from './commands/play.js'
export type { PlayOptions, PlayCommandResult, PlayExitReason, PlayIO } from './commands/play.js'
export { createGame, applyMove, isWon, getStats } from './game/state.js'
export type { GameState, Move, CellPosition, GameStatus, WinView } from './game/state.js'
export { parseKeypress, renderGame } from './tui.js'
export type { ParsedKey, RenderOptions } from './tui.js'
export { shouldEnableColors } from './format/colors.js'
