import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runTuiSession } from '../output.js'

describe('runTuiSession', () => {
  beforeEach(() => {
    // Setup runs before each test
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cleanup is idempotent', () => {
    const stdinMock = {
      isTTY: true,
      isRaw: false,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    }
    const stdoutMock = {
      write: vi.fn(),
    }
    const processOnMock = vi.fn()
    const processRemoveListenerMock = vi.fn()

    Object.defineProperty(process, 'stdin', { value: stdinMock, writable: true })
    Object.defineProperty(process, 'stdout', { value: stdoutMock, writable: true })
    process.on = processOnMock as never
    process.removeListener = processRemoveListenerMock

    const runner = runTuiSession({
      colorsEnabled: false,
      onKey: vi.fn(),
      render: vi.fn(),
    })

    // Call cleanup twice
    runner.cleanup()
    runner.cleanup()

    // Should only write escape sequences once (idempotent)
    expect(stdoutMock.write).toHaveBeenCalledTimes(2) // CURSOR_SHOW + ALT_SCREEN_EXIT × 1
  })

  it('draw enters alt screen and renders', () => {
    const stdinMock = {
      isTTY: true,
      isRaw: false,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    }
    const stdoutMock = {
      write: vi.fn(),
    }
    const processOnMock = vi.fn()
    const processRemoveListenerMock = vi.fn()

    Object.defineProperty(process, 'stdin', { value: stdinMock, writable: true })
    Object.defineProperty(process, 'stdout', { value: stdoutMock, writable: true })
    process.on = processOnMock as never
    process.removeListener = processRemoveListenerMock

    const renderMock = vi.fn()

    const runner = runTuiSession({
      colorsEnabled: false,
      onKey: vi.fn(),
      render: renderMock,
    })

    runner.draw()

    // Should write ALT_SCREEN_ENTER and CURSOR_HIDE
    expect(stdoutMock.write).toHaveBeenCalledWith('\x1b[?1049h')
    expect(stdoutMock.write).toHaveBeenCalledWith('\x1b[?25l')
    expect(renderMock).toHaveBeenCalled()
  })

  it('SIGINT handling calls cleanup and exits', () => {
    const stdinMock = {
      isTTY: true,
      isRaw: false,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    }
    const stdoutMock = {
      write: vi.fn(),
    }
    const processOnMock = vi.fn()
    const processRemoveListenerMock = vi.fn()
    const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit')
    }) as never)

    Object.defineProperty(process, 'stdin', { value: stdinMock, writable: true })
    Object.defineProperty(process, 'stdout', { value: stdoutMock, writable: true })
    process.on = processOnMock as never
    process.removeListener = processRemoveListenerMock

    const runner = runTuiSession({
      colorsEnabled: false,
      onKey: vi.fn(),
      render: vi.fn(),
    })

    // run() registers signal handlers
    runner.run()

    // Extract SIGINT handler
    const sigintCall = processOnMock.mock.calls.find((call) => call[0] === 'SIGINT')
    expect(sigintCall).toBeDefined()
    const sigintHandler = (sigintCall as unknown[])[1] as () => void

    // Call the SIGINT handler (cleanup + exit)
    try { sigintHandler() } catch { /* process.exit mock throws */ }

    // Should have called process.exit(130)
    expect(exitMock).toHaveBeenCalledWith(130)
  })

  it('SIGTERM handler calls cleanup and exits', () => {
    const stdinMock = {
      isTTY: true,
      isRaw: false,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    }
    const stdoutMock = {
      write: vi.fn(),
    }
    const processOnMock = vi.fn()
    const processRemoveListenerMock = vi.fn()
    const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit')
    }) as never)

    Object.defineProperty(process, 'stdin', { value: stdinMock, writable: true })
    Object.defineProperty(process, 'stdout', { value: stdoutMock, writable: true })
    process.on = processOnMock as never
    process.removeListener = processRemoveListenerMock

    const runner = runTuiSession({
      colorsEnabled: false,
      onKey: vi.fn(),
      render: vi.fn(),
    })

    // run() registers signal handlers
    runner.run()

    // Extract SIGTERM handler
    const sigtermCall = processOnMock.mock.calls.find((call) => call[0] === 'SIGTERM')
    expect(sigtermCall).toBeDefined()
    const sigtermHandler = (sigtermCall as unknown[])[1] as () => void

    // Call the SIGTERM handler (cleanup + exit)
    try { sigtermHandler() } catch { /* process.exit mock throws */ }

    // Should have written CURSOR_SHOW and ALT_SCREEN_EXIT (cleanup sequences)
    expect(stdoutMock.write).toHaveBeenCalledWith('\x1b[?25h')
    expect(stdoutMock.write).toHaveBeenCalledWith('\x1b[?1049l')
    // Should have called process.exit(0)
    expect(exitMock).toHaveBeenCalledWith(0)
  })

  it('run() sets raw mode and registers handlers', () => {
    const stdinMock = {
      isTTY: true,
      isRaw: false,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    }
    const stdoutMock = {
      write: vi.fn(),
    }
    const processOnMock = vi.fn()
    const processRemoveListenerMock = vi.fn()

    Object.defineProperty(process, 'stdin', { value: stdinMock, writable: true })
    Object.defineProperty(process, 'stdout', { value: stdoutMock, writable: true })
    process.on = processOnMock as never
    process.removeListener = processRemoveListenerMock

    const runner = runTuiSession({
      colorsEnabled: false,
      onKey: vi.fn(),
      render: vi.fn(),
    })

    runner.run()

    // Should set raw mode
    expect(stdinMock.setRawMode).toHaveBeenCalledWith(true)

    // Should register data handler
    expect(stdinMock.on).toHaveBeenCalledWith('data', expect.any(Function))

    // Should register signal handlers
    expect(processOnMock).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOnMock).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(processOnMock).toHaveBeenCalledWith('exit', expect.any(Function))

    // Clean up to resolve the promise
    runner.cleanup()
  })

  it('onKey callback receives raw key buffer', () => {
    const stdinMock = {
      isTTY: true,
      isRaw: false,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    }
    const stdoutMock = {
      write: vi.fn(),
    }
    const processOnMock = vi.fn()
    const processRemoveListenerMock = vi.fn()

    Object.defineProperty(process, 'stdin', { value: stdinMock, writable: true })
    Object.defineProperty(process, 'stdout', { value: stdoutMock, writable: true })
    process.on = processOnMock as never
    process.removeListener = processRemoveListenerMock

    const onKeyMock = vi.fn()

    const runner = runTuiSession({
      colorsEnabled: false,
      onKey: onKeyMock,
      render: vi.fn(),
    })

    runner.run()

    // Extract the data handler
    const dataCall = stdinMock.on.mock.calls.find((call) => call[0] === 'data')
    expect(dataCall).toBeDefined()
    const dataHandler = (dataCall as unknown[])[1] as (data: Buffer) => void

    // Simulate key press
    const testKey = Buffer.from([0x03])
    dataHandler(testKey)

    expect(onKeyMock).toHaveBeenCalledWith(testKey)

    runner.cleanup()
  })

  it('exit event handler calls cleanup without exiting', () => {
    const stdinMock = {
      isTTY: true,
      isRaw: false,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    }
    const stdoutMock = {
      write: vi.fn(),
    }
    const processOnMock = vi.fn()
    const processRemoveListenerMock = vi.fn()

    Object.defineProperty(process, 'stdin', { value: stdinMock, writable: true })
    Object.defineProperty(process, 'stdout', { value: stdoutMock, writable: true })
    process.on = processOnMock as never
    process.removeListener = processRemoveListenerMock

    const runner = runTuiSession({
      colorsEnabled: false,
      onKey: vi.fn(),
      render: vi.fn(),
    })

    runner.run()

    // Extract the exit handler (lines 151-153 in output.ts)
    const exitCall = processOnMock.mock.calls.find((call) => call[0] === 'exit')
    expect(exitCall).toBeDefined()
    const exitHandler = (exitCall as unknown[])[1] as () => void

    // Call the exit handler — it should run cleanup but NOT call process.exit
    exitHandler()

    // Should have written CURSOR_SHOW and ALT_SCREEN_EXIT (cleanup sequences)
    expect(stdoutMock.write).toHaveBeenCalledWith('\x1b[?25h')
    expect(stdoutMock.write).toHaveBeenCalledWith('\x1b[?1049l')
  })

  it('cleanup restores raw mode when stdin is TTY', () => {
    const stdinMock = {
      isTTY: true,
      isRaw: false,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    }
    const stdoutMock = {
      write: vi.fn(),
    }
    const processOnMock = vi.fn()
    const processRemoveListenerMock = vi.fn()

    Object.defineProperty(process, 'stdin', { value: stdinMock, writable: true })
    Object.defineProperty(process, 'stdout', { value: stdoutMock, writable: true })
    process.on = processOnMock as never
    process.removeListener = processRemoveListenerMock

    const runner = runTuiSession({
      colorsEnabled: false,
      onKey: vi.fn(),
      render: vi.fn(),
    })

    runner.run()
    runner.cleanup()

    // Should restore original raw mode (false)
    expect(stdinMock.setRawMode).toHaveBeenCalledWith(false)
  })
})
