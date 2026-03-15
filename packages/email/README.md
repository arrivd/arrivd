# @arrivd/email

Audits your domain's email authentication. SPF, DKIM, DMARC, BIMI, MTA-STS.

```bash
npm install @arrivd/email
```

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

```typescript
import { auditDomain, formatReport } from '@arrivd/email'

const result = await auditDomain('acme.io')

result.score        // 'B'
result.spf.found    // true
result.dmarc.policy // 'none'
result.issues       // [{ severity: 'critical', code: 'DMARC_POLICY_NONE', ... }]

formatReport(result) // human-readable output
```

## CLI

| Command | |
|---------|--|
| `arrivd check <domain>` | Run full audit |
| `arrivd fix <dkim\|dmarc\|spf> <domain>` | Print fix guide |
| `--json` | JSON output |
| `--ci` | Exit 1 on D or F scores |

## Individual Audits

```typescript
import { auditSpf, auditDkim, auditDmarc, auditBimi, auditMtaSts } from '@arrivd/email'

const spf = await auditSpf('acme.io')
const dkim = await auditDkim('acme.io')
const dmarc = await auditDmarc('acme.io')
const bimi = await auditBimi('acme.io')
const mtaSts = await auditMtaSts('acme.io')
```

## Custom DNS Resolver

```typescript
import { auditDomain, createResolver } from '@arrivd/email'

const resolver = createResolver('doh') // DNS-over-HTTPS (Cloudflare)
const result = await auditDomain('acme.io', resolver)
```

## Continuous Monitoring

```typescript
import { createWatcher } from '@arrivd/email'

const watcher = createWatcher({
  domains: ['acme.io', 'brand.com'],
  intervalMs: 300_000,
  alerts: { slack: { webhookUrl: process.env.SLACK_WEBHOOK } },
  onChange: (domain, prev, next) => {
    console.log(`${domain}: ${prev.score} → ${next.score}`)
  },
})

await watcher.start()
```

## What Gets Checked

- SPF — missing/multiple records, DNS lookup count (>10 critical, >7 warning), permissive `+all`
- DKIM — 26 common selectors, key strength (<1024b critical, <2048b warning), revoked keys
- DMARC — missing record, policy strength, `rua` reporting, `pct` percentage
- BIMI — missing record, logo URL, VMC certificate
- MTA-STS — missing record, policy fetch, testing/none mode

## Grade Scale

| Grade | Condition |
|-------|-----------|
| A | No critical issues, no warnings |
| B | No critical issues, 1-2 warnings |
| C | 1 critical issue or 3+ warnings |
| D | 2 critical issues |
| F | 3+ critical issues |

## License

MIT
