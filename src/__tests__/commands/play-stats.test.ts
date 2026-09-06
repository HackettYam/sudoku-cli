import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, it, expect } from 'vitest'

import { playStatsCommand } from '../../commands/play-stats.js'
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

describe('playStatsCommand', () => {
  it('returns stats with default state when no state file exists', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'

    const result = await playStatsCommand({ fs, lock, statePath })

    expect(result.kind).toBe('play_stats')
    expect(result.lines[0]).toBe('Play Statistics')
    expect(result.lines.length).toBeGreaterThan(2)

    // Default state has zero plays for all difficulties
    const output = result.lines.join('\n')
    expect(output).toContain('Plays: 0')
    expect(output).toContain('Wins: 0')
    expect(output).toContain('Win rate: 0%')
    expect(output).toContain('Best time: --:--')
    expect(output).toContain('Fewest moves: --')
    expect(output).toContain('Total plays: 0')
  })

  it('returns actual stats when state file exists', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'

    // Write a state with some data
    const state: StateFile = {
      version: 1,
      stats: {
        [Difficulty.Novice]: {
          totalPlays: 10, totalWins: 7,
          bestTimeMs: 65000, fewestMoves: 30,
          lastPlayedAt: Date.now(),
        },
        [Difficulty.Easy]: {
          totalPlays: 5, totalWins: 5,
          bestTimeMs: 120000, fewestMoves: 40,
          lastPlayedAt: Date.now(),
        },
        [Difficulty.Normal]: {
          totalPlays: 3, totalWins: 1,
          bestTimeMs: 300000, fewestMoves: 55,
          lastPlayedAt: Date.now(),
        },
        [Difficulty.Hard]: {
          totalPlays: 2, totalWins: 0,
          bestTimeMs: null, fewestMoves: null,
          lastPlayedAt: Date.now(),
        },
        [Difficulty.Expert]: {
          totalPlays: 0, totalWins: 0,
          bestTimeMs: null, fewestMoves: null,
          lastPlayedAt: null,
        },
      },
      totalPlays: 20,
      achievements: {} as StateFile['achievements'],
      lastSaveId: null,
    }

    await saveState(fs, statePath, state, lock)

    const result = await playStatsCommand({ fs, lock, statePath })

    const output = result.lines.join('\n')

    // Novice: 10 plays, 7 wins, 70% win rate
    expectOutputToContain(output, ['novice', 'Plays: 10', 'Wins: 7', 'Win rate: 70%', 'Fewest moves: 30'])

    // Easy: 5 plays, 5 wins, 100% win rate
    expectOutputToContain(output, ['easy', 'Plays: 5', 'Wins: 5', 'Win rate: 100%'])

    // Normal: 3 plays, 1 win, 33% win rate (Math.round(1/3*100) = 33)
    expectOutputToContain(output, ['normal', 'Plays: 3', 'Wins: 1', 'Win rate: 33%'])

    // Hard: 2 plays, 0 wins, no best time
    expectOutputToContain(output, [
      'hard', 'Plays: 2', 'Wins: 0', 'Win rate: 0%',
      'Best time: --:--', 'Fewest moves: --',
    ])

    // Total
    expectOutputToContain(output, ['Total plays: 20'])
  })

  it('formats best time correctly', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'

    const state: StateFile = {
      version: 1,
      stats: {
        [Difficulty.Novice]: {
          totalPlays: 1, totalWins: 1,
          bestTimeMs: 65000, fewestMoves: 30,
          lastPlayedAt: Date.now(),
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

    const result = await playStatsCommand({ fs, lock, statePath })
    const output = result.lines.join('\n')

    // 65000ms = 1:05 (formatTime pads minutes to 2 digits)
    expect(output).toContain('Best time: 01:05')
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
      playStatsCommand({ fs, lock, statePath }),
    ).rejects.toBeInstanceOf(StateCorruptError)
  })

  it('works with default deps', async () => {
    const result = await playStatsCommand()
    expect(result.kind).toBe('play_stats')
    expect(result.lines.length).toBeGreaterThan(0)
  })
})
