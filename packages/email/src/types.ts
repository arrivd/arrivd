import type { Grade, Issue, Recommendation } from '@arrivd/core'

// ── Audit Result ──

export interface DnsAuditResult {
  domain: string
  score: Grade
  spf: SpfResult
  dkim: DkimResult
  dmarc: DmarcResult
  bimi: BimiResult
  mtaSts: MtaStsResult
  issues: Issue[]
  recommendations: Recommendation[]
}

// ── SPF ──

export interface SpfResult {
  found: boolean
  raw: string | null
  domain?: string
  includes: string[]
  lookupCount: number
  mechanism: string | null
  issues: Issue[]
}

// ── DKIM ──

export interface DkimResult {
  found: boolean
  raw: string | null
  domain?: string
  selector: string | null
  keyType: string | null
  keyLength: number | null
  issues: Issue[]
}

// ── DMARC ──

export interface DmarcResult {
  found: boolean
  raw: string | null
  domain?: string
  policy: 'none' | 'quarantine' | 'reject' | null
  subdomainPolicy: 'none' | 'quarantine' | 'reject' | null
  rua: string | null
  ruf: string | null
  pct: number
  issues: Issue[]
}

// ── BIMI ──

export interface BimiResult {
  found: boolean
  raw: string | null
  logoUrl: string | null
  certificateUrl: string | null
  issues: Issue[]
}

// ── MTA-STS ──

export interface MtaStsResult {
  found: boolean
  raw: string | null
  mode: 'enforce' | 'testing' | 'none' | null
  maxAge: number | null
  issues: Issue[]
}
