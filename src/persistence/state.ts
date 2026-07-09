import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  mkdir as fsMkdir,
  rename as fsRename,
  readdir as fsReaddir,
  access as fsAccess,
} from 'node:fs/promises'
import type { DifficultyType } from '@hackettyam/sudoku-tools'
import type { AchievementId } from './achievements.js'
import type { LockFactory } from './lock.js'

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/** Thrown when the state file exists but is unreadable or corrupt JSON. */
export class StateCorruptError extends Error {
  public readonly code = 'STATE_CORRUPT' as const

  constructor(message: string) {
    super(message)
    this.name = 'StateCorruptError'
  }
}

/** Thrown when the state file has an unsupported version. */
export class StateVersionError extends Error {
  public readonly code = 'STATE_VERSION' as const
  public readonly version: unknown

  constructor(version: unknown) {
    super(`Unsupported state version: ${String(version)}`)
    this.name = 'StateVersionError'
    this.version = version
  }
}

/** Thrown when the lock could not be acquired within the retry window. */
export class StateLockBusyError extends Error {
  public readonly code = 'STATE_LOCK_BUSY' as const

  constructor() {
    super('Could not acquire state lock — another process holds it')
    this.name = 'StateLockBusyError'
  }
}

/** Thrown when a save file does not exist. */
export class SaveNotFoundError extends Error {
  public readonly code = 'SAVE_NOT_FOUND' as const

  constructor(saveId: string) {
    super(`Save not found: ${saveId}`)
    this.name = 'SaveNotFoundError'
  }
}

/** Thrown when a save file is corrupt or unreadable. */
export class SaveCorruptError extends Error {
  public readonly code = 'SAVE_CORRUPT' as const

  constructor(saveId: string, reason: string) {
    super(`Save ${saveId} is corrupt: ${reason}`)
    this.name = 'SaveCorruptError'
  }
}

/** Thrown when a save file has an unsupported version. */
export class SaveVersionError extends Error {
  public readonly code = 'SAVE_VERSION' as const
  public readonly version: unknown

  constructor(saveId: string, version: unknown) {
    super(`Save ${saveId} has unsupported version: ${String(version)}`)
    this.name = 'SaveVersionError'
    this.version = version
  }
}

// ---------------------------------------------------------------------------
// FsAdapter
// ---------------------------------------------------------------------------

/** Adapter for filesystem operations — inject for testing. */
export interface FsAdapter {
  readFile(path: string): Promise<string>
  writeFile(path: string, data: string): Promise<void>
  mkdir(path: string, options?: { mode?: number }): Promise<void>
  rename(oldPath: string, newPath: string): Promise<void>
  readdir(path: string): Promise<readonly string[]>
  exists(path: string): Promise<boolean>
}

/** Production {@link FsAdapter} backed by `node:fs/promises`. */
export const nodeFsAdapter: FsAdapter = {
  readFile(path: string): Promise<string> {
    return fsReadFile(path, 'utf-8')
  },
  writeFile(path: string, data: string): Promise<void> {
    return fsWriteFile(path, data, 'utf-8')
  },
  async mkdir(path: string, options?: { mode?: number }): Promise<void> {
    await fsMkdir(path, { recursive: true, ...options })
  },
  rename: fsRename,
  async readdir(path: string): Promise<readonly string[]> {
    return fsReaddir(path)
  },
  async exists(path: string): Promise<boolean> {
    try {
      await fsAccess(path)
      return true
    } catch {
      return false
    }
  },
}

/**
 * In-memory {@link FsAdapter} for testing.
 *
 * @returns A self-contained adapter backed by a plain object.
 */
export function memoryFsAdapter(): FsAdapter {
  const store = new Map<string, string>()

  return {
    async readFile(path: string): Promise<string> {
      const data = store.get(path)
      if (data === undefined) {
        throw Object.assign(new Error(`ENOENT: no such file '${path}'`), {
          code: 'ENOENT',
        })
      }
      return data
    },
    async writeFile(path: string, data: string): Promise<void> {
      store.set(path, data)
    },
    async mkdir(_path: string, _options?: { mode?: number }): Promise<void> {
      // no-op for in-memory adapter
    },
    async rename(oldPath: string, newPath: string): Promise<void> {
      const data = store.get(oldPath)
      if (data === undefined) {
        throw Object.assign(
          new Error(`ENOENT: no such file '${oldPath}'`),
          { code: 'ENOENT' },
        )
      }
      store.delete(oldPath)
      store.set(newPath, data)
    },
    async readdir(path: string): Promise<readonly string[]> {
      const prefix = path.endsWith('/') ? path : `${path}/`
      const names = new Set<string>()
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          const relative = key.slice(prefix.length)
          const slashIndex = relative.indexOf('/')
          if (slashIndex === -1) {
            names.add(relative)
          } else {
            names.add(relative.slice(0, slashIndex))
          }
        }
      }
      return [...names]
    },
    async exists(path: string): Promise<boolean> {
      return store.has(path)
    },
  }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const STATE_DIR = '.sudoku-cli'

/** Default path for `state.json` (`~/.sudoku-cli/state.json`). */
export function defaultStatePath(): string {
  return join(homedir(), STATE_DIR, 'state.json')
}

/** Default directory for saves (`~/.sudoku-cli/saves/`). */
export function defaultSavesDir(): string {
  return join(homedir(), STATE_DIR, 'saves')
}

/** Default path for the lock file (`~/.sudoku-cli/state.json.lock`). */
export function defaultStateLockPath(): string {
  return join(homedir(), STATE_DIR, 'state.json.lock')
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-difficulty statistics. */
export interface PerDifficultyStats {
  readonly totalPlays: number
  readonly totalWins: number
  readonly bestTimeMs: number | null
  readonly fewestMoves: number | null
  readonly lastPlayedAt: number | null
}

/** The on-disk state schema. */
export interface StateFile {
  readonly version: 1
  readonly stats: Record<DifficultyType, PerDifficultyStats>
  readonly totalPlays: number
  readonly achievements: Readonly<Record<AchievementId, { readonly unlockedAt: string }>>
  readonly lastSaveId: string | null
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_STATS: PerDifficultyStats = {
  totalPlays: 0,
  totalWins: 0,
  bestTimeMs: null,
  fewestMoves: null,
  lastPlayedAt: null,
}

const DEFAULT_STATE: StateFile = {
  version: 1,
  stats: {
    novice: { ...DEFAULT_STATS },
    easy: { ...DEFAULT_STATS },
    normal: { ...DEFAULT_STATS },
    hard: { ...DEFAULT_STATS },
    expert: { ...DEFAULT_STATS },
  },
  totalPlays: 0,
  achievements: {} as Readonly<Record<AchievementId, { readonly unlockedAt: string }>>,
  lastSaveId: null,
}

// ---------------------------------------------------------------------------
// loadState
// ---------------------------------------------------------------------------

const MAX_STATE_SIZE = 1 * 1024 * 1024 // 1 MiB

/**
 * Load the state file from disk.
 *
 * Acquires the lock, reads the file, and parses JSON.
 * Returns a default {@link StateFile} when the file does not exist.
 *
 * @param fs   - Filesystem adapter.
 * @param path - Absolute path to the state JSON file.
 * @param lock - Lock factory for exclusive access.
 * @returns The parsed {@link StateFile}.
 * @throws {StateCorruptError}   If the file is corrupt or exceeds 1 MiB.
 * @throws {StateVersionError}   If the version field is not `1`.
 * @throws {StateLockBusyError}  If the lock cannot be acquired.
 */
export async function loadState(
  fs: FsAdapter,
  path: string,
  lock: LockFactory,
): Promise<StateFile> {
  // Ensure the parent directory exists before attempting to lock.
  // proper-lockfile needs the directory to exist to create its lock sidecar.
  const dir = path.replace(/[/\\][^/\\]+$/, '')
  try { await fs.mkdir(dir, { mode: 0o700 }) } catch { /* already exists */ }
  if (!(await fs.exists(path))) {
    await fs.writeFile(path, JSON.stringify(DEFAULT_STATE))
  }

  const lockResult = await lock.acquire()

  if (!lockResult.ok) {
    throw new StateLockBusyError()
  }

  const handle = lockResult.handle

  try {
    const raw = await fs.readFile(path)

    if (raw.length > MAX_STATE_SIZE) {
      throw new StateCorruptError(
        `State file exceeds size limit (${raw.length} > ${MAX_STATE_SIZE})`,
      )
    }

    const parsed: unknown = JSON.parse(raw)

    if (!isStateFile(parsed)) {
      throw new StateCorruptError('State file does not match expected schema')
    }

    return parsed as StateFile
  } catch (error) {
    if (
      error instanceof StateCorruptError ||
      error instanceof StateLockBusyError
    ) {
      throw error
    }

    throw new StateCorruptError(
      `Failed to read or parse state file: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    await lock.release(handle)
  }
}

// ---------------------------------------------------------------------------
// saveState
// ---------------------------------------------------------------------------

/**
 * Save the state file atomically.
 *
 * Acquires the lock, writes to a temporary file, then renames to the final
 * path.  If the write fails the original file is untouched.
 *
 * @param fs    - Filesystem adapter.
 * @param path  - Absolute path to the state JSON file.
 * @param state - The {@link StateFile} to persist.
 * @param lock  - Lock factory for exclusive access.
 * @throws {StateLockBusyError} If the lock cannot be acquired.
 */
export async function saveState(
  fs: FsAdapter,
  path: string,
  state: StateFile,
  lock: LockFactory,
): Promise<void> {
  const lockResult = await lock.acquire()

  if (!lockResult.ok) {
    throw new StateLockBusyError()
  }

  const handle = lockResult.handle

  try {
    const dir = path.replace(/[/\\][^/\\]+$/, '')
    await fs.mkdir(dir, { mode: 0o700 })

    const suffix = randomBytes(8).toString('hex')
    const tmpPath = `${path}.tmp-${suffix}`
    const data = JSON.stringify(state)

    await fs.writeFile(tmpPath, data)
    await fs.rename(tmpPath, path)
  } finally {
    await lock.release(handle)
  }
}

// ---------------------------------------------------------------------------
// mergeStats
// ---------------------------------------------------------------------------

/**
 * Merge a new game result into per-difficulty statistics.
 *
 * - `'start'` — increments `totalPlays`, updates `lastPlayedAt`.
 * - `'win'`   — increments `totalWins`, updates `bestTimeMs` and
 *   `fewestMoves` when the new result is better.
 *
 * @param prev      - Previous statistics for this difficulty.
 * @param newResult - Result of the just-finished (or started) game.
 * @param mode      - Whether the game just started or was won.
 * @returns A new {@link PerDifficultyStats} with merged values.
 */
export function mergeStats(
  prev: PerDifficultyStats,
  newResult: { elapsedMs?: number; moveCount?: number },
  mode: 'win' | 'start',
): PerDifficultyStats {
  if (mode === 'start') {
    return {
      totalPlays: prev.totalPlays + 1,
      totalWins: prev.totalWins,
      bestTimeMs: prev.bestTimeMs,
      fewestMoves: prev.fewestMoves,
      lastPlayedAt: Date.now(),
    }
  }

  // mode === 'win'
  const bestTimeMs =
    newResult.elapsedMs !== undefined &&
    (prev.bestTimeMs === null || newResult.elapsedMs < prev.bestTimeMs)
      ? newResult.elapsedMs
      : prev.bestTimeMs

  const fewestMoves =
    newResult.moveCount !== undefined &&
    (prev.fewestMoves === null || newResult.moveCount < prev.fewestMoves)
      ? newResult.moveCount
      : prev.fewestMoves

  return {
    totalPlays: prev.totalPlays,
    totalWins: prev.totalWins + 1,
    bestTimeMs,
    fewestMoves,
    lastPlayedAt: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// unlockAchievements
// ---------------------------------------------------------------------------

/**
 * Add newly-unlocked achievement IDs to the state (idempotent).
 *
 * For each id not yet present in `state.achievements`, a new entry is added
 * with `unlockedAt` set to the current ISO-8601 timestamp.
 *
 * @param state - Current {@link StateFile}.
 * @param ids   - Achievement IDs to unlock.
 * @returns A new {@link StateFile} with the achievements added.
 */
export function unlockAchievements(
  state: StateFile,
  ids: readonly AchievementId[],
): StateFile {
  if (ids.length === 0) {
    return state
  }

  const merged: Record<string, { readonly unlockedAt: string }> = {}

  for (const [key, value] of Object.entries(state.achievements)) {
    merged[key] = value
  }

  for (const id of ids) {
    if (merged[id] === undefined) {
      merged[id] = { unlockedAt: new Date().toISOString() }
    }
  }

  return {
    ...state,
    achievements: merged as Readonly<Record<AchievementId, { readonly unlockedAt: string }>>,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isStateFile(value: unknown): value is {
  version: number
  stats: Record<string, unknown>
  totalPlays: number
  achievements: Record<string, unknown>
  lastSaveId: string | null
} {
  if (typeof value !== 'object' || value === null) return false

  const obj = value as Record<string, unknown>

  if (obj.version !== 1) return false
  if (typeof obj.stats !== 'object' || obj.stats === null) return false
  if (typeof obj.totalPlays !== 'number') return false
  if (typeof obj.achievements !== 'object' || obj.achievements === null) return false
  if (obj.lastSaveId !== null && typeof obj.lastSaveId !== 'string') return false

  return true
}
