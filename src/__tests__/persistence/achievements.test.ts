import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, it, expect } from 'vitest'

import { ACHIEVEMENTS, evaluateAchievements } from '../../persistence/achievements.js'
import type { AchievementContext } from '../../persistence/achievements.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    difficulty: Difficulty.Normal,
    elapsedMs: 120_000,
    moveCount: 30,
    hintCount: 0,
    undoCount: 0,
    errors: [],
    perDifficultyWins: {
      [Difficulty.Novice]: 0,
      [Difficulty.Easy]: 0,
      [Difficulty.Normal]: 0,
      [Difficulty.Hard]: 0,
      [Difficulty.Expert]: 0,
    },
    difficultiesWon: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// ACHIEVEMENTS array
// ---------------------------------------------------------------------------

describe('ACHIEVEMENTS', () => {
  it('contains exactly 11 definitions', () => {
    expect(ACHIEVEMENTS.length).toBe(11)
  })

  it('each has a unique id', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(11)
  })

  it('each has title and description strings', () => {
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.title).toBe('string')
      expect(a.title.length).toBeGreaterThan(0)
      expect(typeof a.description).toBe('string')
      expect(a.description.length).toBeGreaterThan(0)
    }
  })

  it('each has an evaluate function', () => {
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.evaluate).toBe('function')
    }
  })

  it('is frozen', () => {
    expect(Object.isFrozen(ACHIEVEMENTS)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateAchievements
// ---------------------------------------------------------------------------

describe('evaluateAchievements', () => {
  it('returns empty array for context matching no achievements', () => {
    const ctx = makeCtx({
      difficulty: Difficulty.Normal,
      errors: ['0,0'],
      undoCount: 1,
      moveCount: 50,
    })
    const result = evaluateAchievements(ctx)
    expect(result).toEqual([])
  })

  it('returns multiple achievements when multiple conditions met', () => {
    const ctx = makeCtx({
      difficulty: Difficulty.Easy,
      errors: [],
      hintCount: 0,
      undoCount: 0,
      moveCount: 30,
      elapsedMs: 60_000,
    })
    const result = evaluateAchievements(ctx)
    expect(result).toContain('speed_demon')
    expect(result).toContain('no_hints_easy')
  })
})

// ---------------------------------------------------------------------------
// Per-achievement tests — unlocked
// ---------------------------------------------------------------------------

describe('first_win', () => {
  it('unlocks when difficulty is novice', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Novice })
    expect(evaluateAchievements(ctx)).toContain('first_win')
  })

  it('does not unlock when difficulty is not novice', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Easy })
    expect(evaluateAchievements(ctx)).not.toContain('first_win')
  })
})

describe('speed_demon', () => {
  it('unlocks when easy and elapsed < 5min', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Easy, elapsedMs: 200_000 })
    expect(evaluateAchievements(ctx)).toContain('speed_demon')
  })

  it('does not unlock when easy but elapsed >= 5min', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Easy, elapsedMs: 300_000 })
    expect(evaluateAchievements(ctx)).not.toContain('speed_demon')
  })

  it('does not unlock when not easy', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Normal, elapsedMs: 100_000 })
    expect(evaluateAchievements(ctx)).not.toContain('speed_demon')
  })
})

describe('no_hints_easy', () => {
  it('unlocks when easy and no hints', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Easy, hintCount: 0 })
    expect(evaluateAchievements(ctx)).toContain('no_hints_easy')
  })

  it('does not unlock when easy but has hints', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Easy, hintCount: 1 })
    expect(evaluateAchievements(ctx)).not.toContain('no_hints_easy')
  })

  it('does not unlock when not easy', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Hard, hintCount: 0 })
    expect(evaluateAchievements(ctx)).not.toContain('no_hints_easy')
  })
})

describe('perfectionist', () => {
  it('unlocks when normal, no errors, no undo', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Normal, errors: [], undoCount: 0 })
    expect(evaluateAchievements(ctx)).toContain('perfectionist')
  })

  it('does not unlock when normal but has errors', () => {
    const ctx = makeCtx({
      difficulty: Difficulty.Normal,
      errors: ['err1'],
      undoCount: 0,
    })
    expect(evaluateAchievements(ctx)).not.toContain('perfectionist')
  })

  it('does not unlock when normal but has undo', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Normal, errors: [], undoCount: 1 })
    expect(evaluateAchievements(ctx)).not.toContain('perfectionist')
  })

  it('does not unlock when not normal', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Hard, errors: [], undoCount: 0 })
    expect(evaluateAchievements(ctx)).not.toContain('perfectionist')
  })
})

describe('minimalist', () => {
  it('unlocks when normal and moveCount <= 45', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Normal, moveCount: 45 })
    expect(evaluateAchievements(ctx)).toContain('minimalist')
  })

  it('unlocks when normal and moveCount is 0', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Normal, moveCount: 0 })
    expect(evaluateAchievements(ctx)).toContain('minimalist')
  })

  it('does not unlock when normal but moveCount > 45', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Normal, moveCount: 46 })
    expect(evaluateAchievements(ctx)).not.toContain('minimalist')
  })

  it('does not unlock when not normal', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Easy, moveCount: 10 })
    expect(evaluateAchievements(ctx)).not.toContain('minimalist')
  })
})

describe('no_undo', () => {
  it('unlocks when hard and no undo', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Hard, undoCount: 0 })
    expect(evaluateAchievements(ctx)).toContain('no_undo')
  })

  it('does not unlock when hard but has undo', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Hard, undoCount: 1 })
    expect(evaluateAchievements(ctx)).not.toContain('no_undo')
  })

  it('does not unlock when not hard', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Easy, undoCount: 0 })
    expect(evaluateAchievements(ctx)).not.toContain('no_undo')
  })
})

describe('speedrunner', () => {
  it('unlocks when hard and elapsed < 10min', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Hard, elapsedMs: 500_000 })
    expect(evaluateAchievements(ctx)).toContain('speedrunner')
  })

  it('does not unlock when hard but elapsed >= 10min', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Hard, elapsedMs: 600_000 })
    expect(evaluateAchievements(ctx)).not.toContain('speedrunner')
  })

  it('does not unlock when not hard', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Easy, elapsedMs: 100_000 })
    expect(evaluateAchievements(ctx)).not.toContain('speedrunner')
  })
})

describe('flawless_victory', () => {
  it('unlocks when expert and no errors', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Expert, errors: [] })
    expect(evaluateAchievements(ctx)).toContain('flawless_victory')
  })

  it('does not unlock when expert but has errors', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Expert, errors: ['err1'] })
    expect(evaluateAchievements(ctx)).not.toContain('flawless_victory')
  })

  it('does not unlock when not expert', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Hard, errors: [] })
    expect(evaluateAchievements(ctx)).not.toContain('flawless_victory')
  })
})

describe('untouchable', () => {
  it('unlocks when expert and no hints', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Expert, hintCount: 0 })
    expect(evaluateAchievements(ctx)).toContain('untouchable')
  })

  it('does not unlock when expert but has hints', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Expert, hintCount: 1 })
    expect(evaluateAchievements(ctx)).not.toContain('untouchable')
  })

  it('does not unlock when not expert', () => {
    const ctx = makeCtx({ difficulty: Difficulty.Easy, hintCount: 0 })
    expect(evaluateAchievements(ctx)).not.toContain('untouchable')
  })
})

describe('century', () => {
  it('unlocks when total wins >= 100', () => {
    const ctx = makeCtx({
      perDifficultyWins: {
        [Difficulty.Novice]: 20,
        [Difficulty.Easy]: 20,
        [Difficulty.Normal]: 20,
        [Difficulty.Hard]: 20,
        [Difficulty.Expert]: 20,
      },
    })
    expect(evaluateAchievements(ctx)).toContain('century')
  })

  it('unlocks when total wins > 100', () => {
    const ctx = makeCtx({
      perDifficultyWins: {
        [Difficulty.Novice]: 25,
        [Difficulty.Easy]: 25,
        [Difficulty.Normal]: 25,
        [Difficulty.Hard]: 25,
        [Difficulty.Expert]: 25,
      },
    })
    expect(evaluateAchievements(ctx)).toContain('century')
  })

  it('does not unlock when total wins < 100', () => {
    const ctx = makeCtx({
      perDifficultyWins: {
        [Difficulty.Novice]: 19,
        [Difficulty.Easy]: 20,
        [Difficulty.Normal]: 20,
        [Difficulty.Hard]: 20,
        [Difficulty.Expert]: 20,
      },
    })
    expect(evaluateAchievements(ctx)).not.toContain('century')
  })

  it('does not unlock when total wins = 99', () => {
    const ctx = makeCtx({
      perDifficultyWins: {
        [Difficulty.Novice]: 20,
        [Difficulty.Easy]: 20,
        [Difficulty.Normal]: 19,
        [Difficulty.Hard]: 20,
        [Difficulty.Expert]: 20,
      },
    })
    expect(evaluateAchievements(ctx)).not.toContain('century')
  })
})

describe('completionist', () => {
  it('unlocks when all 5 difficulties won', () => {
    const ctx = makeCtx({
      difficultiesWon: [
        Difficulty.Novice,
        Difficulty.Easy,
        Difficulty.Normal,
        Difficulty.Hard,
        Difficulty.Expert,
      ],
    })
    expect(evaluateAchievements(ctx)).toContain('completionist')
  })

  it('does not unlock when only 4 difficulties won', () => {
    const ctx = makeCtx({
      difficultiesWon: [
        Difficulty.Novice,
        Difficulty.Easy,
        Difficulty.Normal,
        Difficulty.Hard,
      ],
    })
    expect(evaluateAchievements(ctx)).not.toContain('completionist')
  })

  it('does not unlock when no difficulties won', () => {
    const ctx = makeCtx({ difficultiesWon: [] })
    expect(evaluateAchievements(ctx)).not.toContain('completionist')
  })
})
