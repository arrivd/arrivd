# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
bun install

# Build all packages (core first, then wrappers)
bun run build

# Lint and format (uses Biome)
bun run lint
bun run lint:fix
bun run format

# Type checking
bun run typecheck

# Run all tests
bun run test

# Clean build artifacts
bun run clean
```

## Architecture

**Bun-based monorepo** for arrivd — deliverability infrastructure for developers.

### Workspace Structure

- `packages/core` - `@arrivd/core` — Shared types, config, event reporting, alert routing
- `packages/email` - `@arrivd/email` — Email deliverability audit (SPF, DKIM, DMARC, BIMI, MTA-STS)
- `packages/hooks` - `@arrivd/hooks` — Outgoing webhook delivery with retry, signing, DLQ
- `packages/cron` - `@arrivd/cron` — Cron job monitoring with dead man's switch
- `packages/typescript-config` - `@arrivd/typescript-config` — Shared TypeScript configs

### Key Technologies

- **Package Manager**: Bun v1.2.0
- **Build**: tsup (ESM + CJS + DTS)
- **Language**: TypeScript 5.8+ (strict mode)
- **Testing**: bun test (bun:test)
- **Linting/Formatting**: Biome (no ESLint/Prettier)

### Package Exports

```typescript
import { auditDomain, formatReport } from '@arrivd/email'
import { createWebhookSender } from '@arrivd/hooks'
import { monitor } from '@arrivd/cron'
```

## Code Style (Biome)

- Single quotes, semicolons as needed, trailing commas
- 120 character line width, 2-space indentation
- Import groups: Node → Packages → @/** aliases → Relative paths

### Comments

- Keep comments minimal — only add them when they provide genuine value
- Use short section dividers to separate logical blocks (e.g. `// ── Types ──`, `// ── Helpers ──`)
- Use brief inline hints that explain *why* or *what region* something is, not *what the code does*
- Never add doc comments, JSDoc, or type annotations to code you didn't write
- TODO comments are acceptable for unimplemented placeholders, but avoid them in completed code

## Git

### Pre-commit Hooks

Husky + lint-staged auto-formats staged files on commit using Biome.
- Runs `biome check --write` on `*.{js,ts,jsx,tsx,json,css}`
- Blocks commit if there are unfixable errors

### Semantic Commit Messages

Format: <type>(<scope>): <subject>

Examples:
feat: (new feature for the user)
fix: (bug fix for the user)
docs: (changes to the documentation)
style: (formatting, no production code change)
refactor: (refactoring production code)
test: (adding/refactoring tests)
chore: (updating build/config)

Never add anything like Co-Authored-By: Claude ...
