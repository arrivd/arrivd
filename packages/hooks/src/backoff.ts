// ── Backoff ──

export function calculateBackoff(attempt: number): number {
  const base = 2 ** attempt * 1000
  const jitter = Math.floor(Math.random() * 1000)
  return base + jitter
}
