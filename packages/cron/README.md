# @arrivd/cron

Monitors cron jobs. Alerts on missed runs, timeouts, and failures.

```bash
npm install @arrivd/cron
```

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

await job()

job.lastRun  // { status: 'success', duration: 12340, ... }
job.history  // all runs
```

## Dead Man's Switch

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
scheduler.checkIn('daily-report')
```

## Cron Utilities

```typescript
import { nextRun, previousRun, parseDuration } from '@arrivd/cron'

nextRun('0 9 * * *')     // next Date matching the expression
previousRun('0 9 * * *') // most recent Date that matched
parseDuration('30m')     // 1_800_000 (ms)
```

## Features

- Wraps any async function with start/success/failure/duration reporting
- Dead man's switch — alerts if job doesn't check in within expected window
- Timeout detection — fires alert when job exceeds duration limit (non-killing)
- Per-window deduplication — only alerts once per missed window
- Configurable grace period per job
- Run history with status and duration

## License

MIT
