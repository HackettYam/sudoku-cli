import { randomUUID } from 'node:crypto'
import { rm, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Difficulty } from '@hackettyam/sudoku-tools'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createLock, inMemoryLockFactory } from '../../persistence/lock.js'
import type { LockFactory } from '../../persistence/lock.js'
import {
  loadState,
  saveState,
  mergeStats,
  updateState,
  nodeFsAdapter,
} from '../../persistence/state.js'
import type { FsAdapter, StateFile, PerDifficultyStats } from '../../persistence/state.js'

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

interface StateTestContext {
  readonly fs: FsAdapter
  readonly statePath: string
  readonly lock: LockFactory
}

interface StartStateOptions {
  readonly context: StateTestContext
  readonly state: StateFile
  readonly difficulty: keyof StateFile['stats']
  readonly totalPlays: number
}

async function saveStartedState(options: StartStateOptions): Promise<StateFile> {
  const { context, state, difficulty, totalPlays } = options
  const next = {
    ...state,
    totalPlays,
    stats: { ...state.stats, [difficulty]: mergeStats(state.stats[difficulty], {}, 'start') },
  }
  await saveState(context.fs, context.statePath, next, context.lock)
  return next
}

interface WinStateOptions {
  readonly context: StateTestContext
  readonly state: StateFile
  readonly difficulty: keyof StateFile['stats']
  readonly details: Parameters<typeof mergeStats>[1]
}

async function saveWonState(options: WinStateOptions): Promise<StateFile> {
  const { context, state, difficulty, details } = options
  const next = {
    ...state,
    stats: { ...state.stats, [difficulty]: mergeStats(state.stats[difficulty], details, 'win') },
  }
  await saveState(context.fs, context.statePath, next, context.lock)
  return next
}

async function assertStaleReleaseIsIgnored(lock: LockFactory): Promise<void> {
  const first = await lock.acquire()
  if (!first.ok) throw new Error('expected first acquire to succeed')

  await lock.release(first.handle)

  const second = await lock.acquire()
  if (!second.ok) throw new Error('expected second acquire to succeed')

  await lock.release(first.handle)
  expect(lock.held()).toBe(1)

  await lock.release(second.handle)
  expect(lock.held()).toBe(0)
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

  it('stale filesystem release cannot unlock a newer acquired handle', async () => {
    const statePath = join(tmpDir, 'state.json')
    await writeFile(statePath, JSON.stringify(emptyState()))

    await assertStaleReleaseIsIgnored(createLock(statePath))
  })

  it('stale in-memory release cannot unlock a newer acquired handle', async () => {
    await assertStaleReleaseIsIgnored(inMemoryLockFactory())
  })

  it('failed release resets held state and permits a later acquire', async () => {
    const statePath = join(tmpDir, 'state.json')
    await writeFile(statePath, JSON.stringify(emptyState()))

    const lock = createLock(statePath)
    const first = await lock.acquire()
    if (!first.ok) throw new Error('expected first acquire to succeed')

    const lockPath = `${statePath}.lock`
    await rm(lockPath, { recursive: true, force: true })
    await writeFile(lockPath, 'not-a-directory')

    await expect(lock.release(first.handle)).rejects.toThrow()
    expect(lock.held()).toBe(0)

    await rm(lockPath, { force: true })
    const second = await lock.acquire()
    expect(second.ok).toBe(true)
    if (second.ok) await lock.release(second.handle)
  })

  it('keeps bounded retry contention reusable after the holder releases', async () => {
    const statePath = join(tmpDir, 'state.json')
    await writeFile(statePath, JSON.stringify(emptyState()))

    const holder = createLock(statePath)
    const contender = createLock(statePath, { retries: 2 })
    const first = await holder.acquire()
    if (!first.ok) throw new Error('expected holder acquire to succeed')

    const failed = await contender.acquire()
    expect(failed).toEqual({ ok: false, reason: 'busy' })
    expect(contender.held()).toBe(0)

    await holder.release(first.handle)
    const second = await contender.acquire()
    expect(second.ok).toBe(true)
    if (second.ok) await contender.release(second.handle)
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
    const context = { fs: nodeFsAdapter, statePath, lock: inMemoryLockFactory() }

    // Load default state (file does not exist yet)
    let state = await loadState(context.fs, statePath, context.lock)
    expect(state.totalPlays).toBe(0)

    // Save initial empty state so the file exists on disk
    await saveState(context.fs, statePath, state, context.lock)

    // --- Play 1: start (novice) ---
    state = await saveStartedState({ context, state, difficulty: Difficulty.Novice, totalPlays: 1 })

    // --- Play 2: start (novice) ---
    state = await saveStartedState({ context, state, difficulty: Difficulty.Novice, totalPlays: 2 })

    // --- Play 3: win (novice) — elapsedMs=60000, moveCount=30 ---
    state = await saveWonState({
      context,
      state,
      difficulty: Difficulty.Novice,
      details: { elapsedMs: 60000, moveCount: 30 },
    })

    // Reload from disk and verify final state
    const final = await loadState(context.fs, statePath, context.lock)
    expect(final).toMatchObject({
      totalPlays: 2,
      stats: { novice: { totalPlays: 2, totalWins: 1, bestTimeMs: 60000, fewestMoves: 30 } },
    })
  })

  it('should persist wins with no elapsedMs/moveCount as null bests', async () => {
    const statePath = join(tmpDir, 'state.json')
    const context = { fs: nodeFsAdapter, statePath, lock: inMemoryLockFactory() }

    let state = await loadState(context.fs, statePath, context.lock)
    await saveState(context.fs, statePath, state, context.lock)

    // Play + win with no timing/move data
    state = await saveStartedState({ context, state, difficulty: Difficulty.Novice, totalPlays: 1 })

    state = await saveWonState({ context, state, difficulty: Difficulty.Novice, details: {} })

    const final = await loadState(context.fs, statePath, context.lock)
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
    const context = { fs: nodeFsAdapter, statePath, lock: inMemoryLockFactory() }

    let state = await loadState(context.fs, statePath, context.lock)
    await saveState(context.fs, statePath, state, context.lock)

    // Play novice
    state = await saveStartedState({ context, state, difficulty: Difficulty.Novice, totalPlays: 1 })

    // Play easy
    state = await saveStartedState({ context, state, difficulty: Difficulty.Easy, totalPlays: 2 })

    // Win easy
    state = await saveWonState({
      context,
      state,
      difficulty: Difficulty.Easy,
      details: { elapsedMs: 45000, moveCount: 25 },
    })

    // Play hard
    state = await saveStartedState({ context, state, difficulty: Difficulty.Hard, totalPlays: 3 })

    const final = await loadState(context.fs, statePath, context.lock)
    expect(final).toMatchObject({
      totalPlays: 3,
      stats: {
        novice: { totalPlays: 1, totalWins: 0 },
        easy: { totalPlays: 1, totalWins: 1, bestTimeMs: 45000 },
        hard: { totalPlays: 1, totalWins: 0 },
        normal: { totalPlays: 0 },
        expert: { totalPlays: 0 },
      },
    })
  })
})

// ---------------------------------------------------------------------------
// Atomic updateState concurrency regression
// ---------------------------------------------------------------------------

describe('concurrent state updates', () => {
  it('serializes concurrent updateState transactions without lost updates', async () => {
    const { dir, cleanup } = await makeTmpDir()
    try {
      const statePath = join(dir, 'state.json')
      await saveState(nodeFsAdapter, statePath, emptyState(), createLock(statePath))

      const increment = async (): Promise<void> => {
        await updateState(
          nodeFsAdapter,
          statePath,
          createLock(statePath, { retries: 20 }),
          (state) => ({
            state: {
              ...state,
              totalPlays: state.totalPlays + 1,
              stats: {
                ...state.stats,
                novice: mergeStats(state.stats.novice, {}, 'start'),
              },
            },
            result: undefined,
          }),
        )
      }

      await Promise.all([increment(), increment()])

      const final = await loadState(nodeFsAdapter, statePath, createLock(statePath))
      expect(final.totalPlays).toBe(2)
      expect(final.stats.novice.totalPlays).toBe(2)
    } finally {
      await cleanup()
    }
  })
})
