import type { AlertConfig } from '@arrivd/core'
import { createEvent, sendAlert } from '@arrivd/core'
import { auditDomain, createResolver, type DnsResolver } from './dns'
import type { DnsAuditResult } from './types'

// ── Watch Config ──

export interface WatchConfig {
  domains: string[]
  intervalMs?: number
  alerts?: AlertConfig
  resolver?: DnsResolver
  onChange?: (domain: string, prev: DnsAuditResult, next: DnsAuditResult) => void
}

// ── Watcher ──

export function createWatcher(config: WatchConfig) {
  const resolver = config.resolver ?? createResolver()
  const intervalMs = config.intervalMs ?? 300_000 // 5 minutes
  const snapshots = new Map<string, DnsAuditResult>()
  let timer: ReturnType<typeof setInterval> | null = null
  let polling = false

  async function poll(): Promise<void> {
    if (polling) return
    polling = true
    try {
      const activeDomains = new Set(config.domains)

      // Prune snapshots for domains no longer in the config
      for (const domain of snapshots.keys()) {
        if (!activeDomains.has(domain)) snapshots.delete(domain)
      }

      for (const domain of config.domains) {
        try {
          const result = await auditDomain(domain, resolver)
          const prev = snapshots.get(domain)

          if (prev && hasChanged(prev, result)) {
            config.onChange?.(domain, prev, result)

            // Alert if score degraded
            if (config.alerts && isWorse(prev.score, result.score)) {
              await sendAlert(
                config.alerts,
                createEvent('email', 'warn', `${domain} score degraded: ${prev.score} → ${result.score}`, {
                  domain,
                  previousScore: prev.score,
                  currentScore: result.score,
                  newIssues: result.issues.filter((i) => !prev.issues.some((p) => p.code === i.code)),
                }),
              )
            }
          }

          snapshots.set(domain, result)
        } catch {
          // Silently skip failed polls
        }
      }
    } finally {
      polling = false
    }
  }

  return {
    async start(): Promise<void> {
      if (timer) return
      await poll()
      timer = setInterval(poll, intervalMs)
    },

    stop(): void {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },

    getSnapshot(domain: string): DnsAuditResult | undefined {
      return snapshots.get(domain)
    },

    async pollNow(): Promise<void> {
      await poll()
    },
  }
}

// ── Helpers ──

function hasChanged(a: DnsAuditResult, b: DnsAuditResult): boolean {
  return (
    a.score !== b.score ||
    a.spf.raw !== b.spf.raw ||
    a.dkim.raw !== b.dkim.raw ||
    a.dmarc.raw !== b.dmarc.raw ||
    a.bimi.raw !== b.bimi.raw ||
    a.mtaSts.raw !== b.mtaSts.raw
  )
}

const GRADE_ORDER = ['A', 'B', 'C', 'D', 'F']

function isWorse(prev: string, next: string): boolean {
  return GRADE_ORDER.indexOf(next) > GRADE_ORDER.indexOf(prev)
}
