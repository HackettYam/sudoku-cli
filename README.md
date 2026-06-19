# @hackettyam/sudoku-cli

> Command-line interface for Sudoku: generate, solve, validate, and hint puzzles.

A thin CLI on top of the [`@hackettyam/sudoku-tools`](https://www.npmjs.com/package/@hackettyam/sudoku-tools) library. Zero runtime dependencies beyond that library — the CLI uses Node's built-in `util.parseArgs` for argument parsing.

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
