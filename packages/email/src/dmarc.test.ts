import { auditDmarc } from './dmarc'
import type { DnsResolver } from './dns'
import { describe, expect, test } from 'bun:test'

function mockResolver(records: Record<string, string[][]>): DnsResolver {
  return {
    async resolveTxt(domain: string) {
      return records[domain] || []
    },
    async resolveCname() {
      return []
    },
  }
}

describe('auditDmarc', () => {
  test('detects missing DMARC', async () => {
    const resolver = mockResolver({})
    const result = await auditDmarc('example.com', resolver)

    expect(result.found).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DMARC_MISSING', severity: 'critical' }))
  })

  test('parses policy=none and flags it', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=none; rua=mailto:dmarc@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.policy).toBe('none')
    expect(result.rua).toBe('mailto:dmarc@example.com')
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DMARC_POLICY_NONE', severity: 'critical' }))
  })

  test('parses policy=quarantine', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=quarantine; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.policy).toBe('quarantine')
  })

  test('parses policy=reject with no critical issues', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; rua=mailto:d@example.com; pct=100']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.policy).toBe('reject')
    expect(result.pct).toBe(100)
    expect(result.issues.filter((i) => i.severity === 'critical')).toHaveLength(0)
  })

  test('parses subdomain policy (sp=reject)', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; sp=reject; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.subdomainPolicy).toBe('reject')
  })

  test('returns null subdomain policy when absent', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.subdomainPolicy).toBeNull()
  })

  test('parses ruf tag', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; rua=mailto:d@example.com; ruf=mailto:f@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.ruf).toBe('mailto:f@example.com')
  })

  test('ruf defaults to null when absent', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.ruf).toBeNull()
  })

  test('flags missing rua', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DMARC_NO_RUA', severity: 'warning' }))
  })

  test('flags pct > 100 as invalid', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; pct=150; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.pct).toBe(100)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DMARC_INVALID_PCT', severity: 'warning' }))
  })

  test('flags pct < 0 as invalid', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; pct=-5; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.pct).toBe(100)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DMARC_INVALID_PCT', severity: 'warning' }))
  })

  test('flags non-numeric pct as invalid', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; pct=abc; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.pct).toBe(100)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DMARC_INVALID_PCT', severity: 'warning' }))
  })

  test('pct=0 is valid and flags low percentage', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; pct=0; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.pct).toBe(0)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DMARC_LOW_PCT', severity: 'warning' }))
  })

  test('flags low percentage', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject; pct=50; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.pct).toBe(50)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DMARC_LOW_PCT', severity: 'warning' }))
  })

  test('joins multi-string TXT records with space and still parses', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=reject;', ' rua=mailto:d@example.com; pct=100']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.policy).toBe('reject')
    expect(result.rua).toBe('mailto:d@example.com')
    expect(result.pct).toBe(100)
  })

  test('returns null for unknown policy value', async () => {
    const resolver = mockResolver({
      '_dmarc.example.com': [['v=DMARC1; p=invalid; rua=mailto:d@example.com']],
    })
    const result = await auditDmarc('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.policy).toBeNull()
  })
})
