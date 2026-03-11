import { auditDkim } from './dkim'
import type { DnsResolver } from './dns'
import { describe, expect, test } from 'bun:test'

function mockResolver(records: Record<string, string[][]>, cnames: Record<string, string[]> = {}): DnsResolver {
  return {
    async resolveTxt(domain: string) {
      return records[domain] || []
    },
    async resolveCname(domain: string) {
      return cnames[domain] || []
    },
  }
}

function fakeKey(bits: number): string {
  return 'A'.repeat(Math.ceil(((bits / 8) * 4) / 3))
}

describe('auditDkim', () => {
  test('detects missing DKIM across all selectors', async () => {
    const resolver = mockResolver({})
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DKIM_NOT_FOUND', severity: 'critical' }))
  })

  test('finds DKIM with google selector', async () => {
    const resolver = mockResolver({
      'google._domainkey.example.com': [['v=DKIM1; k=rsa; p=MIIBIjANBgkqhk...']],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.selector).toBe('google')
    expect(result.keyType).toBe('rsa')
  })

  test('finds DKIM via CNAME', async () => {
    const resolver = mockResolver({}, { 'google._domainkey.example.com': ['google._domainkey.googlehosted.com'] })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.selector).toBe('google')
  })

  test('detects revoked DKIM key', async () => {
    const resolver = mockResolver({
      'default._domainkey.example.com': [['v=DKIM1; k=rsa; p=']],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DKIM_REVOKED', severity: 'critical' }))
  })

  test('tries multiple selectors and finds second', async () => {
    const resolver = mockResolver({
      'default._domainkey.example.com': [[`v=DKIM1; k=rsa; p=${fakeKey(2048)}`]],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.selector).toBe('default')
  })

  test('finds selector in remaining batch (not priority)', async () => {
    const resolver = mockResolver({
      'sendgrid._domainkey.example.com': [[`v=DKIM1; k=rsa; p=${fakeKey(2048)}`]],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.selector).toBe('sendgrid')
  })

  test('detects weak key (< 1024 bits)', async () => {
    const resolver = mockResolver({
      'google._domainkey.example.com': [[`v=DKIM1; k=rsa; p=${fakeKey(512)}`]],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DKIM_WEAK_KEY', severity: 'critical' }))
  })

  test('warns on short key (>= 1024, < 2048 bits)', async () => {
    const resolver = mockResolver({
      'google._domainkey.example.com': [[`v=DKIM1; k=rsa; p=${fakeKey(1024)}`]],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'DKIM_SHORT_KEY', severity: 'warning' }))
  })

  test('no key length warning for 2048+ bit key', async () => {
    const resolver = mockResolver({
      'google._domainkey.example.com': [[`v=DKIM1; k=rsa; p=${fakeKey(2048)}`]],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.keyLength).toBeGreaterThanOrEqual(2048)
    expect(result.issues).not.toContainEqual(expect.objectContaining({ code: 'DKIM_WEAK_KEY' }))
    expect(result.issues).not.toContainEqual(expect.objectContaining({ code: 'DKIM_SHORT_KEY' }))
  })

  test('returns keyLength estimate from base64', async () => {
    const resolver = mockResolver({
      'google._domainkey.example.com': [[`v=DKIM1; k=rsa; p=${fakeKey(2048)}`]],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.keyLength).toBeGreaterThan(0)
    expect(typeof result.keyLength).toBe('number')
  })

  test('defaults keyType to rsa when k= tag absent', async () => {
    const resolver = mockResolver({
      'google._domainkey.example.com': [[`v=DKIM1; p=${fakeKey(2048)}`]],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.keyType).toBe('rsa')
  })

  test('parses ed25519 key type', async () => {
    const resolver = mockResolver({
      'google._domainkey.example.com': [[`v=DKIM1; k=ed25519; p=${fakeKey(256)}`]],
    })
    const result = await auditDkim('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.keyType).toBe('ed25519')
  })
})
