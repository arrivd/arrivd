import type { DeliveryJob, QueueAdapter } from './types'

// ── Memory Queue ──

export class MemoryQueue implements QueueAdapter {
  private jobs: DeliveryJob[] = []

  enqueue(job: DeliveryJob): void {
    this.jobs.push(job)
  }

  dequeue(): DeliveryJob | null {
    return this.jobs.shift() ?? null
  }

  size(): number {
    return this.jobs.length
  }
}
