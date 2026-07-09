import { loadState } from '../persistence/state.js'
import type { FsAdapter } from '../persistence/state.js'
import { nodeLockFactory } from '../persistence/lock.js'
import type { LockFactory } from '../persistence/lock.js'
import { defaultStatePath, defaultStateLockPath, nodeFsAdapter } from '../persistence/state.js'
import { ACHIEVEMENTS } from '../persistence/achievements.js'
import type { AchievementId } from '../persistence/achievements.js'

/** Result of the play-achievements command. */
export interface PlayAchievementsResult {
  readonly kind: 'play_achievements'
  readonly lines: readonly string[]
}

/** Dependencies for the play-achievements command. */
export interface PlayAchievementsDeps {
  readonly fs?: FsAdapter
  readonly lock?: LockFactory
  readonly statePath?: string
}

/**
 * Load state + ACHIEVEMENTS, format unlocked (desc) + locked (asc).
 *
 * @param deps - Injectable dependencies.
 * @returns Lines of formatted achievements.
 *
 * @example
 * ```ts
 * const result = await playAchievementsCommand()
 * result.lines.forEach(line => console.log(line))
 * ```
 */
export async function playAchievementsCommand(
  deps?: PlayAchievementsDeps,
): Promise<PlayAchievementsResult> {
  const fs = deps?.fs ?? nodeFsAdapter
  const lock = deps?.lock ?? nodeLockFactory(defaultStateLockPath())
  const statePath = deps?.statePath ?? defaultStatePath()

  const state = await loadState(fs, statePath, lock)
  const lines: string[] = []

  lines.push('Achievements')
  lines.push('')

  const unlockedIds = Object.keys(state.achievements) as readonly AchievementId[]
  const total = ACHIEVEMENTS.length

  lines.push(`${unlockedIds.length}/${total} unlocked`)
  lines.push('')

  // Unlocked achievements (sorted by unlockedAt descending)
  if (unlockedIds.length > 0) {
    const unlocked = unlockedIds
      .map((id) => ({
        id,
        unlockedAt: state.achievements[id]?.unlockedAt ?? '',
      }))
      .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt))

    for (const entry of unlocked) {
      const def = ACHIEVEMENTS.find((a) => a.id === entry.id)
      if (def === undefined) continue
      lines.push(`  ${def.title} — ${def.description}`)
    }

    lines.push('')
  }

  // Locked achievements
  const locked = ACHIEVEMENTS.filter((a) => !unlockedIds.includes(a.id))

  if (locked.length > 0) {
    lines.push('Locked:')

    for (const def of locked) {
      lines.push(`  ${def.title} — ${def.description}`)
    }
  }

  return { kind: 'play_achievements', lines }
}
