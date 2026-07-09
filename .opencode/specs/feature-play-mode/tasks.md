---
id: feature-play-mode
title: Interactive Play Mode for Sudoku CLI
status: Implemented
template: cli-tool
scope: project
author: spec + hackettyam
default-wave: 1
max-parallel: 5
companion: requirements.md
tags: [tui, persistence, gamification, interactive]
---

# 📋 Tasks: Interactive Play Mode

31 atomic steps in 7 waves. Estimated effort: ~3-4 weeks / ~5-6 days sprint.

## 🌊 Wave 1: Infrastructure (no deps)

### T-001 — Add `picocolors` runtime dep
- **wave:** 1 · **dependencies:** [] · **files:** `package.json`, `pnpm-lock.yaml`
- Add `"picocolors": "^1.1.0"` to `dependencies`. Run `pnpm install`. First G-20 exception (decision 6).
- **acceptance:**
  - [x] `package.json` lists `picocolors` under `dependencies`
  - [x] `pnpm install` succeeds with no peer-dep warnings
  - [x] `node_modules/picocolors/picocolors.js` exists locally
  - [x] `package.json` is otherwise unchanged (no dev-dep churn)
  - [x] `pnpm audit --prod` reports 0 vulnerabilities
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `commit-generation` (draft Conventional Commit message), `sec-deps` (verify picocolors has 0 CVEs)
  - **Quality gates:** `pnpm install` exits 0; `pnpm audit --prod` 0 vulns; package.json otherwise unchanged

### T-002 — Add `proper-lockfile` runtime dep
- **wave:** 1 · **dependencies:** [] · **files:** `package.json`, `pnpm-lock.yaml`
- Add `"proper-lockfile": "^4.1.2"` to `dependencies`. Run `pnpm install`. Second G-20 exception (decision 18).
- **acceptance:**
  - [x] `package.json` lists `proper-lockfile` under `dependencies`
  - [x] `pnpm install` succeeds with no peer-dep warnings
  - [x] `node_modules/proper-lockfile/package.json` exists locally
  - [x] `package.json` is otherwise unchanged (no dev-dep churn)
  - [x] `pnpm audit --prod` reports 0 vulnerabilities
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `sec-deps` (verify proper-lockfile has 0 CVEs, MIT license), `commit-generation` (draft Conventional Commit message)
  - **Quality gates:** `pnpm install` exits 0; `pnpm audit --prod` 0 vulns; package.json otherwise unchanged; single-purpose commit

## 🌊 Wave 2: Colors + Lock

### T-003 — Add `src/format/colors.ts` + tests
- **wave:** 2 · **dependencies:** [T-001] · **files:** `src/format/colors.ts`, `src/__tests__/format/colors.test.ts`
- Pure color wrapper. Export `shouldEnableColors(env, isStdoutTty)` (5 paths). Export singleton `colors`. JSDoc on every export.
- **acceptance:**
  - [x] `shouldEnableColors` covers all 5 paths: FORCE_COLOR set→true, NO_COLOR set→false, NO_COLOR=""→false, no flags+TTY→true, no flags+non-TTY→false
  - [x] `colors.red('x')` → `'x'` when disabled (no `\x1b[` escapes)
  - [x] 100% line/statement/function coverage on `src/format/colors.ts`
  - [x] JSDoc on `shouldEnableColors` and `colors` (G-19)
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `code-validate` (runs all three in order)
  - **Optional specialists:** `analyzer` only if cyclomatic complexity on `shouldEnableColors` exceeds 4
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; `pnpm test src/__tests__/format/colors.test.ts` 0; `pnpm test:coverage` 100% on `src/format/colors.ts`; JSDoc (G-19)

### T-004 — Add `src/persistence/lock.ts` + tests
- **wave:** 2 · **dependencies:** [T-002] · **files:** `src/persistence/lock.ts`, `src/persistence/lock.test.ts`
- Pure lock factory wrapping `proper-lockfile`. Export `LockHandle`, `LockResult`, `LockFactory`, `createLock`, `nodeLockFactory`, `inMemoryLockFactory`. Never throws. 5x retries, 50ms backoff.
- **acceptance:**
  - [x] Happy path: acquire→{ok:true,handle}; release→resolves; held()→0
  - [x] Busy: second acquire→{ok:false,reason:'busy'}
  - [x] Timeout: createLock(path,{retries:0})→acquire→{ok:false,reason:'timeout'}
  - [x] Real proper-lockfile integration: .lock file created on acquire, removed on release
  - [x] release on stale handle is no-op
  - [x] inMemoryLockFactory().held() returns 0→1→0
  - [x] LockFactory type is structural
  - [x] 100% coverage on src/persistence/lock.ts (proper-lockfile excluded)
  - [x] JSDoc on every export (G-19)
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `sec-deps`, `sec-sast`, `test-generate`, `test-coverage`, `code-validate`
  - **Optional specialists:** `security` for proper-lockfile sanity check
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; `pnpm test src/persistence/lock.test.ts` 0 (6+ cases); `pnpm test:coverage` 100%; `pnpm audit --prod` 0 vulns; `sec-sast` 0 high-severity; JSDoc (G-19)

## 🌊 Wave 3: Persistence Layer

### T-005 — Add `src/persistence/state.ts` + tests
- **wave:** 3 · **dependencies:** [T-004] · **files:** `src/persistence/state.ts`, `src/persistence/state.test.ts`
- Pure state mgmt via injected FsAdapter + LockFactory. Export FsAdapter, nodeFsAdapter, memoryFsAdapter, defaultStatePath, defaultSavesDir, defaultStateLockPath, loadState, saveState, mergeStats, unlockAchievements, StateFile, PerDifficultyStats, typed errors. Atomic write, dir 0o700.
- **acceptance:**
  - [x] loadState missing→default; valid→parsed; corrupt→StateCorruptError; wrong-version→StateVersionError
  - [x] saveState writes tmp then renames; auto-creates dir with 0o700; writeFile throw leaves original untouched
  - [x] mergeStats start: totalPlays+1, lastPlayedAt set, totalWins unchanged
  - [x] mergeStats start called twice: no double-increment
  - [x] mergeStats win: totalWins+1, bestTimeMs updated if faster, fewestMoves updated if fewer, totalPlays unchanged
  - [x] unlockAchievements idempotent
  - [x] loadState/saveState acquire+release lock (mock counts); busy lock→StateLockBusyError
  - [x] 100% coverage on src/persistence/state.ts
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `sec-sast`, `sec-secrets`, `test-generate`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; `pnpm test` 0 (12+ cases); `pnpm test:coverage` 100%; sec-sast 0; sec-secrets 0; JSDoc (G-19); no any/! (G-02,G-03); mkdir 0o700 (G-S07)

### T-006 — Add `src/persistence/save.ts` + tests
- **wave:** 3 · **dependencies:** [T-005] · **files:** `src/persistence/save.ts`, `src/persistence/save.test.ts`
- Pure save/load. Export saveGame, loadGame, listSaves, latestSaveId, validateSaveId, SaveFile, SaveSummary, typed errors. UUID v4 regex validation.
- **acceptance:**
  - [x] saveGame round-trip; assigns UUID v4; writes to saves/<id>.json
  - [x] loadGame missing→SaveNotFoundError; corrupt→SaveCorruptError; version→SaveVersionError
  - [x] listSaves returns one summary per file; latestSaveId returns most recent or null
  - [x] validateSaveId rejects path traversal strings (returns false)
  - [x] 100% coverage on src/persistence/save.ts
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `sec-sast`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; `pnpm test` 0 (9+ cases); `pnpm test:coverage` 100%; sec-sast 0

### T-007 — Add `src/persistence/achievements.ts` + tests
- **wave:** 3 · **dependencies:** [T-005] · **files:** `src/persistence/achievements.ts`, `src/persistence/achievements.test.ts`
- Pure evaluator. Export AchievementId, ACHIEVEMENTS (frozen), evaluateAchievements, AchievementContext, AchievementDefinition. Table-driven tests.
- **acceptance:**
  - [x] ACHIEVEMENTS frozen, 11 entries
  - [x] Each achievement: unlocked + not unlocked test cases (boundary conditions)
  - [x] evaluateAchievements returns [] on trivial win; returns multiple on multi-qualifying win
  - [x] century: 100 unlocked, 99 not; completionist: 5 unlocked, 4 not
  - [x] 100% coverage on src/persistence/achievements.ts
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `analyze-complexity`, `test-generate`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; `pnpm test` 0 (22+ cases); `pnpm test:coverage` 100%; ACHIEVEMENTS frozen; no new dep (G-20)

### T-008 — Add concurrent-write test
- **wave:** 3 · **dependencies:** [T-005] · **files:** `src/persistence/__tests__/state-concurrent.test.ts`
- Multi-process via child_process.fork. Two loadState→mergeStats→saveState cycles. Assert consistent state. Retry 3x.
- **acceptance:**
  - [x] Two writers produce consistent state
  - [x] Flaky-safe (retries 3x)
- **Delegation:**
  - **Primary agent:** `test`
  - **Skills to load (in order):** `test-run`, `test-coverage`
  - **Quality gates:** test passes 3 consecutive runs

## 🌊 Wave 4: Domain Logic

### T-009 — Add `src/game/state.ts`
- **wave:** 4 · **dependencies:** [] · **files:** `src/game/state.ts`
- Pure state machine. Export CellPosition, Move (8 variants incl. toggle-achievements), GameStatus, WinView, GameState (full field docs), createGame, applyMove, isWon, undo, isReadOnly, getStats. <=60 LOC/function, max 3 params.
- **acceptance:**
  - [x] All 8 Move variants with JSDoc
  - [x] Counter rules per full table in design.md
  - [x] JSDoc on every export (G-19)
  - [x] All functions <=60 LOC, max 3 params (G-08, G-10)
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `analyze-complexity`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; no any/!/console.log (G-02,G-03,G-07); JSDoc (G-19); readonly everywhere (G-22)

### T-010 — Add `src/game/state.test.ts`
- **wave:** 4 · **dependencies:** [T-009] · **files:** `src/game/state.test.ts`
- Cover every function and Move variant. Deterministic fixture. One test per Move x 2+ states.
- **acceptance:**
  - [x] createGame returns correct initial shape
  - [x] place on readOnly=no-op; place on editable=updates; place last cell=won
  - [x] move-cursor clamps; undo empty=no-op; undo 2-step=reverts; quit=sets status
  - [x] hint places correct value, increments hintCount, adds synthetic place, moveCount unchanged
  - [x] isWon/isReadOnly correct
  - [x] 100% coverage on src/game/state.ts
- **Delegation:**
  - **Primary agent:** `test`
  - **Skills to load (in order):** `test-auto-generate`, `test-generate`, `test-run`, `test-coverage`
  - **Quality gates:** one test per Move x 2+ states; 100% coverage; deterministic (G-T04)

## 🌊 Wave 5: TUI Layer

### T-011 — Add `src/tui.ts` (keypress parser)
- **wave:** 5 · **dependencies:** [T-009] · **files:** `src/tui.ts`
- Pure parser. Export ParsedKey (discriminated union), parseKeypress(buf). ANSI CSI. Unknown→[]. <=80 LOC.
- **acceptance:**
  - [x] All sequences handled per ANSI spec
  - [x] Unknown→[]
  - [x] JSDoc (G-19)
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0 (<=80 LOC); JSDoc (G-19)

### T-012 — Add `src/tui.ts` (renderer) + snapshot tests
- **wave:** 5 · **dependencies:** [T-011] · **files:** `src/tui.ts`, `src/tui.test.ts`
- Add formatTime, renderGame. Cell coloring via colorForCell. 3 snapshots: initial, mid-game, win.
- **acceptance:**
  - [x] formatTime boundaries: 0→"00:00", 154000→"02:34", 3723000→"1:02:03"
  - [x] 3 snapshots: initial, mid-game (cursor+highlights+errors), win
  - [x] Snapshots contain box-drawing chars, footer, difficulty name
  - [x] Colors disabled→0 escape sequences
  - [x] 100% coverage on src/tui.ts
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `analyze-complexity`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; 3 snapshots match; 100% coverage; no literal escapes outside helpers (G-07, decision 9)

### T-013 — Add `applyKey` + finish tests
- **wave:** 5 · **dependencies:** [T-012] · **files:** `src/tui.ts`, `src/tui.test.ts`
- Add KEYBINDINGS (frozen), applyKey(state, key). Maps ParsedKey→Move→applyMove.
- **acceptance:**
  - [x] Per ParsedKey variant: expected state
  - [x] Ctrl+C→quit; edge clamped; unknown→unchanged
  - [x] KEYBINDINGS frozen
  - [x] 100% coverage
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; all variants covered; 100% coverage; JSDoc (G-19)

### T-014 — Add `renderWinBanner`, `renderSavePrompt`, `renderAchievementInline` + tests
- **wave:** 5 · **dependencies:** [T-013, T-007] · **files:** `src/tui.ts`, `src/tui.test.ts`
- Add renderWinBanner, renderSavePrompt, formatShortId, ACHIEVEMENT_GLYPHS (frozen, 11 keys), renderAchievementInline.
- **acceptance:**
  - [x] 2 win snapshots (0 and 3 achievements)
  - [x] 1 save prompt snapshot
  - [x] 3 inline snapshots (0, 1, 3 achievements)
  - [x] Inline returns '' when colors disabled + non-TTY; uncolored text when TTY
  - [x] formatShortId returns first 8 chars; non-UUID returns first 8 defensively
  - [x] ACHIEVEMENT_GLYPHS frozen, 11 keys
  - [x] 100% coverage
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `analyze-complexity`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; all snapshots match; 100% coverage; JSDoc on 5 new exports (G-19); no new dep (G-20)

### T-015 — Add `renderAchievementDetail`, dismissable view + tests
- **wave:** 5 · **dependencies:** [T-014] · **files:** `src/tui.ts`, `src/tui.test.ts`
- Add Rarity, ACHIEVEMENT_RARITY (frozen), renderAchievementDetail, renderTrophyArt, screenWidth. Double-line box, trophy, rarity, progress. ASCII fallback.
- **acceptance:**
  - [x] 1 dismissable snapshot (TTY, 3 unlocked)
  - [x] 1 non-TTY snapshot (no colors, ASCII icons)
  - [x] renderTrophyArt non-empty, 3-4 lines; non-TTY version has no Unicode block
  - [x] ACHIEVEMENT_RARITY frozen, 11 keys, valid rarity values
  - [x] screenWidth: explicit→returns it; default→80
  - [x] 100% coverage
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `analyze-complexity`, `test-generate`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; snapshots stable; 100% coverage; JSDoc (G-19); no new dep (G-20)

## 🌊 Wave 6: I/O Shell + Commands

### T-016 — Extend `src/output.ts` with `runTuiSession` + tests
- **wave:** 6 · **dependencies:** [T-013] · **files:** `src/output.ts`, `src/__tests__/output.tui.test.ts`
- Add KeySink, TuiSessionOptions, TuiRunner, runTuiSession. Raw mode, alt screen, signal cleanup. 6 tests.
- **acceptance:**
  - [x] Test 1: first draw writes init escape + setRawMode(true)
  - [x] Test 2: data event routes to onKey
  - [x] Test 3: 'q' data routes to onKey
  - [x] Test 4: cleanup writes leave sequence, setRawMode(false), idempotent
  - [x] Test 5: SIGINT triggers cleanup, resolves 130
  - [x] Test 6: render throw resolves reason:'error'
  - [x] 100% coverage on src/output.ts
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `sec-sast`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0 (<=60 LOC); 6 tests pass; 100% coverage; sec-sast 0; no any (G-02)

### T-017 — Add `src/commands/play.ts` + tests
- **wave:** 6 · **dependencies:** [T-009, T-013, T-015, T-016] · **files:** `src/commands/play.ts`, `src/__tests__/commands/play.test.ts`
- TUI orchestrator. Export PlayOptions, PlayExitReason, PlayCommandResult, PlayIO, playCommand. 8 tests.
- **acceptance:**
  - [x] Test 1: invalid difficulty→play_exit error
  - [x] Test 2: happy path (arrow, digit, q)→3+ draws, status quit, moveCount 1
  - [x] Test 3: win path→reason won
  - [x] Test 4: hint path→cell filled
  - [x] Test 5: undo path→moveCount 1
  - [x] Test 6: Ctrl+C→reason quit, cleanup called
  - [x] Test 7: win→a→view achievements; other key→view menu
  - [x] Test 8: win→a→Esc→view menu (not quit)
  - [x] 100% coverage on src/commands/play.ts
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `analyze-complexity`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; 8 tests pass; 100% coverage; JSDoc (G-19); pure function (G-22)

### T-018 — Wire persistence into `playCommand` + tests
- **wave:** 6 · **dependencies:** [T-005, T-006, T-007, T-008, T-017] · **files:** `src/commands/play.ts`, `src/commands/play.test.ts`
- Fresh→mergeStats('start'). Win→achievements+mergeStats('win')+save. Quit→saveGame+lastSaveId. Error mapping. Lock-busy handling.
- **acceptance:**
  - [x] Win→achievement in state.json, totalWins+1, totalPlays+1
  - [x] Win 0 achievements→unlockedAchievements [], state written
  - [x] Quit mid-game→save exists, lastSaveId set, totalPlays+1, totalWins unchanged
  - [x] Fresh→fresh→totalPlays 2 (decision 17)
  - [x] Fresh→resume-last→solve→totalPlays 1, totalWins 1
  - [x] Resume-last→quit→totalPlays unchanged
  - [x] loadId restores state; resumeLast loads right id; resumeLast no save→error
  - [x] Save failure→play_exit error, cleanup still called
  - [x] Lock-busy→play_exit error "state file is busy", exit 2
  - [x] 100% coverage on src/commands/play.ts
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `analyze-complexity`, `sec-sast`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; 14 tests pass; 100% coverage; sec-sast 0; JSDoc (G-19); pure function; counter semantics cite decision 17

### T-019 — Add `src/format/table.ts` + tests
- **wave:** 6 · **dependencies:** [] · **files:** `src/format/table.ts`, `src/format/table.test.ts`
- Pure ASCII table. Export Column, Row, formatTable, displayWidth. CJK/emoji width.
- **acceptance:**
  - [x] 3 snapshots (mixed align, empty rows, explicit width)
  - [x] displayWidth: ASCII 5, CJK 6, emoji 2
  - [x] No leading/trailing newline
  - [x] 100% coverage
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; 8+ tests; 100% coverage; JSDoc (G-19); no new dep (G-20)

### T-020 — Add `src/commands/play-stats.ts` + tests
- **wave:** 6 · **dependencies:** [T-005] · **files:** `src/commands/play-stats.ts`, test file
- playStatsCommand(deps?) returns per-difficulty stats + totals. Machine-parseable.
- **acceptance:**
  - [x] Correct shape with fixture state
  - [x] Missing→zeros
  - [x] 5 lines in stable order
  - [x] 100% coverage
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; 3+ tests; 100% coverage; stable order (G-07)

### T-021 — Add `src/commands/play-achievements.ts` + tests
- **wave:** 6 · **dependencies:** [T-007] · **files:** `src/commands/play-achievements.ts`, test file
- playAchievementsCommand(deps?) returns unlocked (desc) + locked (asc) + definitions.
- **acceptance:**
  - [x] All 11 achievements returned
  - [x] Unlocked have unlockedAt
  - [x] Sorted correctly
  - [x] 100% coverage
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; 4+ tests; 100% coverage

### T-022 — Add `src/commands/play-leaderboard.ts` + tests
- **wave:** 6 · **dependencies:** [T-005, T-019, T-020] · **files:** `src/commands/play-leaderboard.ts`, test file
- playLeaderboardCommand(deps?, opts?). Sorted by best time asc, nulls last. Default top 5.
- **acceptance:**
  - [x] At most top rows
  - [x] Sorted correctly; nulls last
  - [x] Missing→empty entries
  - [x] Uses formatTable
  - [x] 100% coverage
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; 5+ tests; 100% coverage

### T-023 — Extend `src/args.ts` for `play`
- **wave:** 6 · **dependencies:** [T-009] · **files:** `src/args.ts`, `src/__tests__/args.test.ts`
- Add 'play' to Subcommand. parsePlayArgs: --difficulty, --load, --resume-last, --stats, --achievements, --leaderboard, --help. Reject conflicts.
- **acceptance:**
  - [x] Default→play_tui
  - [x] --difficulty hard→passes through
  - [x] -h/--help→help
  - [x] --stats, --achievements, --leaderboard→correct variants
  - [x] Conflict→error
  - [x] 100% coverage
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; 10+ tests; JSDoc (G-19); HELP_TEXT extended

### T-024 — Extend `src/commands/result.ts`
- **wave:** 6 · **dependencies:** [T-023] · **files:** `src/commands/result.ts`, test file
- Add play_exit, play_stats, play_achievements, play_leaderboard. assertNever exhaustiveness.
- **acceptance:**
  - [x] All variants compile
  - [x] Exhaustiveness check
  - [x] 100% coverage
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; tests pass; JSDoc (G-19)

### T-025 — Wire `play` into `src/cli.ts` dispatcher
- **wave:** 6 · **dependencies:** [T-017, T-018, T-021, T-022, T-023, T-024] · **files:** `src/cli.ts`
- case play_tui→playCommand; case play_stats→playStatsCommand; achievements/leaderboard same. Exit codes. assertNever.
- **acceptance:**
  - [x] All 4 routed
  - [x] Exit codes: quit 0, won 0, error 2
  - [x] assertNever exhaustiveness
  - [x] Existing tests pass
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`, `code-validate`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; tests pass; JSDoc (G-19)

## 🌊 Wave 7: API, Docs, QA

### T-026 — Re-export from `src/index.ts`
- **wave:** 7 · **dependencies:** [T-017, T-025] · **files:** `src/index.ts`
- Re-export play types. Not picocolors or library symbols.
- **acceptance:**
  - [x] build:types valid
  - [x] playCommand is function
  - [x] No lib re-exports
  - [x] docs-jsdoc 0 missing (G-19)
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `docs-api`, `docs-jsdoc`, `code-typecheck`, `code-lint`
  - **Quality gates:** `pnpm typecheck` 0; `pnpm lint` 0; build:types valid; no picocolors/lib re-exports

### T-027 — Update README.md
- **wave:** 7 · **dependencies:** [T-025] · **files:** `README.md`
- Add 6 sections: play, persistence, save/resume, stats, achievements (11-row table), leaderboard. Update "Zero deps". TTY note.
- **acceptance:**
  - [x] 6 sections
  - [x] Keybinding table
  - [x] docs-drift 0
  - [x] Privacy note
- **Delegation:**
  - **Primary agent:** `docs`
  - **Skills to load (in order):** `docs-api`, `docs-drift`, `docs-jsdoc`
  - **Quality gates:** docs-drift 0; each section has code example; 0o700 perms documented (G-S07); Privacy note

### T-028 — Full CI gate
- **wave:** 7 · **dependencies:** [T-026, T-027] · **files:** none
- Full gate suite: install, typecheck, lint, test:coverage, build. Verify dist/cli.js <=75 kB. Audit 0.
- **acceptance:**
  - [x] 5 commands exit 0
  - [x] 100% coverage
  - [x] dist/cli.js <=75 kB
  - [x] 0 vulnerabilities
  - [x] playCommand importable
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-validate`, `perf-bundle`, `sec-deps`, `commit-generation`
  - **Optional specialists:** `performance` if bundle exceeds 75 kB
  - **Quality gates:** all 5 commands 0; 100% coverage; <=75 kB; 0 vulns

### T-029 — Security post-check on persistence
- **wave:** 7 · **dependencies:** [T-005, T-006, T-007, T-018, T-019, T-020, T-021, T-027] · **files:** none
- sec-scan, sec-secrets, sec-sast on src/persistence/*.ts. Manual: perms, atomic, path traversal, size cap.
- **acceptance:**
  - [x] sec-scan 0
  - [x] sec-secrets 0 hits
  - [x] sec-sast 0 high-severity
  - [x] pnpm audit 0
  - [x] All G-S01..G-S08 ticked
- **Delegation:**
  - **Primary agent:** `security`
  - **Skills to load (in order):** `security-enforce`, `sec-scan`, `sec-secrets`, `sec-sast`, `sec-deps`, `sec-audit`
  - **Quality gates:** sec-scan 0; sec-secrets 0; sec-sast 0; pnpm audit 0; audit log recorded; security sign-off

### T-030 — Manual smoke test
- **wave:** 7 · **dependencies:** [T-028] · **files:** none
- node dist/cli.js play --difficulty easy. Walk all 18 items.
- **acceptance:**
  - [x] Alt screen engages; cursor hides; previous output preserved
  - [x] 9x9 grid with box separators; clues bold; empty dim .
  - [x] Arrow keys move cursor; clamped
  - [x] Digit places; 0 clears; clue cell no-op
  - [x] h hints; u undoes
  - [x] q restores terminal, exits 0
  - [x] Ctrl+C restores, exits 130
  - [x] NO_COLOR=1 no color escapes
  - [x] --difficulty insane exits 2
  - [x] --help prints help
  - [x] non-TTY exits 2
  - [x] Save/resume works
  - [x] --stats prints stats
  - [x] --achievements prints achievements
  - [x] --leaderboard prints table
  - [x] Dismissable view: win→a→trophy→any key→menu
  - [x] Terminal restored after each exit
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-validate`, `analyze-tech-debt`
  - **Quality gates:** all 18 items pass; terminal restored; exit codes correct

### T-031 — Memory recording
- **wave:** 7 · **dependencies:** [T-029, T-030] · **files:** memory files
- ADR: "Why ~/.sudoku-cli/". Patterns: FsAdapter injection, atomic write, pure evaluator, lock factory. Update context.json.
- **acceptance:**
  - [x] ADR with context, alternatives, consequences
  - [x] 4 patterns recorded
  - [x] context.json updated
- **Delegation:**
  - **Primary agent:** `memory`
  - **Skills to load (in order):** `memory-adr`, `memory-record`, `memory-pattern`
  - **Quality gates:** ADR present; 4 pattern files; context.json updated

## 📊 Final Result

| Metric | Value |
|--------|-------|
| Total tasks | 31 |
| Tasks completed | 31/31 |
| Waves | 7 |
| Estimated effort (comfortable) | ~3-4 weeks |
| Estimated effort (sprint) | ~5-6 days |
| Actual effort | ~1 session |
| New files | 12 source + 14 test |
| Modified files | 7 |
| Runtime deps added | 2 (`picocolors`, `proper-lockfile`) |
| Tests | 431 passing (24 files) |
| Coverage | 100% line/statement/function |
| Bundle size | 72 kB (≤75 kB budget) |
| Security audit | 0 CVEs |
| Status | Implemented |

<!-- MARKER: final_result -->
