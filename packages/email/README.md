# @arrivd/email

Email deliverability audit — SPF, DKIM, DMARC, BIMI, MTA-STS checks in one command.

## Install

```bash
npm install @arrivd/email
```

## CLI

```bash
npx arrivd check acme.io
```

```
  arrivd — email deliverability audit

  Domain: acme.io
  Score:  B (good)

  ✓ SPF     v=spf1 include:_spf.google.com ~all
            4/10 DNS lookups — OK

  ✓ DKIM    selector: google
            v=DKIM1; k=rsa; p=MIIBIjAN...

  ✗ DMARC   v=DMARC1; p=none; rua=mailto:dmarc@acme.io
            Policy is "none" — upgrade to p=quarantine or p=reject

  ○ BIMI    No BIMI record found
  ✓ MTA-STS Policy found, mode: enforce
```

### Commands

| Command | Description |
|---------|-------------|
| `arrivd check <domain>` | Run full audit |
| `arrivd fix <dkim\|dmarc\|spf> <domain>` | Print fix guide |

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output JSON |
| `--ci` | Exit 1 if score is D or F |
| `--help`, `-h` | Help |
| `--version`, `-v` | Version |

## Programmatic API

```typescript
import { auditDomain, formatReport } from '@arrivd/email'

const result = await auditDomain('acme.io')

console.log(result.score)          // 'B'
console.log(result.spf.found)      // true
console.log(result.dmarc.policy)   // 'none'
console.log(result.issues)         // [{ severity: 'critical', code: 'DMARC_POLICY_NONE', ... }]

console.log(formatReport(result))  // Human-readable output
```

### Individual Audits

```typescript
import { auditSpf, auditDkim, auditDmarc, auditBimi, auditMtaSts } from '@arrivd/email'

const spf = await auditSpf('acme.io')
const dkim = await auditDkim('acme.io')
const dmarc = await auditDmarc('acme.io')
const bimi = await auditBimi('acme.io')
const mtaSts = await auditMtaSts('acme.io')
```

### Custom DNS Resolver

```typescript
import { auditDomain, createResolver } from '@arrivd/email'

const resolver = createResolver('doh')  // DNS-over-HTTPS (Cloudflare)
const result = await auditDomain('acme.io', resolver)
```

## Continuous Monitoring

```typescript
import { createWatcher } from '@arrivd/email'

const watcher = createWatcher({
  domains: ['acme.io', 'brand.com'],
  intervalMs: 300_000, // 5 minutes
  alerts: {
    slack: { webhookUrl: process.env.SLACK_WEBHOOK },
  },
  onChange: (domain, prev, next) => {
    console.log(`${domain} changed: ${prev.score} → ${next.score}`)
  },
})

await watcher.start()
```

## What Gets Checked

### SPF

- Missing or multiple SPF records
- DNS lookup count (>10 = critical, >7 = warning)
- Permissive mechanisms (`+all`, `?all`)

### DKIM

- Common selectors: `google`, `default`, `selector1`, `selector2`, `k1`, `mandrill`, etc.
- Key strength (<1024 bits = critical, <2048 bits = warning)
- Revoked keys (empty `p=` tag)

### DMARC

- Missing record
- Policy strength (`none` = critical, `quarantine` = info)
- Reporting (`rua` tag missing = warning)
- Percentage (`pct` < 100 = warning)

### BIMI

- Missing record (info)
- Missing logo URL (warning)
- Missing VMC certificate (info)

### MTA-STS

- Missing record (info)
- Policy fetch issues (warning)
- Testing or none mode (warning)

## Grade Scale

| Grade | Condition |
|-------|-----------|
| A | No critical issues, no warnings |
| B | No critical issues, 1–2 warnings |
| C | 1 critical issue or 3+ warnings |
| D | 2 critical issues |
| F | 3+ critical issues |

## License

MIT
