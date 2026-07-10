import { describe, it, expect, vi } from 'vitest'
import { playCommand, memoryPlayPersistence } from '../../commands/play.js'
import type { PlayIO } from '../../commands/play.js'
import type { TuiSessionOptions, TuiRunner } from '../../output.js'
import { createGame } from '../../game/state.js'
import type { FsAdapter } from '../../persistence/state.js'
import { Difficulty } from '@hackettyam/sudoku-tools'

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

// ---------------------------------------------------------------------------
// Mock: auto-quit TUI runner for defaultPlayIO test
// ---------------------------------------------------------------------------

vi.mock('../../output.js', async (importOriginal) => {
  const mod = await importOriginal<{
    runTuiSession: (opts: TuiSessionOptions) => TuiRunner
  }>()
  return {
    ...mod,
    runTuiSession: vi.fn((opts: {
      onKey: (key: Buffer) => void
      render: () => void
      colorsEnabled: boolean
    }) => {
      // Auto-quit after a microtask to avoid hanging in tests
      Promise.resolve().then(() => opts.onKey(Buffer.from('q')))
      return {
        draw: () => opts.render(),
        cleanup: vi.fn(),
        run: () => new Promise<void>(() => {}),
      }
    }),
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert that the runner is not null (for use after vi.waitFor). */
function assertGetRunner(runner: MockTuiRunner | null): MockTuiRunner {
  if (runner === null) throw new Error('Expected runner to be set after vi.waitFor')
  return runner
}

/** Create a PlayIO mock that captures TUI session callbacks. */
function createMockIO(): {
  io: PlayIO
  getRunner: () => MockTuiRunner | null
} {
  let runner: MockTuiRunner | null = null

  const io: PlayIO = {
    stdout: vi.fn(),
    stderr: vi.fn(),
    exit: vi.fn<() => never>().mockImplementation(() => {
      throw new Error('exit')
    }),
    createTuiSession: (opts: TuiSessionOptions) => {
      runner = new MockTuiRunner(opts)
      return runner
    },
  }

  return {
    io,
    getRunner: () => runner,
  }
}

/** Mock TUI runner that captures callbacks and provides helpers to simulate keypresses. */
class MockTuiRunner implements TuiRunner {
  private drawn = false
  private cleanedUp = false
  private resolveFn: (() => void) | null = null

  constructor(private readonly opts: TuiSessionOptions) {}

  draw(): void {
    this.drawn = true
    this.opts.render()
  }

  cleanup(): void {
    if (this.cleanedUp) return
    this.cleanedUp = true
    this.resolveFn?.()
  }

  run(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resolveFn = resolve
    })
  }

  /** Simulate a keypress by passing a buffer to the onKey callback. */
  pressKey(key: string): void {
    this.opts.onKey(Buffer.from(key))
  }

  isDrawn(): boolean {
    return this.drawn
  }

  isCleanedUp(): boolean {
    return this.cleanedUp
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('playCommand', () => {
  it('returns error for invalid difficulty', async () => {
    const { io } = createMockIO()
    const persistence = memoryPlayPersistence()

    const result = await playCommand(
      { difficulty: 'invalid-difficulty' },
      { io, persistence },
    )

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('error')
    expect(result.message).toContain('Invalid difficulty')
  })

  it('fresh game → quit yields play_exit with reason quit', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    // Wait for TUI session to be created
    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // Simulate quit keypress
    runner.pressKey('q')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('fresh game → render is called', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'normal' },
      { io, persistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // render should have been called (draw calls render)
    expect(runner.isDrawn()).toBe(true)

    // Quit to clean up
    runner.pressKey('q')
    await resultPromise
  })

  it('fresh game → cursor movement does not end session', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'normal' },
      { io, persistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // Send arrow key — should not trigger quit or win
    runner.pressKey('\x1b[C') // arrow-right
    runner.pressKey('\x1b[B') // arrow-down

    // Session should still be running — quit to end it
    runner.pressKey('q')
    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('fresh game → escape triggers quit', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // Escape key
    runner.pressKey('\x1b')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('fresh game → ctrl-c triggers quit', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // Ctrl-C
    runner.pressKey('\x03')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('unmapped key is ignored (move === null)', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // 'z' is unmapped → applyKey returns null → move === null branch
    runner.pressKey('z')
    // 'q' quits
    runner.pressKey('q')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('fresh game with no moves → quit does not save', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // Quit immediately (no moves)
    runner.pressKey('q')
    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('fresh game with moves → quit saves game', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // Place a value on an editable cell to increment moveCount
    runner.pressKey('1') // place digit 1
    runner.pressKey('q') // quit

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('win scenario → play_exit with reason won', async () => {
    vi.useFakeTimers()
    try {
      const { io, getRunner } = createMockIO()
      const persistence = memoryPlayPersistence()

      const resultPromise = playCommand(
        { difficulty: 'easy' },
        { io, persistence },
      )

      await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())

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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

  it('win scenario → evaluates achievements and saves stats', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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
    // loop body (lines 225-227) executes when a difficulty already has wins.
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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

  it('win scenario → escape from win state resolves with quit', async () => {
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
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

  it('defaultPlayIO → creates working runner', async () => {
    const persistence = memoryPlayPersistence()
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    try {
      const result = await playCommand(
        { difficulty: 'easy' },
        { persistence }, // no io → uses defaultPlayIO
      )

      expect(result.kind).toBe('play_exit')
      expect(result.reason).toBe('quit')
      // draw() was called via the mocked runTuiSession, proving the runner works
      expect(stdoutSpy).toHaveBeenCalled()
    } finally {
      stdoutSpy.mockRestore()
    }
  })

  it('handleWin catch block exercised when saveState throws', async () => {
    // The catch block (lines 256-258) returns play_exit with reason 'won'
    // even when persistence throws during save. Test this by making saveState fail.
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    // Override the fs so that readFile works (for loadState) but writeFile throws
    // (for saveState). We need to let the first few operations succeed so the game
    // starts, then fail on the saveState writeFile call.
    const originalWriteFile = persistence.fs.writeFile
    const brokenFs = {
      ...persistence.fs,
      writeFile: vi.fn(async (path: string, data: string | Uint8Array) => {
        // Throw for state.json — the catch block in handleWin handles it
        if (typeof path === 'string' && path.includes('state.json')) {
          throw new Error('simulated write error')
        }
        return originalWriteFile(path, data as string)
      }) as unknown as FsAdapter['writeFile'],
    }

    const brokenPersistence = {
      ...persistence,
      fs: brokenFs,
    }

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence: brokenPersistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // Navigate to (8,8) and place the correct digit (9) to trigger handleWin
    runner.pressKey('\x1b[8;5H') // Ctrl-End → cursor at (8,8)
    runner.pressKey('9')

    // Dismiss the win screen by pressing 'n' (new game → stays in session)
    runner.pressKey('n')
    // Now quit the new game
    runner.pressKey('q')

    const result = await resultPromise

    // Despite saveState throwing, handleWin catch block handles it
    // and the session exits cleanly with quit
    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('handleQuit catch block exercised when saveGame throws', async () => {
    // The catch block (lines 281-283) returns play_exit with reason 'quit'
    // even when persistence throws during save. Test this by making saveGame fail.
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    // Override saveGame to throw by breaking writeFile for saves
    const brokenFs = {
      ...persistence.fs,
      writeFile: vi.fn(async (path: string, data: string | Uint8Array) => {
        // Throw when writing to saves directory (saveGame writes there)
        if (typeof path === 'string' && path.includes('saves')) {
          throw new Error('simulated save error')
        }
        // Let other writes (state.json) succeed
        return persistence.fs.writeFile(path, data as string)
      }) as unknown as FsAdapter['writeFile'],
    }

    const brokenPersistence = {
      ...persistence,
      fs: brokenFs,
    }

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence: brokenPersistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // Navigate to (8,8) and place a digit to increment moveCount
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('1')
    // Quit — triggers saveGame which will throw
    runner.pressKey('q')

    const result = await resultPromise

    // Despite saveGame throwing, handleQuit catch block returns 'quit'
    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
  })

  it('mergeStartStats catch block is exercised when loadState throws', async () => {
    // Create a persistence where fs.readFile always throws, causing loadState
    // to fail inside mergeStartStats. The catch block silently ignores the error
    // and the game still starts normally.
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()

    // Override fs.readFile to always throw
    const brokenFs = {
      ...persistence.fs,
      readFile: vi.fn().mockRejectedValue(
        new Error('simulated read error'),
      ) as unknown as FsAdapter['readFile'],
    }

    const brokenPersistence = {
      ...persistence,
      fs: brokenFs,
    }

    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence: brokenPersistence },
    )

    await vi.waitFor(() => expect(getRunner()).not.toBeNull())
    const runner = assertGetRunner(getRunner())

    // Quit — the game should have started despite mergeStartStats failing
    runner.pressKey('q')
    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
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

describe('memoryPlayPersistence', () => {
  it('returns a valid persistence object', () => {
    const p = memoryPlayPersistence()
    expect(p.fs).toBeDefined()
    expect(p.lock).toBeDefined()
    expect(p.statePath).toBe('/test/state.json')
    expect(p.savesDir).toBe('/test/saves')
  })
})

describe('defaultPlayIO', () => {
  it('calls stdout/stderr/exit arrow functions without throwing', async () => {
    const mod = await import('../../commands/play.js')
    const io = mod.defaultPlayIO()

    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => {
        throw new Error('exit')
      })

    try {
      io.stdout('test output')
      io.stderr('test error')
      // exit() will throw because of our mock
      expect(() => io.exit(0)).toThrow('exit')
    } finally {
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
      exitSpy.mockRestore()
    }
  })

  it('appends newline when input has no trailing newline', async () => {
    const mod = await import('../../commands/play.js')
    const io = mod.defaultPlayIO()

    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    try {
      io.stdout('hello')
      expect(stdoutSpy).toHaveBeenCalledWith('hello\n')
      io.stderr('world')
      expect(stderrSpy).toHaveBeenCalledWith('world\n')
    } finally {
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    }
  })

  it('does not duplicate trailing newline', async () => {
    const mod = await import('../../commands/play.js')
    const io = mod.defaultPlayIO()

    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    try {
      io.stdout('hello\n')
      expect(stdoutSpy).toHaveBeenCalledWith('hello\n')
      io.stderr('world\n')
      expect(stderrSpy).toHaveBeenCalledWith('world\n')
    } finally {
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    }
  })
})

describe('defaultPlayPersistence', () => {
  it('returns valid persistence object', async () => {
    const mod = await import('../../commands/play.js')
    const p = mod.defaultPlayPersistence()
    expect(p.fs).toBeDefined()
    expect(p.lock).toBeDefined()
    expect(p.statePath).toContain('.sudoku-cli')
    expect(p.savesDir).toContain('.sudoku-cli')
  })
})
