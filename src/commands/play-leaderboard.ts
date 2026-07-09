import { Difficulty, type DifficultyType } from '@hackettyam/sudoku-tools'
import { loadState } from '../persistence/state.js'
import type { FsAdapter } from '../persistence/state.js'
import { nodeLockFactory } from '../persistence/lock.js'
import type { LockFactory } from '../persistence/lock.js'
import { defaultStatePath, defaultStateLockPath, nodeFsAdapter } from '../persistence/state.js'
import { difficultyToName } from '../format/difficulty.js'
import { formatTable } from '../format/table.js'
import type { Column, Row } from '../format/table.js'
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
  const lines: string[] = []

  lines.push('Leaderboard')
  lines.push('')

  const columns: readonly Column[] = [
    { header: 'Difficulty', width: 10 },
    { header: 'Best Time', width: 12, align: 'right' },
    { header: 'Fewest Moves', width: 14, align: 'right' },
  ]

  const difficulties: readonly DifficultyType[] = [
    Difficulty.Novice, Difficulty.Easy, Difficulty.Normal, Difficulty.Hard, Difficulty.Expert,
  ]

  const rows: Row[] = []

  for (const diff of difficulties) {
    const stats = state.stats[diff]
    if (stats === undefined) continue

    const name = difficultyToName(diff)
    const bestTime = stats.bestTimeMs !== null ? formatTime(stats.bestTimeMs) : '--:--'
    const fewest = stats.fewestMoves !== null ? String(stats.fewestMoves) : '--'

    rows.push([name, bestTime, fewest])
  }

  const table = formatTable(columns, rows)

  for (const line of table.split('\n')) {
    lines.push(`  ${line}`)
  }

  return { kind: 'play_leaderboard', lines }
}
