// ── Backoff ──

export function calculateBackoff(attempt: number): number {
  const base = 2 ** attempt * 1000
  const multiplier = 0.5 + Math.random() // 0.5x–1.5x
  return Math.floor(base * multiplier)
}
