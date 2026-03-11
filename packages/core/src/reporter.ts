import type { ArrivdConfig, ArrivdEvent, Reporter } from './types'
import { generateId } from './utils'

// ── Local Reporter ──

export class LocalReporter implements Reporter {
  private events: ArrivdEvent[] = []
  private verbose: boolean

  constructor(verbose = false) {
    this.verbose = verbose
  }

  report(event: ArrivdEvent): void {
    this.events.push(event)
    if (this.verbose) {
      const icon = event.status === 'pass' ? '✓' : event.status === 'fail' ? '✗' : '⚠'
      console.log(`[arrivd] ${icon} ${event.channel}/${event.message}`)
    }
  }

  async flush(): Promise<void> {
    this.events = []
  }

  getEvents(): ArrivdEvent[] {
    return [...this.events]
  }
}

// ── Cloud Reporter ──

export class CloudReporter implements Reporter {
  private buffer: ArrivdEvent[] = []
  private endpoint: string
  private projectId: string
  private maxBufferSize = 1000
  private failCount = 0
  private maxRetries = 3

  constructor(endpoint: string, projectId: string) {
    this.endpoint = endpoint
    this.projectId = projectId
  }

  report(event: ArrivdEvent): void {
    if (this.buffer.length < this.maxBufferSize) {
      this.buffer.push(event)
    }
    if (this.buffer.length >= 10) {
      this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    const batch = this.buffer.splice(0)
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ projectId: this.projectId, events: batch }),
      })
      this.failCount = 0
    } catch {
      this.failCount++
      // Re-queue on failure, but drop after repeated failures to avoid poison batch
      if (this.failCount <= this.maxRetries) {
        const remaining = this.maxBufferSize - this.buffer.length
        if (remaining > 0) {
          this.buffer.unshift(...batch.slice(0, remaining))
        }
      }
    }
  }

  destroy(): void {
    this.buffer = []
  }
}

// ── Factory ──

export function createReporter(config: ArrivdConfig): Reporter {
  if (config.endpoint && config.projectId) {
    return new CloudReporter(config.endpoint, config.projectId)
  }
  return new LocalReporter(config.verbose)
}

// ── Helpers ──

export function createEvent(
  channel: ArrivdEvent['channel'],
  status: ArrivdEvent['status'],
  message: string,
  details?: Record<string, unknown>,
): ArrivdEvent {
  return {
    id: generateId(),
    timestamp: Date.now(),
    channel,
    status,
    message,
    details,
  }
}
