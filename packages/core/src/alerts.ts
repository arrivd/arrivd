import type { AlertConfig, ArrivdEvent } from './types'

// ── Alert Router ──

export async function sendAlert(config: AlertConfig, event: ArrivdEvent): Promise<void> {
  const promises: Promise<void>[] = []

  if (config.slack) promises.push(sendSlack(config.slack.webhookUrl, event))
  if (config.webhook) promises.push(sendWebhook(config.webhook.url, event, config.webhook.secret))

  await Promise.allSettled(promises)
}

// ── Slack ──

async function sendSlack(webhookUrl: string, event: ArrivdEvent): Promise<void> {
  const icon = event.status === 'fail' ? '🔴' : event.status === 'warn' ? '🟡' : '🟢'
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      text: `${icon} *arrivd* — ${event.channel}: ${event.message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${icon} *arrivd — ${event.channel}*\n${event.message}`,
          },
        },
        ...(event.details
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `\`\`\`${JSON.stringify(event.details, null, 2)}\`\`\``,
                },
              },
            ]
          : []),
      ],
    }),
  })
}

// ── Webhook ──

async function sendWebhook(url: string, event: ArrivdEvent, secret?: string): Promise<void> {
  const body = JSON.stringify(event)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (secret) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ])
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    headers['x-arrivd-signature'] = Buffer.from(sig).toString('hex')
  }

  await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) })
}
