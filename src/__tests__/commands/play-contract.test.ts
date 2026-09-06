import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { CommandContext } from '../../commands/contract.js'
import { playAchievementsCommand } from '../../commands/play-achievements.js'
import type * as PlayAchievementsModule from '../../commands/play-achievements.js'
import { playContract } from '../../commands/play-contract.js'
import { playLeaderboardCommand } from '../../commands/play-leaderboard.js'
import type * as PlayLeaderboardModule from '../../commands/play-leaderboard.js'
import { playStatsCommand } from '../../commands/play-stats.js'
import type * as PlayStatsModule from '../../commands/play-stats.js'
import { playCommand } from '../../commands/play.js'
import type * as PlayModule from '../../commands/play.js'

// `vi.spyOn` cannot replace a named export in an ESM namespace import, so we
// use `vi.mock` factories instead. Each factory keeps the real module
// intact (`...mod`) and wraps a single named export in a `vi.fn` that
// delegates to the original implementation by default. The dispatcher in
// `playContract.run` imports these symbols from the (now-mocked) modules,
// so every call is routed through the wrappers and can be controlled per
// test via `vi.mocked(<fn>).mockResolvedValue(...)` / `.mockReset()`.
vi.mock('../../commands/play.js', async (importOriginal) => {
  const mod = await importOriginal<typeof PlayModule>()
  return { ...mod, playCommand: vi.fn(mod.playCommand) }
})
vi.mock('../../commands/play-stats.js', async (importOriginal) => {
  const mod = await importOriginal<typeof PlayStatsModule>()
  return { ...mod, playStatsCommand: vi.fn(mod.playStatsCommand) }
})
vi.mock('../../commands/play-achievements.js', async (importOriginal) => {
  const mod = await importOriginal<typeof PlayAchievementsModule>()
  return { ...mod, playAchievementsCommand: vi.fn(mod.playAchievementsCommand) }
})
vi.mock('../../commands/play-leaderboard.js', async (importOriginal) => {
  const mod = await importOriginal<typeof PlayLeaderboardModule>()
  return { ...mod, playLeaderboardCommand: vi.fn(mod.playLeaderboardCommand) }
})

type ParsedPlayArgs = Extract<ReturnType<typeof playContract.parse>, { readonly ok: true }>['args']

function getParsedPlayArgs(
  result: ReturnType<typeof playContract.parse>,
): ParsedPlayArgs {
  if (result.ok !== true) {
    throw new Error('Expected play arguments to parse successfully')
  }
  return result.args
}

const mockCtx: CommandContext = {
  io: {} as never,
  persistence: {} as never,
}

describe('playContract', () => {
  describe('parse', () => {
    it('returns help on --help', () => {
      expect(playContract.parse(['--help'])).toEqual({ ok: 'help' })
    })
    it('returns help on -h', () => {
      expect(playContract.parse(['-h'])).toEqual({ ok: 'help' })
    })
    it('parses --difficulty into play_tui', () => {
      const r = playContract.parse(['--difficulty', 'hard'])
      expect(getParsedPlayArgs(r).kind).toBe('play_tui')
    })
    it('parses --stats into play_stats', () => {
      const r = playContract.parse(['--stats'])
      expect(getParsedPlayArgs(r).kind).toBe('play_stats')
    })
    it('parses --achievements into play_achievements', () => {
      const r = playContract.parse(['--achievements'])
      expect(getParsedPlayArgs(r).kind).toBe('play_achievements')
    })
    it('parses --leaderboard into play_leaderboard', () => {
      const r = playContract.parse(['--leaderboard'])
      expect(getParsedPlayArgs(r).kind).toBe('play_leaderboard')
    })
    it('parses --load', () => {
      const r = playContract.parse(['--load', 'save-123'])
      const args = getParsedPlayArgs(r)
      expect(args.kind).toBe('play_tui')
      expect(args.load).toBe('save-123')
    })
    it('parses --resume', () => {
      const r = playContract.parse(['--resume'])
      const args = getParsedPlayArgs(r)
      expect(args.kind).toBe('play_tui')
      expect(args.resumeLast).toBe(true)
    })
    it('returns error on unknown option', () => {
      const r = playContract.parse(['--frobnicate'])
      expect(r.ok).toBe(false)
      if (r.ok === false) {
        expect(r.message).toContain('Unknown option')
      }
    })
    it('returns error on missing --difficulty value', () => {
      const r = playContract.parse(['--difficulty'])
      expect(r.ok).toBe(false)
      if (r.ok === false) {
        expect(r.message).toContain('argument missing')
      }
    })
  })

  describe('run', () => {
    beforeEach(() => {
      vi.mocked(playCommand).mockReset()
      vi.mocked(playStatsCommand).mockReset()
      vi.mocked(playAchievementsCommand).mockReset()
      vi.mocked(playLeaderboardCommand).mockReset()
    })

    it('play_tui maps playCommand quit to play_exit', async () => {
      vi.mocked(playCommand).mockResolvedValue({ kind: 'play_exit', reason: 'quit' } as never)
      const result = await playContract.run({ kind: 'play_tui' } as never, mockCtx)
      expect(playCommand).toHaveBeenCalled()
      expect(result).toEqual({ kind: 'play_exit', reason: 'quit' })
    })

    it('play_tui maps playCommand won to play_exit', async () => {
      vi.mocked(playCommand).mockResolvedValue({ kind: 'play_exit', reason: 'won' } as never)
      const result = await playContract.run({ kind: 'play_tui' } as never, mockCtx)
      expect(playCommand).toHaveBeenCalled()
      expect(result).toEqual({ kind: 'play_exit', reason: 'won' })
    })

    it('play_tui maps playCommand error to play_exit with message', async () => {
      vi.mocked(playCommand).mockResolvedValue({
        kind: 'play_exit',
        reason: 'error',
        message: 'something went wrong',
      } as never)
      const result = await playContract.run({ kind: 'play_tui' } as never, mockCtx)
      expect(result).toEqual({
        kind: 'play_exit',
        reason: 'error',
        message: 'something went wrong',
      })
    })

    it('play_tui omits message field when undefined', async () => {
      vi.mocked(playCommand).mockResolvedValue({
        kind: 'play_exit',
        reason: 'quit',
        // no message
      } as never)
      const result = await playContract.run({ kind: 'play_tui' } as never, mockCtx)
      expect(result).not.toHaveProperty('message')
    })

    it('play_stats returns CommandResult with lines', async () => {
      vi.mocked(playStatsCommand).mockResolvedValue({
        kind: 'play_stats',
        lines: ['line1', 'line2'],
      } as never)
      const result = await playContract.run({ kind: 'play_stats' } as never, mockCtx)
      expect(playStatsCommand).toHaveBeenCalled()
      expect(result).toEqual({ kind: 'play_stats', lines: ['line1', 'line2'] })
    })

    it('play_achievements returns CommandResult with lines', async () => {
      vi.mocked(playAchievementsCommand).mockResolvedValue({
        kind: 'play_achievements',
        lines: ['a1'],
      } as never)
      const result = await playContract.run({ kind: 'play_achievements' } as never, mockCtx)
      expect(playAchievementsCommand).toHaveBeenCalled()
      expect(result).toEqual({ kind: 'play_achievements', lines: ['a1'] })
    })

    it('play_leaderboard returns CommandResult with lines', async () => {
      vi.mocked(playLeaderboardCommand).mockResolvedValue({
        kind: 'play_leaderboard',
        lines: ['lb1'],
      } as never)
      const result = await playContract.run({ kind: 'play_leaderboard' } as never, mockCtx)
      expect(playLeaderboardCommand).toHaveBeenCalled()
      expect(result).toEqual({ kind: 'play_leaderboard', lines: ['lb1'] })
    })
  })
})
