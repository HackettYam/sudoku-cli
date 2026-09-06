import pc from 'picocolors'

import { difficultyToName } from './format/difficulty.js'
import type { GameState, Move } from './game/state.js'
import { isReadOnly } from './game/state.js'
import type { AchievementId } from './persistence/achievements.js'
import { parseKeypress, type ParsedKey } from './tui-keypress.js'

export { parseKeypress, type ParsedKey }

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

type TuiColors = ReturnType<typeof pc.createColors>

interface ColorContext {
  readonly colorsOn: boolean
  readonly colors: TuiColors
}

interface GridRenderContext extends ColorContext {
  readonly cellWidth: 3
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
    return `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
const GRID_BORDERS = {
  top: '╔═══╤═══╤═══╦═══╤═══╤═══╦═══╤═══╤═══╗',
  midThin: '╟───┼───┼───╫───┼───┼───╫───┼───┼───╢',
  midThick: '╠═══╪═══╪═══╬═══╪═══╪═══╬═══╪═══╪═══╣',
  bottom: '╚═══╧═══╧═══╩═══╧═══╧═══╩═══╧═══╧═══╝',
} as const

interface GridCellStyle {
  readonly isClue: boolean
  readonly isCursor: boolean
  readonly isCorrect: boolean
  readonly isError: boolean
}

/** Apply the TUI color priority to one already-padded cell. */
function colorGridCell(display: string, style: GridCellStyle, context: GridRenderContext): string {
  if (!context.colorsOn) {
    return display
  }
  if (style.isCursor) {
    return context.colors.inverse(display)
  }
  if (style.isError) {
    return context.colors.red(context.colors.inverse(display))
  }
  if (style.isCorrect) {
    return context.colors.dim(context.colors.cyan(display))
  }
  if (style.isClue) {
    return context.colors.bold(display)
  }
  return context.colors.dim(display)
}

/** Render one cell, returning undefined for sparse board entries. */
function renderGridCell(
  state: GameState,
  position: readonly [number, number],
  context: GridRenderContext,
): string | undefined {
  const [row, col] = position
  const value = state.board[row]?.[col]
  if (value === undefined) {
    return undefined
  }

  const isClue = isReadOnly(state, row, col)
  const isCursor = state.cursor.row === row && state.cursor.col === col
  const isUserFilled = !isClue && value !== 0
  const solutionCell = state.solution[row]?.[col]
  const display = (value === 0 ? '.' : String(value))
    .padStart(2)
    .padEnd(context.cellWidth)

  return colorGridCell(display, {
    isClue,
    isCursor,
    isCorrect: isUserFilled && value === solutionCell,
    isError: isUserFilled && value !== solutionCell,
  }, context)
}

/** Return the correct vertical separator for a cell boundary. */
function getVerticalSeparator(index: number): string {
  return index === 2 || index === 5 ? '║' : '│'
}

/** Render one full grid row with its vertical separators. */
function renderGridRow(state: GameState, row: number, context: GridRenderContext): string {
  const cells: string[] = []
  for (let col = 0; col < 9; col++) {
    const cell = renderGridCell(state, [row, col], context)
    if (cell !== undefined) {
      cells.push(cell)
    }
  }

  let output = '║'
  for (let index = 0; index < cells.length; index++) {
    output += cells[index] ?? ''
    if (index < cells.length - 1) {
      output += getVerticalSeparator(index)
    }
  }
  return `${output}║`
}

/** Return a horizontal separator after a grid row, when needed. */
function renderGrid(state: GameState, options: { readonly colorsEnabled?: boolean }): string {
  const colorsOn = options.colorsEnabled ?? false
  const context: GridRenderContext = {
    colorsOn,
    colors: pc.createColors(colorsOn),
    cellWidth: 3,
  }
  const rows: string[] = [GRID_BORDERS.top]

  for (let row = 0; row < 9; row++) {
    rows.push(renderGridRow(state, row, context))
    if (row < 8) {
      rows.push(row % 3 === 2 ? GRID_BORDERS.midThick : GRID_BORDERS.midThin)
    }
  }

  rows.push(GRID_BORDERS.bottom)
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
function applyCursorKey(cursor: GameState['cursor'], key: ParsedKey): Move | null {
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
    default:
      return null
  }
}

/** Create a clear move when the game is still editable. */
function createClearMove(state: GameState): Move | null {
  if (state.status !== 'playing') {
    return null
  }
  return { kind: 'clear', row: state.cursor.row, col: state.cursor.col }
}

/** Map a printable command character to a game action. */
function applyCharacterKey(state: GameState, character: string): Move | null {
  switch (character.toLowerCase()) {
    case '0':
      return createClearMove(state)
    case 'h':
      return { kind: 'hint' }
    case 'u':
      return { kind: 'undo' }
    case 'n':
      if (state.status === 'won' || state.status === 'quit') {
        return { kind: 'new-game' }
      }
      return null
    case 'a':
      return state.status === 'won' ? { kind: 'toggle-achievements' } : null
    case 'q':
      return { kind: 'quit' }
    default:
      return null
  }
}

/** Map non-navigation key events to game actions. */
function applyInputKey(state: GameState, key: ParsedKey): Move | null {
  switch (key.kind) {
    case 'digit':
      if (state.status === 'playing') {
        return {
          kind: 'place',
          row: state.cursor.row,
          col: state.cursor.col,
          value: key.value,
        }
      }
      return null

    case 'backspace':
    case 'delete':
      return createClearMove(state)

    case 'char':
      return applyCharacterKey(state, key.char)

    case 'escape':
      return { kind: 'quit' }

    case 'ctrl-c':
      return { kind: 'quit' }

    default:
      return null
  }
}

export function applyKey(state: GameState, key: ParsedKey): Move | null {
  return applyCursorKey(state.cursor, key) ?? applyInputKey(state, key)
}

// ---------------------------------------------------------------------------
// Part 4: Win Screen + Achievements (T-014, T-015)
// ---------------------------------------------------------------------------

/** Format the common header used by the win screen. */
function formatWinHeader(state: GameState, context: ColorContext): string {
  const diffName = difficultyToName(state.difficulty)
  const header = `Sudoku CLI — ${diffName}`
  return context.colorsOn ? context.colors.dim(context.colors.bold(header)) : header
}

/** Format the frozen or current win-screen statistics. */
function formatWinStats(state: GameState): string {
  const elapsed = state.frozenTime !== undefined
    ? state.frozenTime - state.startedAt
    : Date.now() - state.startedAt
  return `Time: ${formatTime(elapsed)} · Moves: ${String(state.moveCount)} · Errors: ${String(state.errorCount)}`
}

/** Append the congratulations message and win statistics. */
function appendWinMessage(lines: string[], state: GameState, context: ColorContext): void {
  const message = context.colorsOn
    ? context.colors.bold(context.colors.green('🎉 Congratulations! You won!'))
    : 'Congratulations! You won!'
  const stats = formatWinStats(state)

  lines.push(message, '', context.colorsOn ? context.colors.dim(stats) : stats)
}

/** Format the achievement notification shown below a win. */
function formatAchievementUnlockMessage(count: number): string {
  const plural = count > 1 ? 's' : ''
  return `🏆 ${String(count)} achievement${plural} unlocked!`
}

/** Append an optional newly-unlocked achievement notification. */
function appendAchievementNotice(
  lines: string[],
  newAchievements: readonly AchievementId[] | undefined,
  context: ColorContext,
): void {
  if (newAchievements === undefined || newAchievements.length === 0) {
    return
  }

  const message = formatAchievementUnlockMessage(newAchievements.length)
  lines.push('', context.colorsOn ? context.colors.yellow(message) : message)
}

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
  const context: ColorContext = { colorsOn, colors: pc.createColors(colorsOn) }
  const lines: string[] = [
    formatWinHeader(state, context),
    '',
    renderGrid(state, { colorsEnabled: colorsOn }),
    '',
  ]

  appendWinMessage(lines, state, context)
  appendAchievementNotice(lines, newAchievements, context)

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

/** Apply the color associated with an achievement rarity. */
function colorAchievement(content: string, rarity: Rarity, colors: TuiColors): string {
  switch (rarity) {
    case 'legendary':
      return colors.magenta(content)
    case 'gold':
      return colors.yellow(content)
    case 'silver':
      return colors.cyan(content)
    default:
      return content
  }
}

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
    const content = `${glyph} ${name}`
    if (!colorsOn) {
      return content
    }
    return colorAchievement(content, ACHIEVEMENT_RARITY[id], colors)
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
  lines.push(`${String(totalUnlocked)}/11 unlocked`)
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
