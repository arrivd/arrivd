import type { DnsResolver } from './dns'
import { auditSpf } from './spf'
import { describe, expect, test } from 'bun:test'

// ── Mock Resolver ──

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

describe('auditSpf', () => {
  test('detects missing SPF record', async () => {
    const resolver = mockResolver({ 'example.com': [] })
    const result = await auditSpf('example.com', resolver)

    expect(result.found).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'SPF_MISSING', severity: 'critical' }))
  })

  test('parses valid SPF record', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 include:_spf.google.com ~all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.raw).toBe('v=spf1 include:_spf.google.com ~all')
    expect(result.includes).toEqual(['_spf.google.com'])
    expect(result.mechanism).toBe('~all')
  })

  test('detects uppercase V=SPF1', async () => {
    const resolver = mockResolver({
      'example.com': [['V=SPF1 include:_spf.google.com ~all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.found).toBe(true)
  })

  test('detects mixed-case v=Spf1', async () => {
    const resolver = mockResolver({
      'example.com': [['v=Spf1 include:_spf.google.com ~all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.found).toBe(true)
  })

  test('detects multiple SPF records', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 include:a.com ~all'], ['v=spf1 include:b.com ~all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'SPF_MULTIPLE', severity: 'critical' }))
  })

  test('parses -all (hardfail) mechanism', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 include:_spf.google.com -all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.mechanism).toBe('-all')
    expect(result.issues).not.toContainEqual(expect.objectContaining({ code: 'SPF_PLUS_ALL' }))
    expect(result.issues).not.toContainEqual(expect.objectContaining({ code: 'SPF_NEUTRAL' }))
  })

  test('parses ~all (softfail) mechanism', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 ~all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.mechanism).toBe('~all')
  })

  test('flags +all as critical', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 +all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'SPF_PLUS_ALL', severity: 'critical' }))
  })

  test('flags ?all as warning', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 ?all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'SPF_NEUTRAL', severity: 'warning' }))
  })

  test('counts redirect= as a DNS lookup', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 redirect=_spf.other.com']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.lookupCount).toBe(1)
  })

  test('counts exists: as a DNS lookup', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 exists:%{i}._spf.example.com ~all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.lookupCount).toBe(1)
  })

  test('counts ptr mechanism as a DNS lookup', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 ptr ~all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.lookupCount).toBe(1)
  })

  test('counts a and mx mechanisms as DNS lookups', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 a mx a:other.com mx:mail.com ~all']],
    })
    const result = await auditSpf('example.com', resolver)

    expect(result.lookupCount).toBe(4)
  })

  test('counts DNS lookups from includes', async () => {
    const resolver = mockResolver({
      'example.com': [['v=spf1 include:a.com include:b.com mx ~all']],
      'a.com': [['v=spf1 include:c.com ~all']],
      'b.com': [['v=spf1 ~all']],
      'c.com': [['v=spf1 ~all']],
    })
    const result = await auditSpf('example.com', resolver)

    // include:a.com (1) + include:c.com (1) + include:b.com (1) + mx (1) = 4
    expect(result.lookupCount).toBe(4)
  })

  test('warns when lookups approach limit', async () => {
    const includes = Array.from({ length: 8 }, (_, i) => `include:s${i}.com`).join(' ')
    const records: Record<string, string[][]> = {
      'example.com': [[`v=spf1 ${includes} ~all`]],
    }
    for (let i = 0; i < 8; i++) {
      records[`s${i}.com`] = [['v=spf1 ~all']]
    }

    const resolver = mockResolver(records)
    const result = await auditSpf('example.com', resolver)

    expect(result.lookupCount).toBe(8)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'SPF_LOOKUP_HIGH', severity: 'warning' }))
  })

  test('flags when lookups exceed 10', async () => {
    const includes = Array.from({ length: 11 }, (_, i) => `include:s${i}.com`).join(' ')
    const records: Record<string, string[][]> = {
      'example.com': [[`v=spf1 ${includes} ~all`]],
    }
    for (let i = 0; i < 11; i++) {
      records[`s${i}.com`] = [['v=spf1 ~all']]
    }

    const resolver = mockResolver(records)
    const result = await auditSpf('example.com', resolver)

    expect(result.lookupCount).toBe(11)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'SPF_TOO_MANY_LOOKUPS', severity: 'critical' }),
    )
  })
})
