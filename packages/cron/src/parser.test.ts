import { nextRun, parseDuration } from './parser'
import { describe, expect, test } from 'bun:test'

// ── nextRun ──

describe('nextRun', () => {
  test('basic daily — 0 2 * * * from midnight yields 02:00 same day', () => {
    const after = new Date('2025-06-15T00:00:00')
    const result = nextRun('0 2 * * *', after)
    expect(result.getHours()).toBe(2)
    expect(result.getMinutes()).toBe(0)
    expect(result.getDate()).toBe(15)
  })

  test('skips past times — 0 2 * * * from 03:00 yields 02:00 next day', () => {
    const after = new Date('2025-06-15T03:00:00')
    const result = nextRun('0 2 * * *', after)
    expect(result.getHours()).toBe(2)
    expect(result.getMinutes()).toBe(0)
    expect(result.getDate()).toBe(16)
  })

  test('step values — */15 * * * * from :07 yields :15', () => {
    const after = new Date('2025-06-15T10:07:00')
    const result = nextRun('*/15 * * * *', after)
    expect(result.getHours()).toBe(10)
    expect(result.getMinutes()).toBe(15)
  })

  test('range — 0 9 * * 1-5 from Saturday yields Monday 09:00', () => {
    // June 14, 2025 is a Saturday
    const after = new Date('2025-06-14T10:00:00')
    const result = nextRun('0 9 * * 1-5', after)
    expect(result.getDay()).toBe(1) // Monday
    expect(result.getHours()).toBe(9)
  })

  test('list — 0,30 * * * * from :10 yields :30 same hour', () => {
    const after = new Date('2025-06-15T14:10:00')
    const result = nextRun('0,30 * * * *', after)
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(30)
  })

  test('wildcard — * * * * * from :00:30 yields :01:00', () => {
    const after = new Date('2025-06-15T10:00:30')
    const result = nextRun('* * * * *', after)
    expect(result.getMinutes()).toBe(1)
  })

  test('specific day of month — 0 0 15 * * from the 16th yields 15th next month', () => {
    const after = new Date('2025-06-16T00:00:00')
    const result = nextRun('0 0 15 * *', after)
    expect(result.getDate()).toBe(15)
    expect(result.getMonth()).toBe(6) // July (0-indexed)
  })

  test('throws on invalid expression — too few fields', () => {
    expect(() => nextRun('invalid')).toThrow()
  })

  test('throws on invalid expression — too many fields', () => {
    expect(() => nextRun('* * * * * *')).toThrow()
  })
})

// ── parseDuration ──

describe('parseDuration', () => {
  test('seconds — 30s', () => {
    expect(parseDuration('30s')).toBe(30_000)
  })

  test('minutes — 5m', () => {
    expect(parseDuration('5m')).toBe(300_000)
  })

  test('hours — 1h', () => {
    expect(parseDuration('1h')).toBe(3_600_000)
  })

  test('combined — 2h30m', () => {
    expect(parseDuration('2h30m')).toBe(9_000_000)
  })

  test('combined with seconds — 1h30m15s', () => {
    expect(parseDuration('1h30m15s')).toBe(5_415_000)
  })

  test('plain number — 5000', () => {
    expect(parseDuration('5000')).toBe(5000)
  })

  test('throws on garbage — abc', () => {
    expect(() => parseDuration('abc')).toThrow()
  })
})
