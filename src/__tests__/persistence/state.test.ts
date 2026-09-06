import { describe, it, expect } from 'vitest'

import type { AchievementId } from '../../persistence/achievements.js'
import { inMemoryLockFactory } from '../../persistence/lock.js'
import type { LockFactory } from '../../persistence/lock.js'
import {
  StateLockBusyError,
  memoryFsAdapter,
  nodeFsAdapter,
  defaultStatePath,
  defaultSavesDir,
  defaultStateLockPath,
  loadState,
  saveState,
  updateState,
  mergeStats,
  unlockAchievements,
} from '../../persistence/state.js'
import type { FsAdapter, StateFile, PerDifficultyStats } from '../../persistence/state.js'

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
    const methods: readonly (keyof FsAdapter)[] = ['readFile', 'writeFile', 'mkdir', 'rename', 'readdir', 'exists']
    for (const method of methods) {
      expect(typeof nodeFsAdapter[method]).toBe('function')
    }
  })
})

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

describe('defaultStatePath', () => {
  it('should return a path ending with .sudoku-cli/state.json', () => {
    expect(defaultStatePath()).toContain('.sudoku-cli/state.json')
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
      acquire: () => Promise.resolve({ ok: false as const, reason: 'busy' as const }),
      release: () => Promise.resolve(),
      held: () => 0,
    }
    const state = makeDefaultState()
    await expect(
      saveState(fs, '/tmp/state-busy/state.json', state, busyLock),
    ).rejects.toThrow(StateLockBusyError)
  })

  it('should preserve the original state and release the lock when the atomic write fails', async () => {
    const baseFs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const path = '/tmp/state-atomic/state.json'
    const original = { ...makeDefaultState(), totalPlays: 1 }
    const originalJson = JSON.stringify(original)
    await baseFs.writeFile(path, originalJson)

    const failingFs: FsAdapter = {
      ...baseFs,
      writeFile(filePath, data) {
        if (filePath.startsWith(`${path}.tmp-`)) {
          return Promise.reject(new Error('disk full'))
        }
        return baseFs.writeFile(filePath, data)
      },
    }

    await expect(
      saveState(failingFs, path, { ...original, totalPlays: 2 }, lock),
    ).rejects.toThrow('disk full')
    expect(await baseFs.readFile(path)).toBe(originalJson)
    expect(lock.held()).toBe(0)
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
// updateState
// ---------------------------------------------------------------------------

describe('updateState', () => {
  it('succeeds when the parent directory already exists', async () => {
    // Arrange
    const baseFs = memoryFsAdapter()
    const fs: FsAdapter = {
      ...baseFs,
      mkdir: () => Promise.reject(
        Object.assign(new Error('directory already exists'), { code: 'EEXIST' as const }),
      ),
    }
    const lock = inMemoryLockFactory()

    // Act
    const result = await updateState(
      fs,
      '/tmp/state-update-eexist/state.json',
      lock,
      (state) => ({
        state: { ...state, totalPlays: state.totalPlays + 1 },
        result: 'updated' as const,
      }),
    )

    // Assert
    expect(result).toBe('updated')
    expect(lock.held()).toBe(0)
  })

  it('rejects a non-EEXIST mkdir error and leaves the lock released', async () => {
    // Arrange
    const baseFs = memoryFsAdapter()
    const mkdirError = Object.assign(new Error('permission denied'), { code: 'EACCES' as const })
    const fs: FsAdapter = {
      ...baseFs,
      mkdir: () => Promise.reject(mkdirError),
    }
    const lock = inMemoryLockFactory()

    // Act
    const update = updateState(
      fs,
      '/tmp/state-update-error/state.json',
      lock,
      (state) => ({ state, result: undefined }),
    )

    // Assert
    await expect(update).rejects.toBe(mkdirError)
    expect(lock.held()).toBe(0)
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
