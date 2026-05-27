# Docs Rewrite — Design Spec

> 2026-05-27. Rewrite all repo documentation: separate usage from architecture, caveman style, concise.

## Decision summary

- **Approach A: Clean split** — 5 files, each with one audience and one purpose.
- Addon README = consumer-facing (npm listing page).
- Relay README = self-contained deploy guide.
- `docs/architecture.md` = internals for contributors.
- CLAUDE.md = dev workflow + gotchas only.
- Root README = monorepo orientation + links.

## Files to create/rewrite

### 1. Root `README.md`

**Audience:** Anyone landing on the GitHub repo.
**Purpose:** Orientation — what this is, link to each package, license.

Content:
- Title + one-line description
- What it does (2 sentences max)
- Links: addon README (install + usage), relay README (deploy), architecture doc
- License

~20 lines. No install, no config, no architecture.

### 2. `packages/addon/README.md`

**Audience:** Slidev users adding the addon to their deck.
**Purpose:** Everything a consumer needs. This is the npm listing page.

Content:
- Title + one-liner
- Requirements (Slidev >= 52.15.0, CF account)
- Install (`pnpm add -D`)
- Frontmatter config (relayUrl, talkId — table)
- Mark a block dynamic (syntax + id rules)
- Click-stepped line reveal (v0.2.0 — state machine table, caveats, unsupported combos)
- Using during a talk (presenter URL, audience URL, what to expect)
- Connection badge (glyph table — presenter-only)
- Copy button
- Reset via admin route (brief + link)
- Admin route (`/dynamic-code-admin`)
- Theme integration (2-3 sentences)
- Persistence semantics (bullet list)
- Multiple decks / one relay (brief)
- Pre-talk runbook (5-step checklist)
- Troubleshooting table
- Limitations
- License

Moves OUT vs current: architecture section, relay deploy instructions (link to relay README), ASCII diagram.

Tone: concise, no fluff, but readable for external consumers. Not literally caveman (no dropped articles in user-facing docs).

### 3. `packages/relay/README.md` (NEW)

**Audience:** Someone deploying the relay Worker.
**Purpose:** Self-contained deploy guide. No addon usage knowledge needed.

Content:
- Title + one-liner
- Requirements (CF account free tier, pnpm)
- Auth (wrangler login vs headless env vars)
- Deploy (`wrangler deploy`, copy URL)
- Set presenter token (`wrangler secret put`)
- Verify (curl 426 check)
- Multiple decks (one relay serves many)
- Env vars reference table (`PRESENTER_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)

~60-80 lines.

### 4. `docs/architecture.md` (NEW)

**Audience:** Contributors, curious users, future maintainers.
**Purpose:** How the system works end-to-end.

Content:
- One-sentence summary
- ASCII diagram (presenter ↔ relay ↔ audience)
- Build-time pipeline (transformer → hash → emit `<DynamicCode>`)
- Runtime flow (setup/main.ts → component registration → WS → sync context)
- Component internals (shiki `<pre>` + textarea overlay, debounced broadcast)
- WS protocol (wire types, message format)
- Origin hash mechanism (sha256→12hex, stale-state safety)
- Persistence (DO SQLite, keyed talkId+blockId)
- Click-reveal state machine (reveal → final → unlock)
- Security model (token validation, read-only audience WS)

~100-120 lines.

### 5. `CLAUDE.md`

**Audience:** AI assistants and developers working on the codebase.
**Purpose:** Dev workflow, conventions, gotchas. No architecture, no consumer usage.

Content:
- What (1-2 sentence summary)
- Repo shape (monorepo, two packages)
- Key files (tree listing — keep current)
- Critical conventions (6 bullets — slidev floor, default export, `:deep()`, textarea metrics, CSS vars, origin hash, manual id)
- Commands (pnpm, wrangler, headless auth)
- Release process (tag-driven)
- Conventional commits
- Test layout (addon vitest, relay miniflare, no e2e in CI)
- CI (ci.yml + release.yml)
- Gotchas (pnpm 11, slidev import guard, npm tokens, wrangler, local testing)
- Consumer pattern (frontmatter snippet)
- Out of scope (5 items)
- Pointer: `Architecture: docs/architecture.md`

Moves OUT: architecture section, ASCII diagram.

## Constraints

- No content loss — every piece of info in current docs must land somewhere in the new structure.
- Addon README stays the npm listing README (package.json already points to it or defaults to package root).
- Caveman style in CLAUDE.md and docs/architecture.md. Normal professional tone in consumer READMEs.
- Existing `docs/superpowers/` specs/plans untouched.
