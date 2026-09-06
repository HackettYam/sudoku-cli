import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, it, expect } from 'vitest'

import { playLeaderboardCommand } from '../../commands/play-leaderboard.js'
import { inMemoryLockFactory } from '../../persistence/lock.js'
import {
  StateCorruptError,
  loadState,
  memoryFsAdapter,
  saveState,
} from '../../persistence/state.js'
import type { StateFile } from '../../persistence/state.js'

function expectOutputToContain(output: string, expected: readonly string[]): void {
  for (const value of expected) {
    expect(output).toContain(value)
  }
}

describe('playLeaderboardCommand', () => {
  it('returns empty leaderboard with default state', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'

    const result = await playLeaderboardCommand({ fs, lock, statePath })

    expect(result.kind).toBe('play_leaderboard')
    expect(result.lines[0]).toBe('Leaderboard')
    expect(result.lines.length).toBeGreaterThan(2)

    const output = result.lines.join('\n')

    // All difficulties should show with --:-- and --
    expect(output).toContain('novice')
    expect(output).toContain('easy')
    expect(output).toContain('normal')
    expect(output).toContain('hard')
    expect(output).toContain('expert')
    expect(output).toContain('--:--')
    expect(output).toContain('--')
  })

  it('returns leaderboard with actual wins', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'

    const state: StateFile = {
      version: 1,
      stats: {
        [Difficulty.Novice]: {
          totalPlays: 10, totalWins: 7, bestTimeMs: 65000,
          fewestMoves: 30, lastPlayedAt: Date.now(),
        },
        [Difficulty.Easy]: {
          totalPlays: 5, totalWins: 5, bestTimeMs: 120000,
          fewestMoves: 40, lastPlayedAt: Date.now(),
        },
        [Difficulty.Normal]: {
          totalPlays: 3, totalWins: 1, bestTimeMs: 300000,
          fewestMoves: 55, lastPlayedAt: Date.now(),
        },
        [Difficulty.Hard]: {
          totalPlays: 2, totalWins: 0, bestTimeMs: null,
          fewestMoves: null, lastPlayedAt: Date.now(),
        },
        [Difficulty.Expert]: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
      },
      totalPlays: 20,
      achievements: {} as StateFile['achievements'],
      lastSaveId: null,
    }

    await saveState(fs, statePath, state, lock)

    const result = await playLeaderboardCommand({ fs, lock, statePath })
    const output = result.lines.join('\n')

    // Table should have difficulty names
    expectOutputToContain(output, ['Difficulty', 'Best Time', 'Fewest Moves'])

    // Novice: 65000ms = 1:05, 30 moves
    expectOutputToContain(output, ['novice', '1:05', '30'])

    // Easy: 120000ms = 2:00, 40 moves
    expectOutputToContain(output, ['easy', '2:00', '40'])

    // Normal: 300000ms = 5:00, 55 moves
    expectOutputToContain(output, ['normal', '5:00', '55'])

    // Hard: no best time, no fewest moves
    expectOutputToContain(output, ['hard', '--:--', '--'])
  })

  it('formats times correctly in the table', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'

    const state: StateFile = {
      version: 1,
      stats: {
        [Difficulty.Novice]: {
          totalPlays: 1, totalWins: 1, bestTimeMs: 3661000,
          fewestMoves: 1, lastPlayedAt: Date.now(),
        },
        [Difficulty.Easy]: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        [Difficulty.Normal]: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        [Difficulty.Hard]: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        [Difficulty.Expert]: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
      },
      totalPlays: 1,
      achievements: {} as StateFile['achievements'],
      lastSaveId: null,
    }

    await saveState(fs, statePath, state, lock)

    const result = await playLeaderboardCommand({ fs, lock, statePath })
    const output = result.lines.join('\n')

    // 3661000ms = 1:01:01
    expect(output).toContain('1:01:01')
  })

  it('rejects a missing difficulty entry as corrupt', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'
    const state = await loadState(fs, statePath, lock)
    const expertKey: string = Difficulty.Expert
    const sparseStats = Object.fromEntries(
      Object.entries(state.stats).filter(([difficulty]) => difficulty !== expertKey),
    ) as StateFile['stats']
    const sparseState: StateFile = { ...state, stats: sparseStats }

    await saveState(fs, statePath, sparseState, lock)

    await expect(
      playLeaderboardCommand({ fs, lock, statePath }),
    ).rejects.toBeInstanceOf(StateCorruptError)
  })

  it('works with default deps', async () => {
    const result = await playLeaderboardCommand()
    expect(result.kind).toBe('play_leaderboard')
    expect(result.lines.length).toBeGreaterThan(0)
  })
})
