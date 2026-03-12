import { createEvent, LocalReporter, sendAlert } from '@arrivd/core'
import { nextRun, parseDuration, previousRun } from './parser'
import type { Scheduler, SchedulerConfig } from './types'

export function createScheduler(config: SchedulerConfig): Scheduler {
  const reporter = config.reporter ?? new LocalReporter(true)
  const checkIntervalMs = config.checkIntervalMs ?? 60_000
  const lastCheckIns = new Map<string, number>()
  const lastAlertedWindow = new Map<string, number>()
  let timer: ReturnType<typeof setInterval> | null = null
  let checking = false

  async function checkForMisses(): Promise<void> {
    if (checking) return
    checking = true
    try {
      const now = Date.now()

      for (const job of config.jobs) {
        const gracePeriodMs = parseDuration(job.gracePeriod ?? '5m')

        let expected: Date
        try {
          expected = previousRun(job.schedule, new Date(now))
        } catch {
          continue
        }

        const expectedMs = expected.getTime()
        const deadline = expectedMs + gracePeriodMs

        if (now < deadline) continue

        // Already alerted for this window
        const lastAlerted = lastAlertedWindow.get(job.name)
        if (lastAlerted !== undefined && lastAlerted >= expectedMs) continue

        const lastCheckin = lastCheckIns.get(job.name)
        if (lastCheckin !== undefined && lastCheckin >= expectedMs) continue

        // Miss detected
        lastAlertedWindow.set(job.name, expectedMs)

        const event = createEvent('cron', 'fail', `${job.name} missed its expected window`, {
          jobName: job.name,
          expectedAt: expected.toISOString(),
          now: new Date(now).toISOString(),
        })

        reporter.report(event)

        if (config.alerts) {
          await sendAlert(config.alerts, event)
        }

        config.onMiss?.(job.name, expected, new Date(now))
      }
    } finally {
      checking = false
    }
  }

  return {
    start() {
      if (timer) return
      timer = setInterval(checkForMisses, checkIntervalMs)
    },

    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },

    checkIn(jobName: string) {
      lastCheckIns.set(jobName, Date.now())
    },

    getLastCheckIn(jobName: string): number | undefined {
      return lastCheckIns.get(jobName)
    },

    getNextExpected(jobName: string): Date | undefined {
      const job = config.jobs.find((j) => j.name === jobName)
      if (!job) return undefined
      try {
        return nextRun(job.schedule)
      } catch {
        return undefined
      }
    },
  }
}
