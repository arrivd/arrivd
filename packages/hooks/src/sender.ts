import { generateId } from '@arrivd/core'
import { DeadLetterQueue } from './dlq'
import { MemoryQueue } from './queue'
import type {
  QueueAdapter,
  SenderStats,
  SubscribeOptions,
  Subscriber,
  WebhookDelivery,
  WebhookEvent,
  WebhookSender,
  WebhookSenderConfig,
} from './types'

// ── Sender ──

export function createWebhookSender(config: WebhookSenderConfig = {}): WebhookSender {
  const subscribers = new Map<string, Subscriber>()
  const dlq = new DeadLetterQueue()
  const queue: QueueAdapter = config.queue ?? new MemoryQueue()

  const deliveredCount = 0
  const failedCount = 0

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

  async function send(_event: WebhookEvent): Promise<WebhookDelivery[]> {
    // stub — implemented in Task 7
    return []
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
      retry: async (_id: string): Promise<WebhookDelivery> => {
        // stub — implemented in Task 7
        throw new Error('Not implemented')
      },
      purge: () => dlq.purge(),
    },
    stats,
  }
}
