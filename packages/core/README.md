# @arrivd/core

Shared types, event reporting, and alert routing for arrivd packages.

```bash
npm install @arrivd/core
```

```typescript
import { createReporter, createEvent, sendAlert } from '@arrivd/core'

const reporter = createReporter({ projectId: 'my-project' })
await reporter.report(createEvent('email', 'pass', 'SPF check passed'))
await reporter.flush()

await sendAlert(
  { slack: { webhookUrl: process.env.SLACK_WEBHOOK } },
  createEvent('email', 'warn', 'DMARC policy downgraded', { domain: 'acme.io' })
)
```

```typescript
import { calculateGrade } from '@arrivd/core'

calculateGrade([
  { severity: 'critical', code: 'DMARC_POLICY_NONE', message: '...' },
  { severity: 'warning', code: 'SPF_LOOKUP_HIGH', message: '...' },
])
// => 'C'
```

## Features

- Event reporting — local in-memory or batched cloud reporter
- Alert routing — Slack and webhook targets
- Grade calculation — A through F based on issue severity
- Utilities — ID generation, timestamps, string truncation

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
