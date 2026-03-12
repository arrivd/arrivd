import type { Server } from 'bun'
import { createWebhookSender } from './sender'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

describe('createWebhookSender', () => {
  describe('subscribe', () => {
    test('registers a subscriber and returns it with a generated id', () => {
      const sender = createWebhookSender()
      const sub = sender.subscribe('https://example.com/hook', {
        secret: 'whsec_abc',
        events: ['user.created'],
      })

      expect(sub.id).toMatch(/^sub_/)
      expect(sub.endpoint).toBe('https://example.com/hook')
      expect(sub.secret).toBe('whsec_abc')
      expect(sub.events).toEqual(['user.created'])
    })

    test('subscriber with no events filter receives all events', () => {
      const sender = createWebhookSender()
      const sub = sender.subscribe('https://example.com/hook', { secret: 's' })

      expect(sub.events).toBeUndefined()
    })
  })

  describe('unsubscribe', () => {
    test('removes a subscriber', () => {
      const sender = createWebhookSender()
      const sub = sender.subscribe('https://example.com/hook', { secret: 's' })
      sender.unsubscribe(sub.id)

      expect(sender.stats().subscribers).toBe(0)
    })
  })

  describe('stats', () => {
    test('returns initial stats', () => {
      const sender = createWebhookSender()

      expect(sender.stats()).toEqual({
        subscribers: 0,
        pending: 0,
        delivered: 0,
        failed: 0,
        dlqSize: 0,
      })
    })

    test('tracks subscriber count', () => {
      const sender = createWebhookSender()
      sender.subscribe('https://a.com', { secret: 's1' })
      sender.subscribe('https://b.com', { secret: 's2' })

      expect(sender.stats().subscribers).toBe(2)
    })
  })
})

// ── Delivery Tests ──

describe('send', () => {
  let server: Server
  let requestLog: { body: string; headers: Record<string, string> }[]
  let shouldFail: boolean

  beforeAll(() => {
    requestLog = []
    shouldFail = false
    server = Bun.serve({
      port: 0,
      fetch(req) {
        if (shouldFail) return new Response('error', { status: 500 })
        return req.text().then((body) => {
          requestLog.push({
            body,
            headers: Object.fromEntries(req.headers.entries()),
          })
          return new Response('ok', { status: 200 })
        })
      },
    })
  })

  afterAll(() => {
    server.stop()
  })

  test('delivers to matching subscribers', async () => {
    requestLog = []
    const sender = createWebhookSender()
    sender.subscribe(`http://localhost:${server.port}`, {
      secret: 'test-secret',
      events: ['user.created'],
    })

    const deliveries = await sender.send({
      event: 'user.created',
      data: { id: 'usr_1' },
    })

    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].status).toBe('delivered')
    expect(deliveries[0].attempts).toBe(1)
    expect(requestLog).toHaveLength(1)
  })

  test('skips subscribers not matching event', async () => {
    requestLog = []
    const sender = createWebhookSender()
    sender.subscribe(`http://localhost:${server.port}`, {
      secret: 'test-secret',
      events: ['order.placed'],
    })

    const deliveries = await sender.send({
      event: 'user.created',
      data: {},
    })

    expect(deliveries).toHaveLength(0)
    expect(requestLog).toHaveLength(0)
  })

  test('subscriber with no events filter receives all events', async () => {
    requestLog = []
    const sender = createWebhookSender()
    sender.subscribe(`http://localhost:${server.port}`, { secret: 's' })

    const deliveries = await sender.send({
      event: 'anything',
      data: {},
    })

    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].status).toBe('delivered')
  })

  test('includes signature and timestamp headers', async () => {
    requestLog = []
    const sender = createWebhookSender()
    sender.subscribe(`http://localhost:${server.port}`, { secret: 'sig-test' })

    await sender.send({ event: 'test', data: {} })

    expect(requestLog[0].headers['x-webhook-signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
    expect(requestLog[0].headers['x-webhook-timestamp']).toMatch(/^\d+$/)
  })

  test('calls onDelivery callback on success', async () => {
    const delivered: unknown[] = []
    const sender = createWebhookSender({
      onDelivery: (d) => delivered.push(d),
    })
    sender.subscribe(`http://localhost:${server.port}`, { secret: 's' })

    await sender.send({ event: 'test', data: {} })

    expect(delivered).toHaveLength(1)
  })

  test('moves to DLQ after maxAttempts and calls onFailure', async () => {
    shouldFail = true
    const failures: unknown[] = []
    const sender = createWebhookSender({
      retry: { maxAttempts: 1 },
      onFailure: (e) => failures.push(e),
    })
    sender.subscribe(`http://localhost:${server.port}`, { secret: 's' })

    const deliveries = await sender.send({ event: 'test', data: {} })
    shouldFail = false

    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].status).toBe('failed')
    expect(sender.dlq.list()).toHaveLength(1)
    expect(failures).toHaveLength(1)
    expect(sender.stats().failed).toBe(1)
    expect(sender.stats().dlqSize).toBe(1)
  })

  test('fans out to multiple subscribers', async () => {
    requestLog = []
    const sender = createWebhookSender()
    sender.subscribe(`http://localhost:${server.port}`, { secret: 's1' })
    sender.subscribe(`http://localhost:${server.port}`, { secret: 's2' })

    const deliveries = await sender.send({ event: 'test', data: {} })

    expect(deliveries).toHaveLength(2)
    expect(requestLog).toHaveLength(2)
  })

  test('tracks delivery stats', async () => {
    requestLog = []
    const sender = createWebhookSender()
    sender.subscribe(`http://localhost:${server.port}`, { secret: 's' })

    await sender.send({ event: 'test', data: {} })

    expect(sender.stats().delivered).toBe(1)
  })
})

describe('dlq.retry', () => {
  test('retries a DLQ entry through the full delivery cycle', async () => {
    let failCount = 0
    const server = Bun.serve({
      port: 0,
      fetch() {
        failCount++
        if (failCount <= 1) return new Response('error', { status: 500 })
        return new Response('ok', { status: 200 })
      },
    })

    const sender = createWebhookSender({ retry: { maxAttempts: 1 } })
    sender.subscribe(`http://localhost:${server.port}`, { secret: 's' })

    // First send fails (maxAttempts: 1, server returns 500)
    await sender.send({ event: 'test', data: {} })
    expect(sender.dlq.list()).toHaveLength(1)
    expect(sender.stats().failed).toBe(1)

    // Retry — server now returns 200
    const dlqId = sender.dlq.list()[0].id
    const delivery = await sender.dlq.retry(dlqId)

    expect(delivery.status).toBe('delivered')
    expect(sender.dlq.list()).toHaveLength(0)
    expect(sender.stats().dlqSize).toBe(0)

    server.stop()
  })

  test('throws for unknown DLQ entry id', async () => {
    const sender = createWebhookSender()

    expect(sender.dlq.retry('nonexistent')).rejects.toThrow('DLQ entry not found')
  })
})
