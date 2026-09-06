import { Difficulty, type DifficultyType } from '@hackettyam/sudoku-tools'

import { difficultyToName } from '../format/difficulty.js'
import { nodeLockFactory } from '../persistence/lock.js'
import type { LockFactory } from '../persistence/lock.js'
import {
  defaultStateLockPath,
  defaultStatePath,
  loadState,
  nodeFsAdapter,
  type FsAdapter,
  type PerDifficultyStats,
  type StateFile,
} from '../persistence/state.js'
import { formatTime } from '../tui.js'

/** Result of the play-stats command. */
export interface PlayStatsResult {
  readonly kind: 'play_stats'
  readonly lines: readonly string[]
}

/** Dependencies for the play-stats command. */
export interface PlayStatsDeps {
  readonly fs?: FsAdapter
  readonly lock?: LockFactory
  readonly statePath?: string
}

/** Format the statistics for one difficulty. */
function formatDifficultyStats(diff: DifficultyType, stats: PerDifficultyStats): string[] {
  const name = difficultyToName(diff)
  const plays = String(stats.totalPlays)
  const wins = String(stats.totalWins)
  const winRate = stats.totalPlays > 0
    ? String(Math.round((stats.totalWins / stats.totalPlays) * 100))
    : '0'
  const bestTime = stats.bestTimeMs !== null ? formatTime(stats.bestTimeMs) : '--:--'
  const fewest = stats.fewestMoves !== null ? String(stats.fewestMoves) : '--'

  return [
    `  ${name}`,
    `    Plays: ${plays}  Wins: ${wins}  Win rate: ${winRate}%`,
    `    Best time: ${bestTime}  Fewest moves: ${fewest}`,
    '',
  ]
}

/** Format all persisted statistics in the canonical difficulty order. */
function formatStatsLines(state: StateFile): string[] {
  const difficulties: readonly DifficultyType[] = [
    Difficulty.Novice, Difficulty.Easy, Difficulty.Normal, Difficulty.Hard, Difficulty.Expert,
  ]
  const lines: string[] = ['Play Statistics', '']

  for (const diff of difficulties) {
    const stats = state.stats[diff]
    lines.push(...formatDifficultyStats(diff, stats))
  }

  lines.push(`Total plays: ${String(state.totalPlays)}`)
  return lines
}

/**
 * Load state and format per-difficulty statistics as lines.
 *
 * @param deps - Injectable dependencies.
 * @returns Lines of formatted stats.
 *
 * @example
 * ```ts
 * const result = await playStatsCommand()
 * result.lines.forEach(line => console.log(line))
 * ```
 */
export async function playStatsCommand(
  deps?: PlayStatsDeps,
): Promise<PlayStatsResult> {
  const fs = deps?.fs ?? nodeFsAdapter
  const lock = deps?.lock ?? nodeLockFactory(defaultStateLockPath())
  const statePath = deps?.statePath ?? defaultStatePath()

  const state = await loadState(fs, statePath, lock)
  return { kind: 'play_stats', lines: formatStatsLines(state) }
}
