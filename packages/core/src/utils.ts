import type { Grade, Issue } from './types'

// ── IDs ──

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Timing ──

export function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

// ── Strings ──

export function truncate(str: string, maxLength = 500): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}... [truncated, ${str.length} chars total]`
}

// ── Scoring ──

export function calculateGrade(issues: Issue[]): Grade {
  const criticals = issues.filter((i) => i.severity === 'critical').length
  const warnings = issues.filter((i) => i.severity === 'warning').length

  if (criticals >= 3) return 'F'
  if (criticals >= 2) return 'D'
  if (criticals >= 1) return 'C'
  if (warnings >= 3) return 'C'
  if (warnings >= 1) return 'B'
  return 'A'
}
