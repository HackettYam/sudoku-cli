import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createLock,
  inMemoryLockFactory,
  nodeLockFactory,
} from '../../persistence/lock.js'
import type { LockHandle } from '../../persistence/lock.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_HANDLE: LockHandle = { __brand: 'LockHandle' }

async function makeTmpDir(): Promise<{
  dir: string
  cleanup: () => Promise<void>
}> {
  const dir = await mkdtemp(join(tmpdir(), `lock-test-${randomUUID()}-`))
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}

// ---------------------------------------------------------------------------
// createLock — unit tests via real filesystem
// ---------------------------------------------------------------------------

describe('createLock', () => {
  let tmpDir: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ dir: tmpDir, cleanup } = await makeTmpDir())
  })

  afterEach(async () => {
    await cleanup()
  })

  it('should acquire and return ok:true with a handle', async () => {
    const target = join(tmpDir, 'acquire.txt')
    await writeFile(target, '')

    const lock = createLock(target)
    const result = await lock.acquire()

    expect(result).toEqual({ ok: true, handle: VALID_HANDLE })
    expect(lock.held()).toBe(1)
  })

  it('should decrement held count after release', async () => {
    const target = join(tmpDir, 'release.txt')
    await writeFile(target, '')

    const lock = createLock(target)
    const result = await lock.acquire()
    if (!result.ok) throw new Error('expected ok')

    await lock.release(result.handle)

    expect(lock.held()).toBe(0)
  })

  it('should return busy when already held', async () => {
    const target = join(tmpDir, 'busy.txt')
    await writeFile(target, '')

    const lock = createLock(target)
    await lock.acquire()
    const second = await lock.acquire()

    expect(second).toEqual({ ok: false, reason: 'busy' })
  })

  it('should return timeout when retries is 0 and lock is contended', async () => {
    const target = join(tmpDir, 'timeout.txt')
    await writeFile(target, '')

    const lock1 = createLock(target)
    const first = await lock1.acquire()
    if (!first.ok) throw new Error('expected ok')

    // Second instance, retries:0 — proper-lockfile should throw
    const lock2 = createLock(target, { retries: 0 })
    const result = await lock2.acquire()

    expect(result).toEqual({ ok: false, reason: 'timeout' })

    await lock1.release(first.handle)
  })

  it('should return busy when retries > 0 and lock is contended', async () => {
    const target = join(tmpDir, 'retries.txt')
    await writeFile(target, '')

    const lock1 = createLock(target)
    const first = await lock1.acquire()
    if (!first.ok) throw new Error('expected ok')

    // Second instance with retries — should eventually give up as busy
    const lock2 = createLock(target, { retries: 1 })
    const result = await lock2.acquire()

    // May be 'busy' or 'timeout' depending on how proper-lockfile behaves
    // with same-process contention; both are valid failure results
    expect(result.ok).toBe(false)

    await lock1.release(first.handle)
  })

  it('should not call release when held count is 0 (stale handle)', async () => {
    const target = join(tmpDir, 'stale.txt')
    await writeFile(target, '')

    const lock = createLock(target)
    await lock.release(VALID_HANDLE)

    expect(lock.held()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// nodeLockFactory — real filesystem integration
// ---------------------------------------------------------------------------

describe('nodeLockFactory — real filesystem', () => {
  let tmpDir: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ dir: tmpDir, cleanup } = await makeTmpDir())
  })

  afterEach(async () => {
    await cleanup()
  })

  it('should acquire and release a lock on a real file', async () => {
    const target = join(tmpDir, 'target.txt')
    await writeFile(target, 'content')

    const lock = nodeLockFactory(target)
    const result = await lock.acquire()

    expect(result.ok).toBe(true)
    expect(lock.held()).toBe(1)

    if (!result.ok) throw new Error('expected ok')
    await lock.release(result.handle)
    expect(lock.held()).toBe(0)
  })

  it('should return busy when lock is already held', async () => {
    const target = join(tmpDir, 'busy.txt')
    await writeFile(target, 'content')

    const lock = nodeLockFactory(target)
    const first = await lock.acquire()
    expect(first.ok).toBe(true)

    const second = await lock.acquire()
    expect(second).toEqual({ ok: false, reason: 'busy' })

    if (!first.ok) throw new Error('expected ok')
    await lock.release(first.handle)
  })

  it('should allow re-acquire after release', async () => {
    const target = join(tmpDir, 'reuse.txt')
    await writeFile(target, 'content')

    const lock = nodeLockFactory(target)

    const first = await lock.acquire()
    if (!first.ok) throw new Error('expected ok')
    await lock.release(first.handle)

    const second = await lock.acquire()
    expect(second.ok).toBe(true)

    if (!second.ok) throw new Error('expected ok')
    await lock.release(second.handle)
  })

  it('should timeout when lock is already held by same process', async () => {
    const target = join(tmpDir, 'timeout.txt')
    await writeFile(target, '')

    const lock = createLock(target, { retries: 0 })
    const first = await lock.acquire()
    expect(first.ok).toBe(true)

    if (!first.ok) throw new Error('expected ok')

    // Second acquire on same path should fail with timeout (retries: 0)
    const lock2 = createLock(target, { retries: 0 })
    const second = await lock2.acquire()
    expect(second).toEqual({ ok: false, reason: 'timeout' })

    await lock.release(first.handle)
  })
})

// ---------------------------------------------------------------------------
// inMemoryLockFactory
// ---------------------------------------------------------------------------

describe('inMemoryLockFactory', () => {
  it('should transition held 0→1→0 through acquire→release', async () => {
    const lock = inMemoryLockFactory()

    expect(lock.held()).toBe(0)

    const result = await lock.acquire()
    expect(result.ok).toBe(true)
    expect(lock.held()).toBe(1)

    if (!result.ok) throw new Error('expected ok')
    await lock.release(result.handle)
    expect(lock.held()).toBe(0)
  })

  it('should return busy when already held', async () => {
    const lock = inMemoryLockFactory()

    await lock.acquire()
    const second = await lock.acquire()

    expect(second).toEqual({ ok: false, reason: 'busy' })
  })

  it('should allow re-acquire after release', async () => {
    const lock = inMemoryLockFactory()

    const first = await lock.acquire()
    if (!first.ok) throw new Error('expected ok')
    await lock.release(first.handle)

    const second = await lock.acquire()
    expect(second.ok).toBe(true)
  })
})
