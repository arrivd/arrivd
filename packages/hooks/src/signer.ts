// ── Signer ──

const encoder = new TextEncoder()

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

export async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `sha256=${Buffer.from(sig).toString('hex')}`
}

export async function verifyPayload(payload: string, secret: string, signature: string): Promise<boolean> {
  if (!signature.startsWith('sha256=')) return false

  const expected = await signPayload(payload, secret)

  // timing-safe comparison
  if (expected.length !== signature.length) return false
  const a = encoder.encode(expected)
  const b = encoder.encode(signature)
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i]
  }
  return mismatch === 0
}

export async function buildSignatureHeaders(
  payload: string,
  secret: string,
): Promise<{ 'x-webhook-signature': string; 'x-webhook-timestamp': string }> {
  const signature = await signPayload(payload, secret)
  return {
    'x-webhook-signature': signature,
    'x-webhook-timestamp': String(Date.now()),
  }
}
