import type { DifficultyType } from '@hackettyam/sudoku-tools'
import { deserializeBoard } from '@hackettyam/sudoku-tools'
import { createGame, applyMove, getStats } from '../game/state.js'
import type { GameState } from '../game/state.js'
import { parseKeypress, renderGame, applyKey } from '../tui.js'
import { runTuiSession } from '../output.js'
import type { TuiSessionOptions, TuiRunner } from '../output.js'
import { loadState, saveState, mergeStats, unlockAchievements } from '../persistence/state.js'
import type { FsAdapter } from '../persistence/state.js'
import { saveGame, loadGame, latestSaveId } from '../persistence/save.js'
import type { SaveFile } from '../persistence/save.js'
import { evaluateAchievements } from '../persistence/achievements.js'

import { nodeLockFactory, inMemoryLockFactory } from '../persistence/lock.js'
import type { LockFactory } from '../persistence/lock.js'
import {
  defaultStatePath,
  defaultSavesDir,
  defaultStateLockPath,
  nodeFsAdapter,
  memoryFsAdapter,
} from '../persistence/state.js'
import { parseDifficulty } from '../format/difficulty.js'

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
  deps?: {
    io?: PlayIO
    persistence?: PlayPersistence
  },
): Promise<PlayCommandResult> {
  const io = deps?.io ?? defaultPlayIO()
  const persistence = deps?.persistence ?? defaultPlayPersistence()

  // 1. Resolve difficulty
  let difficulty: DifficultyType

  try {
    difficulty = parseDifficulty(options?.difficulty)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: 'play_exit', reason: 'error', message }
  }

  // 2. Load or create game
  let state: GameState

  try {
    if (options?.loadId) {
      const save = await loadGame(persistence.fs, options.loadId, persistence.savesDir)
      state = stateFromSave(save)
    } else if (options?.resumeLast) {
      const savedState = await loadState(persistence.fs, persistence.statePath, persistence.lock)
      const latestId = latestSaveId(savedState)

      if (latestId) {
        const save = await loadGame(persistence.fs, latestId, persistence.savesDir)
        state = stateFromSave(save)
      } else {
        state = createGame(difficulty)
      }
    } else {
      state = createGame(difficulty)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: 'play_exit', reason: 'error', message }
  }

  // 3. Merge stats for start (only when creating a fresh game)
  if (!options?.loadId && !options?.resumeLast) {
    await mergeStartStats(persistence, difficulty)
  }

  // 4. Run TUI session
  return runPlaySession(state, io, persistence)
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
    let currentState = state
    let resolved = false

    const runner = io.createTuiSession({
      colorsEnabled: true,
      onKey: (key) => {
        if (resolved) return

        const keys = parseKeypress(key)

        for (const parsedKey of keys) {
          const move = applyKey(currentState, parsedKey)

          if (move === null) continue

          currentState = applyMove(currentState, move)

          if (currentState.status === 'won') {
            resolved = true
            runner.cleanup()
            handleWin(currentState, persistence).then(resolve)
            return
          }

          if (currentState.status === 'quit') {
            resolved = true
            runner.cleanup()
            handleQuit(currentState, persistence).then(resolve)
            return
          }
        }

        runner.draw()
      },
      render: () => {
        const screen = renderGame(currentState, { colorsEnabled: true })
        io.stdout(screen)
      },
    })

    runner.draw()
    runner.run()
  })
}

// ---------------------------------------------------------------------------
// Win / Quit handlers
// ---------------------------------------------------------------------------

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
  try {
    const stats = getStats(state)
    const savedState = await loadState(persistence.fs, persistence.statePath, persistence.lock)

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

    await saveState(persistence.fs, persistence.statePath, newState, persistence.lock)

    return { kind: 'play_exit', reason: 'won' }
  } catch {
    return { kind: 'play_exit', reason: 'won' }
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
  try {
    if (state.moveCount > 0) {
      const saveId = await saveGame(persistence.fs, state, persistence.savesDir)
      const savedState = await loadState(persistence.fs, persistence.statePath, persistence.lock)
      const newState = { ...savedState, lastSaveId: saveId }
      await saveState(persistence.fs, persistence.statePath, newState, persistence.lock)
    }

    return { kind: 'play_exit', reason: 'quit' }
  } catch {
    return { kind: 'play_exit', reason: 'quit' }
  }
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
  try {
    const savedState = await loadState(persistence.fs, persistence.statePath, persistence.lock)
    const newStats = mergeStats(savedState.stats[difficulty], {}, 'start')
    const newState = {
      ...savedState,
      stats: {
        ...savedState.stats,
        [difficulty]: newStats,
      },
      totalPlays: savedState.totalPlays + 1,
    }
    await saveState(persistence.fs, persistence.statePath, newState, persistence.lock)
  } catch {
    // Ignore stat merge errors — game can still be played
  }
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
  const original = deserializeBoard(save.original)
  const solution = deserializeBoard(save.solution)
  const board = deserializeBoard(save.current)
  const readOnly = original.map((row: readonly number[]) =>
    row.map((val) => val !== 0),
  )

  return {
    board,
    solution,
    original,
    readOnly,
    difficulty: save.difficulty,
    cursor: save.cursor,
    status: 'playing',
    winView: 'menu',
    history: save.history,
    moveCount: save.moveCount,
    hintCount: save.hintCount,
    undoCount: save.undoCount,
    errorCount: 0,
    startedAt: save.startTime,
  }
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
    stdout: (s: string) => {
      process.stdout.write(s.endsWith('\n') ? s : `${s}\n`)
    },
    stderr: (s: string) => {
      process.stderr.write(s.endsWith('\n') ? s : `${s}\n`)
    },
    exit: (code: number) => process.exit(code) as never,
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
    fs: nodeFsAdapter,
    lock: nodeLockFactory(defaultStateLockPath()),
    statePath: defaultStatePath(),
    savesDir: defaultSavesDir(),
  }
}

/**
 * In-memory persistence for testing.
 *
 * @returns A {@link PlayPersistence} using in-memory adapters.
 */
export function memoryPlayPersistence(): PlayPersistence {
  return {
    fs: memoryFsAdapter(),
    lock: inMemoryLockFactory(),
    statePath: '/test/state.json',
    savesDir: '/test/saves',
  }
}
