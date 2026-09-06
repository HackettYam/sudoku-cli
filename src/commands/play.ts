import { deserializeBoard, type BoardType, type DifficultyType } from '@hackettyam/sudoku-tools'

import { parseDifficulty } from '../format/difficulty.js'
import { applyMove, createGame, getStats, type GameState } from '../game/state.js'
import { runTuiSession, type TuiRunner, type TuiSessionOptions } from '../output.js'
import { evaluateAchievements, type AchievementId } from '../persistence/achievements.js'
import { inMemoryLockFactory, nodeLockFactory, type LockFactory } from '../persistence/lock.js'
import { latestSaveId, loadGame, saveGame, type SaveFile } from '../persistence/save.js'
import {
  defaultSavesDir, defaultStateLockPath, defaultStatePath, loadState,
  memoryFsAdapter, mergeStats, nodeFsAdapter, type FsAdapter,
  unlockAchievements, updateState,
} from '../persistence/state.js'
import {
  applyKey, parseKeypress, renderAchievementDetail, renderGame, renderWinBanner,
  type ParsedKey,
} from '../tui.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for the play command. */
export interface PlayOptions {
  readonly difficulty?: string | undefined
  readonly loadId?: string | undefined
  readonly resumeLast?: boolean | undefined
}

/** I/O dependencies for testability. */
export interface PlayIO {
  readonly stdout: (s: string) => void
  readonly stderr: (s: string) => void
  readonly exit: (code: number) => never
  readonly createTuiSession: (opts: TuiSessionOptions) => TuiRunner
}

/** Persistence dependencies. */
export interface PlayPersistence {
  readonly fs: FsAdapter
  readonly lock: LockFactory
  readonly statePath: string
  readonly savesDir: string
}

/** Exit reason for the play command. */
export type PlayExitReason = 'quit' | 'won' | 'error'

/** Result of the play command. */
export interface PlayCommandResult {
  readonly kind: 'play_exit'
  readonly reason: PlayExitReason
  readonly message?: string
  readonly newAchievements?: readonly AchievementId[]
  readonly totalUnlocked?: number
}

type PlayResolution<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly result: PlayCommandResult }

interface PlaySessionState {
  currentState: GameState
  resolved: boolean
  transitioning: boolean
  finishing: boolean
  timerInterval?: ReturnType<typeof setInterval>
  pendingWin: Promise<PlayCommandResult | undefined> | undefined
  queuedKey: ParsedKey | undefined
  lastNewAchievements: readonly AchievementId[]
  lastTotalUnlocked: number
}

interface PlaySessionContext {
  readonly session: PlaySessionState
  readonly runner: () => TuiRunner
  readonly persistence: PlayPersistence
  readonly resolve: (result: PlayCommandResult) => void
  readonly startTimer: () => void
}

interface PlayCommandDependencies {
  readonly io?: PlayIO
  readonly persistence?: PlayPersistence
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Orchestrates the interactive play session.
 * Creates game → runs TUI → handles save on quit → updates stats on win.
 *
 * @param options - Play options (difficulty, loadId, resumeLast).
 * @param deps    - Injectable I/O and persistence dependencies.
 * @returns A result indicating why the session ended.
 *
 * @example
 * ```ts
 * const result = await playCommand({ difficulty: 'easy' })
 * ```
 */
export async function playCommand(
  options?: PlayOptions,
  deps?: PlayCommandDependencies,
): Promise<PlayCommandResult> {
  const { io, persistence } = resolvePlayDependencies(deps)
  const difficultyResult = resolveDifficulty(options?.difficulty)

  if (!difficultyResult.ok) {
    return difficultyResult.result
  }

  const stateResult = await resolveGameState(
    options,
    difficultyResult.value,
    persistence,
  )
  if (!stateResult.ok) {
    return stateResult.result
  }

  if (shouldMergeStartStats(options)) {
    try {
      await mergeStartStats(persistence, difficultyResult.value)
    } catch (error) {
      return playErrorResult(error)
    }
  }

  return runPlaySession(stateResult.value, io, persistence)
}

function resolvePlayDependencies(deps?: PlayCommandDependencies): {
  readonly io: PlayIO
  readonly persistence: PlayPersistence
} {
  return {
    io: deps?.io ?? defaultPlayIO(),
    persistence: deps?.persistence ?? defaultPlayPersistence(),
  }
}

function shouldMergeStartStats(options: PlayOptions | undefined): boolean {
  return !options?.loadId && !options?.resumeLast
}

function resolveDifficulty(value: string | undefined): PlayResolution<DifficultyType> {
  try {
    return { ok: true, value: parseDifficulty(value) }
  } catch (error) {
    return { ok: false, result: playErrorResult(error) }
  }
}

async function resolveGameState(
  options: PlayOptions | undefined,
  difficulty: DifficultyType,
  persistence: PlayPersistence,
): Promise<PlayResolution<GameState>> {
  try {
    if (options?.loadId) {
      return {
        ok: true,
        value: stateFromSave(await loadGame(persistence.fs, options.loadId, persistence.savesDir)),
      }
    }

    if (options?.resumeLast) {
      const latestId = latestSaveId(await loadState(persistence.fs, persistence.statePath, persistence.lock))
      if (latestId) {
        return {
          ok: true,
          value: stateFromSave(await loadGame(persistence.fs, latestId, persistence.savesDir)),
        }
      }
    }

    return { ok: true, value: createGame(difficulty) }
  } catch (error) {
    return { ok: false, result: playErrorResult(error) }
  }
}

function playErrorResult(error: unknown): PlayCommandResult {
  const message = error instanceof Error ? error.message : String(error)
  return { kind: 'play_exit', reason: 'error', message }
}

// ---------------------------------------------------------------------------
// TUI session runner
// ---------------------------------------------------------------------------

/**
 * Run the interactive TUI loop. Returns a Promise that resolves when the
 * game ends (quit or win).
 */
function runPlaySession(
  state: GameState,
  io: PlayIO,
  persistence: PlayPersistence,
): Promise<PlayCommandResult> {
  return new Promise<PlayCommandResult>((resolve) => {
    const session: PlaySessionState = {
      currentState: state, resolved: false, transitioning: false, finishing: false,
      pendingWin: undefined, queuedKey: undefined,
      lastNewAchievements: [], lastTotalUnlocked: 0,
    }
    const startTimer = (): void => {
      session.timerInterval = setInterval(() => {
        if (!session.resolved && session.currentState.status !== 'won') runner.draw()
      }, 1000)
    }

    const runner = io.createTuiSession({
      colorsEnabled: true,
      onKey: (key) => { handleSessionKey(key, context) },
      render: () => { renderSession(session, io) },
    })
    const context: PlaySessionContext = {
      session, runner: () => runner, persistence,
      resolve, startTimer,
    }

    startTimer()

    runner.draw()
    void runner.run()
  })
}

function handleSessionKey(key: Buffer, context: PlaySessionContext): void {
  const { session, runner } = context
  if (session.resolved || session.finishing) return

  const parsedKeys = parseKeypress(key)
  if (session.transitioning) {
    queueSessionKeys(parsedKeys, session)
    return
  }

  for (const parsedKey of parsedKeys) {
    if (processSessionKey(parsedKey, context)) return
  }

  runner().draw()
}

function processSessionKey(parsedKey: ParsedKey, context: PlaySessionContext): boolean {
  if (context.session.currentState.status === 'won') {
    handleWonKey(parsedKey, context)
    return true
  }

  return handlePlayingKey(parsedKey, context)
}

function queueSessionKeys(parsedKeys: readonly ParsedKey[], session: PlaySessionState): void {
  session.queuedKey = parsedKeys.find(isQuitKey)
}

function handleWonKey(parsedKey: ParsedKey, context: PlaySessionContext): void {
  const { session, runner } = context
  const currentState = session.currentState

  if (currentState.winView === 'achievements') {
    session.currentState = applyMove(currentState, { kind: 'toggle-achievements' })
    runner().draw()
    return
  }

  if (isNewGameKey(parsedKey)) {
    void startNewGame(context)
    return
  }

  if (isQuitKey(parsedKey)) {
    beginQuit(context, currentState)
    return
  }

  if (isAchievementsKey(parsedKey)) {
    session.currentState = applyMove(currentState, { kind: 'toggle-achievements' })
  }
  runner().draw()
}

function isNewGameKey(parsedKey: ParsedKey): boolean {
  return parsedKey.kind === 'char' && (parsedKey.char === 'n' || parsedKey.char === 'N')
}

function isQuitKey(parsedKey: ParsedKey): boolean {
  return (
    (parsedKey.kind === 'char' && (parsedKey.char === 'q' || parsedKey.char === 'Q')) ||
    parsedKey.kind === 'escape'
  )
}

function isAchievementsKey(parsedKey: ParsedKey): boolean {
  return parsedKey.kind === 'char' && (parsedKey.char === 'a' || parsedKey.char === 'A')
}

function handlePlayingKey(parsedKey: ParsedKey, context: PlaySessionContext): boolean {
  const { session, runner } = context
  const move = applyKey(session.currentState, parsedKey)
  if (move === null) return false

  session.currentState = applyMove(session.currentState, move)
  if (session.currentState.status === 'won') {
    if (session.timerInterval) clearInterval(session.timerInterval)
    startWinPersistence(session.currentState, context)
    runner().draw()
    return true
  }

  if (session.currentState.status === 'quit') {
    beginQuit(context, session.currentState)
    return true
  }

  return false
}

function renderSession(session: PlaySessionState, io: PlayIO): void {
  const state = session.currentState
  if (state.status !== 'won') {
    io.stdout(renderGame(state, { colorsEnabled: true }))
    return
  }

  if (state.winView !== 'achievements') {
    io.stdout(renderWinBanner(state, { colorsEnabled: true }, session.lastNewAchievements))
    return
  }

  const stats = getStats(state)
  const perDifficultyWins: Record<string, number> = {}
  const difficultiesWon: string[] = []
  const ctx = {
    difficulty: state.difficulty,
    elapsedMs: stats.elapsedMs,
    moveCount: stats.moveCount,
    hintCount: state.hintCount,
    undoCount: state.undoCount,
    errors: [] as readonly string[],
    perDifficultyWins: perDifficultyWins as Record<DifficultyType, number>,
    difficultiesWon: difficultiesWon as DifficultyType[],
  }
  const achievements = evaluateAchievements(ctx)
  io.stdout(renderAchievementDetail(
    achievements,
    session.lastTotalUnlocked,
    { colorsEnabled: true },
  ))
}

// ---------------------------------------------------------------------------
// Win / Quit handlers
// ---------------------------------------------------------------------------

function startWinPersistence(
  state: GameState,
  context: PlaySessionContext,
): void {
  const { session, persistence } = context
  const pendingWin = handleWin(state, persistence).then(
    (result) => {
      session.lastNewAchievements = result.newAchievements ?? []
      session.lastTotalUnlocked = result.totalUnlocked ?? 0
      return undefined
    },
    (error: unknown) => playErrorResult(error),
  )

  session.pendingWin = pendingWin
  void pendingWin.then((result) => {
    if (result !== undefined
      && !session.resolved
      && !session.transitioning
      && !session.finishing) {
      completeSession(context, result)
    }
  })
}

async function startNewGame(context: PlaySessionContext): Promise<void> {
  const { session, runner, startTimer } = context
  session.transitioning = true

  try {
    const winResult = await waitForWinPersistence(session)
    if (winResult !== undefined) {
      completeSession(context, winResult)
      return
    }

    if (session.resolved) return

    session.pendingWin = undefined
    session.currentState = createGame(session.currentState.difficulty)
    session.transitioning = false
    startTimer()

    const queuedKey = session.queuedKey
    session.queuedKey = undefined
    if (queuedKey !== undefined) {
      processSessionKey(queuedKey, context)
      return
    }

    runner().draw()
  } catch (error) {
    completeSession(context, playErrorResult(error))
  }
}

function beginQuit(context: PlaySessionContext, state: GameState): void {
  const { session, runner } = context
  if (session.resolved || session.finishing) return

  session.finishing = true
  if (session.timerInterval) clearInterval(session.timerInterval)
  runner().cleanup()
  void finishQuit(context, state)
}

async function finishQuit(
  context: PlaySessionContext,
  state: GameState,
): Promise<void> {
  try {
    const winResult = await waitForWinPersistence(context.session)
    if (winResult !== undefined) {
      completeSession(context, winResult)
      return
    }

    if (context.session.resolved) return
    const result = await handleQuit(state, context.persistence)
    completeSession(context, result)
  } catch (error) {
    completeSession(context, playErrorResult(error))
  }
}

function waitForWinPersistence(session: PlaySessionState): Promise<PlayCommandResult | undefined> {
  return Promise.resolve(session.pendingWin)
}

function completeSession(
  context: PlaySessionContext,
  result: PlayCommandResult,
): void {
  const { session, runner, resolve } = context
  if (session.resolved) return

  session.resolved = true
  session.transitioning = false
  session.finishing = false
  if (session.timerInterval) clearInterval(session.timerInterval)
  runner().cleanup()
  resolve(result)
}

/**
 * Handle win: evaluate achievements, merge stats, save state.
 *
 * @param state       - The won game state.
 * @param persistence - Persistence dependencies.
 * @returns The play command result.
 */
async function handleWin(
  state: GameState,
  persistence: PlayPersistence,
): Promise<PlayCommandResult> {
  const stats = getStats(state)
  const update = await updateState(
    persistence.fs,
    persistence.statePath,
    persistence.lock,
    (savedState) => {
      // Merge stats for win
      const prevStats = savedState.stats[state.difficulty]
      const newStats = mergeStats(
        prevStats,
        { elapsedMs: stats.elapsedMs, moveCount: stats.moveCount },
        'win',
      )

      // Evaluate achievements
      const perDifficultyWins: Record<string, number> = {}
      const difficultiesWon: string[] = []

      for (const [diff, s] of Object.entries(savedState.stats)) {
        perDifficultyWins[diff] = s.totalWins
        if (s.totalWins > 0) {
          difficultiesWon.push(diff)
        }
      }

      const ctx = {
        difficulty: state.difficulty,
        elapsedMs: stats.elapsedMs,
        moveCount: stats.moveCount,
        hintCount: state.hintCount,
        undoCount: state.undoCount,
        errors: [] as readonly string[],
        perDifficultyWins: perDifficultyWins as Record<DifficultyType, number>,
        difficultiesWon: difficultiesWon as DifficultyType[],
      }

      const newAchievements = evaluateAchievements(ctx)

      // Unlock achievements and update stats
      const stateWithAchievements = unlockAchievements(savedState, newAchievements)
      const newState = {
        ...stateWithAchievements,
        stats: {
          ...stateWithAchievements.stats,
          [state.difficulty]: newStats,
        },
      }

      return {
        state: newState,
        result: {
          newAchievements,
          totalUnlocked: Object.keys(newState.achievements).length,
        },
      }
    },
  )

  return {
    kind: 'play_exit',
    reason: 'won',
    newAchievements: update.newAchievements,
    totalUnlocked: update.totalUnlocked,
  }
}

/**
 * Handle quit: save game if mid-game, update state.
 *
 * @param state       - The quit game state.
 * @param persistence - Persistence dependencies.
 * @returns The play command result.
 */
async function handleQuit(
  state: GameState,
  persistence: PlayPersistence,
): Promise<PlayCommandResult> {
  if (state.moveCount > 0) {
    const saveId = await saveGame(persistence.fs, state, persistence.savesDir)
    await updateState(
      persistence.fs,
      persistence.statePath,
      persistence.lock,
      (savedState) => ({
        state: { ...savedState, lastSaveId: saveId },
        result: undefined,
      }),
    )
  }

  return { kind: 'play_exit', reason: 'quit' }
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

/**
 * Merge start stats into the persisted state file.
 *
 * @param persistence - Persistence dependencies.
 * @param difficulty  - The difficulty level.
 */
async function mergeStartStats(
  persistence: PlayPersistence,
  difficulty: DifficultyType,
): Promise<void> {
  await updateState(
    persistence.fs,
    persistence.statePath,
    persistence.lock,
    (savedState) => ({
      state: {
        ...savedState,
        stats: {
          ...savedState.stats,
          [difficulty]: mergeStats(savedState.stats[difficulty], {}, 'start'),
        },
        totalPlays: savedState.totalPlays + 1,
      },
      result: undefined,
    }),
  )
}

// ---------------------------------------------------------------------------
// Save deserialization
// ---------------------------------------------------------------------------

/**
 * Reconstruct a GameState from a SaveFile.
 *
 * @param save - The saved game data.
 * @returns A new GameState ready for play.
 */
function stateFromSave(save: SaveFile): GameState {
  const original = deserializeSavedBoard(save.original)
  const solution = deserializeSavedBoard(save.solution)
  const board = deserializeSavedBoard(save.current)
  const readOnly = original.map((row: readonly number[]) =>
    row.map((val) => val !== 0),
  )

  return {
    board, solution, original, readOnly,
    difficulty: save.difficulty, cursor: save.cursor, status: 'playing', winView: 'menu',
    history: save.history, moveCount: save.moveCount, hintCount: save.hintCount,
    undoCount: save.undoCount, errorCount: 0, startedAt: save.startTime,
  }
}

function deserializeSavedBoard(serialized: string): BoardType {
  return deserializeBoard(serialized) as BoardType
}

// ---------------------------------------------------------------------------
// Default dependencies
// ---------------------------------------------------------------------------

/**
 * Default I/O using process.stdout/stderr/exit.
 *
 * @returns A {@link PlayIO} backed by the real process.
 */
export function defaultPlayIO(): PlayIO {
  return {
    stdout: (s: string) => void process.stdout.write(s.endsWith('\n') ? s : `${s}\n`),
    stderr: (s: string) => void process.stderr.write(s.endsWith('\n') ? s : `${s}\n`),
    exit: (code: number) => process.exit(code),
    createTuiSession: (opts) => runTuiSession(opts),
  }
}

/**
 * Default persistence using node:fs.
 *
 * @returns A {@link PlayPersistence} backed by the real filesystem.
 */
export function defaultPlayPersistence(): PlayPersistence {
  return {
    fs: nodeFsAdapter, lock: nodeLockFactory(defaultStateLockPath()),
    statePath: defaultStatePath(), savesDir: defaultSavesDir(),
  }
}

/**
 * In-memory persistence for testing.
 *
 * @returns A {@link PlayPersistence} using in-memory adapters.
 */
export function memoryPlayPersistence(): PlayPersistence {
  return {
    fs: memoryFsAdapter(), lock: inMemoryLockFactory(),
    statePath: '/test/state.json', savesDir: '/test/saves',
  }
}
