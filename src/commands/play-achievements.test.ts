import { describe, it, expect } from 'vitest'
import { playAchievementsCommand } from './play-achievements.js'
import { memoryFsAdapter, saveState } from '../persistence/state.js'
import type { StateFile } from '../persistence/state.js'
import { inMemoryLockFactory } from '../persistence/lock.js'
import { ACHIEVEMENTS } from '../persistence/achievements.js'

describe('playAchievementsCommand', () => {
  it('returns all 11 locked when no state file exists', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'

    const result = await playAchievementsCommand({ fs, lock, statePath })

    expect(result.kind).toBe('play_achievements')
    expect(result.lines[0]).toBe('Achievements')
    expect(result.lines).toContain('0/11 unlocked')
    expect(result.lines).toContain('Locked:')

    const output = result.lines.join('\n')

    // All 11 achievement titles should appear as locked
    for (const a of ACHIEVEMENTS) {
      expect(output).toContain(`${a.title} — ${a.description}`)
    }
  })

  it('shows unlocked and locked split correctly', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'

    const state: StateFile = {
      version: 1,
      stats: {
        novice: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        easy: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        normal: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        hard: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        expert: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
      },
      totalPlays: 0,
      achievements: {
        first_win: { unlockedAt: '2026-01-01T00:00:00.000Z' },
        speed_demon: { unlockedAt: '2026-01-02T00:00:00.000Z' },
      } as StateFile['achievements'],
      lastSaveId: null,
    }

    await saveState(fs, statePath, state, lock)

    const result = await playAchievementsCommand({ fs, lock, statePath })
    const output = result.lines.join('\n')

    expect(result.lines).toContain('2/11 unlocked')

    // Unlocked section (speed_demon has later timestamp, so listed first)
    expect(output).toContain('Speed Demon — Win an easy game in under 5 minutes')
    expect(output).toContain('First Win — Win your first game at novice difficulty')

    // Locked section should exist
    expect(result.lines).toContain('Locked:')

    // Locked achievements should NOT appear before the Locked: header
    const lockedIdx = result.lines.indexOf('Locked:')
    const firstWinIdx = result.lines.findIndex((l) => l.includes('First Win'))
    const speedDemonIdx = result.lines.findIndex((l) => l.includes('Speed Demon'))
    expect(firstWinIdx).toBeLessThan(lockedIdx)
    expect(speedDemonIdx).toBeLessThan(lockedIdx)
  })

  it('handles all 11 unlocked', async () => {
    const fs = memoryFsAdapter()
    const lock = inMemoryLockFactory()
    const statePath = '/test/state.json'

    const allUnlocked: Record<string, { unlockedAt: string }> = {}
    let idx = 0
    for (const a of ACHIEVEMENTS) {
      allUnlocked[a.id] = { unlockedAt: `2026-01-01T${String(idx++).padStart(2, '0')}:00:00.000Z` }
    }

    const state: StateFile = {
      version: 1,
      stats: {
        novice: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        easy: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        normal: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        hard: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
        expert: { totalPlays: 0, totalWins: 0, bestTimeMs: null, fewestMoves: null, lastPlayedAt: null },
      },
      totalPlays: 0,
      achievements: allUnlocked as StateFile['achievements'],
      lastSaveId: null,
    }

    await saveState(fs, statePath, state, lock)

    const result = await playAchievementsCommand({ fs, lock, statePath })

    expect(result.lines).toContain('11/11 unlocked')
    expect(result.lines).not.toContain('Locked:')
  })

  it('works with default deps', async () => {
    const result = await playAchievementsCommand()
    expect(result.kind).toBe('play_achievements')
    expect(result.lines.length).toBeGreaterThan(0)
  })
})
