import { afterEach, describe, expect, it, vi } from 'vitest'
import { stdout, stderr, exit } from '../output.js'

describe('output', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stdout appends a trailing newline when missing', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    stdout('hello')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('hello\n')
  })

  it('stdout preserves a trailing newline when present', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    stdout('hello\n')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('hello\n')
  })

  it('stderr appends a trailing newline when missing', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    stderr('oops')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('oops\n')
  })

  it('stderr preserves a trailing newline when present', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    stderr('oops\n')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('oops\n')
  })

  it('exit calls process.exit with the given code', () => {
    const spy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${String(code)}`)
    }) as never)

    expect(() => exit(7)).toThrow('exit:7')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(7)
  })
})
