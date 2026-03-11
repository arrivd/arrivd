# @arrivd/cron

Cron job monitoring with dead man's switch and timeout detection.

> **Coming Soon** — This package is planned for Phase 3. Follow the [GitHub repo](https://github.com/arrivd-dev/arrivd) for updates.

## Install

```bash
npm install @arrivd/cron
```

## Planned API

```typescript
import { monitor } from '@arrivd/cron'

await monitor('daily-report', async () => {
  // job logic
  await generateReport()
  await sendEmails()
}, {
  schedule: '0 9 * * *',      // expected schedule
  timeout: '30m',              // max duration
  alertOnMiss: true,           // alert if job doesn't run
})
```

## Planned Features

### Job Wrapper

- `monitor(name, fn, options)` — wrap any async function
- Auto-report start, end, fail, and duration
- Capture error details on failure

### Dead Man's Switch

- Declare expected schedule (cron expression)
- Alert if job doesn't check in within expected window
- Configurable grace period

### Timeout Detection

- Set max expected duration
- Alert if job exceeds timeout
- Optional kill support for long-running jobs

### Framework Adapters

- Vercel Cron handler wrapper
- Cloudflare Workers scheduled handler
- Generic `node-cron` wrapper

## Configuration

```typescript
interface MonitorOptions {
  name: string
  schedule?: string      // cron expression
  timeout?: string       // e.g. '30m', '1h'
  alertOnMiss?: boolean  // default: true
}
```

## License

MIT
