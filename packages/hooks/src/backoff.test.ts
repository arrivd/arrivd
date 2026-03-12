import { calculateBackoff } from './backoff'
import { describe, expect, test } from 'bun:test'

describe('calculateBackoff', () => {
  test('attempt 0 returns ~1000ms', () => {
    const delay = calculateBackoff(0)

    expect(delay).toBeGreaterThanOrEqual(1000)
    expect(delay).toBeLessThan(2000)
  })

  test('attempt 1 returns ~2000ms', () => {
    const delay = calculateBackoff(1)

    expect(delay).toBeGreaterThanOrEqual(2000)
    expect(delay).toBeLessThan(3000)
  })

  test('attempt 2 returns ~4000ms', () => {
    const delay = calculateBackoff(2)

    expect(delay).toBeGreaterThanOrEqual(4000)
    expect(delay).toBeLessThan(5000)
  })

  test('attempt 3 returns ~8000ms', () => {
    const delay = calculateBackoff(3)

    expect(delay).toBeGreaterThanOrEqual(8000)
    expect(delay).toBeLessThan(9000)
  })

  test('attempt 4 returns ~16000ms', () => {
    const delay = calculateBackoff(4)

    expect(delay).toBeGreaterThanOrEqual(16000)
    expect(delay).toBeLessThan(17000)
  })

  test('includes jitter (not deterministic)', () => {
    const results = new Set<number>()
    for (let i = 0; i < 10; i++) {
      results.add(calculateBackoff(0))
    }

    expect(results.size).toBeGreaterThan(1)
  })
})
