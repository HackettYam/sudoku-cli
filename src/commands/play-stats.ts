import { loadState } from '../persistence/state.js'
import type { FsAdapter } from '../persistence/state.js'
import { nodeLockFactory } from '../persistence/lock.js'
import type { LockFactory } from '../persistence/lock.js'
import { defaultStatePath, defaultStateLockPath, nodeFsAdapter } from '../persistence/state.js'
import { difficultyToName } from '../format/difficulty.js'
import { Difficulty, type DifficultyType } from '@hackettyam/sudoku-tools'
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
  const lines: string[] = []

  lines.push('Play Statistics')
  lines.push('')

  const difficulties: readonly DifficultyType[] = [
    Difficulty.Novice, Difficulty.Easy, Difficulty.Normal, Difficulty.Hard, Difficulty.Expert,
  ]

  for (const diff of difficulties) {
    const stats = state.stats[diff]
    if (stats === undefined) continue

    const name = difficultyToName(diff)
    const plays = stats.totalPlays
    const wins = stats.totalWins
    const winRate = plays > 0 ? Math.round((wins / plays) * 100) : 0
    const bestTime = stats.bestTimeMs !== null ? formatTime(stats.bestTimeMs) : '--:--'
    const fewest = stats.fewestMoves !== null ? String(stats.fewestMoves) : '--'

    lines.push(`  ${name}`)
    lines.push(`    Plays: ${plays}  Wins: ${wins}  Win rate: ${winRate}%`)
    lines.push(`    Best time: ${bestTime}  Fewest moves: ${fewest}`)
    lines.push('')
  }

  lines.push(`Total plays: ${state.totalPlays}`)

  return { kind: 'play_stats', lines }
}
