<p align="center">
  <strong>arrivd</strong>
</p>

<p align="center">
  Deliverability infrastructure for developers. Did it arrive?
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arrivd/email"><img src="https://img.shields.io/npm/v/@arrivd/email" alt="npm" /></a>
</p>

---

## Packages

| Package | Description |
|---------|------------|
| [@arrivd/email](./packages/email) | Email deliverability audit — SPF, DKIM, DMARC, BIMI, MTA-STS |
| [@arrivd/hooks](./packages/hooks) | Outgoing webhook delivery with retry, signing, and dead letter queue |
| [@arrivd/cron](./packages/cron) | Cron job monitoring with dead man's switch |

## Quick Start

```bash
npx arrivd check your-domain.com
```

```
  arrivd — email deliverability audit

  Domain: your-domain.com
  Score:  B (good)

  ✓ SPF     v=spf1 include:_spf.google.com ~all
            4/10 DNS lookups — OK

  ✓ DKIM    selector: google
            v=DKIM1; k=rsa; p=MIIBIjAN...

  ✗ DMARC   v=DMARC1; p=none; rua=mailto:dmarc@your-domain.com
            Policy is "none" — upgrade to p=quarantine or p=reject

  ○ BIMI    No BIMI record found
  ✓ MTA-STS Policy found, mode: enforce
```

## Programmatic API

```typescript
import { auditDomain } from '@arrivd/email'

const result = await auditDomain('acme.io')

console.log(result.score)          // 'B'
console.log(result.spf.found)      // true
console.log(result.dmarc.policy)   // 'none'
console.log(result.issues)         // [{ severity: 'critical', code: 'DMARC_POLICY_NONE', ... }]
```

## CI/CD Integration

```bash
# Fails with exit code 1 if score is D or F
npx arrivd check your-domain.com --ci

# JSON output for pipelines
npx arrivd check your-domain.com --json
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

## Fix Guides

```bash
arrivd fix dmarc acme.io    # step-by-step DMARC upgrade
arrivd fix dkim acme.io     # walk through DKIM setup
arrivd fix spf acme.io      # SPF record guidance
```

## Development

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run test         # Run tests
bun run lint         # Lint (Biome)
bun run typecheck    # Type check
```

## License

MIT © [Mosr LLC](https://larsmosr.com)
