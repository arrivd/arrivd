<p align="center">
  <strong>arrivd</strong>
</p>

<p align="center">
  Deliverability infrastructure for developers.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arrivd/email"><img src="https://img.shields.io/npm/v/@arrivd/email" alt="npm" /></a>
</p>

---

| Package | What it does |
|---------|------------|
| [@arrivd/email](./packages/email) | Audits SPF, DKIM, DMARC, BIMI, MTA-STS |
| [@arrivd/hooks](./packages/hooks) | Delivers webhooks with retry, signing, DLQ |
| [@arrivd/cron](./packages/cron) | Monitors cron jobs with dead man's switch |

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

```typescript
import { auditDomain } from '@arrivd/email'

const result = await auditDomain('acme.io')

result.score        // 'B'
result.spf.found    // true
result.dmarc.policy // 'none'
result.issues       // [{ severity: 'critical', code: 'DMARC_POLICY_NONE', ... }]
```

```bash
# Exit 1 on D or F scores
npx arrivd check your-domain.com --ci

# JSON for pipelines
npx arrivd check your-domain.com --json

# Step-by-step fix guides
arrivd fix dmarc acme.io
```

## Development

```bash
bun install
bun run build
bun run test
bun run lint
bun run typecheck
```

## License

MIT © [Mosr LLC](https://larsmosr.com)
