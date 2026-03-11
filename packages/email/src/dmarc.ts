import type { Issue } from '@arrivd/core'
import type { DnsResolver } from './dns'
import type { DmarcResult } from './types'

// ── DMARC Audit ──

export async function auditDmarc(domain: string, resolver: DnsResolver): Promise<DmarcResult> {
  const dmarcDomain = `_dmarc.${domain}`
  const records = await resolver.resolveTxt(dmarcDomain)
  const flat = records.flat().join(' ')

  if (!flat || !flat.includes('v=DMARC1')) {
    return {
      found: false,
      raw: null,
      domain,
      policy: null,
      subdomainPolicy: null,
      rua: null,
      ruf: null,
      pct: 100,
      issues: [
        {
          severity: 'critical',
          code: 'DMARC_MISSING',
          message: 'No DMARC record found',
          fix: 'Add a DMARC record: v=DMARC1; p=quarantine; rua=mailto:dmarc@your-domain.com',
        },
      ],
    }
  }

  const issues: Issue[] = []
  const policy = extractPolicy(flat)
  const subdomainPolicy = extractTag(flat, 'sp') as DmarcResult['subdomainPolicy']
  const rua = extractTag(flat, 'rua')
  const ruf = extractTag(flat, 'ruf')
  const pctRaw = extractTag(flat, 'pct')
  const pctParsed = pctRaw ? Number.parseInt(pctRaw, 10) : 100
  const pct = Number.isNaN(pctParsed) || pctParsed < 0 || pctParsed > 100 ? 100 : pctParsed

  // Policy checks
  if (policy === 'none') {
    issues.push({
      severity: 'critical',
      code: 'DMARC_POLICY_NONE',
      message: 'DMARC policy is "none" — emails from spoofed senders won\'t be blocked',
      fix: 'Change to p=quarantine (or p=reject when confident)',
    })
  } else if (policy === 'quarantine') {
    issues.push({
      severity: 'info',
      code: 'DMARC_POLICY_QUARANTINE',
      message: 'DMARC policy is "quarantine" — spoofed emails will be sent to spam. Consider upgrading to "reject".',
    })
  }

  // Reporting checks
  if (!rua) {
    issues.push({
      severity: 'warning',
      code: 'DMARC_NO_RUA',
      message: "No aggregate report address (rua) — you won't receive DMARC reports",
      fix: 'Add rua=mailto:dmarc@your-domain.com to your DMARC record',
    })
  }

  // Percentage check
  if (pctRaw && (Number.isNaN(pctParsed) || pctParsed < 0 || pctParsed > 100)) {
    issues.push({
      severity: 'warning',
      code: 'DMARC_INVALID_PCT',
      message: `DMARC pct value "${pctRaw}" is invalid (must be 0–100)`,
      fix: 'Set pct to a value between 0 and 100, or remove it to default to 100',
    })
  } else if (pct < 100) {
    issues.push({
      severity: 'warning',
      code: 'DMARC_LOW_PCT',
      message: `DMARC policy only applies to ${pct}% of emails`,
    })
  }

  return { found: true, raw: flat, domain, policy, subdomainPolicy, rua, ruf, pct, issues }
}

// ── Helpers ──

function extractPolicy(record: string): DmarcResult['policy'] {
  const match = record.match(/;\s*p=(\w+)/)
  if (!match) return null
  const val = match[1].toLowerCase()
  if (val === 'none' || val === 'quarantine' || val === 'reject') return val
  return null
}

function extractTag(record: string, tag: string): string | null {
  const match = record.match(new RegExp(`${tag}=([^;]+)`))
  return match ? match[1].trim() : null
}
