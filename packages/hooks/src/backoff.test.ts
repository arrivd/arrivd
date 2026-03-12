import { calculateBackoff } from './backoff'
import { describe, expect, test } from 'bun:test'

describe('calculateBackoff', () => {
  test('attempt 0 returns 500–1500ms', () => {
    const delay = calculateBackoff(0)

    expect(delay).toBeGreaterThanOrEqual(500)
    expect(delay).toBeLessThan(1500)
  })

  test('attempt 1 returns 1000–3000ms', () => {
    const delay = calculateBackoff(1)

    expect(delay).toBeGreaterThanOrEqual(1000)
    expect(delay).toBeLessThan(3000)
  })

  test('attempt 2 returns 2000–6000ms', () => {
    const delay = calculateBackoff(2)

    expect(delay).toBeGreaterThanOrEqual(2000)
    expect(delay).toBeLessThan(6000)
  })

  test('attempt 3 returns 4000–12000ms', () => {
    const delay = calculateBackoff(3)

    expect(delay).toBeGreaterThanOrEqual(4000)
    expect(delay).toBeLessThan(12000)
  })

  test('attempt 4 returns 8000–24000ms', () => {
    const delay = calculateBackoff(4)

    expect(delay).toBeGreaterThanOrEqual(8000)
    expect(delay).toBeLessThan(24000)
  })

  test('includes jitter (not deterministic)', () => {
    const results = new Set<number>()
    for (let i = 0; i < 10; i++) {
      results.add(calculateBackoff(0))
    }

    expect(results.size).toBeGreaterThan(1)
  })
})
