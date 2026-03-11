import type { Issue } from '@arrivd/core'
import type { DnsResolver } from './dns'
import type { SpfResult } from './types'

// ── SPF Audit ──

export async function auditSpf(domain: string, resolver: DnsResolver): Promise<SpfResult> {
  const records = await resolver.resolveTxt(domain)
  const spfRecords = records.flat().filter((r) => r.toLowerCase().startsWith('v=spf1'))

  if (spfRecords.length === 0) {
    return {
      found: false,
      raw: null,
      domain,
      includes: [],
      lookupCount: 0,
      mechanism: null,
      issues: [
        {
          severity: 'critical',
          code: 'SPF_MISSING',
          message: 'No SPF record found',
          fix: 'Add an SPF record: v=spf1 include:_spf.google.com ~all',
        },
      ],
    }
  }

  const issues: Issue[] = []

  if (spfRecords.length > 1) {
    issues.push({
      severity: 'critical',
      code: 'SPF_MULTIPLE',
      message: `Found ${spfRecords.length} SPF records — only one is allowed per domain`,
      fix: 'Merge all SPF records into a single record',
    })
  }

  const raw = spfRecords[0]
  const includes = extractIncludes(raw)
  const mechanism = extractMechanism(raw)
  const lookupCount = await countLookups(raw, resolver)

  if (lookupCount > 10) {
    issues.push({
      severity: 'critical',
      code: 'SPF_TOO_MANY_LOOKUPS',
      message: `SPF record requires ${lookupCount} DNS lookups (maximum is 10)`,
      fix: 'Flatten SPF includes or remove unused ones',
    })
  } else if (lookupCount > 7) {
    issues.push({
      severity: 'warning',
      code: 'SPF_LOOKUP_HIGH',
      message: `SPF record uses ${lookupCount}/10 DNS lookups — approaching the limit`,
    })
  }

  if (mechanism === '+all') {
    issues.push({
      severity: 'critical',
      code: 'SPF_PLUS_ALL',
      message: 'SPF record ends with "+all" — this allows any server to send email as your domain',
      fix: 'Change +all to ~all (softfail) or -all (hardfail)',
    })
  }

  if (mechanism === '?all') {
    issues.push({
      severity: 'warning',
      code: 'SPF_NEUTRAL',
      message: 'SPF record ends with "?all" (neutral) — provides no protection',
      fix: 'Change ?all to ~all (softfail) or -all (hardfail)',
    })
  }

  return { found: true, raw, domain, includes, lookupCount, mechanism, issues }
}

// ── Helpers ──

function extractIncludes(spf: string): string[] {
  const matches = spf.match(/include:([^\s]+)/g) || []
  return matches.map((m) => m.replace('include:', ''))
}

function extractMechanism(spf: string): string | null {
  const match = spf.match(/([+\-~?]?all)\s*$/)
  return match ? match[1] : null
}

const MAX_SPF_LOOKUPS = 20

async function countLookups(spf: string, resolver: DnsResolver, depth = 0, total = { count: 0 }): Promise<number> {
  if (depth > 10 || total.count >= MAX_SPF_LOOKUPS) return 0

  let count = 0
  const parts = spf.split(/\s+/)

  for (const part of parts) {
    if (total.count >= MAX_SPF_LOOKUPS) break

    // These mechanisms require DNS lookups
    if (part.startsWith('include:')) {
      count++
      total.count++
      const domain = part.replace('include:', '')
      const records = await resolver.resolveTxt(domain)
      const nested = records.flat().find((r) => r.toLowerCase().startsWith('v=spf1'))
      if (nested) {
        count += await countLookups(nested, resolver, depth + 1, total)
      }
    } else if (part.startsWith('a:') || part === 'a') {
      count++
      total.count++
    } else if (part.startsWith('mx:') || part === 'mx') {
      count++
      total.count++
    } else if (part.startsWith('ptr:') || part === 'ptr') {
      count++
      total.count++
    } else if (part.startsWith('exists:')) {
      count++
      total.count++
    } else if (part.startsWith('redirect=')) {
      count++
      total.count++
    }
  }

  return count
}
