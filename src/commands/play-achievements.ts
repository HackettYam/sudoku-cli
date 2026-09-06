import { ACHIEVEMENTS } from '../persistence/achievements.js'
import type { AchievementId } from '../persistence/achievements.js'
import { nodeLockFactory } from '../persistence/lock.js'
import type { LockFactory } from '../persistence/lock.js'
import {
  defaultStateLockPath,
  defaultStatePath,
  loadState,
  nodeFsAdapter,
  type FsAdapter,
  type StateFile,
} from '../persistence/state.js'

const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
) as Readonly<Record<AchievementId, (typeof ACHIEVEMENTS)[number]>>

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

/** Format unlocked achievements in newest-first order. */
function formatUnlockedAchievements(
  state: StateFile,
  unlockedIds: readonly AchievementId[],
): string[] {
  if (unlockedIds.length === 0) {
    return []
  }

  const unlocked = unlockedIds
    .map((id) => ({ id, unlockedAt: state.achievements[id].unlockedAt }))
    .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt))
  const lines: string[] = []

  for (const entry of unlocked) {
    const def = ACHIEVEMENT_BY_ID[entry.id]
    lines.push(`  ${def.title} — ${def.description}`)
  }

  lines.push('')
  return lines
}

/** Format achievements that have not yet been unlocked. */
function formatLockedAchievements(unlockedIds: readonly AchievementId[]): string[] {
  const locked = ACHIEVEMENTS.filter((achievement) => !unlockedIds.includes(achievement.id))
  if (locked.length === 0) {
    return []
  }

  return [
    'Locked:',
    ...locked.map((achievement) => `  ${achievement.title} — ${achievement.description}`),
  ]
}

/** Format the complete achievement view. */
function formatAchievementLines(state: StateFile): string[] {
  const unlockedIds = Object.keys(state.achievements) as readonly AchievementId[]
  const unlockedCount = String(unlockedIds.length)
  const total = String(ACHIEVEMENTS.length)

  return [
    'Achievements',
    '',
    `${unlockedCount}/${total} unlocked`,
    '',
    ...formatUnlockedAchievements(state, unlockedIds),
    ...formatLockedAchievements(unlockedIds),
  ]
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
  return { kind: 'play_achievements', lines: formatAchievementLines(state) }
}
