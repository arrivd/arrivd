import { auditBimi } from './bimi'
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

describe('auditBimi', () => {
  test('detects missing BIMI record', async () => {
    const resolver = mockResolver({})
    const result = await auditBimi('example.com', resolver)

    expect(result.found).toBe(false)
    expect(result.raw).toBeNull()
    expect(result.logoUrl).toBeNull()
    expect(result.certificateUrl).toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'BIMI_MISSING' }))
  })

  test('parses complete BIMI record', async () => {
    const resolver = mockResolver({
      'default._bimi.example.com': [['v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/cert.pem']],
    })
    const result = await auditBimi('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.logoUrl).toBe('https://example.com/logo.svg')
    expect(result.certificateUrl).toBe('https://example.com/cert.pem')
    expect(result.issues).toHaveLength(0)
  })

  test('warns when logo URL is missing', async () => {
    const resolver = mockResolver({
      'default._bimi.example.com': [['v=BIMI1; l=; a=https://example.com/cert.pem']],
    })
    const result = await auditBimi('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'BIMI_NO_LOGO', severity: 'warning' }))
  })

  test('notes when VMC certificate is missing', async () => {
    const resolver = mockResolver({
      'default._bimi.example.com': [['v=BIMI1; l=https://example.com/logo.svg']],
    })
    const result = await auditBimi('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.logoUrl).toBe('https://example.com/logo.svg')
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'BIMI_NO_VMC', severity: 'info' }))
  })

  test('handles record with no tags', async () => {
    const resolver = mockResolver({
      'default._bimi.example.com': [['v=BIMI1']],
    })
    const result = await auditBimi('example.com', resolver)

    expect(result.found).toBe(true)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'BIMI_NO_LOGO' }))
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'BIMI_NO_VMC' }))
  })

  test('ignores non-BIMI records', async () => {
    const resolver = mockResolver({
      'default._bimi.example.com': [['some-other-record']],
    })
    const result = await auditBimi('example.com', resolver)

    expect(result.found).toBe(false)
  })
})
