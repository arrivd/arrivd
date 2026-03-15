# Roadmap

## v0.1 — @arrivd/email MVP ✅

- SPF parsing with include chain resolution, lookup counting (max 10)
- DKIM discovery across 26 common selectors (batched: 6 priority + groups of 5)
- DMARC policy analysis with pct validation
- BIMI record check (logo URL, VMC certificate)
- MTA-STS DNS record + policy file fetch
- A-F scoring with fix recommendations
- CLI output with `arrivd fix` guided walkthroughs
- `--json` and `--ci` flags for pipelines
- `auditDomain()` structured API with pluggable resolver (node:dns + DoH)
- Individual audit functions: `auditSpf`, `auditDkim`, `auditDmarc`, `auditBimi`, `auditMtaSts`
- `createWatcher()` — scheduled DNS polling with concurrent poll guard and snapshot pruning
- `@arrivd/core` — types, event reporter (local + cloud), alert routing
- CloudReporter with bounded buffer (max 1000 events), poison batch protection (max 3 retries)
- SSRF guard on MTA-STS fetch, DoH response type guards, SPF recursion cap (max 20)
- RFC 7489 (DMARC), RFC 7208 (SPF) compliance
- 51 tests across 4 test files

## v0.2 — Email Polish

- Multi-domain CLI support
- `--watch` inline mode
- `--format=table` compact output
- `--selector` flag for specific DKIM selector
- SPF flattener — resolve includes to flat IP list
- SPF record generator
- DKIM key rotation detection, `ed25519` support
- DMARC RUA parser, alignment check, subdomain policy (`sp=`) validation
- Config file support (`.arrivdrc` or `arrivd.config.ts`)
- Target >90% coverage on DNS parsing modules

## v0.3 — @arrivd/hooks Core ✅

- `createWebhookSender()` factory with signing, retry, DLQ
- HMAC-SHA256 signing with `x-webhook-signature` header
- `verifyPayload()` — timing-safe verification
- `buildSignatureHeaders()` — signature + timestamp for replay prevention
- Exponential backoff with multiplicative jitter (base-2: 1s-16s, x0.5-1.5)
- 10s fetch timeout with `AbortSignal`
- In-memory queue with `QueueAdapter` interface
- DLQ — max 1000 entries, FIFO eviction, list/retry/purge
- Subscriber management with event filtering and per-subscriber secrets
- `sender.stats()` — counts for subscribers, delivered, failed, DLQ
- 42 tests across 5 test files

Upcoming:
- Redis and BullMQ queue adapters
- URL ownership verification (challenge/response)
- Per-subscriber delivery stats
- Framework middleware (Express, Next.js, Hono)

## v0.4 — @arrivd/cron ✅

- `monitor(name, fn, options)` — wraps async functions with auto-reporting
- Dead man's switch with configurable grace period
- Timeout detection (`timeout: '30m'`)
- Cron utilities: `nextRun`, `previousRun`, `parseDuration`

Upcoming:
- Kill support via AbortController
- Vercel Cron adapter
- Cloudflare Workers scheduled handler adapter
- `node-cron` wrapper

## v0.5 — Dashboard & Paid Tier

- Event ingestion endpoint for all three modules
- API keys tied to project ID
- Event storage — 7d free, 90d Pro, 1yr Team
- Unified "Did it arrive?" dashboard — email auth, webhook delivery, cron health
- Historical trends and searchable event log
- Public status page generator with embeddable badge
- Stripe billing — Pro ($29/mo), Team ($79/mo), usage metering

## v0.6 — Docs & Growth

- Astro/Starlight docs site at `arrivd.dev/docs`
- API reference auto-generated from TypeScript types
- SEO pages for high-intent keywords
- Blog posts, comparison pages
- Product Hunt, HN Show, Twitter launch

## Ideas Backlog

- Email: TLSA/DANE, blacklist checking, inbox placement testing, SMTP banner, reverse DNS
- Hooks: webhook replay, delivery latency percentiles, endpoint health scoring, idempotency keys
- Cron: job dependency chains, stdout/stderr capture, overlap prevention
- Platform: GitHub Action, Terraform provider, VS Code extension, Slack bot
