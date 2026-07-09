/** Type declaration for proper-lockfile (no bundled types). */

declare module 'proper-lockfile' {
  interface Retries {
    retries: number
    factor?: number
    minTimeout?: number
    maxTimeout?: number
  }

  interface LockOptions {
    stale?: number
    retries?: number | Retries
    realpath?: boolean
    lockfilePath?: string
  }

  function lock(file: string, options?: LockOptions): Promise<() => Promise<void>>
  function unlock(file: string, options?: LockOptions): Promise<void>
  function check(file: string, options?: LockOptions): Promise<boolean>

  export { lock, unlock, check }
  export default lock
}
