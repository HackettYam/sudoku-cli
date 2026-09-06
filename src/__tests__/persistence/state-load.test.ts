import { describe, it, expect } from 'vitest'

import type { AchievementId } from '../../persistence/achievements.js'
import { inMemoryLockFactory } from '../../persistence/lock.js'
import type { LockFactory } from '../../persistence/lock.js'
import {
  StateCorruptError,
  StateVersionError,
  StateLockBusyError,
  SaveNotFoundError,
  SaveCorruptError,
  SaveVersionError,
  memoryFsAdapter,
  loadState,
} from '../../persistence/state.js'
import type { StateFile, PerDifficultyStats } from '../../persistence/state.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultState(): StateFile {
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
    achievements: {} as Readonly<Record<AchievementId, { readonly unlockedAt: string }>>,
    lastSaveId: null,
  }
}

const VALID_SAVE_ID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_ACHIEVEMENT_TIMESTAMP = '2026-01-01T00:00:00.000Z'

type RawState = Record<string, unknown>
type StateOverrides = Partial<Record<keyof StateFile, unknown>>

interface InvalidStateFixture {
  readonly name: string
  readonly create: () => string
}

function invalidState(name: string, create: () => string): InvalidStateFixture {
  return { name, create }
}

function makeRawState(overrides: StateOverrides = {}): RawState {
  return { ...makeDefaultState(), ...overrides }
}

function makeStateWithNoviceStats(overrides: Partial<PerDifficultyStats>): RawState {
  const state = makeDefaultState()
  return {
    ...state,
    stats: {
      ...state.stats,
      novice: { ...state.stats.novice, ...overrides },
    },
  }
}

function replaceFirst(value: string, search: string, replacement: string): string {
  const index = value.indexOf(search)
  if (index < 0) {
    throw new Error(`Fixture does not contain expected text: ${search}`)
  }

  return `${value.slice(0, index)}${replacement}${value.slice(index + search.length)}`
}

async function expectCorruptState(raw: string, path: string): Promise<void> {
  const fs = memoryFsAdapter()
  const lock = inMemoryLockFactory()
  await fs.writeFile(path, raw)
  await expect(loadState(fs, path, lock)).rejects.toBeInstanceOf(StateCorruptError)
}

function makeAchievementState(achievements: unknown): string {
  return JSON.stringify(makeRawState({ achievements }))
}

function makeNonFiniteState(field: string, current: '0' | 'null'): string {
  return replaceFirst(
    JSON.stringify(makeDefaultState()),
    `"${field}":${current}`,
    `"${field}":1e999`,
  )
}

const invalidNumericStateFixtures: readonly InvalidStateFixture[] = [
  invalidState('negative totalPlays', () => JSON.stringify(makeRawState({ totalPlays: -1 }))),
  invalidState(
    'negative per-difficulty totalPlays',
    () => JSON.stringify(makeStateWithNoviceStats({ totalPlays: -1 })),
  ),
  invalidState('negative totalWins', () => JSON.stringify(makeStateWithNoviceStats({ totalWins: -1 }))),
  invalidState('fractional totalWins', () => JSON.stringify(makeStateWithNoviceStats({ totalWins: 1.5 }))),
  invalidState('negative bestTimeMs', () => JSON.stringify(makeStateWithNoviceStats({ bestTimeMs: -1 }))),
  invalidState('negative fewestMoves', () => JSON.stringify(makeStateWithNoviceStats({ fewestMoves: -1 }))),
  invalidState('negative lastPlayedAt', () => JSON.stringify(makeStateWithNoviceStats({ lastPlayedAt: -1 }))),
  invalidState('non-finite totalWins', () => makeNonFiniteState('totalWins', '0')),
  invalidState('non-finite bestTimeMs', () => makeNonFiniteState('bestTimeMs', 'null')),
  invalidState('non-finite lastPlayedAt', () => makeNonFiniteState('lastPlayedAt', 'null')),
]

const invalidAchievementFixtures: readonly InvalidStateFixture[] = [
  invalidState('unknown achievement ID', () => makeAchievementState({
    unknown: { unlockedAt: VALID_ACHIEVEMENT_TIMESTAMP },
  })),
  invalidState('missing unlockedAt', () => makeAchievementState({ first_win: {} })),
  invalidState('extra achievement record field', () => makeAchievementState({
    first_win: { unlockedAt: VALID_ACHIEVEMENT_TIMESTAMP, extra: true },
  })),
  invalidState('invalid timestamp', () => makeAchievementState({
    first_win: { unlockedAt: 'not-a-timestamp' },
  })),
  invalidState('non-string timestamp', () => makeAchievementState({
    first_win: { unlockedAt: 123 },
  })),
]

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe('StateCorruptError', () => {
  it('should have correct name and code', () => {
    const err = new StateCorruptError('test message')
    expect(err.name).toBe('StateCorruptError')
    expect(err.code).toBe('STATE_CORRUPT')
    expect(err.message).toBe('test message')
  })

  it('should be an instance of Error', () => {
    const err = new StateCorruptError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(StateCorruptError)
  })
})

describe('StateVersionError', () => {
  it('should have correct name, code, and version', () => {
    const err = new StateVersionError(2)
    expect(err.name).toBe('StateVersionError')
    expect(err.code).toBe('STATE_VERSION')
    expect(err.version).toBe(2)
    expect(err.message).toBe('Unsupported state version: 2')
  })

  it('should handle unknown version types', () => {
    const err = new StateVersionError('bad')
    expect(err.version).toBe('bad')
    expect(err.message).toBe('Unsupported state version: bad')
  })
})

describe('StateLockBusyError', () => {
  it('should have correct name and code', () => {
    const err = new StateLockBusyError()
    expect(err.name).toBe('StateLockBusyError')
    expect(err.code).toBe('STATE_LOCK_BUSY')
  })
})

describe('SaveNotFoundError', () => {
  it('should have correct name, code, and message', () => {
    const err = new SaveNotFoundError('abc123')
    expect(err.name).toBe('SaveNotFoundError')
    expect(err.code).toBe('SAVE_NOT_FOUND')
    expect(err.message).toBe('Save not found: abc123')
  })
})

describe('SaveCorruptError', () => {
  it('should have correct name, code, and message', () => {
    const err = new SaveCorruptError('abc123', 'bad json')
    expect(err.name).toBe('SaveCorruptError')
    expect(err.code).toBe('SAVE_CORRUPT')
    expect(err.message).toBe('Save abc123 is corrupt: bad json')
  })
})

describe('SaveVersionError', () => {
  it('should have correct name, code, version, and message', () => {
    const err = new SaveVersionError('abc123', 3)
    expect(err.name).toBe('SaveVersionError')
    expect(err.code).toBe('SAVE_VERSION')
    expect(err.version).toBe(3)
    expect(err.message).toBe('Save abc123 has unsupported version: 3')
  })
})

// ---------------------------------------------------------------------------
// loadState validation
// ---------------------------------------------------------------------------

describe('loadState validation', () => {
  it('should return default state when file does not exist', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const path = '/tmp/state-missing/state.json'
    const state = await loadState(fs, path, lock)
    expect(state.version).toBe(1)
    expect(state.stats).toEqual(makeDefaultState().stats)
    expect(state.totalPlays).toBe(0)
    expect(state.achievements).toEqual({})
    expect(state.lastSaveId).toBeNull()
    expect(await fs.exists(path)).toBe(true)
  })

  it('should load a valid state file', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const state = makeDefaultState()
    await fs.writeFile('/tmp/state-ok/state.json', JSON.stringify(state))
    const loaded = await loadState(fs, '/tmp/state-ok/state.json', lock)
    expect(loaded.version).toBe(1)
    expect(loaded.totalPlays).toBe(0)
  })

  it('should throw StateCorruptError for oversized file', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const bigJson = JSON.stringify({
      version: 1,
      stats: {},
      totalPlays: 0,
      achievements: {},
      lastSaveId: null,
      padding: 'x'.repeat(1_048_577),
    })
    await fs.writeFile('/tmp/state-big/state.json', bigJson)
    await expect(
      loadState(fs, '/tmp/state-big/state.json', lock),
    ).rejects.toThrow(StateCorruptError)
  })

  it('should throw StateCorruptError for invalid schema (missing version)', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    await fs.writeFile(
      '/tmp/state-bad/state.json',
      JSON.stringify({ stats: {}, totalPlays: 0, achievements: {}, lastSaveId: null }),
    )
    await expect(
      loadState(fs, '/tmp/state-bad/state.json', lock),
    ).rejects.toThrow(StateCorruptError)
  })

  it('should throw StateCorruptError for invalid schema (missing stats)', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    await fs.writeFile(
      '/tmp/state-nostats/state.json',
      JSON.stringify({ version: 1, totalPlays: 0, achievements: {}, lastSaveId: null }),
    )
    await expect(
      loadState(fs, '/tmp/state-nostats/state.json', lock),
    ).rejects.toThrow(StateCorruptError)
  })

  it('should throw StateCorruptError when a difficulty stats entry is missing', async () => {
    const state = makeDefaultState()
    const { easy: _easy, ...statsWithoutEasy } = state.stats
    await expectCorruptState(
      JSON.stringify(makeRawState({ stats: statsWithoutEasy })),
      '/tmp/state-missing-difficulty/state.json',
    )
  })

  it('should throw StateCorruptError for an unsupported difficulty stats key', async () => {
    const state = makeDefaultState()
    const { easy: _easy, ...supportedStats } = state.stats
    const statsWithUnsupportedDifficulty = {
      ...supportedStats,
      beginner: state.stats.easy,
    }
    await expectCorruptState(
      JSON.stringify(makeRawState({ stats: statsWithUnsupportedDifficulty })),
      '/tmp/state-invalid-difficulty/state.json',
    )
  })

  it.each(invalidNumericStateFixtures)('should reject $name numeric state data', async ({ create }) => {
    await expectCorruptState(create(), '/tmp/state-invalid-number/state.json')
  })

  it('should throw StateCorruptError for invalid schema (non-null non-string lastSaveId)', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    await fs.writeFile(
      '/tmp/state-bad2/state.json',
      JSON.stringify({ version: 1, stats: {}, totalPlays: 0, achievements: {}, lastSaveId: 42 }),
    )
    await expect(
      loadState(fs, '/tmp/state-bad2/state.json', lock),
    ).rejects.toThrow(StateCorruptError)
  })

  it('should throw StateVersionError for unsupported version', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    await fs.writeFile(
      '/tmp/state-ver/state.json',
      JSON.stringify({ version: 2, stats: {}, totalPlays: 0, achievements: {}, lastSaveId: null }),
    )
    await expect(
      loadState(fs, '/tmp/state-ver/state.json', lock),
    ).rejects.toBeInstanceOf(StateVersionError)
  })

  it('should throw StateCorruptError for invalid JSON', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    await fs.writeFile('/tmp/state-json/state.json', '{invalid json}')
    await expect(
      loadState(fs, '/tmp/state-json/state.json', lock),
    ).rejects.toThrow(StateCorruptError)
  })

  it.each(invalidAchievementFixtures)('should reject $name achievement data', async ({ create }) => {
    await expectCorruptState(create(), '/tmp/state-invalid-achievement/state.json')
  })

  it('should throw StateCorruptError for an invalid UUID-v4 lastSaveId', async () => {
    await expectCorruptState(
      JSON.stringify(makeRawState({ lastSaveId: 'save-abc' })),
      '/tmp/state-invalid-uuid/state.json',
    )
  })
})

// ---------------------------------------------------------------------------
// loadState lock handling
// ---------------------------------------------------------------------------

describe('loadState lock handling', () => {
  it('should throw StateLockBusyError when lock cannot be acquired', async () => {
    const fs = memoryFsAdapter()
    const busyLock: LockFactory = {
      acquire: () => Promise.resolve({ ok: false as const, reason: 'busy' as const }),
      release: () => Promise.resolve(),
      held: () => 0,
    }
    await expect(
      loadState(fs, '/tmp/state-busy/state.json', busyLock),
    ).rejects.toThrow(StateLockBusyError)
  })

  it('should allow loading after a contending lock is released', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const first = await lock.acquire()
    expect(first.ok).toBe(true)

    await expect(
      loadState(fs, '/tmp/state-contention/state.json', lock),
    ).rejects.toBeInstanceOf(StateLockBusyError)
    expect(lock.held()).toBe(1)

    if (first.ok) {
      await lock.release(first.handle)
    }

    await expect(
      loadState(fs, '/tmp/state-contention/state.json', lock),
    ).resolves.toMatchObject({ version: 1 })
    expect(lock.held()).toBe(0)
  })

  it('should release lock after successful load', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    await loadState(fs, '/tmp/state-lock/state.json', lock)
    expect(lock.held()).toBe(0)
  })

  it('should release lock after error', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    await fs.writeFile('/tmp/state-err/state.json', 'not json')
    try {
      await loadState(fs, '/tmp/state-err/state.json', lock)
    } catch {
      // expected
    }
    expect(lock.held()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// loadState accepted data
// ---------------------------------------------------------------------------

describe('loadState accepted data', () => {
  it('should accept valid schema with non-null UUID-v4 lastSaveId', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const state = makeDefaultState()
    const withSaveId = { ...state, lastSaveId: VALID_SAVE_ID }
    await fs.writeFile('/tmp/state-sid/state.json', JSON.stringify(withSaveId))
    const loaded = await loadState(fs, '/tmp/state-sid/state.json', lock)
    expect(loaded.lastSaveId).toBe(VALID_SAVE_ID)
  })

  it('should accept valid schema with non-empty stats and achievements', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const state = makeDefaultState()
    const filled = {
      ...state,
      totalPlays: 10,
      stats: {
        ...state.stats,
        easy: { totalPlays: 5, totalWins: 2, bestTimeMs: 1000, fewestMoves: 30, lastPlayedAt: 123 },
      },
      achievements: { first_win: { unlockedAt: VALID_ACHIEVEMENT_TIMESTAMP } },
    }
    await fs.writeFile('/tmp/state-full/state.json', JSON.stringify(filled))
    const loaded = await loadState(fs, '/tmp/state-full/state.json', lock)
    expect(loaded.totalPlays).toBe(10)
    expect(loaded.stats.easy.totalWins).toBe(2)
    expect(loaded.achievements.first_win).toBeDefined()
  })
})
