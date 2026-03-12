# @arrivd/hooks

Outgoing webhook delivery with retry, signing, and dead letter queue.

## Install

```bash
npm install @arrivd/hooks
```

## Quick Start

```typescript
import { createWebhookSender } from '@arrivd/hooks'

const sender = createWebhookSender({
  retry: { maxAttempts: 5 },
  timeout: 10_000,
  onDelivery: (delivery) => console.log('Delivered:', delivery.id),
  onFailure: (entry) => console.error('Failed:', entry.error),
})

// Register endpoints — secrets are per-subscriber
const sub = sender.subscribe('https://example.com/hook', {
  secret: 'whsec_abc123',
  events: ['user.created', 'user.deleted'],
})

// Send fans out to all subscribers matching the event
const deliveries = await sender.send({
  event: 'user.created',
  data: { id: 'usr_123', email: 'alice@example.com' },
})
```

## Subscriber Management

```typescript
// Subscribe — returns subscriber with generated ID
const sub = sender.subscribe('https://example.com/hook', {
  secret: 'whsec_abc123',
  events: ['user.created'],  // omit to receive all events
})

// Unsubscribe
sender.unsubscribe(sub.id)
```

## Dead Letter Queue

Failed deliveries (after all retries exhausted) are moved to the DLQ.

```typescript
sender.dlq.list()           // list all failed deliveries
sender.dlq.retry('dlq_id')  // re-enters full retry cycle
sender.dlq.purge()          // clear all entries
```

## Stats

```typescript
sender.stats()
// { subscribers: 3, pending: 0, delivered: 142, failed: 2, dlqSize: 1 }
```

## Building Blocks

Individual modules are exported for advanced use:

```typescript
import { signPayload, verifyPayload, buildSignatureHeaders } from '@arrivd/hooks'
import { calculateBackoff } from '@arrivd/hooks'
import { MemoryQueue } from '@arrivd/hooks'
import { DeadLetterQueue } from '@arrivd/hooks'
```

### Signing

```typescript
// Sign a payload
const signature = await signPayload('{"event":"test"}', 'secret')
// => 'sha256=abc123...'

// Verify incoming webhook
const valid = await verifyPayload(body, secret, req.headers['x-webhook-signature'])

// Build headers for outgoing request
const headers = await buildSignatureHeaders(body, secret)
// => { 'x-webhook-signature': 'sha256=...', 'x-webhook-timestamp': '1234567890' }
```

## Features

### Webhook Delivery

- HMAC-SHA256 payload signing with timing-safe verification
- Signature and timestamp headers on every request
- Fan-out to multiple subscribers per event
- Event filtering per subscriber

### Retry

- Exponential backoff with jitter (1s, 4s, 16s, 64s, 256s)
- Configurable max retry attempts (default: 5)
- 10s fetch timeout with `AbortSignal`

### Dead Letter Queue

- Failed deliveries moved to DLQ after max retries
- Retry re-enters the full retry cycle
- List, retry, and purge operations
- `onFailure` callback for alerting

### Queue Adapters

- In-memory queue (default)
- Custom queue interface (`QueueAdapter`) for future adapters

## Coming Soon

- Redis and BullMQ queue adapters
- URL ownership verification (challenge/response)
- Per-subscriber delivery stats
- Framework middleware (Express, Next.js, Hono)

## License

MIT
