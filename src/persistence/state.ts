import { randomBytes } from 'node:crypto'
import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  mkdir as fsMkdir,
  rename as fsRename,
  readdir as fsReaddir,
  access as fsAccess,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { Difficulty, type DifficultyType } from '@hackettyam/sudoku-tools'

import { ACHIEVEMENTS, type AchievementId } from './achievements.js'
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
    readFile(path: string): Promise<string> {
      const data = store.get(path)
      if (data === undefined) {
        return Promise.reject(Object.assign(new Error(`ENOENT: no such file '${path}'`), {
          code: 'ENOENT',
        }))
      }
      return Promise.resolve(data)
    },
    writeFile(path: string, data: string): Promise<void> {
      store.set(path, data)
      return Promise.resolve()
    },
    mkdir(_path: string, _options?: { mode?: number }): Promise<void> {
      // no-op for in-memory adapter
      return Promise.resolve()
    },
    rename(oldPath: string, newPath: string): Promise<void> {
      const data = store.get(oldPath)
      if (data === undefined) {
        return Promise.reject(Object.assign(
          new Error(`ENOENT: no such file '${oldPath}'`),
          { code: 'ENOENT' },
        ))
      }
      store.delete(oldPath)
      store.set(newPath, data)
      return Promise.resolve()
    },
    readdir(path: string): Promise<readonly string[]> {
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
      return Promise.resolve([...names])
    },
    exists(path: string): Promise<boolean> {
      return Promise.resolve(store.has(path))
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

/** Result returned by a synchronous state transaction updater. */
export interface StateUpdate<T> {
  readonly state: StateFile
  readonly result: T
}

/** Synchronous state transaction updater. */
export type StateUpdater<T> = (state: StateFile) => StateUpdate<T>

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
    return await readStateFile(fs, path)
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
type SaveStateArgs = readonly [FsAdapter, string, StateFile, LockFactory]

export async function saveState(...args: SaveStateArgs): Promise<void> {
  const [fs, path, state, lock] = args
  const lockResult = await lock.acquire()

  if (!lockResult.ok) {
    throw new StateLockBusyError()
  }

  const handle = lockResult.handle

  try {
    await ensureParentDirectory(fs, path)
    await writeStateFile(fs, path, state)
  } finally {
    await lock.release(handle)
  }
}

// ---------------------------------------------------------------------------
// updateState
// ---------------------------------------------------------------------------

/**
 * Update the state atomically while holding one exclusive lock.
 *
 * The updater runs synchronously against the latest validated state. Its
 * returned result is passed back to the caller without a second state read.
 *
 * @param args - Filesystem, state path, lock, and synchronous updater.
 * @returns The typed result returned by the updater.
 * @throws {StateLockBusyError} If the lock cannot be acquired.
 * @throws {StateCorruptError} If the existing state is invalid.
 * @throws {StateVersionError} If the existing state version is unsupported.
 */
type UpdateStateArgs<T> = readonly [FsAdapter, string, LockFactory, StateUpdater<T>]

export async function updateState<T>(...args: UpdateStateArgs<T>): Promise<T> {
  const [fs, path, lock, updater] = args
  await ensureParentDirectory(fs, path)

  const lockResult = await lock.acquire()
  if (!lockResult.ok) {
    throw new StateLockBusyError()
  }

  const handle = lockResult.handle

  try {
    const currentState = await readStateOrDefault(fs, path)
    const update = updater(currentState)
    await writeStateFile(fs, path, update.state)
    return update.result
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

const STATE_KEYS = ['version', 'stats', 'totalPlays', 'achievements', 'lastSaveId'] as const
const STATS_KEYS = ['totalPlays', 'totalWins', 'bestTimeMs', 'fewestMoves', 'lastPlayedAt'] as const
const ACHIEVEMENT_KEYS = ['unlockedAt'] as const
const SUPPORTED_DIFFICULTIES = [
  Difficulty.Novice,
  Difficulty.Easy,
  Difficulty.Normal,
  Difficulty.Hard,
  Difficulty.Expert,
] as const
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value)
  return actual.length === expected.length
    && expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNonNegative(value) && Number.isInteger(value)
}

function isNullableFiniteNonNegative(value: unknown): value is number | null {
  return value === null || isFiniteNonNegative(value)
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || isNonNegativeInteger(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && ISO_TIMESTAMP_RE.test(value)
    && Number.isFinite(Date.parse(value))
}

function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_RE.test(value)
}

function isAchievementId(value: string): value is AchievementId {
  return ACHIEVEMENTS.some((achievement) => achievement.id === value)
}

function isPerDifficultyStats(value: unknown): value is PerDifficultyStats {
  if (!isRecord(value) || !hasExactKeys(value, STATS_KEYS)) return false

  return isNonNegativeInteger(value.totalPlays)
    && isNonNegativeInteger(value.totalWins)
    && isNullableFiniteNonNegative(value.bestTimeMs)
    && isNullableNonNegativeInteger(value.fewestMoves)
    && isNullableFiniteNonNegative(value.lastPlayedAt)
}

function isCompleteStats(
  value: Record<string, unknown>,
): value is Record<DifficultyType, PerDifficultyStats> {
  return hasExactKeys(value, SUPPORTED_DIFFICULTIES)
    && SUPPORTED_DIFFICULTIES.every((difficulty) => isPerDifficultyStats(value[difficulty]))
}

function isAchievementRecord(value: unknown): value is { readonly unlockedAt: string } {
  return isRecord(value)
    && hasExactKeys(value, ACHIEVEMENT_KEYS)
    && isTimestamp(value.unlockedAt)
}

function isAchievements(
  value: Record<string, unknown>,
): value is Readonly<Record<AchievementId, { readonly unlockedAt: string }>> {
  return Object.entries(value).every(([id, record]) =>
    isAchievementId(id) && isAchievementRecord(record),
  )
}

function isStateFile(value: unknown): value is StateFile {
  if (!isRecord(value) || !hasExactKeys(value, STATE_KEYS) || value.version !== 1) {
    return false
  }

  return isRecord(value.stats)
    && isCompleteStats(value.stats)
    && isNonNegativeInteger(value.totalPlays)
    && isRecord(value.achievements)
    && isAchievements(value.achievements)
    && (value.lastSaveId === null || isUuidV4(value.lastSaveId))
}

function isKnownStateError(
  error: unknown,
): error is StateCorruptError | StateVersionError | StateLockBusyError {
  return error instanceof StateCorruptError
    || error instanceof StateVersionError
    || error instanceof StateLockBusyError
}

function isAlreadyExistsError(error: unknown): boolean {
  return isRecord(error) && error.code === 'EEXIST'
}

function stateDirectory(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return separatorIndex < 0 ? '.' : path.slice(0, separatorIndex) || '.'
}

async function ensureParentDirectory(fs: FsAdapter, path: string): Promise<void> {
  try {
    await fs.mkdir(stateDirectory(path), { mode: 0o700 })
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error
    }
  }
}

function createDefaultState(): StateFile {
  return {
    ...DEFAULT_STATE,
    stats: {
      novice: { ...DEFAULT_STATE.stats.novice },
      easy: { ...DEFAULT_STATE.stats.easy },
      normal: { ...DEFAULT_STATE.stats.normal },
      hard: { ...DEFAULT_STATE.stats.hard },
      expert: { ...DEFAULT_STATE.stats.expert },
    },
    achievements: {} as StateFile['achievements'],
  }
}

async function readStateOrDefault(fs: FsAdapter, path: string): Promise<StateFile> {
  if (!(await fs.exists(path))) {
    return createDefaultState()
  }

  return readStateFile(fs, path)
}

async function writeStateFile(
  fs: FsAdapter,
  path: string,
  state: StateFile,
): Promise<void> {
  const suffix = randomBytes(8).toString('hex')
  const tmpPath = `${path}.tmp-${suffix}`
  const data = JSON.stringify(state)

  await fs.writeFile(tmpPath, data)
  await fs.rename(tmpPath, path)
}

function parseStateFile(raw: string): StateFile {
  if (raw.length > MAX_STATE_SIZE) {
    throw new StateCorruptError(
      `State file exceeds size limit (${String(raw.length)} > ${String(MAX_STATE_SIZE)})`,
    )
  }

  const parsed: unknown = JSON.parse(raw)

  if (!isRecord(parsed)
    || !Object.prototype.hasOwnProperty.call(parsed, 'version')) {
    throw new StateCorruptError('State file does not match expected schema')
  }

  if (parsed.version !== 1) {
    throw new StateVersionError(parsed.version)
  }

  if (!isStateFile(parsed)) {
    throw new StateCorruptError('State file does not match expected schema')
  }

  return parsed
}

async function readStateFile(fs: FsAdapter, path: string): Promise<StateFile> {
  try {
    const raw = await fs.readFile(path)
    return parseStateFile(raw)
  } catch (error) {
    if (isKnownStateError(error)) {
      throw error
    }

    const reason = error instanceof Error ? error.message : String(error)
    throw new StateCorruptError(`Failed to read or parse state file: ${reason}`)
  }
}
