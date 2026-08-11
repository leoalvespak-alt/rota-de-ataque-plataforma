import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logger, setLogLevel } from './logger'

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setLogLevel('debug')
  })

  it('logs info messages', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('test message')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toContain('[INFO]')
    expect(spy.mock.calls[0]![0]).toContain('test message')
  })

  it('logs error messages to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('err msg')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toContain('[ERROR]')
  })

  it('logs warn messages to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('warn msg')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toContain('[WARN]')
  })

  it('includes context when provided', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('msg', { key: 'value' })
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'), { key: 'value' })
  })

  it('respects minimum log level', () => {
    setLogLevel('warn')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.debug('debug msg')
    logger.info('info msg')
    logger.warn('warn msg')
    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})
