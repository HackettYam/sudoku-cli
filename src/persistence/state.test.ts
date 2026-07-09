import { describe, it, expect } from 'vitest'
import {
  StateCorruptError,
  StateVersionError,
  StateLockBusyError,
  SaveNotFoundError,
  SaveCorruptError,
  SaveVersionError,
  memoryFsAdapter,
  nodeFsAdapter,
  defaultStatePath,
  defaultSavesDir,
  defaultStateLockPath,
  loadState,
  saveState,
  mergeStats,
  unlockAchievements,
} from './state.js'
import { inMemoryLockFactory } from './lock.js'
import type { StateFile, PerDifficultyStats } from './state.js'
import type { AchievementId } from './achievements.js'
import type { LockFactory } from './lock.js'

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
// memoryFsAdapter
// ---------------------------------------------------------------------------

describe('memoryFsAdapter', () => {
  it('should read and write files', async () => {
    const fs = memoryFsAdapter()
    await fs.writeFile('/tmp/test.txt', 'hello')
    const content = await fs.readFile('/tmp/test.txt')
    expect(content).toBe('hello')
  })

  it('should throw ENOENT for missing files', async () => {
    const fs = memoryFsAdapter()
    await expect(fs.readFile('/tmp/missing.txt')).rejects.toThrow('ENOENT')
  })

  it('should mkdir (no-op)', async () => {
    const fs = memoryFsAdapter()
    // Should not throw
    await fs.mkdir('/tmp/newdir')
  })

  it('should rename a file', async () => {
    const fs = memoryFsAdapter()
    await fs.writeFile('/tmp/old.txt', 'data')
    await fs.rename('/tmp/old.txt', '/tmp/new.txt')
    expect(await fs.readFile('/tmp/new.txt')).toBe('data')
    await expect(fs.readFile('/tmp/old.txt')).rejects.toThrow('ENOENT')
  })

  it('should throw ENOENT when renaming missing file', async () => {
    const fs = memoryFsAdapter()
    await expect(fs.rename('/tmp/missing.txt', '/tmp/target.txt')).rejects.toThrow('ENOENT')
  })

  it('should list files with readdir', async () => {
    const fs = memoryFsAdapter()
    await fs.mkdir('/tmp/dir')
    await fs.writeFile('/tmp/dir/a.json', '{}')
    await fs.writeFile('/tmp/dir/b.json', '{}')
    const files = await fs.readdir('/tmp/dir')
    expect(files).toContain('a.json')
    expect(files).toContain('b.json')
  })

  it('should handle nested paths in readdir', async () => {
    const fs = memoryFsAdapter()
    await fs.writeFile('/tmp/dir/sub/file.txt', 'x')
    const files = await fs.readdir('/tmp/dir')
    expect(files).toContain('sub')
  })

  it('should handle trailing slash in readdir', async () => {
    const fs = memoryFsAdapter()
    await fs.writeFile('/tmp/dir/file.txt', 'x')
    const files = await fs.readdir('/tmp/dir/')
    expect(files).toContain('file.txt')
  })

  it('should report exists correctly', async () => {
    const fs = memoryFsAdapter()
    expect(await fs.exists('/tmp/missing')).toBe(false)
    await fs.writeFile('/tmp/present.txt', 'x')
    expect(await fs.exists('/tmp/present.txt')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// nodeFsAdapter
// ---------------------------------------------------------------------------

describe('nodeFsAdapter', () => {
  it('should be defined and have the right methods', () => {
    expect(nodeFsAdapter.readFile).toBeDefined()
    expect(nodeFsAdapter.writeFile).toBeDefined()
    expect(nodeFsAdapter.mkdir).toBeDefined()
    expect(nodeFsAdapter.rename).toBeDefined()
    expect(nodeFsAdapter.readdir).toBeDefined()
    expect(nodeFsAdapter.exists).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

describe('defaultStatePath', () => {
  it('should return a path ending with .sudoku-cli/state.json', () => {
    const path = defaultStatePath()
    expect(path).toContain('.sudoku-cli/state.json')
  })
})

describe('defaultSavesDir', () => {
  it('should return a path ending with .sudoku-cli/saves', () => {
    const path = defaultSavesDir()
    expect(path).toContain('.sudoku-cli/saves')
  })
})

describe('defaultStateLockPath', () => {
  it('should return a path ending with .sudoku-cli/state.json.lock', () => {
    const path = defaultStateLockPath()
    expect(path).toContain('.sudoku-cli/state.json.lock')
  })
})

// ---------------------------------------------------------------------------
// loadState
// ---------------------------------------------------------------------------

describe('loadState', () => {
  it('should return default state when file does not exist', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const state = await loadState(fs, '/tmp/state-missing/state.json', lock)
    expect(state.version).toBe(1)
    expect(state.totalPlays).toBe(0)
    expect(state.achievements).toEqual({})
    expect(state.lastSaveId).toBeNull()
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

  it('should throw StateCorruptError for version 2 (isStateFile rejects first)', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    await fs.writeFile(
      '/tmp/state-ver/state.json',
      JSON.stringify({ version: 2, stats: {}, totalPlays: 0, achievements: {}, lastSaveId: null }),
    )
    await expect(
      loadState(fs, '/tmp/state-ver/state.json', lock),
    ).rejects.toThrow(StateCorruptError)
  })

  it('should throw StateCorruptError for invalid JSON', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    await fs.writeFile('/tmp/state-json/state.json', '{invalid json}')
    await expect(
      loadState(fs, '/tmp/state-json/state.json', lock),
    ).rejects.toThrow(StateCorruptError)
  })

  it('should throw StateLockBusyError when lock cannot be acquired', async () => {
    const fs = memoryFsAdapter()
    const busyLock: LockFactory = {
      acquire: async () => ({ ok: false as const, reason: 'busy' as const }),
      release: async () => {},
      held: () => 0,
    }
    await expect(
      loadState(fs, '/tmp/state-busy/state.json', busyLock),
    ).rejects.toThrow(StateLockBusyError)
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

  it('should accept valid schema with non-null lastSaveId string', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const state = makeDefaultState()
    const withSaveId = { ...state, lastSaveId: 'save-abc' }
    await fs.writeFile('/tmp/state-sid/state.json', JSON.stringify(withSaveId))
    const loaded = await loadState(fs, '/tmp/state-sid/state.json', lock)
    expect(loaded.lastSaveId).toBe('save-abc')
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
      achievements: { first_win: { unlockedAt: '2026-01-01T00:00:00.000Z' } },
    }
    await fs.writeFile('/tmp/state-full/state.json', JSON.stringify(filled))
    const loaded = await loadState(fs, '/tmp/state-full/state.json', lock)
    expect(loaded.totalPlays).toBe(10)
    expect(loaded.stats.easy.totalWins).toBe(2)
    expect(loaded.achievements.first_win).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// saveState
// ---------------------------------------------------------------------------

describe('saveState', () => {
  it('should save and reload state', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const state = makeDefaultState()
    const path = '/tmp/state-save/state.json'
    await saveState(fs, path, state, lock)
    const loaded = await loadState(fs, path, inMemoryLockFactory())
    expect(loaded.version).toBe(1)
    expect(loaded.totalPlays).toBe(0)
  })

  it('should throw StateLockBusyError when lock fails', async () => {
    const fs = memoryFsAdapter()
    const busyLock: LockFactory = {
      acquire: async () => ({ ok: false as const, reason: 'busy' as const }),
      release: async () => {},
      held: () => 0,
    }
    const state = makeDefaultState()
    await expect(
      saveState(fs, '/tmp/state-busy/state.json', state, busyLock),
    ).rejects.toThrow(StateLockBusyError)
  })

  it('should release lock after successful save', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const state = makeDefaultState()
    await saveState(fs, '/tmp/state-rel/state.json', state, lock)
    expect(lock.held()).toBe(0)
  })

  it('should create parent directory', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const state = makeDefaultState()
    const path = '/tmp/state-nested/deep/state.json'
    await saveState(fs, path, state, lock)
    // Verify file was written at the correct path (mkdir is no-op for memory adapter)
    const loaded = await loadState(fs, path, inMemoryLockFactory())
    expect(loaded.version).toBe(1)
  })

  it('should overwrite existing state', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const path = '/tmp/state-overwrite/state.json'
    const state1 = makeDefaultState()
    await saveState(fs, path, state1, lock)

    const state2 = { ...state1, totalPlays: 42 }
    await saveState(fs, path, state2, lock)

    const loaded = await loadState(fs, path, inMemoryLockFactory())
    expect(loaded.totalPlays).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// mergeStats
// ---------------------------------------------------------------------------

describe('mergeStats', () => {
  const zeroStats: PerDifficultyStats = {
    totalPlays: 0,
    totalWins: 0,
    bestTimeMs: null,
    fewestMoves: null,
    lastPlayedAt: null,
  }

  describe('start mode', () => {
    it('should increment totalPlays and update lastPlayedAt', () => {
      const result = mergeStats(zeroStats, {}, 'start')
      expect(result.totalPlays).toBe(1)
      expect(result.totalWins).toBe(0)
      expect(result.lastPlayedAt).toBeTypeOf('number')
    })

    it('should not change bestTimeMs or fewestMoves', () => {
      const result = mergeStats(zeroStats, {}, 'start')
      expect(result.bestTimeMs).toBeNull()
      expect(result.fewestMoves).toBeNull()
    })

    it('should preserve previous totalPlays', () => {
      const prev: PerDifficultyStats = { ...zeroStats, totalPlays: 5, totalWins: 2 }
      const result = mergeStats(prev, {}, 'start')
      expect(result.totalPlays).toBe(6)
      expect(result.totalWins).toBe(2)
    })
  })

  describe('win mode', () => {
    it('should increment totalWins', () => {
      const result = mergeStats(zeroStats, { elapsedMs: 1000, moveCount: 30 }, 'win')
      expect(result.totalWins).toBe(1)
      expect(result.totalPlays).toBe(0)
    })

    it('should set bestTimeMs when elapsedMs provided and previous is null', () => {
      const result = mergeStats(zeroStats, { elapsedMs: 5000 }, 'win')
      expect(result.bestTimeMs).toBe(5000)
    })

    it('should update bestTimeMs when new is lower', () => {
      const prev: PerDifficultyStats = { ...zeroStats, bestTimeMs: 10000 }
      const result = mergeStats(prev, { elapsedMs: 5000 }, 'win')
      expect(result.bestTimeMs).toBe(5000)
    })

    it('should keep bestTimeMs when new is higher', () => {
      const prev: PerDifficultyStats = { ...zeroStats, bestTimeMs: 5000 }
      const result = mergeStats(prev, { elapsedMs: 10000 }, 'win')
      expect(result.bestTimeMs).toBe(5000)
    })

    it('should set fewestMoves when moveCount provided and previous is null', () => {
      const result = mergeStats(zeroStats, { moveCount: 30 }, 'win')
      expect(result.fewestMoves).toBe(30)
    })

    it('should update fewestMoves when new is lower', () => {
      const prev: PerDifficultyStats = { ...zeroStats, fewestMoves: 50 }
      const result = mergeStats(prev, { moveCount: 30 }, 'win')
      expect(result.fewestMoves).toBe(30)
    })

    it('should keep fewestMoves when new is higher', () => {
      const prev: PerDifficultyStats = { ...zeroStats, fewestMoves: 30 }
      const result = mergeStats(prev, { moveCount: 50 }, 'win')
      expect(result.fewestMoves).toBe(30)
    })

    it('should not change bestTimeMs when elapsedMs not provided', () => {
      const prev: PerDifficultyStats = { ...zeroStats, bestTimeMs: 5000 }
      const result = mergeStats(prev, { moveCount: 30 }, 'win')
      expect(result.bestTimeMs).toBe(5000)
    })

    it('should not change fewestMoves when moveCount not provided', () => {
      const prev: PerDifficultyStats = { ...zeroStats, fewestMoves: 30 }
      const result = mergeStats(prev, { elapsedMs: 5000 }, 'win')
      expect(result.fewestMoves).toBe(30)
    })

    it('should update lastPlayedAt', () => {
      const result = mergeStats(zeroStats, {}, 'win')
      expect(result.lastPlayedAt).toBeTypeOf('number')
    })
  })
})

// ---------------------------------------------------------------------------
// unlockAchievements
// ---------------------------------------------------------------------------

describe('unlockAchievements', () => {
  it('should return same state when ids is empty', () => {
    const state = makeDefaultState()
    const result = unlockAchievements(state, [])
    expect(result).toBe(state) // same reference
  })

  it('should add new achievement with unlockedAt timestamp', () => {
    const state = makeDefaultState()
    const result = unlockAchievements(state, ['first_win'])
    expect(result.achievements.first_win).toBeDefined()
    expect(result.achievements.first_win.unlockedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should add multiple achievements', () => {
    const state = makeDefaultState()
    const result = unlockAchievements(state, ['first_win', 'speed_demon'])
    expect(Object.keys(result.achievements)).toHaveLength(2)
    expect(result.achievements.first_win).toBeDefined()
    expect(result.achievements.speed_demon).toBeDefined()
  })

  it('should be idempotent for duplicate ids', () => {
    const state = makeDefaultState()
    const result = unlockAchievements(state, ['first_win', 'first_win'])
    expect(Object.keys(result.achievements)).toHaveLength(1)
  })

  it('should preserve existing achievements', () => {
    const state = makeDefaultState()
    const withExisting = {
      ...state,
      achievements: {
        first_win: { unlockedAt: '2026-01-01T00:00:00.000Z' },
      } as Readonly<Record<AchievementId, { readonly unlockedAt: string }>>,
    }
    const result = unlockAchievements(withExisting, ['speed_demon'])
    expect(result.achievements.first_win.unlockedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(result.achievements.speed_demon).toBeDefined()
  })

  it('should not overwrite existing achievement timestamp', () => {
    const state = makeDefaultState()
    const withExisting = {
      ...state,
      achievements: {
        first_win: { unlockedAt: '2026-01-01T00:00:00.000Z' },
      } as Readonly<Record<AchievementId, { readonly unlockedAt: string }>>,
    }
    const result = unlockAchievements(withExisting, ['first_win'])
    expect(result.achievements.first_win.unlockedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('should return new state object (immutability)', () => {
    const state = makeDefaultState()
    const result = unlockAchievements(state, ['first_win'])
    expect(result).not.toBe(state)
    expect(result.version).toBe(state.version)
  })
})
