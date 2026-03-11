# @arrivd/core

Shared types, config, event reporting, and alert routing for arrivd modules.

## Install

```bash
npm install @arrivd/core
```

## Features

- **Event reporting** — Local and cloud reporters for audit events
- **Alert routing** — Send alerts to Slack and webhooks
- **Shared types** — Common types for issues, grades, and recommendations
- **Utilities** — ID generation, timing, string truncation, grade calculation

## Usage

### Event Reporting

```typescript
import { createReporter, createEvent } from '@arrivd/core'

const reporter = createReporter({
  projectId: 'my-project',
  endpoint: 'https://api.arrivd.dev',
})

await reporter.report(createEvent('email', 'pass', 'SPF check passed'))
await reporter.flush()
```

### Alert Routing

```typescript
import { sendAlert, createEvent } from '@arrivd/core'

await sendAlert(
  {
    slack: { webhookUrl: process.env.SLACK_WEBHOOK },
    webhook: { url: 'https://example.com/hook', secret: 'sk_...' },
  },
  createEvent('email', 'warn', 'DMARC policy downgraded', { domain: 'acme.io' })
)
```

### Grade Calculation

```typescript
import { calculateGrade } from '@arrivd/core'

const grade = calculateGrade([
  { severity: 'critical', code: 'DMARC_POLICY_NONE', message: '...' },
  { severity: 'warning', code: 'SPF_LOOKUP_HIGH', message: '...' },
])
// => 'C'
```

## API

### Functions

| Export | Description |
|--------|-------------|
| `createReporter(config)` | Create a reporter (cloud or local based on config) |
| `createEvent(channel, status, message, details?)` | Build an `ArrivdEvent` |
| `sendAlert(alertConfig, event)` | Send alerts to Slack and/or webhooks |
| `calculateGrade(issues)` | Calculate grade (A–F) from issues |
| `generateId()` | Generate a UUID |
| `now()` | High-resolution timestamp |
| `truncate(str, max?)` | Truncate string with suffix |

### Classes

| Export | Description |
|--------|-------------|
| `LocalReporter` | In-memory reporter with optional verbose logging |
| `CloudReporter` | Batched HTTP reporter with retry |

### Types

| Export | Description |
|--------|-------------|
| `ArrivdConfig` | Main config: `projectId`, `alerts`, `endpoint`, `verbose` |
| `AlertConfig` | Alert targets: `slack`, `email`, `webhook` |
| `ArrivdEvent` | Event: `id`, `timestamp`, `channel`, `status`, `message` |
| `Channel` | `'email' \| 'webhook' \| 'cron'` |
| `Status` | `'pass' \| 'fail' \| 'warn' \| 'skip'` |
| `Severity` | `'critical' \| 'warning' \| 'info'` |
| `Grade` | `'A' \| 'B' \| 'C' \| 'D' \| 'F'` |
| `Issue` | Issue with `severity`, `code`, `message`, optional `fix` |
| `Recommendation` | Recommendation with `priority`, `title`, `description` |
| `Reporter` | Reporter interface: `report(event)`, `flush()` |
| `MonitorOptions` | Monitor config: `name`, `channel`, `schedule`, `timeout` |

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
