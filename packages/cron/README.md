# @arrivd/cron

Cron job monitoring with dead man's switch and timeout detection.

## Install

```bash
npm install @arrivd/cron
```

## Quick Start

```typescript
import { monitor } from '@arrivd/cron'

const job = monitor('daily-report', async () => {
  await generateReport()
  await sendEmails()
}, {
  schedule: '0 9 * * *',
  timeout: '30m',
  gracePeriod: '5m',
  onCheckIn: (name) => console.log(`${name} checked in`),
})

// Run it — errors re-throw after reporting
await job()

// Inspect history
console.log(job.lastRun)  // { status: 'success', duration: 12340, ... }
console.log(job.history)  // all runs
```

## Dead Man's Switch

Use `createScheduler()` to monitor whether jobs check in on time:

```typescript
import { createScheduler } from '@arrivd/cron'

const scheduler = createScheduler({
  jobs: [
    { name: 'daily-report', schedule: '0 9 * * *', gracePeriod: '5m' },
    { name: 'nightly-sync', schedule: '0 2 * * *' },
  ],
  checkIntervalMs: 60_000,
  onMiss: (name, expectedAt, now) => {
    console.error(`${name} missed — expected at ${expectedAt}`)
  },
})

scheduler.start()

// Call this from your job when it runs successfully
scheduler.checkIn('daily-report')
```

## Features

### Job Wrapper

- `monitor(name, fn, options)` — wraps any async function with auto-reporting
- Reports start, success, failure, and duration
- Captures error details on failure, re-throws transparently
- Run history accessible via `job.history` and `job.lastRun`

### Dead Man's Switch

- Declare expected schedule via cron expression
- Alert if job doesn't check in within the expected window
- Configurable grace period (e.g. `'5m'`, `'1h'`)
- Per-window deduplication — only alerts once per missed window

### Timeout Detection

- `timeout: '30m'` — fires alert if job exceeds expected duration
- Job continues running (non-killing by default)

### Cron Utilities

```typescript
import { nextRun, previousRun, parseDuration } from '@arrivd/cron'

nextRun('0 9 * * *')              // next Date matching the expression
previousRun('0 9 * * *')          // most recent Date that matched
parseDuration('30m')              // 1_800_000 (ms)
```

## Coming Soon

- Kill support for long-running jobs (AbortController)
- Vercel Cron adapter
- Cloudflare Workers scheduled handler adapter
- Generic `node-cron` wrapper

## License

MIT
