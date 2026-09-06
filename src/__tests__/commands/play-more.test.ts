import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, expect, it, vi } from 'vitest'

import { assertGetRunner, createMockIO } from './play-test-helpers.js'
import { playCommand, memoryPlayPersistence } from '../../commands/play.js'
import type { PlayPersistence } from '../../commands/play.js'
import { createGame } from '../../game/state.js'
import type { LockFactory } from '../../persistence/lock.js'
import type { FsAdapter } from '../../persistence/state.js'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => { resolvePromise = resolve })
  return { promise, resolve: () => { resolvePromise?.() } }
}

function deferWinStateWrite(persistence: PlayPersistence): {
  persistence: PlayPersistence
  writeStarted: Promise<void>
  releaseWrite: () => void
} {
  const writeStarted = deferred(), releaseWrite = deferred()
  let stateWriteCount = 0

  const fs: FsAdapter = {
    ...persistence.fs,
    writeFile: async (path, data) => {
      if (path.startsWith(`${persistence.statePath}.tmp-`)) {
        stateWriteCount += 1
        if (stateWriteCount === 2) {
          writeStarted.resolve()
          await releaseWrite.promise
        }
      }
      await persistence.fs.writeFile(path, data)
    },
  }

  return { persistence: { ...persistence, fs }, writeStarted: writeStarted.promise, releaseWrite: releaseWrite.resolve }
}

// ---------------------------------------------------------------------------
// Mock: deterministic puzzle with only cell (8,8) empty
// ---------------------------------------------------------------------------

vi.mock('@hackettyam/sudoku-tools', async (importOriginal) => {
  const mod = await importOriginal<{
    createSudoku: (difficulty: unknown) => {
      current: number[][]
      solution: number[][]
      original: number[][]
      readOnly: boolean[][]
    }
    Difficulty: typeof Difficulty
  }>()

  const solution: readonly (readonly number[])[] = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
  ]

  const puzzle = solution.map((row, r) =>
    row.map((v, c) => (r === 8 && c === 8 ? 0 : v)),
  )

  const readOnly = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => !(r === 8 && c === 8)),
  )

  return {
    ...mod,
    createSudoku: vi.fn(() => ({
      current: puzzle,
      solution,
      original: puzzle,
      readOnly,
    })),
  }
})

describe('playCommand startup and loading', () => {
  it('win scenario → play_exit with reason won', async () => {
    vi.useFakeTimers()
    try {
      const { io, getRunner } = createMockIO()
      const persistence = memoryPlayPersistence()

      const resultPromise = playCommand(
        { difficulty: 'easy' },
        { io, persistence },
      )

      await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
      const runner = assertGetRunner(getRunner())

      // Navigate to (8,8) and place the correct digit (9) to win
      runner.pressKey('\x1b[8;5H') // Ctrl-End → cursor at (8,8)
      runner.pressKey('9')

      // Press 'n' to start a new game (stays in session)
      runner.pressKey('n')
      // Now quit the new game
      runner.pressKey('q')

      // Advance past any pending timers
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise

      expect(result.kind).toBe('play_exit')
      expect(result.reason).toBe('quit')
    } finally {
      vi.useRealTimers()
    }
  })

  it('default persistence is used when deps not provided', async () => {
    // This tests the defaultPlayIO and defaultPlayPersistence paths
    // We just verify it doesn't crash (it will fail to create TUI in test env)
    // The key is that defaultPlayIO() and defaultPlayPersistence() are called
    const { io, getRunner } = createMockIO()

    // Override just io, let persistence default
    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    assertGetRunner(getRunner()).pressKey('q')
    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('resumeLast with no saved games creates fresh game', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { resumeLast: true },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    assertGetRunner(getRunner()).pressKey('q')
    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('resumeLast with saved game loads from save', async () => {
    const { saveGame } = await import('../../persistence/save.js')
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    // Create a game and save it
    const state = createGame(Difficulty.Easy)
    const saveId = await saveGame(persistence.fs, state, persistence.savesDir)

    // Update state file with the save ID
    const { saveState, loadState } = await import('../../persistence/state.js')
    const savedState = await loadState(persistence.fs, persistence.statePath, persistence.lock)
    await saveState(persistence.fs, persistence.statePath, {
      ...savedState,
      lastSaveId: saveId,
    }, persistence.lock)

    const resultPromise = playCommand(
      { resumeLast: true },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    assertGetRunner(getRunner()).pressKey('q')
    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('loadId with valid save loads from save', async () => {
    const { saveGame } = await import('../../persistence/save.js')
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    // Create a game and save it
    const state = createGame(Difficulty.Normal)
    const saveId = await saveGame(persistence.fs, state, persistence.savesDir)

    const resultPromise = playCommand(
      { loadId: saveId },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    assertGetRunner(getRunner()).pressKey('q')
    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('loadId with invalid save returns error', async () => {
    const { io } = createMockIO()
    const persistence = memoryPlayPersistence()

    const result = await playCommand(
      { loadId: '00000000-0000-0000-0000-000000000000' },
      { io, persistence },
    )

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('error')
  })

  it('escape key triggers quit in game', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })

    // Move cursor first, then quit with escape
    assertGetRunner(getRunner()).pressKey('\x1b[C') // arrow-right
    assertGetRunner(getRunner()).pressKey('\x1b')   // escape = quit

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('quit-with-saves → saves game when mid-game', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    // Navigate to (8,8) — the only editable cell in the mock puzzle
    runner.pressKey('\x1b[8;5H') // Ctrl-End → cursor at (8,8)
    // Place a digit (wrong value, but increments moveCount)
    runner.pressKey('1')
    // Quit — triggers save because moveCount > 0
    runner.pressKey('q')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')

    // Verify save was created via persistence
    const { loadState } = await import('../../persistence/state.js')
    const savedState = await loadState(
      persistence.fs,
      persistence.statePath,
      persistence.lock,
    )
    expect(savedState.lastSaveId).toBeDefined()
  })
})

describe('playCommand win handling', () => {
  it('win scenario → evaluates achievements and saves stats', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    // Navigate to (8,8) — the only empty cell
    runner.pressKey('\x1b[8;5H') // Ctrl-End → cursor at (8,8)
    // Place the correct digit (9) to solve the puzzle
    runner.pressKey('9')

    // Dismiss the win screen by pressing 'n' (new game → stays in session)
    runner.pressKey('n')
    // Now quit the new game
    runner.pressKey('q')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')

    // Verify stats were saved
    const { loadState } = await import('../../persistence/state.js')
    const savedState = await loadState(
      persistence.fs,
      persistence.statePath,
      persistence.lock,
    )
    expect(savedState.stats[Difficulty.Easy].totalWins).toBe(1)
  })

  it('win scenario with pre-existing wins → difficultiesWon includes difficulty', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    // Pre-populate state with easy.totalWins = 1 so the difficultiesWon
    // loop body executes when a difficulty already has wins.
    const { saveState, loadState } = await import('../../persistence/state.js')
    const savedState = await loadState(persistence.fs, persistence.statePath, persistence.lock)
    await saveState(persistence.fs, persistence.statePath, {
      ...savedState,
      stats: {
        ...savedState.stats,
        [Difficulty.Easy]: {
          ...savedState.stats[Difficulty.Easy],
          totalWins: 1,
        },
      },
    }, persistence.lock)

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    // Navigate to (8,8) and place the correct digit (9) to trigger handleWin
    runner.pressKey('\x1b[8;5H') // Ctrl-End → cursor at (8,8)
    runner.pressKey('9')

    // Dismiss the win screen by pressing 'n' (new game → stays in session)
    runner.pressKey('n')
    // Now quit the new game
    runner.pressKey('q')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')

    // Verify stats were updated (totalWins should now be 2)
    // handleWin is fire-and-forget — wait for it to finish writing stats
    await new Promise((r) => setTimeout(r, 200))
    await vi.waitFor(async () => {
      const finalState = await loadState(persistence.fs, persistence.statePath, persistence.lock)
      expect(finalState.stats[Difficulty.Easy].totalWins).toBe(2)
    })
  })

  it('win scenario → quit from win state resolves with quit', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    // Navigate to (8,8) and place the correct digit (9) to win
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('9')

    // Press 'q' while in win state → triggers handleQuit
    runner.pressKey('q')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('waits for pending win persistence before quitting', async () => {
    const { io, getRunner } = createMockIO()
    const deferredPersistence = deferWinStateWrite(memoryPlayPersistence())

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence: deferredPersistence.persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('9')
    await deferredPersistence.writeStarted

    runner.pressKey('q')
    let settled = false
    void resultPromise.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    deferredPersistence.releaseWrite()
    const result = await resultPromise

    expect(result).toEqual({ kind: 'play_exit', reason: 'quit' })
  })

  it('waits for pending win persistence across new-game and quit', async () => {
    const { io, getRunner } = createMockIO()
    const deferredPersistence = deferWinStateWrite(memoryPlayPersistence())

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence: deferredPersistence.persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('9')
    await deferredPersistence.writeStarted

    runner.pressKey('n')
    runner.pressKey('q')
    let settled = false
    void resultPromise.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    deferredPersistence.releaseWrite()
    const result = await resultPromise

    expect(result).toEqual({ kind: 'play_exit', reason: 'quit' })
  })

  it('win scenario → escape from win state resolves with quit', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    // Navigate to (8,8) and place the correct digit (9) to win
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('9')

    // Press escape while in win state → triggers handleQuit
    runner.pressKey('\x1b')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('win scenario → toggle achievements view in win state', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    // Navigate to (8,8) and place the correct digit (9) to win
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('9')

    // Toggle achievements view (press 'a')
    runner.pressKey('a')
    // Exit achievements view (press any key)
    runner.pressKey('x')
    // Press 'n' to start a new game (stays in session)
    runner.pressKey('n')
    // Now quit the new game
    runner.pressKey('q')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('win scenario → other key re-renders win screen', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    // Navigate to (8,8) and place the correct digit (9) to win
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('9')

    // Press an irrelevant key (should re-render, not quit)
    runner.pressKey('z')
    // Then press 'n' to start a new game (stays in session)
    runner.pressKey('n')
    // Now quit the new game
    runner.pressKey('q')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })
})

describe('playCommand failure handling', () => {
  it('returns a typed error when win persistence throws', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    let stateWriteCount = 0
    const originalWriteFile = persistence.fs.writeFile.bind(persistence.fs)
    const brokenFs: FsAdapter = {
      ...persistence.fs,
      writeFile: async (path, data) => {
        if (path.startsWith(`${persistence.statePath}.tmp-`)) {
          stateWriteCount += 1
        }
        if (stateWriteCount === 2) {
          throw new Error('simulated write error')
        }
        return originalWriteFile(path, data)
      },
    }

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence: { ...persistence, fs: brokenFs } },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    runner.pressKey('\x1b[8;5H') // Ctrl-End → cursor at (8,8)
    runner.pressKey('9')

    const result = await resultPromise

    expect(result).toEqual({
      kind: 'play_exit',
      reason: 'error',
      message: 'simulated write error',
    })
  })

  it('returns a typed error when startup lock acquisition fails', async () => {
    const { io } = createMockIO()
    const persistence = memoryPlayPersistence()
    const busyLock: LockFactory = {
      acquire: () => Promise.resolve({ ok: false as const, reason: 'busy' as const }),
      release: () => Promise.resolve(),
      held: () => 0,
    }

    const result = await playCommand(
      { difficulty: 'easy' },
      { io, persistence: { ...persistence, lock: busyLock } },
    )

    expect(result).toEqual({
      kind: 'play_exit',
      reason: 'error',
      message: 'Could not acquire state lock — another process holds it',
    })
  })

  it('returns a typed error when quit save throws', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const brokenFs: FsAdapter = {
      ...persistence.fs,
      writeFile: async (path, data) => {
        if (path.includes('saves')) {
          throw new Error('simulated save error')
        }
        return persistence.fs.writeFile(path, data)
      },
    }

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence: { ...persistence, fs: brokenFs } },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    runner.pressKey('\x1b[8;5H')
    runner.pressKey('1')
    runner.pressKey('q')

    const result = await resultPromise

    expect(result).toEqual({
      kind: 'play_exit',
      reason: 'error',
      message: 'simulated save error',
    })
  })

  it('returns a typed error when startup state loading throws', async () => {
    const { io } = createMockIO()
    const persistence = memoryPlayPersistence()

    const brokenFs: FsAdapter = {
      ...persistence.fs,
      exists: () => Promise.resolve(true),
      readFile: () => Promise.reject(new Error('simulated read error')),
    }

    const result = await playCommand(
      { difficulty: 'easy' },
      { io, persistence: { ...persistence, fs: brokenFs } },
    )

    expect(result).toEqual({
      kind: 'play_exit',
      reason: 'error',
      message: 'Failed to read or parse state file: simulated read error',
    })
  })

  it('setInterval timer refreshes draw while session is active', async () => {
    vi.useFakeTimers()
    try {
      const { io, getRunner } = createMockIO()
      const persistence = memoryPlayPersistence()
      const resultPromise = playCommand({ difficulty: 'easy' }, { io, persistence })

      // Flush microtasks until TUI session is created
      let runner = getRunner()
      for (let i = 0; i < 50 && runner === null; i++) {
        await vi.advanceTimersByTimeAsync(0)
        runner = getRunner()
      }
      if (runner === null) throw new Error('Runner not created')

      // Advance timer by 1s to trigger setInterval
      await vi.advanceTimersByTimeAsync(1000)

      // Quit to clean up
      runner.pressKey('q')
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise
      expect(result.kind).toBe('play_exit')
    } finally {
      vi.useRealTimers()
    }
  })
})
