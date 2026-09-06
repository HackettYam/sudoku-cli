import { Difficulty, type DifficultyType } from '@hackettyam/sudoku-tools'

import { difficultyToName } from '../format/difficulty.js'
import { formatTable, type Column, type Row } from '../format/table.js'
import type { LockFactory } from '../persistence/lock.js'
import { nodeLockFactory } from '../persistence/lock.js'
import {
  defaultStateLockPath,
  defaultStatePath,
  loadState,
  nodeFsAdapter,
  type FsAdapter,
  type StateFile,
} from '../persistence/state.js'
import { formatTime } from '../tui.js'

/** Result of the play-leaderboard command. */
export interface PlayLeaderboardResult {
  readonly kind: 'play_leaderboard'
  readonly lines: readonly string[]
}

/** Dependencies for the play-leaderboard command. */
export interface PlayLeaderboardDeps {
  readonly fs?: FsAdapter
  readonly lock?: LockFactory
  readonly statePath?: string
}

/** Build leaderboard rows in the canonical difficulty order. */
function formatLeaderboardRows(state: StateFile): Row[] {
  const difficulties: readonly DifficultyType[] = [
    Difficulty.Novice, Difficulty.Easy, Difficulty.Normal, Difficulty.Hard, Difficulty.Expert,
  ]
  const rows: Row[] = []

  for (const diff of difficulties) {
    const stats = state.stats[diff]

    const name = difficultyToName(diff)
    const bestTime = stats.bestTimeMs !== null ? formatTime(stats.bestTimeMs) : '--:--'
    const fewest = stats.fewestMoves !== null ? String(stats.fewestMoves) : '--'
    rows.push([name, bestTime, fewest])
  }

  return rows
}

/**
 * Load state, format per-difficulty best times + moves as ASCII table.
 *
 * @param deps - Injectable dependencies.
 * @returns Lines of formatted leaderboard.
 *
 * @example
 * ```ts
 * const result = await playLeaderboardCommand()
 * result.lines.forEach(line => console.log(line))
 * ```
 */
export async function playLeaderboardCommand(
  deps?: PlayLeaderboardDeps,
): Promise<PlayLeaderboardResult> {
  const fs = deps?.fs ?? nodeFsAdapter
  const lock = deps?.lock ?? nodeLockFactory(defaultStateLockPath())
  const statePath = deps?.statePath ?? defaultStatePath()

  const state = await loadState(fs, statePath, lock)
  const lines: string[] = ['Leaderboard', '']

  const columns: readonly Column[] = [
    { header: 'Difficulty', width: 10 },
    { header: 'Best Time', width: 12, align: 'right' },
    { header: 'Fewest Moves', width: 14, align: 'right' },
  ]

  const table = formatTable(columns, formatLeaderboardRows(state))
  lines.push(...table.split('\n').map((line) => `  ${line}`))

  return { kind: 'play_leaderboard', lines }
}
