import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, expect, it } from 'vitest'

import { createGame } from '../game/state.js'
import type { AchievementId } from '../persistence/achievements.js'
import {
  ACHIEVEMENT_GLYPHS,
  ACHIEVEMENT_RARITY,
  formatShortId,
  renderAchievementDetail,
  renderAchievementInline,
  renderGame,
  renderTrophyArt,
} from '../tui.js'

describe('formatShortId', () => {
  it('returns first 8 chars', () => {
    expect(formatShortId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400')
  })

  it('returns full string if shorter than 8', () => {
    expect(formatShortId('abc')).toBe('abc')
  })

  it('returns exactly 8 chars', () => {
    expect(formatShortId('1234567890')).toBe('12345678')
  })
})

const achievementIds: readonly AchievementId[] = [
  'first_win', 'speed_demon', 'no_hints_easy', 'perfectionist',
  'minimalist', 'no_undo', 'speedrunner', 'flawless_victory',
  'untouchable', 'century', 'completionist',
]

describe('ACHIEVEMENT_GLYPHS', () => {
  it('has entry for every achievement', () => {
    for (const id of achievementIds) {
      expect(ACHIEVEMENT_GLYPHS[id]).toBeDefined()
      expect(typeof ACHIEVEMENT_GLYPHS[id]).toBe('string')
    }
  })

  it('is frozen', () => {
    expect(Object.isFrozen(ACHIEVEMENT_GLYPHS)).toBe(true)
  })
})

describe('ACHIEVEMENT_RARITY', () => {
  it('has entry for every achievement', () => {
    for (const id of achievementIds) {
      expect(ACHIEVEMENT_RARITY[id]).toBeDefined()
      expect(['bronze', 'silver', 'gold', 'legendary']).toContain(ACHIEVEMENT_RARITY[id])
    }
  })

  it('is frozen', () => {
    expect(Object.isFrozen(ACHIEVEMENT_RARITY)).toBe(true)
  })
})

describe('renderAchievementInline', () => {
  it('returns empty string for empty array', () => {
    expect(renderAchievementInline([])).toBe('')
  })

  it('renders single achievement', () => {
    expect(renderAchievementInline(['first_win'])).toContain('first win')
  })

  it('renders multiple achievements', () => {
    const output = renderAchievementInline(['first_win', 'speed_demon'])
    expect(output).toContain('first win')
    expect(output).toContain('speed demon')
  })

  it('renders with colors', () => {
    expect(renderAchievementInline(['first_win'], { colorsEnabled: true })).toContain('first win')
  })

  it('renders legendary with magenta', () => {
    expect(renderAchievementInline(['flawless_victory'], { colorsEnabled: true })).toContain('\x1b[')
  })

  it('renders gold with yellow', () => {
    expect(renderAchievementInline(['perfectionist'], { colorsEnabled: true })).toContain('\x1b[')
  })

  it('renders silver with cyan', () => {
    expect(renderAchievementInline(['speed_demon'], { colorsEnabled: true })).toContain('\x1b[')
  })

  it('renders bronze without special color', () => {
    expect(renderAchievementInline(['first_win'], { colorsEnabled: true })).toContain('first win')
  })
})

describe('renderAchievementDetail', () => {
  it('renders header with count', () => {
    const output = renderAchievementDetail(['first_win'], 1)
    expect(output).toContain('Achievements')
    expect(output).toContain('1/11 unlocked')
  })

  it('renders achievement names', () => {
    const output = renderAchievementDetail(['first_win', 'speed_demon'], 2)
    expect(output).toContain('first win')
    expect(output).toContain('speed demon')
  })

  it('renders rarity labels', () => {
    expect(renderAchievementDetail(['first_win'], 1)).toContain('[BRONZE]')
  })

  it('renders with colors', () => {
    const output = renderAchievementDetail(['first_win'], 1, { colorsEnabled: true })
    expect(output).toContain('Achievements')
    expect(output).toContain('\x1b[')
  })

  it('shows dismiss prompt', () => {
    expect(renderAchievementDetail([], 0)).toContain('Press any key to dismiss')
  })
})

describe('renderTrophyArt', () => {
  it('renders ASCII art without colors', () => {
    const output = renderTrophyArt()
    expect(output).toContain('___________')
    expect(output).toContain('-------')
  })

  it('renders with colors', () => {
    const output = renderTrophyArt({ colorsEnabled: true })
    expect(output).toContain('___________')
    expect(output).toContain('\x1b[')
  })

  it('has multiple lines', () => {
    expect(renderTrophyArt().split('\n').length).toBeGreaterThanOrEqual(8)
  })
})

describe('grid pattern — Unicode box-drawing characters', () => {
  const gridOutput = renderGame(createGame(Difficulty.Normal), { colorsEnabled: false })
  const gridLines = gridOutput.split('\n')

  it('top border matches pattern ╔═══╤═══╤═══╦═══╤═══╤═══╦═══╤═══╤═══╗', () => {
    const topBorder = gridLines.find((line) => line.startsWith('╔'))
    expect(topBorder).toBe('╔═══╤═══╤═══╦═══╤═══╤═══╦═══╤═══╤═══╗')
  })

  it('bottom border matches pattern ╚═══╧═══╧═══╩═══╧═══╧═══╩═══╧═══╧═══╝', () => {
    const bottomBorder = gridLines.find((line) => line.startsWith('╚'))
    expect(bottomBorder).toBe('╚═══╧═══╧═══╩═══╧═══╧═══╩═══╧═══╧═══╝')
  })

  it('thin separator matches pattern ╟───┼───┼───╫───┼───┼───╫───┼───┼───╢', () => {
    const thinSeparators = gridLines.filter((line) => line.startsWith('╟'))
    expect(thinSeparators.length).toBe(6)
    for (const separator of thinSeparators) {
      expect(separator).toBe('╟───┼───┼───╫───┼───┼───╫───┼───┼───╢')
    }
  })

  it('thick separator matches pattern ╠═══╪═══╪═══╬═══╪═══╪═══╬═══╪═══╪═══╣', () => {
    const thickSeparators = gridLines.filter((line) => line.startsWith('╠'))
    expect(thickSeparators.length).toBe(2)
    for (const separator of thickSeparators) {
      expect(separator).toBe('╠═══╪═══╪═══╬═══╪═══╪═══╬═══╪═══╪═══╣')
    }
  })

  it('data rows use ║ between 3×3 boxes and │ within', () => {
    const dataRows = gridLines.filter((line) => line.startsWith('║') && line.endsWith('║'))
    expect(dataRows.length).toBe(9)

    for (const row of dataRows) {
      expect(row.startsWith('║')).toBe(true)
      expect(row.endsWith('║')).toBe(true)
      expect((row.match(/║/gu) ?? []).length).toBe(4)
      expect((row.match(/│/gu) ?? []).length).toBe(6)
    }
  })

  it('grid has exactly 19 lines', () => {
    const gridSection = gridLines.filter((line) => /^[╔║╟╠╚]/u.test(line))
    expect(gridSection.length).toBe(19)
  })

  it('all 20 box-drawing characters are present', () => {
    const characters = [
      '╔', '╗', '╚', '╝', '║', '═', '╦', '╩', '╠', '╣', '╬',
      '─', '│', '┼', '╤', '╧', '╟', '╢', '╪', '╫',
    ]
    for (const character of characters) {
      expect(gridOutput).toContain(character)
    }
  })
})

describe('colors disabled for achievements', () => {
  it('renderAchievementInline has no ANSI escapes', () => {
    expect(renderAchievementInline(['first_win'], { colorsEnabled: false })).not.toContain('\x1b[')
  })

  it('renderAchievementDetail has no ANSI escapes', () => {
    expect(renderAchievementDetail(['first_win'], 1, { colorsEnabled: false })).not.toContain('\x1b[')
  })

  it('renderTrophyArt has no ANSI escapes', () => {
    expect(renderTrophyArt({ colorsEnabled: false })).not.toContain('\x1b[')
  })
})
