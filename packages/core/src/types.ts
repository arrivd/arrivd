// ── Config ──

export interface ArrivdConfig {
  /** Project identifier for cloud reporting */
  projectId?: string
  /** Alert destinations */
  alerts?: AlertConfig
  /** Cloud reporting endpoint */
  endpoint?: string
  /** Enable verbose local logging */
  verbose?: boolean
}

export interface AlertConfig {
  slack?: { webhookUrl: string }
  email?: { to: string; from?: string }
  webhook?: { url: string; secret?: string }
}

// ── Events ──

export type Channel = 'email' | 'webhook' | 'cron'
export type Severity = 'critical' | 'warning' | 'info'
export type Status = 'pass' | 'fail' | 'warn' | 'skip'

export interface ArrivdEvent {
  id: string
  timestamp: number
  channel: Channel
  status: Status
  message: string
  details?: Record<string, unknown>
  duration?: number
}

// ── Audit ──

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface Issue {
  severity: Severity
  code: string
  message: string
  fix?: string
}

export interface Recommendation {
  priority: number
  title: string
  description: string
  command?: string
}

// ── Reporter ──

export interface Reporter {
  report(event: ArrivdEvent): void
  flush(): Promise<void>
}

// ── Monitor ──

export interface MonitorOptions {
  name: string
  channel: Channel
  schedule?: string
  timeout?: string
}
