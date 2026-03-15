import { auditDomain, NodeDnsResolver } from './dns'
import { formatJson, formatReport } from './report'

// ── CLI ──

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    process.exit(0)
  }

  if (command === '--version' || command === '-v') {
    console.log('arrivd 0.1.1')
    process.exit(0)
  }

  if (command === 'check') {
    const domain = args[1]
    if (!domain) {
      console.error('Usage: arrivd check <domain>')
      process.exit(1)
    }

    const flags = parseFlags(args.slice(2))
    const resolver = new NodeDnsResolver()

    try {
      const result = await auditDomain(domain, resolver)

      if (flags.json) {
        console.log(formatJson(result))
      } else {
        console.log(formatReport(result))
      }

      // Exit with non-zero if critical issues found
      if (flags.ci && (result.score === 'D' || result.score === 'F')) {
        process.exit(1)
      }
    } catch (err) {
      console.error(`Error auditing ${domain}:`, err instanceof Error ? err.message : err)
      process.exit(1)
    }
    return
  }

  if (command === 'fix') {
    const subcommand = args[1]
    const domain = args[2]
    if (!subcommand || !domain) {
      console.error('Usage: arrivd fix <dkim|dmarc|spf> <domain>')
      process.exit(1)
    }
    printFixGuide(subcommand, domain)
    return
  }

  console.error(`Unknown command: ${command}`)
  printHelp()
  process.exit(1)
}

// ── Flags ──

interface CliFlags {
  json: boolean
  ci: boolean
}

function parseFlags(args: string[]): CliFlags {
  return {
    json: args.includes('--json'),
    ci: args.includes('--ci'),
  }
}

// ── Help ──

function printHelp(): void {
  console.log(`
  arrivd — email deliverability audit

  Usage:
    arrivd check <domain>          Audit email authentication records
    arrivd check <domain> --json   Output as JSON
    arrivd check <domain> --ci     Exit with code 1 if score is D or F
    arrivd fix <type> <domain>     Walk through fixing an issue

  Examples:
    npx arrivd check acme.io
    npx arrivd check acme.io --json --ci
    npx arrivd fix dmarc acme.io
`)
}

// ── Fix Guides ──

function printFixGuide(type: string, domain: string): void {
  switch (type) {
    case 'dmarc':
      console.log(`
  Fix DMARC for ${domain}

  Step 1: Start with monitoring (if you don't have DMARC yet)
    Add this TXT record to _dmarc.${domain}:
    v=DMARC1; p=none; rua=mailto:dmarc@${domain}

  Step 2: After 2-4 weeks of monitoring reports, upgrade to quarantine
    v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}

  Step 3: When confident, enforce with reject
    v=DMARC1; p=reject; rua=mailto:dmarc@${domain}; pct=100
`)
      break

    case 'dkim':
      console.log(`
  Fix DKIM for ${domain}

  DKIM is configured through your email service provider (ESP).

  Common ESPs:
    Google Workspace  → Admin Console → Apps → Gmail → Authenticate email
    Resend            → Dashboard → Domains → Add DKIM
    Postmark          → Sender Signatures → DNS Settings
    SendGrid          → Settings → Sender Authentication → Domain Authentication
    Amazon SES        → Verified Identities → DKIM

  Your ESP will give you a CNAME or TXT record to add to your DNS.
`)
      break

    case 'spf':
      console.log(`
  Fix SPF for ${domain}

  If you don't have an SPF record:
    Add this TXT record to ${domain}:
    v=spf1 include:_spf.google.com ~all

    Replace _spf.google.com with your ESP's SPF include.

  If you have too many DNS lookups (>10):
    1. Remove includes for services you no longer use
    2. Use an SPF flattening tool to inline IP addresses
    3. Consider using a single ESP to reduce includes

  Common ESP includes:
    Google:    include:_spf.google.com
    Resend:    include:amazonses.com
    SendGrid:  include:sendgrid.net
    Postmark:  include:spf.mtasv.net
    Mailgun:   include:mailgun.org
`)
      break

    default:
      console.error(`Unknown fix type: ${type}. Available: dmarc, dkim, spf`)
      process.exit(1)
  }
}

main()
