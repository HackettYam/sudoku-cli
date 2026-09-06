import type { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, it, expect, vi } from 'vitest'

import { assertGetRunner, createMockIO } from './play-test-helpers.js'
import { playCommand, memoryPlayPersistence } from '../../commands/play.js'
import type { TuiSessionOptions, TuiRunner } from '../../output.js'

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
      void Promise.resolve().then(() => { opts.onKey(Buffer.from('q')) })
      return {
        draw: () => { opts.render() },
        cleanup: vi.fn(),
        run: () => new Promise<void>(() => {}),
      }
    }),
  }
})

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

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())
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

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())
    expect(runner.isDrawn()).toBe(true)

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

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())
    runner.pressKey('\x1b[C')
    runner.pressKey('\x1b[B')
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

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    assertGetRunner(getRunner()).pressKey('\x1b')

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

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    assertGetRunner(getRunner()).pressKey('\x03')

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

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())
    runner.pressKey('z')
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

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    assertGetRunner(getRunner()).pressKey('q')
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

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())
    runner.pressKey('1')
    runner.pressKey('q')

    const result = await resultPromise

    expect(result.kind).toBe('play_exit')
    expect(result.reason).toBe('quit')
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
  it('defaultPlayIO → creates working runner', async () => {
    const persistence = memoryPlayPersistence()
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    try {
      const result = await playCommand(
        { difficulty: 'easy' },
        { persistence },
      )

      expect(result.kind).toBe('play_exit')
      expect(result.reason).toBe('quit')
      expect(stdoutSpy).toHaveBeenCalled()
    } finally {
      stdoutSpy.mockRestore()
    }
  })

  it('calls stdout/stderr/exit arrow functions without throwing', async () => {
    const mod = await import('../../commands/play.js')
    const io = mod.defaultPlayIO()
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })

    try {
      io.stdout('test output')
      io.stderr('test error')
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
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

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
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

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
