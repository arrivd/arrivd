import { resolve, resolveTxt } from 'node:dns/promises'
import type { Grade, Issue, Recommendation } from '@arrivd/core'
import { auditBimi } from './bimi'
import { auditDkim } from './dkim'
import { auditDmarc } from './dmarc'
import { auditMtaSts } from './mta-sts'
import { auditSpf } from './spf'
import type { BimiResult, DkimResult, DmarcResult, DnsAuditResult, MtaStsResult, SpfResult } from './types'

// ── DNS Resolution ──

export interface DnsResolver {
  resolveTxt(domain: string): Promise<string[][]>
  resolveCname(domain: string): Promise<string[]>
}

export class NodeDnsResolver implements DnsResolver {
  async resolveTxt(domain: string): Promise<string[][]> {
    try {
      return await resolveTxt(domain)
    } catch {
      return []
    }
  }

  async resolveCname(domain: string): Promise<string[]> {
    try {
      return await resolve(domain, 'CNAME')
    } catch {
      return []
    }
  }
}

export class DohResolver implements DnsResolver {
  private baseUrl: string

  constructor(provider: 'cloudflare' | 'google' = 'cloudflare') {
    this.baseUrl = provider === 'cloudflare' ? 'https://cloudflare-dns.com/dns-query' : 'https://dns.google/resolve'
  }

  async resolveTxt(domain: string): Promise<string[][]> {
    try {
      const res = await fetch(`${this.baseUrl}?name=${encodeURIComponent(domain)}&type=TXT`, {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { Answer?: { data: string }[] }
      if (!data.Answer || !Array.isArray(data.Answer)) return []
      return data.Answer.filter((a) => typeof a.data === 'string').map((a) => [a.data.replace(/^"|"$/g, '')])
    } catch {
      return []
    }
  }

  async resolveCname(domain: string): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}?name=${encodeURIComponent(domain)}&type=CNAME`, {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { Answer?: { data: string }[] }
      if (!data.Answer || !Array.isArray(data.Answer)) return []
      return data.Answer.filter((a) => typeof a.data === 'string').map((a) => a.data)
    } catch {
      return []
    }
  }
}

// ── Resolver Factory ──

export function createResolver(mode: 'auto' | 'node' | 'doh' = 'auto'): DnsResolver {
  if (mode === 'doh') return new DohResolver()
  if (mode === 'node') return new NodeDnsResolver()
  // Auto: prefer DoH, fall back to node
  return new DohResolver()
}

// ── Main Audit ──

export async function auditDomain(domain: string, resolver?: DnsResolver): Promise<DnsAuditResult> {
  const dns = resolver ?? createResolver()

  const [spf, dkim, dmarc, bimi, mtaSts] = await Promise.allSettled([
    auditSpf(domain, dns),
    auditDkim(domain, dns),
    auditDmarc(domain, dns),
    auditBimi(domain, dns),
    auditMtaSts(domain, dns),
  ])

  const results = {
    spf: spf.status === 'fulfilled' ? spf.value : errorResult<SpfResult>('spf'),
    dkim: dkim.status === 'fulfilled' ? dkim.value : errorResult<DkimResult>('dkim'),
    dmarc: dmarc.status === 'fulfilled' ? dmarc.value : errorResult<DmarcResult>('dmarc'),
    bimi: bimi.status === 'fulfilled' ? bimi.value : errorResult<BimiResult>('bimi'),
    mtaSts: mtaSts.status === 'fulfilled' ? mtaSts.value : errorResult<MtaStsResult>('mta-sts'),
  }

  const issues: Issue[] = [
    ...results.spf.issues,
    ...results.dkim.issues,
    ...results.dmarc.issues,
    ...results.bimi.issues,
    ...results.mtaSts.issues,
  ]

  const recommendations = buildRecommendations(results)
  const score = scoreAudit(issues)

  return {
    domain,
    score,
    ...results,
    issues,
    recommendations,
  }
}

// ── Scoring ──

function scoreAudit(issues: Issue[]): Grade {
  const criticals = issues.filter((i) => i.severity === 'critical').length
  const warnings = issues.filter((i) => i.severity === 'warning').length

  if (criticals >= 3) return 'F'
  if (criticals >= 2) return 'D'
  if (criticals >= 1) return 'C'
  if (warnings >= 3) return 'C'
  if (warnings >= 1) return 'B'
  return 'A'
}

function buildRecommendations(results: {
  spf: SpfResult
  dkim: DkimResult
  dmarc: DmarcResult
  bimi: BimiResult
  mtaSts: MtaStsResult
}): Recommendation[] {
  const recs: Recommendation[] = []
  let priority = 1

  if (!results.dmarc.found || results.dmarc.policy === 'none') {
    recs.push({
      priority: priority++,
      title: 'Strengthen DMARC policy',
      description:
        results.dmarc.policy === 'none'
          ? 'Your DMARC policy is set to "none" — spoofed emails won\'t be blocked. Upgrade to "quarantine" or "reject".'
          : 'No DMARC record found. Add one to protect against email spoofing.',
      command: `arrivd fix dmarc ${results.dmarc.domain || 'your-domain.com'}`,
    })
  }

  if (!results.dkim.found) {
    recs.push({
      priority: priority++,
      title: 'Add DKIM signing',
      description: 'No DKIM record found. Your ESP should provide the DKIM value to add as a DNS record.',
      command: `arrivd fix dkim ${results.dkim.domain || 'your-domain.com'}`,
    })
  }

  if (!results.spf.found) {
    recs.push({
      priority: priority++,
      title: 'Add SPF record',
      description: 'No SPF record found. Add one to specify which servers can send email for your domain.',
    })
  }

  if (results.spf.lookupCount > 10) {
    recs.push({
      priority: priority++,
      title: 'Flatten SPF record',
      description: `Your SPF record uses ${results.spf.lookupCount} DNS lookups (max is 10). Flatten includes to stay within the limit.`,
    })
  }

  if (!results.bimi.found) {
    recs.push({
      priority: priority++,
      title: 'Add BIMI record (optional)',
      description: 'BIMI displays your brand logo in supporting email clients like Gmail.',
    })
  }

  if (!results.mtaSts.found) {
    recs.push({
      priority: priority++,
      title: 'Add MTA-STS policy (optional)',
      description: 'MTA-STS enforces TLS encryption for incoming email.',
    })
  }

  return recs
}

// ── Helpers ──

function errorResult<T>(name: string): T {
  return {
    found: false,
    raw: null,
    issues: [
      {
        severity: 'warning' as const,
        code: `${name.toUpperCase()}_LOOKUP_FAILED`,
        message: `Failed to look up ${name} record`,
      },
    ],
  } as T
}
