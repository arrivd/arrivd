import type { Issue } from '@arrivd/core'
import type { DnsResolver } from './dns'
import type { MtaStsResult } from './types'

// ── MTA-STS Audit ──

export async function auditMtaSts(domain: string, resolver: DnsResolver): Promise<MtaStsResult> {
  const stsDomain = `_mta-sts.${domain}`
  const records = await resolver.resolveTxt(stsDomain)
  const flat = records.flat().join(' ')

  if (!flat || !flat.includes('v=STSv1')) {
    return {
      found: false,
      raw: null,
      mode: null,
      maxAge: null,
      issues: [
        {
          severity: 'info',
          code: 'MTA_STS_MISSING',
          message: 'No MTA-STS record found — inbound email may not enforce TLS',
        },
      ],
    }
  }

  const issues: Issue[] = []

  // Try fetching the policy file
  let mode: MtaStsResult['mode'] = null
  let maxAge: number | null = null

  try {
    const policyUrl = `https://mta-sts.${domain}/.well-known/mta-sts.txt`

    // SSRF guard: resolve the hostname and reject private/reserved IPs
    const hostname = `mta-sts.${domain}`
    if (await isPrivateHost(hostname)) {
      issues.push({
        severity: 'warning',
        code: 'MTA_STS_PRIVATE_IP',
        message: 'MTA-STS hostname resolves to a private/reserved IP — skipping fetch',
      })
      return { found: true, raw: flat, mode, maxAge, issues }
    }

    const res = await fetch(policyUrl, { signal: AbortSignal.timeout(5000) })

    if (res.ok) {
      const contentLength = Number(res.headers.get('content-length') || 0)
      if (contentLength > 100_000) {
        issues.push({
          severity: 'warning',
          code: 'MTA_STS_POLICY_TOO_LARGE',
          message: 'MTA-STS policy file exceeds 100KB — skipping parse',
        })
        return { found: true, raw: flat, mode, maxAge, issues }
      }
      const text = await res.text()
      const modeMatch = text.match(/mode:\s*(\w+)/)
      if (modeMatch) {
        const raw = modeMatch[1].toLowerCase()
        if (raw === 'enforce' || raw === 'testing' || raw === 'none') mode = raw
      }

      const maxAgeMatch = text.match(/max_age:\s*(\d+)/)
      if (maxAgeMatch) maxAge = Number.parseInt(maxAgeMatch[1], 10)

      if (mode === 'testing') {
        issues.push({
          severity: 'warning',
          code: 'MTA_STS_TESTING',
          message: 'MTA-STS is in testing mode — TLS failures are reported but not enforced',
          fix: 'Change mode to "enforce" when ready',
        })
      }

      if (mode === 'none') {
        issues.push({
          severity: 'warning',
          code: 'MTA_STS_NONE',
          message: 'MTA-STS mode is "none" — policy is disabled',
        })
      }
    } else {
      issues.push({
        severity: 'warning',
        code: 'MTA_STS_POLICY_UNREACHABLE',
        message: `MTA-STS DNS record found but policy file returned HTTP ${res.status}`,
        fix: `Ensure https://mta-sts.${domain}/.well-known/mta-sts.txt is accessible`,
      })
    }
  } catch {
    issues.push({
      severity: 'warning',
      code: 'MTA_STS_POLICY_TIMEOUT',
      message: 'MTA-STS DNS record found but policy file could not be fetched',
    })
  }

  return { found: true, raw: flat, mode, maxAge, issues }
}

// ── Helpers ──

const PRIVATE_RANGES = [
  /^127\./, // loopback
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^169\.254\./, // link-local
  /^0\./, // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGN 100.64.0.0/10
  /^::1$/, // IPv6 loopback
  /^f[cd]/, // IPv6 ULA
  /^fe80:/, // IPv6 link-local
]

async function isPrivateHost(hostname: string): Promise<boolean> {
  try {
    const { resolve } = await import('node:dns/promises')
    const addresses = await resolve(hostname)
    return addresses.some((addr) => PRIVATE_RANGES.some((re) => re.test(addr)))
  } catch {
    return false
  }
}
