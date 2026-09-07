# AGENTS.md

> Repo-specific guidance for OpenCode sessions working on `@hackettyam/sudoku-cli`.
> Global TypeScript / testing / security / language rules live in
> `~/.config/opencode/AGENTS.md` and are inherited.

## Stack

- Node `>=18.3.0` (for built-in `util.parseArgs`)
- TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- pnpm 10 (sole PM — global rule G-20)
- ESM only (`"type": "module"`, `module/moduleResolution: NodeNext`)
- Runtime dependencies are `@hackettyam/sudoku-tools`, `picocolors`, and `proper-lockfile`.
- Vitest 3.2.7 + strict ESLint 9 flat config with typed, import, and clean-code rules + `@stylistic/eslint-plugin`

## Commands (run in this order when verifying a change)

```bash
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm lint
pnpm test
pnpm test:coverage # 100% lines/statements/functions; 96.6% branches (not enforced)
pnpm build         # tsc types + esbuild bundles dist/cli.js and dist/index.js
node dist/cli.js new --difficulty easy   # smoke test the published bin
```

`pnpm build` runs `build:types` then `build:bundle`. The bundle emits the bundled `dist/cli.js` and `dist/index.js`; `dist/cli.js` is the bin (see "Build" below).

## Architecture

```
src/
├── cli.ts            # registry-driven dispatcher; entry point for `node dist/cli.js`
├── index.ts          # programmatic API surface (re-exports run + commands)
├── output.ts         # ONLY module allowed to write to stdout/stderr/exit
├── args.ts           # registry-driven argv parser (util.parseArgs) + auto-rendered HELP_TEXT
├── commands/         # pure functions; return CommandResult, no I/O
│   ├── new.ts        #   createSudoku() → serialize
│   ├── solve.ts      #   solvePuzzle(board)
│   ├── validate.ts   #   isValidPuzzle(board)
│   ├── hint.ts       #   solvePuzzle + getHint (always re-solves)
│   ├── result.ts     #   CommandResult discriminated union + ExitCode
│   ├── contract.ts   #   CommandContract<A> type + ParseResult / CommandContext
│   └── index.ts      #   `commands` registry (single source of truth) + CommandName lookup
└── format/           # pure formatters, depend on the library
    ├── board-string.ts   # parse/normalize 81-char input
    ├── grid.ts           # 9x9 ASCII renderer
    ├── difficulty.ts     # CLI flag → Difficulty enum
    └── constants.ts      # BOARD_LENGTH = 81
```

The dispatch surface is data-driven: each `commands/<name>.ts` exports a `CommandContract<…>` singleton; the `commands` array in `src/commands/index.ts` is the single source of truth. Adding a 6th command is a 2-file change (new `commands/<n>.ts` + one entry in the registry). `args.ts` and `cli.ts` are not edited.

### CLI subcommands

| Name | Contract file | Summary |
|------|---------------|---------|
| `new` | `src/commands/new.ts` | Generate a new puzzle |
| `solve` | `src/commands/solve.ts` | Solve a puzzle from an 81-char board |
| `validate` | `src/commands/validate.ts` | Check whether a board follows Sudoku rules |
| `hint` | `src/commands/hint.ts` | Suggest the next move (always re-solves internally) |
| `play` | `src/commands/play-contract.ts` | Interactive TUI game with persistence, stats, achievements, leaderboard |

**Hard rule:** only `src/output.ts` touches `process.stdout/stderr/exit`. All other modules return values; `src/cli.ts` is the single place that translates results to I/O.

## Library: `@hackettyam/sudoku-tools`

- Pin: `^1.0.0` (the only published version)
- The package is a **pure consumer** here. Do not re-export its symbols from `src/index.ts`; consumers needing library code should depend on `@hackettyam/sudoku-tools` directly.
- Do **not** add wrappers around its functions unless you also add value (validation, normalization, error mapping). Most of our wrappers exist for that reason.

### Known library gaps

- **No seed parameter.** Neither `createSudoku(difficulty)` nor `generatePuzzle(difficulty)` accepts a seed. The CLI therefore has no `--seed` flag. If a future library version adds seeds, add the flag in `args.ts` and `commands/new.ts`.
- **`getHint(board, solved)` is a static util that needs both the current and solved board.** The `hint` subcommand always re-solves internally via `solvePuzzle`. If you change this, keep the cost in mind: the solver is a backtracker.
- **`solvePuzzle` returns `BoardType | null`** — `null` means no solution (e.g., rule violations). Do not treat `null` as an error; it is a valid `unsolvable` result.

### Build-time workaround for the library

The published `@hackettyam/sudoku-tools@1.0.0` ships a broken ESM dist (unresolved `@/...` TypeScript path aliases and bare directory imports). Plain Node ESM cannot load it. The project works around this by **bundling with esbuild** in `scripts/build.mjs`. Two plugins handle the resolution:

- `sudoku-tools-resolver` rewrites `@/...` imports to absolute paths under the library's `dist/`.
- The same plugin appends `/index.js` to directory imports and `.js` to file imports.

**This is a build-time workaround, not a runtime patch.** The library source in `node_modules` is never modified. If a future library version fixes the dist, you can drop both plugins and ship a thin `dist/cli.js` built with plain `tsc`. See `scripts/build.mjs` for details.

Tests use a similar workaround: `vitest.config.ts` registers the same `@/` → `dist/` mapping via `resolve.alias` so vitest can load the library at test time.

## CLI conventions

- **Board string format:** exactly 81 characters of digits `0`-`9`, row-major. `0` is empty. The library's `serializeBoard`/`deserializeBoard` enforce this; `src/format/board-string.ts` adds whitespace stripping and a user-friendly error.
- **Difficulty flag values:** `novice`, `easy`, `normal`, `hard`, `expert` (case-insensitive). Default is `normal` (maps to `Difficulty.Normal`).
- **Exit codes** (see `src/commands/result.ts`): `0` success · `1` invalid / no hint · `2` parse error / unsolvable. The dispatcher in `src/cli.ts` is the only place these are produced.
- **Stdout vs stderr:** puzzle data and "valid" / "Hint: ..." go to stdout. Errors, the difficulty line, and the ASCII grid (with `--pretty`) go to stderr so the puzzle string on stdout stays pipe-friendly.

## Testing

- Vitest 3.2.7 with `@vitest/coverage-v8`.
- All tests are under `src/__tests__/` mirroring the source tree (e.g. `src/__tests__/commands/`, `src/__tests__/persistence/`).
- The suite contains 614 tests across 34 files.
- **`src/cli.ts` and `src/index.ts` are excluded from coverage** (they are pure dispatch / re-export, hard to unit-test in isolation). The dispatch logic is exercised by the command tests.
- **Coverage:** 100% line / statement / function coverage is required (G-T02); branch coverage is 96.6% and is reported but not enforced. v8 produces false-positive branch counts for ternaries and short-circuit operators that are not realistically reachable.
- Test fixtures: `123456789456789123789123456234567891567891234891234567345678912678912345912345678` is the library's `SUDOKU_BASE_BOARD` (a valid solved board). For "unsolvable" use `'550000000' + '0'.repeat(72)` (two 5s in row 0).

## Build & release

- `pnpm build:types` → `tsc -p tsconfig.build.json` emits `dist/{index,args,cli,output}.{js,d.ts,*.map}` plus the `commands/` and `format/` subdirs. This is the **library surface** for programmatic consumers.
- `pnpm build:bundle` → `node scripts/build.mjs` emits bundled `dist/cli.js` and `dist/index.js`; `dist/cli.js` has a shebang and is the **bin** the `bin` field in `package.json` points at.
- `prepublishOnly: pnpm build` runs both.
- Release bumps: `pnpm release:patch|minor|major` (uses `standard-version`, expects Conventional Commits).
- The `pnpm-workspace.yaml` and the `pnpm.onlyBuiltDependencies` in `package.json` exist solely to let esbuild's postinstall run under pnpm 10's strict `ignored-builds` policy. Do not delete them.

## Inherited global rules

TypeScript quality (G-01..G-22), testing (G-T01..G-T10), security (G-S01..G-S08), language (G-L01..G-L05), and temperature (G-TEMP-01..G-TEMP-08) rules are defined in `~/.config/opencode/AGENTS.md` and apply here unchanged. The only local testing override is that branch coverage is reported at 96.6% but not enforced; 100% line / statement / function coverage still follows G-T02.
