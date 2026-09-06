import { lock as lockfileLock } from 'proper-lockfile'

/** Opaque lock handle — returned by {@link LockFactory.acquire}. */
export type LockHandle = { readonly __brand: 'LockHandle' }

/** Result of lock acquisition — discriminated union, never throws. */
export type LockResult =
  | { readonly ok: true; readonly handle: LockHandle }
  | { readonly ok: false; readonly reason: 'busy' | 'timeout' }

/** Lock factory interface for dependency injection. */
export interface LockFactory {
  /** Acquire an exclusive lock, retrying on contention. */
  acquire(): Promise<LockResult>
  /** Release a previously acquired lock. No-op on stale handles. */
  release(handle: LockHandle): Promise<void>
  /** Number of currently held locks (0 or 1). */
  held(): number
}

/**
 * Creates a lock for the given file path.
 * Uses proper-lockfile under the hood.
 * Never throws for expected contention.
 *
 * @param path - File path to lock (creates a `.lock` sidecar).
 * @param options - Retry and stale-TTL overrides.
 * @returns A {@link LockFactory} that manages exclusive access.
 */
export function createLock(
  path: string,
  options?: { retries?: number; stale?: number },
): LockFactory {
  const maxRetries = options?.retries ?? 5
  const stale = options?.stale ?? 5000
  let heldCount = 0
  let releaseFn: (() => Promise<void>) | null = null
  let activeHandle: LockHandle | null = null

  async function acquire(): Promise<LockResult> {
    if (heldCount > 0) {
      return { ok: false, reason: 'busy' }
    }

    try {
      const release = await lockfileLock(path, {
        retries: {
          retries: maxRetries,
          factor: 1,
          minTimeout: 50,
          maxTimeout: 50,
        },
        stale,
        realpath: false,
      })

      const handle: LockHandle = { __brand: 'LockHandle' }
      releaseFn = release
      activeHandle = handle
      heldCount = 1

      return { ok: true, handle }
    } catch {
      return { ok: false, reason: maxRetries === 0 ? 'timeout' : 'busy' }
    }
  }

  async function release(handle: LockHandle): Promise<void> {
    if (heldCount === 0 || releaseFn === null || activeHandle !== handle) return

    const releaseLock = releaseFn
    try {
      await releaseLock()
    } finally {
      if (activeHandle === handle && releaseFn === releaseLock) {
        releaseFn = null
        activeHandle = null
        heldCount = 0
      }
    }
  }

  function held(): number {
    return heldCount
  }

  return { acquire, release, held }
}

/**
 * Production lock factory using real filesystem locks.
 *
 * @param path - File path to lock.
 * @returns A {@link LockFactory} backed by proper-lockfile.
 */
export function nodeLockFactory(path: string): LockFactory {
  return createLock(path)
}

/**
 * In-memory lock factory for testing.
 *
 * @returns A {@link LockFactory} using in-memory state.
 */
export function inMemoryLockFactory(): LockFactory {
  const locked = new Set<string>()
  const key = '__in_memory_lock__'
  let activeHandle: LockHandle | null = null

  function acquire(): Promise<LockResult> {
    if (locked.has(key)) {
      return Promise.resolve({ ok: false, reason: 'busy' })
    }

    const handle: LockHandle = { __brand: 'LockHandle' }
    locked.add(key)
    activeHandle = handle

    return Promise.resolve({ ok: true, handle })
  }

  function release(handle: LockHandle): Promise<void> {
    if (activeHandle !== handle) {
      return Promise.resolve()
    }

    locked.delete(key)
    activeHandle = null
    return Promise.resolve()
  }

  function held(): number {
    return locked.size
  }

  return { acquire, release, held }
}
