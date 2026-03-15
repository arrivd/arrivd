# @arrivd/hooks

Delivers webhooks with retry, signing, and dead letter queue.

```bash
npm install @arrivd/hooks
```

```typescript
import { createWebhookSender } from '@arrivd/hooks'

const sender = createWebhookSender({
  retry: { maxAttempts: 5 },
  timeout: 10_000,
  onDelivery: (delivery) => console.log('Delivered:', delivery.id),
  onFailure: (entry) => console.error('Failed:', entry.error),
})

sender.subscribe('https://example.com/hook', {
  secret: 'whsec_abc123',
  events: ['user.created', 'user.deleted'],
})

await sender.send({
  event: 'user.created',
  data: { id: 'usr_123', email: 'alice@example.com' },
})
```

## Subscriber Management

```typescript
const sub = sender.subscribe('https://example.com/hook', {
  secret: 'whsec_abc123',
  events: ['user.created'], // omit to receive all events
})

sender.unsubscribe(sub.id)
```

## Dead Letter Queue

```typescript
sender.dlq.list()          // all failed deliveries
sender.dlq.retry('dlq_id') // re-enters full retry cycle
sender.dlq.purge()         // clear all
```

## Stats

```typescript
sender.stats()
// { subscribers: 3, pending: 0, delivered: 142, failed: 2, dlqSize: 1 }
```

## Building Blocks

```typescript
import { signPayload, verifyPayload, buildSignatureHeaders } from '@arrivd/hooks'
import { calculateBackoff } from '@arrivd/hooks'
import { MemoryQueue, DeadLetterQueue } from '@arrivd/hooks'

const signature = await signPayload('{"event":"test"}', 'secret')
// => 'sha256=abc123...'

const valid = await verifyPayload(body, secret, req.headers['x-webhook-signature'])

const headers = await buildSignatureHeaders(body, secret)
// => { 'x-webhook-signature': 'sha256=...', 'x-webhook-timestamp': '...' }
```

## Features

- HMAC-SHA256 signing with timing-safe verification
- Exponential backoff with multiplicative jitter (1s, 2s, 4s, 8s, 16s base x 0.5-1.5)
- 10s fetch timeout on all deliveries
- Fan-out to multiple subscribers per event
- DLQ after max retries — max 1000 entries, FIFO eviction
- In-memory queue default, custom `QueueAdapter` interface for others

## License

MIT
