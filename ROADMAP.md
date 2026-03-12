# arrivd Roadmap

## v0.1 — @arrivd/email MVP ✅

### CLI Audit (`npx arrivd check`)
- ✅ SPF record parsing, include chain resolution, lookup counting (max 10)
- ✅ DKIM selector discovery across 26 common selectors (batched: 6 priority + remaining in groups of 5)
- ✅ DMARC policy analysis with pct validation (0–100 range, invalid value detection)
- ✅ BIMI record check (logo URL, VMC certificate)
- ✅ MTA-STS DNS record + policy file fetch with mode validation
- ✅ A–F scoring engine with human-readable fix recommendations
- ✅ Colored terminal output with `arrivd fix` guided walkthroughs
- ✅ `--json` output for CI/CD pipelines, `--ci` flag for non-zero exit on D/F scores

### Programmatic API
- ✅ `auditDomain()` returns structured `DnsAuditResult` for programmatic use
- ✅ Pluggable resolver interface (node:dns + DNS-over-HTTPS via Cloudflare)
- ✅ Individual audit functions exported: `auditSpf`, `auditDkim`, `auditDmarc`, `auditBimi`, `auditMtaSts`

### Continuous Monitoring
- ✅ `createWatcher()` — polls DNS records on a schedule, diffs against previous state
- ✅ Concurrent poll guard (prevents overlapping polls)
- ✅ Snapshot pruning — stale domains removed from snapshot map on config change
- ✅ Score degradation alerts via Slack/webhook

### Core Infrastructure
- ✅ `@arrivd/core` — shared types, event reporter (local + cloud), alert routing
- ✅ CloudReporter with bounded buffer (max 1000 events), poison batch protection (max 3 retries)
- ✅ HMAC-SHA256 webhook signature for alert payloads
- ✅ Fetch timeouts on all outbound HTTP calls (alerts: 10s, DoH/MTA-STS: 5s)

### Security & Hardening
- ✅ GitHub Actions injection prevention (env var indirection in release workflow)
- ✅ SSRF guard on MTA-STS policy fetch (private/reserved IP blocklist)
- ✅ DoH response type guards (`Array.isArray`, string checks on parsed JSON)
- ✅ MTA-STS response size limit (100KB Content-Length check before body read)
- ✅ SPF recursion cap (max 20 total lookups across nested includes)

### RFC Compliance
- ✅ RFC 7489 — DMARC TXT record multi-string concatenation with space separator
- ✅ RFC 7208 — case-insensitive SPF version tag detection
- ✅ BIMI TXT record multi-string concatenation

### Test Coverage
- ✅ 51 tests across 4 test files (SPF: 16, DMARC: 15, DKIM: 13, Watch: 7)
- ✅ CI pipeline with Bun dependency caching

## v0.2 — Email Polish

### CLI Enhancements
- `arrivd check` multi-domain support (`arrivd check acme.io brand.com`)
- `arrivd check --watch` inline mode (runs check, then watches — single command)
- `arrivd check --format=table` compact tabular output for comparing multiple domains
- Progress spinner for slow DNS resolution (DoH fallback can take a few seconds)
- `--selector` flag to check a specific DKIM selector instead of scanning all common ones

### SPF Enhancements
- SPF flattener: resolve all `include:` chains and output a single flat record with IP addresses
- `arrivd fix spf` interactive mode — detect unused includes, suggest removals
- SPF record generator: answer a few questions, get a valid SPF record

### DKIM Enhancements
- Custom selector list via config file (`.arrivdrc` or `arrivd.config.ts`)
- DKIM key rotation detection — alert if the key changed but selector stayed the same
- Support `ed25519` key validation (not just `rsa`)

### DMARC Enhancements
- DMARC aggregate report (RUA) parser — `arrivd parse-rua report.xml.gz`
- DMARC alignment check against SPF and DKIM domains
- Subdomain policy (`sp=`) validation and recommendations

### Test Coverage
- Target >90% coverage on all DNS parsing modules
- Resolver failure/timeout tests (distinguish "no records" from "DNS broken")
- Integration tests against real domains (opt-in, not in CI)

## v0.3 — @arrivd/hooks Core ✅

### Core Sender
- ✅ `createWebhookSender()` factory with config for signing, retry, and DLQ
- ✅ HMAC-SHA256 payload signing (`signPayload`) with standard `x-webhook-signature` header
- ✅ `verifyPayload()` — timing-safe signature verification for incoming webhooks
- ✅ `buildSignatureHeaders()` — signature + timestamp headers for replay attack prevention
- ✅ Exponential backoff with multiplicative jitter (base-2: 1s → 2s → 4s → 8s → 16s, ×0.5–1.5)
- ✅ Configurable max retry attempts (default: 5)
- ✅ 10s fetch timeout with `AbortSignal` on all outbound deliveries

### Queue Adapters
- ✅ In-memory queue (default — zero infrastructure for getting started)
- ✅ Queue adapter interface (`QueueAdapter`) for custom implementations
- Redis adapter (recommended for production)
- BullMQ adapter (for teams already using BullMQ)

### Dead Letter Queue
- ✅ Failed deliveries moved to DLQ after max retries exhausted (max 1000 entries, FIFO eviction)
- ✅ `sender.dlq.list()`, `sender.dlq.retry(id)`, `sender.dlq.purge()`
- ✅ DLQ retry re-enters full retry cycle
- ✅ `onFailure` callback for alerting
- ✅ `onDelivery` callback for successful deliveries

### Subscriber Management
- ✅ `sender.subscribe()` — register endpoint with event filter and per-subscriber secret
- ✅ `sender.unsubscribe()` — remove endpoint
- ✅ Event fan-out — `send()` delivers to all subscribers matching the event name
- ✅ `sender.stats()` — subscriber count, delivered, failed, DLQ size
- URL ownership verification (Stripe-style challenge/response)
- Per-subscriber delivery stats

### Test Coverage
- ✅ 42 tests across 5 test files (signer: 9, backoff: 6, queue: 4, DLQ: 8, sender: 15)
- ✅ Integration tests with real HTTP via `Bun.serve`

### Framework Middleware
- Express router: `POST /subscribe`, `DELETE /:id`, `GET /:id/stats`, `POST /:id/retry`
- Next.js App Router handlers
- Hono middleware

## v0.4 — @arrivd/cron

### Job Wrapper
- ✅ `monitor(name, fn, options)` — wraps any async function with auto-reporting
- ✅ Reports start, end, fail, and duration to `@arrivd/core` reporter
- ✅ Captures error details on failure

### Dead Man's Switch
- ✅ Expected schedule declaration (cron expression)
- ✅ Alert if job doesn't check in within the expected window
- ✅ Configurable grace period

### Timeout Detection
- ✅ `timeout: '30m'` — alert if job exceeds expected duration
- Kill support (optional — terminate long-running jobs, requires AbortController)

### Framework Adapters
- Vercel Cron adapter (wraps `export default` handler)
- Cloudflare Workers scheduled handler adapter
- Generic Node.js `cron` / `node-cron` wrapper

## v0.5 — Dashboard & Paid Tier

### Cloud API
- Ingestion endpoint for events from all three modules (email, hooks, cron)
- API keys tied to project ID
- Event storage with configurable retention (7d free, 90d Pro, 1yr Team)

### Unified Dashboard
- "Did it arrive?" view — single page showing email auth status, webhook delivery rates, cron job health
- Historical delivery trends and score changes over time
- Filterable event log with search

### Status Pages
- Public status page generator (`status.example.arrivd.dev`)
- Shows uptime for webhook endpoints and cron job execution
- Embeddable status badge

### Billing
- Stripe integration for Pro ($29/mo) and Team ($79/mo) tiers
- Usage metering for webhook deliveries and cron check-ins
- Upgrade prompts when approaching free tier limits

## v0.6 — Docs & Growth

### Documentation Site
- Astro/Starlight docs at `arrivd.dev/docs`
- Getting started guides for each package
- API reference auto-generated from TypeScript types
- SEO landing pages for high-intent keywords ("check spf record", "dmarc check", "why are my emails going to spam")

### Content
- Blog post: "Check your email deliverability in 10 seconds"
- Blog post: "Stop reinventing webhook retry logic"
- Comparison pages: arrivd vs Svix, arrivd vs Cronitor, arrivd vs MXToolbox

### Launch
- Product Hunt submission
- Hacker News Show HN
- Twitter/X launch thread with CLI screenshots
- Add to awesome-developer-tools lists

## Ideas Backlog (Unscheduled)

### Email
- TLSA/DANE record validation
- Blacklist/blocklist checking (Spamhaus, Barracuda, etc.)
- Inbox placement testing via seed accounts (would require hosted infrastructure)
- SMTP banner verification
- Reverse DNS (PTR) validation for sending IPs

### Hooks
- Webhook replay from dashboard (re-send any historical delivery)
- Delivery latency percentiles (p50, p95, p99)
- Automatic endpoint health scoring (success rate over time)
- `@arrivd/hooks/verify` — receiver-side signature verification middleware
- Idempotency key support

### Cron
- Job dependency chains (job B runs only after job A succeeds)
- Execution history with stdout/stderr capture
- Cron expression validator and human-readable schedule display
- Overlap prevention (don't start a new run if previous is still running)

### Platform
- GitHub Action: `arrivd/check-action` — runs email audit in CI, comments on PR with score
- Terraform provider for managing monitored domains
- VS Code extension showing deliverability status in the status bar
- Slack bot: `/arrivd check acme.io` runs an audit inline