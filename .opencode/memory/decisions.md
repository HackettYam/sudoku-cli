# feature-play-mode: Implementation Decisions

## Date: 2026-07-09

### Library API
- `createSudoku(difficulty)` returns `SudokuPuzzle` object (not plain boards)
- `setCellValue(board, { row, col, value })` uses options object
- `getHint(board, solved)` returns `HintResult | null`
- `DifficultyType` is enum: must use `Difficulty.Normal`, not `'normal'`

### Architecture
- Pure state machine in `game/state.ts` — immutable `GameState`, every move returns new state
- FsAdapter + LockFactory DI for persistence testability
- `runTuiSession` handles raw mode + alt screen + signal cleanup
- `picocolors` for terminal colors (G-20 exception #1)
- `proper-lockfile` for cross-process locking (G-20 exception #2)

### Build Stats
- `dist/cli.js` = ~122 kB
- 418 tests, 24 test files
- Coverage: 98.6% lines

### Key Decisions
1. `play` subcommand (not `--interactive` on `new`)
2. Built-in Node TTY (no blessed/ink)
3. State in `~/.sudoku-cli/state.json`
4. Atomic writes via tmp+rename
5. 11 achievements, table-driven evaluator
