import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, expect, it } from 'vitest'

import { parseDifficulty, difficultyToName, DEFAULT_DIFFICULTY } from '../../format/difficulty.js'

describe('parseDifficulty', () => {
  it('returns default when input is undefined', () => {
    expect(parseDifficulty(undefined)).toBe(DEFAULT_DIFFICULTY)
    expect(DEFAULT_DIFFICULTY).toBe(Difficulty.Normal)
  })

  it('returns default when input is empty string', () => {
    expect(parseDifficulty('')).toBe(Difficulty.Normal)
  })

  it('parses each valid level case-insensitively', () => {
    expect(parseDifficulty('novice')).toBe(Difficulty.Novice)
    expect(parseDifficulty('NOVICE')).toBe(Difficulty.Novice)
    expect(parseDifficulty('Easy')).toBe(Difficulty.Easy)
    expect(parseDifficulty('normal')).toBe(Difficulty.Normal)
    expect(parseDifficulty('HARD')).toBe(Difficulty.Hard)
    expect(parseDifficulty('expert')).toBe(Difficulty.Expert)
  })

  it('throws on an unrecognized value', () => {
    expect(() => parseDifficulty('insane')).toThrowError(/Invalid difficulty: 'insane'/)
  })
})

describe('difficultyToName', () => {
  it('maps each Difficulty value to its CLI name', () => {
    expect(difficultyToName(Difficulty.Novice)).toBe('novice')
    expect(difficultyToName(Difficulty.Easy)).toBe('easy')
    expect(difficultyToName(Difficulty.Normal)).toBe('normal')
    expect(difficultyToName(Difficulty.Hard)).toBe('hard')
    expect(difficultyToName(Difficulty.Expert)).toBe('expert')
  })

  it('falls back to "normal" for unknown values', () => {
    expect(difficultyToName('mystery' as unknown as typeof Difficulty.Normal)).toBe('normal')
  })
})
