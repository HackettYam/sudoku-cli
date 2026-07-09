---
id: feature-play-mode
title: Interactive Play Mode for Sudoku CLI
status: Implemented
template: cli-tool
scope: project
author: spec + hackettyam
companion: design.md
tags: [tui, persistence, gamification, interactive]
---

# 📌 Requirements: Interactive Play Mode

## 🎯 Problem Statement

`@hackettyam/sudoku-cli` is a TypeScript CLI with four one-shot subcommands (`new`, `solve`, `validate`, `hint`). Every command produces a string and exits. There is no way for a user to **play** a Sudoku puzzle interactively in the terminal — they must generate a puzzle, mentally solve it, then call `validate` to check. This is cumbersome and not what most people expect from a "Sudoku CLI."

Without interactive play, the package remains a thin utility wrapper with no end-user appeal. The library's full power (generation + solving + hints) cannot be showcased through the CLI without copy-pasting puzzle strings. Tier 2 features (save/resume, leaderboards, achievements) cannot land coherently without an interactive foundation.

## 👤 User Stories

### Core Play

| ID | Story | Priority |
|----|-------|:--------:|
| US-01 | As a player, I want to run `sudoku-cli play` and immediately see an interactive Sudoku grid so I can start playing in my terminal. | High |
| US-02 | As a player, I want to move the cursor with arrow keys and place digits 1-9 so I can fill in the puzzle. | High |
| US-03 | As a player, I want to press `h` to get a hint that places the correct value at the cursor so I can get unstuck. | High |
| US-04 | As a player, I want to press `u` to undo my last move so I can correct mistakes. | High |
| US-05 | As a player, I want the game to detect when I've won and show me a celebration screen with my stats. | High |
| US-06 | As a player, I want to choose a difficulty level (`--difficulty`) so I can play at my skill level. | Medium |

### Persistence

| ID | Story | Priority |
|----|-------|:--------:|
| US-07 | As a player, I want my in-progress game to be saved automatically when I quit so I can resume later. | High |
| US-08 | As a player, I want to resume a specific save with `play --load <id>` so I can pick up where I left off. | High |
| US-09 | As a player, I want `play --resume-last` to automatically load my most recent save so I don't have to remember IDs. | Medium |

### Gamification

| ID | Story | Priority |
|----|-------|:--------:|
| US-10 | As a player, I want my wins and best times tracked per difficulty so I can see my progress over time. | Medium |
| US-11 | As a player, I want to earn achievements for milestones (first win, speed runs, no hints, etc.) so I have goals to work toward. | Medium |
| US-12 | As a player, I want to view my stats with `play --stats` so I can see my performance across difficulties. | Medium |
| US-13 | As a player, I want to view my achievements with `play --achievements` so I can see what I've unlocked and what's left. | Medium |
| US-14 | As a player, I want to see a leaderboard of my best times with `play --leaderboard` so I can track my records. | Medium |

### UX Quality

| ID | Story | Priority |
|----|-------|:--------:|
| US-15 | As a player, I want the terminal to be fully restored when I quit (cursor visible, alt screen left, prompt on fresh line). | High |
| US-16 | As a player, I want colors to work automatically (respecting `NO_COLOR` and TTY detection) without needing a flag. | Medium |
| US-17 | As a player, I want the win screen to show an inline achievement summary and a dismissable detailed view so I can see what I earned. | Medium |
| US-18 | As a player, I want the UI to use modern visual styling (double-line borders, Unicode icons, color-coded rarity) so it feels polished. | Low |

## ✅ Acceptance Criteria

### AC-01: Interactive TUI Launches

**Given** the user runs `sudoku-cli play`
**When** stdout is a TTY
**Then** an interactive TUI launches with:
- A 9x9 Sudoku grid with Unicode box-drawing separators
- A cursor at position (0, 0)
- Clue cells visually distinct from user-filled cells
- A stats line showing time, move count, and error count
- A keybinding footer

### AC-02: Keyboard Input

**Given** the TUI is active
**When** the user presses arrow keys
**Then** the cursor moves (clamped to board edges)

**When** the user presses 1-9 at an editable cell
**Then** the digit is placed

**When** the user presses 0, Backspace, or Delete at an editable cell
**Then** the cell is cleared

**When** the user presses `h` at an empty editable cell
**Then** the correct value (from `solution[r][c]`) is placed

**When** the user presses `u`
**Then** the most recent place/clear is undone (no-op if history is empty)

**When** the user presses `q` or Escape
**Then** the game exits cleanly with code 0

**When** the user presses Ctrl+C
**Then** the game exits with code 130

### AC-03: Win Detection

**Given** the user fills the last empty cell correctly
**When** `isSolved(current, solution)` returns true
**Then** the game transitions to `status: 'won'` and shows:
- A green win banner with time and move count
- An inline achievement summary (if any were unlocked)
- Options: `n` for new game, `a` for achievement details, `q` to quit

### AC-04: Save on Quit

**Given** the user quits mid-game (not won)
**When** `q`, Ctrl+C, or SIGTERM is received
**Then** a `saves/<uuid>.json` file is written atomically before cleanup, and a prompt shows the short ID and resume instructions.

### AC-05: Resume Game

**Given** a saved game exists
**When** the user runs `play --load <id>`
**Then** the game resumes with the same board, cursor, history, counters, and errors.

**When** the user runs `play --resume-last`
**Then** the most recent save is loaded (or exit 1 with "no saved games" if none exist).

### AC-06: Stats Tracking

**Given** the user plays and/or wins games
**When** stats are written to `~/.sudoku-cli/state.json`
**Then**:
- `totalPlays` increments by exactly 1 on each fresh game start (not on resume)
- `totalWins` increments by exactly 1 on each `isWon` transition (idempotent)
- `bestTimeMs` updates if the new win is faster
- `fewestMoves` updates if the new win uses fewer moves

### AC-07: Achievements

**Given** the user wins a game
**When** the game is evaluated against 11 achievement definitions
**Then** qualifying achievements are unlocked (idempotent — never re-unlocked)

### AC-08: One-Shot Commands

**When** the user runs `play --stats`
**Then** per-difficulty stats print to stdout (machine-parseable, exit 0)

**When** the user runs `play --achievements`
**Then** all 11 achievements print to stdout with unlock status (exit 0)

**When** the user runs `play --leaderboard`
**Then** best times and fewest moves per difficulty print as an ASCII table (exit 0)

### AC-09: Color and TTY

**Given** `NO_COLOR=1` is set
**When** the TUI renders
**Then** all ANSI color/background escapes are omitted

**Given** stdout is not a TTY (e.g., piped to `cat`)
**When** `play` is invoked
**Then** it exits with code 2 and a "requires an interactive terminal" error

**Given** `FORCE_COLOR=1` is set
**When** the TUI renders
**Then** colors are forced on (useful for CI snapshots)

### AC-10: Error Handling

**When** `play --difficulty insane` is invoked
**Then** exit code 2 is returned with a message listing valid difficulty levels.

**When** a save file is corrupt
**Then** `play --load <id>` exits with code 2 and a "save file is corrupt" message (not a crash).

**When** the state file is busy (concurrent writer holds the lock)
**Then** exit code 2 is returned with "state file is busy; please retry."

### AC-11: Concurrent Safety

**Given** two `play` processes run simultaneously
**When** both attempt to write `state.json`
**Then** the second blocks on a cross-process lock and proceeds only after the first releases. No data is lost or corrupted.

### AC-12: Security and Permissions

**When** `~/.sudoku-cli/` is first created
**Then** it has `0o700` permissions (only the user can access).

**When** save files and state files are written
**Then** they have `0o600` permissions.

**When** a save ID is provided via `play --load <id>`
**Then** it is validated against a UUID v4 regex (defense in depth against path traversal).

### AC-13: Bundle and Coverage

**When** `pnpm build` completes
**Then** `dist/cli.js` is a single self-contained file with a shebang, ≤ 75 kB.

**When** `pnpm test:coverage` runs
**Then** all non-excluded files have 100% line/statement/function coverage.

### AC-14: Programmatic API

**When** a consumer imports `@hackettyam/sudoku-cli`
**Then** the following are available: `playCommand`, `PlayOptions`, `PlayCommandResult`, `GameState`, `createGame`, `applyMove`, `isWon`, `parseKeypress`, `renderGame`, `shouldEnableColors`.

## 🚧 Scope

### In Scope (Tier 1)

- New `play` subcommand with interactive TUI
- 5 difficulty levels: novice, easy, normal, hard, expert
- Keyboard input: arrows, digits, h/u/q/a/n, Ctrl+C, Home/End
- Win detection using library's `isSolved`
- Save on quit / Ctrl+C / SIGTERM with atomic writes
- Resume via `--load <id>` and `--resume-last`
- Per-difficulty stats (totalPlays, totalWins, bestTimeMs, fewestMoves)
- 11 achievements (per-difficulty + cross-difficulty)
- One-shot commands: `play --stats`, `--achievements`, `--leaderboard`
- Color wrapper respecting `NO_COLOR` + TTY detection + `FORCE_COLOR`
- Cross-process file locking for `state.json` safety
- Modern UI: double-line borders, Unicode icons, color-coded rarity
- Inline + dismissable achievement view on win screen
- `~/.sudoku-cli/` persistence with `0o700` permissions

### Out of Scope (Tier 2/3)

- `--no-color` CLI flag (auto-detection only in Tier 1)
- `--seed` for deterministic puzzle generation (library lacks seed support)
- Reading the puzzle board from stdin
- `--json` output mode
- Multi-puzzle sessions or "next puzzle" prompt
- Mouse support
- Configuration file (`.sudoku-clirc`)
- Cross-platform Windows console polish
- Telemetry, analytics, or networking
- Save-file migration tooling
- Cloud sync, shared leaderboards

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| Test count | ~165 (from current 60) |
| Line/statement/function coverage | 100% (unchanged gate) |
| Bundle size (`dist/cli.js`) | ≤ 75 kB |
| Runtime dependencies added | 2 (`picocolors` + `proper-lockfile`) |
| Manual smoke test time | ≤ 12 min/PR |
| New pure modules | 14 (from current 6) |

## 🔗 References

- `design.md` — Architecture, interfaces, data flow, security model
- `tasks.md` — Wave-based implementation breakdown
- `AGENTS.md` (project) — Stack, commands, conventions
- `~/.config/opencode/AGENTS.md` — Global rules G-01..G-22, G-T01..G-T10, G-S01..G-S08
