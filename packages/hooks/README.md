# @arrivd/hooks

Outgoing webhook delivery with retry, signing, and dead letter queue.

> **Coming Soon** — This package is planned for Phase 2. Follow the [GitHub repo](https://github.com/arrivd-dev/arrivd) for updates.

## Install

```bash
npm install @arrivd/hooks
```

## Planned API

```typescript
import { createWebhookSender } from '@arrivd/hooks'

const sender = createWebhookSender({
  signing: { algorithm: 'sha256', header: 'x-webhook-signature' },
  retry: { maxAttempts: 5, backoff: 'exponential' },
  dlq: { onFailure: (event) => console.error('Failed:', event) },
})

await sender.send('https://example.com/hook', {
  event: 'user.created',
  data: { id: 'usr_123', email: 'alice@example.com' },
})
```

## Planned Features

### Webhook Delivery

- HMAC-SHA256 payload signing
- Exponential backoff with jitter (1s → 4s → 16s → 64s → 256s)
- Configurable max retry attempts

### Queue Adapters

- In-memory queue (default)
- Redis adapter
- BullMQ adapter
- Custom queue interface

### Dead Letter Queue

- Failed deliveries moved to DLQ after max retries
- `sender.dlq.list()` — list failed deliveries
- `sender.dlq.retry(id)` — retry a failed delivery
- `sender.dlq.purge()` — clear the DLQ
- `onFailure` callback for alerting

### Subscriber Management

- `sender.subscribe(endpoint, options)` — register endpoint
- `sender.unsubscribe(id)` — remove endpoint
- URL ownership verification (challenge/response)
- Per-subscriber delivery stats

### Framework Middleware

- Express router
- Next.js App Router handlers
- Hono middleware

## License

MIT
