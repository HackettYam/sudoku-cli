import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

import { Difficulty, type DifficultyType, type BoardType } from '@hackettyam/sudoku-tools'
import { serializeBoard } from '@hackettyam/sudoku-tools'

import type { FsAdapter, StateFile } from './state.js'
import {
  SaveNotFoundError,
  SaveCorruptError,
  SaveVersionError,
} from './state.js'
import type { CellPosition, GameState } from '../game/state.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Serialized save file schema. */
export interface SaveFile {
  readonly version: 1
  readonly id: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly difficulty: DifficultyType
  readonly original: string
  readonly solution: string
  readonly current: string
  readonly cursor: CellPosition
  readonly history: readonly BoardType[]
  readonly moveCount: number
  readonly hintCount: number
  readonly undoCount: number
  readonly startTime: number
  readonly errors: readonly string[]
}

/** Summary of a save for listing. */
export interface SaveSummary {
  readonly id: string
  readonly difficulty: DifficultyType
  readonly createdAt: string
  readonly moveCount: number
}

// ---------------------------------------------------------------------------
// validateSaveId
// ---------------------------------------------------------------------------

/** UUID v4 regex (lowercase, with hyphens). */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const BOARD_RE = /^[0-9]{81}$/
const MAX_SAVE_SIZE = 1 * 1024 * 1024
const SAVE_KEYS = [
  'version',
  'id',
  'createdAt',
  'updatedAt',
  'difficulty',
  'original',
  'solution',
  'current',
  'cursor',
  'history',
  'moveCount',
  'hintCount',
  'undoCount',
  'startTime',
  'errors',
] as const
const CURSOR_KEYS = ['row', 'col'] as const

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

function isSupportedDifficulty(value: unknown): value is DifficultyType {
  return value === Difficulty.Novice
    || value === Difficulty.Easy
    || value === Difficulty.Normal
    || value === Difficulty.Hard
    || value === Difficulty.Expert
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNonNegative(value) && Number.isInteger(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && ISO_TIMESTAMP_RE.test(value)
    && Number.isFinite(Date.parse(value))
}

function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_RE.test(value)
}

function isSerializedBoard(value: unknown): value is string {
  return typeof value === 'string' && BOARD_RE.test(value)
}

function isBoardCell(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= 9
}

function isBoard(value: unknown): value is BoardType {
  return Array.isArray(value)
    && value.length === 9
    && value.every((row) =>
      Array.isArray(row)
      && row.length === 9
      && row.every(isBoardCell),
    )
}

function isCursor(value: unknown): value is CellPosition {
  if (!isRecord(value) || !hasExactKeys(value, CURSOR_KEYS)) return false

  return isBoardIndex(value.row) && isBoardIndex(value.col)
}

function isBoardIndex(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 8
}

function isHistory(value: unknown, moveCount: number): value is readonly BoardType[] {
  return Array.isArray(value)
    && value.length === moveCount
    && value.every(isBoard)
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function hasValidSaveIdentity(
  value: Record<string, unknown>,
  expectedId: string,
): boolean {
  return value.version === 1 && value.id === expectedId && isUuidV4(value.id)
}

function hasValidSaveTimestamps(value: Record<string, unknown>): boolean {
  return isTimestamp(value.createdAt) && isTimestamp(value.updatedAt)
}

function hasValidSaveBoards(value: Record<string, unknown>): boolean {
  return isSerializedBoard(value.original)
    && isSerializedBoard(value.solution)
    && isSerializedBoard(value.current)
}

function hasValidSaveCounters(value: Record<string, unknown>): boolean {
  return isNonNegativeInteger(value.moveCount)
    && isNonNegativeInteger(value.hintCount)
    && isNonNegativeInteger(value.undoCount)
}

function hasValidSaveHistory(value: Record<string, unknown>): boolean {
  const { moveCount } = value

  if (!isNonNegativeInteger(moveCount)) return false

  return isHistory(value.history, moveCount) && isStringArray(value.errors)
}

function isSaveFile(value: unknown, expectedId: string): value is SaveFile {
  if (!isRecord(value) || !hasExactKeys(value, SAVE_KEYS)) return false

  return hasValidSaveIdentity(value, expectedId)
    && hasValidSaveTimestamps(value)
    && isSupportedDifficulty(value.difficulty)
    && hasValidSaveBoards(value)
    && isCursor(value.cursor)
    && hasValidSaveCounters(value)
    && isFiniteNonNegative(value.startTime)
    && hasValidSaveHistory(value)
}

function parseSaveFile(raw: string, id: string): SaveFile {
  if (raw.length > MAX_SAVE_SIZE) {
    throw new SaveCorruptError(
      id,
      `file exceeds size limit (${String(raw.length)} > ${String(MAX_SAVE_SIZE)})`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new SaveCorruptError(id, 'invalid JSON')
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    const version = isRecord(parsed) ? parsed.version : parsed
    throw new SaveVersionError(id, version)
  }

  if (!isSaveFile(parsed, id)) {
    throw new SaveCorruptError(id, 'invalid save schema')
  }

  return parsed
}

/**
 * Validate a save ID (must be UUID v4 format).
 * Rejects path traversal attempts.
 *
 * @param id - The save ID to validate.
 * @returns `true` if the ID is a valid UUID v4.
 *
 * @example
 * ```ts
 * validateSaveId('550e8400-e29b-41d4-a716-446655440000') // true
 * validateSaveId('../etc/passwd') // false
 * ```
 */
export function validateSaveId(id: string): boolean {
  return UUID_V4_RE.test(id)
}

// ---------------------------------------------------------------------------
// saveGame
// ---------------------------------------------------------------------------

/**
 * Save a game to disk. Assigns a UUID, writes atomically (tmp+rename).
 *
 * @param fs    - Filesystem adapter.
 * @param state - The game state to persist.
 * @param dir   - Directory to write the save file into.
 * @returns The assigned save ID (UUID v4).
 *
 * @example
 * ```ts
 * const id = await saveGame(fs, gameState, savesDir)
 * ```
 */
export async function saveGame(
  fs: FsAdapter,
  state: GameState,
  dir: string,
): Promise<string> {
  const id = randomUUID()
  const now = new Date().toISOString()

  const saveFile: SaveFile = {
    version: 1,
    id,
    createdAt: now,
    updatedAt: now,
    difficulty: state.difficulty,
    original: serializeBoard(state.original),
    solution: serializeBoard(state.solution),
    current: serializeBoard(state.board),
    cursor: { ...state.cursor },
    history: [...state.history],
    moveCount: state.moveCount,
    hintCount: state.hintCount,
    undoCount: state.undoCount,
    startTime: state.startedAt,
    errors: [],
  }

  const targetPath = join(dir, `${id}.json`)
  const tmpPath = `${targetPath}.tmp-${randomUUID()}`

  await fs.mkdir(dir, { mode: 0o700 })
  await fs.writeFile(tmpPath, JSON.stringify(saveFile))
  await fs.rename(tmpPath, targetPath)

  return id
}

// ---------------------------------------------------------------------------
// loadGame
// ---------------------------------------------------------------------------

/**
 * Load a save from disk.
 *
 * @param fs  - Filesystem adapter.
 * @param id  - The save ID (UUID v4).
 * @param dir - Directory containing save files.
 * @returns The parsed {@link SaveFile}.
 * @throws {SaveNotFoundError} If the save file does not exist.
 * @throws {SaveCorruptError}  If the file is unreadable or invalid JSON.
 * @throws {SaveVersionError}  If the version field is not `1`.
 *
 * @example
 * ```ts
 * const save = await loadGame(fs, '550e8400-...', savesDir)
 * ```
 */
export async function loadGame(
  fs: FsAdapter,
  id: string,
  dir: string,
): Promise<SaveFile> {
  if (!validateSaveId(id)) {
    throw new SaveCorruptError(id, 'invalid save ID format')
  }

  const filePath = join(dir, `${id}.json`)
  const exists = await fs.exists(filePath)

  if (!exists) {
    throw new SaveNotFoundError(id)
  }

  let raw: string

  try {
    raw = await fs.readFile(filePath)
  } catch {
    throw new SaveCorruptError(id, 'file unreadable')
  }

  return parseSaveFile(raw, id)
}

// ---------------------------------------------------------------------------
// listSaves
// ---------------------------------------------------------------------------

/**
 * List all saves as summaries, sorted by creation date descending.
 *
 * @param fs  - Filesystem adapter.
 * @param dir - Directory containing save files.
 * @returns Array of {@link SaveSummary} objects.
 *
 * @example
 * ```ts
 * const saves = await listSaves(fs, savesDir)
 * console.log(saves[0]?.id) // most recent save
 * ```
 */
export async function listSaves(
  fs: FsAdapter,
  dir: string,
): Promise<readonly SaveSummary[]> {
  let filenames: readonly string[]

  try {
    filenames = await fs.readdir(dir)
  } catch {
    return []
  }

  const jsonFiles = filenames.filter((name) => name.endsWith('.json'))
  const summaries: SaveSummary[] = []

  for (const filename of jsonFiles) {
    const id = filename.replace(/\.json$/, '')

    if (!validateSaveId(id)) {
      continue
    }

    const summary = await readSaveSummary(fs, dir, filename)
    if (summary !== undefined) {
      summaries.push(summary)
    }
  }

  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function readSaveSummary(
  fs: FsAdapter,
  dir: string,
  filename: string,
): Promise<SaveSummary | undefined> {
  try {
    const raw = await fs.readFile(join(dir, filename))
    const id = filename.replace(/\.json$/, '')
    const save = parseSaveFile(raw, id)

    return {
      id: save.id,
      difficulty: save.difficulty,
      createdAt: save.createdAt,
      moveCount: save.moveCount,
    }
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// latestSaveId
// ---------------------------------------------------------------------------

/**
 * Get the latest save ID from a state file, or `null` if none.
 *
 * @param state - The persisted state file.
 * @returns The last save ID, or `null`.
 *
 * @example
 * ```ts
 * const id = latestSaveId(state)
 * if (id) await loadGame(fs, id, savesDir)
 * ```
 */
export function latestSaveId(state: StateFile): string | null {
  return state.lastSaveId
}
