import { createEvent, generateId, LocalReporter, sendAlert } from '@arrivd/core'
import { parseDuration } from './parser'
import type { CronJobConfig, CronRunRecord, MonitoredJob } from './types'

const MAX_HISTORY = 100

export function monitor<T>(name: string, fn: () => Promise<T>, config?: Omit<CronJobConfig, 'name'>): MonitoredJob<T> {
  const reporter = config?.reporter ?? new LocalReporter(true)
  const timeoutMs = config?.timeout ? parseDuration(config.timeout) : undefined
  const history: CronRunRecord[] = []
  let lastRun: CronRunRecord | undefined

  function pushRecord(record: CronRunRecord) {
    history.push(record)
    if (history.length > MAX_HISTORY) history.shift()
    lastRun = record
  }

  const job = async function monitoredJob(): Promise<T> {
    const runId = generateId()
    const record: CronRunRecord = {
      id: runId,
      jobName: name,
      status: 'running',
      startedAt: Date.now(),
      completedAt: null,
      duration: null,
      error: null,
    }

    reporter.report(createEvent('cron', 'pass', `${name} started`, { runId }))

    let timeoutFired = false
    let timer: ReturnType<typeof setTimeout> | undefined

    if (timeoutMs) {
      timer = setTimeout(async () => {
        timeoutFired = true
        record.status = 'timeout'
        reporter.report(createEvent('cron', 'fail', `${name} exceeded timeout (${config?.timeout})`, { runId }))
        if (config?.alerts) {
          await sendAlert(
            config.alerts,
            createEvent('cron', 'fail', `${name} exceeded timeout (${config.timeout})`, { runId }),
          )
        }
      }, timeoutMs)
    }

    try {
      const result = await fn()

      if (timer) clearTimeout(timer)
      if (!timeoutFired) record.status = 'success'
      record.completedAt = Date.now()
      record.duration = record.completedAt - record.startedAt

      reporter.report(createEvent('cron', 'pass', `${name} completed`, { runId, duration: record.duration }))
      config?.onCheckIn?.(name)
      pushRecord(record)
      return result
    } catch (err) {
      if (timer) clearTimeout(timer)

      const error = err instanceof Error ? err.message : String(err)
      record.status = 'failed'
      record.completedAt = Date.now()
      record.duration = record.completedAt - record.startedAt
      record.error = error

      reporter.report(createEvent('cron', 'fail', `${name} failed: ${error}`, { runId, error }))
      if (config?.alerts) {
        await sendAlert(config.alerts, createEvent('cron', 'fail', `${name} failed: ${error}`, { runId, error }))
      }

      pushRecord(record)
      throw err
    }
  } as MonitoredJob<T>

  Object.defineProperty(job, 'name', { value: name, writable: false })
  job.history = history
  Object.defineProperty(job, 'lastRun', { get: () => lastRun })

  return job
}
