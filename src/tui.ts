import pc from 'picocolors'

import type { AchievementId } from './persistence/achievements.js'
import { difficultyToName } from './format/difficulty.js'
import type { GameState, Move } from './game/state.js'
import { isReadOnly } from './game/state.js'

// ---------------------------------------------------------------------------
// Part 1: Keypress Parser (T-011)
// ---------------------------------------------------------------------------

/** Discriminated union of parsed key events. */
export type ParsedKey =
  | { readonly kind: 'arrow-up' }
  | { readonly kind: 'arrow-down' }
  | { readonly kind: 'arrow-left' }
  | { readonly kind: 'arrow-right' }
  | { readonly kind: 'home' }
  | { readonly kind: 'end' }
  | { readonly kind: 'ctrl-home' }
  | { readonly kind: 'ctrl-end' }
  | { readonly kind: 'digit'; readonly value: number }
  | { readonly kind: 'backspace' }
  | { readonly kind: 'delete' }
  | { readonly kind: 'char'; readonly char: string }
  | { readonly kind: 'escape' }
  | { readonly kind: 'ctrl-c' }

/**
 * Parse raw terminal input bytes into structured key events.
 * Handles ANSI CSI sequences. Unknown sequences return [].
 *
 * @param buf - Raw input buffer from stdin.
 * @returns Array of parsed key events (usually 0 or 1).
 *
 * @example
 * ```ts
 * parseKeypress(Buffer.from('\x1b[A')) // [{ kind: 'arrow-up' }]
 * ```
 */
export function parseKeypress(buf: Buffer): readonly ParsedKey[] {
  const result: ParsedKey[] = []
  let i = 0

  while (i < buf.length) {
    const b = buf[i] as number

    // Ctrl-C
    if (b === 0x03) {
      result.push({ kind: 'ctrl-c' })
      i++
      continue
    }

    // Escape sequence start
    if (b === 0x1b) {
      const next = buf[i + 1]
      if (next !== undefined && next === 0x5b) {
        // CSI sequence: \x1b[
        const parsed = parseCsiSequence(buf, i + 2)
        if (parsed.key !== null) {
          result.push(parsed.key)
        }
        i = parsed.nextIndex
      } else if (i + 1 === buf.length) {
        // Lone escape
        result.push({ kind: 'escape' })
        i++
      } else {
        // Unknown escape sequence — skip escape byte
        i++
      }
      continue
    }

    // Backspace (DEL or BS)
    if (b === 0x7f || b === 0x08) {
      result.push({ kind: 'backspace' })
      i++
      continue
    }

    // Digits 1-9
    if (b >= 0x31 && b <= 0x39) {
      result.push({ kind: 'digit', value: b - 0x30 })
      i++
      continue
    }

    // Other printable ASCII (space through tilde)
    if (b >= 0x20 && b <= 0x7e) {
      result.push({ kind: 'char', char: String.fromCharCode(b) })
      i++
      continue
    }

    // Unknown byte — skip
    i++
  }

  return result
}

interface CsiParseResult {
  readonly key: ParsedKey | null
  readonly nextIndex: number
}

/**
 * Parse a CSI sequence starting after `\x1b[`.
 *
 * @param buf  - Full input buffer.
 * @param from - Index after the `[` byte.
 * @returns The parsed key and next read index.
 */
function parseCsiSequence(buf: Buffer, from: number): CsiParseResult {
  let i = from
  const params: number[] = []
  let current = ''

  // Collect parameter bytes (digits and semicolons)
  while (i < buf.length) {
    const ch = buf[i] as number
    if (ch >= 0x30 && ch <= 0x3b) {
      // 0-9 or semicolon
      if (ch === 0x3b) {
        params.push(current === '' ? 0 : Number(current))
        current = ''
      } else {
        current += String.fromCharCode(ch)
      }
      i++
    } else {
      break
    }
  }

  if (current !== '') {
    params.push(Number(current))
  }

  if (i >= buf.length) {
    return { key: null, nextIndex: i }
  }

  const finalByte = buf[i]
  i++

  switch (finalByte) {
    case 0x41: return { key: { kind: 'arrow-up' }, nextIndex: i }
    case 0x42: return { key: { kind: 'arrow-down' }, nextIndex: i }
    case 0x43: return { key: { kind: 'arrow-right' }, nextIndex: i }
    case 0x44: return { key: { kind: 'arrow-left' }, nextIndex: i }
    case 0x48: {
      // H — Home / Ctrl-Home / Ctrl-End
      if (params.length === 2 && params[1] === 5) {
        if (params[0] === 1) return { key: { kind: 'ctrl-home' }, nextIndex: i }
        if (params[0] === 8) return { key: { kind: 'ctrl-end' }, nextIndex: i }
      }
      return { key: { kind: 'home' }, nextIndex: i }
    }
    case 0x46: {
      // F — End / Ctrl-End
      const isCtrl = params.length === 2 && params[0] === 8 && params[1] === 5
      return { key: { kind: isCtrl ? 'ctrl-end' : 'end' }, nextIndex: i }
    }
    case 0x7e: {
      // ~ — Tilde sequences
      if (params[0] === 3) {
        return { key: { kind: 'delete' }, nextIndex: i }
      }
      if (params.length === 2) {
        if (params[0] === 1 && params[1] === 5) {
          return { key: { kind: 'ctrl-home' }, nextIndex: i }
        }
        if (params[0] === 4 && params[1] === 5) {
          return { key: { kind: 'ctrl-end' }, nextIndex: i }
        }
      }
      return { key: null, nextIndex: i }
    }
    default:
      return { key: null, nextIndex: i }
  }
}

// ---------------------------------------------------------------------------
// Part 2: Renderer (T-012)
// ---------------------------------------------------------------------------

/** Options controlling TUI rendering. */
export interface RenderOptions {
  /** Whether to use ANSI color codes. Default: false. */
  readonly colorsEnabled?: boolean
  /** Width for the grid area. Default: 38. */
  readonly width?: number
}

/**
 * Format milliseconds as mm:ss or h:mm:ss.
 *
 * @param ms - Elapsed time in milliseconds.
 * @returns Formatted time string.
 *
 * @example
 * ```ts
 * formatTime(0)      // '00:00'
 * formatTime(65000)  // '01:05'
 * formatTime(3661000) // '1:01:01'
 * ```
 */
export function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Render the full game screen as a single string.
 *
 * @param state   - Current game state.
 * @param options - Rendering options.
 * @returns The complete screen buffer.
 *
 * @example
 * ```ts
 * const screen = renderGame(state, { colorsEnabled: true })
 * ```
 */
export function renderGame(state: GameState, options?: RenderOptions): string {
  const colorsOn = options?.colorsEnabled ?? false
  const colors = pc.createColors(colorsOn)

  const lines: string[] = []

  // 1. Header
  const diffName = difficultyToName(state.difficulty)
  const header = `Sudoku CLI — ${diffName}`
  lines.push(colorsOn ? colors.dim(colors.bold(header)) : header)
  lines.push('')

  // 2. Grid
  lines.push(renderGrid(state, { colorsEnabled: colorsOn }))

  // 3. Stats line
  const elapsed = Date.now() - state.startedAt
  const statsLine =
    `Time: ${formatTime(elapsed)} · ` +
    `Moves: ${String(state.moveCount).padStart(2, '0')} · ` +
    `Errors: ${String(state.errorCount).padStart(2, '0')}`
  lines.push('')
  lines.push(colorsOn ? colors.dim(statsLine) : statsLine)

  // 4. Footer
  lines.push('')
  const footer = '←→↑↓ Move  1-9 Place  0/Del Clear  U Undo  H Hint  Q Quit'
  lines.push(colorsOn ? colors.dim(footer) : footer)

  return lines.join('\n')
}

/**
 * Render the 9x9 grid with Unicode box-drawing characters.
 *
 * @param state   - Current game state.
 * @param options - Rendering options.
 * @returns The grid string.
 */
function renderGrid(state: GameState, options: { readonly colorsEnabled?: boolean }): string {
  const colorsOn = options.colorsEnabled ?? false
  const colors = pc.createColors(colorsOn)
  const cellWidth = 3
  const rowSep = '─'.repeat(cellWidth)
  const top = `┌${rowSep}┬${rowSep}┬${rowSep}┐`
  const mid = `├${rowSep}┼${rowSep}┼${rowSep}┤`
  const bot = `└${rowSep}┴${rowSep}┴${rowSep}┘`

  const rows: string[] = [top]

  for (let r = 0; r < 9; r++) {
    const cells: string[] = []
    for (let c = 0; c < 9; c++) {
      const cell = state.board[r]?.[c]
      if (cell === undefined) continue
      const val = cell
      const isClue = isReadOnly(state, r, c)
      const isCursor = state.cursor.row === r && state.cursor.col === c
      const isUserFilled = !isClue && val !== 0
      const solutionCell = state.solution[r]?.[c]
      const isCorrect = isUserFilled && val === solutionCell
      const isError = isUserFilled && val !== solutionCell

      let display: string
      if (val === 0) {
        display = '.'
      } else {
        display = String(val)
      }

      display = display.padStart(2).padEnd(cellWidth)

      if (colorsOn) {
        if (isCursor) {
          display = colors.inverse(display)
        } else if (isError) {
          display = colors.red(colors.inverse(display))
        } else if (isCorrect) {
          display = colors.dim(colors.cyan(display))
        } else if (isClue) {
          display = colors.bold(display)
        } else {
          display = colors.dim(display)
        }
      }

      cells.push(display)
    }

    const left = r % 3 === 0 ? '│' : '│'
    const right = '│'
    rows.push(`${left}${cells.join('│')}${right}`)

    if (r < 8 && r % 3 !== 2) {
      rows.push(mid)
    } else if (r < 8) {
      rows.push(`├${rowSep}┼${rowSep}┼${rowSep}┤`)
    }
  }

  rows.push(bot)
  return rows.join('\n')
}

// ---------------------------------------------------------------------------
// Part 3: Key Binding (T-013)
// ---------------------------------------------------------------------------

/** A keybinding with its associated label. */
export interface KeyBinding {
  /** The parsed key event. */
  readonly key: ParsedKey
  /** Human-readable label for the key. */
  readonly label: string
}

/** Default keybindings displayed in the footer. */
export const KEYBINDINGS: readonly KeyBinding[] = Object.freeze([
  { key: { kind: 'arrow-up' }, label: 'Move up' },
  { key: { kind: 'arrow-down' }, label: 'Move down' },
  { key: { kind: 'arrow-left' }, label: 'Move left' },
  { key: { kind: 'arrow-right' }, label: 'Move right' },
  { key: { kind: 'home' }, label: 'Row start' },
  { key: { kind: 'end' }, label: 'Row end' },
  { key: { kind: 'ctrl-home' }, label: 'Board top-left' },
  { key: { kind: 'ctrl-end' }, label: 'Board bottom-right' },
])

/**
 * Map a parsed key to a game move. Returns null for unmapped keys.
 *
 * @param state - Current game state.
 * @param key   - The parsed key event.
 * @returns The corresponding Move, or null if unmapped.
 *
 * @example
 * ```ts
 * applyKey(state, { kind: 'arrow-right' }) // { kind: 'move-cursor', row: ..., col: ... }
 * ```
 */
export function applyKey(state: GameState, key: ParsedKey): Move | null {
  const { cursor, status } = state

  switch (key.kind) {
    case 'arrow-up':
      return { kind: 'move-cursor', row: cursor.row - 1, col: cursor.col }
    case 'arrow-down':
      return { kind: 'move-cursor', row: cursor.row + 1, col: cursor.col }
    case 'arrow-left':
      return { kind: 'move-cursor', row: cursor.row, col: cursor.col - 1 }
    case 'arrow-right':
      return { kind: 'move-cursor', row: cursor.row, col: cursor.col + 1 }

    case 'home':
      return { kind: 'move-cursor', row: cursor.row, col: 0 }
    case 'end':
      return { kind: 'move-cursor', row: cursor.row, col: 8 }
    case 'ctrl-home':
      return { kind: 'move-cursor', row: 0, col: 0 }
    case 'ctrl-end':
      return { kind: 'move-cursor', row: 8, col: 8 }

    case 'digit':
      if (status === 'playing') {
        return {
          kind: 'place',
          row: cursor.row,
          col: cursor.col,
          value: key.value,
        }
      }
      return null

    case 'backspace':
    case 'delete':
      if (status === 'playing') {
        return { kind: 'clear', row: cursor.row, col: cursor.col }
      }
      return null

    case 'char':
      if (key.char === '0') {
        if (status === 'playing') {
          return { kind: 'clear', row: cursor.row, col: cursor.col }
        }
        return null
      }
      if (key.char === 'h' || key.char === 'H') {
        return { kind: 'hint' }
      }
      if (key.char === 'u' || key.char === 'U') {
        return { kind: 'undo' }
      }
      if (key.char === 'n' || key.char === 'N') {
        if (status === 'won' || status === 'quit') {
          return { kind: 'new-game' }
        }
        return null
      }
      if (key.char === 'a' || key.char === 'A') {
        if (status === 'won') {
          return { kind: 'toggle-achievements' }
        }
        return null
      }
      if (key.char === 'q' || key.char === 'Q') {
        return { kind: 'quit' }
      }
      return null

    case 'escape':
      return { kind: 'quit' }

    case 'ctrl-c':
      return { kind: 'quit' }

    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Part 4: Win Screen + Achievements (T-014, T-015)
// ---------------------------------------------------------------------------

/**
 * Render win banner with stats.
 *
 * @param state          - Current game state (must be won).
 * @param options        - Rendering options.
 * @param newAchievements - Newly unlocked achievement IDs.
 * @returns The win banner string.
 *
 * @example
 * ```ts
 * renderWinBanner(state, { colorsEnabled: true }, ['first_win'])
 * ```
 */
export function renderWinBanner(
  state: GameState,
  options?: RenderOptions,
  newAchievements?: readonly AchievementId[],
): string {
  const colorsOn = options?.colorsEnabled ?? false
  const colors = pc.createColors(colorsOn)
  const lines: string[] = []

  const elapsed = Date.now() - state.startedAt
  const statsLine = `Time: ${formatTime(elapsed)} · Moves: ${state.moveCount} · Errors: ${state.errorCount}`

  lines.push('')
  if (colorsOn) {
    lines.push(colors.bold(colors.green('🎉 Congratulations! You won!')))
  } else {
    lines.push('Congratulations! You won!')
  }
  lines.push('')
  lines.push(colorsOn ? colors.dim(statsLine) : statsLine)

  if (newAchievements && newAchievements.length > 0) {
    lines.push('')
    if (colorsOn) {
      lines.push(
        colors.yellow(
          `🏆 ${newAchievements.length} achievement${
            newAchievements.length > 1 ? 's' : ''
          } unlocked!`,
        ),
      )
    } else {
      lines.push(`🏆 ${newAchievements.length} achievement${newAchievements.length > 1 ? 's' : ''} unlocked!`)
    }
  }

  lines.push('')
  lines.push('N New Game  A Achievements  Q Quit')
  lines.push('')

  return lines.join('\n')
}

/**
 * Render save prompt footer.
 *
 * @param state   - Current game state.
 * @param options - Rendering options.
 * @returns The save prompt string.
 *
 * @example
 * ```ts
 * renderSavePrompt(state, { colorsEnabled: true })
 * ```
 */
export function renderSavePrompt(state: GameState, options?: RenderOptions): string {
  const colorsOn = options?.colorsEnabled ?? false
  const colors = pc.createColors(colorsOn)
  const diffName = difficultyToName(state.difficulty)
  const prompt = `Save game (${diffName})? Y/N`

  if (colorsOn) {
    return colors.dim(prompt)
  }
  return prompt
}

/**
 * Format a UUID to first 8 chars.
 *
 * @param id - A UUID string.
 * @returns The first 8 characters.
 *
 * @example
 * ```ts
 * formatShortId('550e8400-e29b-41d4-a716-446655440000') // '550e8400'
 * ```
 */
export function formatShortId(id: string): string {
  return id.slice(0, 8)
}

/** Glyph for each achievement. */
export const ACHIEVEMENT_GLYPHS: Readonly<Record<AchievementId, string>> = Object.freeze({
  first_win: '🌟',
  speed_demon: '⚡',
  no_hints_easy: '🧠',
  perfectionist: '💎',
  minimalist: '🎯',
  no_undo: '🛡️',
  speedrunner: '🏃',
  flawless_victory: '👑',
  untouchable: '🔒',
  century: '💯',
  completionist: '🏆',
})

/** Rarity tiers for achievements. */
export type Rarity = 'bronze' | 'silver' | 'gold' | 'legendary'

/** Rarity mapping for each achievement. */
export const ACHIEVEMENT_RARITY: Readonly<Record<AchievementId, Rarity>> = Object.freeze({
  first_win: 'bronze',
  speed_demon: 'silver',
  no_hints_easy: 'bronze',
  perfectionist: 'gold',
  minimalist: 'silver',
  no_undo: 'gold',
  speedrunner: 'gold',
  flawless_victory: 'legendary',
  untouchable: 'legendary',
  century: 'legendary',
  completionist: 'legendary',
})

/**
 * Render inline achievement summary. Returns '' when colors disabled AND non-TTY.
 *
 * @param newAchievements - Achievement IDs to display.
 * @param options         - Rendering options.
 * @returns The inline achievement string.
 *
 * @example
 * ```ts
 * renderAchievementInline(['first_win'], { colorsEnabled: true })
 * ```
 */
export function renderAchievementInline(
  newAchievements: readonly AchievementId[],
  options?: RenderOptions,
): string {
  if (newAchievements.length === 0) {
    return ''
  }

  const colorsOn = options?.colorsEnabled ?? false
  const colors = pc.createColors(colorsOn)

  const parts = newAchievements.map((id) => {
    const glyph = ACHIEVEMENT_GLYPHS[id]
    const name = id.replace(/_/g, ' ')
    if (colorsOn) {
      const rarity = ACHIEVEMENT_RARITY[id]
      const colored = rarity === 'legendary'
        ? colors.magenta(`${glyph} ${name}`)
        : rarity === 'gold'
          ? colors.yellow(`${glyph} ${name}`)
          : rarity === 'silver'
            ? colors.cyan(`${glyph} ${name}`)
            : `${glyph} ${name}`
      return colored
    }
    return `${glyph} ${name}`
  })

  return parts.join('  ')
}

/**
 * Render full achievement detail view (dismissable).
 *
 * @param newAchievements - Achievement IDs to display.
 * @param totalUnlocked   - Total number of achievements unlocked.
 * @param options         - Rendering options.
 * @returns The achievement detail view string.
 *
 * @example
 * ```ts
 * renderAchievementDetail(['first_win', 'speed_demon'], 2, { colorsEnabled: true })
 * ```
 */
export function renderAchievementDetail(
  newAchievements: readonly AchievementId[],
  totalUnlocked: number,
  options?: RenderOptions,
): string {
  const colorsOn = options?.colorsEnabled ?? false
  const colors = pc.createColors(colorsOn)
  const lines: string[] = []

  lines.push('')
  if (colorsOn) {
    lines.push(colors.bold('Achievements'))
  } else {
    lines.push('Achievements')
  }
  lines.push(`${totalUnlocked}/11 unlocked`)
  lines.push('')

  for (const id of newAchievements) {
    const glyph = ACHIEVEMENT_GLYPHS[id]
    const name = id.replace(/_/g, ' ')
    const rarity = ACHIEVEMENT_RARITY[id]

    if (colorsOn) {
      const rarityLabel = rarity.toUpperCase()
      lines.push(`  ${glyph} ${colors.bold(name)} [${rarityLabel}]`)
    } else {
      lines.push(`  ${glyph} ${name} [${rarity.toUpperCase()}]`)
    }
  }

  lines.push('')
  lines.push('Press any key to dismiss')

  return lines.join('\n')
}

/**
 * Render ASCII trophy art (3-4 lines).
 *
 * @param options - Rendering options.
 * @returns The trophy ASCII art string.
 *
 * @example
 * ```ts
 * renderTrophyArt({ colorsEnabled: true })
 * ```
 */
export function renderTrophyArt(options?: RenderOptions): string {
  const colorsOn = options?.colorsEnabled ?? false
  const colors = pc.createColors(colorsOn)

  const art = [
    '   ___________',
    '  \'._==_==_=_.\'',
    '  .-\\:      /-.',
    ' | (|:.     |) |',
    '  \'-|:.     |-\'',
    '    \\::.    /',
    '     \'::. .\'',
    '       ) (',
    '     _.\' \'._',
    '    \'-------\'',
  ]

  if (colorsOn) {
    return art.map((line) => colors.yellow(line)).join('\n')
  }
  return art.join('\n')
}
