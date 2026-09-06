import { Difficulty } from '@hackettyam/sudoku-tools'
import { describe, expect, it } from 'vitest'

import { makeState } from './tui-test-helpers.js'
import { createGame } from '../game/state.js'
import { applyKey, KEYBINDINGS, type ParsedKey } from '../tui.js'

describe('KEYBINDINGS', () => {
  it('is a frozen array', () => {
    expect(Object.isFrozen(KEYBINDINGS)).toBe(true)
  })

  it('contains expected bindings', () => {
    const labels = KEYBINDINGS.map((binding) => binding.label)
    expect(KEYBINDINGS.length).toBe(8)
    expect(labels).toContain('Move up')
    expect(labels).toContain('Move down')
    expect(labels).toContain('Move left')
    expect(labels).toContain('Move right')
  })
})

describe('applyKey cursor and value keys', () => {
  describe('arrow keys', () => {
    it('arrow-up moves cursor up', () => {
      expect(applyKey(makeState({ cursor: { row: 4, col: 4 } }), { kind: 'arrow-up' }))
        .toEqual({ kind: 'move-cursor', row: 3, col: 4 })
    })

    it('arrow-down moves cursor down', () => {
      expect(applyKey(makeState({ cursor: { row: 4, col: 4 } }), { kind: 'arrow-down' }))
        .toEqual({ kind: 'move-cursor', row: 5, col: 4 })
    })

    it('arrow-left moves cursor left', () => {
      expect(applyKey(makeState({ cursor: { row: 4, col: 4 } }), { kind: 'arrow-left' }))
        .toEqual({ kind: 'move-cursor', row: 4, col: 3 })
    })

    it('arrow-right moves cursor right', () => {
      expect(applyKey(makeState({ cursor: { row: 4, col: 4 } }), { kind: 'arrow-right' }))
        .toEqual({ kind: 'move-cursor', row: 4, col: 5 })
    })
  })

  describe('home/end', () => {
    it('home moves to column 0', () => {
      expect(applyKey(makeState({ cursor: { row: 3, col: 5 } }), { kind: 'home' }))
        .toEqual({ kind: 'move-cursor', row: 3, col: 0 })
    })

    it('end moves to column 8', () => {
      expect(applyKey(makeState({ cursor: { row: 3, col: 2 } }), { kind: 'end' }))
        .toEqual({ kind: 'move-cursor', row: 3, col: 8 })
    })

    it('ctrl-home moves to 0,0', () => {
      expect(applyKey(makeState({ cursor: { row: 5, col: 5 } }), { kind: 'ctrl-home' }))
        .toEqual({ kind: 'move-cursor', row: 0, col: 0 })
    })

    it('ctrl-end moves to 8,8', () => {
      expect(applyKey(makeState({ cursor: { row: 0, col: 0 } }), { kind: 'ctrl-end' }))
        .toEqual({ kind: 'move-cursor', row: 8, col: 8 })
    })
  })

  describe('digits', () => {
    it('digit 1 places value when playing', () => {
      expect(applyKey(makeState({ status: 'playing', cursor: { row: 0, col: 0 } }), {
        kind: 'digit', value: 1,
      })).toEqual({ kind: 'place', row: 0, col: 0, value: 1 })
    })

    it('digit 9 places value when playing', () => {
      expect(applyKey(makeState({ status: 'playing', cursor: { row: 8, col: 8 } }), {
        kind: 'digit', value: 9,
      })).toEqual({ kind: 'place', row: 8, col: 8, value: 9 })
    })

    it('digit is null when not playing', () => {
      expect(applyKey(makeState({ status: 'won' }), { kind: 'digit', value: 5 })).toBeNull()
    })
  })

  describe('backspace/delete/clear', () => {
    it('backspace clears when playing', () => {
      expect(applyKey(makeState({ status: 'playing', cursor: { row: 2, col: 3 } }), {
        kind: 'backspace',
      })).toEqual({ kind: 'clear', row: 2, col: 3 })
    })

    it('delete clears when playing', () => {
      expect(applyKey(makeState({ status: 'playing', cursor: { row: 1, col: 7 } }), {
        kind: 'delete',
      })).toEqual({ kind: 'clear', row: 1, col: 7 })
    })

    it('backspace is null when not playing', () => {
      expect(applyKey(makeState({ status: 'won' }), { kind: 'backspace' })).toBeNull()
    })

    it('delete is null when not playing', () => {
      expect(applyKey(makeState({ status: 'quit' }), { kind: 'delete' })).toBeNull()
    })
  })
})

describe('applyKey character keys', () => {
  describe('char keys', () => {
    it('char 0 clears when playing', () => {
      expect(applyKey(makeState({ status: 'playing', cursor: { row: 0, col: 0 } }), {
        kind: 'char', char: '0',
      })).toEqual({ kind: 'clear', row: 0, col: 0 })
    })

    it('char 0 is null when not playing', () => {
      expect(applyKey(makeState({ status: 'won' }), { kind: 'char', char: '0' })).toBeNull()
    })

    it('h triggers hint', () => {
      expect(applyKey(makeState(), { kind: 'char', char: 'h' })).toEqual({ kind: 'hint' })
    })

    it('H triggers hint', () => {
      expect(applyKey(makeState(), { kind: 'char', char: 'H' })).toEqual({ kind: 'hint' })
    })

    it('u triggers undo', () => {
      expect(applyKey(makeState(), { kind: 'char', char: 'u' })).toEqual({ kind: 'undo' })
    })

    it('U triggers undo', () => {
      expect(applyKey(makeState(), { kind: 'char', char: 'U' })).toEqual({ kind: 'undo' })
    })

    it('n triggers new-game when won', () => {
      expect(applyKey(makeState({ status: 'won' }), { kind: 'char', char: 'n' }))
        .toEqual({ kind: 'new-game' })
    })

    it('n triggers new-game when quit', () => {
      expect(applyKey(makeState({ status: 'quit' }), { kind: 'char', char: 'n' }))
        .toEqual({ kind: 'new-game' })
    })

    it('n is null when playing', () => {
      expect(applyKey(makeState({ status: 'playing' }), { kind: 'char', char: 'n' })).toBeNull()
    })

    it('a toggles achievements when won', () => {
      expect(applyKey(makeState({ status: 'won' }), { kind: 'char', char: 'a' }))
        .toEqual({ kind: 'toggle-achievements' })
    })

    it('A toggles achievements when won', () => {
      expect(applyKey(makeState({ status: 'won' }), { kind: 'char', char: 'A' }))
        .toEqual({ kind: 'toggle-achievements' })
    })

    it('a is null when not won', () => {
      expect(applyKey(makeState({ status: 'playing' }), { kind: 'char', char: 'a' })).toBeNull()
    })

    it('q triggers quit', () => {
      expect(applyKey(makeState(), { kind: 'char', char: 'q' })).toEqual({ kind: 'quit' })
    })

    it('Q triggers quit', () => {
      expect(applyKey(makeState(), { kind: 'char', char: 'Q' })).toEqual({ kind: 'quit' })
    })

    it('unknown char returns null', () => {
      expect(applyKey(makeState(), { kind: 'char', char: 'x' })).toBeNull()
    })
  })

  describe('applyKey default branch', () => {
    it('applyKey returns null for unmapped key', () => {
      expect(applyKey(createGame(Difficulty.Normal), { kind: 'char', char: 'z' })).toBeNull()
    })

    it('returns null for unknown key kind', () => {
      const unknownKey = { kind: 'unknown' } as unknown as ParsedKey
      expect(applyKey(createGame(Difficulty.Normal), unknownKey)).toBeNull()
    })
  })

  describe('escape/ctrl-c', () => {
    it('escape triggers quit', () => {
      expect(applyKey(makeState(), { kind: 'escape' })).toEqual({ kind: 'quit' })
    })

    it('ctrl-c triggers quit', () => {
      expect(applyKey(makeState(), { kind: 'ctrl-c' })).toEqual({ kind: 'quit' })
    })
  })
})
