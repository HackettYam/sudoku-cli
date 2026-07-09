import type { DifficultyType } from '@hackettyam/sudoku-tools'

/** Achievement identifier — string-literal union of all 11 achievement IDs. */
export type AchievementId =
  | 'first_win'
  | 'speed_demon'
  | 'no_hints_easy'
  | 'perfectionist'
  | 'minimalist'
  | 'no_undo'
  | 'speedrunner'
  | 'flawless_victory'
  | 'untouchable'
  | 'century'
  | 'completionist'

/** Context for evaluating achievements. */
export interface AchievementContext {
  readonly difficulty: DifficultyType
  readonly elapsedMs: number
  readonly moveCount: number
  readonly hintCount: number
  readonly undoCount: number
  readonly errors: readonly string[]
  readonly perDifficultyWins: Readonly<Record<DifficultyType, number>>
  readonly difficultiesWon: readonly DifficultyType[]
}

/** Achievement definition with evaluation function. */
export interface AchievementDefinition {
  readonly id: AchievementId
  readonly title: string
  readonly description: string
  readonly evaluate: (ctx: AchievementContext) => boolean
}

/**
 * All 11 achievement definitions, frozen for immutability.
 * Each definition includes an evaluation function that determines
 * whether the achievement is unlocked given the current context.
 */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = Object.freeze([
  {
    id: 'first_win',
    title: 'First Win',
    description: 'Win your first game at novice difficulty',
    evaluate: (ctx) => ctx.difficulty === 'novice',
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Win an easy game in under 5 minutes',
    evaluate: (ctx) => ctx.difficulty === 'easy' && ctx.elapsedMs < 300_000,
  },
  {
    id: 'no_hints_easy',
    title: 'No Hints',
    description: 'Win an easy game without using hints',
    evaluate: (ctx) => ctx.difficulty === 'easy' && ctx.hintCount === 0,
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Win a normal game with no errors and no undo',
    evaluate: (ctx) =>
      ctx.difficulty === 'normal' && ctx.errors.length === 0 && ctx.undoCount === 0,
  },
  {
    id: 'minimalist',
    title: 'Minimalist',
    description: 'Win a normal game with 45 or fewer moves',
    evaluate: (ctx) => ctx.difficulty === 'normal' && ctx.moveCount <= 45,
  },
  {
    id: 'no_undo',
    title: 'No Undo',
    description: 'Win a hard game without using undo',
    evaluate: (ctx) => ctx.difficulty === 'hard' && ctx.undoCount === 0,
  },
  {
    id: 'speedrunner',
    title: 'Speedrunner',
    description: 'Win a hard game in under 10 minutes',
    evaluate: (ctx) => ctx.difficulty === 'hard' && ctx.elapsedMs < 600_000,
  },
  {
    id: 'flawless_victory',
    title: 'Flawless Victory',
    description: 'Win an expert game with no errors',
    evaluate: (ctx) => ctx.difficulty === 'expert' && ctx.errors.length === 0,
  },
  {
    id: 'untouchable',
    title: 'Untouchable',
    description: 'Win an expert game without hints',
    evaluate: (ctx) => ctx.difficulty === 'expert' && ctx.hintCount === 0,
  },
  {
    id: 'century',
    title: 'Century',
    description: 'Win 100 games across all difficulties',
    evaluate: (ctx) =>
      Object.values(ctx.perDifficultyWins).reduce((a, b) => a + b, 0) >= 100,
  },
  {
    id: 'completionist',
    title: 'Completionist',
    description: 'Win at least one game at every difficulty',
    evaluate: (ctx) => ctx.difficultiesWon.length === 5,
  },
])

/**
 * Evaluates all achievements against the given context.
 * Returns the IDs of all qualifying achievements.
 *
 * @param ctx - The achievement evaluation context
 * @returns Frozen array of unlocked achievement IDs
 */
export function evaluateAchievements(ctx: AchievementContext): readonly AchievementId[] {
  return ACHIEVEMENTS.filter((a) => a.evaluate(ctx)).map((a) => a.id)
}
