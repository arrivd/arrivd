import { sendAlert } from './alerts'
import { createEvent } from './reporter'
import { describe, expect, mock, test } from 'bun:test'

describe('sendAlert', () => {
  test('sends to Slack webhook', async () => {
    const mockFetch = mock(() => Promise.resolve(new Response('ok')))
    globalThis.fetch = mockFetch as typeof fetch

    const event = createEvent('email', 'fail', 'SPF missing')
    await sendAlert({ slack: { webhookUrl: 'https://hooks.slack.com/test' } }, event)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://hooks.slack.com/test')
    expect(opts.method).toBe('POST')

    const body = JSON.parse(opts.body)
    expect(body.text).toContain('🔴')
    expect(body.text).toContain('email')
    expect(body.blocks).toBeArrayOfSize(1)
  })

  test('Slack includes details block when event has details', async () => {
    const mockFetch = mock(() => Promise.resolve(new Response('ok')))
    globalThis.fetch = mockFetch as typeof fetch

    const event = createEvent('email', 'fail', 'SPF missing', { domain: 'test.com' })
    await sendAlert({ slack: { webhookUrl: 'https://hooks.slack.com/test' } }, event)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.blocks).toHaveLength(2)
  })

  test('Slack uses correct icons per status', async () => {
    const mockFetch = mock(() => Promise.resolve(new Response('ok')))
    globalThis.fetch = mockFetch as typeof fetch

    await sendAlert({ slack: { webhookUrl: 'https://hooks.slack.com/test' } }, createEvent('email', 'pass', 'ok'))
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).text).toContain('🟢')

    await sendAlert({ slack: { webhookUrl: 'https://hooks.slack.com/test' } }, createEvent('email', 'warn', 'meh'))
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).text).toContain('🟡')
  })

  test('sends to webhook without signature', async () => {
    const mockFetch = mock(() => Promise.resolve(new Response('ok')))
    globalThis.fetch = mockFetch as typeof fetch

    const event = createEvent('email', 'fail', 'test')
    await sendAlert({ webhook: { url: 'https://example.com/hook' } }, event)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://example.com/hook')
    expect(opts.headers['x-arrivd-signature']).toBeUndefined()
  })

  test('sends to webhook with HMAC signature', async () => {
    const mockFetch = mock(() => Promise.resolve(new Response('ok')))
    globalThis.fetch = mockFetch as typeof fetch

    const event = createEvent('email', 'fail', 'test')
    await sendAlert({ webhook: { url: 'https://example.com/hook', secret: 'mysecret' } }, event)

    const opts = mockFetch.mock.calls[0][1]
    expect(opts.headers['x-arrivd-signature']).toBeDefined()
    expect(opts.headers['x-arrivd-signature']).toMatch(/^[a-f0-9]{64}$/)
  })

  test('sends to both Slack and webhook in parallel', async () => {
    const mockFetch = mock(() => Promise.resolve(new Response('ok')))
    globalThis.fetch = mockFetch as typeof fetch

    const event = createEvent('email', 'fail', 'test')
    await sendAlert(
      {
        slack: { webhookUrl: 'https://hooks.slack.com/test' },
        webhook: { url: 'https://example.com/hook' },
      },
      event,
    )

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('does not throw when no destinations configured', async () => {
    await sendAlert({}, createEvent('email', 'pass', 'test'))
  })

  test('does not throw when fetch fails', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('network'))) as typeof fetch
    await sendAlert({ slack: { webhookUrl: 'https://hooks.slack.com/test' } }, createEvent('email', 'fail', 'test'))
  })
})
