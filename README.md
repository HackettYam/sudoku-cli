# @hackettyam/sudoku-cli

> Command-line interface for Sudoku: generate, solve, validate, hint, and play puzzles interactively.

A thin CLI on top of the [`@hackettyam/sudoku-tools`](https://www.npmjs.com/package/@hackettyam/sudoku-tools) library. Two runtime dependencies beyond that library — `picocolors` (terminal colors) and `proper-lockfile` (file locking for persistence). The CLI uses Node's built-in `util.parseArgs` for argument parsing.

## Install

```bash
pnpm add -g @hackettyam/sudoku-cli
```

Or run without installing:

```bash
npx @hackettyam/sudoku-cli new --difficulty easy
```

## Usage

### `sudoku-cli new`

Generate a new puzzle.

```bash
sudoku-cli new
sudoku-cli new --difficulty hard
sudoku-cli new --difficulty expert --pretty
```

Difficulty levels: `novice` (31 empty), `easy` (41), `normal` (46, default), `hard` (51), `expert` (61).

Output is an 81-character string (`0` = empty) by default. With `--pretty`, also prints a 9x9 ASCII grid to stderr for human reading.

### `sudoku-cli solve <board>`

Solve a puzzle given as an 81-character string.

```bash
sudoku-cli solve 530070000600195000098000060800060003400803001700020006060000280000419005000080079
```

Exit code: `0` solved, `2` unsolvable or unparseable.

### `sudoku-cli validate <board>`

Check whether a board follows Sudoku rules (rows, columns, and 3x3 boxes contain each digit 0-9 at most once; empty cells ignored).

```bash
sudoku-cli validate 530070000600195000098000060800060003400803001700020006060000280000419005000080079
```

Exit code: `0` valid, `1` invalid, `2` unparseable.

### `sudoku-cli hint <board>`

Suggest the next move. Internally solves the puzzle first to derive the solution, then returns one cell and its correct value.

```bash
sudoku-cli hint 530070000600195000098000060800060003400803001700020006060000280000419005000080079
# Hint: row=0 col=3 value=1
```

Exit code: `0` hint printed, `1` puzzle already complete, `2` unparseable/unsolvable.

### `sudoku-cli play`

Interactive TUI Sudoku game with persistence, stats, achievements, and a leaderboard.

```bash
sudoku-cli play                          # start a new game (normal difficulty)
sudoku-cli play --difficulty easy        # start at a specific difficulty
sudoku-cli play --resume                 # resume the last saved game
sudoku-cli play --load <save-id>         # load a specific save
sudoku-cli play --stats                  # show per-difficulty statistics
sudoku-cli play --achievements           # show achievement list
sudoku-cli play --leaderboard            # show best times and moves
```

> **Note:** The `play` command requires a TTY (interactive terminal). It will not work in pipes or non-interactive sessions.

#### Keybindings

| Key | Action |
|-----|--------|
| Arrow keys | Move cursor |
| `Home` / `End` | Jump to row start / end |
| `Ctrl+Home` / `Ctrl+End` | Jump to board top-left / bottom-right |
| `1`–`9` | Place digit at cursor |
| `Backspace` / `Delete` | Clear cell at cursor |
| `0` | Clear cell at cursor |
| `u` | Undo last move |
| `h` | Show hint |
| `n` | New game (after winning or quitting) |
| `q` / `Escape` / `Ctrl+C` | Quit |

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Game exited normally (quit or won) |
| `2` | Error (e.g., TTY required, internal error) |

### Persistence

Game state is persisted in `~/.sudoku-cli/`:

| Path | Contents |
|------|----------|
| `state.json` | Per-difficulty stats, win counts, achievement unlocks, best times |
| `state.json.lock` | Lock file (managed by `proper-lockfile`) |
| `saves/` | Saved game positions (one file per save) |

All files are created on first use and updated atomically.

### Save and resume

When you quit mid-game, you are prompted to save. Saved games are stored in `~/.sudoku-cli/saves/` and can be resumed later:

```bash
sudoku-cli play --resume        # resume the most recent save
sudoku-cli play --load <id>     # resume a specific save by ID
```

### Stats

View per-difficulty statistics including games played, won, total time, and best time:

```bash
sudoku-cli play --stats
```

### Achievements

There are 11 achievements to unlock:

| ID | Title | Condition |
|----|-------|-----------|
| `first_win` | First Win | Win your first game at novice difficulty |
| `speed_demon` | Speed Demon | Win an easy game in under 5 minutes |
| `no_hints_easy` | No Hints | Win an easy game without using hints |
| `perfectionist` | Perfectionist | Win a normal game with no errors and no undo |
| `minimalist` | Minimalist | Win a normal game with 45 or fewer moves |
| `no_undo` | No Undo | Win a hard game without using undo |
| `speedrunner` | Speedrunner | Win a hard game in under 10 minutes |
| `flawless_victory` | Flawless Victory | Win an expert game with no errors |
| `untouchable` | Untouchable | Win an expert game without hints |
| `century` | Century | Win 100 games across all difficulties |
| `completionist` | Completionist | Win at least one game at every difficulty |

### Leaderboard

View your best times and move counts per difficulty:

```bash
sudoku-cli play --leaderboard
```

## Board format

A board is always **81 characters**, digits `0`-`9`, row-major. `0` represents an empty cell. Example (top row of a solved board):

```
123456789
```

…padded to 81 characters for a full puzzle. The library's `serializeBoard` and `deserializeBoard` functions use the same format.

## Requirements

- Node.js `>=18.3.0` (for `util.parseArgs`)

## License

MIT © hackettyam — see [LICENSE](./LICENSE).
