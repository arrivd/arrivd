import type { AlertConfig, Reporter } from '@arrivd/core'

// ── Job Config ──

export interface CronJobConfig {
  name: string
  schedule?: string
  timeout?: string
  gracePeriod?: string
  reporter?: Reporter
  alerts?: AlertConfig
  onCheckIn?: (jobName: string) => void
}

// ── Run Record ──

export interface CronRunRecord {
  id: string
  jobName: string
  status: 'running' | 'success' | 'failed' | 'timeout'
  startedAt: number
  completedAt: number | null
  duration: number | null
  error: string | null
}

// ── Monitor Return ──

export interface MonitoredJob<T> {
  (): Promise<T>
  name: string
  history: CronRunRecord[]
  lastRun: CronRunRecord | undefined
}

// ── Scheduler Types ──

export interface SchedulerConfig {
  jobs: Array<{
    name: string
    schedule: string
    gracePeriod?: string
  }>
  checkIntervalMs?: number
  alerts?: AlertConfig
  reporter?: Reporter
  onMiss?: (jobName: string, expectedAt: Date, now: Date) => void
}

export interface Scheduler {
  start(): void
  stop(): void
  checkIn(jobName: string): void
  getLastCheckIn(jobName: string): number | undefined
  getNextExpected(jobName: string): Date | undefined
}
