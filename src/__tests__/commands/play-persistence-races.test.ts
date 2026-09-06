import { createSudoku } from '@hackettyam/sudoku-tools'
import type { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, expect, it, vi } from 'vitest'

import { assertGetRunner, createMockIO } from './play-test-helpers.js'
import { playCommand, memoryPlayPersistence } from '../../commands/play.js'
import type { PlayPersistence } from '../../commands/play.js'
import type { FsAdapter } from '../../persistence/state.js'

function rejectWinStateWrite(persistence: PlayPersistence): PlayPersistence {
  let stateWriteCount = 0
  const fs: FsAdapter = {
    ...persistence.fs,
    writeFile: async (path, data) => {
      if (path.startsWith(`${persistence.statePath}.tmp-`)) {
        stateWriteCount += 1
        if (stateWriteCount === 2) {
          throw new Error('simulated win persistence error')
        }
      }
      await persistence.fs.writeFile(path, data)
    },
  }

  return { ...persistence, fs }
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

describe('playCommand persistence races', () => {
  it.each([
    { action: 'new-game', key: 'n' },
    { action: 'quit', key: 'q' },
  ])('returns a typed error when pending win persistence rejects during $action', async ({ key }) => {
    // Arrange
    const { io, getRunner } = createMockIO()
    const persistence = rejectWinStateWrite(memoryPlayPersistence())
    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    // Act
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('9')
    runner.pressKey(key)

    // Assert
    await expect(resultPromise).resolves.toEqual({
      kind: 'play_exit',
      reason: 'error',
      message: 'simulated win persistence error',
    })
  })

  it('returns a typed error when creating the next game throws', async () => {
    // Arrange
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()
    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    vi.mocked(createSudoku).mockImplementationOnce(() => {
      throw new Error('simulated new-game error')
    })
    const runner = assertGetRunner(getRunner())

    // Act
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('9')
    runner.pressKey('n')

    // Assert
    await expect(resultPromise).resolves.toEqual({
      kind: 'play_exit',
      reason: 'error',
      message: 'simulated new-game error',
    })
  })

  it('draws after starting the next game', async () => {
    // Arrange
    const { io, getRunner } = createMockIO()
    const persistence = memoryPlayPersistence()
    const createSudokuMock = vi.mocked(createSudoku)
    const initialCreateCount = createSudokuMock.mock.calls.length
    const resultPromise = playCommand(
      { difficulty: 'easy' },
      { io, persistence },
    )

    await vi.waitFor(() => { expect(getRunner()).not.toBeNull() })
    const runner = assertGetRunner(getRunner())

    // Act
    runner.pressKey('\x1b[8;5H')
    runner.pressKey('9')
    runner.pressKey('n')
    await vi.waitFor(() => {
      expect(createSudokuMock).toHaveBeenCalledTimes(initialCreateCount + 2)
    })
    runner.pressKey('q')

    // Assert
    await expect(resultPromise).resolves.toEqual({
      kind: 'play_exit',
      reason: 'quit',
    })
  })
})
