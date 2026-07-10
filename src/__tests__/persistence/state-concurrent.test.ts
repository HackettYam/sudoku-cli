import { rm, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLock, inMemoryLockFactory } from '../../persistence/lock.js'
import { loadState, saveState, mergeStats, nodeFsAdapter } from '../../persistence/state.js'
import type { StateFile, PerDifficultyStats } from '../../persistence/state.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTmpDir(): Promise<{
  dir: string
  cleanup: () => Promise<void>
}> {
  const dir = await mkdtemp(join(tmpdir(), `concurrent-test-${randomUUID()}-`))
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}

function emptyStats(): PerDifficultyStats {
  return {
    totalPlays: 0,
    totalWins: 0,
    bestTimeMs: null,
    fewestMoves: null,
    lastPlayedAt: null,
  }
}

function emptyState(): StateFile {
  return {
    version: 1,
    stats: {
      novice: emptyStats(),
      easy: emptyStats(),
      normal: emptyStats(),
      hard: emptyStats(),
      expert: emptyStats(),
    },
    totalPlays: 0,
    achievements: {} as StateFile['achievements'],
    lastSaveId: null,
  }
}

// ---------------------------------------------------------------------------
// Concurrent lock tests — two lock instances on the same file
// ---------------------------------------------------------------------------

describe('concurrent state writes — lock contention', () => {
  let tmpDir: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ dir: tmpDir, cleanup } = await makeTmpDir())
  })

  afterEach(async () => {
    await cleanup()
  })

  it('second lock acquire gets timeout when first holds lock', async () => {
    const statePath = join(tmpDir, 'state.json')
    await writeFile(statePath, JSON.stringify(emptyState()))

    const lock1 = createLock(statePath)
    const lock2 = createLock(statePath, { retries: 0 })

    const first = await lock1.acquire()
    expect(first.ok).toBe(true)

    // Second instance should fail (retries: 0 → timeout)
    const second = await lock2.acquire()
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.reason).toBe('timeout')
    }

    // Release first and re-acquire should succeed
    if (first.ok) await lock1.release(first.handle)

    const third = await lock2.acquire()
    expect(third.ok).toBe(true)
    if (third.ok) await lock2.release(third.handle)
  })

  it('releasing one lock allows another instance to acquire', async () => {
    const statePath = join(tmpDir, 'state.json')
    await writeFile(statePath, JSON.stringify(emptyState()))

    const lock1 = createLock(statePath)
    const lock2 = createLock(statePath, { retries: 0 })

    // Hold lock1
    const first = await lock1.acquire()
    expect(first.ok).toBe(true)

    // lock2 fails
    const fail = await lock2.acquire()
    expect(fail.ok).toBe(false)

    // Release lock1
    if (first.ok) await lock1.release(first.handle)

    // lock2 now succeeds
    const second = await lock2.acquire()
    expect(second.ok).toBe(true)
    if (second.ok) await lock2.release(second.handle)
  })
})

// ---------------------------------------------------------------------------
// Sequential merge via loadState/saveState — no corruption
// ---------------------------------------------------------------------------

describe('sequential mergeStats produces consistent state', () => {
  let tmpDir: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ dir: tmpDir, cleanup } = await makeTmpDir())
  })

  afterEach(async () => {
    await cleanup()
  })

  it('should accumulate stats correctly across multiple saves', async () => {
    const statePath = join(tmpDir, 'state.json')
    const fs = nodeFsAdapter
    const lock = inMemoryLockFactory()

    // Load default state (file does not exist yet)
    let state = await loadState(fs, statePath, lock)
    expect(state.totalPlays).toBe(0)

    // Save initial empty state so the file exists on disk
    await saveState(fs, statePath, state, lock)

    // --- Play 1: start (novice) ---
    const startStats1 = mergeStats(state.stats.novice, {}, 'start')
    state = {
      ...state,
      totalPlays: 1,
      stats: { ...state.stats, novice: startStats1 },
    }
    await saveState(fs, statePath, state, lock)

    // --- Play 2: start (novice) ---
    const startStats2 = mergeStats(state.stats.novice, {}, 'start')
    state = {
      ...state,
      totalPlays: 2,
      stats: { ...state.stats, novice: startStats2 },
    }
    await saveState(fs, statePath, state, lock)

    // --- Play 3: win (novice) — elapsedMs=60000, moveCount=30 ---
    const winStats = mergeStats(state.stats.novice, { elapsedMs: 60000, moveCount: 30 }, 'win')
    state = {
      ...state,
      // totalPlays stays 2 — win mode does not increment
      stats: { ...state.stats, novice: winStats },
    }
    await saveState(fs, statePath, state, lock)

    // Reload from disk and verify final state
    const final = await loadState(fs, statePath, lock)
    expect(final.totalPlays).toBe(2)
    expect(final.stats.novice.totalPlays).toBe(2)
    expect(final.stats.novice.totalWins).toBe(1)
    expect(final.stats.novice.bestTimeMs).toBe(60000)
    expect(final.stats.novice.fewestMoves).toBe(30)
  })

  it('should persist wins with no elapsedMs/moveCount as null bests', async () => {
    const statePath = join(tmpDir, 'state.json')
    const fs = nodeFsAdapter
    const lock = inMemoryLockFactory()

    let state = await loadState(fs, statePath, lock)
    await saveState(fs, statePath, state, lock)

    // Play + win with no timing/move data
    state = { ...state, totalPlays: 1, stats: { ...state.stats, novice: mergeStats(state.stats.novice, {}, 'start') } }
    await saveState(fs, statePath, state, lock)

    state = { ...state, stats: { ...state.stats, novice: mergeStats(state.stats.novice, {}, 'win') } }
    await saveState(fs, statePath, state, lock)

    const final = await loadState(fs, statePath, lock)
    expect(final.stats.novice.totalPlays).toBe(1)
    expect(final.stats.novice.totalWins).toBe(1)
    expect(final.stats.novice.bestTimeMs).toBeNull()
    expect(final.stats.novice.fewestMoves).toBeNull()
  })

  it('should preserve earlier best when new win is worse', async () => {
    const statePath = join(tmpDir, 'state.json')
    const fs = nodeFsAdapter
    const lock = inMemoryLockFactory()

    let state = await loadState(fs, statePath, lock)
    await saveState(fs, statePath, state, lock)

    // Start + win with best time 30000ms
    state = { ...state, totalPlays: 1, stats: { ...state.stats, novice: mergeStats(state.stats.novice, {}, 'start') } }
    const winStats1 = mergeStats(
      state.stats.novice,
      { elapsedMs: 30000, moveCount: 20 },
      'win',
    )
    state = { ...state, stats: { ...state.stats, novice: winStats1 } }
    await saveState(fs, statePath, state, lock)

    // Start + win with worse time 60000ms
    state = {
      ...state,
      totalPlays: 2,
      stats: {
        ...state.stats,
        novice: mergeStats(state.stats.novice, {}, 'start'),
      },
    }
    const winStats2 = mergeStats(
      state.stats.novice,
      { elapsedMs: 60000, moveCount: 40 },
      'win',
    )
    state = { ...state, stats: { ...state.stats, novice: winStats2 } }
    await saveState(fs, statePath, state, lock)

    const final = await loadState(fs, statePath, lock)
    expect(final.stats.novice.totalPlays).toBe(2)
    expect(final.stats.novice.totalWins).toBe(2)
    expect(final.stats.novice.bestTimeMs).toBe(30000)
    expect(final.stats.novice.fewestMoves).toBe(20)
  })

  it('should handle interleaved difficulties independently', async () => {
    const statePath = join(tmpDir, 'state.json')
    const fs = nodeFsAdapter
    const lock = inMemoryLockFactory()

    let state = await loadState(fs, statePath, lock)
    await saveState(fs, statePath, state, lock)

    // Play novice
    state = { ...state, totalPlays: 1, stats: { ...state.stats, novice: mergeStats(state.stats.novice, {}, 'start') } }
    await saveState(fs, statePath, state, lock)

    // Play easy
    state = { ...state, totalPlays: 2, stats: { ...state.stats, easy: mergeStats(state.stats.easy, {}, 'start') } }
    await saveState(fs, statePath, state, lock)

    // Win easy
    const easyWinStats = mergeStats(
      state.stats.easy,
      { elapsedMs: 45000, moveCount: 25 },
      'win',
    )
    state = {
      ...state,
      stats: { ...state.stats, easy: easyWinStats },
    }
    await saveState(fs, statePath, state, lock)

    // Play hard
    state = { ...state, totalPlays: 3, stats: { ...state.stats, hard: mergeStats(state.stats.hard, {}, 'start') } }
    await saveState(fs, statePath, state, lock)

    const final = await loadState(fs, statePath, lock)
    expect(final.totalPlays).toBe(3)
    expect(final.stats.novice.totalPlays).toBe(1)
    expect(final.stats.novice.totalWins).toBe(0)
    expect(final.stats.easy.totalPlays).toBe(1)
    expect(final.stats.easy.totalWins).toBe(1)
    expect(final.stats.easy.bestTimeMs).toBe(45000)
    expect(final.stats.hard.totalPlays).toBe(1)
    expect(final.stats.hard.totalWins).toBe(0)
    expect(final.stats.normal.totalPlays).toBe(0)
    expect(final.stats.expert.totalPlays).toBe(0)
  })
})
