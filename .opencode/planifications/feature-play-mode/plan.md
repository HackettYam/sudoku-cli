---
Author: spec + hackettyam
Status: Draft
Template: cli-tool
Version: 1.2.0
Created: 2026-06-19
Updated: 2026-06-19
---

# 🎯 Plan: Add Interactive Play Mode to `@hackettyam/sudoku-cli`

> **Location:** `.opencode/planifications/feature-play-mode/plan.md`
> **Tier:** 1 (play mode + TUI + colors + persistence + gamification)
> **Workflow:** spec → code → test → security → docs → memory → USER
> **Changelog:**
> - v1.2.0 — Added decision 17 (two counters per difficulty:
>   `totalPlays` + `totalWins`), decision 18 (`proper-lockfile@^4.1.2`
>   as the second explicit G-20 exception, with a new
>   `src/persistence/lock.ts` factory + multi-process concurrent-write
>   test), and decision 19 (inline + dismissable achievement screen
>   with modern UI guidelines using built-in ANSI + `picocolors`).
>   Resolved open questions Q-NEW-1, Q-NEW-2, Q-NEW-3. Updated
>   PerDifficultyStats schema, R-11 mitigation, keybindings table, and
>   §Rendering with the modern UI guidelines (double-line borders,
>   16-color palette, animations, header tags, icon glyphs, dismissable
>   trophy view). Bundle budget bumped to 75 kB (was 45 kB); effort
>   bumped to ~3-4 weeks comfortable / ~5-6 days sprint.
> - v1.1.0 — Added persistence (save/resume), per-difficulty stats, and 11
>   achievements. Added decisions 11-15, new `src/persistence/*` modules,
>   extended `GameState` with `hintCount`/`undoCount`, added one-shot
>   `play --stats`/`--achievements`/`--leaderboard` flags, added `--load`
>   and `--resume-last` to TUI. Resolved open questions Q-1, Q-2, Q-3, Q-5.
> - v1.0.0 — Initial Tier 1 plan (play mode + TUI + colors).

---

## 🎯 Objective

Add a new `play` subcommand to `@hackettyam/sudoku-cli` that lets a user play
a full Sudoku puzzle interactively in the terminal. The feature must:

- Generate a puzzle at a user-selected (or default) difficulty.
- Render a 9x9 grid with cursor, fixed/user cell distinction, same-number
  highlight, error highlight, box separators, footer keybindings, timer,
  and move count.
- Respond to keyboard input (arrows, digits, h/u/q, Ctrl+C).
- Detect win, transition to a win screen with stats (time + moves) and
  any newly-unlocked achievements, allow starting a new game or quitting.
- **Persist progress**: auto-save the in-flight game on quit / Ctrl+C
  / signal, allow `--load <id>` to resume a specific save, and provide a
  `--resume-last` shortcut for the most recent save.
- **Track stats** per difficulty (wins, best time, fewest moves, total
  plays) in a single human-readable JSON state file.
- **Award 11 achievements** (per-difficulty and cross-difficulty) that
  unlock deterministically based on the just-completed game's stats.
- **Expose one-shot inspection** via `play --stats`, `play --achievements`,
  and `play --leaderboard` (no TUI, machine-parseable stdout).
- Restore the terminal cleanly on any exit (quit, win, error, signal).
- Respect the `NO_COLOR` env var and TTY detection automatically (no
  explicit CLI flag in Tier 1).
- Stay within the project's strict architectural rules: pure domain logic
  in `src/game/` and `src/persistence/`, pure TUI in `src/tui.ts`, I/O
  confined to `src/output.ts` + `src/cli.ts`, programmatic surface in
  `src/index.ts`.

**Global Rule References:** G-01 to G-22, G-T01 to G-T10, G-S01 to G-S08, G-L01 to G-L05.

---

## 📂 Scope

### Files to Modify

| File | Change Type | Priority | Notes |
|------|------------|:--------:|-------|
| `src/cli.ts` | Modify | High | Add `case 'play':` to dispatcher; route to `playCommand`, `playStatsCommand`, `playAchievementsCommand`, `playLeaderboardCommand`. |
| `src/args.ts` | Modify | High | Add `'play'` to `Subcommand`; add `parsePlayArgs` (handles `--difficulty`, `--load`, `--resume-last`, `--stats`, `--achievements`, `--leaderboard`, `--help`); extend `ParsedArgs`; extend `HELP_TEXT`. |
| `src/output.ts` | Modify | High | Add `runTuiSession` helper (raw mode + alt screen + signal cleanup). |
| `src/index.ts` | Modify | Medium | Re-export public play types, `playCommand`, persistence types, and the new one-shot command results. |
| `src/commands/result.ts` | Modify | Medium | Add `play_exit`, `play_stats`, `play_achievements`, `play_leaderboard` discriminated variants (exit codes unchanged). |
| `src/game/state.ts` | Modify | High | Extend `GameState` with `hintCount`, `undoCount`, `errorCount`; `applyMove` increments counters; `undo` decrements. |
| `src/game/state.test.ts` | Modify | High | Add cases for the new counter fields. |
| `src/tui.ts` | Modify | Medium | Render stats line + achievements banner on win; render save-on-quit prompt. |
| `src/tui.test.ts` | Modify | Medium | Snapshot tests for win banner with achievements + save prompt. |
| `src/commands/play.ts` | Modify | High | Orchestrator: on `quit` mid-game, write a save via `persistence/save`; on `isWon`, evaluate achievements and update `state.json` via `persistence/state`. |
| `src/commands/play.test.ts` | Modify | High | Add cases for save-on-quit + win-with-achievements (using mock `FsAdapter`). |
| `package.json` | Modify | High | Add `picocolors` and `proper-lockfile` runtime deps. **Exactly 2 G-20 exceptions** (decisions 6 + 18). |
| `vitest.config.ts` | Modify | Low | No exclusion change needed (all new modules are unit-testable). |
| `README.md` | Modify | Medium | Document `play` subcommand + persistence + stats + achievements. |
| `.opencode/planifications/feature-play-mode/{plan,actions}.md` | Add | High | This planification. |

### New Files

| File | Priority | Purpose |
|------|:--------:|---------|
| `src/game/state.ts` | High | Pure state machine: `GameState`, `Move`, `createGame`, `applyMove`, `isWon`, `undo`. |
| `src/game/state.test.ts` | High | Unit tests for the state machine (100% coverage). |
| `src/tui.ts` | High | Pure TUI: `renderGame`, `parseKeypress`, `applyKey`, `formatTime`, `KEYBINDINGS`, `renderWinBanner`, `renderSavePrompt`. |
| `src/tui.test.ts` | High | Unit tests + snapshot for render; table tests for keypress parsing. |
| `src/format/colors.ts` | High | Pure `shouldEnableColors(env, isTty)` + singleton `colors` instance. |
| `src/format/colors.test.ts` | High | Unit tests for the factory (all 4 env/TTY combinations). |
| `src/format/table.ts` | High | Pure ASCII table renderer for `play --leaderboard`. |
| `src/format/table.test.ts` | High | Unit tests: column widths, alignment, empty rows, unicode-safe width. |
| `src/persistence/state.ts` | High | Pure: load/save stats + achievements + saves index via injected `FsAdapter` + injected `LockFactory` (decision 18). Atomic write via tmp+rename. Auto-create `~/.sudoku-cli/` with `0o700`. |
| `src/persistence/state.test.ts` | High | Unit tests with a mock `FsAdapter` + a mock `LockFactory`: round-trip, atomic-write, corrupt-file recovery, schema migration (no-op for v1), lock acquire/release happy path. |
| `src/persistence/lock.ts` | High | **New in v1.2.0.** Pure factory: `createLock(lockPath) → { acquire(): Promise<LockResult>, release(handle) }`. Wraps `proper-lockfile` (the **second** G-20 exception, decision 18) with a typed interface and a discriminated-union `LockResult` (`{ ok: true, handle } \| { ok: false, reason: 'busy' \| 'timeout' }`). Never throws for expected contention; retries 5× with 50 ms backoff. |
| `src/persistence/lock.test.ts` | High | Unit tests with an in-memory lock mock: acquire happy path, release happy path, timeout (5 retries exhausted), busy (lock held by another caller), error mapping. The `proper-lockfile` library itself is **excluded** from coverage (third-party). |
| `src/persistence/__tests__/state-concurrent.test.ts` | Medium | **New in v1.2.0.** Multi-process test using `node:child_process.fork` to assert that two simultaneous `loadState` → `mergeStats` → `saveState` cycles do not corrupt `state.json`. Verifies acceptance criterion #31. |
| `src/persistence/save.ts` | High | Pure: serialize/deserialize a `GameState` to/from versioned JSON. `saveId = crypto.randomUUID()`. |
| `src/persistence/save.test.ts` | High | Unit tests: round-trip, version mismatch → error, corrupt JSON → error. |
| `src/persistence/achievements.ts` | High | Pure: achievement definitions + `evaluateAchievements(state, result, history) → readonly string[]`. |
| `src/persistence/achievements.test.ts` | High | Table-driven tests: one case per achievement × at least 2 conditions (unlocked / not unlocked). |
| `src/commands/play.ts` | High | Orchestrates the play loop (TUI). On win → evaluates achievements, writes stats. On quit mid-game → writes save. |
| `src/commands/play-stats.ts` | Medium | One-shot: load state, render per-difficulty stats table, return `play_stats` `CommandResult`. |
| `src/commands/play-achievements.ts` | Medium | One-shot: load state, list unlocked + locked achievements, return `play_achievements` `CommandResult`. |
| `src/commands/play-leaderboard.ts` | Medium | One-shot: load state, render best-time + fewest-moves table per difficulty, return `play_leaderboard` `CommandResult`. |
| `src/commands/play.test.ts` | High | Unit tests with a mock `PlayIO` and mock `FsAdapter`. |
| `src/__tests__/output.tui.test.ts` | Medium | Unit tests for `runTuiSession` using mocked `process.stdin/stdout/on`. |

### Out of Scope (Tier 2/3, documented for the next plan)

- `--no-color` CLI flag (auto-detection only in Tier 1).
- `--seed` for deterministic puzzle generation (library lacks seed support).
- Reading the puzzle board from stdin (interactive only).
- `--json` output mode for `play` (the one-shot outputs are already
  machine-parseable line-based: `<key>: <value>` per line).
- Descriptive validate errors (richer messages in `validateCommand`).
- Multi-puzzle sessions or a "next puzzle" prompt mid-game.
- Mouse support.
- Configuration file (`.sudoku-clirc`) — settings like state dir override
  are deferred.
- Cross-platform Windows console polish (we test on Linux/macOS only).
- Telemetry, analytics, or any networking. State is **local** only.
- Save-file migration tooling (schema is `version: 1`; future versions
  will land in their own ADR).
- Cloud sync, leaderboard server, or shared achievements.

---

## 🔍 Problem Statement

### Current State

```text
$ sudoku-cli --help
Usage: sudoku-cli <command> [options]

Commands:
  new [--difficulty <level>] [--pretty]   Generate a new puzzle
  solve <board>                           Solve a puzzle
  validate <board>                        Validate a puzzle
  hint <board>                            Suggest the next move
```

Every existing subcommand is **one-shot**: it produces a string and exits.
There is no way for a user to *play* a Sudoku in their terminal — they can
generate, then mentally solve, then call `validate` to check. That is
cumbersome and not what most people picture when they see a "Sudoku CLI."

### Why It Matters

A CLI is often a user's first touchpoint with a library. Without a `play`
subcommand, `@hackettyam/sudoku-cli` is a *utility wrapper*, not a *game*.
Adding interactive play:

- Unlocks the package's main use case (people want to **play** Sudoku).
- Demonstrates the library's full power (generation + solving + hints in
  one coherent experience).
- Differentiates `@hackettyam/sudoku-cli` from generic puzzle solvers on
  npm.
- Gives the project a "headline" feature to lead the README with.

The reference implementation
(`/home/hackettyam/www/@hackettyam/libs/react/react-sudoku/`) already
exercises every relevant library function (`createSudoku`, `isSolved`,
`setCellValue`, `clearCell`, `getHint`, `getInvalidCells`, `countEmptyCells`)
inside a React UI. The CLI equivalent is overdue.

### Risks of Not Addressing

- The package remains a thin shell with no end-user appeal.
- Bug fixes and improvements to the library can't be showcased through
  the CLI without copy-pasting puzzle strings.
- The "obvious" Tier 2 features (`--load`, `--seed`, etc.) cannot land
  coherently without an interactive foundation.

---

## 🔧 Technical Strategy

### Phase 1: Foundation (deps, colors, coverage plan)

1. Add `picocolors` (`^1.1.0`, ISC, ~6 kB) as a runtime dep in
   `package.json` — the **only** new runtime dep, and the sole exception
   to G-20. Documented in §Decisions.
2. Add `src/format/colors.ts` (pure factory + singleton) and its tests.
3. Confirm `vitest.config.ts` does not need a new exclusion (all new
   modules are unit-testable; `runTuiSession` is tested via mocked
   process I/O in the same style as the existing `output.test.ts`).

### Phase 1.5: Persistence primitives (pure)

> Landed **after** colors but **before** the state-machine changes so
> that the persistence layer has a stable, testable surface to depend on.

1. Add `src/persistence/state.ts` with:
   - `FsAdapter` interface (`readFile`, `writeFile`, `mkdir`, `rename`,
     `exists`, `homedir`, `stat`) — minimum surface area.
   - `nodeFsAdapter: FsAdapter` — production implementation wrapping
     `node:fs/promises`, `node:os`, `node:path`.
   - `memoryFsAdapter(): FsAdapter` — in-memory `Map`-backed test double.
   - `defaultStatePath(): string` — `~/.sudoku-cli/state.json` (or
     `$XDG_STATE_HOME/sudoku-cli/state.json` if the env var is set).
   - `defaultSavesDir(): string` — sibling `saves/` dir.
    - `loadState(fs, path, lock: LockFactory): Promise<Result<StateFile,
      StateError>>` — returns the schema-versioned `StateFile` (see
      §State Schema below). On `ENOENT`, returns a fresh default. On
      any other error, returns a typed `StateCorruptError` /
      `StateVersionError` / `StateLockBusyError` via the `Result`
      discriminated union. **v1.2.0 (decision 18):** acquires the
      injected `LockFactory`'s lock at the start and releases it at
      the end (or on error). The lock is **never** held during
      in-memory work; only around the actual `readFile` / `writeFile`
      + `rename` calls. Concurrent writers block on the lock instead
      of racing (R-11, resolved).
    - `saveState(fs, path, state, lock: LockFactory): Promise<Result<void,
      StateError>>` — atomic write: `writeFile(<path>.tmp-<random>)` →
      `rename(<path>.tmp-<random>, <path>)`. Auto-creates the parent
      dir with mode `0o700` on first write (G-S07). Wrapped in the
      same lock as `loadState`.
    - `mergeStats(prev, newResult, mode: 'win' | 'start'):
      PerDifficultyStats` — pure, used by the play command to update
      stats without read-modify-write races inside the function.
      **v1.2.0 (decision 17):** `mode: 'start'` increments
      `totalPlays` by 1 and sets `lastPlayedAt`; `mode: 'win'`
      increments `totalWins` by 1 and updates `bestTimeMs` /
      `fewestMoves` if better. Each mode leaves the *other* counter
      unchanged.
   - JSDoc on every export. Module-level comment referencing G-S01
     ("no secrets"), G-S07 (least privilege), G-13 (no cycles).
2. Add `src/persistence/state.test.ts` with a `memoryFsAdapter` and
   cases: round-trip, atomic-write, missing dir → created with `0o700`,
   corrupt file → throws, schema-version mismatch → throws.
3. Add `src/persistence/save.ts` with:
   - `saveGame(fs, state, dir): Promise<string>` — assigns `state.id =
     crypto.randomUUID()`, writes `saves/<id>.json` atomically, returns
     the id.
   - `loadGame(fs, id, dir): GameState` — reads `saves/<id>.json`,
     deserializes. Throws `SaveNotFoundError` or `SaveCorruptError` on
     failure.
   - `listSaves(fs, dir): readonly SaveSummary[]` — returns
     `[{ id, createdAt, updatedAt, difficulty, moveCount, isWon }]` for
     the saves index. Used by `--resume-last` and (future) `play
     --saves`.
   - `latestSaveId(fs, state, dir): string | null` — reads the saves
     index from `state.json` (`lastSaveId` field) and returns the id
     (or `null`).
   - `SaveFile` schema: `{ version: 1; id; createdAt; updatedAt;
     difficulty; original; solution; current; cursor; history;
     moveCount; hintCount; undoCount; startTime; errors }` (see
     §Save File Format).
4. Add `src/persistence/save.test.ts`: round-trip, missing id → error,
   corrupt JSON → error, version mismatch → error, atomic write, dir
   auto-created.
5. Add `src/persistence/achievements.ts` with:
   - `AchievementId` string-literal union of the 11 ids (see
     §Achievements).
   - `AchievementDefinition` interface: `{ id; title; description;
     evaluate: (ctx: AchievementContext) => boolean }`.
   - `ACHIEVEMENTS: readonly AchievementDefinition[]` — frozen array.
   - `evaluateAchievements(ctx: AchievementContext): readonly
     AchievementId[]` — pure. Returns the ids of all newly-unlocked
     achievements given the just-completed game + the current state.
   - `AchievementContext` interface: `{ difficulty, elapsedMs,
     moveCount, hintCount, undoCount, errors: readonly string[],
     perDifficultyWins: Readonly<Record<DifficultyType, number>>,
     difficultiesWon: readonly DifficultyType[] }`.
   - **Idempotency**: callers are expected to call
     `unlockAchievements(state, ids)` which filters out ids that are
     already in `state.achievements` before writing. The evaluator
     itself is pure and does not read state.
6. Add `src/persistence/achievements.test.ts`: table-driven — for each
   of the 11 achievements, ≥ 2 cases (unlocked + not unlocked). Plus
   `evaluateAchievements` returns `[]` on a trivial win (no qualifying
   conditions).
7. **No imports from `tui.ts`, `output.ts`, or `commands/*`** in the
   persistence layer. The only allowed imports are `node:*` and each
   other (e.g., `save.ts` may import `state.ts` types; `achievements.ts`
   may import `state.ts` types; `commands/*` import all three).

### Phase 2: Domain + TUI (pure)

1. Add `src/game/state.ts` with the discriminated-union state machine
   (`Playing | Won | Quit`), `createGame(difficulty)`, `applyMove(state,
   move)`, `isWon(state)`, `undo(state)`. Co-located unit tests for
   every branch.
2. Add `src/tui.ts` with:
   - `parseKeypress(buf: Buffer): ParsedKey` — pure, no I/O. Handles
     arrow ANSI sequences, digits, letters, Ctrl+C, backspace, escape.
   - `renderGame(state: GameState, options: RenderOptions): string` —
     pure ANSI/colored string.
   - `applyKey(state: GameState, key: ParsedKey): GameState` —
     delegates to the state machine plus cursor movement.
   - `formatTime(ms: number): string` — `mm:ss` for the footer.
3. Add snapshot tests for `renderGame` (3 snapshots: initial state,
   mid-game with cursor + highlights, win screen).

### Phase 2.5: Extend `GameState` with counters

> Landed **after** Phase 1.5 so the save-file schema can include the
> new fields from day one, and **before** Phase 3.5 so the win banner
> has the data it needs.

1. Add `hintCount`, `undoCount`, `errorCount` (derived) to
   `GameState`. `errorCount` is `state.errors.length`; not stored on
   the state itself (recomputed by `getInvalidCells`).
2. Update `applyMove`:
   - `place` / `clear` → `moveCount += 1`, push to `history`,
     recompute `errors`.
   - `undo` → `undoCount += 1` (only if history non-empty), drop last
     history entry, recompute `errors`.
   - `hint` → `hintCount += 1`, place `solution[r][c]`, push a
     synthetic `place` to history (so `u` undoes a hint), but do
     **not** increment `moveCount` (a hint is not a player move).
3. Add optional `id?: string` to `GameState` — set by `saveGame` when
   writing a save file. Allows `loadGame` to round-trip the id.
4. Update all existing `state.test.ts` cases; add coverage for the
   new counters (each counter: at least 1 increment + 1 no-op case).

### Phase 3: I/O shell (testable)

1. Extend `src/output.ts` with `runTuiSession(opts: TuiSessionOptions):
   TuiRunner`. The implementation:
   - Saves the current TTY state (raw mode + isTTY).
   - Writes `\x1b[?1049h` (enter alt screen), `\x1b[?25l` (hide cursor),
     `\x1b[2J` (clear).
   - Calls `process.stdin.setRawMode(true)`, `process.stdin.resume()`.
   - Registers `process.stdin.on('data', handler)` (parses ANSI
     sequences via `tui.parseKeypress`).
   - Registers `process.on('SIGINT')` and `process.on('SIGTERM')` for
     cleanup.
   - Exposes `runner.draw(frame)`, `runner.cleanup()`, and
     `runner.run()` (Promise).
2. Test `runTuiSession` with `vi.spyOn(process.stdin, ...)`,
   `vi.spyOn(process.stdout, 'write')`, and a fake signal emitter. The
   test asserts: alt screen codes are written on run, cursor is hidden,
   `setRawMode(true)` was called, keypresses are routed to the callback,
   `SIGINT` triggers cleanup and resolves the promise, and cleanup
   restores raw mode + writes the leave-alt-screen code.

### Phase 3.5: TUI additions (win banner + save prompt)

> Pure rendering work; no new I/O. Sits between the I/O shell (Phase 3)
> and the command implementation (Phase 4).

1. Extend `src/tui.ts` with:
   - `renderWinBanner(state, options, achievements: readonly
     AchievementId[]): string` — pure. Returns the win screen
     (filled grid + green banner + stats line + any newly-unlocked
     achievements). **Q-3 confirmed** (filled grid + banner with stats).
   - `renderSavePrompt(state, options): string` — pure. Returns a
     one-line "Game saved as `<short-id>`. Resume with `play --load
     <id>` or `play --resume-last`." footer shown briefly before
     `cleanup()` runs.
   - `formatShortId(id: string): string` — first 8 chars of the UUID
     (sufficient for users to disambiguate recent saves).
   - `ACHIEVEMENT_GLYPHS: Readonly<Record<AchievementId, string>>` —
     static map of `id → '🏆' | '⚡' | '🎯' | ...` (text fallback is
     also provided for `NO_COLOR` and non-TTY — see `format/colors.ts`).
2. Update `renderGame` to:
   - Replace the existing "🎉 You won! 🎉" banner with a call to
     `renderWinBanner` when `status === 'won'`.
   - When `status === 'quit'` AND `saveId` is set on the state, append
     `renderSavePrompt` to the bottom of the frame for one paint
     cycle (the next keypress clears it).
3. Add tests in `src/tui.test.ts`:
   - 2 new Vitest snapshots: win with 0 achievements; win with 3
     achievements. Asserts: banner includes the time and move count
     formatted via `formatTime`, banner lists achievement titles in
     the order returned by `evaluateAchievements`.
   - 1 snapshot: quit-with-save. Asserts: prompt includes the short id
     and the `--load` / `--resume-last` hints.
   - `formatShortId('12345678-1234-1234-1234-123456789012')` →
     `'12345678'`.

### Phase 4: Command + dispatcher + docs

1. Add `src/commands/play.ts` exporting `playCommand(options): Promise<
   PlayCommandResult>`. Internally:
   - Calls `parseDifficulty` to validate the optional flag.
   - Calls `createGame(difficulty)` to bootstrap state.
   - Calls `output.runTuiSession({ ... })` with a `draw` callback that
     calls `tui.renderGame` and a `key` callback that calls
     `tui.applyKey` + checks `isWon`.
   - Returns `{ kind: 'play_exit', reason, elapsedMs, moveCount }` on
     quit / win / Ctrl+C.
2. Unit-test `playCommand` by injecting a `PlayIO` interface (render +
   onKey + cleanup). Tests assert: state transitions, win detection,
   quit handling, error handling, and that errors during rendering are
   caught and reported.
3. Add `case 'play':` to the dispatcher in `src/cli.ts`. Map
   `{ kind: 'play_exit', reason: 'quit' }` → exit `0`,
   `reason: 'won'` → exit `0`, `reason: 'error'` → exit `2`
   (Q-1 confirmed — consistent with `new`).
4. Extend `src/args.ts` `Subcommand`, `ParsedArgs`, and `parseArgs`
   switch with `'play'`, add `parsePlayArgs(rest)` (handles
   `--difficulty`, `--load <id>`, `--resume-last`, `--stats`,
   `--achievements`, `--leaderboard`, `--help`/`-h` — only one of
   `--load` / `--resume-last` / `--stats` / `--achievements` /
   `--leaderboard` allowed at a time), update `HELP_TEXT` to mention
   `play` and its keybindings (Q-5 confirmed).
5. Extend `src/commands/result.ts` with a `play_exit` variant (Q-2
   confirmed — reuse this for invalid difficulty, missing TTY, etc.)
   **and** the new `play_stats`, `play_achievements`, `play_leaderboard`
   variants.
6. Re-export `playCommand`, `PlayOptions`, `PlayCommandResult`,
   `Move`, `GameState`, `GameStatus` from `src/index.ts`. **Do not**
   re-export `picocolors` or any library symbols (per project rule).
7. Update `README.md` with a `### sudoku-cli play` section: usage
   example, keybinding table, ASCII layout sketch, screenshots-as-ascii
   block, and an "Exit codes" line (Q-3 + Q-5 confirmed).

### Phase 5: Build verification + manual smoke

1. `pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm build`.
2. `node dist/cli.js play --difficulty easy` (or `npx tsx src/cli.ts
   play --difficulty easy` during dev) — manual key flow:
   arrows, digits, h, u, q, Ctrl+C.
3. Verify on a real terminal: alt screen entry/exit is clean, the
   prompt is restored, no garbage characters left behind.

### Phase 5.5: Wire persistence + win-flow into the TUI command

> Modifies `src/commands/play.ts` to persist on quit/win. Uses the
> already-built persistence primitives (Phase 1.5) and the extended
> state (Phase 2.5).

1. Update `playCommand(options, deps)` to accept an optional
   `deps.persistence: { fs: FsAdapter; lock: LockFactory; now: () =>
   number; statePath: string; savesDir: string }` (default
   `nodeFsAdapter + nodeLockFactory(defaultStateLockPath
   (defaultStatePath())) + Date.now + defaultStatePath() +
   defaultSavesDir()`).
2. On `startNewGame` (a fresh game, no `loadId` / `resumeLast`)
   (v1.2.0, decision 17):
   - Call `mergeStats(prev, { mode: 'start', difficulty })` to
     increment `totalPlays` by exactly 1 and set `lastPlayedAt`.
3. On `isWon` transition (inside the TUI key handler):
   - Call `evaluateAchievements(ctx)` to get newly-unlocked ids.
   - Call `mergeStats(prev, result, 'win')` to compute updated
     per-difficulty stats (increments `totalWins` by 1, updates
     `bestTimeMs` / `fewestMoves` if better — v1.2.0, decision 17).
   - `loadState` → `mergeStats` + `unlockAchievements` → `saveState`
     (atomic, `0o700` dir auto-created on first write, all wrapped
     in the injected `LockFactory` per decision 18).
   - Pass the unlocked ids back to `tui.renderWinBanner` (which
     delegates to `renderAchievementInline` in v1.2.0).
3. On `status: 'quit'` mid-game (not won):
   - Call `saveGame(fs, state, defaultSavesDir())` to write the save.
   - Update `state.json` `lastSaveId` field.
   - Pass the new `id` to `tui.renderSavePrompt`.
4. Map new errors to `CommandResult`:
   - `save` failure (disk full, permission denied) → `play_exit: error`
     with `message: 'Failed to save game: ...'`. **Does not crash the
     TUI session** — the user can still quit cleanly.
   - `state` write failure → same mapping.
5. Update `play.test.ts` with mock `FsAdapter` and a `memoryFsAdapter`
   helper. Add cases:
   - Win → achievement evaluated → state.json contains the
     achievement with `unlockedAt` set.
   - Win → state.json stats updated (wins++, best time updated if
     faster, fewest moves updated if fewer).
   - Quit mid-game → `saves/<id>.json` exists, `state.json` has
     `lastSaveId` set.
   - Save failure → `play_exit: error` with a non-empty message; TUI
     still cleans up.

### Phase 5.6: One-shot commands + dispatcher wiring

> Adds the three one-shot commands. They never enter the TUI — they
> read state and print to stdout. The dispatcher in `cli.ts` selects
> the right command based on the flag combination.

1. Add `src/commands/play-stats.ts`:
   - `playStatsCommand(deps?): CommandResult` — loads state, returns
     `{ kind: 'play_stats', stats: PerDifficultyStats, totalPlays:
     number, totalWins: number }`.
   - No I/O. Pure transformation of `StateFile` → `CommandResult`.
2. Add `src/commands/play-achievements.ts`:
   - `playAchievementsCommand(deps?): CommandResult` — returns
     `{ kind: 'play_achievements', unlocked: readonly
     UnlockedAchievement[], locked: readonly LockedAchievement[],
     definitions: readonly AchievementDefinition[] }`.
   - Pure; sorts unlocked by `unlockedAt` desc, locked by id asc.
3. Add `src/commands/play-leaderboard.ts`:
   - `playLeaderboardCommand(deps?, options?: { top?: number }):
     CommandResult` — returns `{ kind: 'play_leaderboard', entries:
     readonly LeaderboardEntry[] }` where each entry is
     `{ difficulty, bestTimeMs: number | null, fewestMoves: number |
     null, winsAtBest: number }`.
4. Add `src/format/table.ts`:
   - `formatTable(columns: readonly Column[], rows: readonly
     Row[]): string` — pure ASCII table renderer. Pads columns to the
     widest cell, supports `align: 'left' | 'right'`, computes display
     width with `string-width`-style logic (we implement a tiny
     `displayWidth` helper since `string-width` would be a new runtime
     dep — G-20).
   - `displayWidth(s: string): number` — counts code points (full-
     width CJK and box-drawing count as 2; everything else 1). This
     is *good enough* for the leaderboard (no CJK content; we only
     render ASCII + the few achievement glyphs which are emoji and
     count as 2).
5. Update `src/cli.ts` dispatcher:
   - `case 'play':` switches on the `args` variant:
     - `{ kind: 'play_tui', difficulty?, loadId? }` → `playCommand`
       (existing TUI path).
     - `{ kind: 'play_stats' }` → `playStatsCommand`. Map stdout to
       `formatTable(...)` rendering. Exit `0`.
     - `{ kind: 'play_achievements' }` → `playAchievementsCommand`.
       Map stdout to `formatAchievementsTable(...)`. Exit `0`.
     - `{ kind: 'play_leaderboard', top? }` → `playLeaderboardCommand`.
       Map stdout to `formatLeaderboardTable(...)`. Exit `0`.
   - Update `args.ts` to add the new `ParsedArgs` variants.
6. Tests for the three one-shot commands + the table renderer:
   - `playStatsCommand` returns the expected shape given a fixture
     state.
   - `playAchievementsCommand` returns all 11 achievements, with
     exactly the unlocked ones having `unlockedAt` set.
   - `playLeaderboardCommand` returns at most `top` rows per
     difficulty, sorted by best time asc then fewest moves asc.
   - `formatTable` snapshot test: 3 columns, 5 rows, mixed align.
   - `displayWidth` table: ASCII (1), full-width CJK (2), emoji (2).

### Phase 8.5: Docs additions

> Tier 1 docs (Phase 4 step 7) already landed. This phase adds the
> persistence + gamification sections.

1. README.md: new sections after the `### sudoku-cli play` block:
   - `### Persistence` — where state lives, how to back it up, how
     `$XDG_STATE_HOME` is honored.
   - `### Save and resume` — `play --load <id>`, `play
     --resume-last`, the short-id format, an example session.
   - `### Stats` — `play --stats` output (one line per difficulty, plus
     totals).
   - `### Achievements` — the 11 achievements, the tier they belong
     to, the unlock condition (table form).
   - `### Leaderboard` — `play --leaderboard` output, columns
     (difficulty · best time · fewest moves · wins), `--top` flag.
2. README.md: update the "Zero runtime dependencies" line to mention
   `picocolors` (already in v1.0.0) and clarify that persistence is
   **local-only** (no network, no telemetry).
3. `docs/` (if it exists; the project doesn't have a `docs/` dir
   today, so this is a follow-up): an architecture diagram showing
   the persistence layer's data flow.

### Phase 9.5: Security post-check on persistence

> `security` agent reviews the new persistence modules before merge.

1. Run `sec-scan` on `src/persistence/*.ts` (catches SAST patterns,
   secret detection, and dep CVE scan in one).
2. Run `sec-secrets` on `src/persistence/*.ts` — must report 0 hits.
3. Run `sec-sast` on the new files — must report 0 high-severity
   findings.
4. Run `sec-deps` (a no-op since we added 0 deps, but recorded for
   the audit trail).
5. Manual review of:
   - File permission `0o700` on the dir, `0o600` on the files (G-S07).
   - Atomic write correctness (tmp+rename, no torn writes).
   - Path traversal: `saveId` is generated by `crypto.randomUUID()`,
     never from user input, so no risk of `../` escapes. `loadGame`
     rejects ids that don't match the UUID v4 regex.
   - State file size: hard-cap at 1 MiB; reject larger files (defense
     in depth).
6. Acceptance: zero `pnpm audit` findings; `sec-scan` exit `0`; all
   G-S01..G-S08 boxes ticked in §Quality Gates.

### Phase 10.5: Memory recording

> `memory` agent records the decisions and patterns learned.

1. `memory-adr` — create an ADR titled "Why we chose `~/.sudoku-cli/`
   for state and saves (no SQLite, no XDG default)" with context,
   alternatives, and consequences.
2. `memory-record` — log the persistence patterns:
   - `FsAdapter` injection for testability (pattern: `ifs`).
   - Atomic write via tmp+rename (pattern: `atomic-write`).
   - Pure achievement evaluator (pattern: `pure-evaluator`).
3. `memory-pattern` — catalog the three patterns above (potential
   promotion to formal skills after Rule-of-Three).

---

## 💡 Key Design Decisions

| # | Decision | Rationale | Alternatives Considered |
|---|----------|-----------|------------------------|
| 1 | **New `play` subcommand** rather than extending `new`. | Distinct user intent (play vs. produce). Matches the project's "one subcommand = one verb" pattern. | Adding `--interactive` to `new` (rejected: pollutes the `new` surface; `new` is meant to be pipe-friendly). |
| 2 | **Built-in Node TTY** (`setRawMode` + ANSI escapes) + `picocolors` for color. | Zero new runtime deps except `picocolors` (~6 kB, ISC, no transitive deps). `picocolors` is the de-facto standard for tiny terminal color. Reusing the existing `sudoku-tools-resolver` build path needs no change (pure-JS deps bundle fine). | `chalk` (rejected: larger, has ESM/CJS dual pitfalls). `ansi-colors` (rejected: less active). `tui` libraries like `blessed`/`ink` (rejected: huge dep, heavy runtime, opinionated framework — overkill for one screen). |
| 3 | **Pure-function architecture**: `game/state.ts` and `tui.ts` are pure; `output.ts` is the *only* I/O seam; `commands/play.ts` is the orchestrator. | Matches the existing rule that `output.ts` is the only process-touching module. Maximizes unit-test coverage. Pure `renderGame` enables snapshot tests. Pure `parseKeypress` enables table tests. Pure `applyMove` makes state transitions deterministic. | A class-based `Game` with methods (rejected: mixes I/O and state; harder to test). A `react-sudoku`-style React port (rejected: brings JSX + bundler concerns into a CLI). |
| 4 | **Test `runTuiSession` via mocked `process` APIs** (same pattern as existing `output.test.ts`) rather than excluding it from coverage. | The existing `output.ts` is fully covered today; the new helper is small (~50 LOC) and equally mockable. Keeping 100% coverage of `output.ts` is feasible. | Excluding `output.ts` from coverage (rejected: loses coverage on a critical I/O module). Splitting `output.ts` into a pure `planTui` + thin `runTui` (rejected: added indirection without test-coverage benefit since the same mocking works on the unified version). |
| 5 | **`colors` is a thin wrapper around `picocolors.createColors(enabled)`** with a pure `shouldEnableColors(env, isTty)` factory. | The factory is fully testable (4 paths: FORCE_COLOR set, NO_COLOR set, TTY, no TTY). The singleton is one line. Honors `no-color.org` standard. Honors `FORCE_COLOR` for CI usage. Disables when stdout is not a TTY (picocolors already does this; we reinforce it). | Wrapping every picocolors function manually (rejected: 10+ duplicated entries, drift risk). Using picocolors's default export unmodified (rejected: doesn't honor `NO_COLOR`). |
| 6 | **G-20 relaxation is *local* and *narrow***: only `picocolors` and `proper-lockfile` are added (decisions 6 + 18); no other runtime deps. | The project rule (inherited from global AGENTS.md) forbids runtime deps. This plan documents the exception in §Decisions and §Risks. The escape hatch is recorded as an explicit, user-approved deviation, not a silent change. | Implementing ANSI escape strings by hand (rejected: ~200 LOC of escape sequences, hard to maintain, reinventing what picocolors does in 6 kB). Using Node's `util.styleText` (rejected: only available in Node 21+, our engine pin is `>=18.3`). |
| 7 | **No `--no-color` CLI flag in Tier 1**; rely on `NO_COLOR` env + TTY detection. | Tier 2 scope. Users who want to force-disable already have `NO_COLOR=1`. Keeps the `play` subcommand's flag surface minimal. | Adding `--no-color` (deferred to Tier 2 — see `parsePlayArgs` design in actions.md: only `--difficulty` and `--help` in Tier 1). |
| 8 | **State is immutable; every move returns a new `GameState`.** | Aligns with the library's own immutability (`setCellValue`, `clearCell` return new boards). Enables cheap undo by keeping a `Move[]` history. | Mutable state with a "dirty" flag (rejected: complicates undo, breaks library-style API). |
| 9 | **`renderGame` is the only place that emits ANSI/color codes.** TUI and game-state modules return plain data. | One single test seam for "what does the screen look like" — snapshot tests. Easiest to support a future `--no-color` Tier 2 flag (just toggle `colors.enabled` before calling `renderGame`). | Sprinkling color calls across modules (rejected: hard to test, hard to disable globally). |
| 10 | **Win detection uses library's `isSolved(board, solution)`**; do not reinvent. | The library already implements this. Reusing avoids drift and saves tests. | Custom row/col/box check in the state machine (rejected: duplicates library code, more to maintain). |
| 11 | **State lives in `~/.sudoku-cli/state.json`** (single file, versioned, human-readable). Saves live in `~/.sudoku-cli/saves/<uuid>.json` indexed by `state.json`. | One file, easy to inspect and back up; the saves index lets `play --resume-last` work without scanning the directory. JSON is human-readable for debugging (G-07 — no logs to disable). Single source of truth for stats + achievements. | SQLite (rejected: requires `better-sqlite3` native dep, violates G-20). One file per save + a `saves/` directory (accepted; this is exactly that). XDG Base Directory (`$XDG_STATE_HOME`) — supported as a fallback if the env var is set, defaulting to `~/.sudoku-cli` (documented in README). |
| 12 | **All file I/O goes through a tiny `FsAdapter` interface** (`readFile`, `writeFile`, `mkdir`, `rename`, `exists`). Production uses `node:fs/promises`; tests use an in-memory `Map`. | Keeps persistence modules pure → 100% test coverage without touching the disk. Honors G-02 (no `any`), G-22 (immutability), and the project's "pure modules" rule. Mirrors the same pattern as the existing `PlayIO` injection in `playCommand`. | Direct `fs` calls (rejected: makes tests touch disk, slow and flaky). Mocking `node:fs` with `vi.mock` (rejected: brittle, breaks on Node version bumps). |
| 13 | **Atomic writes via `tmp + rename`**: write to `<file>.tmp-<random>`, then `fs.rename` to final. Auto-create parent dir with `0o700` perms on first write. | `fs.rename` is atomic on POSIX within the same filesystem. Prevents half-written state files if the process is killed mid-write. Honors G-S07 (least privilege: only the user can read their own saves). | `fs.writeFile` direct (rejected: non-atomic, can corrupt state on crash). `flock` (rejected: extra dep, not portable to Windows in this scope). |
| 14 | **Achievements are pure functions** of `(difficulty, elapsedMs, moveCount, errors, hintCount, undoCount, totalWins, difficultiesWon) → readonly string[]`. Evaluated **synchronously at win** by the play command; `state.json` updated with `read-modify-write` via the `FsAdapter`. | Pure evaluator is trivially testable (table-driven). Unlocking is idempotent (writing the same achievement twice is a no-op). One evaluation site = one audit trail. | Async / event-driven unlock (rejected: out of scope, complicates test). Persistent state of "achievements earned across runs" stored as `unlockedAt: ISO-8601` timestamps (also enables future "show me when I unlocked this"). |
| 15 | **One-shot subcommands are flags on `play`** (`play --stats`, `play --achievements`, `play --leaderboard`), each implemented in its own file (`src/commands/play-{stats,achievements,leaderboard}.ts`). The interactive TUI stays in `src/commands/play.ts`. `--load <id>` and `--resume-last` are also flags on `play` but route to the TUI orchestrator. | Matches the user's stated API. "One file per command" keeps each ≤ 80 LOC, easy to test, easy to delete later. The dispatcher in `args.ts` picks the right handler based on flag combination. | New top-level subcommands (`stats`, `achievements`, `leaderboard`) — rejected because the user explicitly chose `play --stats` etc. for the API. A monolithic `play.ts` with all branches — rejected: violates G-08 (≤ 180 LOC/function) and the project's "one file = one verb" pattern. |
| 16 | **NO_COLOR already supported; `--no-color` flag deferred to Tier 2** (unchanged from v1.0.0). | Tier 1 honors the env var + TTY detection. Users who need to force-disable have `NO_COLOR=1`. Keeps the `play` flag surface minimal. | Adding `--no-color` — deferred (no user request yet). |
| 17 | **Two counters per difficulty**: `stats.<difficulty>.totalPlays` is incremented on **every** `playCommand` invocation that generates a **fresh** puzzle (i.e., not on `--load` / `--resume-last`); `stats.<difficulty>.totalWins` is incremented **only** on the `isWon` transition (idempotent — a re-loaded save that is immediately solved still counts as +1). | Separates "engagement" (`totalPlays`) from "success" (`totalWins`). Both metrics matter to different players: grinders want a high `totalPlays` for `century`, perfectionists want a high `totalWins` for `completionist`. The schema is forward-compatible (we never store a redundant "ongoing" count). Resume does **not** count as a new play — a resumed game is a continuation of the same play, not a new one. | One counter (`wins`) with `totalPlays` derived as `wins + ongoing` (rejected: we don't have a precise "ongoing" count and would have to estimate; explicit is better). Increment `totalPlays` on resume (rejected: a quit-resume cycle could inflate the metric by spamming resume). |
| 18 | **`proper-lockfile@^4.1.2`** is the second explicit G-20 exception (after `picocolors` from decision 6). It protects `state.json` and `saves/<id>.json` from concurrent writes (R-11) by acquiring a cross-process lock around every `read-modify-write` cycle. The library is MIT, ~30 kB, zero transitive runtime deps, actively maintained, and uses the standard `*.lock` file pattern. The lock is **injected** via a `LockFactory` function so `state.ts` and `save.ts` stay pure and unit-testable. The default TTL is 5 s and stalled locks expire automatically; `acquire()` retries 5× with 50 ms backoff before returning `{ ok: false, reason: 'busy' \| 'timeout' }` (discriminated union, never throws for expected contention). | Concurrency safety is the only way to make `--stats` + a winning TUI session truly safe (R-11). The dep is small, focused, and has a single responsibility. Wrapping it in a `LockFactory` interface preserves the project's "pure modules" rule (G-13) and keeps the unit tests fast (no real lock-file I/O in CI). | Hand-rolled lock file with `fs.open` + `flock`-like semantics (rejected: ~80 LOC, easy to get wrong, no automatic TTL). SQLite (rejected: native dep, far larger, G-20 + R-11 fix overkill). Optimistic concurrency (read + check + write with a CAS-style guard) (rejected: still loses updates if two writers read simultaneously; only useful for in-process debouncing). |
| 19 | **Inline + dismissable achievement screen on win** with a modern "premium" feel using **built-in ANSI + `picocolors` only** (no new runtime deps for UI). The win screen shows a one-line **inline banner** (`+2 achievements unlocked: speed_demon, no_hints_easy`); pressing `a` enters a **dismissable details screen** with an ASCII trophy, full title/description/rarity for each newly-unlocked achievement, and total progress (e.g. `8/11 achievements`). Any key returns to the win menu. Borders are **double-line Unicode** (`╔═╗║╚═╝╠═╣╦╩╬`); the color palette is fixed (cyan=selected/primary, dim gray=fixed, yellow=same-number, red=error, green=correct/win, magenta=achievement). | A single-line summary is what 90% of users want (it answers "what did I just get?"); a dismissable view satisfies the other 10% (the curious player). Built-in ANSI + `picocolors` keeps the bundle small (we already have `picocolors`; no new dep). Double-line borders look more "premium" than `+`/`-`/`\|` and render reliably on all modern terminals (Linux, macOS, Windows Terminal, iTerm2). | Inline only (rejected: long achievement lists overflow the banner). Separate screen only (rejected: extra keypress for users who just want to keep playing). Add a TUI library (`blessed`/`ink`) (rejected: ~150-300 kB, G-20 violation, framework lock-in). |

---

## 🧩 Game State Model

`src/game/state.ts` exports the following types and functions.

```typescript
import type { BoardType, DifficultyType } from '@hackettyam/sudoku-tools'

/** A 0-8 row,column pair. */
export interface CellPosition {
  readonly row: number
  readonly col: number
}

/**
 * Discriminated union of player actions. Every key the TUI understands
 * maps to exactly one variant; unknown keys are dropped by the parser.
 */
export type Move =
  | { readonly kind: 'place'; readonly row: number; readonly col: number; readonly value: number }
  | { readonly kind: 'clear'; readonly row: number; readonly col: number }
  | { readonly kind: 'move-cursor'; readonly row: number; readonly col: number }
  | { readonly kind: 'undo' }
  | { readonly kind: 'hint' } // places the correct value at the cursor if empty
  | { readonly kind: 'new-game' } // valid only in 'won' / 'quit' states
  | { readonly kind: 'quit' }

/** Status of a game in progress. */
export type GameStatus = 'playing' | 'won' | 'quit'

/**
 * The full, immutable state of a play session.
 *
 * `current` and `cursor` change on every move; everything else is
 * constant for a given `createGame()` call (except `history`, which
 * grows on each place/clear; `moveCount`, `hintCount`, `undoCount`,
 * and `errors`, which mirror the action log).
 */
export interface GameState {
  readonly status: GameStatus
  readonly difficulty: DifficultyType
  readonly original: BoardType       // immutable; the puzzle as generated
  readonly solution: BoardType      // immutable; the target solution
  readonly readOnly: readonly boolean[][] // true for fixed (clue) cells
  readonly current: BoardType        // player's progress
  readonly cursor: CellPosition
  readonly history: readonly Move[]  // for undo (place/clear only)
  readonly moveCount: number         // count of place/clear moves made
  readonly hintCount: number         // count of 'hint' moves applied
  readonly undoCount: number         // count of 'undo' moves applied
  readonly startTime: number         // epoch ms
  readonly errors: readonly string[] // serialized 'r,c' for non-matching filled cells
  readonly id?: string               // save UUID (assigned by `persistence/save`)
}

export function createGame(difficulty: DifficultyType): GameState
export function applyMove(state: GameState, move: Move): GameState
export function isWon(state: GameState): boolean
export function undo(state: GameState): GameState
export function isReadOnly(state: GameState, row: number, col: number): boolean
```

`createGame` wraps `createSudoku(difficulty)` from the library and
captures `original`, `solution`, and a derived `readOnly` mask (true
where `original[r][c] !== 0`). `applyMove` returns a new `GameState`
and short-circuits on `status: 'quit'` (no moves accepted). `isWon`
delegates to the library's `isSolved(current, solution)`. `undo`
pops the last `place`/`clear` move and re-applies the rest.

`applyMove` counter rules:

- `place` / `clear` → `moveCount += 1`, push to `history`, recompute
  `errors` via `getInvalidCells`.
- `undo` → `undoCount += 1`, drop the last history entry, recompute
  `moveCount = max(0, history.length)` and `errors`. (If history is
  empty, no-op — do not increment `undoCount`.)
- `hint` → `hintCount += 1`, place `solution[r][c]`, **also** push a
  synthetic `place` to `history` so the player can `u` to undo a hint.
  `moveCount` is **not** incremented (a hint is not a user move).
- `move-cursor` / `new-game` / `quit` → no counter changes.

These counters are read-only from the player's perspective and feed
directly into the achievement evaluator (see §Achievements below).

---

## 💾 Save File Format

A save is a single JSON file at `~/.sudoku-cli/saves/<uuid>.json`,
where `<uuid>` is a `crypto.randomUUID()` (RFC 4122 v4). The file is
written atomically (tmp + `fs.rename`).

```typescript
export interface SaveFile {
  readonly version: 1                  // schema version; bump on breaking change
  readonly id: string                  // UUID v4, matches the filename
  readonly createdAt: string           // ISO-8601 UTC
  readonly updatedAt: string           // ISO-8601 UTC
  readonly difficulty: DifficultyType
  readonly original: string            // 81-char board string (clues)
  readonly solution: string            // 81-char board string (solution)
  readonly current: string             // 81-char board string (player progress)
  readonly cursor: { row: number; col: number }
  readonly history: readonly Move[]    // for replay on resume
  readonly moveCount: number
  readonly hintCount: number
  readonly undoCount: number
  readonly startTime: number           // epoch ms (from GameState)
  readonly errors: readonly string[]   // serialized 'r,c' for invalid cells
}
```

**Example save file** (truncated):

```json
{
  "version": 1,
  "id": "a1b2c3d4-1234-4ef0-9abc-def012345678",
  "createdAt": "2026-06-19T14:23:01.123Z",
  "updatedAt": "2026-06-19T14:25:47.456Z",
  "difficulty": "normal",
  "original": "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  "solution": "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
  "current":   "534670000600195000098000060800060003400803001700020006060000280000419005000080079",
  "cursor":    { "row": 0, "col": 5 },
  "history":   [{ "kind": "place", "row": 0, "col": 0, "value": 5 }, ...],
  "moveCount": 12,
  "hintCount": 0,
  "undoCount": 0,
  "startTime": 1750340581123,
  "errors":    []
}
```

**Migration policy (v1 → v1.x):** a missing field is filled with a
sensible default (`history: []`, counters `0`, `errors: []`). A
**version mismatch** (file `version: 2` but the CLI is v1) rejects the
load with a typed `SaveVersionError` mapped to exit `2` — we do not
silently migrate user saves forward. Future migrations will be
delivered via a dedicated ADR.

**Why boards are stored as 81-char strings and not 9×9 arrays:**
the library's `serializeBoard` / `deserializeBoard` enforce the
canonical form (digits 0-9, row-major). Storing strings (a) avoids
JSON's awkward array-of-arrays representation, (b) is 30% smaller on
disk, and (c) is human-readable for the user inspecting their saves.

---

## 📊 State Schema

A single `~/.sudoku-cli/state.json` file. Versioned, human-readable,
atomic-written. On any parse error the dispatcher surfaces a clear
"state file corrupt" message and the user can recover by deleting it
(their saves are unaffected — they live in a sibling directory).

```typescript
export interface StateFile {
  readonly version: 1
  readonly stats: {
    readonly novice: PerDifficultyStats
    readonly easy:   PerDifficultyStats
    readonly normal: PerDifficultyStats
    readonly hard:   PerDifficultyStats
    readonly expert: PerDifficultyStats
  }
  readonly totalPlays: number   // sum of total across all difficulties
  readonly achievements: Readonly<Record<AchievementId, { readonly unlockedAt: string }>>
  readonly lastSaveId: string | null  // most recently created save; for --resume-last
}

export interface PerDifficultyStats {
  readonly totalPlays: number             // times a game at this difficulty was *started* (NOT incremented on resume — see decision 17)
  readonly totalWins: number              // times won (incremented only on isWon transition; idempotent)
  readonly bestTimeMs: number | null      // ms, null = no win yet
  readonly fewestMoves: number | null     // moves, null = no win yet
  readonly lastPlayedAt: number | null    // epoch ms of the most recent start (null = never started)
}
```

**Resume semantics (decision 17):** `totalPlays` is incremented
**only** when `playCommand` generates a **fresh** puzzle (a brand-new
game at a chosen difficulty). Resuming a save via `--load <id>` or
`--resume-last` does **not** increment `totalPlays` — a resumed game
is a continuation of the same play, not a new one. This means a
quit/resume cycle cannot inflate the metric. `totalWins` is
incremented **only** on the `isWon` transition (the first time the
board matches the solution in a single play); it is idempotent — if a
save was loaded and immediately solved, `totalWins` still gets +1
(the win is real; we just don't double-count if the player wins the
same save twice via some pathological flow).

**Example state file** (mid-game, partial progress):

```json
{
  "version": 1,
  "stats": {
    "novice": { "totalPlays": 1, "totalWins": 1, "bestTimeMs": 234567, "fewestMoves": 42, "lastPlayedAt": 1750340581123 },
    "easy":   { "totalPlays": 0, "totalWins": 0, "bestTimeMs": null, "fewestMoves": null, "lastPlayedAt": null },
    "normal": { "totalPlays": 0, "totalWins": 0, "bestTimeMs": null, "fewestMoves": null, "lastPlayedAt": null },
    "hard":   { "totalPlays": 0, "totalWins": 0, "bestTimeMs": null, "fewestMoves": null, "lastPlayedAt": null },
    "expert": { "totalPlays": 0, "totalWins": 0, "bestTimeMs": null, "fewestMoves": null, "lastPlayedAt": null }
  },
  "totalPlays": 1,
  "achievements": {
    "first_win": { "unlockedAt": "2026-06-19T14:25:47.456Z" }
  },
  "lastSaveId": "a1b2c3d4-1234-4ef0-9abc-def012345678"
}
```

> **Note:** the `winsAtBestTime` / `winsAtFewestMoves` fields that
> existed in v1.1.0 are **dropped** in v1.2.0. The top-level
> `totalPlays` is still the sum across all difficulties. If we ever
> want to know "how many wins shared the best time", the `play
> --leaderboard` output already conveys that via the
> `winsAtBest` column.

**Update semantics:** every win triggers a `read-modify-write` under
a process-wide lock (decision 18):
`acquireLock(statePath)` → `loadState` → `mergeStats` +
`unlockAchievements` (filters out ids already present) →
`saveState` (atomic) → `releaseLock`. Concurrent processes
(`play --stats` in one terminal, a TUI session in another) **cannot
corrupt** the state — the second writer blocks until the first
releases, then reads the freshest data. See §Risks R-11 (resolved)
and the new acceptance criterion #31.

---

## 🏆 Achievements

11 achievements, organized by tier. Each is a pure function over
`AchievementContext` (see Phase 1.5 step 5). The evaluator returns
the ids of **all** qualifying achievements; the play command then
unlocks only the not-yet-unlocked ones (idempotent).

| ID | Title | Tier | Unlock condition |
|----|-------|------|------------------|
| `first_win` | First Win | Novice | `difficulty === 'novice' && status === 'won'` |
| `speed_demon` | Speed Demon | Easy | `difficulty === 'easy' && status === 'won' && elapsedMs < 300_000` (5 min) |
| `no_hints_easy` | No Hints | Easy | `difficulty === 'easy' && status === 'won' && hintCount === 0` |
| `perfectionist` | Perfectionist | Normal | `difficulty === 'normal' && status === 'won' && errors.length === 0 && undoCount === 0` |
| `minimalist` | Minimalist | Normal | `difficulty === 'normal' && status === 'won' && moveCount <= 45` |
| `no_undo` | No Undo | Hard | `difficulty === 'hard' && status === 'won' && undoCount === 0` |
| `speedrunner` | Speedrunner | Hard | `difficulty === 'hard' && status === 'won' && elapsedMs < 600_000` (10 min) |
| `flawless_victory` | Flawless Victory | Expert | `difficulty === 'expert' && status === 'won' && errors.length === 0` (no wrong-digit placements; `0`/`Backspace` clear-and-retype is allowed and does not count as a "wrong placement" since the cell is empty at the end) |
| `untouchable` | Untouchable | Expert | `difficulty === 'expert' && status === 'won' && hintCount === 0` |
| `century` | Century | Cross | `sum(perDifficultyWins) >= 100` |
| `completionist` | Completionist | Cross | `difficultiesWon.length === 5` (all five difficulties won at least once) |

**Idempotency** is enforced in `unlockAchievements(state, ids)`:

```typescript
export function unlockAchievements(
  state: StateFile,
  ids: readonly AchievementId[]
): StateFile {
  const now = new Date().toISOString()
  const next = { ...state.achievements }
  for (const id of ids) {
    if (next[id] === undefined) {
      next[id] = { unlockedAt: now }
    }
  }
  return { ...state, achievements: next }
}
```

**Display rules:**

- On the **win screen**, only newly-unlocked achievements are listed
  (the ones returned by `evaluateAchievements` ∖ `state.achievements`).
  If none, the banner just shows "🎉 You won! 🎉" with stats.
- On `play --achievements`, all 11 are listed in two columns: unlocked
  (with `unlockedAt` date) and locked (with the description in dim
  gray).
- The on-disk state contains the full `Record<AchievementId, ...>` so
  a future `play --achievements --json` can re-emit it without needing
  the in-memory list.

**Why 11 and not more?** Each achievement needs: a unique id, a human
title, a clear condition, and a test case. 11 is a tractable set that
covers the three axes the user named (per-difficulty, per-axis
[speed / quality / no-assistance], cross-cutting). Adding more is
trivial — just append to `ACHIEVEMENTS` and add a row to the table
above.

---

## 🎮 Keybindings

| Key | Action | Notes |
|-----|--------|-------|
| `↑` / `↓` / `←` / `→` | Move cursor (clamped to board edges) | ANSI CSI sequences `\x1b[A..D`. |
| `Home` / `End` | Jump to col 0 / col 8 of the current row | `\x1b[H` / `\x1b[F`. |
| `Ctrl+Home` | Jump to `(0, 0)` | `\x1b[1;5H` (CSI 1;5 H). |
| `Ctrl+End` | Jump to `(8, 8)` | `\x1b[8;5H` (CSI 8;5 H). |
| `1`-`9` | Place digit at cursor | No-op if cell is read-only. Allowed even if the digit conflicts with rules; conflicts become red errors. |
| `0` / `Backspace` / `Delete` | Clear the cell at cursor | No-op if read-only. |
| `h` | Hint: place the correct value at cursor if empty | No-op if cursor is on a read-only or filled cell. |
| `u` | Undo last place/clear | No-op if history is empty. |
| `n` | Start a new game | Only valid when `status === 'won'` or `'quit'`. |
| `a` | Open the dismissable achievement view (win screen only) | New in v1.2.0 (decision 19). Only valid when `status === 'won'` and at least one new achievement was unlocked. No-op otherwise. |
| `q` / `Esc` | Quit | Exits cleanly, restores terminal, returns 0. |
| `Ctrl+C` | Force quit | Restores terminal, returns 130 (SIGINT convention). Always works. |

Unknown keys (including printable letters other than `h`/`u`/`n`/`q`/`a`)
are silently ignored — they neither redraw nor alter state.

---

## 🖼 Rendering

`renderGame(state: GameState, options: RenderOptions): string` returns a
single multi-line string written to the terminal as one `process.stdout.
write` call (so it does not flicker). The frame is composed of:

1. **Header** (1 line): `Sudoku CLI — <difficulty>`. Dim gray.
2. **Grid** (13 lines): Unicode box-drawing characters (`┌`, `┐`, `│`,
   `─`, `┼`, `├`, `┤`, `┬`, `┴`) form the outer box and the 3x3 box
   separators. Inside each cell, the value is left-padded to 1 character
   (digits 1-9) or `.` for empty. Cell width is 3 columns (`  N `) with
   1 space between cells.
3. **Stats line** (1 line): `Time: mm:ss  ·  Moves: NN  ·  Errors: NN`.
   Yellow when `moveCount > 0` and no errors; red when `errors.length >
   0`.
4. **Keybinding footer** (1 line): bracketed shortcuts grouped by
   category, dim gray.
5. **Status banner** (0–1 lines): only on `status === 'won'`. Two lines
   of green text: `🎉 You won! 🎉` and `Time: mm:ss  Moves: NN`.

### Cell Coloring

| Condition | Color (when enabled) |
|-----------|----------------------|
| Fixed (clue) cell | **bold** + default fg |
| User-filled cell, value matches solution | dim cyan |
| User-filled cell, value conflicts (in `errors`) | **red** + reverse-video |
| Empty cell | dim gray `.` |
| Cursor cell | **reverse-video** (overrides the above) |
| Same-number-as-cursor highlight | yellow background, dim fg (subtle) |

The cursor is rendered with `\x1b[7m` (reverse video). The same-number
highlight uses `\x1b[48;5;3m` (yellow background). When colors are
disabled (`NO_COLOR` set or non-TTY stdout), the same escape codes are
emitted as empty strings via `picocolors.createColors(false)`.

### Sample Frame (mid-game, easy difficulty)

```text
Sudoku CLI — easy

┌───────┬───────┬───────┐
│ 5 3 . │ . 7 . │ . . . │
│ 6 . . │ 1 9 5 │ . . . │
│ . 9 8 │ . . . │ . 6 . │
├───────┼───────┼───────┤
│ 8 . . │ . 6 . │ . . 3 │  ← cursor at (4, 6) would highlight there
│ 4 . . │ 8 . 3 │ . . 1 │
│ 7 . . │ . 2 . │ . . 6 │
├───────┼───────┼───────┤
│ . 6 . │ . . . │ 2 8 . │
│ . . . │ 4 1 9 │ . . 5 │
│ . . . │ . 8 . │ . 7 9 │
└───────┴───────┴───────┘

Time: 02:34  ·  Moves: 12  ·  Errors: 0

[↑↓←→] move  [1-9] place  [0/⌫] clear  [h] hint  [u] undo  [q] quit
```

(The above is the spec; the actual render uses box-drawing characters
without comment annotations.)

### Win Frame

```text
╔════════════════════════════════════════════════════════════════╗
║                          ✓ You won! ✓                         ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  ┌───────┬───────┬───────┐                                     ║
║  │ 5 3 4 │ 6 7 8 │ 9 1 2 │                                     ║
║  │ 6 7 2 │ 1 9 5 │ 3 4 8 │                                     ║
║  │ 1 9 8 │ 3 4 2 │ 5 6 7 │                                     ║
║  ├───────┼───────┼───────┤                                     ║
║  │ 8 5 9 │ 7 6 1 │ 4 2 3 │                                     ║
║  │ 4 2 6 │ 8 5 3 │ 7 9 1 │                                     ║
║  │ 7 1 3 │ 9 2 4 │ 8 5 6 │                                     ║
║  ├───────┼───────┼───────┤                                     ║
║  │ 9 6 1 │ 5 3 7 │ 2 8 4 │                                     ║
║  │ 2 8 7 │ 4 1 9 │ 6 3 5 │                                     ║
║  │ 3 4 5 │ 2 8 6 │ 1 7 9 │                                     ║
║  └───────┴───────┴───────┘                                     ║
║                                                                ║
║   ⏱ 05:23   → Moves: 47   ★ +2: speed_demon, no_hints_easy    ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║  [a] achievements  [n] new game  [q] quit                      ║
╚════════════════════════════════════════════════════════════════╝
```

(The above is the spec; the actual render uses double-line box-drawing
characters without comment annotations. The keybinding row updates
dynamically — `[a] achievements` only appears when at least one new
achievement was unlocked in this game.)

### Modern UI Guidelines (v1.2.0)

The win screen, the dismissable achievement view, and (selectively) the
in-game grid follow these guidelines. **No new runtime deps are
added** — all of the visual effects below use built-in ANSI escape
sequences + `picocolors` (decisions 6 + 19).

| Aspect | Guideline | Implementation |
|--------|-----------|----------------|
| **Borders** | Double-line Unicode (`╔═╗║╚═╝╠═╣╦╩╬`) for the win screen and the dismissable view. Looks more "premium" than `+`/`-`/`\|` and renders consistently on Linux, macOS, and Windows Terminal. | The grid itself stays single-line (`┌┐│─├┤┬┴┼`) for clarity, but the win + dismissable views use double-line. |
| **Color palette** | Fixed 16-color SGR via `picocolors`. | `cyan` = selected cell, primary numbers. `gray` (dim) = fixed clues. `yellow` = same-number highlight. `red` = conflicting digit. `green` = correct placement + win banner. `magenta` = achievement unlock highlight. |
| **Header** | Difficulty shown as a styled tag like `[ NORMAL ]` (uppercase, dim bg + bold fg). | Injected into the existing `renderGame` header in `tui.ts`. |
| **Layout** | Centered on screen width. | `\x1b[<n>G` (cursor horizontal absolute) for alignment without recomputing padding manually. Falls back to left-align when stdout is not a TTY. |
| **Spacing** | Generous. 1 blank line between sections. Footer keybindings in dim color. | Implemented in `renderWinBanner` / `renderAchievementInline` / `renderAchievementDetail`. |
| **Animations** | Subtle. On win, briefly flash the entire grid 3 times (green → default → green → default → green). | Cursor hidden during the animation via `\x1b[?25l`, restored on finish via `\x1b[?25h`. Total animation duration ≤ 600 ms. Honors `NO_COLOR` (no color flashes when disabled). |
| **Icons (text-based)** | Unicode glyphs for visual interest. | `★` (achievement), `✓` (win), `⏱` (timer), `→` (moves count), `?` (hint), `◆` (rare/legendary). Rendered via `picocolors` with semantic colors. Fallback to ASCII (`*`, `v`, `t`, `>`, `h`, `+`) when `NO_COLOR` is set **and** stdout is non-TTY (i.e., always ASCII in non-TTY mode for grep-ability). |
| **Header** | Difficulty tag as described above. | The `difficulty` field is uppercased and surrounded by brackets. |

### Win screen + dismissable achievement view (decision 19)

On the win screen, achievements appear in **two places**:

1. **Inline banner** (simple): a one-line summary in the stats row.
   Examples:
   - `★ +2 achievements unlocked: speed_demon, no_hints_easy`
   - `★ +1: minimal_undo` (single achievement)
   - `★ no new achievements` (zero — the line still appears in dim gray for visual consistency)
   - The line is omitted entirely if `colors` is disabled **and** stdout is not a TTY (machine-parseable mode).
2. **Dismissable details screen** (rich): a separate full-screen view
   the user enters by pressing `a` on the win banner. Shows:
   - A centered ASCII trophy art (3-4 lines, Unicode block chars).
   - Full title of each newly unlocked achievement.
   - Description (1-2 sentences).
   - Rarity tier (Bronze / Silver / Gold / Legendary), color-coded.
   - Total unlock progress (e.g. `8/11 achievements`) below the list.
   - Footer: "Press any key to return to the win menu."
   - User presses any key → returns to the win menu (the `Won` state is
     preserved; the dismissable view is a render-only sub-state).

The dismissable view is **rendered in-place** on the alt screen (no
extra alt-screen toggle); the `Won` state machine is extended with a
`view: 'menu' \| 'achievements'` sub-field. Pressing any key in
`view: 'achievements'` sets `view: 'menu'`. The `q` / `n` / `Esc`
keybindings behave identically in both views except `Esc` returns to
the menu (does **not** quit) when the dismissable view is open.

**Keybinding on the win screen:**

| Key | Action |
|-----|--------|
| `a` | Open the dismissable achievement view (only when `unlocked.length > 0`). |
| `n` | Start a new game. |
| `q` / `Esc` | Quit. |
| `Ctrl+C` | Force quit (always works). |

(Other letters are no-ops on the win screen — they neither redraw nor
trigger any side effect.)

---

## ✅ Acceptance Criteria

A pull request implementing this plan is accepted when **all** of the
following are demonstrably true:

1. `sudoku-cli play` launches an interactive TUI in a real terminal.
2. The puzzle is generated at the requested difficulty (or `normal` by
   default), and the original clues are visually distinct from
   user-entered values.
3. The cursor starts at `(0, 0)`; arrow keys move it (clamped to board
   edges); `Home`/`End` jump horizontally; `Ctrl+Home`/`Ctrl+End` jump
   to corners.
4. Typing `1`-`9` at an editable cell places the digit; typing `0`,
   `Backspace`, or `Delete` clears it; read-only cells reject all
   writes (no state change, no error beep — silently ignored).
5. Pressing `h` on an empty editable cell places the correct value
   (using `solution[r][c]`).
6. Pressing `u` undoes the most recent place/clear; repeated presses
   walk back through the history; `u` on an empty history is a no-op.
7. Pressing `q` or `Esc` exits cleanly with code `0`. The terminal is
   fully restored: cursor is visible, alt screen is left, raw mode is
   off, the shell prompt is on a fresh line.
8. Pressing `Ctrl+C` exits with code `130`. The terminal is fully
   restored as in (7).
9. Filling the board so that `isSolved(current, solution)` returns
   `true` transitions the game to `status: 'won'` and renders the
   green win banner. From the win screen, `n` starts a new game at the
   same difficulty and `q` quits with code `0`.
10. `NO_COLOR=1` produces an identical render minus color/background
    escapes. A non-TTY stdout (e.g. `| cat`) also disables colors.
11. `FORCE_COLOR=1` forces colors on even when stdout is not a TTY
    (useful for CI snapshot tests).
12. `sudoku-cli play --difficulty insane` exits with code `2` and a
    user-friendly error mentioning valid difficulty levels.
13. `sudoku-cli play --help` prints the play-specific help (keybinding
    list, exit codes).
14. `sudoku-cli --help` lists `play` alongside the other commands.
15. All new modules (`game/state.ts`, `tui.ts`, `format/colors.ts`,
    `commands/play.ts`, and the new `output.ts` additions) reach
    **100%** line, statement, and function coverage. The existing
    exclusion of `src/cli.ts` and `src/index.ts` is preserved.
16. `pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm build`
    all pass.
17. The `dist/cli.js` produced by `pnpm build:bundle` is still a single
    self-contained file with a shebang, and bundles `picocolors`
    in-line (no external runtime file deps).
18. Running `node dist/cli.js play --difficulty easy` works on Linux
    and macOS terminals; manual smoke verifies (1)–(14) above.

### Persistence + Gamification (new in v1.1.0)

19. **Save on quit / Ctrl+C**: when the player quits mid-game (or hits
    Ctrl+C, or sends SIGTERM), a `saves/<uuid>.json` file is written
    before the TUI cleans up, provided the game is not already won.
    The save is atomic (tmp+rename). The save prompt footer shows the
    short id and the `--load` / `--resume-last` hints.
20. **Resume loads the same state**: `play --load <id>` reads the save
    and bootstraps a `GameState` with the same board, cursor, history,
    move count, hint count, undo count, and errors as when the game
    was saved. The TUI renders an identical first frame to the last
    frame seen before quit.
21. **`--resume-last`**: `play --resume-last` loads the most recent
    save (id stored in `state.json#lastSaveId`). If no save exists,
    exit `1` with a "no saved games" message.
22. **Stats accumulate (Q-NEW-1 resolved)**: winning 3 easy games
    in a row produces `state.json` with
    `stats.easy.totalWins === 3` and the `bestTimeMs` /
    `fewestMoves` fields updated to the min. Starting a new game
    increments `stats.<difficulty>.totalPlays` by **exactly 1**;
    **resuming a save does not** increment `totalPlays` (decision 17).
    A failed (unsolved) quit increments `totalPlays` by 1 (the game
    was started) and leaves `totalWins` unchanged. Winning the same
    save twice does not double-count (the win is recorded exactly
    once per real `isWon` transition).
23. **Achievements unlock exactly once**: winning an easy game in
    under 5 min unlocks `speed_demon` once. Winning a second easy
    game in under 5 min does **not** re-unlock it (the
    `unlockedAt` timestamp remains the original). The win banner
    lists the achievement only the first time.
24. **`play --stats` and `play --achievements` print to stdout in
    machine-parseable format**: one key=value pair per line, with
    stable key order (see §State Schema). `play --leaderboard` prints
    a fixed-width ASCII table (one row per difficulty) on stdout.
    All three exit `0`.
25. **Corrupt save file → graceful error**: deleting the first byte
    of `saves/<id>.json` and then running `play --load <id>` exits
    with code `2` and a "save file is corrupt" message. The user
    is **not** dropped into a half-broken TUI; the dispatcher
    surfaces the error and exits cleanly.
26. **`~/.sudoku-cli/` directory is auto-created with `0o700` perms
    on first write** (G-S07). The state and save files are `0o600`.
    On a multi-user system, another user **cannot** read another
    user's state or saves (`stat` confirms).
27. **No secrets in saves**: `sec-secrets` on the new persistence
    modules and on a representative save file reports 0 hits
    (G-S01). Saves contain only: difficulty, board strings, cursor
    position, history, counters, timestamps.
28. **Concurrent writes to `state.json` are now safe (Q-NEW-2
    resolved)**: if two `play` processes attempt a `read-modify-write`
    simultaneously, the second blocks on the
    `proper-lockfile`-managed `*.lock` file and proceeds only after
    the first releases. No lost updates. Verified by
    `src/persistence/__tests__/state-concurrent.test.ts` using
    `node:child_process.fork`. The lock defaults (5 s TTL, 5 retries
    × 50 ms backoff) are documented in §Decisions #18. If a writer
    fails to acquire the lock after exhausting retries, the command
    returns `play_exit: { reason: 'error', message: 'state file is
    busy; please retry' }` (mapped to exit `2` by the dispatcher).
29. **All new persistence modules** (`src/persistence/state.ts`,
    `src/persistence/save.ts`, `src/persistence/lock.ts`,
    `src/persistence/achievements.ts`, `src/format/table.ts`, the
    three `play-*` command files) reach **100%** line / statement /
    function coverage. `proper-lockfile` itself is **excluded**
    from coverage (third-party).
30. **`pnpm audit` reports 0 vulnerabilities** for the new
    dependencies (`picocolors@^1.1.0` and `proper-lockfile@^4.1.2`).
    Both libraries are CVE-free at the pinned versions.

### Inline + dismissable achievement screen (new in v1.2.0)

31. **Win screen shows inline achievement summary (Q-NEW-3)**:
    on `status: 'won'`, the win screen stats row includes a
    one-line summary formatted as
    `★ +<N> achievements unlocked: <id1>, <id2>, ...` (or
    `★ +1: <id>` / `★ no new achievements`). The line is omitted in
    machine-parseable mode (non-TTY stdout).
32. **Pressing `a` enters the dismissable view**: from the win
    screen, pressing `a` (when at least one new achievement was
    unlocked) replaces the win screen with the dismissable view
    showing the ASCII trophy, full titles, descriptions, rarity
    tiers (color-coded), and total progress (e.g. `8/11
    achievements`). Pressing any other key returns to the win
    menu. The `Won` state is preserved across the toggle.
33. **Dismissable view shows full achievement details + total
    progress**: each newly unlocked achievement is rendered as a
    2-line card inside a double-line box, with title (bold),
    description (regular), and rarity (Bronze / Silver / Gold /
    Legendary, color-coded). The total progress
    `unlocked/total` is shown below the list.
34. **All UI uses built-in ANSI + `picocolors`**: the win screen,
    the inline banner, and the dismissable view all use only
    `picocolors` (decision 6) and built-in ANSI escape sequences
    for cursor positioning / box drawing. **No new runtime deps
    for UI** (decisions 6 + 19). When `NO_COLOR` is set or stdout
    is non-TTY, the same layout renders without color and with
    ASCII icon fallbacks (`*`, `v`, `t`, `>`, `h`, `+`) for
    grep-ability.

---

## ⚠️ Risks and Mitigations

| # | Risk | Probability | Impact | Mitigation |
|---|------|:-----------:|:------:|------------|
| R-1 | `process.stdin.setRawMode` is unavailable (Windows console, non-TTY, redirected stdin) → throw on `play` start. | Medium | Medium | Detect with `process.stdin.isTTY === false` (or try/catch around `setRawMode`). On non-TTY: emit a clear error to stderr ("`play` requires an interactive terminal") and exit `2`. Documented in README. |
| R-2 | User kills the process with `kill -9` or unplugs the terminal → terminal left in raw mode. | Low | High | The session installs `SIGINT` and `SIGTERM` handlers and registers a `process.on('exit')` last-resort cleanup that always writes the leave-alt-screen + show-cursor codes. Unrecoverable signals (SIGKILL) are out of scope; this is the universal Node TTY behavior. |
| R-3 | `picocolors` adds a runtime dep → violates G-20 strict reading. | Low | Low | Documented in §Decisions #6. The exception is explicit, narrowly scoped (one package, ~6 kB, ISC, zero transitive deps), and recorded in the plan. No other runtime deps are added. |
| R-4 | ANSI escape codes misrender in some terminals (Windows cmd, old xterm, tmux without `TERM=xterm-256color`). | Medium | Low | We only emit standard SGR codes (color, bg, bold, reverse) and standard CSI cursor codes — broadly supported. The alt-screen buffer (`\x1b[?1049h`) and hide-cursor (`\x1b[?25l`) are part of xterm since 1988. README notes "best on modern terminals; minimum VT100 + color." Tier 2 may add a fallback to plain ASCII if needed. |
| R-5 | Snapshot tests become brittle (e.g. box-drawing character width). | Low | Medium | Pin the snapshot fixture. If the layout changes intentionally, snapshots are updated with `vitest -u` and reviewed in the PR. |
| R-6 | `runTuiSession` mock differs from real Node behavior (e.g. `setRawMode` does more than we think). | Low | Medium | Unit tests cover the documented surface; manual smoke tests in Phase 5 catch any gap. Keep the helper < 60 LOC to minimize the risk surface. |
| R-7 | `parseKeypress` misinterprets a multi-byte UTF-8 sequence (e.g. user types `é`) as an arrow key. | Low | Low | Validate the first byte (`0x1b` → escape sequence) and the next 2–3 bytes; any unrecognized CSI sequence is dropped silently. UTF-8 multi-byte sequences never start with `0x1b`, so they are safe. |
| R-8 | Adding a runtime dep slows down `pnpm install` in CI. | Low | Low | `picocolors` is ~6 kB and tarball < 20 kB. No native build, no postinstall. No measurable impact. |
| R-9 | `picocolors`'s MIT/ISC version mismatch (CVE or rename). | Low | Low | Pin to `^1.1.0` (the only stable major for years). The package has no transitive deps. |
| R-10 | `pnpm-workspace.yaml` or `pnpm.onlyBuiltDependencies` needs an update for the new dep. | Low | Low | `picocolors` has no `postinstall`; no change required. |
| R-11 | **Concurrent writes** to `state.json` from two simultaneous `play` processes (e.g. user runs `play --stats` in one terminal while a TUI session in another wins and writes state) → lost update. | **Resolved in v1.2.0** (was: Low → lost update; now: Low → blocked by lock). | Medium | **Resolved in v1.2.0 by decision 18.** Every `read-modify-write` cycle (`loadState` → `mergeStats` + `unlockAchievements` → `saveState`) is wrapped in a cross-process lock via `proper-lockfile@^4.1.2` (MIT, ~30 kB). The lock factory (`src/persistence/lock.ts`) returns a discriminated-union result and never throws for expected contention. A multi-process test (`src/persistence/__tests__/state-concurrent.test.ts`) using `node:child_process.fork` verifies that two simultaneous writers do not corrupt `state.json` (acceptance criterion #31). |
| R-12 | **Save file version migration** when we bump `SaveFile` shape in v1.1+ (e.g. add a new field). Old saves become unloadable. | Low | Medium | The schema has a `version: 1` field. A load with a mismatched version rejects the file with a typed `SaveVersionError` (mapped to exit `2`). A future ADR will define a migration runner (e.g. v1 → v2 with default fills). For Tier 1, breaking the save schema = a Semver MAJOR bump. |
| R-13 | **Privacy**: `state.json` contains gameplay metadata (timestamps, board strings the user solved). If a user shares their `~/.sudoku-cli/` directory, the recipient learns what they played. | Low | Low | Documented in README. Saves never contain PII, credentials, or paths outside `~/.sudoku-cli/`. No telemetry, no network. G-S01 enforced via `sec-secrets`. |
| R-14 | **Achievement evaluator** has a subtle bug (e.g. off-by-one on `elapsedMs` boundary) → user is silently denied or wrongly granted an achievement. | Low | Medium | The evaluator is **pure** and **table-driven** in tests: one test per achievement × at least 2 boundary conditions. The win screen explicitly lists what was unlocked, so a mis-grant is visible immediately. A "reset achievements" command is a future enhancement. |
| R-15 | **`crypto.randomUUID()`** is unavailable on Node < 14.17 / 15.6. | Low | Low | The project's `engines.node >= 18.3.0` (per the repo `AGENTS.md`), so this is moot. The test suite runs on the same Node version. |
| R-16 | **Disk full / permission denied** mid-write → save state corruption. | Low | High | Atomic write via tmp+rename means the original file is never partially overwritten. If the tmp write fails, the original is untouched. If the rename fails (cross-device link, permission), the typed `SaveError` is surfaced to the TUI and mapped to `play_exit: error` — the TUI still cleans up and the user is informed. |
| R-17 | **Display width** in the leaderboard table is wrong for some terminals (e.g. CJK characters in user-saved names, future feature). | Low | Low | Tier 1 has no user-named content; the table is purely numbers and ASCII. The `displayWidth` helper is documented as "good enough for ASCII + emoji". If we add user-named rows in Tier 2, we may need `string-width` (would require a G-20 exception). |

---

## ✅ Quality Gates

- [ ] `pnpm lint` passes (ESLint 9 flat config, G-02..G-22).
- [ ] `pnpm typecheck` passes (TS strict, G-01..G-22).
- [ ] `pnpm test:coverage` passes at 100% line / statement / function
      coverage on all non-excluded files (G-T02). The new persistence
      modules, new commands, and new format module are all in scope.
- [ ] `pnpm build` produces a valid `dist/cli.js` (single self-contained
      file with shebang). `dist/cli.js` ≤ 75 kB (v1.2.0 budget; was
      ≤ 45 kB in v1.1.0; +30 kB from `proper-lockfile`).
- [ ] All new exports have full JSDoc (`@param`, `@returns`, `@example`)
      — G-19.
- [ ] No circular deps (G-13) — verified by import-graph review:
      `game/state` → library only; `tui` → `game/state`, `format/colors`,
      library; `format/colors` → `picocolors`, `node:tty`;
      `persistence/state` → `node:*`, `persistence/lock` (via DI, type
      only); `persistence/save` → `persistence/state`, `game/state`;
      `persistence/lock` → `proper-lockfile` only (no project
      modules); `persistence/achievements` → `persistence/state`,
      `game/state`; `format/table` → none; `commands/play` →
      `game/state`, `tui`, `output`, `args`, `format/difficulty`,
      `commands/result`, `persistence/state`, `persistence/save`,
      `persistence/achievements`, library; `commands/play-{stats,
      achievements,leaderboard}` → `persistence/state`,
      `commands/result`, `format/table` (leaderboard only);
      `output` (additions) → `node:process`, `node:tty`,
      `tui.parseKeypress` (only the parser, not the renderer).
- [ ] Security: no secrets in code (G-S01), no `eval`/`new Function`
      (G-S03), `parseKeypress` validated against the documented
      sequence grammar (G-S02), `~/.sudoku-cli/` created with `0o700`
      (G-S07), and the only new runtime deps are `picocolors`
      (decision 6) and `proper-lockfile` (decision 18) — both
      0 CVEs at the pinned versions (G-S04/G-S05).
- [ ] `pnpm audit` reports 0 vulnerabilities. `sec-scan` and
      `sec-secrets` on `src/persistence/*.ts` report 0 hits.
- [ ] README updated with `### sudoku-cli play` section, keybinding
      table, ASCII layout, exit codes, and a "Persistence" / "Stats" /
      "Achievements" / "Leaderboard" sub-section each.
- [ ] No console.log in production code (G-07). The `colors` wrapper
      itself uses only ANSI escapes; the test file (`output.test.ts`)
      already has `no-console: off` (eslint.config.mjs).
- [ ] Atomic-write correctness: a test simulates a crash mid-write
      (e.g. `writeFile` throws) and asserts the original state file
      is **not** corrupted (still loadable, or still missing).

---

## 📈 Expected Results

### Immediate Benefits

- A new, headline subcommand that makes `@hackettyam/sudoku-cli` a
  game, not just a calculator.
- **Save / resume** lets users close the terminal and pick up the
  same puzzle tomorrow — a major quality-of-life upgrade.
- **Per-difficulty leaderboards and achievements** give players
  concrete goals and replay value (the "one more game" loop).
- A reusable, pure TUI rendering layer that future features
  (Tier 2: puzzle-of-the-day, daily challenges, networked
  leaderboards) can build on.
- A reusable, pure persistence layer (`FsAdapter` + atomic write) that
  any future CLI in the user's toolset can adopt.
- A reusable, pure color wrapper that any other command can use
  (e.g. colorized difficulty lines in `new --pretty`).

### Long-term Benefits

- Foundation for Tier 2 features (deterministic seeds when the
  library grows them, daily challenges, networked leaderboards, share
  a save by id).
- A second showcase for the library alongside `react-sudoku`.
- Reference implementation for "terminal UI + persistence + light
  gamification on top of a pure logic library" for the user's other
  CLI projects.

### Quantitative Metrics

| Metric | Current | v1.0.0 | v1.1.0 | v1.2.0 (target) |
|--------|---------|:------:|:------:|:---------------:|
| Subcommands | 4 | 5 (`+play`) | 5 (with 4 flag variants on `play`) | 5 (unchanged) |
| Persistent state | none | none | `~/.sudoku-cli/state.json` + `saves/<uuid>.json` | unchanged |
| Achievements | — | — | 11 | 11 (unchanged) |
| Pure modules in `src/` | 6 | 9 | 13 (+ `persistence/*`, `format/table`) | 14 (+ `persistence/lock`) |
| Test count (estimate) | 60 | ~95 | ~140 | ~165 (+25 for lock + dismissable view + concurrent test) |
| Coverage (lines) | 100% | 100% | 100% | 100% (unchanged gate) |
| `dist/cli.js` size | ~25 kB | ~32 kB | ~40 kB | ~65-70 kB (+~30 kB from `proper-lockfile`) |
| Bundle budget (max) | — | 45 kB | 45 kB | 75 kB |
| Number of runtime deps | 1 | 2 (+ `picocolors`) | 2 (unchanged) | 3 (+ `proper-lockfile`) |
| Manual smoke-test time | 0 | ~5 min/PR | ~10 min/PR | ~12 min/PR (+dismissable view walkthrough) |
| Estimated effort (comfortable) | — | ~1.5 weeks | ~2.5-3.5 weeks | ~3-4 weeks |
| Estimated effort (sprint) | — | ~3-4 days | ~4-5 days | ~5-6 days |

---

## 📚 References

- Global rules: `~/.config/opencode/AGENTS.md` (§3.1–3.6, G-01..G-22, G-T01..G-10, G-S01..G-08, G-L01..G-05).
- Project rules: `AGENTS.md` (root of this repo).
- Library API: `/home/hackettyam/www/@hackettyam/libs/react/react-sudoku/src/types/sudoku-tools.d.ts` and the
  `.d.ts` files under `node_modules/@hackettyam/sudoku-tools/dist/`.
- React reference implementation:
  `/home/hackettyam/www/@hackettyam/libs/react/react-sudoku/src/utils/sudoku.ts`
  (idiomatic usage of `setCellValue`, `clearCell`, `getHint`,
  `getInvalidCells`, `countEmptyCells`).
- `picocolors`: <https://github.com/alexeyraspopov/picocolors> (ISC, ~6 kB).
- `proper-lockfile`: <https://github.com/moxystudio/node-proper-lockfile>
  (MIT, ~30 kB, used for cross-process file locking on `state.json` —
  decision 18, the **second** explicit G-20 exception after `picocolors`).
- `no-color.org` standard: <https://no-color.org/> (env var `NO_COLOR`).
- xterm control sequences: <https://invisible-island.net/xterm/ctlseqs/ctlseqs.html>.
- XDG Base Directory specification: <https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html>
  (`$XDG_STATE_HOME`, used as a fallback for the state dir).
- Node `crypto.randomUUID()`: <https://nodejs.org/api/crypto.html#cryptorandomuuidoptions>
  (RFC 4122 v4 UUIDs, available on Node ≥ 14.17 / 15.6 — moot for us
  since we pin `>= 18.3.0`).
- `node:fs/promises` + atomic-write pattern: <https://nodejs.org/api/fs.html#fspromiseswritefilefile-data-options>
  (write-tmp-then-rename for crash safety).
- OpenCode plan template: `~/.config/opencode/templates/PLAN_MD.md`.
- OpenCode actions template: `~/.config/opencode/templates/ACTIONS_MD.md`.
- OpenCode skill catalog: `~/.config/opencode/skills/`
  (especially `spec-*`, `code-*`, `test-*`, `sec-*`, `docs-*`,
  `memory-*`, `analyze-*`, `commit-generation`, `release-*`,
  `project-*`, `perf-*` — used in `actions.md` delegation tables).

---

**Next step:** see `.opencode/planifications/feature-play-mode/actions.md`
for the ordered, atomic implementation steps. This plan is not yet
implemented; user approval is required before handoff to the `code` agent.
