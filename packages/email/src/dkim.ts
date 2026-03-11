import type { Issue } from '@arrivd/core'
import type { DnsResolver } from './dns'
import type { DkimResult } from './types'

// ── Common Selectors ──

const COMMON_SELECTORS = [
  'google',
  'default',
  'selector1',
  'selector2',
  'k1',
  'k2',
  'k3',
  'mandrill',
  'mail',
  'dkim',
  's1',
  's2',
  'smtp',
  'mx',
  'email',
  'postmark',
  'resend',
  'ses',
  'amazonses',
  'cm',
  'sendgrid',
  'sg',
  'everlytickey1',
  'everlytickey2',
  'turbo-smtp',
  'mailjet',
]

// ── DKIM Audit ──

const PRIORITY_SELECTORS = COMMON_SELECTORS.slice(0, 6)
const REMAINING_SELECTORS = COMMON_SELECTORS.slice(6)

export async function auditDkim(domain: string, resolver: DnsResolver): Promise<DkimResult> {
  // Try the most common selectors first (sequentially, fast exit)
  for (const selector of PRIORITY_SELECTORS) {
    const result = await checkSelector(domain, selector, resolver)
    if (result.found) return result
  }

  // Fan out remaining selectors in batches of 5
  for (let i = 0; i < REMAINING_SELECTORS.length; i += 5) {
    const batch = REMAINING_SELECTORS.slice(i, i + 5)
    const results = await Promise.all(batch.map((s) => checkSelector(domain, s, resolver)))
    const found = results.find((r) => r.found)
    if (found) return found
  }

  return {
    found: false,
    raw: null,
    domain,
    selector: null,
    keyType: null,
    keyLength: null,
    issues: [
      {
        severity: 'critical',
        code: 'DKIM_NOT_FOUND',
        message: `No DKIM record found for selectors: ${COMMON_SELECTORS.slice(0, 7).join(', ')}`,
        fix: 'Add a DKIM record. Your ESP should provide the value.',
      },
    ],
  }
}

// ── Selector Check ──

async function checkSelector(domain: string, selector: string, resolver: DnsResolver): Promise<DkimResult> {
  const dkimDomain = `${selector}._domainkey.${domain}`
  const records = await resolver.resolveTxt(dkimDomain)
  const flat = records.flat().join('')

  if (!flat || !flat.includes('v=DKIM1')) {
    // Also try CNAME
    const cnames = await resolver.resolveCname(dkimDomain)
    if (cnames.length > 0) {
      return {
        found: true,
        raw: `CNAME → ${cnames[0]}`,
        domain,
        selector,
        keyType: null,
        keyLength: null,
        issues: [],
      }
    }
    return { found: false, raw: null, domain, selector: null, keyType: null, keyLength: null, issues: [] }
  }

  const issues: Issue[] = []
  const keyType = extractTag(flat, 'k') || 'rsa'
  const publicKey = extractTag(flat, 'p')

  let keyLength: number | null = null
  if (publicKey) {
    // Rough key length estimate from base64
    keyLength = Math.floor((publicKey.length * 6) / 8) * 8
    if (keyLength < 1024) {
      issues.push({
        severity: 'critical',
        code: 'DKIM_WEAK_KEY',
        message: `DKIM key is ~${keyLength} bits — minimum recommended is 1024, prefer 2048`,
        fix: 'Generate a new DKIM key pair with at least 2048 bits',
      })
    } else if (keyLength < 2048) {
      issues.push({
        severity: 'warning',
        code: 'DKIM_SHORT_KEY',
        message: `DKIM key is ~${keyLength} bits — 2048 bits is recommended`,
      })
    }
  }

  if (publicKey === '') {
    issues.push({
      severity: 'critical',
      code: 'DKIM_REVOKED',
      message: 'DKIM key has been revoked (empty p= tag)',
    })
  }

  return { found: true, raw: flat, domain, selector, keyType, keyLength, issues }
}

// ── Helpers ──

function extractTag(record: string, tag: string): string | null {
  const match = record.match(new RegExp(`${tag}=([^;]*)`))
  if (!match) return null
  const val = match[1].trim()
  return val
}
