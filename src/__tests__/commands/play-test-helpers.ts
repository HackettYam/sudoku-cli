import { vi } from 'vitest'

import type { PlayIO } from '../../commands/play.js'
import type { TuiSessionOptions, TuiRunner } from '../../output.js'

/** Mock TUI runner that captures callbacks and simulates keypresses. */
export class MockTuiRunner implements TuiRunner {
  private drawn = false
  private cleanedUp = false
  private resolveFn: (() => void) | null = null

  public constructor(private readonly opts: TuiSessionOptions) {}

  public draw(): void {
    this.drawn = true
    this.opts.render()
  }

  public cleanup(): void {
    if (this.cleanedUp) return
    this.cleanedUp = true
    this.resolveFn?.()
  }

  public run(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resolveFn = resolve
    })
  }

  /** Simulate a keypress by passing a buffer to the onKey callback. */
  public pressKey(key: string): void {
    this.opts.onKey(Buffer.from(key))
  }

  public isDrawn(): boolean {
    return this.drawn
  }

  public isCleanedUp(): boolean {
    return this.cleanedUp
  }
}

/** Assert that the runner is not null after the TUI session starts. */
export function assertGetRunner(runner: MockTuiRunner | null): MockTuiRunner {
  if (runner === null) throw new Error('Expected runner to be set after vi.waitFor')
  return runner
}

/** Create a PlayIO mock that captures TUI session callbacks. */
export function createMockIO(): {
  io: PlayIO
  getRunner: () => MockTuiRunner | null
} {
  let runner: MockTuiRunner | null = null

  const io: PlayIO = {
    stdout: vi.fn(),
    stderr: vi.fn(),
    exit: vi.fn<() => never>().mockImplementation(() => {
      throw new Error('exit')
    }),
    createTuiSession: (opts: TuiSessionOptions) => {
      runner = new MockTuiRunner(opts)
      return runner
    },
  }

  return {
    io,
    getRunner: () => runner,
  }
}
