import { calculateGrade, generateId, now, truncate } from './utils'
import { describe, expect, test } from 'bun:test'

describe('generateId', () => {
  test('returns a string', () => {
    expect(typeof generateId()).toBe('string')
  })

  test('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

describe('now', () => {
  test('returns a number', () => {
    expect(typeof now()).toBe('number')
  })

  test('increases over time', async () => {
    const a = now()
    await new Promise((r) => setTimeout(r, 5))
    const b = now()
    expect(b).toBeGreaterThan(a)
  })
})

describe('truncate', () => {
  test('returns short strings unchanged', () => {
    expect(truncate('hello')).toBe('hello')
  })

  test('truncates at default 500 chars', () => {
    const long = 'x'.repeat(600)
    const result = truncate(long)
    expect(result.length).toBeLessThan(600)
    expect(result).toContain('[truncated, 600 chars total]')
  })

  test('truncates at custom length', () => {
    const result = truncate('hello world', 5)
    expect(result).toContain('hello')
    expect(result).toContain('[truncated')
  })

  test('returns exact-length strings unchanged', () => {
    const exact = 'x'.repeat(500)
    expect(truncate(exact)).toBe(exact)
  })
})

describe('calculateGrade', () => {
  test('returns A for no issues', () => {
    expect(calculateGrade([])).toBe('A')
  })

  test('returns B for 1 warning', () => {
    expect(calculateGrade([{ severity: 'warning', code: 'W1', message: 'w' }])).toBe('B')
  })

  test('returns B for 2 warnings', () => {
    const issues = Array.from({ length: 2 }, (_, i) => ({
      severity: 'warning' as const,
      code: `W${i}`,
      message: 'w',
    }))
    expect(calculateGrade(issues)).toBe('B')
  })

  test('returns C for 3 warnings', () => {
    const issues = Array.from({ length: 3 }, (_, i) => ({
      severity: 'warning' as const,
      code: `W${i}`,
      message: 'w',
    }))
    expect(calculateGrade(issues)).toBe('C')
  })

  test('returns C for 1 critical', () => {
    expect(calculateGrade([{ severity: 'critical', code: 'C1', message: 'c' }])).toBe('C')
  })

  test('returns D for 2 criticals', () => {
    const issues = Array.from({ length: 2 }, (_, i) => ({
      severity: 'critical' as const,
      code: `C${i}`,
      message: 'c',
    }))
    expect(calculateGrade(issues)).toBe('D')
  })

  test('returns F for 3+ criticals', () => {
    const issues = Array.from({ length: 3 }, (_, i) => ({
      severity: 'critical' as const,
      code: `C${i}`,
      message: 'c',
    }))
    expect(calculateGrade(issues)).toBe('F')
  })

  test('ignores info-level issues', () => {
    expect(calculateGrade([{ severity: 'info', code: 'I1', message: 'i' }])).toBe('A')
  })
})
