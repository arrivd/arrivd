import type { Issue } from '@arrivd/core'
import type { DnsResolver } from './dns'
import type { BimiResult } from './types'

// ── BIMI Audit ──

export async function auditBimi(domain: string, resolver: DnsResolver): Promise<BimiResult> {
  const bimiDomain = `default._bimi.${domain}`
  const records = await resolver.resolveTxt(bimiDomain)
  const flat = records.flat().join(' ')

  if (!flat || !flat.includes('v=BIMI1')) {
    return {
      found: false,
      raw: null,
      logoUrl: null,
      certificateUrl: null,
      issues: [
        {
          severity: 'info',
          code: 'BIMI_MISSING',
          message: "No BIMI record found — your logo won't appear in supporting email clients",
        },
      ],
    }
  }

  const issues: Issue[] = []
  const logoUrl = extractTag(flat, 'l')
  const certificateUrl = extractTag(flat, 'a')

  if (!logoUrl || logoUrl === '') {
    issues.push({
      severity: 'warning',
      code: 'BIMI_NO_LOGO',
      message: 'BIMI record has no logo URL (l= tag)',
      fix: 'Add an SVG logo URL to the l= tag',
    })
  }

  if (!certificateUrl || certificateUrl === '') {
    issues.push({
      severity: 'info',
      code: 'BIMI_NO_VMC',
      message: 'No Verified Mark Certificate (VMC) — required for Gmail BIMI display',
    })
  }

  return { found: true, raw: flat, logoUrl, certificateUrl, issues }
}

// ── Helpers ──

function extractTag(record: string, tag: string): string | null {
  const match = record.match(new RegExp(`${tag}=([^;]+)`))
  return match ? match[1].trim() : null
}
