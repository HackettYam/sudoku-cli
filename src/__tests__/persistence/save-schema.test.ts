import { join } from 'node:path'

import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, expect, it } from 'vitest'

import { createGame } from '../../game/state.js'
import {
  loadGame,
  listSaves,
  saveGame,
  validateSaveId,
} from '../../persistence/save.js'
import {
  memoryFsAdapter,
  SaveCorruptError,
  SaveVersionError,
  type FsAdapter,
} from '../../persistence/state.js'

type RawSave = Record<string, unknown>
type CounterName = 'moveCount' | 'hintCount' | 'undoCount'
type NumericField = CounterName | 'startTime'

interface InvalidFixture {
  readonly name: string
  readonly create: (base: RawSave) => RawSave
}

interface RawFixture {
  readonly name: string
  readonly raw: string
}

interface RenameCall {
  readonly oldPath: string
  readonly newPath: string
}

interface RecordingFs {
  readonly fs: FsAdapter
  readonly writes: readonly string[]
  readonly renames: readonly RenameCall[]
}

const VALID_ID = '550e8400-e29b-41d4-a716-446655440000'
const SECOND_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
const MISMATCH_ID = '9f8c7d6e-5b4a-4938-8f7e-6d5c4b3a2910'
const UNREADABLE_ID = '7c9e6679-7425-42c2-9a2f-4d5e6f708192'
const BOARD = '0'.repeat(81)
const TIMESTAMP = '2026-01-01T00:00:00.000Z'

function makeBoard(rows = 9, columns = 9, value = 0): number[][] {
  return Array.from(
    { length: rows },
    () => Array.from({ length: columns }, () => value),
  )
}

function makeValidSave(id = VALID_ID, overrides: RawSave = {}): RawSave {
  return {
    version: 1,
    id,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    difficulty: 'easy',
    original: BOARD,
    solution: BOARD,
    current: BOARD,
    cursor: { row: 0, col: 0 },
    history: [],
    moveCount: 0,
    hintCount: 0,
    undoCount: 0,
    startTime: 1_704_067_200_000,
    errors: [],
    ...overrides,
  }
}

async function writeRawFile(
  fs: FsAdapter,
  path: string,
  payload: RawSave | string,
): Promise<void> {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload)
  await fs.writeFile(path, raw)
}

function replaceOnce(raw: string, search: string, replacement: string): string {
  if (!raw.includes(search)) {
    throw new Error(`Fixture does not contain expected text: ${search}`)
  }

  return raw.replace(search, replacement)
}

function withoutVersion(value: RawSave): RawSave {
  const { version: _version, ...copy } = value
  return copy
}

function makeNonFiniteRaw(field: NumericField): string {
  const current = field === 'startTime' ? '1704067200000' : '0'
  return replaceOnce(
    JSON.stringify(makeValidSave()),
    `"${field}":${current}`,
    `"${field}":1e999`,
  )
}

function makeRecordingFs(): RecordingFs {
  const base = memoryFsAdapter()
  const writes: string[] = []
  const renames: RenameCall[] = []
  const fs: FsAdapter = {
    ...base,
    writeFile(path, data) {
      writes.push(path)
      return base.writeFile(path, data)
    },
    rename(oldPath, newPath) {
      renames.push({ oldPath, newPath })
      return base.rename(oldPath, newPath)
    },
  }

  return { fs, writes, renames }
}

const invalidIdFixtures: readonly { readonly name: string; readonly id: string }[] = [
  { name: 'path traversal', id: '../etc/passwd' },
  { name: 'absolute path', id: '/tmp/save.json' },
  { name: 'empty value', id: '' },
  { name: 'random text', id: 'not-a-uuid' },
  { name: 'null-byte traversal', id: `${VALID_ID}\u0000../../etc/passwd` },
]

const unsupportedVersionFixtures: readonly InvalidFixture[] = [
  {
    name: 'missing version',
    create: (base) => withoutVersion(base),
  },
  {
    name: 'version zero',
    create: (base) => ({ ...base, version: 0 }),
  },
  {
    name: 'future version',
    create: (base) => ({ ...base, version: 2 }),
  },
  {
    name: 'string version',
    create: (base) => ({ ...base, version: '1' }),
  },
  {
    name: 'null version',
    create: (base) => ({ ...base, version: null }),
  },
]

const malformedJsonFixtures: readonly RawFixture[] = [
  { name: 'invalid JSON', raw: '{not-json' },
]

const malformedVersionFixtures: readonly RawFixture[] = [
  { name: 'JSON null', raw: 'null' },
  { name: 'JSON string', raw: '"save"' },
  { name: 'JSON array', raw: '[]' },
]

const invalidBoardFixtures: readonly InvalidFixture[] = [
  {
    name: 'original board is too short',
    create: (base) => ({ ...base, original: '0'.repeat(80) }),
  },
  {
    name: 'solution board is too long',
    create: (base) => ({ ...base, solution: '0'.repeat(82) }),
  },
  {
    name: 'current board has non-digit content',
    create: (base) => ({ ...base, current: `${'0'.repeat(80)}x` }),
  },
  {
    name: 'current board is not a string',
    create: (base) => ({ ...base, current: makeBoard() }),
  },
]

const invalidCursorFixtures: readonly InvalidFixture[] = [
  {
    name: 'negative row',
    create: (base) => ({ ...base, cursor: { row: -1, col: 0 } }),
  },
  {
    name: 'row above board bounds',
    create: (base) => ({ ...base, cursor: { row: 9, col: 0 } }),
  },
  {
    name: 'negative column',
    create: (base) => ({ ...base, cursor: { row: 0, col: -1 } }),
  },
  {
    name: 'column above board bounds',
    create: (base) => ({ ...base, cursor: { row: 0, col: 9 } }),
  },
  {
    name: 'fractional position',
    create: (base) => ({ ...base, cursor: { row: 1.5, col: 0 } }),
  },
  {
    name: 'extra cursor field',
    create: (base) => ({ ...base, cursor: { row: 0, col: 0, extra: true } }),
  },
]

const invalidCounterFixtures: readonly InvalidFixture[] = [
  {
    name: 'negative move count',
    create: (base) => ({ ...base, moveCount: -1 }),
  },
  {
    name: 'fractional hint count',
    create: (base) => ({ ...base, hintCount: 1.5 }),
  },
  {
    name: 'negative undo count',
    create: (base) => ({ ...base, undoCount: -1 }),
  },
  {
    name: 'negative start time',
    create: (base) => ({ ...base, startTime: -1 }),
  },
]

const invalidTimestampFixtures: readonly InvalidFixture[] = [
  {
    name: 'non-timestamp createdAt',
    create: (base) => ({ ...base, createdAt: 'not-a-timestamp' }),
  },
  {
    name: 'date-only updatedAt',
    create: (base) => ({ ...base, updatedAt: '2026-01-01' }),
  },
  {
    name: 'out-of-range createdAt month',
    create: (base) => ({ ...base, createdAt: '2026-13-01T00:00:00.000Z' }),
  },
  {
    name: 'non-string updatedAt',
    create: (base) => ({ ...base, updatedAt: 0 }),
  },
]

const malformedHistoryFixtures: readonly InvalidFixture[] = [
  {
    name: 'history is not an array',
    create: (base) => ({ ...base, history: {} }),
  },
  {
    name: 'history length does not match move count',
    create: (base) => ({ ...base, moveCount: 1 }),
  },
  {
    name: 'history board has the wrong row count',
    create: (base) => ({ ...base, moveCount: 1, history: [makeBoard(8)] }),
  },
  {
    name: 'history board has invalid cells',
    create: (base) => ({ ...base, moveCount: 1, history: [makeBoard(9, 9, 10)] }),
  },
  {
    name: 'errors is not an array',
    create: (base) => ({ ...base, errors: {} }),
  },
  {
    name: 'errors contains a non-string',
    create: (base) => ({ ...base, errors: ['bad move', 1] }),
  },
]

describe('T-014 save schema validation', () => {
  describe('save IDs', () => {
    it.each(invalidIdFixtures)('rejects $name IDs', async ({ id }) => {
      const fs = memoryFsAdapter()

      expect(validateSaveId(id)).toBe(false)
      await expect(loadGame(fs, id, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
    })

    it('rejects a filename and payload with different valid IDs', async () => {
      const fs = memoryFsAdapter()
      const payload = makeValidSave(SECOND_ID)
      const path = join('/saves', `${VALID_ID}.json`)
      await writeRawFile(fs, path, payload)

      await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
    })

    it('rejects a payload with a malformed ID', async () => {
      const fs = memoryFsAdapter()
      const payload = makeValidSave(VALID_ID, { id: 'not-a-uuid' })
      const path = join('/saves', `${VALID_ID}.json`)
      await writeRawFile(fs, path, payload)

      await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
    })
  })

  describe('versions and JSON', () => {
    it.each(unsupportedVersionFixtures)('rejects $name', async ({ create }) => {
      const fs = memoryFsAdapter()
      const payload = create(makeValidSave())
      const path = join('/saves', `${VALID_ID}.json`)
      await writeRawFile(fs, path, payload)

      await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveVersionError)
    })

    it.each(malformedJsonFixtures)('rejects $name as corrupt', async ({ raw }) => {
      const fs = memoryFsAdapter()
      const path = join('/saves', `${VALID_ID}.json`)
      await writeRawFile(fs, path, raw)

      await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
    })

    it.each(malformedVersionFixtures)('rejects $name as unsupported', async ({ raw }) => {
      const fs = memoryFsAdapter()
      const path = join('/saves', `${VALID_ID}.json`)
      await writeRawFile(fs, path, raw)

      await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveVersionError)
    })
  })

  it.each(invalidBoardFixtures)('rejects $name', async ({ create }) => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    await writeRawFile(fs, path, create(makeValidSave()))

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
  })

  it.each([
    { name: 'unsupported difficulty', difficulty: 'beginner' },
    { name: 'numeric difficulty', difficulty: 3 },
    { name: 'missing difficulty', difficulty: null },
  ])('rejects $name', async ({ difficulty }) => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    await writeRawFile(fs, path, makeValidSave(VALID_ID, { difficulty }))

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
  })

  it.each(invalidCursorFixtures)('rejects $name', async ({ create }) => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    await writeRawFile(fs, path, create(makeValidSave()))

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
  })

  it.each(invalidCounterFixtures)('rejects $name', async ({ create }) => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    await writeRawFile(fs, path, create(makeValidSave()))

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
  })

  it.each<CounterName>(['moveCount', 'hintCount', 'undoCount'])(
    'rejects non-finite %s',
    async (field) => {
      const fs = memoryFsAdapter()
      const path = join('/saves', `${VALID_ID}.json`)
      await writeRawFile(fs, path, makeNonFiniteRaw(field))

      await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
    },
  )

  it('rejects a non-finite start time', async () => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    await writeRawFile(fs, path, makeNonFiniteRaw('startTime'))

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
  })

  it.each(invalidTimestampFixtures)('rejects $name', async ({ create }) => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    await writeRawFile(fs, path, create(makeValidSave()))

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
  })

  it.each(malformedHistoryFixtures)('rejects $name', async ({ create }) => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    await writeRawFile(fs, path, create(makeValidSave()))

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
  })

  it('accepts a schema-complete save with history and errors', async () => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    const payload = makeValidSave(VALID_ID, {
      history: [makeBoard()],
      moveCount: 1,
      errors: ['incorrect value'],
    })
    await writeRawFile(fs, path, payload)

    const loaded = await loadGame(fs, VALID_ID, '/saves')

    expect(loaded.history).toHaveLength(1)
    expect(loaded.moveCount).toBe(1)
    expect(loaded.errors).toEqual(['incorrect value'])
  })
})

describe('T-014 save I/O behavior', () => {
  it('rejects unreadable files as corrupt', async () => {
    const fs: FsAdapter = {
      ...memoryFsAdapter(),
      exists: () => Promise.resolve(true),
      readFile: () => Promise.reject(new Error('EACCES: permission denied')),
    }

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toBeInstanceOf(SaveCorruptError)
  })

  it('rejects corrupt JSON as corrupt', async () => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    await writeRawFile(fs, path, '{invalid json')

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toThrow('invalid JSON')
  })

  it('rejects input larger than the save size limit', async () => {
    const fs = memoryFsAdapter()
    const path = join('/saves', `${VALID_ID}.json`)
    const oversized = `{"version":1,"padding":"${'x'.repeat(1_048_577)}"}`
    await writeRawFile(fs, path, oversized)

    await expect(loadGame(fs, VALID_ID, '/saves')).rejects.toThrow('file exceeds size limit')
  })

  it('round-trips an atomically written save', async () => {
    const recording = makeRecordingFs()
    const dir = '/atomic-saves'
    const id = await saveGame(recording.fs, createGame(Difficulty.Expert), dir)
    const targetPath = join(dir, `${id}.json`)
    const tempPath = recording.writes[0]

    if (tempPath === undefined) {
      throw new Error('Expected saveGame to write a temporary file')
    }

    expect(tempPath.startsWith(`${targetPath}.tmp-`)).toBe(true)
    expect(recording.renames).toEqual([{ oldPath: tempPath, newPath: targetPath }])
    expect(await recording.fs.readdir(dir)).toEqual([`${id}.json`])

    const loaded = await loadGame(recording.fs, id, dir)

    expect(loaded.id).toBe(id)
    expect(loaded.difficulty).toBe('expert')
    expect(loaded.history).toEqual([])
  })

  it('filters unsafe, corrupt, and unreadable files while listing valid saves', async () => {
    const base = memoryFsAdapter()
    const dir = '/filtered-saves'
    const unreadablePath = join(dir, `${UNREADABLE_ID}.json`)
    const files: readonly { readonly path: string; readonly payload: RawSave | string }[] = [
      {
        path: join(dir, `${VALID_ID}.json`),
        payload: makeValidSave(VALID_ID, {
          createdAt: '2026-01-03T00:00:00.000Z',
          updatedAt: '2026-01-03T00:00:00.000Z',
        }),
      },
      {
        path: join(dir, `${SECOND_ID}.json`),
        payload: makeValidSave(SECOND_ID, {
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }),
      },
      {
        path: join(dir, `${MISMATCH_ID}.json`),
        payload: makeValidSave(VALID_ID),
      },
      { path: join(dir, 'not-a-uuid.json'), payload: '{}' },
      { path: join(dir, `${UNREADABLE_ID}.json`), payload: makeValidSave(UNREADABLE_ID) },
      { path: join(dir, `${VALID_ID}.json.tmp`), payload: makeValidSave(VALID_ID) },
      { path: join(dir, `${SECOND_ID}-bad.json`), payload: 'not-json' },
    ]

    await Promise.all(files.map(({ path, payload }) => writeRawFile(base, path, payload)))

    const fs: FsAdapter = {
      ...base,
      readFile(path) {
        if (path === unreadablePath) {
          return Promise.reject(new Error('EACCES: permission denied'))
        }
        return base.readFile(path)
      },
    }

    const summaries = await listSaves(fs, dir)

    expect(summaries).toEqual([
      {
        id: VALID_ID,
        difficulty: 'easy',
        createdAt: '2026-01-03T00:00:00.000Z',
        moveCount: 0,
      },
      {
        id: SECOND_ID,
        difficulty: 'easy',
        createdAt: '2026-01-02T00:00:00.000Z',
        moveCount: 0,
      },
    ])
  })
})
