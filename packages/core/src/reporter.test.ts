import { createEvent, createReporter, LocalReporter } from './reporter'
import { describe, expect, test } from 'bun:test'

describe('LocalReporter', () => {
  test('stores reported events', () => {
    const reporter = new LocalReporter()
    const event = createEvent('email', 'pass', 'test message')
    reporter.report(event)
    expect(reporter.getEvents()).toHaveLength(1)
    expect(reporter.getEvents()[0]).toEqual(event)
  })

  test('getEvents returns a copy', () => {
    const reporter = new LocalReporter()
    reporter.report(createEvent('email', 'pass', 'test'))
    const events = reporter.getEvents()
    events.pop()
    expect(reporter.getEvents()).toHaveLength(1)
  })

  test('flush clears events', async () => {
    const reporter = new LocalReporter()
    reporter.report(createEvent('email', 'pass', 'test'))
    await reporter.flush()
    expect(reporter.getEvents()).toHaveLength(0)
  })

  test('verbose mode logs to console', () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(args.join(' '))

    const reporter = new LocalReporter(true)
    reporter.report(createEvent('email', 'pass', 'ok'))
    reporter.report(createEvent('email', 'fail', 'bad'))
    reporter.report(createEvent('email', 'warn', 'meh'))

    console.log = origLog
    expect(logs).toHaveLength(3)
    expect(logs[0]).toContain('✓')
    expect(logs[1]).toContain('✗')
    expect(logs[2]).toContain('⚠')
  })

  test('silent mode does not log', () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(args.join(' '))

    const reporter = new LocalReporter(false)
    reporter.report(createEvent('email', 'pass', 'ok'))

    console.log = origLog
    expect(logs).toHaveLength(0)
  })
})

describe('createEvent', () => {
  test('creates event with required fields', () => {
    const event = createEvent('webhook', 'fail', 'delivery failed')
    expect(event.id).toBeDefined()
    expect(event.timestamp).toBeGreaterThan(0)
    expect(event.channel).toBe('webhook')
    expect(event.status).toBe('fail')
    expect(event.message).toBe('delivery failed')
    expect(event.details).toBeUndefined()
  })

  test('includes details when provided', () => {
    const event = createEvent('cron', 'pass', 'ok', { jobId: '123' })
    expect(event.details).toEqual({ jobId: '123' })
  })

  test('generates unique IDs', () => {
    const a = createEvent('email', 'pass', 'a')
    const b = createEvent('email', 'pass', 'b')
    expect(a.id).not.toBe(b.id)
  })
})

describe('createReporter', () => {
  test('returns LocalReporter when no endpoint', () => {
    const reporter = createReporter({})
    expect(reporter).toBeInstanceOf(LocalReporter)
  })

  test('returns LocalReporter when endpoint but no projectId', () => {
    const reporter = createReporter({ endpoint: 'https://x.com' })
    expect(reporter).toBeInstanceOf(LocalReporter)
  })
})
