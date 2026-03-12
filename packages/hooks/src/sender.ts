import { generateId } from '@arrivd/core'
import { calculateBackoff } from './backoff'
import { DeadLetterQueue } from './dlq'
import { MemoryQueue } from './queue'
import { buildSignatureHeaders } from './signer'
import type {
  DlqEntry,
  QueueAdapter,
  SenderStats,
  SubscribeOptions,
  Subscriber,
  WebhookDelivery,
  WebhookEvent,
  WebhookSender,
  WebhookSenderConfig,
} from './types'

// ── Helpers ──

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_TIMEOUT = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Sender ──

export function createWebhookSender(config: WebhookSenderConfig = {}): WebhookSender {
  const maxAttempts = config.retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const timeout = config.timeout ?? DEFAULT_TIMEOUT
  const subscribers = new Map<string, Subscriber>()
  const dlq = new DeadLetterQueue()
  const queue: QueueAdapter = config.queue ?? new MemoryQueue()

  let deliveredCount = 0
  let failedCount = 0

  function subscribe(endpoint: string, options: SubscribeOptions): Subscriber {
    const sub: Subscriber = {
      id: `sub_${generateId()}`,
      endpoint,
      secret: options.secret,
      events: options.events,
    }
    subscribers.set(sub.id, sub)
    return sub
  }

  function unsubscribe(id: string): void {
    subscribers.delete(id)
  }

  function matchesEvent(sub: Subscriber, eventName: string): boolean {
    if (!sub.events) return true
    return sub.events.includes(eventName)
  }

  async function deliver(
    endpoint: string,
    secret: string,
    event: WebhookEvent,
    subscriberId: string,
  ): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = {
      id: `del_${generateId()}`,
      subscriberId,
      endpoint,
      event,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await sleep(calculateBackoff(attempt - 1))

      delivery.attempts = attempt + 1

      try {
        const body = JSON.stringify(event)
        const headers = await buildSignatureHeaders(body, secret)

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body,
          signal: AbortSignal.timeout(timeout),
        })

        if (res.ok) {
          delivery.status = 'delivered'
          delivery.statusCode = res.status
          delivery.completedAt = Date.now()
          deliveredCount++
          config.onDelivery?.(delivery)
          return delivery
        }

        delivery.statusCode = res.status
        delivery.error = `HTTP ${res.status}`
      } catch (err) {
        delivery.error = err instanceof Error ? err.message : String(err)
      }
    }

    // exhausted retries
    delivery.status = 'failed'
    delivery.completedAt = Date.now()
    failedCount++

    const entry: DlqEntry = {
      id: `dlq_${generateId()}`,
      subscriberId,
      endpoint,
      secret,
      event,
      error: delivery.error ?? 'Unknown error',
      failedAt: delivery.completedAt,
      attempts: delivery.attempts,
      statusCode: delivery.statusCode,
    }
    dlq.add(entry)
    config.onFailure?.(entry)

    return delivery
  }

  async function send(event: WebhookEvent): Promise<WebhookDelivery[]> {
    const matching = [...subscribers.values()].filter((sub) => matchesEvent(sub, event.event))
    return Promise.all(matching.map((sub) => deliver(sub.endpoint, sub.secret, event, sub.id)))
  }

  async function retryDlqEntry(id: string): Promise<WebhookDelivery> {
    const entry = dlq.get(id)
    if (!entry) throw new Error(`DLQ entry not found: ${id}`)

    dlq.remove(id)
    failedCount--

    return deliver(entry.endpoint, entry.secret, entry.event, entry.subscriberId)
  }

  function stats(): SenderStats {
    return {
      subscribers: subscribers.size,
      pending: queue.size(),
      delivered: deliveredCount,
      failed: failedCount,
      dlqSize: dlq.size(),
    }
  }

  return {
    subscribe,
    unsubscribe,
    send,
    dlq: {
      list: () => dlq.list(),
      retry: retryDlqEntry,
      purge: () => dlq.purge(),
    },
    stats,
  }
}
