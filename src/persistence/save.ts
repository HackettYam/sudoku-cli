import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { DifficultyType, BoardType } from '@hackettyam/sudoku-tools'
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

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new SaveCorruptError(id, 'invalid JSON')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as Record<string, unknown>).version !== 1
  ) {
    const version =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>).version
        : parsed
    throw new SaveVersionError(id, version)
  }

  return parsed as SaveFile
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

    try {
      const raw = await fs.readFile(join(dir, filename))
      const parsed: unknown = JSON.parse(raw)

      if (typeof parsed !== 'object' || parsed === null) {
        continue
      }

      const obj = parsed as Record<string, unknown>

      if (
        obj.version !== 1 ||
        typeof obj.id !== 'string' ||
        typeof obj.difficulty !== 'string' ||
        typeof obj.createdAt !== 'string' ||
        typeof obj.moveCount !== 'number'
      ) {
        continue
      }

      summaries.push({
        id: obj.id,
        difficulty: obj.difficulty as DifficultyType,
        createdAt: obj.createdAt,
        moveCount: obj.moveCount,
      })
    } catch {
      // skip unreadable/corrupt files
    }
  }

  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
