import type { DlqEntry } from './types'

// ── Dead Letter Queue ──

export class DeadLetterQueue {
  private entries = new Map<string, DlqEntry>()

  add(entry: DlqEntry): void {
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
