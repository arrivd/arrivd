// ── Config ──

export interface WebhookSenderConfig {
  retry?: { maxAttempts?: number }
  timeout?: number
  onDelivery?: (delivery: WebhookDelivery) => void
  onFailure?: (entry: DlqEntry) => void
}

// ── Subscriber ──

export interface Subscriber {
  id: string
  endpoint: string
  secret: string
  events?: string[]
}

export interface SubscribeOptions {
  secret: string
  events?: string[]
}

// ── Events ──

export interface WebhookEvent {
  event: string
  data: unknown
}

// ── Delivery ──

export type DeliveryStatus = 'pending' | 'delivered' | 'failed'

export interface WebhookDelivery {
  id: string
  subscriberId: string
  endpoint: string
  event: WebhookEvent
  status: DeliveryStatus
  attempts: number
  statusCode?: number
  error?: string
  createdAt: number
  completedAt?: number
}

// ── DLQ ──

export interface DlqEntry {
  id: string
  subscriberId: string
  endpoint: string
  secret: string
  event: WebhookEvent
  error: string
  failedAt: number
  attempts: number
  statusCode?: number
}

// ── Stats ──

export interface SenderStats {
  subscribers: number
  pending: number
  delivered: number
  failed: number
  dlqSize: number
}

// ── Queue ──

export interface DeliveryJob {
  id: string
  subscriberId: string
  endpoint: string
  event: WebhookEvent
  secret: string
  attempt: number
}

export interface QueueAdapter {
  enqueue(job: DeliveryJob): void
  dequeue(): DeliveryJob | null
  size(): number
}

// ── Sender ──

export interface WebhookSender {
  subscribe(endpoint: string, options: SubscribeOptions): Subscriber
  unsubscribe(id: string): void
  send(event: WebhookEvent): Promise<WebhookDelivery[]>
  dlq: {
    list(): DlqEntry[]
    retry(id: string): Promise<WebhookDelivery>
    purge(): void
  }
  stats(): SenderStats
}
