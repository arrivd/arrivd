import type { ArrivdEvent, Reporter } from '@arrivd/core'
import { createScheduler } from './scheduler'
import { describe, expect, test } from 'bun:test'

// ── Mock Reporter ──

function mockReporter(): Reporter & { events: ArrivdEvent[] } {
  const events: ArrivdEvent[] = []
  return {
    events,
    report(event: ArrivdEvent) {
      events.push(event)
    },
    async flush() {
      events.length = 0
    },
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('createScheduler', () => {
  test('start/stop lifecycle — no errors, idempotent', () => {
    const scheduler = createScheduler({
      jobs: [{ name: 'test', schedule: '0 * * * *' }],
      checkIntervalMs: 60_000,
    })

    scheduler.start()
    scheduler.start() // idempotent
    scheduler.stop()
    scheduler.stop() // safe to call multiple times
  })

  test('checkIn records timestamp', () => {
    const scheduler = createScheduler({
      jobs: [{ name: 'job-a', schedule: '* * * * *' }],
    })

    const before = Date.now()
    scheduler.checkIn('job-a')
    const after = Date.now()

    const ts = scheduler.getLastCheckIn('job-a') as number
    expect(ts).toBeDefined()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  test('getLastCheckIn returns undefined for unknown job', () => {
    const scheduler = createScheduler({
      jobs: [{ name: 'known', schedule: '0 * * * *' }],
    })

    expect(scheduler.getLastCheckIn('unknown')).toBeUndefined()
  })

  test('getNextExpected returns a Date in the future', () => {
    const scheduler = createScheduler({
      jobs: [{ name: 'hourly', schedule: '0 * * * *' }],
    })

    const next = scheduler.getNextExpected('hourly')
    expect(next).toBeInstanceOf(Date)
    expect(next?.getTime()).toBeGreaterThan(Date.now())
  })

  test('getNextExpected returns undefined for unknown job', () => {
    const scheduler = createScheduler({
      jobs: [{ name: 'known', schedule: '0 * * * *' }],
    })

    expect(scheduler.getNextExpected('unknown')).toBeUndefined()
  })

  test('fires onMiss for missed job', async () => {
    const missed: string[] = []
    const reporter = mockReporter()

    // Every-minute schedule with very short grace and check interval
    const scheduler = createScheduler({
      jobs: [{ name: 'lazy-job', schedule: '* * * * *', gracePeriod: '1ms' }],
      checkIntervalMs: 30,
      reporter,
      onMiss: (name) => missed.push(name),
    })

    scheduler.start()
    // Wait long enough for at least one check cycle
    await delay(150)
    scheduler.stop()

    expect(missed).toContain('lazy-job')
  })

  test('does not fire onMiss when job checks in', async () => {
    const missed: string[] = []
    const reporter = mockReporter()

    const scheduler = createScheduler({
      jobs: [{ name: 'good-job', schedule: '* * * * *', gracePeriod: '1ms' }],
      checkIntervalMs: 50,
      reporter,
      onMiss: (name) => missed.push(name),
    })

    // Check in immediately before starting
    scheduler.checkIn('good-job')
    scheduler.start()
    await delay(150)
    scheduler.stop()

    expect(missed).not.toContain('good-job')
  })

  test('does not re-alert for same missed window', async () => {
    const missed: string[] = []
    const reporter = mockReporter()

    const scheduler = createScheduler({
      jobs: [{ name: 'once-job', schedule: '* * * * *', gracePeriod: '1ms' }],
      checkIntervalMs: 30,
      reporter,
      onMiss: (name) => missed.push(name),
    })

    scheduler.start()
    await delay(200)
    scheduler.stop()

    // Should only have been called once for this window, not on every tick
    const missCount = missed.filter((n) => n === 'once-job').length
    expect(missCount).toBe(1)
  })

  test('reports miss event via reporter', async () => {
    const reporter = mockReporter()

    const scheduler = createScheduler({
      jobs: [{ name: 'report-job', schedule: '* * * * *', gracePeriod: '1ms' }],
      checkIntervalMs: 30,
      reporter,
    })

    scheduler.start()
    await delay(150)
    scheduler.stop()

    const missEvent = reporter.events.find(
      (e) => e.channel === 'cron' && e.status === 'fail' && e.message.includes('missed'),
    )
    expect(missEvent).toBeDefined()
  })
})
