---
id: feature-play-mode
title: Interactive Play Mode for Sudoku CLI
status: Implemented
template: cli-tool
scope: project
author: spec + hackettyam
interfaces: [playCommand, createGame, applyMove, isWon, parseKeypress, renderGame, runTuiSession, loadState, saveState, saveGame, loadGame, evaluateAchievements, formatTable, shouldEnableColors]
companion: requirements.md
tags: [tui, persistence, gamification, interactive]
---

# 📐 Design: Interactive Play Mode

## 🎯 Objective

Add a `play` subcommand to `@hackettyam/sudoku-cli` for interactive Sudoku — generate, fill, hint, undo, win, persist, and track achievements.

**Global Rules:** G-01..G-22, G-T01..G-T10, G-S01..G-S08, G-L01..G-L05. See project `AGENTS.md`.

## 🏗️ Architecture Overview

Pure modules + I/O shell. Domain logic is pure; I/O confined to `src/output.ts` + `src/cli.ts`.

```
┌─────────────────────────────────────────────────────────┐
│                    src/cli.ts (I/O)                     │
│  Dispatcher: routes args → command → result → exit code │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
    ┌──────▼──────┐          ┌────────▼────────┐
    │ src/tui.ts  │          │src/persistence/ │
    │ Pure TUI    │          │ Pure state mgmt │
    │ render,     │          │ state, save,    │
    │ parse, map  │          │ achievements,   │
    └──────┬──────┘          │ lock            │
           │                 └────────┬────────┘
    ┌──────▼──────┐                   │
    │src/game/    │                   │
    │state.ts     │◄──────────────────┘
    │ Pure state  │
    │ machine     │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │sudoku-tools │
    │ (library)   │
    └─────────────┘
```

**Import graph (G-13):** `game/state→lib` · `tui→game/state, format/colors, lib` · `format/colors→picocolors, node:tty` · `persistence/state→node:*, persistence/lock` · `persistence/save→persistence/state, game/state` · `persistence/lock→proper-lockfile` · `persistence/achievements→persistence/state, game/state` · `format/table→none` · `commands/play→game/state, tui, output, args, format/difficulty, commands/result, persistence/*, lib` · `commands/play-{stats,achievements,leaderboard}→persistence/state, commands/result, format/table` · `output additions→node:process, node:tty, tui.parseKeypress`

## 🧩 Game State Model

**File:** `src/game/state.ts` (new)

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
  | { readonly kind: 'toggle-achievements' }

/** Status of a game in progress. */
export type GameStatus = 'playing' | 'won' | 'quit'

/** Sub-view on the win screen: 'menu' for the default win banner, 'achievements' for the dismissable detail view. */
export type WinView = 'menu' | 'achievements'

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
  readonly view?: WinView            // sub-view on win screen ('menu' | 'achievements')
}

export function createGame(difficulty: DifficultyType): GameState
export function applyMove(state: GameState, move: Move): GameState
export function isWon(state: GameState): boolean
export function undo(state: GameState): GameState
export function isReadOnly(state: GameState, row: number, col: number): boolean
export function getStats(state: GameState): { elapsedMs: number; moveCount: number; hintCount: number; undoCount: number; errorCount: number }
```

`createGame` wraps `createSudoku(difficulty)` from the library and captures `original`, `solution`, and a derived `readOnly` mask (true where `original[r][c] !== 0`). `applyMove` returns a new `GameState` and short-circuits on `status: 'quit'` (no moves accepted). `isWon` delegates to the library's `isSolved(current, solution)`. `undo` pops the last `place`/`clear` move and re-applies the rest.

### `applyMove` Counter Rules

| Move kind | `moveCount` | `hintCount` | `undoCount` | `history` | `errors` | Other |
|-----------|:-----------:|:-----------:|:-----------:|:---------:|:--------:|-------|
| `place` / `clear` | +1 | unchanged | unchanged | push Move | recompute via `getInvalidCells` | If `isSolved` → `status: 'won'` |
| `undo` (non-empty history) | recomputed = `history.length` | unchanged | +1 | pop last entry | recompute | — |
| `undo` (empty history) | unchanged | unchanged | unchanged | unchanged | unchanged | No-op (state returned unchanged) |
| `hint` | unchanged | +1 | unchanged | push synthetic `place` | recompute | Places `solution[r][c]` if cell empty + editable |
| `move-cursor` | unchanged | unchanged | unchanged | unchanged | unchanged | Clamp row/col to [0, 8] |
| `new-game` | — | — | — | — | — | Only valid when `status !== 'playing'`; calls `createGame` with same difficulty |
| `quit` | — | — | — | — | — | Sets `status: 'quit'` |

**Key detail for `hint`:** A hint places the correct value and pushes a synthetic `place` to `history` so the player can `u` to undo a hint. `moveCount` is **not** incremented (a hint is not a user move).

**Key detail for `undo`:** If history is empty, no-op — do **not** increment `undoCount`. Otherwise, `undoCount += 1`, drop the last history entry, recompute `moveCount = max(0, history.length)` and `errors`.

These counters are read-only from the player's perspective and feed directly into the achievement evaluator (see §Achievements below).

## 💾 Persistence Layer

### State File Schema

**File:** `src/persistence/state.ts` (new). A single `~/.sudoku-cli/state.json` file. Versioned, human-readable, atomic-written. On any parse error the dispatcher surfaces a clear "state file corrupt" message and the user can recover by deleting it (their saves are unaffected — they live in a sibling directory).

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

**Resume semantics (decision 17):** `totalPlays` is incremented **only** when `playCommand` generates a **fresh** puzzle (a brand-new game at a chosen difficulty). Resuming a save via `--load <id>` or `--resume-last` does **not** increment `totalPlays` — a resumed game is a continuation of the same play, not a new one. This means a quit/resume cycle cannot inflate the metric. `totalWins` is incremented **only** on the `isWon` transition (the first time the board matches the solution in a single play); it is idempotent — if a save was loaded and immediately solved, `totalWins` still gets +1 (the win is real; we just don't double-count if the player wins the same save twice via some pathological flow).

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

> **Note:** the `winsAtBestTime` / `winsAtFewestMoves` fields that existed in v1.1.0 are **dropped** in v1.2.0. The top-level `totalPlays` is still the sum across all difficulties. If we ever want to know "how many wins shared the best time", the `play --leaderboard` output already conveys that via the `winsAtBest` column.

### State Update Semantics

Every win triggers a `read-modify-write` under a process-wide lock (decision 18):

```
acquireLock(statePath)
→ loadState
→ mergeStats + unlockAchievements (filters out ids already present)
→ saveState (atomic)
→ releaseLock
```

Concurrent processes (`play --stats` in one terminal, a TUI session in another) **cannot corrupt** the state — the second writer blocks until the first releases, then reads the freshest data.

**Decision 17 detail:** `mode: 'start'` increments `totalPlays` by 1 and sets `lastPlayedAt`; `mode: 'win'` increments `totalWins` by 1 and updates `bestTimeMs` / `fewestMoves` if better. Each mode leaves the *other* counter unchanged. Resume does **not** call `mode: 'start'`.

**Decision 18 detail:** The lock is acquired at the start of `loadState`/`saveState` and released at the end (or on error). The lock is **never** held during in-memory work; only around the actual `readFile` / `writeFile` + `rename` calls. Concurrent writers block on the lock instead of racing.

### `mergeStats` Function

```typescript
export function mergeStats(
  prev: PerDifficultyStats,
  newResult: { elapsedMs?: number; moveCount?: number },
  mode: 'win' | 'start'
): PerDifficultyStats
```

- **`mode: 'start'`**: increments `totalPlays` by exactly 1, sets `lastPlayedAt = Date.now()`. Leaves `totalWins`, `bestTimeMs`, `fewestMoves` unchanged.
- **`mode: 'win'`**: increments `totalWins` by exactly 1, updates `bestTimeMs` if `newResult.elapsedMs < prev.bestTimeMs` (or if `prev.bestTimeMs` is null), updates `fewestMoves` if `newResult.moveCount < prev.fewestMoves` (or if `prev.fewestMoves` is null). Leaves `totalPlays` unchanged.

### `unlockAchievements` Function

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

Idempotent: calling it twice with the same id does not change `unlockedAt`.

### DI Interfaces

```typescript
/** Minimal file-system abstraction for testability. All I/O goes through this. */
export interface FsAdapter {
  readFile(p: string): Promise<string>
  writeFile(p: string, d: string): Promise<void>
  mkdir(p: string, o?: { mode?: number }): Promise<void>
  rename(o: string, n: string): Promise<void>
  exists(p: string): Promise<boolean>
  homedir(): string
  stat(p: string): Promise<{ size: number }>
}

/** Opaque handle returned by LockFactory.acquire(). Cannot be forged. */
export type LockHandle = { readonly __lock: unique symbol }

/** Discriminated-union result from lock acquisition. Never throws for expected contention. */
export type LockResult =
  | { readonly ok: true; readonly handle: LockHandle }
  | { readonly ok: false; readonly reason: 'busy' | 'timeout' }

/** Cross-process lock factory, injected into persistence modules. */
export interface LockFactory {
  acquire(): Promise<LockResult>
  release(h: LockHandle): Promise<void>
}
```

**Atomic write via tmp+rename:** `writeFile(<path>.tmp-<random>)` → `rename(<path>.tmp-<random>, <path>)`. Auto-creates the parent dir with mode `0o700` on first write (G-S07). Files written with `0o600`.

### Path Helpers

- `defaultStatePath(): string` — `~/.sudoku-cli/state.json` (or `$XDG_STATE_HOME/sudoku-cli/state.json` if the env var is set).
- `defaultSavesDir(): string` — sibling `saves/` dir.
- `defaultStateLockPath(statePath): string` — sibling `<statePath>.lock` (so the lock travels with the state file).

### Typed Errors

- `StateCorruptError` — returned when `loadState` encounters unparseable JSON.
- `StateVersionError` — returned when the file `version` does not match the expected `1`.
- `StateLockBusyError` — returned when the lock cannot be acquired after 5 retries.
- `SaveNotFoundError` — returned when `loadGame` cannot find a file for the given id.
- `SaveCorruptError` — returned when a save file contains unparseable JSON.
- `SaveVersionError` — returned when a save file has a version mismatch.

All errors are returned via `Result.err(...)` (discriminated union) — the functions never throw for expected failures.

## 💾 Save File Format

A save is a single JSON file at `~/.sudoku-cli/saves/<uuid>.json`, where `<uuid>` is a `crypto.randomUUID()` (RFC 4122 v4). The file is written atomically (tmp + `fs.rename`).

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
  "history":   [{ "kind": "place", "row": 0, "col": 0, "value": 5 }, "..."],
  "moveCount": 12,
  "hintCount": 0,
  "undoCount": 0,
  "startTime": 1750340581123,
  "errors":    []
}
```

**Migration policy (v1 → v1.x):** a missing field is filled with a sensible default (`history: []`, counters `0`, `errors: []`). A **version mismatch** (file `version: 2` but the CLI is v1) rejects the load with a typed `SaveVersionError` mapped to exit `2` — we do not silently migrate user saves forward. Future migrations will be delivered via a dedicated ADR.

**Why boards are stored as 81-char strings and not 9×9 arrays:** the library's `serializeBoard` / `deserializeBoard` enforce the canonical form (digits 0-9, row-major). Storing strings (a) avoids JSON's awkward array-of-arrays representation, (b) is 30% smaller on disk, and (c) is human-readable for the user inspecting their saves.

### Save File Functions

- `saveGame(fs, state, dir): Promise<string>` — assigns `state.id = crypto.randomUUID()`, writes `saves/<id>.json` atomically, returns the id.
- `loadGame(fs, id, dir): GameState` — reads `saves/<id>.json`, deserializes, returns a `GameState` with `id` set. Throws `SaveNotFoundError` or `SaveCorruptError` on failure.
- `listSaves(fs, dir): readonly SaveSummary[]` — returns `[{ id, createdAt, updatedAt, difficulty, moveCount, isWon }]` for each save file.
- `latestSaveId(fs, state, dir): string | null` — reads the saves index from `state.json` (`lastSaveId` field) and returns the id (or `null`).
- `validateSaveId(id: string): boolean` — rejects anything that doesn't match the UUID v4 regex (defense in depth: even though we generate ids via `crypto.randomUUID()`, this guards against user-supplied ids from `play --load <id>`).

## 🏆 Achievements

11 achievements, organized by tier. Each is a pure function over `AchievementContext`. The evaluator returns the ids of **all** qualifying achievements; the play command then unlocks only the not-yet-unlocked ones (idempotent).

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

```typescript
export interface AchievementContext {
  readonly difficulty: DifficultyType
  readonly elapsedMs: number
  readonly moveCount: number
  readonly hintCount: number
  readonly undoCount: number
  readonly errors: readonly string[]
  readonly perDifficultyWins: Readonly<Record<DifficultyType, number>>
  readonly difficultiesWon: readonly DifficultyType[]
}

export type AchievementId =
  | 'first_win' | 'speed_demon' | 'no_hints_easy' | 'perfectionist'
  | 'minimalist' | 'no_undo' | 'speedrunner' | 'flawless_victory'
  | 'untouchable' | 'century' | 'completionist'

export interface AchievementDefinition {
  readonly id: AchievementId
  readonly title: string
  readonly description: string
  readonly evaluate: (ctx: AchievementContext) => boolean
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] // frozen array of all 11

export function evaluateAchievements(ctx: AchievementContext): readonly AchievementId[]
```

**Idempotency** is enforced in `unlockAchievements(state, ids)` (see §Persistence Layer): calling it twice with the same id does not change `unlockedAt`.

**Display rules:**

- On the **win screen**, only newly-unlocked achievements are listed (the ones returned by `evaluateAchievements` ∖ `state.achievements`). If none, the banner just shows "🎉 You won! 🎉" with stats.
- On `play --achievements`, all 11 are listed in two columns: unlocked (with `unlockedAt` date) and locked (with the description in dim gray).
- The on-disk state contains the full `Record<AchievementId, ...>` so a future `play --achievements --json` can re-emit it without needing the in-memory list.

**Why 11 and not more?** Each achievement needs: a unique id, a human title, a clear condition, and a test case. 11 is a tractable set that covers the three axes the user named (per-difficulty, per-axis [speed / quality / no-assistance], cross-cutting). Adding more is trivial — just append to `ACHIEVEMENTS` and add a row to the table above.

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

Unknown keys (including printable letters other than `h`/`u`/`n`/`q`/`a`) are silently ignored — they neither redraw nor alter state.

## 🖼 TUI Rendering

**File:** `src/tui.ts` (pure).

`renderGame(state: GameState, options: RenderOptions): string` returns a single multi-line string written to the terminal as one `process.stdout.write` call (so it does not flicker). The frame is composed of:

### Render Stack

1. **Header** (1 line): `Sudoku CLI — <difficulty>`. Dim gray. Difficulty shown as a styled tag like `[ NORMAL ]` (uppercase, dim bg + bold fg).
2. **Grid** (13 lines): Unicode box-drawing characters (`┌`, `┐`, `│`, `─`, `┼`, `├`, `┤`, `┬`, `┴`) form the outer box and the 3x3 box separators. Inside each cell, the value is left-padded to 1 character (digits 1-9) or `.` for empty. Cell width is 3 columns (`  N `) with 1 space between cells.
3. **Stats line** (1 line): `⏱ mm:ss  → Moves: NN  ★ Errors: NN`. Yellow when `moveCount > 0` and no errors; red when `errors.length > 0`.
4. **Keybinding footer** (1 line): bracketed shortcuts grouped by category, dim gray.
5. **Status banner** (0–1 lines): only on `status === 'won'`. Delegates to `renderWinBanner`.

### Cell Coloring

| Condition | Color (when enabled) |
|-----------|----------------------|
| Fixed (clue) cell | **bold** + default fg |
| User-filled cell, value matches solution | dim cyan |
| User-filled cell, value conflicts (in `errors`) | **red** + reverse-video |
| Empty cell | dim gray `.` |
| Cursor cell | **reverse-video** (overrides the above) |
| Same-number-as-cursor highlight | yellow background, dim fg (subtle) |

The cursor is rendered with `\x1b[7m` (reverse video). The same-number highlight uses `\x1b[48;5;3m` (yellow background). When colors are disabled (`NO_COLOR` set or non-TTY stdout), the same escape codes are emitted as empty strings via `picocolors.createColors(false)`.

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

(The above is the spec; the actual render uses box-drawing characters without comment annotations.)

### Win Frame (Decision 19)

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

(The above is the spec; the actual render uses double-line box-drawing characters without comment annotations. The keybinding row updates dynamically — `[a] achievements` only appears when at least one new achievement was unlocked in this game.)

### Modern UI Guidelines (v1.2.0)

The win screen, the dismissable achievement view, and (selectively) the in-game grid follow these guidelines. **No new runtime deps are added** — all of the visual effects below use built-in ANSI escape sequences + `picocolors` (decisions 6 + 19).

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

### Win Screen + Dismissable Achievement View (Decision 19)

On the win screen, achievements appear in **two places**:

1. **Inline banner** (simple): a one-line summary in the stats row. Format: `'★ +<N> achievements unlocked: <id1>, <id2>, ...'` (or `'★ +1: <id>'` / `'★ no new achievements'`). The line is omitted entirely if `colors` is disabled **and** stdout is not a TTY (machine-parseable mode).

2. **Dismissable details screen** (rich): a separate full-screen view the user enters by pressing `a` on the win banner. Shows:
   - A centered ASCII trophy art (3-4 lines, Unicode block chars).
   - Full title of each newly unlocked achievement.
   - Description (1-2 sentences).
   - Rarity tier (Bronze / Silver / Gold / Legendary), color-coded.
   - Total unlock progress (e.g. `8/11 achievements`) below the list.
   - Footer: "Press any key to return to the win menu."
   - User presses any key → returns to the win menu (the `Won` state is preserved; the dismissable view is a render-only sub-state).

The dismissable view is **rendered in-place** on the alt screen (no extra alt-screen toggle); the `Won` state machine is extended with a `view: 'menu' | 'achievements'` sub-field. Pressing any key in `view: 'achievements'` sets `view: 'menu'`. The `q` / `n` / `Esc` keybindings behave identically in both views except `Esc` returns to the menu (does **not** quit) when the dismissable view is open.

**Keybinding on the win screen:**

| Key | Action |
|-----|--------|
| `a` | Open the dismissable achievement view (only when `unlocked.length > 0`). |
| `n` | Start a new game. |
| `q` / `Esc` | Quit. |
| `Ctrl+C` | Force quit (always works). |

(Other letters are no-ops on the win screen — they neither redraw nor trigger any side effect.)

### Inline Achievement Summary Format

```typescript
export function renderAchievementInline(unlocked: readonly AchievementId[]): string
```

Returns the one-line summary for the win banner stats row. Format:
- `'★ no new achievements'` when `unlocked.length === 0` (dim gray).
- `'★ +1: <id>'` when exactly one.
- `'★ +<N> achievements unlocked: <id1>, <id2>, ...'` when multiple.
- Returns `''` (empty string) when `colors` is disabled **and** `isStdoutTty: false` (machine-parseable mode).

### Dismissable View Functions

```typescript
export type Rarity = 'bronze' | 'silver' | 'gold' | 'legendary'

export const ACHIEVEMENT_RARITY: Readonly<Record<AchievementId, Rarity>>
// frozen. Examples: first_win: 'bronze', completionist: 'gold', untouchable: 'legendary'

export function renderAchievementDetail(
  unlocked: readonly UnlockedAchievement[],
  totalUnlocked: number,
  totalAvailable: number,
  options: { colors: typeof import('picocolors'); isStdoutTty: boolean; screenWidth?: number }
): string
// Returns the full dismissable view: double-line box, centered ASCII trophy art,
// one 2-line card per unlocked achievement (title bold, description regular, rarity color-coded).
// Below cards: ★ <totalUnlocked> / <totalAvailable> achievements.
// Footer: "Press any key to return to the win menu." (dim gray).
// When isStdoutTty is false: same layout without colors, ASCII icon fallbacks.

export function renderTrophyArt(options: { colors: typeof import('picocolors'); isStdoutTty: boolean }): string
// Returns centered 3-4 line ASCII trophy.
// isStdoutTty true: Unicode block chars (█▀▀█, █░░█, █▄▄▄█, ★) in colors.yellow.
// isStdoutTty false: plain ASCII (====, |  |, ====, *) — no color, no Unicode block.
```

### Achievement Glyphs

```typescript
export const ACHIEVEMENT_GLYPHS: Readonly<Record<AchievementId, string>>
// Static map: id → '🏆' | '⚡' | '🎯' | ... (frozen, exactly 11 keys)
```

## 📡 I/O Shell

**File:** `src/output.ts` (extend).

```typescript
/** Minimal interface so the helper doesn't have to know about tui.ts directly. */
export interface KeySink {
  push(key: import('../tui.js').ParsedKey): void
}

/** Options for the TUI session. Colors and render are passed in to keep output.ts free of TUI/gui concerns. */
export interface TuiSessionOptions {
  colors: typeof import('picocolors')
  onKey: (sink: KeySink) => void
  render: () => string
}

/** Returned by runTuiSession. The orchestrator uses draw/cleanup/run to control the session. */
export interface TuiRunner {
  draw(frame: string): void
  cleanup(): void
  run(): Promise<{ exitCode: number; reason: 'quit' | 'win' | 'error' }>
}

export function runTuiSession(opts: TuiSessionOptions): TuiRunner
```

**Behavior:**

- On first `draw()`: if not yet set up, write `\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H` (enter alt screen, hide cursor, clear, home), call `process.stdin.setRawMode(true)`, `process.stdin.resume()`, register `data` listener, register `SIGINT` and `SIGTERM` cleanup handlers.
- The `data` listener calls `tui.parseKeypress(buf)` and forwards each parsed key to `opts.onKey(sink)`.
- `sink.push` is the API the orchestrator uses to mark the session as ended: `sink.push({ kind: 'ctrl-c' })` from a SIGINT handler triggers `resolve({ exitCode: 130, reason: 'quit' })`. The session distinguishes `'quit'` (user typed `q`/`Esc`/`Ctrl+C`) from `'win'` (orchestrator called `sink.push` with a sentinel) from `'error'` (uncaught exception in `render`).
- `cleanup()` is idempotent. Writes `\x1b[?25h\x1b[?1049l` (show cursor, leave alt screen), `setRawMode(false)`, `process.stdin.pause()`, removes all listeners, and is registered on `process.on('exit')` as a last-resort fallback.

## 🔒 Security Model

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
| R-11 | **Concurrent writes** to `state.json` from two simultaneous `play` processes → lost update. | **Resolved in v1.2.0** | Medium | **Resolved by decision 18.** Every `read-modify-write` cycle is wrapped in a cross-process lock via `proper-lockfile@^4.1.2` (MIT, ~30 kB). The lock factory returns a discriminated-union result and never throws for expected contention. A multi-process test using `node:child_process.fork` verifies no corruption. |
| R-12 | **Save file version migration** when we bump `SaveFile` shape in v1.1+. | Low | Medium | The schema has a `version: 1` field. A load with a mismatched version rejects the file with a typed `SaveVersionError` (mapped to exit `2`). A future ADR will define a migration runner. For Tier 1, breaking the save schema = a Semver MAJOR bump. |
| R-13 | **Privacy**: `state.json` contains gameplay metadata. | Low | Low | Documented in README. Saves never contain PII, credentials, or paths outside `~/.sudoku-cli/`. No telemetry, no network. G-S01 enforced via `sec-secrets`. |
| R-14 | **Achievement evaluator** has a subtle bug (e.g. off-by-one on `elapsedMs` boundary). | Low | Medium | The evaluator is **pure** and **table-driven** in tests: one test per achievement × at least 2 boundary conditions. The win screen explicitly lists what was unlocked, so a mis-grant is visible immediately. |
| R-15 | **`crypto.randomUUID()`** is unavailable on Node < 14.17 / 15.6. | Low | Low | The project's `engines.node >= 18.3.0`, so this is moot. |
| R-16 | **Disk full / permission denied** mid-write → save state corruption. | Low | High | Atomic write via tmp+rename means the original file is never partially overwritten. If the tmp write fails, the original is untouched. If the rename fails, the typed `SaveError` is surfaced to the TUI and mapped to `play_exit: error` — the TUI still cleans up. |
| R-17 | **Display width** in the leaderboard table is wrong for some terminals. | Low | Low | Tier 1 has no user-named content; the table is purely numbers and ASCII. The `displayWidth` helper is documented as "good enough for ASCII + emoji". |

## 📂 Scope

### New Files

| File | Purpose |
|------|---------|
| `src/game/state.ts` | Pure state machine |
| `src/tui.ts` | Pure TUI rendering |
| `src/format/colors.ts` | `shouldEnableColors` + singleton |
| `src/format/table.ts` | ASCII table renderer |
| `src/persistence/state.ts` | Load/save via `FsAdapter` + `LockFactory` |
| `src/persistence/save.ts` | Serialize/deserialize `GameState` |
| `src/persistence/lock.ts` | Factory wrapping `proper-lockfile` |
| `src/persistence/achievements.ts` | Definitions + `evaluateAchievements` |
| `src/commands/play.ts` | TUI orchestrator |
| `src/commands/play-stats.ts` | One-shot stats |
| `src/commands/play-achievements.ts` | One-shot achievements |
| `src/commands/play-leaderboard.ts` | One-shot leaderboard |

### Modified Files

| File | Purpose |
|------|---------|
| `package.json` | `picocolors` + `proper-lockfile` (G-20) |
| `src/cli.ts` | `case 'play':` dispatcher |
| `src/args.ts` | `'play'` subcommand, `parsePlayArgs`, `HELP_TEXT` |
| `src/output.ts` | `runTuiSession` |
| `src/index.ts` | Re-export public play types |
| `src/commands/result.ts` | `play_exit`, `play_stats`, `play_achievements`, `play_leaderboard` |
| `README.md` | play, persistence, stats, achievements, leaderboard |

### Out of Scope (Tier 2/3)

- `--no-color` CLI flag (auto-detection only in Tier 1).
- `--seed` for deterministic puzzle generation (library lacks seed support).
- Reading the puzzle board from stdin (interactive only).
- `--json` output mode for `play`.
- Descriptive validate errors.
- Multi-puzzle sessions or a "next puzzle" prompt mid-game.
- Mouse support.
- Configuration file (`.sudoku-clirc`).
- Cross-platform Windows console polish.
- Telemetry, analytics, or any networking. State is **local** only.
- Save-file migration tooling.
- Cloud sync, leaderboard server, or shared achievements.

## 💡 Key Design Decisions

| # | Decision | Rationale | Alternatives |
|---|----------|-----------|-------------|
| 1 | **New `play` subcommand** | Distinct intent, one verb per subcommand | `--interactive` on `new` (rejected) |
| 2 | **TTY + `picocolors`** | Zero deps except picocolors (~6 kB) | chalk, blessed/ink (rejected) |
| 3 | **Pure-function arch** | `game/state.ts`, `tui.ts` pure; `output.ts` only I/O | Class-based Game (rejected) |
| 4 | **Mock `runTuiSession` tests** | Same pattern as `output.test.ts` | Exclude from coverage (rejected) |
| 5 | **`colors` thin wrapper** | Pure factory, testable | Manual wrapping (rejected) |
| 6 | **G-20 narrow exception** | Only `picocolors` + `proper-lockfile` | Hand-roll ANSI (rejected) |
| 7 | **No `--no-color` in Tier 1** | NO_COLOR env + TTY detection | Add flag (deferred) |
| 8 | **Immutable state** | Aligns with library immutability | Mutable (rejected) |
| 9 | **`renderGame` only ANSI emitter** | Single test seam | Sprinkle color calls (rejected) |
| 10 | **Library `isSolved` for win** | Reuse, don't reinvent | Custom check (rejected) |
| 11 | **`~/.sudoku-cli/state.json`** | Single versioned file + saves dir | SQLite (rejected) |
| 12 | **`FsAdapter` DI** | Testability | Direct fs calls (rejected) |
| 13 | **Atomic tmp+rename** | POSIX atomic, `0o700` dir | Direct writeFile (rejected) |
| 14 | **Pure achievements** | Testable, idempotent | Async unlock (rejected) |
| 15 | **One-shot as flags on `play`** | `play --stats`, etc. | Top-level subcommands (rejected) |
| 16 | **NO_COLOR, no flag yet** | Minimal surface | — |
| 17 | **Two counters** | `totalPlays` fresh start, `totalWins` on win | Single counter (rejected) |
| 18 | **`proper-lockfile` second G-20** | Concurrent safety, MIT, ~30 kB | Hand-rolled lock, SQLite (rejected) |
| 19 | **Inline + dismissable view** | Built-in ANSI + picocolors | TUI library (rejected) |

## ✅ Quality Gates

- [x] `pnpm typecheck` exits 0 (TS strict, G-01)
- [x] `pnpm lint` exits 0 (ESLint 9, G-02..G-22)
- [x] `pnpm test:coverage` shows 100% line/statement/function (G-T02)
- [x] `dist/cli.js` ≤ 75 kB, single file, shebang present
- [x] `dist/index.d.ts` valid; `playCommand` importable (G-04)
- [x] All new exports have JSDoc `@param`/`@returns`/`@example` (G-19)
- [x] No circular dependencies in import graph (G-13)
- [x] No secrets in saves (G-S01); `sec-secrets` reports 0 hits
- [x] No `eval()`/dynamic code in new modules (G-S03)
- [x] `~/.sudoku-cli/` created with `0o700`; files `0o600` (G-S07)
- [x] `pnpm audit --prod` reports 0 vulnerabilities (G-S04/G-S05)
- [x] `sec-scan`/`sec-sast` on `src/persistence/*.ts` report 0 findings
- [x] Cross-process concurrent-write test passes (decision 18)
- [x] README updated with play, persistence, stats, achievements, leaderboard sections
- [ ] Manual smoke test passes on real terminal (Linux + macOS)

## 📈 Expected Results

### Immediate Benefits

- A new, headline subcommand that makes `@hackettyam/sudoku-cli` a game, not just a calculator.
- **Save / resume** lets users close the terminal and pick up the same puzzle tomorrow — a major quality-of-life upgrade.
- **Per-difficulty leaderboards and achievements** give players concrete goals and replay value (the "one more game" loop).
- A reusable, pure TUI rendering layer that future features (Tier 2: puzzle-of-the-day, daily challenges, networked leaderboards) can build on.
- A reusable, pure persistence layer (`FsAdapter` + atomic write) that any future CLI in the user's toolset can adopt.
- A reusable, pure color wrapper that any other command can use (e.g. colorized difficulty lines in `new --pretty`).

### Long-term Benefits

- Foundation for Tier 2 features (deterministic seeds when the library grows them, daily challenges, networked leaderboards, share a save by id).
- A second showcase for the library alongside `react-sudoku`.
- Reference implementation for "terminal UI + persistence + light gamification on top of a pure logic library" for the user's other CLI projects.

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
