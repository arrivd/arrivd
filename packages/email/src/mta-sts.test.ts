import type { DnsResolver } from './dns'
import { auditMtaSts } from './mta-sts'
import { describe, expect, mock, test } from 'bun:test'

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

describe('auditMtaSts', () => {
  test('detects missing MTA-STS record', async () => {
    const resolver = mockResolver({})
    const result = await auditMtaSts('example.com', resolver)

    expect(result.found).toBe(false)
    expect(result.raw).toBeNull()
    expect(result.mode).toBeNull()
    expect(result.maxAge).toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'MTA_STS_MISSING' }))
  })

  test('parses enforce mode policy', async () => {
    const resolver = mockResolver({
      '_mta-sts.example.com': [['v=STSv1; id=20230101']],
    })
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('version: STSv1\nmode: enforce\nmax_age: 86400\nmx: mail.example.com')),
    ) as typeof fetch

    const result = await auditMtaSts('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.mode).toBe('enforce')
    expect(result.maxAge).toBe(86400)
    expect(result.issues.filter((i) => i.code.startsWith('MTA_STS_'))).toHaveLength(0)
  })

  test('warns on testing mode', async () => {
    const resolver = mockResolver({
      '_mta-sts.example.com': [['v=STSv1; id=20230101']],
    })
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('version: STSv1\nmode: testing\nmax_age: 86400')),
    ) as typeof fetch

    const result = await auditMtaSts('example.com', resolver)

    expect(result.mode).toBe('testing')
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'MTA_STS_TESTING', severity: 'warning' }))
  })

  test('warns on none mode', async () => {
    const resolver = mockResolver({
      '_mta-sts.example.com': [['v=STSv1; id=20230101']],
    })
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('version: STSv1\nmode: none\nmax_age: 86400')),
    ) as typeof fetch

    const result = await auditMtaSts('example.com', resolver)

    expect(result.mode).toBe('none')
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'MTA_STS_NONE', severity: 'warning' }))
  })

  test('warns when policy file returns non-200', async () => {
    const resolver = mockResolver({
      '_mta-sts.example.com': [['v=STSv1; id=20230101']],
    })
    globalThis.fetch = mock(() => Promise.resolve(new Response('', { status: 404 }))) as typeof fetch

    const result = await auditMtaSts('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'MTA_STS_POLICY_UNREACHABLE', severity: 'warning' }),
    )
  })

  test('warns when fetch times out', async () => {
    const resolver = mockResolver({
      '_mta-sts.example.com': [['v=STSv1; id=20230101']],
    })
    globalThis.fetch = mock(() => Promise.reject(new Error('timeout'))) as typeof fetch

    const result = await auditMtaSts('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'MTA_STS_POLICY_TIMEOUT', severity: 'warning' }),
    )
  })

  test('ignores non-STSv1 records', async () => {
    const resolver = mockResolver({
      '_mta-sts.example.com': [['some-other-record']],
    })
    const result = await auditMtaSts('example.com', resolver)

    expect(result.found).toBe(false)
  })
})
