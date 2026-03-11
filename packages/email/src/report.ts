import type { DnsAuditResult } from './types'

// ── ANSI Colors ──

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

const GRADE_COLORS: Record<string, string> = {
  A: c.green,
  B: c.green,
  C: c.yellow,
  D: c.red,
  F: c.red,
}

// ── Report Generator ──

export function formatReport(result: DnsAuditResult): string {
  const lines: string[] = []
  const gradeColor = GRADE_COLORS[result.score] || c.reset

  lines.push('')
  lines.push(`  ${c.bold}arrivd${c.reset} ${c.dim}— email deliverability audit${c.reset}`)
  lines.push('')
  lines.push(`  Domain: ${c.bold}${result.domain}${c.reset}`)
  lines.push(`  Score:  ${gradeColor}${c.bold}${result.score}${c.reset} ${gradeLabel(result.score)}`)
  lines.push('')

  // SPF
  if (result.spf.found) {
    lines.push(`  ${c.green}✓${c.reset} SPF     ${c.dim}${result.spf.raw}${c.reset}`)
    lines.push(
      `            ${result.spf.lookupCount}/10 DNS lookups — ${result.spf.lookupCount <= 7 ? 'OK' : result.spf.lookupCount <= 10 ? 'close to limit' : 'OVER LIMIT'}`,
    )
  } else {
    lines.push(`  ${c.red}✗${c.reset} SPF     No SPF record found`)
    lines.push(`            ${c.dim}→ Add an SPF record to specify allowed senders${c.reset}`)
  }
  lines.push('')

  // DKIM
  if (result.dkim.found) {
    const selectorInfo = result.dkim.selector ? `selector: ${result.dkim.selector}` : ''
    const dkimRaw = result.dkim.raw ? result.dkim.raw.slice(0, 60) + (result.dkim.raw.length > 60 ? '...' : '') : ''
    lines.push(`  ${c.green}✓${c.reset} DKIM    ${c.dim}${dkimRaw}${c.reset}`)
    if (selectorInfo) lines.push(`            ${selectorInfo}`)
  } else {
    lines.push(`  ${c.red}✗${c.reset} DKIM    No DKIM record found for common selectors`)
    lines.push(`            ${c.dim}→ Add a DKIM record. Your ESP should provide the value.${c.reset}`)
  }
  lines.push('')

  // DMARC
  if (result.dmarc.found) {
    const icon =
      result.dmarc.policy === 'reject'
        ? `${c.green}✓`
        : result.dmarc.policy === 'quarantine'
          ? `${c.yellow}⚠`
          : `${c.red}✗`
    lines.push(`  ${icon}${c.reset} DMARC   ${c.dim}${result.dmarc.raw}${c.reset}`)
    if (result.dmarc.policy === 'none') {
      lines.push(`            Policy is "none" — emails from spoofed senders won't be blocked.`)
      lines.push(`            ${c.dim}→ Change to p=quarantine (or p=reject when confident)${c.reset}`)
    } else {
      lines.push(`            Policy: ${result.dmarc.policy}`)
    }
  } else {
    lines.push(`  ${c.red}✗${c.reset} DMARC   No DMARC record found`)
    lines.push(`            ${c.dim}→ Add a DMARC record to protect against spoofing${c.reset}`)
  }
  lines.push('')

  // BIMI
  if (result.bimi.found) {
    const bimiRaw = result.bimi.raw ? result.bimi.raw.slice(0, 60) : ''
    lines.push(`  ${c.green}✓${c.reset} BIMI    ${c.dim}${bimiRaw}${c.reset}`)
  } else {
    lines.push(`  ${c.gray}○${c.reset} BIMI    ${c.dim}No BIMI record found${c.reset}`)
    lines.push(`            ${c.dim}→ Optional but recommended: shows your logo in Gmail inbox${c.reset}`)
  }
  lines.push('')

  // MTA-STS
  if (result.mtaSts.found) {
    lines.push(`  ${c.green}✓${c.reset} MTA-STS Policy found, mode: ${result.mtaSts.mode || 'unknown'}`)
  } else {
    lines.push(`  ${c.gray}○${c.reset} MTA-STS ${c.dim}No MTA-STS policy found${c.reset}`)
    lines.push(`            ${c.dim}→ Optional: enforces TLS for inbound email${c.reset}`)
  }
  lines.push('')

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push(`  ${c.bold}Fix commands:${c.reset}`)
    for (const rec of result.recommendations) {
      if (rec.command) {
        lines.push(`    ${c.cyan}${rec.command}${c.reset}     ${c.dim}# ${rec.title.toLowerCase()}${c.reset}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── JSON Report ──

export function formatJson(result: DnsAuditResult): string {
  return JSON.stringify(result, null, 2)
}

// ── Helpers ──

function gradeLabel(grade: string): string {
  switch (grade) {
    case 'A':
      return '(excellent)'
    case 'B':
      return '(good)'
    case 'C':
      return '(needs work)'
    case 'D':
      return '(poor)'
    case 'F':
      return '(critical issues)'
    default:
      return ''
  }
}
