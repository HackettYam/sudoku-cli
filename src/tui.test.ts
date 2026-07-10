import { describe, it, expect } from 'vitest'
import { Difficulty, type BoardType, type BoardReadOnlyType } from '@hackettyam/sudoku-tools'

import type { GameState } from './game/state.js'
import { createGame } from './game/state.js'
import type { AchievementId } from './persistence/achievements.js'
import {
  parseKeypress,
  formatTime,
  renderGame,
  applyKey,
  KEYBINDINGS,
  renderWinBanner,
  renderSavePrompt,
  formatShortId,
  ACHIEVEMENT_GLYPHS,
  ACHIEVEMENT_RARITY,
  renderAchievementInline,
  renderAchievementDetail,
  renderTrophyArt,
} from './tui.js'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeState(overrides?: Partial<GameState>): GameState {
  const base = createGame(Difficulty.Normal)
  return { ...base, ...overrides }
}

function makeEmptyBoard(): BoardType {
  return Array.from({ length: 9 }, () => Array(9).fill(0))
}

function makeReadOnly(editableCells?: Array<[number, number]>): BoardReadOnlyType {
  const board = Array.from({ length: 9 }, () => Array(9).fill(true))
  if (editableCells) {
    for (const [r, c] of editableCells) {
      const boardRow = (board as (boolean | undefined)[][])[r]
      if (boardRow !== undefined) {
        boardRow[c] = false
      }
    }
  }
  return board
}

// ---------------------------------------------------------------------------
// Part 1: parseKeypress
// ---------------------------------------------------------------------------

describe('parseKeypress', () => {
  it('parses arrow up', () => {
    const keys = parseKeypress(Buffer.from('\x1b[A'))
    expect(keys).toEqual([{ kind: 'arrow-up' }])
  })

  it('parses arrow down', () => {
    const keys = parseKeypress(Buffer.from('\x1b[B'))
    expect(keys).toEqual([{ kind: 'arrow-down' }])
  })

  it('parses arrow right', () => {
    const keys = parseKeypress(Buffer.from('\x1b[C'))
    expect(keys).toEqual([{ kind: 'arrow-right' }])
  })

  it('parses arrow left', () => {
    const keys = parseKeypress(Buffer.from('\x1b[D'))
    expect(keys).toEqual([{ kind: 'arrow-left' }])
  })

  it('parses home', () => {
    const keys = parseKeypress(Buffer.from('\x1b[H'))
    expect(keys).toEqual([{ kind: 'home' }])
  })

  it('parses end', () => {
    const keys = parseKeypress(Buffer.from('\x1b[F'))
    expect(keys).toEqual([{ kind: 'end' }])
  })

  it('parses ctrl-home via CSI H', () => {
    const keys = parseKeypress(Buffer.from('\x1b[1;5H'))
    expect(keys).toEqual([{ kind: 'ctrl-home' }])
  })

  it('parses ctrl-end via CSI H', () => {
    const keys = parseKeypress(Buffer.from('\x1b[8;5H'))
    expect(keys).toEqual([{ kind: 'ctrl-end' }])
  })

  it('parses ctrl-end via F key', () => {
    const keys = parseKeypress(Buffer.from('\x1b[8;5F'))
    expect(keys).toEqual([{ kind: 'ctrl-end' }])
  })

  it('parses ctrl-home via tilde', () => {
    const keys = parseKeypress(Buffer.from('\x1b[1;5~'))
    expect(keys).toEqual([{ kind: 'ctrl-home' }])
  })

  it('parses ctrl-end via tilde', () => {
    const keys = parseKeypress(Buffer.from('\x1b[4;5~'))
    expect(keys).toEqual([{ kind: 'ctrl-end' }])
  })

  it('parses backspace (DEL)', () => {
    const keys = parseKeypress(Buffer.from('\x7f'))
    expect(keys).toEqual([{ kind: 'backspace' }])
  })

  it('parses backspace (BS)', () => {
    const keys = parseKeypress(Buffer.from('\x08'))
    expect(keys).toEqual([{ kind: 'backspace' }])
  })

  it('parses delete', () => {
    const keys = parseKeypress(Buffer.from('\x1b[3~'))
    expect(keys).toEqual([{ kind: 'delete' }])
  })

  it('parses ctrl-c', () => {
    const keys = parseKeypress(Buffer.from('\x03'))
    expect(keys).toEqual([{ kind: 'ctrl-c' }])
  })

  it('parses lone escape', () => {
    const keys = parseKeypress(Buffer.from('\x1b'))
    expect(keys).toEqual([{ kind: 'escape' }])
  })

  it('parses digit 1', () => {
    const keys = parseKeypress(Buffer.from('1'))
    expect(keys).toEqual([{ kind: 'digit', value: 1 }])
  })

  it('parses digit 9', () => {
    const keys = parseKeypress(Buffer.from('9'))
    expect(keys).toEqual([{ kind: 'digit', value: 9 }])
  })

  it('parses printable char', () => {
    const keys = parseKeypress(Buffer.from('a'))
    expect(keys).toEqual([{ kind: 'char', char: 'a' }])
  })

  it('parses space', () => {
    const keys = parseKeypress(Buffer.from(' '))
    expect(keys).toEqual([{ kind: 'char', char: ' ' }])
  })

  it('returns [] for unknown CSI sequence', () => {
    const keys = parseKeypress(Buffer.from('\x1b[999Z'))
    expect(keys).toEqual([])
  })

  it('parses multiple keys from buffer', () => {
    const keys = parseKeypress(Buffer.from('1\x1b[Aq'))
    expect(keys).toEqual([
      { kind: 'digit', value: 1 },
      { kind: 'arrow-up' },
      { kind: 'char', char: 'q' },
    ])
  })

  it('returns [] for empty buffer', () => {
    const keys = parseKeypress(Buffer.from(''))
    expect(keys).toEqual([])
  })

  it('skips unknown bytes', () => {
    const keys = parseKeypress(Buffer.from([0x01, 0x02, 0x7f]))
    expect(keys).toEqual([{ kind: 'backspace' }])
  })

  it('returns empty for unrecognized escape sequence', () => {
    const keys = parseKeypress(Buffer.from('\x1b[99;99z'))
    expect(keys).toEqual([])
  })

  it('skips unknown escape byte (non-CSI)', () => {
    const keys = parseKeypress(Buffer.from('\x1bX'))
    expect(keys).toEqual([{ kind: 'char', char: 'X' }])
  })

  it('returns empty for incomplete CSI', () => {
    const keys = parseKeypress(Buffer.from('\x1b['))
    expect(keys).toEqual([])
  })

  it('returns empty for unrecognized tilde', () => {
    const keys = parseKeypress(Buffer.from('\x1b[5z'))
    expect(keys).toEqual([])
  })

  it('returns empty for unrecognized tilde number', () => {
    const keys = parseKeypress(Buffer.from('\x1b[5~'))
    expect(keys).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Part 2: formatTime
// ---------------------------------------------------------------------------

describe('formatTime', () => {
  it('formats 0 ms as 00:00', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('formats 1 second', () => {
    expect(formatTime(1000)).toBe('00:01')
  })

  it('formats 59 seconds', () => {
    expect(formatTime(59_000)).toBe('00:59')
  })

  it('formats 1 minute', () => {
    expect(formatTime(60_000)).toBe('01:00')
  })

  it('formats 1 minute 5 seconds', () => {
    expect(formatTime(65_000)).toBe('01:05')
  })

  it('formats 1 hour', () => {
    expect(formatTime(3_600_000)).toBe('1:00:00')
  })

  it('formats 1 hour 1 minute 1 second', () => {
    expect(formatTime(3_661_000)).toBe('1:01:01')
  })

  it('formats negative as 00:00', () => {
    expect(formatTime(-1000)).toBe('00:00')
  })

  it('formats large time with hours', () => {
    expect(formatTime(10_800_000)).toBe('3:00:00')
  })
})

// ---------------------------------------------------------------------------
// Part 2: renderGame
// ---------------------------------------------------------------------------

describe('renderGame', () => {
  it('renders without colors', () => {
    const state = createGame(Difficulty.Easy)
    const output = renderGame(state)
    expect(output).toContain('Sudoku CLI — easy')
    expect(output).toContain('Time: 00:00')
    expect(output).toContain('Moves: 00')
    expect(output).toContain('Errors: 00')
    expect(output).toContain('←→↑↓ Move')
  })

  it('renders with colors', () => {
    const state = createGame(Difficulty.Normal)
    const output = renderGame(state, { colorsEnabled: true })
    expect(output).toContain('Sudoku CLI — normal')
    // Colors enabled should produce ANSI escape sequences
    expect(output).toContain('\x1b[')
  })

  it('renders grid with box-drawing characters', () => {
    const state = createGame(Difficulty.Easy)
    const output = renderGame(state)
    expect(output).toContain('╔')
    expect(output).toContain('╗')
    expect(output).toContain('╚')
    expect(output).toContain('╝')
    expect(output).toContain('═')
    expect(output).toContain('─')
    expect(output).toContain('│')
  })

  it('renders 9x9 grid rows', () => {
    const state = createGame(Difficulty.Easy)
    const output = renderGame(state)
    const lines = output.split('\n')
    // Count lines that contain │ (grid rows)
    const gridRows = lines.filter((l) => l.includes('│'))
    expect(gridRows.length).toBe(9)
  })

  it('shows empty cells as dots', () => {
    const board = makeEmptyBoard()
    const solution = makeEmptyBoard()
    const state = makeState({
      board,
      solution,
      readOnly: makeReadOnly(),
    })
    const output = renderGame(state)
    expect(output).toContain('.')
  })

  it('shows read-only cells as bold (with colors)', () => {
    const board = makeEmptyBoard()
    const solution = makeEmptyBoard()
    const readOnly = makeReadOnly()
    // Set one cell as non-read-only with a value
    const boardRow0 = (board as number[][])[0]
    if (boardRow0 !== undefined) {
      boardRow0[0] = 5
    }
    const solutionRow0 = (solution as number[][])[0]
    if (solutionRow0 !== undefined) {
      solutionRow0[0] = 5
    }
    const readOnlyRow0 = (readOnly as boolean[][])[0]
    if (readOnlyRow0 !== undefined) {
      readOnlyRow0[0] = true
    }
    const state = makeState({ board, solution, readOnly })
    const output = renderGame(state, { colorsEnabled: true })
    expect(output).toContain('\x1b[')
  })

  it('shows user-filled correct cells as dim cyan (with colors)', () => {
    const board = makeEmptyBoard()
    const solution = makeEmptyBoard()
    const readOnly = makeReadOnly([[0, 0]])
    const boardRow0 = (board as number[][])[0]
    if (boardRow0 !== undefined) {
      boardRow0[0] = 5
    }
    const solutionRow0 = (solution as number[][])[0]
    if (solutionRow0 !== undefined) {
      solutionRow0[0] = 5
    }
    // Move cursor away from (0,0) so isCursor is false and isCorrect triggers
    const state = makeState({ board, solution, readOnly, cursor: { row: 1, col: 1 } })
    const output = renderGame(state, { colorsEnabled: true })
    // dim + cyan ANSI codes: \x1b[2m (dim) and \x1b[36m (cyan)
    expect(output).toContain('\x1b[2m')
    expect(output).toContain('\x1b[36m')
  })

  it('shows user-filled error cells as red+reverse (with colors)', () => {
    const board = makeEmptyBoard()
    const solution = makeEmptyBoard()
    const readOnly = makeReadOnly([[0, 0]])
    const boardRow0 = (board as number[][])[0]
    if (boardRow0 !== undefined) {
      boardRow0[0] = 5
    }
    const solutionRow0 = (solution as number[][])[0]
    if (solutionRow0 !== undefined) {
      solutionRow0[0] = 3
    }
    // Move cursor away from (0,0) so isCursor is false and isError triggers
    const state = makeState({ board, solution, readOnly, cursor: { row: 1, col: 1 } })
    const output = renderGame(state, { colorsEnabled: true })
    // red + inverse ANSI codes: \x1b[31m (red) and \x1b[7m (inverse)
    expect(output).toContain('\x1b[31m')
    expect(output).toContain('\x1b[7m')
  })

  it('shows cursor with reverse video (with colors)', () => {
    const state = makeState({ cursor: { row: 0, col: 0 } })
    const output = renderGame(state, { colorsEnabled: true })
    expect(output).toContain('\x1b[')
  })

  it('shows move count in stats', () => {
    const state = makeState({ moveCount: 12 })
    const output = renderGame(state)
    expect(output).toContain('Moves: 12')
  })

  it('shows error count in stats', () => {
    const state = makeState({ errorCount: 3 })
    const output = renderGame(state)
    expect(output).toContain('Errors: 03')
  })
})

// ---------------------------------------------------------------------------
// Part 3: applyKey
// ---------------------------------------------------------------------------

describe('KEYBINDINGS', () => {
  it('is a frozen array', () => {
    expect(Object.isFrozen(KEYBINDINGS)).toBe(true)
  })

  it('contains expected bindings', () => {
    expect(KEYBINDINGS.length).toBe(8)
    const labels = KEYBINDINGS.map((kb) => kb.label)
    expect(labels).toContain('Move up')
    expect(labels).toContain('Move down')
    expect(labels).toContain('Move left')
    expect(labels).toContain('Move right')
  })
})

describe('applyKey', () => {
  describe('arrow keys', () => {
    it('arrow-up moves cursor up', () => {
      const state = makeState({ cursor: { row: 4, col: 4 } })
      const move = applyKey(state, { kind: 'arrow-up' })
      expect(move).toEqual({ kind: 'move-cursor', row: 3, col: 4 })
    })

    it('arrow-down moves cursor down', () => {
      const state = makeState({ cursor: { row: 4, col: 4 } })
      const move = applyKey(state, { kind: 'arrow-down' })
      expect(move).toEqual({ kind: 'move-cursor', row: 5, col: 4 })
    })

    it('arrow-left moves cursor left', () => {
      const state = makeState({ cursor: { row: 4, col: 4 } })
      const move = applyKey(state, { kind: 'arrow-left' })
      expect(move).toEqual({ kind: 'move-cursor', row: 4, col: 3 })
    })

    it('arrow-right moves cursor right', () => {
      const state = makeState({ cursor: { row: 4, col: 4 } })
      const move = applyKey(state, { kind: 'arrow-right' })
      expect(move).toEqual({ kind: 'move-cursor', row: 4, col: 5 })
    })
  })

  describe('home/end', () => {
    it('home moves to column 0', () => {
      const state = makeState({ cursor: { row: 3, col: 5 } })
      const move = applyKey(state, { kind: 'home' })
      expect(move).toEqual({ kind: 'move-cursor', row: 3, col: 0 })
    })

    it('end moves to column 8', () => {
      const state = makeState({ cursor: { row: 3, col: 2 } })
      const move = applyKey(state, { kind: 'end' })
      expect(move).toEqual({ kind: 'move-cursor', row: 3, col: 8 })
    })

    it('ctrl-home moves to 0,0', () => {
      const state = makeState({ cursor: { row: 5, col: 5 } })
      const move = applyKey(state, { kind: 'ctrl-home' })
      expect(move).toEqual({ kind: 'move-cursor', row: 0, col: 0 })
    })

    it('ctrl-end moves to 8,8', () => {
      const state = makeState({ cursor: { row: 0, col: 0 } })
      const move = applyKey(state, { kind: 'ctrl-end' })
      expect(move).toEqual({ kind: 'move-cursor', row: 8, col: 8 })
    })
  })

  describe('digits', () => {
    it('digit 1 places value when playing', () => {
      const state = makeState({ status: 'playing', cursor: { row: 0, col: 0 } })
      const move = applyKey(state, { kind: 'digit', value: 1 })
      expect(move).toEqual({ kind: 'place', row: 0, col: 0, value: 1 })
    })

    it('digit 9 places value when playing', () => {
      const state = makeState({ status: 'playing', cursor: { row: 8, col: 8 } })
      const move = applyKey(state, { kind: 'digit', value: 9 })
      expect(move).toEqual({ kind: 'place', row: 8, col: 8, value: 9 })
    })

    it('digit is null when not playing', () => {
      const state = makeState({ status: 'won' })
      const move = applyKey(state, { kind: 'digit', value: 5 })
      expect(move).toBeNull()
    })
  })

  describe('backspace/delete/clear', () => {
    it('backspace clears when playing', () => {
      const state = makeState({ status: 'playing', cursor: { row: 2, col: 3 } })
      const move = applyKey(state, { kind: 'backspace' })
      expect(move).toEqual({ kind: 'clear', row: 2, col: 3 })
    })

    it('delete clears when playing', () => {
      const state = makeState({ status: 'playing', cursor: { row: 1, col: 7 } })
      const move = applyKey(state, { kind: 'delete' })
      expect(move).toEqual({ kind: 'clear', row: 1, col: 7 })
    })

    it('backspace is null when not playing', () => {
      const state = makeState({ status: 'won' })
      const move = applyKey(state, { kind: 'backspace' })
      expect(move).toBeNull()
    })

    it('delete is null when not playing', () => {
      const state = makeState({ status: 'quit' })
      const move = applyKey(state, { kind: 'delete' })
      expect(move).toBeNull()
    })
  })

  describe('char keys', () => {
    it('char 0 clears when playing', () => {
      const state = makeState({ status: 'playing', cursor: { row: 0, col: 0 } })
      const move = applyKey(state, { kind: 'char', char: '0' })
      expect(move).toEqual({ kind: 'clear', row: 0, col: 0 })
    })

    it('char 0 is null when not playing', () => {
      const state = makeState({ status: 'won' })
      const move = applyKey(state, { kind: 'char', char: '0' })
      expect(move).toBeNull()
    })

    it('h triggers hint', () => {
      const state = makeState()
      const move = applyKey(state, { kind: 'char', char: 'h' })
      expect(move).toEqual({ kind: 'hint' })
    })

    it('H triggers hint', () => {
      const state = makeState()
      const move = applyKey(state, { kind: 'char', char: 'H' })
      expect(move).toEqual({ kind: 'hint' })
    })

    it('u triggers undo', () => {
      const state = makeState()
      const move = applyKey(state, { kind: 'char', char: 'u' })
      expect(move).toEqual({ kind: 'undo' })
    })

    it('U triggers undo', () => {
      const state = makeState()
      const move = applyKey(state, { kind: 'char', char: 'U' })
      expect(move).toEqual({ kind: 'undo' })
    })

    it('n triggers new-game when won', () => {
      const state = makeState({ status: 'won' })
      const move = applyKey(state, { kind: 'char', char: 'n' })
      expect(move).toEqual({ kind: 'new-game' })
    })

    it('n triggers new-game when quit', () => {
      const state = makeState({ status: 'quit' })
      const move = applyKey(state, { kind: 'char', char: 'n' })
      expect(move).toEqual({ kind: 'new-game' })
    })

    it('n is null when playing', () => {
      const state = makeState({ status: 'playing' })
      const move = applyKey(state, { kind: 'char', char: 'n' })
      expect(move).toBeNull()
    })

    it('a toggles achievements when won', () => {
      const state = makeState({ status: 'won' })
      const move = applyKey(state, { kind: 'char', char: 'a' })
      expect(move).toEqual({ kind: 'toggle-achievements' })
    })

    it('A toggles achievements when won', () => {
      const state = makeState({ status: 'won' })
      const move = applyKey(state, { kind: 'char', char: 'A' })
      expect(move).toEqual({ kind: 'toggle-achievements' })
    })

    it('a is null when not won', () => {
      const state = makeState({ status: 'playing' })
      const move = applyKey(state, { kind: 'char', char: 'a' })
      expect(move).toBeNull()
    })

    it('q triggers quit', () => {
      const state = makeState()
      const move = applyKey(state, { kind: 'char', char: 'q' })
      expect(move).toEqual({ kind: 'quit' })
    })

    it('Q triggers quit', () => {
      const state = makeState()
      const move = applyKey(state, { kind: 'char', char: 'Q' })
      expect(move).toEqual({ kind: 'quit' })
    })

    it('unknown char returns null', () => {
      const state = makeState()
      const move = applyKey(state, { kind: 'char', char: 'x' })
      expect(move).toBeNull()
    })
  })

  describe('applyKey default branch', () => {
    it('applyKey returns null for unmapped key', () => {
      const state = createGame(Difficulty.Normal)
      const result = applyKey(state, { kind: 'char', char: 'z' })
      expect(result).toBeNull()
    })

    it('returns null for unknown key kind', () => {
      const state = createGame(Difficulty.Normal)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = applyKey(state, { kind: 'unknown' } as any)
      expect(result).toBeNull()
    })
  })

  describe('escape/ctrl-c', () => {
    it('escape triggers quit', () => {
      const state = makeState()
      const move = applyKey(state, { kind: 'escape' })
      expect(move).toEqual({ kind: 'quit' })
    })

    it('ctrl-c triggers quit', () => {
      const state = makeState()
      const move = applyKey(state, { kind: 'ctrl-c' })
      expect(move).toEqual({ kind: 'quit' })
    })
  })
})

// ---------------------------------------------------------------------------
// Part 4: Win Screen + Achievements
// ---------------------------------------------------------------------------

describe('renderWinBanner', () => {
  it('renders win message without colors', () => {
    const state = makeState({ status: 'won' })
    const output = renderWinBanner(state)
    expect(output).toContain('Congratulations! You won!')
    expect(output).toContain('N New Game')
    expect(output).toContain('A Achievements')
    expect(output).toContain('Q Quit')
  })

  it('renders with colors', () => {
    const state = makeState({ status: 'won' })
    const output = renderWinBanner(state, { colorsEnabled: true })
    expect(output).toContain('Congratulations! You won!')
    expect(output).toContain('\x1b[')
  })

  it('shows achievement count when achievements unlocked', () => {
    const state = makeState({ status: 'won' })
    const output = renderWinBanner(state, undefined, ['first_win'])
    expect(output).toContain('1 achievement unlocked!')
  })

  it('shows plural when multiple achievements', () => {
    const state = makeState({ status: 'won' })
    const output = renderWinBanner(state, undefined, ['first_win', 'speed_demon'])
    expect(output).toContain('2 achievements unlocked!')
  })

  it('renders colored achievement count with multiple achievements', () => {
    const state = makeState({ status: 'won' })
    const output = renderWinBanner(state, { colorsEnabled: true }, ['first_win', 'speed_demon'])
    expect(output).toContain('2')
    expect(output).toContain('\x1b[')
  })

  it('omits achievement line when none', () => {
    const state = makeState({ status: 'won' })
    const output = renderWinBanner(state)
    expect(output).not.toContain('unlocked')
  })

  it('shows stats', () => {
    const state = makeState({ status: 'won', moveCount: 42, errorCount: 3 })
    const output = renderWinBanner(state)
    expect(output).toContain('Moves: 42')
    expect(output).toContain('Errors: 3')
  })
})

describe('renderSavePrompt', () => {
  it('renders without colors', () => {
    const state = makeState()
    const output = renderSavePrompt(state)
    expect(output).toContain('Save game')
    expect(output).toContain('normal')
    expect(output).toContain('Y/N')
  })

  it('renders with colors', () => {
    const state = makeState({ difficulty: Difficulty.Hard })
    const output = renderSavePrompt(state, { colorsEnabled: true })
    expect(output).toContain('Save game')
    expect(output).toContain('hard')
    expect(output).toContain('\x1b[')
  })
})

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

describe('ACHIEVEMENT_GLYPHS', () => {
  it('has entry for every achievement', () => {
    const ids: AchievementId[] = [
      'first_win', 'speed_demon', 'no_hints_easy', 'perfectionist',
      'minimalist', 'no_undo', 'speedrunner', 'flawless_victory',
      'untouchable', 'century', 'completionist',
    ]
    for (const id of ids) {
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
    const ids: AchievementId[] = [
      'first_win', 'speed_demon', 'no_hints_easy', 'perfectionist',
      'minimalist', 'no_undo', 'speedrunner', 'flawless_victory',
      'untouchable', 'century', 'completionist',
    ]
    for (const id of ids) {
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
    const output = renderAchievementInline(['first_win'])
    expect(output).toContain('first win')
  })

  it('renders multiple achievements', () => {
    const output = renderAchievementInline(['first_win', 'speed_demon'])
    expect(output).toContain('first win')
    expect(output).toContain('speed demon')
  })

  it('renders with colors', () => {
    const output = renderAchievementInline(['first_win'], { colorsEnabled: true })
    expect(output).toContain('first win')
  })

  it('renders legendary with magenta', () => {
    const output = renderAchievementInline(['flawless_victory'], { colorsEnabled: true })
    expect(output).toContain('\x1b[')
  })

  it('renders gold with yellow', () => {
    const output = renderAchievementInline(['perfectionist'], { colorsEnabled: true })
    expect(output).toContain('\x1b[')
  })

  it('renders silver with cyan', () => {
    const output = renderAchievementInline(['speed_demon'], { colorsEnabled: true })
    expect(output).toContain('\x1b[')
  })

  it('renders bronze without special color', () => {
    const output = renderAchievementInline(['first_win'], { colorsEnabled: true })
    expect(output).toContain('first win')
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
    const output = renderAchievementDetail(['first_win'], 1)
    expect(output).toContain('[BRONZE]')
  })

  it('renders with colors', () => {
    const output = renderAchievementDetail(['first_win'], 1, { colorsEnabled: true })
    expect(output).toContain('Achievements')
    expect(output).toContain('\x1b[')
  })

  it('shows dismiss prompt', () => {
    const output = renderAchievementDetail([], 0)
    expect(output).toContain('Press any key to dismiss')
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
    const output = renderTrophyArt()
    const lines = output.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(8)
  })
})

// ---------------------------------------------------------------------------
// Colors disabled — no ANSI escape sequences
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Part 5: Grid Pattern — Unicode box-drawing characters
// ---------------------------------------------------------------------------

describe('grid pattern — Unicode box-drawing characters', () => {
  const gridOutput = (() => {
    const state = createGame(Difficulty.Normal)
    return renderGame(state, { colorsEnabled: false })
  })()

  const gridLines = gridOutput.split('\n')

  it('top border matches pattern ╔═══╤═══╤═══╦═══╤═══╤═══╦═══╤═══╤═══╗', () => {
    const topBorder = gridLines.find((l) => l.startsWith('╔'))
    expect(topBorder).toBe('╔═══╤═══╤═══╦═══╤═══╤═══╦═══╤═══╤═══╗')
  })

  it('bottom border matches pattern ╚═══╧═══╧═══╩═══╧═══╧═══╩═══╧═══╧═══╝', () => {
    const botBorder = gridLines.find((l) => l.startsWith('╚'))
    expect(botBorder).toBe('╚═══╧═══╧═══╩═══╧═══╧═══╩═══╧═══╧═══╝')
  })

  it('thin separator matches pattern ╟───┼───┼───╫───┼───┼───╫───┼───┼───╢', () => {
    const thinSeps = gridLines.filter((l) => l.startsWith('╟'))
    expect(thinSeps.length).toBe(6)
    for (const sep of thinSeps) {
      expect(sep).toBe('╟───┼───┼───╫───┼───┼───╫───┼───┼───╢')
    }
  })

  it('thick separator matches pattern ╠═══╪═══╪═══╬═══╪═══╪═══╬═══╪═══╪═══╣', () => {
    const thickSeps = gridLines.filter((l) => l.startsWith('╠'))
    expect(thickSeps.length).toBe(2)
    for (const sep of thickSeps) {
      expect(sep).toBe('╠═══╪═══╪═══╬═══╪═══╪═══╬═══╪═══╪═══╣')
    }
  })

  it('data rows use ║ between 3×3 boxes and │ within', () => {
    const dataRows = gridLines.filter(
      (l) => l.startsWith('║') && l.endsWith('║'),
    )
    expect(dataRows.length).toBe(9)

    for (const row of dataRows) {
      expect(row.startsWith('║')).toBe(true)
      expect(row.endsWith('║')).toBe(true)

      // Exactly 4 double-vertical: left edge + 2 between boxes + right edge
      const doubleVerticalCount = (row.match(/║/gu) || []).length
      expect(doubleVerticalCount).toBe(4)

      // Exactly 6 single-vertical: 2 per box × 3 boxes
      const singleVerticalCount = (row.match(/│/gu) || []).length
      expect(singleVerticalCount).toBe(6)
    }
  })

  it('grid has exactly 19 lines (top + 9 rows + 6 thin + 2 thick + bottom)', () => {
    const gridSection = gridLines.filter(
      (l) =>
        l.startsWith('╔') ||
        l.startsWith('║') ||
        l.startsWith('╟') ||
        l.startsWith('╠') ||
        l.startsWith('╚'),
    )
    expect(gridSection.length).toBe(19)
  })

  it('all 20 box-drawing characters are present', () => {
    // Double line chars
    expect(gridOutput).toContain('╔')
    expect(gridOutput).toContain('╗')
    expect(gridOutput).toContain('╚')
    expect(gridOutput).toContain('╝')
    expect(gridOutput).toContain('║')
    expect(gridOutput).toContain('═')
    expect(gridOutput).toContain('╦')
    expect(gridOutput).toContain('╩')
    expect(gridOutput).toContain('╠')
    expect(gridOutput).toContain('╣')
    expect(gridOutput).toContain('╬')

    // Single line chars
    expect(gridOutput).toContain('─')
    expect(gridOutput).toContain('│')
    expect(gridOutput).toContain('┼')

    // Mixed junction chars
    expect(gridOutput).toContain('╤')
    expect(gridOutput).toContain('╧')
    expect(gridOutput).toContain('╟')
    expect(gridOutput).toContain('╢')
    expect(gridOutput).toContain('╪')
    expect(gridOutput).toContain('╫')
  })
})

// ---------------------------------------------------------------------------
// Colors disabled — no ANSI escape sequences
// ---------------------------------------------------------------------------

describe('colors disabled', () => {
  it('renderGame has no ANSI escapes', () => {
    const state = createGame(Difficulty.Easy)
    const output = renderGame(state, { colorsEnabled: false })
    expect(output).not.toContain('\x1b[')
  })

  it('renderWinBanner has no ANSI escapes', () => {
    const state = makeState({ status: 'won' })
    const output = renderWinBanner(state, { colorsEnabled: false })
    expect(output).not.toContain('\x1b[')
  })

  it('renderSavePrompt has no ANSI escapes', () => {
    const state = makeState()
    const output = renderSavePrompt(state, { colorsEnabled: false })
    expect(output).not.toContain('\x1b[')
  })

  it('renderAchievementInline has no ANSI escapes', () => {
    const output = renderAchievementInline(['first_win'], { colorsEnabled: false })
    expect(output).not.toContain('\x1b[')
  })

  it('renderAchievementDetail has no ANSI escapes', () => {
    const output = renderAchievementDetail(['first_win'], 1, { colorsEnabled: false })
    expect(output).not.toContain('\x1b[')
  })

  it('renderTrophyArt has no ANSI escapes', () => {
    const output = renderTrophyArt({ colorsEnabled: false })
    expect(output).not.toContain('\x1b[')
  })
})
