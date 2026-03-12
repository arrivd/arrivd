import { createWebhookSender } from './sender'
import { describe, expect, test } from 'bun:test'

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
