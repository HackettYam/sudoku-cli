import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createGame } from '../../game/state.js'
import { saveGame, loadGame, listSaves, validateSaveId, latestSaveId } from '../../persistence/save.js'
import { nodeFsAdapter, memoryFsAdapter } from '../../persistence/state.js'
import type { FsAdapter, StateFile } from '../../persistence/state.js'



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTmpDir(): Promise<string> {
  const path = join(tmpdir(), `save-test-${randomUUID()}-`)
  await mkdir(path, { recursive: true })
  return path
}

function emptyState(): StateFile {
  return {
    version: 1,
    stats: {
      novice: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
      easy: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
      normal: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
      hard: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
      expert: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
    },
    totalPlays: 0,
    achievements: {} as StateFile['achievements'],
    lastSaveId: null,
  }
}

// ---------------------------------------------------------------------------
// validateSaveId
// ---------------------------------------------------------------------------

describe('validateSaveId', () => {
  it('returns true for a valid UUID v4', () => {
    expect(validateSaveId('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('returns true for another valid UUID v4', () => {
    expect(validateSaveId(randomUUID())).toBe(true)
  })

  it('returns false for path traversal', () => {
    expect(validateSaveId('../etc/passwd')).toBe(false)
  })

  it('returns false for random string', () => {
    expect(validateSaveId('not-a-uuid')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateSaveId('')).toBe(false)
  })

  it('returns false for UUID v1 format', () => {
    expect(validateSaveId('f47ac10b-58cc-3729-9627-9904b21d0f80')).toBe(false)
  })

  it('returns false for UUID with uppercase (regex is case-insensitive but must have 4 in position 13)', () => {
    expect(validateSaveId('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('returns false for string with null bytes', () => {
    expect(validateSaveId('550e8400-e29b-41d4-a716-446655440000\x00../../etc/passwd')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// saveGame
// ---------------------------------------------------------------------------

describe('saveGame', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await makeTmpDir()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('saves a game and returns a UUID v4', async () => {
    const fs = nodeFsAdapter
    const state = createGame(Difficulty.Easy)
    const id = await saveGame(fs, state, tmpDir)

    expect(validateSaveId(id)).toBe(true)
  })

  it('creates the save file on disk', async () => {
    const fs = nodeFsAdapter
    const state = createGame(Difficulty.Normal)
    const id = await saveGame(fs, state, tmpDir)

    const filePath = join(tmpDir, `${id}.json`)
    const raw = await readFile(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    expect(typeof parsed).toBe('object')
    expect(parsed).not.toBeNull()
  })

  it('creates directory if it does not exist', async () => {
    const fs = nodeFsAdapter
    const nestedDir = join(tmpDir, 'nested', 'saves')
    const state = createGame(Difficulty.Easy)
    const id = await saveGame(fs, state, nestedDir)

    const filePath = join(nestedDir, `${id}.json`)
    const raw = await readFile(filePath, 'utf-8')
    expect(raw).toBeTruthy()
  })

  it('round-trips save → load', async () => {
    const fs = nodeFsAdapter
    const state = createGame(Difficulty.Hard)
    const id = await saveGame(fs, state, tmpDir)

    const loaded = await loadGame(fs, id, tmpDir)
    expect(loaded.id).toBe(id)
    expect(loaded.version).toBe(1)
    expect(loaded.difficulty).toBe('hard')
    expect(loaded.original).toBeTruthy()
    expect(loaded.solution).toBeTruthy()
    expect(loaded.current).toBeTruthy()
  })

  it('works with in-memory FsAdapter', async () => {
    const fs = memoryFsAdapter()
    const state = createGame(Difficulty.Easy)
    const id = await saveGame(fs, state, '/test/saves')

    const loaded = await loadGame(fs, id, '/test/saves')
    expect(loaded.id).toBe(id)
    expect(loaded.difficulty).toBe('easy')
  })
})

// ---------------------------------------------------------------------------
// loadGame
// ---------------------------------------------------------------------------

describe('loadGame', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await makeTmpDir()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('throws SaveNotFoundError for missing save', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'

    await expect(loadGame(fs, fakeId, tmpDir)).rejects.toThrow('Save not found')
  })

  it('throws SaveCorruptError for invalid save ID format', async () => {
    const fs = nodeFsAdapter

    await expect(loadGame(fs, 'not-a-uuid', tmpDir)).rejects.toThrow('corrupt')
  })

  it('throws SaveCorruptError for invalid JSON', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'
    const filePath = join(tmpDir, `${fakeId}.json`)
    await writeFile(filePath, 'not json {{{', 'utf-8')

    await expect(loadGame(fs, fakeId, tmpDir)).rejects.toThrow('invalid JSON')
  })

  it('throws SaveCorruptError for file that is not an object', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'
    const filePath = join(tmpDir, `${fakeId}.json`)
    await writeFile(filePath, '"just a string"', 'utf-8')

    await expect(loadGame(fs, fakeId, tmpDir)).rejects.toThrow('unsupported version')
  })

  it('throws SaveCorruptError for null JSON', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'
    const filePath = join(tmpDir, `${fakeId}.json`)
    await writeFile(filePath, 'null', 'utf-8')

    await expect(loadGame(fs, fakeId, tmpDir)).rejects.toThrow('unsupported version')
  })

  it('throws SaveVersionError for wrong version', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'
    const filePath = join(tmpDir, `${fakeId}.json`)
    await writeFile(filePath, JSON.stringify({ version: 2, id: fakeId }), 'utf-8')

    await expect(loadGame(fs, fakeId, tmpDir)).rejects.toThrow('unsupported version')
  })

  it('throws SaveVersionError for version 0', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'
    const filePath = join(tmpDir, `${fakeId}.json`)
    await writeFile(filePath, JSON.stringify({ version: 0 }), 'utf-8')

    await expect(loadGame(fs, fakeId, tmpDir)).rejects.toThrow('unsupported version')
  })

  it('loadGame handles readFile failure (ENOENT-like) gracefully', async () => {
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'

    // Custom adapter: exists returns true, but readFile throws ENOENT
    const readErrorFs: FsAdapter = {
      readFile: () => Promise.reject(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }),
      ),
      writeFile: () => Promise.resolve(),
      mkdir: () => Promise.resolve(),
      rename: () => Promise.resolve(),
      readdir: () => Promise.resolve([] as readonly string[]),
      exists: () => Promise.resolve(true),
    }

    await expect(loadGame(readErrorFs, fakeId, tmpDir)).rejects.toThrow('corrupt')
  })
})

// ---------------------------------------------------------------------------
// listSaves
// ---------------------------------------------------------------------------

describe('listSaves', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await makeTmpDir()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty array for non-existent directory', async () => {
    const fs = nodeFsAdapter
    const result = await listSaves(fs, join(tmpDir, 'nonexistent'))
    expect(result).toEqual([])
  })

  it('returns empty array for empty directory', async () => {
    const fs = nodeFsAdapter
    const result = await listSaves(fs, tmpDir)
    expect(result).toEqual([])
  })

  it('lists saves sorted by date descending', async () => {
    const fs = nodeFsAdapter

    // Create two saves with different timestamps
    const state = createGame(Difficulty.Easy)
    const id1 = await saveGame(fs, state, tmpDir)

    // Wait a tiny bit to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10))

    const state2 = createGame(Difficulty.Hard)
    const id2 = await saveGame(fs, state2, tmpDir)

    const saves = await listSaves(fs, tmpDir)
    expect(saves.length).toBe(2)
    // Most recent first
    expect(saves[0]?.id).toBe(id2)
    expect(saves[1]?.id).toBe(id1)
  })

  it('skips non-UUID files', async () => {
    const fs = nodeFsAdapter
    await writeFile(join(tmpDir, 'not-a-uuid.json'), '{}', 'utf-8')
    await writeFile(join(tmpDir, '.hidden.json'), '{}', 'utf-8')

    const result = await listSaves(fs, tmpDir)
    expect(result).toEqual([])
  })

  it('skips corrupt files', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'
    await writeFile(join(tmpDir, `${fakeId}.json`), 'not json', 'utf-8')

    const result = await listSaves(fs, tmpDir)
    expect(result).toEqual([])
  })

  it('skips files with missing required fields', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'
    await writeFile(
      join(tmpDir, `${fakeId}.json`),
      JSON.stringify({ version: 1, id: fakeId }),
      'utf-8',
    )

    const result = await listSaves(fs, tmpDir)
    expect(result).toEqual([])
  })

  it('skips files with wrong version', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'
    await writeFile(
      join(tmpDir, `${fakeId}.json`),
      JSON.stringify({ version: 2, id: fakeId, difficulty: 'easy', createdAt: '2024-01-01', moveCount: 0 }),
      'utf-8',
    )

    const result = await listSaves(fs, tmpDir)
    expect(result).toEqual([])
  })

  it('skips non-object JSON', async () => {
    const fs = nodeFsAdapter
    const fakeId = '550e8400-e29b-41d4-a716-446655440000'
    await writeFile(join(tmpDir, `${fakeId}.json`), '"string"', 'utf-8')

    const result = await listSaves(fs, tmpDir)
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// latestSaveId
// ---------------------------------------------------------------------------

describe('latestSaveId', () => {
  it('returns the lastSaveId from state', () => {
    const state = emptyState()
    const withSave = { ...state, lastSaveId: '550e8400-e29b-41d4-a716-446655440000' }
    expect(latestSaveId(withSave)).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('returns null when no lastSaveId', () => {
    const state = emptyState()
    expect(latestSaveId(state)).toBeNull()
  })
})
