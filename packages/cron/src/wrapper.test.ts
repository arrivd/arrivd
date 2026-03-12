import type { ArrivdEvent, Reporter } from '@arrivd/core'
import { monitor } from './wrapper'
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

describe('monitor', () => {
  test('reports start and success events', async () => {
    const reporter = mockReporter()
    const job = monitor('test-job', async () => 'ok', { reporter })

    await job()

    const channels = reporter.events.map((e) => e.channel)
    const statuses = reporter.events.map((e) => e.status)
    expect(channels.every((c) => c === 'cron')).toBe(true)
    expect(statuses).toContain('pass')
    expect(reporter.events.some((e) => e.message.includes('started'))).toBe(true)
    expect(reporter.events.some((e) => e.message.includes('completed'))).toBe(true)
  })

  test('reports duration on success', async () => {
    const reporter = mockReporter()
    const job = monitor(
      'dur-job',
      async () => {
        await delay(10)
        return 42
      },
      { reporter },
    )

    await job()

    const completed = reporter.events.find((e) => e.message.includes('completed'))
    expect(completed?.details?.duration).toBeGreaterThan(0)
  })

  test('reports failure and re-throws', async () => {
    const reporter = mockReporter()
    const job = monitor(
      'fail-job',
      async () => {
        throw new Error('boom')
      },
      { reporter },
    )

    await expect(job()).rejects.toThrow('boom')

    const failEvent = reporter.events.find((e) => e.status === 'fail')
    expect(failEvent).toBeDefined()
    expect(failEvent?.message).toContain('boom')
  })

  test('error event includes error message in details', async () => {
    const reporter = mockReporter()
    const job = monitor(
      'err-detail',
      async () => {
        throw new Error('disk full')
      },
      { reporter },
    )

    await expect(job()).rejects.toThrow()

    const failEvent = reporter.events.find((e) => e.status === 'fail')
    expect(failEvent?.details?.error).toBe('disk full')
  })

  test('timeout fires alert but does not kill job', async () => {
    const reporter = mockReporter()
    const job = monitor(
      'slow-job',
      async () => {
        await delay(200)
        return 'done'
      },
      { reporter, timeout: '50' },
    )

    const result = await job()
    expect(result).toBe('done')

    const timeoutEvent = reporter.events.find((e) => e.message.includes('exceeded timeout'))
    expect(timeoutEvent).toBeDefined()
  })

  test('history is capped at 100', async () => {
    const reporter = mockReporter()
    const job = monitor('cap-job', async () => 'ok', { reporter })

    for (let i = 0; i < 105; i++) {
      await job()
    }

    expect(job.history.length).toBe(100)
  })

  test('lastRun updates after each call', async () => {
    const reporter = mockReporter()
    const job = monitor('last-run-job', async () => 'ok', { reporter })

    await job()
    const firstId = job.lastRun?.id

    await job()
    const secondId = job.lastRun?.id

    expect(firstId).toBeDefined()
    expect(secondId).toBeDefined()
    expect(firstId).not.toBe(secondId)
  })

  test('handles instant resolution', async () => {
    const reporter = mockReporter()
    const job = monitor('instant-job', async () => 'fast', { reporter })

    const result = await job()
    expect(result).toBe('fast')
    expect(reporter.events.length).toBe(2) // start + complete
  })

  test('onCheckIn callback fires on success', async () => {
    const reporter = mockReporter()
    const checkIns: string[] = []
    const job = monitor('checkin-job', async () => 'ok', {
      reporter,
      onCheckIn: (name) => checkIns.push(name),
    })

    await job()
    expect(checkIns).toEqual(['checkin-job'])
  })

  test('onCheckIn does not fire on failure', async () => {
    const reporter = mockReporter()
    const checkIns: string[] = []
    const job = monitor(
      'no-checkin',
      async () => {
        throw new Error('fail')
      },
      {
        reporter,
        onCheckIn: (name) => checkIns.push(name),
      },
    )

    await expect(job()).rejects.toThrow()
    expect(checkIns).toEqual([])
  })
})
