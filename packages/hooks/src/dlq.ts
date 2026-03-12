import type { DlqEntry } from './types'

// ── Dead Letter Queue ──

const DEFAULT_MAX_SIZE = 1000

export class DeadLetterQueue {
  private entries = new Map<string, DlqEntry>()
  private maxSize: number

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize
  }

  add(entry: DlqEntry): void {
    // FIFO eviction — drop oldest entries when at capacity
    while (this.entries.size >= this.maxSize) {
      const oldest = this.entries.keys().next().value!
      this.entries.delete(oldest)
    }
    this.entries.set(entry.id, entry)
  }

  get(id: string): DlqEntry | undefined {
    return this.entries.get(id)
  }

  remove(id: string): void {
    this.entries.delete(id)
  }

  list(): DlqEntry[] {
    return [...this.entries.values()]
  }

  purge(): void {
    this.entries.clear()
  }

  size(): number {
    return this.entries.size
  }
}
