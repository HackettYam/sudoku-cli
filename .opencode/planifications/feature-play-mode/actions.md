---
Plan Reference: .opencode/planifications/feature-play-mode/plan.md
Plan Version: 1.2.0
Status: ⏳ Pending
Started: 2026-06-19
Completed:
---

# 📋 Actions: Add Interactive Play Mode

> **Template Version:** 1.2.0 | **Status:** Draft
> **Location:** `.opencode/planifications/feature-play-mode/actions.md`
> **Plan:** [`plan.md`](./plan.md) (v1.2.0)
> **Template:** `cli-tool`
> **Changelog:**
> - v1.2.0 — Added new Step 1.5.4 (`src/persistence/lock.ts` + tests
>   with `proper-lockfile@^4.1.2` as the second G-20 exception,
>   decision 18) and a new multi-process concurrent-write test
>   (`src/persistence/__tests__/state-concurrent.test.ts`). Added
>   new Step 3.5.2 (TUI pure functions for achievement views —
>   `renderAchievementInline` + `renderAchievementDetail` +
>   `renderTrophyArt`, decision 19). Updated Step 1.5.1 to use
>   `LockFactory` via dependency injection. Updated Step 3.5.1 to
>   include the new views + a snapshot test for the dismissable
>   view. Updated Step 9 (`commands/play.ts`) to handle the new
>   `a` keypress in the `Won` state. Updated stats semantics
>   (decision 17: `totalPlays` for fresh games only, `totalWins`
>   on `isWon` transition only). Resolved open questions Q-NEW-1,
>   Q-NEW-2, Q-NEW-3. Renumbered the v1.1.0 open questions.
> - v1.1.0 — Added Phase 1.5 (persistence primitives), 2.5 (state
>   counters), 3.5 (win banner + save prompt), 5.5 (wire persistence
>   into play command), 5.6 (one-shot commands + dispatcher), 8.5
>   (docs), 9.5 (security post-check on persistence), 10.5 (memory
>   recording). Added Delegation subsection to every step. Resolved
>   open questions Q-1, Q-2, Q-3, Q-5. Added new open questions
>   Q-NEW-1, Q-NEW-2, Q-NEW-3.
> - v1.0.0 — Initial 16-step Tier 1 plan.

---

## 🎯 Objective Summary

Add a new `play` subcommand to `@hackettyam/sudoku-cli` that lets a user
play a full Sudoku interactively in the terminal. Implementation is split
into pure modules (`game/state.ts`, `tui.ts`, `format/colors.ts`,
`persistence/*`) and a thin I/O shell (`output.runTuiSession` +
`commands/play.ts`). All new code is unit-tested; existing coverage
thresholds (100% lines / statements / functions, excluding `src/cli.ts`
and `src/index.ts`) are preserved. The new runtime deps are
`picocolors` (~6 kB, ISC, decision 6) and `proper-lockfile` (~30 kB,
MIT, decision 18) — both explicit, user-approved exceptions to G-20.
`proper-lockfile` is wrapped in a `LockFactory` interface
(`src/persistence/lock.ts`) so the rest of the persistence layer stays
pure. The win screen shows an inline achievement summary and a
dismissable full-screen view (decision 19) using only built-in ANSI +
`picocolors` — no new UI deps.

**Template:** `cli-tool`

---

## 📊 Tracking

| Phase | Status | Progress |
|-------|:------:|:--------:|
| Phase 1: Setup & infra (deps + colors) | ⏳ | 0/2 steps |
| Phase 1.5: Persistence primitives (pure) | ⏳ | 0/4 steps (+1.5.4 lock + 1.5.4a dep) |
| Phase 2: Game state model (pure) | ⏳ | 0/2 steps |
| Phase 2.5: Extend `GameState` with counters | ⏳ | 0/1 step |
| Phase 3: TUI pure functions | ⏳ | 0/3 steps |
| Phase 3.5: TUI additions (win banner + save prompt + dismissable view) | ⏳ | 0/2 steps (+3.5.2 dismissable) |
| Phase 4: Output helper (`runTuiSession`) | ⏳ | 0/1 step |
| Phase 5: Command implementation (TUI orchestrator) | ⏳ | 0/1 step |
| Phase 5.5: Wire persistence + lock into play command | ⏳ | 0/1 step (counter semantics + lock-busy case) |
| Phase 5.6: One-shot commands + dispatcher wiring | ⏳ | 0/3 steps |
| Phase 6: Args + dispatcher | ⏳ | 0/3 steps |
| Phase 7: Programmatic API | ⏳ | 0/1 step |
| Phase 8: Docs (Tier 1) | ⏳ | 0/1 step |
| Phase 8.5: Docs additions (persistence + gamification + dismissable view) | ⏳ | 0/1 step |
| Phase 9: Build verification | ⏳ | 0/1 step (bundle budget 75 kB) |
| Phase 9.5: Security post-check on persistence | ⏳ | 0/1 step |
| Phase 10: Manual smoke test | ⏳ | 0/1 step (+dismissable view walkthrough) |
| Phase 10.5: Memory recording | ⏳ | 0/1 step |

**Total: 31 atomic steps, 10 phases of design + 6 phases of integration + 2 phases of QA.**
Renumbered from v1.0.0's 16 steps → v1.1.0's 28 steps → v1.2.0's 31
steps. The v1.2.0 increment of +3 covers:
- **Step 1.5.4** — `src/persistence/lock.ts` + tests (decision 18,
  +1 step).
- **Step 1.5.4a** — `proper-lockfile` runtime dep (decision 18,
  +1 step).
- **Step 3.5.2** — `renderAchievementDetail` + `renderTrophyArt` +
  dismissable view snapshot (decision 19, +1 step).

The concurrent-write test (`src/persistence/__tests__/state-concurrent.test.ts`)
is a **sub-deliverable** of Step 1.5.4, not a separate step.

---

## 🤝 Delegation Conventions

Every step below carries a **Delegation** subsection with:

| Field | Meaning |
|-------|---------|
| **Primary agent** | The agent that does the work (`code`, `test`, `security`, `docs`, `memory`). |
| **Skills to load (in order)** | Skills the agent loads in sequence. Loaded from `~/.config/opencode/skills/`. |
| **Optional specialists** | Subagents invoked only if needed (e.g., `analyzer` for complexity, `performance` for benchmarks). |
| **Quality gates for this step** | Checks that MUST pass before marking the step complete. |

The "Skills" field uses the names from the OpenCode skill catalog
shown in the agent's system prompt. When a skill is not strictly
required (e.g., `code-lint` for a test-only step), it is omitted.
The order in the list reflects the recommended execution order:
typically "plan → implement → test → review → record".

---

## 🔨 Detailed Implementation Steps

> **Conventions used below**
> - **Files touched** lists each file the step creates or modifies.
> - **Acceptance criteria** are testable, atomic conditions. A step is
>   complete only when all of its criteria pass.
> - **Depends on** lists step IDs whose work must be merged first.
> - **Agent owner** is `code` for implementation, `test` for
>   test-only work, `docs` for documentation, `security` for review
>   gate, `memory` for ADR + memory write.
> - Each step is sized to ≤ 1 PR and ≤ 1 day of focused work.

### Phase 1: Setup & infra

#### Step 1 — Add `picocolors` runtime dep

- **Files touched:** `package.json`, `pnpm-lock.yaml` (regenerated)
- **Action:** Modify (add dep)
- **Description:** Add `"picocolors": "^1.1.0"` to the `dependencies`
  block of `package.json`. Run `pnpm install` to regenerate the lock
  file. Do **not** add any other runtime dep.
- **Acceptance criteria:**
  - [ ] `package.json` lists `picocolors` under `dependencies`.
  - [ ] `pnpm install` succeeds with no peer-dep warnings.
  - [ ] `node_modules/picocolors/picocolors.js` exists locally.
  - [ ] `package.json` is otherwise unchanged (no dev-dep churn).
- **Depends on:** —
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `commit-generation` (to draft the
    Conventional Commit message for the dep add), `sec-deps` (verify
    `picocolors@^1.1.0` has 0 CVEs).
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm install` exits `0`.
    - `pnpm audit --prod` reports 0 vulnerabilities.
    - `package.json` is otherwise unchanged (no dev-dep churn).

#### Step 2 — Add `src/format/colors.ts` + tests

- **Files touched:**
  - `src/format/colors.ts` (add)
  - `src/__tests__/format/colors.test.ts` (add)
- **Action:** Add
- **Description:** Create the color wrapper.
  - Export `shouldEnableColors(env: NodeJS.ProcessEnv, isStdoutTty:
    boolean): boolean` — pure factory. Returns:
    - `true` if `env.FORCE_COLOR` is defined and non-empty.
    - `false` if `env.NO_COLOR` is defined (any value, including empty).
    - Otherwise `isStdoutTty`.
  - Export a `colors` constant built as
    `pc.createColors(shouldEnableColors(process.env, isatty(1)))`.
  - JSDoc on every export (G-19). Module-level comment block stating
    why this exists (NO_COLOR/TTY gating on top of `picocolors`).
  - **Tests** in `colors.test.ts` cover all 4 paths of
    `shouldEnableColors`:
    1. `FORCE_COLOR=1`, TTY=false → `true`.
    2. `NO_COLOR=1`, TTY=true → `false`.
    3. `NO_COLOR=""` (empty) → `false` (per no-color.org spec).
    4. No flags, TTY=true → `true`.
    5. No flags, TTY=false → `false`.
  - Plus an integration test: with `shouldEnableColors()` returning
    `false`, `colors.red('x')` returns `'x'` (no escapes).
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/__tests__/format/colors.test.ts && pnpm test:coverage`
  (coverage of the new file must be 100%).
- **Depends on:** Step 1
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `code-validate` (runs all three in order).
  - **Optional specialists:** `analyzer` only if cyclomatic complexity
    on `shouldEnableColors` exceeds 4 (it should not — the function is
    a 4-arm if/else).
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (no warnings).
    - `pnpm test src/__tests__/format/colors.test.ts` exits `0` (all
      5 paths pass).
    - `pnpm test:coverage` shows 100% on `src/format/colors.ts`.
    - JSDoc on `shouldEnableColors` and `colors` (G-19).

---

### Phase 1.5: Persistence primitives (pure)

> Landed **after** colors but **before** the state-machine changes so
> that the persistence layer has a stable, testable surface to depend
> on. Mirrors the project's "pure modules" rule (Decision #3).

#### Step 1.5.1 — `src/persistence/state.ts` + tests (v1.2.0: lock factory via DI)

- **Files touched:**
  - `src/persistence/state.ts` (add).
  - `src/persistence/state.test.ts` (add).
- **Action:** Add
- **Description:** Pure module — no `process.*` calls. All I/O goes
  through the injected `FsAdapter` and all cross-process
  synchronization goes through the injected `LockFactory` (decision 18,
  added in Step 1.5.4). Exports:
  - `FsAdapter` interface (`readFile`, `writeFile`, `mkdir`,
    `rename`, `exists`, `homedir`, `stat`).
  - `nodeFsAdapter: FsAdapter` — production implementation wrapping
    `node:fs/promises`, `node:os`, `node:path`.
  - `memoryFsAdapter(): FsAdapter` — in-memory `Map`-backed test
    double.
  - `defaultStatePath(): string` — `~/.sudoku-cli/state.json`
    (or `$XDG_STATE_HOME/sudoku-cli/state.json` if set).
  - `defaultSavesDir(): string` — sibling `saves/` dir.
  - `defaultStateLockPath(statePath): string` — sibling
    `<statePath>.lock` (so the lock travels with the state file).
  - `loadState(fs, path, lock: LockFactory): Promise<Result<StateFile, StateError>>` —
    returns the schema-versioned `StateFile`. On `ENOENT`, returns
    a fresh default. On any other error, returns a typed
    `StateCorruptError` / `StateVersionError` via the `Result`
    discriminated union (so callers can map cleanly to exit codes).
    The lock is acquired at the start of the call and released at
    the end (or on error).
  - `saveState(fs, path, state, lock: LockFactory): Promise<Result<void, StateError>>` —
    atomic write via `writeFile(<path>.tmp-<random>)` →
    `rename(<path>.tmp-<random>, <path>)`. Auto-creates the parent
    dir with mode `0o700` on first write (G-S07). Wrapped in the
    same lock as `loadState`.
  - `mergeStats(prev, newResult, mode: 'win' | 'start'): PerDifficultyStats` —
    pure. **`mode: 'start'`** increments `totalPlays` by 1 (and
    sets `lastPlayedAt = Date.now()`); **`mode: 'win'`** increments
    `totalWins` by 1 and updates `bestTimeMs` / `fewestMoves` if
    better. Idempotency note: `mode: 'win'` is only called on the
    `isWon` transition, so it cannot fire twice for the same play.
  - `unlockAchievements(state, ids): StateFile` — pure; idempotent.
  - `StateFile`, `PerDifficultyStats` types (see `plan.md`
    §"State Schema"). `PerDifficultyStats` has `totalPlays`,
    `totalWins`, `bestTimeMs`, `fewestMoves`, `lastPlayedAt` (no
    more `winsAtBestTime` / `winsAtFewestMoves` — those are
    derived from the `play --leaderboard` output).
  - Typed errors: `StateCorruptError`, `StateVersionError`,
    `StateLockBusyError` (returned when the lock cannot be
    acquired after 5 retries).
  - JSDoc on every export (G-19). Module-level comment referencing
    G-S01, G-S07, G-13, decision 18.
- **Tests** (`state.test.ts`, using `memoryFsAdapter` + a mock
  `LockFactory`):
  - `loadState` on missing file returns the default state.
  - `loadState` on a valid file returns the parsed `StateFile`.
  - `loadState` on a corrupt file returns `Result.err(StateCorruptError)`.
  - `loadState` on a wrong-version file returns `Result.err(StateVersionError)`.
  - `saveState` writes to `tmp-<random>` then renames (verify both
    calls happened and the tmp is gone after).
  - `saveState` auto-creates the parent dir on first write with
    `0o700` (mock `mkdir` and assert the mode arg).
  - `saveState` simulating a `writeFile` throw leaves the original
    file untouched (atomic-write correctness).
  - `mergeStats(prev, { mode: 'start' })` increments `totalPlays` by
    exactly 1, sets `lastPlayedAt`, leaves `totalWins` unchanged.
  - `mergeStats(prev, { mode: 'start' })` called twice **does not**
    double-increment (caller-side idempotency: only the orchestrator
    decides when to call this, and it calls it exactly once per
    fresh-game invocation).
  - `mergeStats(prev, { mode: 'win' })` increments `totalWins` by
    exactly 1, updates `bestTimeMs` if faster, updates `fewestMoves`
    if fewer, leaves `totalPlays` unchanged.
  - `unlockAchievements` is idempotent: calling it twice with the
    same id does not change `unlockedAt`.
  - `loadState` / `saveState` acquire and release the lock (mock
    `LockFactory` counts calls; assert exactly 1 acquire + 1 release
    per call).
  - `loadState` / `saveState` on a busy lock returns
    `Result.err(StateLockBusyError)` — never throws.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/persistence/state.test.ts && pnpm test:coverage` (100% on
  `src/persistence/state.ts`).
- **Depends on:** Step 1 (no runtime dep needed; `picocolors` not
  used here) and Step 1.5.4 (the `LockFactory` type is imported from
  `./lock.js`).
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `sec-sast` (catches path-traversal and unsafe mode-setting
    patterns), `sec-secrets` (asserts no secret literals),
    `test-generate` (table-driven cases for `mergeStats` × the two
    modes), `code-validate`.
  - **Optional specialists:** `analyzer` only if complexity on
    `mergeStats` exceeds 8.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-04 explicit return types,
      G-08 ≤ 180 LOC/function).
    - `pnpm test src/persistence/state.test.ts` exits `0` (12+
      cases including the 2 new lock-mock cases).
    - `pnpm test:coverage` shows 100% on
      `src/persistence/state.ts`.
    - `sec-sast` reports 0 high-severity findings on the new file.
    - `sec-secrets` reports 0 hits.
    - JSDoc on every export (G-19).
    - No `any`, no `!` non-null assertion (G-02, G-03).
    - `mkdir` call uses mode `0o700`; the test asserts this
      (G-S07).
    - The function signatures are pure: no `process.*` calls; all
      I/O is injected via `fs` + `lock`; the function never throws
      — all errors are returned as `Result.err(...)`.

#### Step 1.5.2 — `src/persistence/save.ts` + tests

- **Files touched:**
  - `src/persistence/save.ts` (add).
  - `src/persistence/save.test.ts` (add).
- **Action:** Add
- **Description:** Pure module. Imports types from
  `persistence/state` and `game/state`. Exports:
  - `saveGame(fs, state, dir): Promise<string>` — assigns
    `state.id = crypto.randomUUID()`, writes `saves/<id>.json`
    atomically (uses `saveState`'s atomic-write pattern), returns
    the id.
  - `loadGame(fs, id, dir): GameState` — reads `saves/<id>.json`,
    deserializes, returns a `GameState` with `id` set. Throws
    `SaveNotFoundError` or `SaveCorruptError` on failure.
  - `listSaves(fs, dir): readonly SaveSummary[]` — returns
    `[{ id, createdAt, updatedAt, difficulty, moveCount, isWon }]`
    for each save file. Used by future `play --saves`.
  - `latestSaveId(fs, state, dir): string | null` — reads the
    saves index from `state.json` (`lastSaveId` field) and returns
    the id (or `null`).
  - `SaveFile`, `SaveSummary` types (see `plan.md` §"Save File
    Format").
  - Typed errors: `SaveNotFoundError`, `SaveCorruptError`,
    `SaveVersionError`.
  - `validateSaveId(id: string): boolean` — rejects anything that
    doesn't match the UUID v4 regex (defense in depth: even though
    we generate ids via `crypto.randomUUID()`, this guards against
    user-supplied ids from `play --load <id>`).
  - JSDoc on every export (G-19).
- **Tests** (`save.test.ts`):
  - `saveGame` round-trip: save a state, read it back, assert
    equality of every field.
  - `saveGame` assigns a UUID v4 to `state.id`.
  - `saveGame` writes to `saves/<id>.json` (not `state.json`).
  - `loadGame` on a missing id throws `SaveNotFoundError`.
  - `loadGame` on a corrupt JSON throws `SaveCorruptError`.
  - `loadGame` on a version-mismatched file throws
    `SaveVersionError`.
  - `listSaves` returns one summary per save file.
  - `latestSaveId` returns the most recent id (or `null`).
  - `validateSaveId` accepts UUIDs, rejects `../../../etc/passwd`.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/persistence/save.test.ts && pnpm test:coverage` (100% on
  `src/persistence/save.ts`).
- **Depends on:** Step 1.5.1
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `sec-sast` (catches path-traversal in `id`-based filenames),
    `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-02, G-03, G-04).
    - `pnpm test src/persistence/save.test.ts` exits `0` (9+
      cases).
    - `pnpm test:coverage` shows 100% on
      `src/persistence/save.ts`.
    - `sec-sast` reports 0 findings.
    - The test for `validateSaveId('../../../etc/passwd')` asserts
      it returns `false` (G-S02 input validation).

#### Step 1.5.3 — `src/persistence/achievements.ts` + tests

- **Files touched:**
  - `src/persistence/achievements.ts` (add).
  - `src/persistence/achievements.test.ts` (add).
- **Action:** Add
- **Description:** Pure module. Imports types from
  `persistence/state`. Exports:
  - `AchievementId` string-literal union of the 11 ids.
  - `AchievementDefinition` interface:
    `{ readonly id: AchievementId; readonly title: string; readonly
    description: string; readonly evaluate: (ctx:
    AchievementContext) => boolean }`.
  - `ACHIEVEMENTS: readonly AchievementDefinition[]` — frozen
    array of all 11 definitions (see `plan.md` §"Achievements").
  - `evaluateAchievements(ctx: AchievementContext): readonly
    AchievementId[]` — pure. Returns the ids of all qualifying
    achievements. The function is a simple filter:
    `ACHIEVEMENTS.filter(a => a.evaluate(ctx)).map(a => a.id)`.
  - `AchievementContext` interface: `{ difficulty, elapsedMs,
    moveCount, hintCount, undoCount, errors,
    perDifficultyWins: Readonly<Record<DifficultyType, number>>,
    difficultiesWon: readonly DifficultyType[] }`.
  - `unlockAchievements(state, ids): StateFile` — already in
    `state.ts`; re-exported from here for convenience.
  - JSDoc on every export (G-19). Every `evaluate` function
    documented with its unlock condition in human terms.
- **Tests** (`achievements.test.ts`):
  - Table-driven: for each of the 11 achievements, ≥ 2 cases
    (unlocked + not unlocked) covering the boundary conditions
    (e.g., `elapsedMs === 300_000` is the boundary between
    `speed_demon` locked/unlocked).
  - `evaluateAchievements` returns `[]` on a trivial win (no
    qualifying conditions).
  - `evaluateAchievements` returns multiple ids on a win that
    satisfies multiple conditions (e.g., an easy win in < 5 min
    with 0 hints unlocks both `speed_demon` and `no_hints_easy`).
  - `ACHIEVEMENTS` is `Object.isFrozen`.
  - The `century` achievement requires `sum(perDifficultyWins) >=
    100`; test at exactly 100 (unlocked) and 99 (not unlocked).
  - The `completionist` achievement requires all 5 difficulties
    in `difficultiesWon`; test with 4 (not unlocked) and 5
    (unlocked).
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/persistence/achievements.test.ts && pnpm test:coverage`
  (100% on `src/persistence/achievements.ts`).
- **Depends on:** Step 1.5.1
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `analyze-complexity` (the 11 `evaluate` functions are tiny but
    we want to assert that the orchestrator
    `evaluateAchievements` is O(n)), `test-generate` (table-driven
    scaffolding for 11×2 cases), `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-08, G-19).
    - `pnpm test src/persistence/achievements.test.ts` exits `0`
      (≥ 22 test cases + 3 sanity cases).
    - `pnpm test:coverage` shows 100% on
      `src/persistence/achievements.ts`.
    - `ACHIEVEMENTS` is `Object.isFrozen`.
    - No new runtime dep (G-20).

#### Step 1.5.4 — `src/persistence/lock.ts` + tests (decision 18)

- **Files touched:**
  - `src/persistence/lock.ts` (add).
  - `src/persistence/lock.test.ts` (add).
- **Action:** Add
- **Description:** Pure module. **The second explicit G-20 exception**
  (`proper-lockfile@^4.1.2`, MIT, ~30 kB) is wrapped here behind a
  small typed interface so the rest of the persistence layer remains
  pure and unit-testable. Exports:
  - Type `LockHandle`: opaque type (`{ readonly __lock: unique
    symbol }`) for the handle returned by `acquire`. Cannot be
    forged; `release` only accepts real handles.
  - Type `LockResult`: discriminated union
    `{ ok: true; handle: LockHandle } | { ok: false; reason: 'busy' |
    'timeout' }`. **Never throws for expected contention.**
  - Type `LockFactory`:
    `{ acquire(): Promise<LockResult>; release(handle: LockHandle):
    Promise<void> }` — injected into `state.ts` and `save.ts`.
  - Function `createLock(lockPath: string, options?: { retries?:
    number; retryMinTimeoutMs?: number }): LockFactory` — the
    **only** function that touches `proper-lockfile`. The default
    options are `{ retries: 5, retryMinTimeoutMs: 50 }` (5 retries
    with 50 ms backoff = ~250 ms max wait). The default `stale`
    timeout is 5 s (the `proper-lockfile` default). Returns a
    `LockFactory` whose `acquire` calls `proper-lockfile.lock(lockPath,
    { retries, retryMinTimeoutMs, stale })` and maps the
    `proper-lockfile` errors to the discriminated-union result:
    - `Error: Lock file is already being held` →
      `{ ok: false, reason: 'busy' }`.
    - `Error: ...retries exhausted...` →
      `{ ok: false, reason: 'timeout' }`.
    - Any other error (e.g., permission denied on the lock dir) →
      re-thrown (unexpected; surfaces as a bug, not normal
      contention).
  - Function `nodeLockFactory(lockPath: string): LockFactory` — the
    production implementation. Internally calls `createLock`. Tests
    pass a mock that does not touch the filesystem.
  - Function `inMemoryLockFactory(): { factory: LockFactory; held:
    () => number }` — test double. Holds an internal counter; the
    `held()` accessor returns how many locks are currently held (so
    tests can assert concurrency).
  - JSDoc on every export (G-19). Module-level comment referencing
    G-13 (no cycles), G-20 (second exception, with `proper-lockfile`
    link), and decision 18.
  - **The `proper-lockfile` library is the only runtime import.**
    No project modules are imported (this is a leaf module on
    purpose — preserves the import-graph direction in
    `plan.md` §"Quality Gates").
- **Tests** (`lock.test.ts`, using `inMemoryLockFactory`):
  - `nodeLockFactory` happy path: `acquire()` returns
    `{ ok: true, handle }`; `release(handle)` resolves and the
    `held()` count drops to 0.
  - `nodeLockFactory` busy: while one caller holds the lock, a
    second `acquire()` returns `{ ok: false, reason: 'busy' }` (the
    in-memory factory always returns 'busy' if held; the real
    factory does so under the `proper-lockfile` defaults).
  - `nodeLockFactory` timeout: `createLock(path, { retries: 0 })` →
    `acquire()` returns `{ ok: false, reason: 'timeout' }` after the
    retries are exhausted.
  - `nodeLockFactory` with the real `proper-lockfile` library
    against a tmp dir: assert the `<path>.lock` file is created on
    acquire and removed on release (this is a **single integration
    test**, not exhaustive — the unit tests use the in-memory
    factory). This test is **excluded from coverage** for
    `proper-lockfile` itself (third-party) but the wrapper code
    around it is fully covered.
  - `release` on a stale handle is a no-op (does not throw).
  - `inMemoryLockFactory().held()` returns 0 initially, 1 after
    acquire, 0 after release.
  - `LockFactory` type is structural: a plain object with the
    right shape is accepted (TypeScript compile-time check).
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/persistence/lock.test.ts && pnpm test:coverage` (100% on
  `src/persistence/lock.ts`; `proper-lockfile` itself excluded via
  the vitest config's `coverage.exclude` rule — the project already
  excludes `node_modules`).
- **Depends on:** Step 1 (we add `proper-lockfile` in a new
  sub-step, see below).
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `sec-deps` (verify `proper-lockfile@^4.1.2` has 0 CVEs and
    confirm the license is MIT — record the result in the PR
    description), `sec-sast` (catch any path-traversal in
    `lockPath`), `test-generate` (table-driven tests for the
    busy/timeout/happy paths), `test-coverage` (verify 100% on the
    wrapper), `code-validate`.
  - **Optional specialists:** `security` for a sanity check on the
    `proper-lockfile` security posture (it's a popular, audited
    library but a quick `sec-deps` is appropriate before adoption).
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-04, G-08).
    - `pnpm test src/persistence/lock.test.ts` exits `0` (6+ cases).
    - `pnpm test:coverage` shows 100% on `src/persistence/lock.ts`.
    - `pnpm audit --prod` reports 0 vulnerabilities for
      `proper-lockfile@^4.1.2` (G-S04/G-S05).
    - `sec-sast` reports 0 high-severity findings.
    - JSDoc on every export (G-19).
    - The module imports **only** `proper-lockfile` and
      `node:fs/promises` (for the integration test only). No
      project-module imports (G-13).
    - The `nodeLockFactory` test against a tmp dir uses
      `await fs.mkdtemp(...)` and cleans up via `await
      fs.rm(tmp, { recursive: true })` (G-S07 + G-S01 — no
      leftover test artifacts).

##### Sub-step 1.5.4a — Add `proper-lockfile` runtime dep

- **Files touched:** `package.json`, `pnpm-lock.yaml` (regenerated)
- **Action:** Modify (add dep)
- **Description:** Add `"proper-lockfile": "^4.1.2"` to the
  `dependencies` block of `package.json`. Run `pnpm install` to
  regenerate the lock file. **The second** (and currently last)
  explicit G-20 exception. Documented in §Decisions #18.
- **Acceptance criteria:**
  - [ ] `package.json` lists `proper-lockfile` under
        `dependencies`.
  - [ ] `pnpm install` succeeds with no peer-dep warnings.
  - [ ] `node_modules/proper-lockfile/package.json` exists locally.
  - [ ] `package.json` is otherwise unchanged (no dev-dep churn).
- **Depends on:** —
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `sec-deps` (verify
    `proper-lockfile@^4.1.2` has 0 CVEs and is MIT-licensed),
    `commit-generation` (draft the Conventional Commit message for
    the dep add).
  - **Optional specialists:** `security` for a final sanity check.
  - **Quality gates for this step:**
    - `pnpm install` exits `0`.
    - `pnpm audit --prod` reports 0 vulnerabilities.
    - `package.json` is otherwise unchanged (no dev-dep churn).
    - The dep is the **only** change in this commit (per
      single-purpose commit policy).

---

### Phase 2: Game state model (pure)

#### Step 3 — Add `src/game/state.ts`

- **Files touched:** `src/game/state.ts` (add)
- **Action:** Add
- **Description:** Implement the pure state machine. No I/O, no
  imports from `tui.ts` or `output.ts` or `format/colors.ts`. Imports
  limited to:
  - `import { createSudoku, type BoardType, type DifficultyType, isSolved } from '@hackettyam/sudoku-tools'`
  - `import { setCellValue, clearCell, getInvalidCells } from '@hackettyam/sudoku-tools'`
  - `import type { CellValue } from '@hackettyam/sudoku-tools'`
- Export exactly:
  - Types: `CellPosition`, `Move` (discriminated union per plan §
    "Game State Model"), `GameStatus`, `GameState`.
  - Functions: `createGame(difficulty: DifficultyType): GameState`,
    `applyMove(state: GameState, move: Move): GameState`,
    `isWon(state: GameState): boolean`,
    `undo(state: GameState): GameState`,
    `isReadOnly(state: GameState, row: number, col: number): boolean`.
- All functions ≤ 60 LOC, max 3 params (use options object if needed),
  immutability by default (G-22). JSDoc on every export (G-19).
- `applyMove` rules:
  - On `status: 'quit'`, return state unchanged.
  - On `place`: reject if `isReadOnly(state, r, c)`; use
    `setCellValue(state.current, { row, col, value })` to compute
    new board; push to history; recompute errors; if
    `isSolved(newBoard, state.solution)` → `status: 'won'`.
  - On `clear`: same; use `clearCell(state.current, row, col)`.
  - On `move-cursor`: clamp row/col to `[0, 8]`; return new state
    with updated `cursor`, no history change.
  - On `undo`: if history empty, no-op; else replay `current` from
    `original` applying all moves except the last.
  - On `hint`: if cursor cell is empty + editable, place
    `state.solution[r][c]`.
  - On `new-game`: only valid if `status !== 'playing'`; calls
    `createGame` with the same difficulty.
  - On `quit`: return state with `status: 'quit'`.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/game/state.test.ts && pnpm test:coverage`
- **Depends on:** Step 2 (for type alignment with no other module
  coupling).
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `analyze-complexity` (verifies `applyMove` ≤ 10 cyclomatic
    complexity — the per-variant branching is the risk).
  - **Optional specialists:** `analyzer` if complexity on
    `applyMove` exceeds threshold.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (max 180 LOC/function, G-08).
    - `pnpm test src/game/state.test.ts` exits `0` (skeleton tests
      from Step 4 are minimal — this step delivers the
      implementation).
    - No `any`, no `!`, no `console.log` (G-02, G-03, G-07).
    - JSDoc on every export (G-19).
    - `GameState` interface uses `readonly` everywhere (G-22).

#### Step 4 — Unit-test `src/game/state.ts`

- **Files touched:** `src/game/state.test.ts` (add)
- **Action:** Add
- **Description:** Cover every function and every `Move` variant.
  Use `describe` blocks per export. Test fixture: a hand-crafted
  puzzle (not random) so assertions are deterministic. Suggested
  fixture: a known solvable puzzle + its solution, both
  hard-coded.
- Test cases (representative — full list grows during implementation):
  - `createGame` returns a `GameState` with `status: 'playing'`,
    `cursor: {row:0,col:0}`, `history: []`, `moveCount: 0`,
    `readOnly` true for every non-zero cell of `original`.
  - `applyMove(place, readOnlyCell)` is a no-op.
  - `applyMove(place, editableCell)` updates `current`, increments
    `moveCount`, appends to `history`, recomputes `errors`.
  - `applyMove(place, lastEmptyCell)` flips `status` to `'won'`
    when the placed value matches the solution.
  - `applyMove(move-cursor, ...)` clamps to `[0, 8]`.
  - `applyMove(undo, empty history)` is a no-op.
  - `applyMove(undo, 2-step history)` reverts exactly the last
    place/clear; `moveCount` decreases by 1.
  - `applyMove(quit, ...)` sets `status: 'quit'`.
  - `applyMove(new-game, status: 'playing')` is a no-op
    (or returns a *new* game — pick one; document it in the test).
  - `isWon` returns `true` when `current` matches `solution`.
  - `isReadOnly` returns `true` for fixed cells, `false` otherwise.
- **Validation:** `pnpm test:coverage` shows 100% on
  `src/game/state.ts` and on the test file itself.
- **Depends on:** Step 3
- **Agent owner:** `test` (assisted by `code` for fixtures)
- **Delegation:**
  - **Primary agent:** `test`
  - **Skills to load (in order):** `test-auto-generate` (suggests
    cases from `applyMove` signature), `test-generate` (writes the
    AAA blocks), `test-run`, `test-coverage` (verifies 100% on
    `src/game/state.ts`).
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - One test per `Move` variant × at least 2 states (playing,
      won, quit) — per the step description.
    - `pnpm test:coverage` shows 100% lines/statements/functions on
      `src/game/state.ts`.
    - Branch coverage reported (not enforced) per project policy.
    - All tests deterministic (G-T04): no `Date.now()`, no
      `Math.random()`; use the hard-coded fixture.

---

### Phase 2.5: Extend `GameState` with counters

> Landed **after** Phase 1.5 (so the save-file schema can include
> the new fields from day one) and **before** Phase 3.5 (so the win
> banner has the data it needs).

#### Step 2.5.1 — Extend `src/game/state.ts` with `hintCount`, `undoCount`, optional `id`

- **Files touched:**
  - `src/game/state.ts` (modify).
  - `src/game/state.test.ts` (modify).
- **Action:** Modify
- **Description:** Add three fields to `GameState`:
  - `hintCount: number` — count of `hint` moves applied. Initialized
    to `0` in `createGame`.
  - `undoCount: number` — count of `undo` moves applied. Initialized
    to `0` in `createGame`.
  - `id?: string` — optional UUID assigned by `saveGame` on save;
    `createGame` leaves it `undefined`.
  Update `applyMove`:
  - `place` / `clear` → `moveCount += 1`, push to `history`,
    recompute `errors`.
  - `undo` → if `history` is empty, no-op (return state unchanged,
    do **not** increment `undoCount`). Else, `undoCount += 1`, drop
    the last `place`/`clear` entry from `history`, recompute
    `errors` and `moveCount = history.length`.
  - `hint` → `hintCount += 1`, place `solution[r][c]`, push a
    synthetic `{ kind: 'place', row, col, value: solution[r][c] }`
    to `history` (so `u` undoes a hint). `moveCount` is **not**
    incremented.
  - `move-cursor` / `new-game` / `quit` → no counter changes.
  Also export a new helper: `getStats(state: GameState): {
  elapsedMs, moveCount, hintCount, undoCount, errorCount }`. Used
  by the play command to build the win context without re-deriving
  fields.
- **Tests** (extend `state.test.ts`):
  - For each new counter (`hintCount`, `undoCount`): at least 1
    increment case + 1 no-op case.
  - `undo` on empty history is a no-op (assert `undoCount` is
    unchanged, not incremented).
  - `hint` on an empty editable cell increments `hintCount`,
    places the correct value, and adds a `place` to `history`
    (so `u` reverts the hint).
  - `hint` does not increment `moveCount`.
  - `getStats` returns the expected shape for a fixture state.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/game/state.test.ts && pnpm test:coverage` (100% preserved).
- **Depends on:** Step 4 (existing state tests).
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `analyze-complexity` (the `applyMove` switch is the risk —
    assert complexity stays ≤ 12), `test-run`, `test-coverage`,
    `code-validate`.
  - **Optional specialists:** `analyzer` if `applyMove`
    complexity exceeds threshold.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-22 immutability — every counter
      change returns a new state, never mutates).
    - `pnpm test src/game/state.test.ts` exits `0` (existing 9+
      cases + 6 new ones).
    - `pnpm test:coverage` shows 100% on `src/game/state.ts`
      (unchanged gate).
    - The 4 unused `errors: string[]` mentions in the existing
      tests still pass (we did not change the field type).

---

### Phase 3: TUI pure functions

#### Step 5 — Add `src/tui.ts` (keypress parser only)

- **Files touched:** `src/tui.ts` (add)
- **Action:** Add
- **Description:** Implement only the keypress parser in this step;
  renderer and `applyKey` come in Steps 6 and 7. This lets us land
  the trickiest bit (escape-sequence grammar) with focused tests
  before the rendering work piles on.
- Exports:
  - Type `ParsedKey`:
    `| { kind: 'arrow-up' } | { kind: 'arrow-down' } | { kind: 'arrow-left' } | { kind: 'arrow-right' } | { kind: 'home' } | { kind: 'end' } | { kind: 'ctrl-home' } | { kind: 'ctrl-end' } | { kind: 'digit'; value: number } | { kind: 'backspace' } | { kind: 'delete' } | { kind: 'char'; value: string } | { kind: 'escape' } | { kind: 'ctrl-c' }`.
  - Function `parseKeypress(buf: Buffer): readonly ParsedKey[]` —
    pure, synchronous, no globals. Returns 0 or more keys
    (terminals may batch multiple bytes in one chunk). Recognized
    sequences (case-sensitive on letters):
    - `\x1b[A` → `arrow-up`
    - `\x1b[B` → `arrow-down`
    - `\x1b[C` → `arrow-right`
    - `\x1b[D` → `arrow-left`
    - `\x1b[H` / `\x1b[1~` → `home`
    - `\x1b[F` / `\x1b[4~` → `end`
    - `\x1b[1;5H` → `ctrl-home`
    - `\x1b[8;5H` → `ctrl-end`
    - `\x1b[3~` → `delete`
    - `\x1b` alone → `escape`
    - `\x03` → `ctrl-c`
    - `\x7f` → `backspace`
    - ASCII `0`-`9` → `digit`
    - ASCII `a`-`z` / `A`-`Z` → `char`
    - Anything else: dropped (return `[]`).
- JSDoc on every export. ≤ 80 LOC.
- **Validation:** `pnpm lint && pnpm typecheck`
- **Depends on:** Step 2 (no coupling to state — keep parser
  independent).
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`.
  - **Optional specialists:** none (parser is a small state machine;
    no need for `analyzer`).
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (max 80 LOC, G-08).
    - JSDoc on `parseKeypress` and `ParsedKey` (G-19).
    - All listed escape sequences handled; unknown sequences return
      `[]` (verified by the table-driven tests in Step 7).

#### Step 6 — Add `src/tui.ts` (renderer) + snapshot tests

- **Files touched:** `src/tui.ts` (modify — add `renderGame`,
  `formatTime`); `src/tui.test.ts` (add)
- **Action:** Modify + Add
- **Description:** Extend `src/tui.ts` with:
  - `formatTime(ms: number): string` — `mm:ss` (e.g. `02:34`,
    `1:02:03` if `≥ 1h`). Zero-padded minutes/seconds.
  - `renderGame(state: GameState, options: { colors: typeof
    import('picocolors') }): string` — pure. Returns a single
    multi-line string. Composes header, grid, stats, footer, and
    optional win banner. Uses the `colors` object for SGR codes
    (no literal `\x1b[` sequences outside the cell color helpers).
  - Internal helpers (not exported): `renderRow`, `renderBox`,
    `colorForCell(state, r, c, isCursor)`. Each ≤ 25 LOC.
- **Tests** in `src/tui.test.ts`:
  - `formatTime`: `0` → `"00:00"`, `154000` → `"02:34"`, `3723000`
    → `"1:02:03"`.
  - `renderGame`: 3 Vitest snapshots:
    1. Initial state of a fixed easy puzzle, no cursor moves.
    2. Mid-game state with cursor at `(4, 6)`, 12 moves, 1 error.
    3. Win state at the end of the puzzle.
  - Assert the output contains the box-drawing top-left corner
    `┌`, the box-drawing box-separator `┬`, the footer keybinding
    list, and the difficulty name from the state.
  - Test that disabling colors (pass `picocolors.createColors(false)`)
    produces output containing no `\x1b[` sequences.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/tui.test.ts && pnpm test:coverage`
  (coverage of `src/tui.ts` ≥ 100%).
- **Depends on:** Steps 3, 4, 5
- **Agent owner:** `code` (with `test` review of the snapshots)
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `analyze-complexity` (verifies `renderGame` ≤ 15 cyclomatic
    complexity — the cell color matrix is the risk),
    `code-validate` (lint + typecheck + test in sequence).
  - **Optional specialists:** `analyzer` if complexity on
    `renderGame` or `colorForCell` exceeds threshold.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (max 180 LOC/function, G-08).
    - `pnpm test src/tui.test.ts` exits `0` (3 snapshots match).
    - `pnpm test:coverage` shows 100% on `src/tui.ts` (existing
      exports).
    - Disabling colors (pass `picocolors.createColors(false)`)
      produces output with 0 `\x1b[` sequences (asserted in
      `tui.test.ts`).
    - JSDoc on every export (G-19).
    - No literal `\x1b[` sequences outside the cell color helpers
      (G-07 + Decision #9).

#### Step 7 — Add `src/tui.ts` (`applyKey`) + finish tests

- **Files touched:** `src/tui.ts` (modify — add `applyKey`,
  `KEYBINDINGS`); `src/tui.test.ts` (modify)
- **Action:** Modify
- **Description:** Add to `src/tui.ts`:
  - Constant `KEYBINDINGS`: a frozen array of `{ keys: string;
    action: string }` records used to render the footer (e.g.
    `{ keys: '↑↓←→', action: 'move' }`). Pure data.
  - Function `applyKey(state: GameState, key: ParsedKey): GameState`
    — pure. Maps `ParsedKey` to a `Move` (per the keybindings
    table in `plan.md` §"Keybindings") and delegates to
    `applyMove`. Unknown keys return the state unchanged.
  - Mapping table:
    - `arrow-up/down/left/right`, `home`, `end`, `ctrl-home`,
      `ctrl-end` → `move-cursor` (with new clamped coordinates;
      `home`/`end` only changes col; `ctrl-home`/`ctrl-end`
      jumps to corners).
    - `digit` → `place` (row=cursor.row, col=cursor.col,
      value=key.value).
    - `backspace`/`delete` → `clear` at cursor.
    - `char: 'h'` → `hint`.
    - `char: 'u'` → `undo`.
    - `char: 'n'` → `new-game`.
    - `char: 'q'`, `escape` → `quit`.
    - `ctrl-c` → `quit`.
- **Tests** in `src/tui.test.ts`:
  - For each `ParsedKey` variant: assert `applyKey` returns the
    expected new state (or unchanged).
  - Assert `applyKey(state, { kind: 'ctrl-c' })` returns
    `state.status === 'quit'`.
  - Assert `applyKey(state, { kind: 'arrow-up' })` at `(0, 0)`
    stays at `(0, 0)` (clamped).
  - Assert `applyKey(state, { kind: 'char', value: 'z' })`
    returns state unchanged.
  - Assert `KEYBINDINGS` is frozen (`Object.isFrozen`).
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/tui.test.ts && pnpm test:coverage`
- **Depends on:** Step 6
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-08, G-10).
    - `pnpm test src/tui.test.ts` exits `0` (all `ParsedKey`
      variants covered; `KEYBINDINGS` is `Object.isFrozen`).
    - `pnpm test:coverage` shows 100% on `src/tui.ts`.
    - JSDoc on `applyKey`, `KEYBINDINGS` (G-19).

---

### Phase 3.5: TUI additions (win banner + save prompt)

> Pure rendering work; no new I/O. Sits between the I/O shell
> (Phase 4) and the command implementation (Phase 5).

#### Step 3.5.1 — `renderWinBanner`, `renderSavePrompt`, `formatShortId` + tests (v1.2.0: also `renderAchievementInline`)

- **Files touched:**
  - `src/tui.ts` (modify — add new exports).
  - `src/tui.test.ts` (modify — add new snapshots + 1 unit test).
- **Action:** Modify
- **Description:** Add to `src/tui.ts`:
  - `formatShortId(id: string): string` — first 8 chars of the
    UUID. JSDoc. Used in the save prompt.
  - `renderWinBanner(state, options, achievements: readonly
    AchievementId[]): string` — pure. Composes the filled grid
    (reuse `renderGame`) + a 2-line green banner ("🎉 You won! 🎉" /
    "Time: mm:ss  Moves: NN") + a one-line list of newly-unlocked
    achievements (or empty if `achievements.length === 0`).
    **Q-3 confirmed** (filled grid + banner with stats). In
    v1.2.0, the inline achievement line is delegated to
    `renderAchievementInline` (see below).
  - `renderSavePrompt(state, options): string` — pure. Returns a
    one-line "Game saved as `<short-id>`. Resume with `play --load
    <id>` or `play --resume-last`." footer. Shown briefly before
    `cleanup()` runs.
  - `ACHIEVEMENT_GLYPHS: Readonly<Record<AchievementId, string>>` —
    static map of `id → '🏆' | '⚡' | '🎯' | ...`. Used to render
    the achievement list. JSDoc.
  - **`renderAchievementInline(unlocked: readonly
    AchievementId[]): string`** (NEW in v1.2.0, decision 19) —
    returns the one-line summary for the win banner stats row.
    Format: `'★ +<N> achievements unlocked: <id1>, <id2>, ...'` (or
    `'★ +1: <id>'` / `'★ no new achievements'`). When `colors` is
    disabled **and** stdout is non-TTY (machine-parseable mode), the
    function returns an empty string. JSDoc.
  - `WinView` type: `'menu' | 'achievements'` — added to
    `GameState` as an optional `view?: WinView` field (defaults to
    `'menu'` on win). Toggled by the `a` keypress (Step 9).
  Update `renderGame`:
  - Replace the existing "🎉 You won! 🎉" banner with a call to
    `renderWinBanner` when `status === 'won'`.
  - When `status === 'quit'` AND `state.saveId` (or `state.id`) is
    set, append `renderSavePrompt` to the bottom of the frame for
    one paint cycle.
  - When `status === 'won'` AND `view === 'achievements'`, render
    `renderAchievementDetail(...)` instead of the normal win
    banner (the dismissable view).
  JSDoc on every new export. The new functions are ≤ 40 LOC each.
  The `renderAchievementInline` function is ≤ 25 LOC.
- **Tests** (extend `tui.test.ts`):
  - 2 new Vitest snapshots for `renderWinBanner`: win with 0
    achievements; win with 3 achievements (`speed_demon`,
    `no_hints_easy`, plus one cross-tier).
  - 1 new Vitest snapshot for `renderSavePrompt` (uses a
    deterministic UUID).
  - **`renderAchievementInline` tests** (NEW in v1.2.0):
    - 1 snapshot: `[]` → `'★ no new achievements'` (dim gray).
    - 1 snapshot: `['speed_demon']` → `'★ +1: speed_demon'`.
    - 1 snapshot: `['speed_demon', 'no_hints_easy', 'first_win']` →
      `'★ +3 achievements unlocked: speed_demon, no_hints_easy,
      first_win'`.
    - Unit test: with `colors` disabled **and** `isStdoutTty: false`,
      returns `''`.
    - Unit test: with `colors` disabled **and** `isStdoutTty: true`,
      returns the uncolored text.
  - `formatShortId('12345678-1234-4ef0-9abc-def012345678')` →
    `'12345678'`.
  - `formatShortId` on a non-UUID string returns the first 8 chars
    defensively (does not throw).
  - `ACHIEVEMENT_GLYPHS` is `Object.isFrozen` and has exactly 11
    keys.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/tui.test.ts && pnpm test:coverage` (100% on `src/tui.ts`
  preserved).
- **Depends on:** Step 7 (existing TUI) and Step 1.5.3 (achievement
  ids available).
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `analyze-complexity` (the inline + dismissable renderers have a
    branch matrix on `view` and `unlocked.length` — assert
    complexity stays ≤ 10), `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-08, G-22).
    - `pnpm test src/tui.test.ts` exits `0` (existing 3 snapshots
      + 3 new win/save snapshots + 3 new inline snapshots all
      match).
    - `pnpm test:coverage` shows 100% on `src/tui.ts` (extended
      surface, same gate).
    - JSDoc on the 5 new exports (G-19).
    - No new runtime dep (G-20).

#### Step 3.5.2 — `renderAchievementDetail` + `renderTrophyArt` + dismissable view snapshot (NEW in v1.2.0)

- **Files touched:**
  - `src/tui.ts` (modify — add 2 new exports + 1 helper).
  - `src/tui.test.ts` (modify — add 1 dismissable-view snapshot).
- **Action:** Modify
- **Description:** Add to `src/tui.ts`:
  - `Rarity` type: `'bronze' | 'silver' | 'gold' | 'legendary'` —
    a static mapping from `AchievementId` to rarity (all 11
    achievements have a fixed rarity; documented in
    `plan.md` §"Achievements" via a new column). Exported for
    testability.
  - `ACHIEVEMENT_RARITY: Readonly<Record<AchievementId, Rarity>>` —
    frozen. Examples: `first_win: 'bronze'`, `completionist:
    'gold'`, `untouchable: 'legendary'`. JSDoc.
  - `renderAchievementDetail(unlocked: readonly
    UnlockedAchievement[], totalUnlocked: number, totalAvailable:
    number, options: { colors: typeof import('picocolors'),
    isStdoutTty: boolean, screenWidth?: number }): string` —
    pure. Returns the full dismissable view: double-line box
    (`╔═╗║╚═╝╠═╣╦╩╬`), centered ASCII trophy art (3-4 lines,
    Unicode block chars), and one 2-line card per unlocked
    achievement showing: title (bold), description (regular),
    rarity (color-coded). Below the cards: `★ <totalUnlocked> /
    <totalAvailable> achievements`. Footer: `Press any key to
    return to the win menu.` (dim gray). When `isStdoutTty` is
    false, the function returns the same layout without colors
    and with ASCII icon fallbacks (`*`, `v`, `t`, `>`, `h`, `+`).
    JSDoc. ≤ 80 LOC.
  - `renderTrophyArt(options: { colors: typeof import('picocolors'),
    isStdoutTty: boolean }): string` — pure. Returns the centered
    3-4 line ASCII trophy. Two variants:
    - With `isStdoutTty === true`: Unicode block chars
      (`█▀▀▀█`, `█░░░█`, `█▄▄▄█`, plus a `★` on top) in
      `colors.yellow`.
    - With `isStdoutTty === false`: plain ASCII
      (`====`, `|  |`, `====`, `*`) — no color, no Unicode block.
    JSDoc. ≤ 20 LOC.
  - Helper `screenWidth(options): number` — returns the explicit
    `screenWidth` if provided, else `process.stdout.columns` if
    available and a TTY, else `80` (a reasonable default). Used by
    `renderAchievementDetail` to center the trophy.
  JSDoc on every new export. The dismissable view is composed from
  `renderTrophyArt` + a per-achievement card loop, all pure and
  unit-testable.
- **Tests** (extend `tui.test.ts`):
  - 1 Vitest snapshot: `renderAchievementDetail` with 3 unlocked
    achievements (`speed_demon`, `no_hints_easy`, `first_win`),
    `totalUnlocked: 3, totalAvailable: 11`. The snapshot is the
    **full ANSI output** of the dismissable view. The test runs
    with `colors: picocolors.createColors(true)` and
    `isStdoutTty: true` (TTY mode), then strips the `\x1b[?25l`
    animation codes that the test harness injects (only the
    layout is snapshotted, not the transient animation).
  - 1 Vitest snapshot: `renderAchievementDetail` with
    `isStdoutTty: false`. Asserts no color escapes, ASCII icons.
  - 1 unit test: `renderTrophyArt` returns a non-empty string with
    the expected line count (3-4 lines).
  - 1 unit test: `renderTrophyArt({ isStdoutTty: false })` returns
    a string with no Unicode block chars and no `\x1b[` escapes.
  - 1 unit test: `ACHIEVEMENT_RARITY` is `Object.isFrozen` and has
    exactly 11 keys. Each rarity value is one of `'bronze' |
    'silver' | 'gold' | 'legendary'`.
  - 1 unit test: `screenWidth({ screenWidth: 100 })` returns
    `100`; `screenWidth({})` returns `80` (the default).
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/tui.test.ts && pnpm test:coverage` (100% on `src/tui.ts`
  preserved).
- **Depends on:** Step 3.5.1 (the inline view is already there; the
  dismissable view references the same `unlocked: readonly
  UnlockedAchievement[]` type from `persistence/achievements.ts`).
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `analyze-complexity` (the dismissable view has a card loop
    that uses the rarity-color map; assert complexity stays ≤ 12),
    `test-generate` (table-driven cases for the rarity × color
    mapping), `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-08, G-22).
    - `pnpm test src/tui.test.ts` exits `0` (existing snapshots +
      2 new dismissable snapshots + 3 new unit tests).
    - `pnpm test:coverage` shows 100% on `src/tui.ts` (extended
      surface, same gate).
    - JSDoc on every new export (G-19).
    - The snapshot is **stable**: the test file uses
      `toMatchInlineSnapshot()` with a frozen, deterministic
      output (no `Date.now()`, no `Math.random()`).
    - The function uses only `picocolors` + built-in ANSI
      sequences — no new runtime dep (G-20).

---

### Phase 4: Output helper (runTuiSession)

#### Step 8 — Extend `src/output.ts` with `runTuiSession` + tests

- **Files touched:**
  - `src/output.ts` (modify — add `runTuiSession`, `TuiRunner`,
    `TuiSessionOptions`, `KeySink`).
  - `src/__tests__/output.tui.test.ts` (add).
- **Action:** Modify + Add
- **Description:** Add to `src/output.ts`:
  - `export interface KeySink { push(key: import('../tui.js').ParsedKey): void }` — minimal interface so the helper doesn't have to know about `tui.ts` directly. Imported as `type`, so no runtime cycle.
  - `export interface TuiSessionOptions {
      colors: typeof import('picocolors')
      onKey: (sink: KeySink) => void
      render: () => string
    }` — the `colors` and `render` are passed in to keep `output.ts` free of TUI/gui concerns.
  - `export interface TuiRunner {
      draw(frame: string): void
      cleanup(): void
      run(): Promise<{ exitCode: number; reason: 'quit' | 'win' | 'error' }>
    }`
  - `export function runTuiSession(opts: TuiSessionOptions): TuiRunner`.
    Implementation:
    - On first `draw()`: if not yet set up, write
      `\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H` (enter alt screen, hide
      cursor, clear, home), call `process.stdin.setRawMode(true)`,
      `process.stdin.resume()`, register `data` listener, register
      `SIGINT` and `SIGTERM` cleanup handlers.
    - The `data` listener calls `tui.parseKeypress(buf)` and
      forwards each parsed key to `opts.onKey(sink)`.
    - `sink.push` is the API the orchestrator uses to mark the
      session as ended: `sink.push({ kind: 'ctrl-c' })` from a
      SIGINT handler triggers `resolve({ exitCode: 130, reason:
      'quit' })`. The session distinguishes `'quit'` (user typed
      `q`/`Esc`/`Ctrl+C`) from `'win'` (orchestrator called
      `sink.push` with a sentinel) from `'error'` (uncaught
      exception in `render`).
    - `cleanup()` is idempotent. Writes `\x1b[?25h\x1b[?1049l`
      (show cursor, leave alt screen), `setRawMode(false)`,
      `process.stdin.pause()`, removes all listeners, and is
      registered on `process.on('exit')` as a last-resort
      fallback.
- **Tests** in `src/__tests__/output.tui.test.ts`:
  - Spy on `process.stdin.setRawMode`, `process.stdout.write`,
    `process.on`. Use a fake `EventEmitter` for `process.stdin` to
    emit `data` events.
  - Test 1: first `draw()` writes the expected init escape
    sequence (`\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H`) and calls
    `setRawMode(true)`.
  - Test 2: emitting a `data` event with `\x1b[A` causes
    `opts.onKey` to be invoked with `{ kind: 'arrow-up' }`.
  - Test 3: emitting a `data` event with `q` invokes
    `opts.onKey` with `{ kind: 'char', value: 'q' }`.
  - Test 4: `cleanup()` writes the leave sequence, calls
    `setRawMode(false)`, pauses stdin, removes listeners. Calling
    it twice is a no-op (idempotent).
  - Test 5: the SIGINT handler triggers `cleanup` and resolves
    the `run()` promise with `exitCode: 130, reason: 'quit'`.
  - Test 6: a synchronous throw from `opts.render` resolves
    `run()` with `reason: 'error'`.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/__tests__/output.tui.test.ts && pnpm test:coverage`
  (coverage of `src/output.ts` stays 100%).
- **Depends on:** Step 7
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `sec-sast` (catches any missed `process.stdin` reads or
    unbounded listeners), `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-08: ≤ 60 LOC for `runTuiSession`).
    - `pnpm test src/__tests__/output.tui.test.ts` exits `0` (6
      tests: init, key routing, idempotent cleanup, SIGINT, render
      throw, double-cleanup).
    - `pnpm test:coverage` shows 100% on `src/output.ts` (existing
      coverage preserved).
    - `sec-sast` reports 0 high-severity findings.
    - No `any` in `TuiSessionOptions` (G-02).

---

### Phase 5: Command implementation

#### Step 9 — Add `src/commands/play.ts` + tests (v1.2.0: handle `a` keypress in `Won` state)

- **Files touched:**
  - `src/commands/play.ts` (add).
  - `src/__tests__/commands/play.test.ts` (add).
- **Action:** Add
- **Description:** The orchestrator. Exports:
  - `export interface PlayOptions { difficulty?: string }`
  - `export type PlayExitReason = 'quit' | 'won' | 'error'`
  - `export interface PlayCommandResult { kind: 'play_exit'; reason: PlayExitReason; elapsedMs: number; moveCount: number }`
  - `export interface PlayIO { run(opts: { draw: (frame: string) => void; onKey: (key: ParsedKey) => void }): Promise<{ exitCode: number }> cleanup(): void }`
  - `export function playCommand(options?: PlayOptions, deps?: { io: PlayIO; now: () => number }): Promise<PlayCommandResult>`
  - The default `deps.io` is `{ run: ..., cleanup: ... }` from
    `output.runTuiSession`. Tests pass a mock.
- Behavior:
  1. Validate `options.difficulty` via `parseDifficulty`; on
     error, return `{ kind: 'play_exit', reason: 'error', ...}`
     with `elapsedMs: 0, moveCount: 0`. **Q-1 + Q-2 confirmed**:
     the dispatcher in `cli.ts` maps this to exit `2`; no separate
     `play_error` variant.
  2. Call `createGame(difficulty)`.
  3. Build a `draw` closure that calls `tui.renderGame(state,
     { colors })`.
  4. Build an `onKey` closure that calls
     `tui.applyKey(state, key)` and then checks `isWon(state)`.
  5. **NEW in v1.2.0 (decision 19):** when the state enters
     `status: 'won'`, the orchestrator also handles a new
     `view: 'menu' | 'achievements'` sub-field (default
     `'menu'`). The keypress routing is:
     - `a` (char `'a'`): if `unlockedAchievements.length > 0`,
       set `view = 'achievements'`. Otherwise, no-op.
     - In `view: 'achievements'`, **any key** (other than the
       modifier-prefixed keys `q`/`n`/`Esc`/arrow keys) sets
       `view = 'menu'`. The `Esc` key in the dismissable view
       also sets `view = 'menu'` (does **not** quit; that would
       be a footgun).
     - In `view: 'menu'`, the existing keybindings hold: `n` =
       new game, `q`/`Esc` = quit.
  6. Call `deps.io.run({ draw, onKey })` and `await` it.
  7. Return `{ kind: 'play_exit', reason, elapsedMs: now() -
     state.startTime, moveCount: state.moveCount, hintCount,
     undoCount, saveId? }`.
- **Tests** in `src/__tests__/commands/play.test.ts`:
  - Test 1: invalid difficulty returns a `play_exit` with
    `reason: 'error'`.
  - Test 2: a full happy path: mock `PlayIO` that pushes
    `{ kind: 'arrow-right' }`, then `{ kind: 'digit', value: 5
    }`, then `{ kind: 'char', value: 'q' }`. Assert: `draw` was
    called at least 3 times; final state has `status: 'quit'`,
    `moveCount: 1`, and elapsed ms is computed.
  - Test 3: win path: drive the cursor to a cell and place the
    correct value; assert `reason: 'won'`.
  - Test 4: hint path: push `h` on an empty editable cell;
    assert the cell was filled.
  - Test 5: undo path: place 2 values, then `u`; assert
    `moveCount` is `1`.
  - Test 6: Ctrl+C path: push `ctrl-c`; assert `reason: 'quit'`
    and `cleanup` was called.
  - **Test 7 (NEW in v1.2.0):** win → press `a` → assert the
    state has `view: 'achievements'`. Press a different key
    (e.g. `Enter`) → assert `view: 'menu'`.
  - **Test 8 (NEW in v1.2.0):** win → press `a` → press
    `Esc` → assert `view: 'menu'` (not `quit`); the game has
    not ended.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/__tests__/commands/play.test.ts && pnpm test:coverage`
- **Depends on:** Steps 4, 6, 7, 8, 3.5.1, 3.5.2 (the new
  `view` field is set by the orchestrator and read by the TUI
  renderer in `renderGame`).
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `analyze-complexity` (the `playCommand` function has 7 numbered
    steps in its description; verify cyclomatic complexity ≤ 13),
    `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-08, G-22 immutability).
    - `pnpm test src/__tests__/commands/play.test.ts` exits `0`
      (8 cases per the step description).
    - `pnpm test:coverage` shows 100% on `src/commands/play.ts`.
    - JSDoc on `playCommand`, `PlayOptions`, `PlayCommandResult`,
      `PlayIO` (G-19).
    - The function is pure (no `process.*` calls; all I/O is
      injected via `deps.io`).
    - The `view: 'achievements' | 'menu'` field is part of the
      `GameState` (added in Step 3.5.1) and is mutated only via
      a new `Move` variant `{ kind: 'toggle-achievements' }` —
      no out-of-band state changes (G-22 immutability).

---

### Phase 5.5: Wire persistence + win flow into the play command

> Modifies `src/commands/play.ts` to persist on quit/win. Uses the
> already-built persistence primitives (Phase 1.5) and the extended
> state (Phase 2.5).

#### Step 5.5.1 — `playCommand` calls `saveGame` / `loadState` / `lockFactory` + tests (v1.2.0: counter semantics + lock)

- **Files touched:**
  - `src/commands/play.ts` (modify).
  - `src/commands/play.test.ts` (modify).
- **Action:** Modify
- **Description:** Update `playCommand(options, deps)` to accept an
  optional `deps.persistence: { fs: FsAdapter; lock: LockFactory;
  now: () => number; statePath: string; savesDir: string }`
  (default `nodeFsAdapter + nodeLockFactory(defaultStateLockPath
  (defaultStatePath())) + Date.now + defaultStatePath() +
  defaultSavesDir()`). Add the new `options.loadId?: string` and
  `options.resumeLast?: boolean` flags (read from
  `parsePlayArgs`).
  Four behavioral changes:
  1. **On `startNewGame` (a fresh game, no `loadId` /
     `resumeLast`)** (NEW in v1.2.0, decision 17):
     - Call `loadState` (which acquires the lock).
     - Call `mergeStats(prev, { mode: 'start', difficulty })` to
       increment `totalPlays` by exactly 1 and set
       `lastPlayedAt = Date.now()`.
     - `saveState` (atomic, `0o700` dir auto-created on first
       write). Lock is released at the end.
     - **Idempotency**: this is the only place `mode: 'start'` is
       called. Resuming a save (`--load <id>` or `--resume-last`)
       does **not** call `mode: 'start'`, so `totalPlays` is
       **not** incremented (decision 17).
  2. **On `isWon` transition** (inside the TUI key handler):
     - Build the `AchievementContext` from `state` +
       `loadState().stats`.
     - Call `evaluateAchievements(ctx)` to get qualifying ids.
     - Call `unlockAchievements` and `mergeStats(prev, { mode:
       'win', ...result })` to compute the next state.
     - **`mergeStats` with `mode: 'win'`** increments
       `totalWins` by exactly 1 (idempotent: the
       `isWon` transition fires only once per play; even if a
       save was loaded and immediately solved, `totalWins` gets
       +1, never +2).
     - `saveState` (atomic, `0o700` dir auto-created on first
       write).
     - Pass the unlocked ids back to
       `tui.renderWinBanner.renderAchievementInline(...)`.
  3. **On `status: 'quit'` mid-game** (not won):
     - Call `saveGame(fs, state, defaultSavesDir())` to write the
       save.
     - `loadState` → update `lastSaveId` → `saveState`.
     - Pass the new id to `tui.renderSavePrompt`.
  4. **`options.loadId` / `options.resumeLast`** (in `playCommand`,
     before the TUI starts):
     - `loadId` → call `loadGame(fs, loadId, savesDir)`, return the
       restored state to the TUI. **Do NOT call `mode: 'start'`**
       (decision 17: resume does not increment `totalPlays`).
     - `resumeLast` → call `latestSaveId`; if `null`, return
       `play_exit: { reason: 'error', message: 'No saved games.' }`
       (dispatcher maps to exit `1`); else `loadGame`. **Do NOT
       call `mode: 'start'`.**
  5. **Error mapping**:
     - Save failure (disk full, permission denied) → `play_exit:
       error` with `message: 'Failed to save game: <cause>'.` The
       TUI **still cleans up** (the user is informed, not stuck).
     - State write failure → same mapping.
     - `loadGame` failure (`SaveNotFoundError`, `SaveCorruptError`,
       `SaveVersionError`) → `play_exit: error` with the typed
       message; mapped to exit `2` by the dispatcher.
     - **Lock-busy failure** (NEW in v1.2.0, decision 18) → return
       `play_exit: error` with `message: 'state file is busy;
       please retry'`. Mapped to exit `2` by the dispatcher.
       The lock is **released** before returning (via
       `try { ... } finally { release(handle) }`).
  Extend `PlayCommandResult` with `hintCount: number; undoCount:
  number; saveId?: string; unlockedAchievements: readonly
  AchievementId[]`. The dispatcher in `cli.ts` will surface
  `unlockedAchievements` to stdout (e.g., "🏆 Unlocked: speed_demon,
  no_hints_easy").
- **Tests** (extend `play.test.ts` with `memoryFsAdapter` +
  `inMemoryLockFactory`):
  - Win path: play a full game to completion; assert
    `state.json` contains the achievement with `unlockedAt` set,
    `stats.<difficulty>.totalWins === 1`, and
    `stats.<difficulty>.totalPlays === 1`.
  - Win path with 0 qualifying achievements: assert
    `unlockedAchievements` is `[]` and the state is still written
    (`totalWins += 1`, no new achievement).
  - Quit mid-game (not won): assert `saves/<id>.json` exists,
    `state.json#lastSaveId` matches, and
    `stats.<difficulty>.totalPlays === 1` (the game was
    started; `totalWins` unchanged).
  - **NEW in v1.2.0:** fresh game → fresh game → assert
    `totalPlays === 2`, `totalWins === 0` (decision 17:
    `totalPlays` increments on every fresh game).
  - **NEW in v1.2.0:** fresh game → resume-last → solve
    → assert `totalPlays === 1` (resume did NOT increment),
    `totalWins === 1` (the win is real).
  - **NEW in v1.2.0:** resume-last → quit mid-game (without
    solving) → assert `totalPlays` still unchanged (no double
    counting).
  - `playCommand({ loadId })`: assert the restored state matches
    the saved state.
  - `playCommand({ resumeLast: true })` with a prior save: loads
    the right id.
  - `playCommand({ resumeLast: true })` with no prior save: returns
    `play_exit: error` with `message: /No saved games/`.
  - Save failure: mock `fs.writeFile` to throw; assert `play_exit:
    error` and that the TUI cleanup was still called.
  - **NEW in v1.2.0:** lock-busy: mock `LockFactory.acquire` to
    return `{ ok: false, reason: 'busy' }`; assert
    `play_exit: error` with `message: /state file is busy/`, exit
    `2` after dispatcher.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/commands/play.test.ts && pnpm test:coverage` (100% on
  `src/commands/play.ts` preserved).
- **Depends on:** Steps 1.5.1, 1.5.2, 1.5.3, 1.5.4, 2.5.1, 3.5.1,
  3.5.2, 9.
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `analyze-complexity` (`playCommand` now has more branches —
    assert complexity stays ≤ 16), `sec-sast` (catch any
    path-traversal in `loadId`), `code-validate`.
  - **Optional specialists:** `analyzer` if complexity on
    `playCommand` exceeds threshold.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-08, G-22).
    - `pnpm test src/commands/play.test.ts` exits `0` (existing
      6 cases + 8 new cases for v1.2.0 = 14 total).
    - `pnpm test:coverage` shows 100% on
      `src/commands/play.ts` (extended surface, same gate).
    - `sec-sast` reports 0 findings.
    - JSDoc on the new `options.loadId`, `options.resumeLast`,
      `deps.persistence`, `deps.lock` (G-19).
    - The `playCommand` function remains pure (no `process.*`
      calls; all I/O is injected via `deps`).
    - The counter semantics are documented inline: a comment
      above the `mode: 'start'` call cites decision 17, and a
      comment above the `mode: 'win'` call does the same.

---

### Phase 5.6: One-shot commands + table renderer

> Three one-shot commands + the `format/table` helper. They never
> enter the TUI — they read state and print to stdout.

#### Step 5.6.1 — `src/format/table.ts` + tests

- **Files touched:**
  - `src/format/table.ts` (add).
  - `src/format/table.test.ts` (add).
- **Action:** Add
- **Description:** Pure module. No I/O. Exports:
  - `Column` interface:
    `{ readonly header: string; readonly align: 'left' | 'right';
    readonly width?: number }`.
  - `Row` type: `readonly string[]`.
  - `formatTable(columns: readonly Column[], rows: readonly Row[]):
    string` — pure. Pads columns to the widest cell (or
    `width` if specified), applies `align`. Returns a single
    multi-line string with a header row, a separator row of
    dashes, and one row per data row. No leading or trailing
    newline.
  - `displayWidth(s: string): number` — counts display cells
    (full-width CJK = 2, everything else = 1; emoji = 2). This
    is a tiny implementation: iterate code points, use a small
    lookup of ranges (`0x1100..0x115F`, `0x2E80..0x303E`,
    `0x3041..0x33FF`, `0x3400..0x4DBF`, `0x4E00..0x9FFF`,
    `0xA000..0xA4CF`, `0xAC00..0xD7A3`, `0xF900..0xFAFF`,
    `0xFE30..0xFE4F`, `0xFF00..0xFF60`, `0xFFE0..0xFFE6`,
    `0x20000..0x2FFFD`, `0x30000..0x3FFFD`). Plus an emoji
    range (`0x1F300..0x1FAFF`, `0x2600..0x27BF`).
  - JSDoc on every export (G-19). Module-level comment
    referencing G-20 (no `string-width` dep).
- **Tests** (`table.test.ts`):
  - 1 Vitest snapshot: 3 columns (mixed align), 5 rows of
    varying length.
  - 1 Vitest snapshot: empty rows array (only header +
    separator).
  - 1 Vitest snapshot: column with explicit `width` shorter
    than the header (header truncated).
  - `displayWidth('hello')` → 5.
  - `displayWidth('héllo')` → 5 (combining marks counted as 1).
  - `displayWidth('日本語')` → 6.
  - `displayWidth('🏆')` → 2.
  - `formatTable` returns a string with no leading/trailing
    newline.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/format/table.test.ts && pnpm test:coverage` (100% on
  `src/format/table.ts`).
- **Depends on:** —
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `code-validate`.
  - **Optional specialists:** `analyzer` if `displayWidth` is
    too complex (it should not be — it's a small loop).
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-04, G-08, G-22).
    - `pnpm test src/format/table.test.ts` exits `0` (8+
      cases).
    - `pnpm test:coverage` shows 100% on
      `src/format/table.ts`.
    - JSDoc on every export (G-19).
    - **No new runtime dep** for `displayWidth` (G-20).

#### Step 5.6.2 — `src/commands/play-stats.ts` + `play-achievements.ts` + tests

- **Files touched:**
  - `src/commands/play-stats.ts` (add).
  - `src/commands/play-achievements.ts` (add).
  - `src/commands/__tests__/play-stats.test.ts` (add).
  - `src/commands/__tests__/play-achievements.test.ts` (add).
- **Action:** Add
- **Description:** Two pure commands. No I/O (all state is
  injected via `deps`).
  - `playStatsCommand(deps?: { fs: FsAdapter; statePath: string
    }): Promise<CommandResult>` — returns
    `{ kind: 'play_stats', stats: PerDifficultyStats, totalPlays:
    number, totalWins: number, lines: readonly string[] }`. The
    `lines` field is the machine-parseable stdout (one
    `key=value` per line, stable order).
  - `playAchievementsCommand(deps?: { fs: FsAdapter; statePath:
    string }): Promise<CommandResult>` — returns
    `{ kind: 'play_achievements', unlocked: readonly
    UnlockedAchievement[], locked: readonly LockedAchievement[],
    definitions: readonly AchievementDefinition[], lines: readonly
    string[] }`. The `lines` field is the machine-parseable
    stdout (`unlocked: <id>@<iso-date>` per line, then
    `locked: <id>` per line).
  JSDoc on every export (G-19).
- **Tests**:
  - `playStatsCommand` returns the expected shape given a fixture
    state (all 5 difficulties present, totals correct).
  - `playStatsCommand` on missing state file returns a default
    state (zeros).
  - `playStatsCommand.lines` has exactly 5 lines for 5
    difficulties, in a stable order (novice, easy, normal, hard,
    expert).
  - `playAchievementsCommand` returns all 11 achievements, with
    exactly the unlocked ones having `unlockedAt` set.
  - `playAchievementsCommand.unlocked` is sorted by `unlockedAt`
    desc; `locked` is sorted by id asc.
  - `playAchievementsCommand.lines` starts with `unlocked:` for
    each unlocked achievement and `locked:` for each locked.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/commands/__tests__/play-stats.test.ts && pnpm test
  src/commands/__tests__/play-achievements.test.ts && pnpm
  test:coverage` (100% on both files).
- **Depends on:** Step 1.5.1 (state.ts), Step 1.5.3 (achievements.ts).
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-04, G-08).
    - `pnpm test` exits `0` (8+ new cases).
    - `pnpm test:coverage` shows 100% on
      `src/commands/play-stats.ts` and
      `src/commands/play-achievements.ts`.
    - The `lines` field order is documented and stable (G-07:
      no surprise reordering on subsequent runs).

#### Step 5.6.3 — `src/commands/play-leaderboard.ts` + tests

- **Files touched:**
  - `src/commands/play-leaderboard.ts` (add).
  - `src/commands/__tests__/play-leaderboard.test.ts` (add).
- **Action:** Add
- **Description:** Pure command.
  - `playLeaderboardCommand(deps?: { fs: FsAdapter; statePath:
    string }, options?: { top?: number }): Promise<CommandResult>` —
    default `top: 5`. Returns
    `{ kind: 'play_leaderboard', entries: readonly
    LeaderboardEntry[], lines: readonly string[] }` where each
    entry is `{ difficulty, bestTimeMs: number | null, fewestMoves:
    number | null, winsAtBest: number }`. The `lines` field is the
    table rendered via `formatTable` (one line per entry, with
    header + separator).
  - Pure sort: entries are sorted by `bestTimeMs` asc (nulls
    last), then by `fewestMoves` asc (nulls last).
  JSDoc on every export (G-19).
- **Tests**:
  - Returns at most `top` rows per difficulty.
  - Sorted by best time asc, then fewest moves asc.
  - Nulls (no wins yet) appear at the bottom of each
    difficulty's section.
  - On missing state file, returns an empty `entries` array
    (with header + separator only).
  - `lines` has the expected `formatTable` shape (one line per
    entry + header + separator).
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/commands/__tests__/play-leaderboard.test.ts && pnpm
  test:coverage` (100% on the new file).
- **Depends on:** Steps 1.5.1, 5.6.1, 5.6.2.
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0` (G-04, G-08).
    - `pnpm test` exits `0` (5+ new cases).
    - `pnpm test:coverage` shows 100% on
      `src/commands/play-leaderboard.ts`.
    - The `lines` field uses `formatTable` (no inline string
      formatting; consistent with Step 5.6.1).

---

### Phase 6: Args + dispatcher

#### Step 10 — Extend `src/args.ts` for the `play` subcommand

- **Files touched:**
  - `src/args.ts` (modify).
  - `src/__tests__/args.test.ts` (modify — add `describe('play',
    ...)` block).
- **Action:** Modify
- **Description:**
  - Add `'play'` to the `Subcommand` type.
  - Add `{ kind: 'play'; difficulty: string | undefined }` to
    `ParsedArgs`.
  - Add `case 'play':` in `parseArgs` calling `parsePlayArgs`.
  - Add `parsePlayArgs(rest: readonly string[]): ParsedArgs`
    using `util.parseArgs` with options:
    ```ts
    {
      difficulty:    { type: 'string' },
      load:          { type: 'string' },
      'resume-last': { type: 'boolean' },
      stats:         { type: 'boolean' },
      achievements:  { type: 'boolean' },
      leaderboard:   { type: 'boolean' },
      help:          { type: 'boolean', short: 'h' },
    }
    ```
    `allowPositionals: false`, `strict: true`. Reject combinations
    (e.g., `--stats` + `--load` → error). On `-h`/`--help` return
    `{ kind: 'help' }`. On any error, return `{ kind: 'error',
    message: errorMessage(cause) }`. On success, return one of:
    - `{ kind: 'play_tui', difficulty?, loadId?, resumeLast? }`
      (default — no flag).
    - `{ kind: 'play_stats' }` (if `--stats`).
    - `{ kind: 'play_achievements' }` (if `--achievements`).
    - `{ kind: 'play_leaderboard', top? }` (if `--leaderboard`).
  - Extend `HELP_TEXT` with a `play` command line, the new flag
    descriptions, a Keybindings section (Q-5 confirmed), and
    exit codes (Q-1 + Q-3 confirmed).
- **Tests** in `src/__tests__/args.test.ts`:
  - `parseArgs(['play'])` → `{ kind: 'play', difficulty:
    undefined }`.
  - `parseArgs(['play', '--difficulty', 'hard'])` → `{ kind:
    'play', difficulty: 'hard' }`.
  - `parseArgs(['play', '--difficulty'])` → `{ kind: 'error',
    message: /argument missing/ }`.
  - `parseArgs(['play', '--difficulty', 'insane'])` → `{ kind:
    'play', difficulty: 'insane' }` (validation deferred to
    `playCommand`; this matches the existing `new` pattern).
  - `parseArgs(['play', '-h'])` and `parseArgs(['play',
    '--help'])` → `{ kind: 'help' }`.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test
  src/__tests__/args.test.ts`
- **Depends on:** Step 3
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0`.
    - `pnpm lint` exits `0`.
    - `pnpm test src/__tests__/args.test.ts` exits `0` (5 cases per
      the step description).
    - JSDoc on `parsePlayArgs` (G-19).
    - `HELP_TEXT` extended with the `play` line + keybindings
      (Q-5 confirmed).

#### Step 11 — Extend `src/commands/result.ts`

- **Files touched:** `src/commands/result.ts` (modify);
  `src/__tests__/commands/result.test.ts` (modify).
- **Action:** Modify
- **Description:** Add to the `CommandResult` union a new variant:
  `{ kind: 'play_exit'; reason: 'quit' | 'won' | 'error';
  elapsedMs: number; moveCount: number }`. (Used by the unit
  tests in Step 9; the dispatcher in Step 12 also references
  it.)
- Update `src/__tests__/commands/result.test.ts` with a
  switch-exhaustiveness check (a default branch that calls
  `assertNever(result)` at the type level) to prove every
  variant is handled downstream.
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test`
- **Depends on:** Step 10
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0` (the exhaustiveness check via
      `assertNever` ensures every `CommandResult` variant is
      handled).
    - `pnpm lint` exits `0`.
    - `pnpm test` exits `0` (the new exhaustiveness test passes).
    - JSDoc on the new variant (G-19).

#### Step 12 — Wire `play` into `src/cli.ts`

- **Files touched:** `src/cli.ts` (modify).
- **Action:** Modify
- **Description:** Two changes, both small:
  1. Import: `import { playCommand } from './commands/play.js'`.
  2. In the `run()` switch, add:
     ```ts
     case 'play':
       return handlePlayResult(await playCommand(
         args.difficulty !== undefined ? { difficulty: args.difficulty } : {},
       ))
     ```
  3. In the `run()` switch, route the four `play` variants:
     ```ts
     case 'play_tui':
       return handlePlayResult(await playCommand(
         args.difficulty !== undefined ? { difficulty: args.difficulty } : {},
         args.loadId !== undefined ? { loadId: args.loadId } :
         args.resumeLast === true ? { resumeLast: true } : {},
       ))
     case 'play_stats':
       return handlePlayStatsResult(await playStatsCommand())
     case 'play_achievements':
       return handlePlayAchievementsResult(await playAchievementsCommand())
     case 'play_leaderboard':
       return handlePlayLeaderboardResult(await playLeaderboardCommand(
         args.top !== undefined ? { top: args.top } : {},
       ))
     ```
  4. Add four handler functions:
     - `handlePlayResult(result)`:
       - `reason: 'quit'` → `stdout('Goodbye.')` + return `0`.
       - `reason: 'won'`  → `stdout('You won!')` + return `0`.
       - `reason: 'error'` → `stderr(result.message ?? 'play failed')` + return `2`
         (**Q-1 confirmed** — exit `2`, consistent with `new`).
     - `handlePlayStatsResult(result)`:
       - `result.lines` (machine-parseable) → `stdout(...)` + return `0`.
       - Any error → `stderr(result.message)` + return `2`.
     - `handlePlayAchievementsResult(result)`:
       - `result.lines` → `stdout(...)` + return `0`.
       - Any error → `stderr(...)` + return `2`.
     - `handlePlayLeaderboardResult(result)`:
       - `result.lines` → `stdout(...)` + return `0`.
       - Any error → `stderr(...)` + return `2`.
  5. Also update `handleResult` (or the new helper) to be
     exhaustively typed over `CommandResult` (a `default` branch
     with `assertNever`).
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test`
- **Depends on:** Step 11
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-typecheck`, `code-lint`,
    `code-validate`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0` (the `assertNever` default
      branch guarantees exhaustiveness).
    - `pnpm lint` exits `0`.
    - `pnpm test` exits `0`.
    - JSDoc on `handlePlayResult` (G-19).
    - The error-path exit code is `2` (Q-1 confirmed).

---

### Phase 7: Programmatic API

#### Step 13 — Re-export from `src/index.ts`

- **Files touched:** `src/index.ts` (modify).
- **Action:** Modify
- **Description:** Add to the public API:
  ```ts
  export { playCommand, type PlayOptions, type PlayCommandResult, type PlayExitReason, type PlayIO } from './commands/play.js'
  export { type CellPosition, type Move, type GameState, type GameStatus, createGame, applyMove, isWon, undo, isReadOnly } from './game/state.js'
  export { parseKeypress, renderGame, applyKey, formatTime, KEYBINDINGS, type ParsedKey } from './tui.js'
  export { shouldEnableColors } from './format/colors.js'
  ```
- **Do not** re-export `picocolors` (let embedders depend on it
  themselves) or any `@hackettyam/sudoku-tools` symbols (existing
  project rule).
- **Validation:** `pnpm lint && pnpm typecheck && pnpm build:types`
- **Depends on:** Steps 9, 12
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `docs-api` (validates the public
    API surface), `docs-jsdoc` (G-19 enforcement), `code-typecheck`,
    `code-lint`.
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `pnpm typecheck` exits `0` (the re-exports compile).
    - `pnpm lint` exits `0`.
    - `pnpm build:types` produces a valid `dist/index.d.ts`.
    - `docs-jsdoc` reports 0 missing `@param` / `@returns` /
      `@example` on the new exports (G-19).
    - **Do not** re-export `picocolors` or any
      `@hackettyam/sudoku-tools` symbol (project rule).

---

### Phase 8: Docs

#### Step 14 — Update `README.md`

- **Files touched:** `README.md` (modify).
- **Action:** Modify
- **Description:** Add a new `### sudoku-cli play` section after
  the `hint` section, before `## Board format`. Content:
  - One-line description: "Play a Sudoku puzzle interactively in
    your terminal."
  - Usage example: `sudoku-cli play`, `sudoku-cli play --difficulty
    hard`.
  - Keybindings table (copy from `plan.md` §"Keybindings" with
    column renames for README flow).
  - ASCII layout block (the sample frame from `plan.md` §
    "Rendering" — without the `<!-- cursor -->` comment).
  - "Exit codes" line: `0` quit or won, `2` unparseable difficulty.
  - A "TTY required" note: "`play` needs an interactive terminal;
    piping to `cat`, `less`, or any non-TTY target will fail with
    exit code 2."
  - Update the intro's "Zero runtime dependencies" line: change
    to "Zero runtime dependencies beyond `@hackettyam/sudoku-tools`
    and `picocolors` (the latter for terminal colors)."
- Also add a `play` line to the top-level help extract near the
  top of the README.
- **Validation:** `pnpm build` (README is shipped).
- **Depends on:** Step 12
- **Agent owner:** `docs`
- **Delegation:**
  - **Primary agent:** `docs`
  - **Skills to load (in order):** `docs-api` (verifies the keybinding
    table matches `KEYBINDINGS`), `docs-drift` (verifies the ASCII
    layout matches the actual `renderGame` output), `docs-jsdoc`
    (G-19).
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - README's `### sudoku-cli play` section has: usage, keybinding
      table (Q-5), ASCII layout, exit codes (Q-1: `0` for quit/won,
      `2` for invalid difficulty / non-TTY), TTY-required note.
    - `docs-drift` reports 0 drift between README and code.
    - Intro's "Zero runtime dependencies" line updated to mention
      `picocolors`.

---

### Phase 8.5: Docs additions (persistence + gamification)

> Tier 1 docs (Phase 8) already landed. This phase adds the
> persistence + gamification sections.

#### Step 8.5.1 — README sections for save/resume/stats/achievements/leaderboard

- **Files touched:** `README.md` (modify).
- **Action:** Modify
- **Description:** Add the following sections after the existing
  `### sudoku-cli play` block:
  - `### Persistence` — explains `~/.sudoku-cli/state.json` and
    `saves/<uuid>.json`, mentions `$XDG_STATE_HOME` fallback, the
    `0o700` perms (G-S07), how to back up the directory.
  - `### Save and resume` — `play --load <id>`, `play
    --resume-last`, the short-id format, an example session showing
    a quit + resume flow.
  - `### Stats` — `play --stats` output (one line per difficulty,
    plus totals). Example output for a mid-game state.
  - `### Achievements` — the 11 achievements in a table, the tier
    they belong to, the unlock condition. Includes a note about
    idempotency ("unlocking twice does nothing").
  - `### Leaderboard` — `play --leaderboard` output, columns
    (difficulty · best time · fewest moves · wins), `--top` flag.
  Update the intro's "Zero runtime dependencies" line to also note
  "local-only persistence (no network, no telemetry)".
  Update the "Known library gaps" section in `AGENTS.md` (or
  README) to reflect the new persistence layer (no longer needed
  for `--seed`).
- **Validation:** `pnpm build` (README is shipped).
- **Depends on:** Step 14.
- **Agent owner:** `docs`
- **Delegation:**
  - **Primary agent:** `docs`
  - **Skills to load (in order):** `docs-api` (verifies the API
    surface in the docs matches the code), `docs-drift` (ensures
    the example output matches `formatTable` and the `lines`
    field), `docs-jsdoc` (G-19).
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `docs-drift` reports 0 drift between README and code.
    - Each new section has at least one code example.
    - The "Persistence" section explains the `0o700` perms (G-S07
      documentation).
    - The "Privacy" note is present (G-S01 + R-13).

---

### Phase 9: Build verification

#### Step 15 — Full CI gate

- **Files touched:** none (verification only).
- **Action:** Verify
- **Description:** Run the full gate suite in this order:
  ```bash
  pnpm install
  pnpm typecheck
  pnpm lint
  pnpm test:coverage   # expect 100% lines/statements/functions
  pnpm build           # produces dist/cli.js
  ```
- **Acceptance criteria:**
  - [ ] `pnpm typecheck` exits `0`.
  - [ ] `pnpm lint` exits `0` (no warnings).
  - [ ] `pnpm test:coverage` shows 100% lines / statements /
        functions, branch not enforced, on all non-excluded
        files. Excluded: `src/cli.ts`, `src/index.ts`,
        `src/**/__tests__/**`, `src/**/*.test.ts`.
  - [ ] `pnpm build` produces `dist/cli.js` (a single
        self-contained file with a `#!/usr/bin/env node` shebang)
        and `dist/index.d.ts` (a single d.ts file plus per-module
        d.ts files in `dist/commands/`, `dist/game/`, `dist/
        format/`, `dist/tui.d.ts`, `dist/output.d.ts`,
        `dist/args.d.ts`).
  - [ ] The new `dist/cli.js` is ≤ 40 kB (was ~25 kB; +`picocolors`
        ≤ 6 kB, +TUI code ≤ 9 kB).
  - [ ] `node -e "import('@hackettyam/sudoku-cli').then(m =>
        console.log(typeof m.playCommand))"` prints `function`.
- **Validation:** self-evident (gate output).
- **Depends on:** Steps 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14
- **Agent owner:** `code` (CI run) + `security` (sign-off per the
  G-S04 dep audit).
- **Delegation:**
  - **Primary agent:** `code` (runs the CI gate) + `security` (sign-off).
  - **Skills to load (in order):** `code-validate` (runs the full
    gate in order: `pnpm install` → `typecheck` → `lint` → `test:
    coverage` → `build`), `perf-bundle` (measures `dist/cli.js`
    size), `sec-deps` (`pnpm audit --prod`), `commit-generation`
    (drafts the final commit message).
  - **Optional specialists:** `performance` if the bundle exceeds
    the 45 kB target.
  - **Quality gates for this step:**
    - All five commands exit `0`.
    - `pnpm test:coverage` shows 100% on all non-excluded files.
    - `dist/cli.js` exists, has a shebang, is ≤ 45 kB.
    - `pnpm audit` reports 0 vulnerabilities (G-S04/G-S05).
    - `node -e "import('@hackettyam/sudoku-cli').then(m =>
      console.log(typeof m.playCommand))"` prints `function`.

---

### Phase 9.5: Security post-check on persistence

> `security` agent reviews the new persistence modules before merge.
> Mandatory per the standard workflow (`spec → ... → security → ... →
> USER`).

#### Step 9.5.1 — `sec-scan` + `sec-secrets` + `sec-sast` on `src/persistence/*.ts`

- **Files touched:** none (verification only).
- **Action:** Verify
- **Description:** Run the security agent's checks on the new
  persistence surface:
  1. `sec-scan src/persistence/*.ts` — full scan (SAST + secrets +
     deps in one command).
  2. `sec-secrets src/persistence/*.ts` — must report 0 hits.
  3. `sec-sast src/persistence/*.ts` — must report 0 high-severity
     findings.
  4. `sec-deps` — a no-op (no new runtime deps) but recorded for
     the audit trail.
  5. Manual review of:
     - File permission `0o700` on the dir, `0o600` on the files
       (G-S07). Verified by a unit test (Step 1.5.1) and a manual
       `ls -ld ~/.sudoku-cli/`.
     - Atomic write correctness: a test simulates a crash
       mid-write (Step 1.5.1) and asserts the original is not
       corrupted.
     - Path traversal: `saveId` is generated by
       `crypto.randomUUID()`, never from user input. `loadGame`
       rejects ids that don't match the UUID v4 regex
       (`validateSaveId`, Step 1.5.2).
     - State file size: hard-cap at 1 MiB; reject larger files
       (defense in depth). The unit test in Step 1.5.1 covers
       this.
- **Acceptance criteria:**
  - [ ] `pnpm audit` reports 0 vulnerabilities.
  - [ ] `sec-scan` exit `0`.
  - [ ] `sec-secrets` reports 0 hits on `src/persistence/*.ts`.
  - [ ] `sec-sast` reports 0 high-severity findings.
  - [ ] All G-S01..G-S08 boxes ticked in the plan's §Quality Gates.
- **Validation:** self-evident (gate output).
- **Depends on:** Steps 1.5.1, 1.5.2, 1.5.3, 5.5.1, 5.6.1, 5.6.2,
  5.6.3, 8.5.1.
- **Agent owner:** `security`
- **Delegation:**
  - **Primary agent:** `security`
  - **Skills to load (in order):** `security-enforce` (the master
    pre/post-check orchestrator), `sec-scan` (full SAST + secret
    + dep scan), `sec-secrets` (G-S01), `sec-sast` (G-S03 +
    input validation), `sec-deps` (G-S04 + G-S05), `sec-audit`
    (final audit log entry).
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - `sec-scan` exits `0`.
    - `sec-secrets` exits `0` with no findings.
    - `sec-sast` exits `0` with no high-severity findings.
    - `pnpm audit` exits `0` (0 vulnerabilities).
    - The audit log entry is recorded in
      `~/.config/opencode/memory/audit.log` (per `sec-audit`).
    - The `security` agent signs off on the PR (label:
      `security-approved`).

---

### Phase 10: Manual smoke test

#### Step 16 — End-to-end TUI smoke

- **Files touched:** none.
- **Action:** Manual verify
- **Description:** Run the bundled bin in a real terminal:
  ```bash
  pnpm build
  node dist/cli.js play --difficulty easy
  ```
- Smoke checklist (each must be observed during a 2-minute
  session):
  - [ ] Alt screen engages; cursor disappears; previous shell
        output is preserved on the hidden buffer.
  - [ ] 9x9 grid renders with box separators; clues are bold;
        empty cells show dim `.`.
  - [ ] Arrow keys move the cursor; cursor stays on the board
        (no wrap).
  - [ ] Typing `5` on an empty cell places `5`; typing `0` clears
        it; trying to type on a clue cell does nothing.
  - [ ] Typing `h` on an empty cell places the correct value.
  - [ ] Typing `u` undoes the last placement.
  - [ ] Typing `q` restores the terminal (alt screen leaves,
        cursor visible, prompt on a fresh line) and exits with
        code `0`.
  - [ ] Pressing Ctrl+C restores the terminal and exits with
        code `130` (verify with `echo $?`).
  - [ ] `NO_COLOR=1 node dist/cli.js play` produces the same
        output minus color/background escapes.
  - [ ] `node dist/cli.js play --difficulty insane` exits with
        code `2` and a clear error message.
  - [ ] `node dist/cli.js play --help` prints the play-specific
        help text.
  - [ ] `node dist/cli.js | cat` (non-TTY stdout) immediately
        exits with code `2` and a "requires an interactive
        terminal" error.
- If any item fails, open a follow-up issue and re-run the
  relevant unit test (most have a TTY-only path the smoke
  catches).
- **Depends on:** Step 15
- **Agent owner:** `code`
- **Delegation:**
  - **Primary agent:** `code`
  - **Skills to load (in order):** `code-validate` (the TUI runs in a
    real terminal; the build must already be green), `analyze-tech-debt`
    (records any manual-smoke-only findings as tech-debt entries).
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - All 12 smoke items from Step 16 pass on a real terminal
      (Linux and macOS).
    - The terminal is fully restored after each exit (alt screen
      leaves, cursor visible, prompt on a fresh line).
    - The exit code for `q` is `0`; for Ctrl+C is `130`; for
      `--difficulty insane` is `2`.

---

### Phase 10.5: Memory recording

> `memory` agent records the decisions and patterns learned. The
> `memory` agent is the sole context provider for future agents
> (G-CTX-01), so these records will inform subsequent planifications
> in this project.

#### Step 10.5.1 — `memory-adr` + `memory-record` + `memory-pattern`

- **Files touched:**
  - `<project>/.opencode/memory/decisions/2026-06-19-why-sudoku-cli-state-location.md`
    (add).
  - `<project>/.opencode/memory/patterns/fs-adapter-injection.md`
    (add).
  - `<project>/.opencode/memory/patterns/atomic-write-tmp-rename.md`
    (add).
  - `<project>/.opencode/memory/patterns/pure-achievement-evaluator.md`
    (add).
  - `<project>/.opencode/memory/context.json` (update — add this
    workflow's state).
- **Action:** Add
- **Description:** Run the memory agent's recording skills:
  1. **`memory-adr --create --title "Why ~/.sudoku-cli/ for state and saves (no SQLite, no XDG default)"`**:
     - Context: user wants save/resume + per-difficulty stats + 11
       achievements.
     - Alternatives considered: SQLite (rejected: native dep,
       G-20), XDG default everywhere (rejected: complicates
       macOS/Windows where `~/` is conventional), one-file-per-save
       + a `saves/` dir (accepted).
     - Decision: `~/.sudoku-cli/state.json` + `~/.sudoku-cli/saves/`
       (with `$XDG_STATE_HOME/sudoku-cli/` as fallback), 1 MiB
       hard cap, `0o700` perms, atomic write.
     - Consequences: easy to back up, easy to inspect, no native
       deps; concurrent writers are last-writer-wins (R-11).
  2. **`memory-record --type pattern --content "FsAdapter injection for testable persistence"`**:
     - Captures the decision to abstract file I/O behind a tiny
     interface so persistence modules can be unit-tested with
     an in-memory `Map`. This is the same pattern as `PlayIO` in
     the TUI.
  3. **`memory-record --type pattern --content "Atomic write via tmp + fs.rename"`**:
     - Captures the tmp+rename pattern. Already in the standard
     Node docs; this is the first time we used it in this repo.
  4. **`memory-record --type pattern --content "Pure achievement evaluator"`**:
     - Captures the design: evaluator is a pure function over
     `(difficulty, elapsedMs, moveCount, hintCount, undoCount,
     errors, perDifficultyWins, difficultiesWon)`; the play
     command calls it on win; `unlockAchievements` is the
     idempotent write site.
  5. **`memory-pattern --catalog`** for the three patterns above
     (Rule of Three: each is used in one place, but worth
     surfacing for future projects).
  6. Update `context.json` with the workflow state: status
     `Implemented` (after Step 9.5.1's `sec-scan` pass), final
     `dist/cli.js` size, `pnpm audit` result, etc.
- **Acceptance criteria:**
  - [ ] ADR file exists at the path above with full context +
        alternatives + consequences.
  - [ ] Three `memory-pattern` entries exist.
  - [ ] `context.json` reflects the implemented state.
  - [ ] `memory-record` shows ≥ 4 entries for this workflow.
- **Validation:** `ls
  <project>/.opencode/memory/decisions/2026-06-19-*` returns the
  ADR; `ls <project>/.opencode/memory/patterns/` returns the
  three new patterns.
- **Depends on:** Steps 9.5.1, 10 (Phase 10 manual smoke).
- **Agent owner:** `memory`
- **Delegation:**
  - **Primary agent:** `memory`
  - **Skills to load (in order):** `memory-adr` (create the ADR),
    `memory-record` (log the patterns), `memory-pattern`
    (catalog them), `memory-context` (update `context.json`).
  - **Optional specialists:** none.
  - **Quality gates for this step:**
    - The ADR is referenced by at least one future workflow
      (G-CTX-06: decisions are findable).
    - The three patterns are categorized with a clear
      `use-when:` clause.
    - `context.json` is updated atomically (no torn writes —
      same `tmp + rename` pattern as the state file).

---

## 🧪 Test Cases (consolidated)

| Test file | Group | Description |
|-----------|-------|-------------|
| `src/__tests__/format/colors.test.ts` | `shouldEnableColors` | All 5 env/TTY combinations; plus an integration check that `colors.red('x')` returns `'x'` when disabled. |
| `src/format/table.test.ts` | `formatTable` | 3 Vitest snapshots: 3-col mixed-align, empty rows, explicit width. |
| `src/format/table.test.ts` | `displayWidth` | ASCII (1), combining marks (1), CJK (2), emoji (2). |
| `src/persistence/state.test.ts` | `loadState` | Missing file (default), valid file, corrupt (throws `StateCorruptError`), wrong version (throws `StateVersionError`). |
| `src/persistence/state.test.ts` | `saveState` | Atomic write (tmp + rename), auto-create dir with `0o700`, simulated crash mid-write. |
| `src/persistence/state.test.ts` | `mergeStats` | Increment wins, update best time if faster, update fewest moves if fewer. |
| `src/persistence/state.test.ts` (v1.2) | `loadState` / `saveState` | Acquire + release the injected `LockFactory` (mock: exactly 1 acquire + 1 release per call). |
| `src/persistence/state.test.ts` (v1.2) | `mergeStats` (modes) | `mode: 'start'` increments `totalPlays` by 1 + sets `lastPlayedAt`. `mode: 'win'` increments `totalWins` by 1 + updates `bestTimeMs` / `fewestMoves` if better. Both modes leave the *other* counter unchanged. |
| `src/persistence/state.test.ts` (v1.2) | `lock-busy` | Returns `Result.err(StateLockBusyError)` on busy lock; never throws. |
| `src/persistence/lock.test.ts` (v1.2) | `nodeLockFactory` | Happy path (acquire → `{ ok: true, handle }`, release → held=0), busy path (second acquire returns `'busy'`), timeout path (retries exhausted returns `'timeout'`), integration test against a tmp dir (lock file created/removed). |
| `src/persistence/__tests__/state-concurrent.test.ts` (v1.2) | multi-process | Two `node:child_process.fork` processes attempt simultaneous `loadState` → `mergeStats` → `saveState`; final `state.json` is consistent (no lost updates). The test is **flaky-safe**: it retries up to 3 times if a CI race shows up. |
| `src/persistence/state.test.ts` | `unlockAchievements` | Idempotent: calling twice with the same id does not change `unlockedAt`. |
| `src/persistence/save.test.ts` | `saveGame` | Round-trip, UUID v4 id assignment, writes to `saves/<id>.json`. |
| `src/persistence/save.test.ts` | `loadGame` | Missing id (`SaveNotFoundError`), corrupt JSON (`SaveCorruptError`), version mismatch (`SaveVersionError`). |
| `src/persistence/save.test.ts` | `listSaves` | One summary per save file. |
| `src/persistence/save.test.ts` | `latestSaveId` | Returns the most recent id, or `null`. |
| `src/persistence/save.test.ts` | `validateSaveId` | Accepts UUIDs, rejects path traversal. |
| `src/persistence/achievements.test.ts` | `ACHIEVEMENTS` | Frozen check; 11 entries. |
| `src/persistence/achievements.test.ts` | `evaluateAchievements` | Table-driven: 11 × 2 cases (unlocked + not unlocked) covering boundary conditions. |
| `src/persistence/achievements.test.ts` | `evaluateAchievements` | Returns multiple ids when multiple conditions are satisfied. |
| `src/game/state.test.ts` | `createGame` | Initial state shape; readOnly mask correctness. |
| `src/game/state.test.ts` | `applyMove` | One test per `Move` variant × at least 2 states (playing, won, quit). |
| `src/game/state.test.ts` | `applyMove` (v1.1) | New: `hint` increments `hintCount` and adds to `history`; `undo` increments `undoCount` only if history non-empty. |
| `src/game/state.test.ts` | `isWon` | True at win, false otherwise. |
| `src/game/state.test.ts` | `undo` | Empty history no-op; multi-step rollback. |
| `src/game/state.test.ts` | `isReadOnly` | True for clues, false for empties. |
| `src/game/state.test.ts` | `getStats` (v1.1) | Returns `{ elapsedMs, moveCount, hintCount, undoCount, errorCount }`. |
| `src/tui.test.ts` | `parseKeypress` | Table-driven: one case per documented escape sequence + invalid sequences. |
| `src/tui.test.ts` | `renderGame` | 3 Vitest snapshots (initial, mid-game, win) + non-color assertion. |
| `src/tui.test.ts` | `formatTime` | Boundary values: 0, 1 min, 1 hr. |
| `src/tui.test.ts` | `applyKey` | One case per `ParsedKey` variant. |
| `src/tui.test.ts` | `KEYBINDINGS` | Frozen check + length sanity. |
| `src/tui.test.ts` (v1.1) | `renderWinBanner` | 2 snapshots: 0 achievements, 3 achievements. |
| `src/tui.test.ts` (v1.1) | `renderSavePrompt` | 1 snapshot with a deterministic UUID. |
| `src/tui.test.ts` (v1.1) | `formatShortId` | First 8 chars of UUID; non-UUID is defensive. |
| `src/tui.test.ts` (v1.2) | `renderAchievementInline` | 3 snapshots: `[]` → `★ no new achievements`, `['x']` → `★ +1: x`, multiple ids → `★ +N: ...`. Plus 2 unit tests: empty string when `colors` disabled **and** non-TTY; uncolored text when `colors` disabled **and** TTY. |
| `src/tui.test.ts` (v1.2) | `renderAchievementDetail` | 1 dismissable snapshot (3 achievements, full ANSI, TTY mode). 1 non-TTY snapshot (no colors, ASCII icons). 1 unit test: `ACHIEVEMENT_RARITY` is frozen + has 11 keys + valid values. 1 unit test: `screenWidth({})` returns 80. |
| `src/tui.test.ts` (v1.2) | `renderTrophyArt` | 1 unit test: returns 3-4 lines. 1 unit test: TTY=true uses Unicode block; TTY=false uses ASCII. |
| `src/__tests__/output.tui.test.ts` | `runTuiSession` | Init sequence, key routing, idempotent cleanup, SIGINT, render throw. |
| `src/commands/play.test.ts` (v1.0) | `playCommand` | 6 cases: invalid difficulty, happy path, win, hint, undo, Ctrl+C. |
| `src/commands/play.test.ts` (v1.1) | `playCommand` | +6 cases: win writes achievements, quit writes save, `loadId` restores, `resumeLast` loads, no-save-on-empty, save failure is non-fatal. |
| `src/commands/play.test.ts` (v1.2) | `playCommand` (counters) | +3 cases (decision 17): fresh game → fresh game → `totalPlays=2`; fresh game → resume → solve → `totalPlays=1, totalWins=1`; resume → quit mid-game → `totalPlays` unchanged. |
| `src/commands/play.test.ts` (v1.2) | `playCommand` (lock) | +1 case (decision 18): lock-busy returns `play_exit: error` with `/state file is busy/`, exit `2` after dispatcher. |
| `src/commands/play.test.ts` (v1.2) | `playCommand` (`a` keypress) | +2 cases (decision 19): win → `a` → `view: 'achievements'`; `a` → any other key → `view: 'menu'`; `a` → `Esc` → `view: 'menu'` (not quit). |
| `src/commands/__tests__/play-stats.test.ts` (v1.1) | `playStatsCommand` | Default state, fixture state, missing file. |
| `src/commands/__tests__/play-achievements.test.ts` (v1.1) | `playAchievementsCommand` | Unlocked sorted desc, locked sorted asc, lines format. |
| `src/commands/__tests__/play-leaderboard.test.ts` (v1.1) | `playLeaderboardCommand` | Sorted by time then moves, nulls last, `top` flag. |
| `src/__tests__/args.test.ts` | `parseArgs('play')` | Default, --difficulty, -h, --help, error paths. |
| `src/__tests__/args.test.ts` (v1.1) | `parseArgs('play')` | +new: `--load <id>`, `--resume-last`, `--stats`, `--achievements`, `--leaderboard`, conflict rejection. |
| `src/__tests__/commands/result.test.ts` | `CommandResult` | Exhaustiveness check over the new `play_exit` variant. |
| `src/__tests__/commands/result.test.ts` (v1.1) | `CommandResult` | +3 variants: `play_stats`, `play_achievements`, `play_leaderboard`. |

---

## ✔️ Validation Checklist

| # | Check | Status |
|---|-------|:------:|
| 1 | Lint passes (`pnpm lint`) | ☐ |
| 2 | Typecheck passes (`pnpm typecheck`) | ☐ |
| 3 | All tests pass (`pnpm test`) | ☐ |
| 4 | 100% line / statement / function coverage on non-excluded files (`pnpm test:coverage`) | ☐ |
| 5 | Build succeeds and `dist/cli.js` is a single self-contained file with shebang (`pnpm build`) | ☐ |
| 6 | `dist/cli.js` is ≤ 75 kB (v1.2.0 budget; was ≤ 45 kB in v1.1.0; +~30 kB from `proper-lockfile`) | ☐ |
| 7 | `picocolors` and `proper-lockfile` are bundled in-line (no external runtime file deps) | ☐ |
| 8 | Security: no new CVEs in `picocolors@^1.1.0` or `proper-lockfile@^4.1.2` (`pnpm audit`) | ☐ |
| 9 | JSDoc complete on every new export (`@param`, `@returns`, `@example`) | ☐ |
| 10 | README has `### sudoku-cli play` section with keybinding table | ☐ |
| 11 | HELP_TEXT mentions `play` and its keybindings (Q-5 confirmed) | ☐ |
| 12 | No circular dependencies introduced (G-13) — verified by import-graph review | ☐ |
| 13 | `src/cli.ts` and `src/index.ts` remain the only coverage exclusions | ☐ |
| 14 | No `console.log`, no `any`, no non-null assertions in new code (G-02, G-03, G-07) | ☐ |
| 15 | All 12 smoke items from Step 16 pass on a real terminal | ☐ |
| 16 | `~/.sudoku-cli/` is created with `0o700` perms on first write (G-S07) | ☐ |
| 17 | Save on quit/Ctrl+C writes `saves/<uuid>.json` atomically | ☐ |
| 18 | Resume loads the same state (board, cursor, history, counters) | ☐ |
| 19 | Stats accumulate across runs (`read-modify-write` of `state.json`) | ☐ |
| 20 | Achievements unlock exactly once (idempotent) | ☐ |
| 21 | `play --stats`, `play --achievements`, `play --leaderboard` print to stdout in machine-parseable format and exit `0` | ☐ |
| 22 | Corrupt save file → exit `2` with a clear error (not a crash) | ☐ |
| 23 | `sec-scan`, `sec-secrets`, `sec-sast` on `src/persistence/*.ts` report 0 findings | ☐ |
| 24 | README has `### Persistence`, `### Save and resume`, `### Stats`, `### Achievements`, `### Leaderboard` sub-sections | ☐ |
| 25 | **NEW v1.2.0:** `stats.<difficulty>.totalPlays` increments by exactly 1 on fresh game; **does not** increment on `--load`/`--resume-last` (decision 17) | ☐ |
| 26 | **NEW v1.2.0:** `stats.<difficulty>.totalWins` increments by exactly 1 on `isWon` transition; idempotent (decision 17) | ☐ |
| 27 | **NEW v1.2.0:** Concurrent `play --stats` + TUI writes do not corrupt `state.json` (decision 18; verified by `state-concurrent.test.ts`) | ☐ |
| 28 | **NEW v1.2.0:** Win screen shows the inline achievement summary (`★ +<N>: ...`) (decision 19) | ☐ |
| 29 | **NEW v1.2.0:** Pressing `a` on the win screen enters the dismissable view; any key returns to the win menu (decision 19) | ☐ |
| 30 | **NEW v1.2.0:** Dismissable view shows full achievement details (title, description, rarity) + total progress (decision 19) | ☐ |
| 31 | **NEW v1.2.0:** All UI uses built-in ANSI + `picocolors` only — no new runtime deps for UI (decision 19; bundle budget still ≤ 75 kB excluding `proper-lockfile`) | ☐ |

---

## 📈 Expected Results

| Aspect | Before | v1.0.0 | v1.1.0 | v1.2.0 (target) |
|--------|--------|:------:|:------:|:---------------:|
| Subcommands | 4 | 5 (+`play`) | 5 (+4 flag variants) | 5 (unchanged) |
| Pure modules in `src/` | 6 | 9 | 13 (+`persistence/*`, `format/table`) | 14 (+`persistence/lock`) |
| Pure command modules in `src/commands/` | 5 | 6 (+`play`) | 9 (+`play`, +`play-stats`, +`play-achievements`, +`play-leaderboard`) | 9 (unchanged) |
| Persistent state | none | none | `~/.sudoku-cli/state.json` + `saves/<uuid>.json` | unchanged |
| Achievements | — | — | 11 | 11 (unchanged) |
| Estimated test count | 60 | ~95 | ~140 | ~165 (+25 for lock + dismissable + concurrent) |
| `dist/cli.js` size | ~25 kB | ~32 kB | ~40 kB | ~65-70 kB (+~30 kB `proper-lockfile`) |
| Bundle budget (max) | — | 45 kB | 45 kB | 75 kB |
| Runtime dependencies | 1 | 2 (+`picocolors`) | 2 (unchanged) | 3 (+`proper-lockfile`) |
| Coverage (lines) | 100% | 100% | 100% | 100% (unchanged gate) |
| End-user "play" use case | unsupported | interactive TUI | + save/resume + stats + achievements + leaderboard | + concurrent-safe state + dismissable achievement view + double-line win screen |
| Estimated effort (comfortable pace) | — | ~1.5 weeks | ~2.5-3.5 weeks | ~3-4 weeks |
| Estimated effort (sprint pace) | — | ~3-4 days | ~4-5 days | ~5-6 days |

---

## 💻 Commands Summary

| Command | Description |
|---------|-------------|
| `pnpm install` | Install deps (regenerates lock after Step 1 + Step 1.5.4a) |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript compiler |
| `pnpm test` | Run Vitest once (60 + new v1.2.0 cases ≈ 165 total) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:coverage` | Vitest with v8 coverage (gates at 100%; `proper-lockfile` excluded) |
| `pnpm build:types` | Emit `.d.ts` files only |
| `pnpm build:bundle` | Bundle `dist/cli.js` via esbuild (target ≤ 75 kB in v1.2.0) |
| `pnpm build` | `build:types` + `build:bundle` |
| `pnpm audit` | Security audit (G-S04/G-S05) |
| `node dist/cli.js play` | Smoke-test the bundled bin (TUI) |
| `node dist/cli.js play --difficulty easy` | Smoke-test specific difficulty |
| `NO_COLOR=1 node dist/cli.js play` | Smoke-test color-disabled path |
| `node dist/cli.js play --stats` | Smoke-test the stats one-shot |
| `node dist/cli.js play --achievements` | Smoke-test the achievements one-shot |
| `node dist/cli.js play --leaderboard --top 3` | Smoke-test the leaderboard one-shot |
| `node dist/cli.js play --resume-last` | Smoke-test resume (requires a prior save) |
| `node dist/cli.js play --load <id>` | Smoke-test load (requires the save id) |
| In the TUI, press `a` on the win screen | Smoke-test the dismissable achievement view (v1.2.0) |
| `ls -ld ~/.sudoku-cli/` | Verify the dir was created with `0o700` perms (G-S07) |
| `ls -l ~/.sudoku-cli/*.lock` | Verify the lock file is created next to `state.json` (v1.2.0) |
| `cat ~/.sudoku-cli/state.json` | Inspect the state file (human-readable JSON; `totalPlays` + `totalWins` + `lastPlayedAt` in v1.2.0) |
| `stat -c '%a' ~/.sudoku-cli/state.json` | Verify state file is `0o600` |

---

## 📚 Related Commits

| Date | Commit | Description |
|------|--------|-------------|
| — | — | Populated as work progresses. Each step should land as its own commit using Conventional Commits (G-L04), e.g. (v1.0.0) `feat(play): add picocolors runtime dep`, `feat(play): pure game state machine`, `feat(play): tui parser`, `feat(play): tui renderer with snapshots`, `feat(play): applyKey + keybindings`, `feat(play): output.runTuiSession helper`, `feat(play): playCommand orchestrator`, `feat(args): play subcommand`, `feat(play): wire into cli dispatcher`, `feat(play): programmatic api re-exports`, `docs(play): README + keybinding table`; (v1.1.0) `feat(persistence): FsAdapter + state.ts with atomic write`, `feat(persistence): save.ts with versioned JSON`, `feat(persistence): achievements.ts with 11 definitions`, `feat(game): extend GameState with hintCount, undoCount, id`, `feat(play): renderWinBanner + renderSavePrompt`, `feat(play): wire save/resume + achievements into playCommand`, `feat(format): ASCII table renderer with displayWidth`, `feat(play): stats one-shot command`, `feat(play): achievements one-shot command`, `feat(play): leaderboard one-shot command`, `feat(args): --load, --resume-last, --stats, --achievements, --leaderboard`, `feat(play): wire one-shot commands into cli dispatcher`, `docs(play): persistence + stats + achievements + leaderboard sections`, `chore(play): record ADRs and patterns to memory`; (v1.2.0) `feat(persistence): add proper-lockfile runtime dep`, `feat(persistence): lock factory + discriminated-union LockResult`, `feat(persistence): state.ts uses LockFactory via DI + Result return type`, `test(persistence): concurrent-write multi-process test`, `feat(persistence): PerDifficultyStats with totalPlays + totalWins + lastPlayedAt`, `feat(play): inline achievement summary on win banner`, `feat(play): dismissable achievement view + a keybinding + WinView sub-state`, `feat(play): modern UI guidelines (double-line borders, animations, icons)`, `docs(play): dismissable view + concurrent-safe state section`. |

---

## 📋 Final Results

**To be populated when the plan is implemented.**

**Files Modified (expected):**
- `package.json` — add `picocolors` dep.
- `src/args.ts` — add `play` subcommand + `parsePlayArgs` (with the
  new flags: `--load`, `--resume-last`, `--stats`, `--achievements`,
  `--leaderboard`).
- `src/output.ts` — add `runTuiSession` and supporting types.
- `src/cli.ts` — add `case 'play_*':` (4 variants) + 4 handler
  functions.
- `src/commands/result.ts` — add `play_exit`, `play_stats`,
  `play_achievements`, `play_leaderboard` variants.
- `src/index.ts` — re-export new public surface.
- `src/game/state.ts` — add `hintCount`, `undoCount`, `id` to
  `GameState`; `applyMove` increments counters; v1.2.0 also adds
  the `view: 'menu' | 'achievements'` WinView sub-state.
- `src/tui.ts` — add `renderWinBanner`, `renderSavePrompt`,
  `formatShortId`, `ACHIEVEMENT_GLYPHS`; v1.2.0 also adds
  `renderAchievementInline`, `renderAchievementDetail`,
  `renderTrophyArt`, `ACHIEVEMENT_RARITY`, `screenWidth`.
- `src/commands/play.ts` — wire persistence: `saveGame` on quit,
  `loadState` + `mergeStats` (with `mode: 'start' | 'win'`) +
  `unlockAchievements` on win; `loadId` / `resumeLast` options;
  v1.2.0 also handles the `a` keypress in the `Won` state.
- `src/persistence/state.ts` — v1.2.0: function signature uses
  `LockFactory` via DI and returns `Result<StateFile, StateError>`.
- `package.json` — add `picocolors` (v1.0.0) and `proper-lockfile`
  (v1.2.0) runtime deps. **Exactly 2 G-20 exceptions** (decisions
  6 + 18).
- `README.md` — document `play` + Persistence + Save/resume + Stats
  + Achievements + Leaderboard; v1.2.0 also adds a "Concurrent-safe
  state" note and a "Dismissable achievement view" walkthrough.
- `src/__tests__/args.test.ts` — add `play` describe block.
- `src/__tests__/commands/result.test.ts` — exhaustiveness check
  (4 new variants).
- `src/game/state.test.ts` — add cases for the new counters.
- `src/tui.test.ts` — add `renderWinBanner`, `renderSavePrompt`,
  `formatShortId` tests + snapshots; v1.2.0 also adds
  `renderAchievementInline`, `renderAchievementDetail`,
  `renderTrophyArt` tests + snapshots.
- `src/commands/play.test.ts` — add cases for save-on-quit + win
  with achievements + load/resume + save failure; v1.2.0 also adds
  counter semantics (decision 17) + lock-busy case (decision 18) +
  `a` keypress in `Won` state (decision 19).
- `pnpm-lock.yaml` — auto-regenerated.

**Files Created (expected):**
- `src/format/colors.ts` — color wrapper.
- `src/__tests__/format/colors.test.ts` — coverage.
- `src/format/table.ts` — ASCII table renderer.
- `src/format/table.test.ts` — coverage + displayWidth tests.
- `src/game/state.ts` — pure state machine.
- `src/game/state.test.ts` — coverage.
- `src/tui.ts` — pure TUI.
- `src/tui.test.ts` — coverage + snapshots.
- `src/commands/play.ts` — TUI orchestrator.
- `src/commands/play-stats.ts` — stats one-shot.
- `src/commands/play-achievements.ts` — achievements one-shot.
- `src/commands/play-leaderboard.ts` — leaderboard one-shot.
- `src/commands/__tests__/play-stats.test.ts` — coverage.
- `src/commands/__tests__/play-achievements.test.ts` — coverage.
- `src/commands/__tests__/play-leaderboard.test.ts` — coverage.
- `src/persistence/state.ts` — state.json + FsAdapter + atomic
  write (v1.2.0: also LockFactory via DI).
- `src/persistence/state.test.ts` — coverage.
- `src/persistence/lock.ts` — lock factory wrapping `proper-lockfile`
  (v1.2.0, decision 18).
- `src/persistence/lock.test.ts` — coverage (v1.2.0).
- `src/persistence/__tests__/state-concurrent.test.ts` —
  multi-process concurrent-write test (v1.2.0, decision 18).
- `src/persistence/save.ts` — versioned save files.
- `src/persistence/save.test.ts` — coverage.
- `src/persistence/achievements.ts` — 11 achievement definitions.
- `src/persistence/achievements.test.ts` — coverage (table-driven).
- `src/__tests__/output.tui.test.ts` — coverage.
- `.opencode/memory/decisions/2026-06-19-why-sudoku-cli-state-location.md`
  — ADR.
- `.opencode/memory/decisions/2026-06-19-why-proper-lockfile.md` —
  ADR (v1.2.0).
- `.opencode/memory/patterns/{fs-adapter-injection,
  atomic-write-tmp-rename, pure-achievement-evaluator,
  lock-factory-via-di}.md` — pattern records (v1.2.0 adds the
  `lock-factory-via-di` entry).

**Files Deleted:** none.

---

**Agent Flow:** spec → code → test → security → docs → memory → USER

**Open questions for the user** (also documented in the final summary):

**Resolved by the user (v1.1.0 update):**
- Q-1: ✅ `play --difficulty insane` exits with code `2` (parse
  error, consistent with `new`).
- Q-2: ✅ Reuse `play_exit: { reason: 'error' }` — no separate
  `play_error` variant.
- Q-3: ✅ Win screen shows filled grid + banner with stats (time +
  move count) + "new game / quit" prompt.
- Q-5: ✅ `play --help` lists keybindings + exit codes.

**New open questions introduced by v1.1.0:**

- **Q-NEW-1:** Should `stats.<difficulty>.totalPlays` be incremented
  on every `playCommand` invocation (i.e., even if the player quits
  without winning), or only on a win? The plan currently proposes
  *increment on every invocation* (i.e., a started game counts as a
  play), but some users might expect `totalPlays === wins + ongoing`.
  Please confirm. The acceptance criterion (plan.md #22) currently
  says "A failed (unsolved) quit does **not** increment `wins`",
  leaving `totalPlays` ambiguous.

- **Q-NEW-2:** Should we add file locking to `state.json` writes
  (e.g., via `proper-lockfile`) to prevent R-11's concurrent-write
  data loss? This would require a new runtime dep (G-20 exception)
  and is **out of Tier 1 scope**. Confirm we accept last-writer-
  wins for Tier 1 and defer locking to Tier 2.

- **Q-NEW-3:** For the win screen, should the achievement list be
  shown **inline with the banner** (current plan) or **as a
  separate screen** (user presses a key to dismiss)? The inline
  approach is simpler but the list can grow (up to 4 achievements
  in a single win in theory). Please confirm the inline approach.

- **Q-NEW-4:** Should `play --leaderboard --top N` default to N=5
  (per-difficulty, current plan) or N=10 (single global top)?
  Current plan is per-difficulty. Confirm.

- **Q-NEW-5:** Should we add a `play --saves` flag (list all
  unfinished saves, for Tier 2)? Mentioned as "future" in the
  plan (`latestSaveId` already exists), but not gated. Confirm
  we defer to Tier 2.

**Resolved by the user (v1.2.0 update):**

- **Q-NEW-1:** ✅ Two counters per difficulty:
  `stats.<difficulty>.totalPlays` is incremented on every **fresh**
  game (NOT on `--load` / `--resume-last`), and
  `stats.<difficulty>.totalWins` is incremented **only** on the
  `isWon` transition (idempotent). Documented in `plan.md`
  §Decisions #17 and §"State Schema". Implemented via
  `mergeStats({ mode: 'start' | 'win' })` in
  `src/persistence/state.ts`. The `PerDifficultyStats` shape drops
  `wins` (renamed to `totalWins`) and `winsAtBestTime` /
  `winsAtFewestMoves` (the leaderboard derives them now).
- **Q-NEW-2:** ✅ `proper-lockfile@^4.1.2` (MIT, ~30 kB) is the
  **second** explicit G-20 exception. The lock is wrapped in a
  `LockFactory` interface in `src/persistence/lock.ts` (Step 1.5.4)
  and injected into `state.ts` and `save.ts`. Concurrent writers
  block on a `*.lock` file; on busy/timeout, the wrapper returns
  `{ ok: false, reason: 'busy' | 'timeout' }` (never throws). A
  multi-process test (`src/persistence/__tests__/state-concurrent.test.ts`)
  verifies that two simultaneous `loadState` → `mergeStats` →
  `saveState` cycles do not corrupt `state.json`. R-11 is now
  **resolved**.
- **Q-NEW-3:** ✅ **Both** — inline summary on the win banner
  (`★ +<N>: <id1>, <id2>`) **and** a dismissable full-screen
  view (the user presses `a` to open it; any key returns to the
  win menu). The dismissable view shows the ASCII trophy, full
  titles, descriptions, rarity tiers, and total progress. All
  using built-in ANSI + `picocolors` (no new UI deps). Documented
  in `plan.md` §Decisions #19 and §"Modern UI Guidelines".

**Open questions carried forward (deferred to Tier 2):**

- **Q-NEW-4:** ⏳ `play --leaderboard --top N` default is **N=5
  per-difficulty** (unchanged from v1.1.0). Confirmed by absence
  of objections. The leaderboard command was implemented in
  v1.1.0 with the `top` flag.
- **Q-NEW-5:** ⏳ `play --saves` (list all unfinished saves)
  remains a Tier 2 candidate. The `latestSaveId` function exists
  in `src/persistence/save.ts` and is used by `--resume-last`;
  extending it to enumerate all saves is straightforward but
  out of Tier 1 scope.
