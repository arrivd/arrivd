import { buildSignatureHeaders, signPayload, verifyPayload } from './signer'
import { describe, expect, test } from 'bun:test'

describe('signPayload', () => {
  test('returns sha256=<hex> signature', async () => {
    const sig = await signPayload('{"test":true}', 'secret')

    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  test('produces consistent signatures for same input', async () => {
    const sig1 = await signPayload('hello', 'secret')
    const sig2 = await signPayload('hello', 'secret')

    expect(sig1).toBe(sig2)
  })

  test('produces different signatures for different secrets', async () => {
    const sig1 = await signPayload('hello', 'secret1')
    const sig2 = await signPayload('hello', 'secret2')

    expect(sig1).not.toBe(sig2)
  })
})

describe('verifyPayload', () => {
  test('returns true for valid signature', async () => {
    const sig = await signPayload('hello', 'secret')
    const valid = await verifyPayload('hello', 'secret', sig)

    expect(valid).toBe(true)
  })

  test('returns false for tampered payload', async () => {
    const sig = await signPayload('hello', 'secret')
    const valid = await verifyPayload('tampered', 'secret', sig)

    expect(valid).toBe(false)
  })

  test('returns false for wrong secret', async () => {
    const sig = await signPayload('hello', 'secret')
    const valid = await verifyPayload('hello', 'wrong', sig)

    expect(valid).toBe(false)
  })

  test('returns false for malformed signature', async () => {
    const valid = await verifyPayload('hello', 'secret', 'not-a-signature')

    expect(valid).toBe(false)
  })
})

describe('buildSignatureHeaders', () => {
  test('returns signature and timestamp headers', async () => {
    const headers = await buildSignatureHeaders('{"test":true}', 'secret')

    expect(headers['x-webhook-signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
    expect(headers['x-webhook-timestamp']).toMatch(/^\d+$/)
  })

  test('timestamp is current epoch ms', async () => {
    const before = Date.now()
    const headers = await buildSignatureHeaders('test', 'secret')
    const after = Date.now()
    const ts = Number(headers['x-webhook-timestamp'])

    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})
