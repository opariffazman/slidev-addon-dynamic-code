# Docs Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all repo documentation into a clean 5-file split — each file serves one audience, one purpose.

**Architecture:** Root README = monorepo orientation. Addon README = consumer usage (npm listing). Relay README = self-contained deploy guide. `docs/architecture.md` = system internals for contributors. CLAUDE.md = dev workflow + gotchas only. Caveman style for CLAUDE.md + architecture; professional tone for consumer READMEs.

**Tech Stack:** Markdown

**Spec:** `docs/superpowers/specs/2026-05-27-docs-rewrite-design.md`

---

### Task 1: Rewrite root `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite `README.md`**

Replace entire contents with:

```markdown
# slidev-addon-dynamic-code

Live-editable code blocks for [Slidev](https://sli.dev) presentations. Presenter edits code on a slide mid-talk, every audience browser updates in real time.

## Packages

| Package | Purpose | Docs |
|---------|---------|------|
| [`packages/addon`](packages/addon) | Slidev addon — install into your deck | [Usage & setup](packages/addon/README.md) |
| [`packages/relay`](packages/relay) | Cloudflare Worker relay — deploy once | [Deploy guide](packages/relay/README.md) |

## How it works

See [Architecture](docs/architecture.md) for the full build-time → runtime → WebSocket flow.

## License

MIT © opariffazman
```

- [ ] **Step 2: Verify links are valid**

Run:
```bash
ls packages/addon/README.md packages/relay/README.md docs/architecture.md 2>&1
```

Expected: no "No such file" for addon/relay (relay README created in Task 3, architecture in Task 4 — if running sequentially, verify after those tasks). Addon README already exists.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite root README as monorepo orientation page"
```

---

### Task 2: Rewrite `packages/addon/README.md`

**Files:**
- Modify: `packages/addon/README.md`

- [ ] **Step 1: Rewrite `packages/addon/README.md`**

Replace entire contents with:

```markdown
# slidev-addon-dynamic-code

Live-editable code blocks for [Slidev](https://sli.dev) presentations. Edit a snippet on the slide during a talk, and every audience browser updates within a second — no rebuild, no reload.

Static-build friendly: works on Cloudflare Pages, Netlify, GitHub Pages, or any plain HTML host.

## Requirements

- Slidev `>= 52.15.0` (uses the `codeblocks` transformer API)
- A Cloudflare account (free tier is enough) — see the [relay deploy guide](../relay/README.md)

## Install

```bash
pnpm add -D slidev-addon-dynamic-code
```

Add the addon and config to your deck's `slides.md` frontmatter:

```yaml
---
addons:
  - slidev-addon-dynamic-code
dynamicCode:
  relayUrl: https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev
  talkId: my-talk-2026-05
---
```

| Key | Required | Value |
|-----|----------|-------|
| `relayUrl` | yes | URL printed by `wrangler deploy` ([relay deploy guide](../relay/README.md)). `http://` / `https://` are converted to `ws://` / `wss://` at runtime. |
| `talkId` | yes | Any stable string per deck. Edits persist in a Durable Object keyed by this id — change it for a fresh slate. |

## Mark a code block dynamic

````md
```bash {dynamic id=lab15-deploy}
npx wrangler deploy
curl https://api.example.com/health
```
````

Rules:

- `id=` is **required**. Use stable, descriptive names like `lab15-deploy`, `install-deps`, `run-tests`.
- Ids must be unique **across the whole deck** (build error otherwise).
- Allowed characters: `[a-zA-Z0-9_-]`.

The block renders normally for everyone until the presenter starts editing.

### Click-stepped line reveal (since v0.2.0)

Combine `{dynamic}` with Slidev's [line-highlight grammar](https://sli.dev/features/line-highlighting) to walk through a snippet click-by-click, then edit live:

````md
```bash {dynamic id=install-walkthrough} {2-3|5|all}
mkdir my-app
cd my-app
npm init -y
npm install express
npm start
```
````

| Phase | Trigger | Highlight | Textarea |
|-------|---------|-----------|----------|
| Reveal | each click advances to next step | highlighted lines for that step | read-only, edits do not sync |
| Final | last step in `{...\|...\|...}` | last range item (`all` above) | editable for presenter; edits broadcast |

Unlocking is automatic at the last reveal step.

**Caveat — editing then navigating back.** If you edit the block then click backward into the reveal phase, line-highlight ranges are reapplied to the edited content. If your edit changed line count, highlighted lines may mis-align. Switch slides and return to reset.

**Graceful degrade.** Environments without `useSlideContext().$clicksContext` (old Slidev, admin route) fall back to immediate edit mode.

**Not yet supported on dynamic blocks** (warned at build time):

- `{at:N}` — pinned reveal start
- `{lines:true}` / `{startLine:N}` — line numbering
- `{maxHeight:'…'}` — scrollable area
- Magic Move

## Using during a talk

- **Presenter:** `https://your-deck.example.com/?presenter=YOUR_TOKEN`
- **Audience:** `https://your-deck.example.com/`

Click into any `{dynamic}` block — caret appears, blue focus ring — type freely. Audience sees edits in ~1 second (200 ms debounce).

## Connection badge

Presenter-only indicator, top-right of each dynamic block:

| Glyph | Status | Meaning |
|-------|--------|---------|
| `●` | connected | Green. WebSocket open, edits flowing. |
| `◐` | reconnecting | Amber. Lost WS mid-talk; retrying (1 s → 30 s backoff). |
| `○` | offline | Amber. Couldn't connect on first try; retrying. |
| `⚠` | rejected | Red. 401 — presenter token doesn't match. |

## Copy button

Clipboard icon (top-right on hover) copies the currently displayed content. Available to both presenter and audience.

## Admin route

`https://your-deck.example.com/dynamic-code-admin?presenter=YOUR_TOKEN`

Shows every block id in the Durable Object for this `talkId`, with per-row **Reset** buttons and a **Reset all** button. Useful before a fresh run-through.

## Theme integration

The addon reuses Slidev's `slidev-code-wrapper` + `slidev-code` classes, so background, padding, border-radius, font, and margin follow your active theme. Syntax highlighting uses Shiki dual themes and respects Slidev's dark mode toggle. Caret colour tracks `--shiki-light` / `--shiki-dark`.

## Persistence

- Edits persist in the Durable Object's SQLite, keyed by `(talkId, blockId)`.
- Survives Worker redeploys, DO hibernation, audience refreshes.
- Reset via admin route (per-block or reset-all).
- Changed fenced source → origin hash changes → DO entry auto-invalidated on next presenter edit.
- To wipe state: change `talkId` and redeploy. Old DO storage stays orphaned but doesn't bill while hibernated.

## Multiple decks

One relay serves any number of decks. Each deck sets a unique `talkId` and points at the same `relayUrl`. The Durable Object instance is keyed by `talkId`.

Single `PRESENTER_TOKEN` works across all talks. For per-talk tokens, extend the Worker — see `packages/relay/src/index.ts`.

## Pre-talk runbook

Five minutes before going live:

1. **Deploy the deck** (`slidev build` + your static host's deploy).
2. **Visit the audience URL** on a second device / incognito. Confirm dynamic blocks render like normal code blocks.
3. **Visit the presenter URL** with `?presenter=YOUR_TOKEN`. Confirm the `●` badge appears.
4. **Type into a dynamic block.** Audience window reflects the change within ~1 second.
5. **Visit `/dynamic-code-admin?presenter=YOUR_TOKEN`.** Confirm "Reset all" works.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Build error `missing required id=NAME on slide N` | Forgot `id=` | Add `id=stable-name` |
| Build error `duplicate id "X" on slides N and M` | Same id on two slides | Rename one |
| Build error `dynamicCode.relayUrl is required` | Missing frontmatter config | Add `dynamicCode: { relayUrl, talkId }` |
| No `●` badge in presenter mode | `?presenter=…` not in URL, or transformer didn't fire | Check URL query; inspect for `<DynamicCode>` in DevTools |
| Badge shows `⚠` (red) | Wrong presenter token | Re-check `wrangler secret put PRESENTER_TOKEN` |
| Badge shows `○` and never advances | Relay URL typo, Worker not deployed | `curl -i https://YOUR-RELAY.workers.dev/sub?talk=test` should return 426 |
| Edits not propagating, badge is `●` | Audience on stale cache or different `talkId` | Hard-reload audience |
| Edit appears then disappears on refresh | Origin hash mismatch — fenced source changed between builds | Confirm same deployment |
| Block looks like plain text | Slidev < 52.15.0 | Bump `@slidev/cli` to `^52.15.2` |

## Limitations

- One presenter at a time — no conflict resolution.
- Display only — the slide does not execute code.
- 32 KiB per block content (server enforced).
- 200 block ids per `talkId` (server enforced).
- Free-tier Worker handles a few hundred audience devices per talk.

## License

MIT © opariffazman
```

- [ ] **Step 2: Verify no content lost**

Cross-check against the current `packages/addon/README.md` (264 lines). Content that moved:
- "Deploy the relay" section → `packages/relay/README.md` (Task 3)
- "Architecture" section + ASCII diagram → `docs/architecture.md` (Task 4)
- "Why this exists" section → dropped (one-liner at top covers it)

Everything else should be present in the new version. Skim both files side-by-side to confirm.

- [ ] **Step 3: Commit**

```bash
git add packages/addon/README.md
git commit -m "docs(addon): rewrite README as consumer-only usage guide

Relay deploy instructions moved to packages/relay/README.md.
Architecture section moved to docs/architecture.md."
```

---

### Task 3: Create `packages/relay/README.md`

**Files:**
- Create: `packages/relay/README.md`

- [ ] **Step 1: Create `packages/relay/README.md`**

```markdown
# slidev-dynamic-code-relay

Cloudflare Worker + Durable Object that brokers live code edits between presenter and audience browsers. Deployed once, serves any number of [slidev-addon-dynamic-code](../addon/README.md) decks.

## Requirements

- A Cloudflare account (free tier is enough)
- pnpm (or npm/yarn)

## Clone and install

```bash
git clone https://github.com/opariffazman/slidev-addon-dynamic-code.git
cd slidev-addon-dynamic-code/packages/relay
pnpm install
```

## Authenticate

**With a browser** (interactive login):

```bash
pnpm wrangler login
```

**Headless** (no browser — CI, remote server):

```bash
export CLOUDFLARE_API_TOKEN="…"   # https://dash.cloudflare.com/profile/api-tokens (template: Edit Cloudflare Workers)
export CLOUDFLARE_ACCOUNT_ID="…"  # right sidebar on https://dash.cloudflare.com
```

## Deploy

```bash
pnpm wrangler deploy
```

Copy the printed URL (e.g. `https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev`) into your deck's `dynamicCode.relayUrl` frontmatter field.

## Set the presenter token

```bash
openssl rand -hex 16 | pnpm wrangler secret put PRESENTER_TOKEN
```

Or paste a strong random string at the prompt. **Save it** — it's write-only; you can't view it later, only rotate.

This token is used as `?presenter=TOKEN` in URLs to authenticate the presenter.

## Verify

```bash
curl -i "https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev/sub?talk=ping"
# Expect: HTTP/2 426 (expected websocket upgrade) — proves Worker + DO routing are live.
```

## Multiple decks

One relay serves any number of decks. Each deck sets a unique `dynamicCode.talkId` in its frontmatter. The Durable Object instance is keyed by `talkId`, so edits are isolated per deck.

Single `PRESENTER_TOKEN` works across all talks on this relay.

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `PRESENTER_TOKEN` | Worker secret (`wrangler secret put`) | Authenticates presenter WebSocket connections |
| `CLOUDFLARE_API_TOKEN` | Shell env (headless only) | Authenticates wrangler CLI to Cloudflare API |
| `CLOUDFLARE_ACCOUNT_ID` | Shell env (headless only) | Identifies your Cloudflare account |

## License

MIT © opariffazman
```

- [ ] **Step 2: Commit**

```bash
git add packages/relay/README.md
git commit -m "docs(relay): add self-contained deploy guide README"
```

---

### Task 4: Create `docs/architecture.md`

**Files:**
- Create: `docs/architecture.md`

- [ ] **Step 1: Create `docs/architecture.md`**

```markdown
# Architecture

> Caveman style: fragments OK, no fluff. Code/paths normal.

Build-time codeblock transformer emits `<DynamicCode>` Vue component (lz-encoded fenced + origin-hash); runtime component overlays invisible textarea on shiki `<pre>`, syncs via WS to Durable Object keyed by `talkId`; audience subscribes, presenter publishes, DO broadcasts + persists.

## System diagram

```
                    ┌──────────────────────────────────────────┐
                    │  Cloudflare Worker                       │
                    │   slidev-dynamic-code-relay              │
                    │    ─ /pub?talk=X&token=…  (presenter WS) │
                    │    ─ /sub?talk=X          (audience WS)  │
                    │  TalkDO (Durable Object, one per talkId) │
                    │    ─ SQLite: blocks(id, hash, content)   │
                    │    ─ WS hibernation API                  │
                    └─────────────▲────────────────▲───────────┘
                                  │                │
            broadcasts            │                │  snapshot on connect
            updates               │                │  + live updates
                                  │                │
                  ┌───────────────┴──────┐   ┌─────┴──────────────────────┐
                  │ Presenter browser    │   │ Audience browser(s)        │
                  │  ?presenter=TOKEN    │   │  (no query)                │
                  │  <DynamicCode>       │   │  <DynamicCode>             │
                  │   editable textarea  │   │   readonly                 │
                  └──────────────────────┘   └────────────────────────────┘
```

## Build-time pipeline

1. `setup/transformers.ts` defines `codeblocks` transformer (Slidev `CodeblockTransformer` API, requires >= 52.15.0).
2. Transformer matches `{dynamic id=…}` in fenced block info string via `lib/parse-directive.ts`.
3. `lib/registry.ts` enforces unique ids across deck. Build throws on missing id or duplicate.
4. `lib/hash.ts` computes origin hash: `sha256(trim(fenced)).slice(0, 12)` — 12-char hex.
5. `lib/emit.ts` emits `<DynamicCode id="…" lang="…" origin-hash="…" code-lz="…" />`. Content lz-string compressed (base64). Optional `:ranges` prop for click-reveal steps.

## Runtime flow

1. `setup/main.ts` (`defineAppSetup`): registers `DynamicCode` component globally, reads `dynamicCode` config from frontmatter (`lib/read-config.ts`), detects presenter mode from `?presenter=` URL param, creates `SyncClient` instance, provides sync context via Vue inject/provide (`components/sync-key.ts`).
2. One `SyncClient` per page. Connects to relay WS. Multiplexes all blocks on that page.
3. On connect: relay sends `snapshot` with all persisted blocks. Client merges into local state.

## Component internals (`DynamicCode.vue`)

- Renders shiki-highlighted `<pre>` via `codeToHtml()` (dual theme: vitesse-light/dark).
- Transparent `<textarea>` overlaid on `<pre>` — same font metrics (enforced via CSS `!important`).
- Presenter: textarea editable. Edits debounced 200 ms → `SyncClient.broadcastEdit(id, hash, content)`.
- Audience: textarea readonly. Updates from WS applied if origin hash matches compiled hash (stale-state safety).
- Connection badge (presenter-only): `●` connected, `◐` reconnecting, `○` offline, `⚠` rejected.
- Copy button: copies currently displayed content to clipboard.

## WS protocol

JSON over WebSocket. Types defined in `lib/protocol.ts`.

**Client → Server (`ClientMessage`):**

| `t` | Fields | Who sends |
|-----|--------|-----------|
| `edit` | `id`, `hash`, `content` | presenter |
| `reset` | `id` | presenter |
| `reset_all` | — | presenter |

**Server → Client (`ServerMessage`):**

| `t` | Fields | When |
|-----|--------|------|
| `snapshot` | `blocks: Record<string, {hash, content}>` | on WS connect |
| `update` | `id`, `hash` (nullable), `content` (nullable) | after edit or reset |
| `error` | `code`, `message` | content_too_large, too_many_blocks |

## Origin hash mechanism

- Hash = first 12 hex chars of SHA-256 of trimmed fenced content. Embedded at build time as `origin-hash` prop.
- Presenter sends hash with every edit. DO stores it alongside content.
- Audience client compares incoming `update.hash` against compiled `origin-hash`. Mismatch → ignore update (stale build).
- DO: if incoming edit hash differs from stored hash, overwrites (deck was redeployed with new content).

## Persistence (Durable Object)

- `TalkDO` extends `DurableObject`. One instance per `talkId` (keyed via `idFromName`).
- SQLite table: `blocks(id TEXT PK, hash TEXT, content TEXT, updated_at INTEGER)`.
- Limits: 32 KiB per block content, 200 blocks per talk.
- WS hibernation API — DO sleeps between messages, no billing while idle.
- Reset: delete row(s) from SQLite, broadcast `update` with null hash/content (per-block) or `reset_all_done` (all).

## Click-reveal state machine

Combines `{dynamic}` with Slidev line-highlight grammar `{2-3|5|all}`.

| Phase | Highlight | Textarea | Sync |
|-------|-----------|----------|------|
| Reveal (steps 0..n-1) | ranges for current step | read-only | no |
| Final (step n) | last range | editable (presenter) | yes |

- Uses `useSlideContext().$clicksContext` to track current step.
- Graceful degrade: no `$clicksContext` → immediate edit mode.
- Navigating backward after editing reapplies original ranges to edited content — may mis-align if line count changed.

## Security model

- `/pub` route requires `?token=` matching Worker secret `PRESENTER_TOKEN`. 401 on mismatch.
- `/sub` route open — audience is read-only (DO tags WS as `audience`, ignores non-presenter messages).
- No CORS needed — WebSocket upgrade bypasses preflight.
- Token travels in URL query param (not header) — acceptable for WS; logged in Worker but not cached by browsers.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add architecture reference (internals for contributors)"
```

---

### Task 5: Rewrite `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite `CLAUDE.md`**

Replace entire contents with:

```markdown
# CLAUDE.md

Project memory for [slidev-addon-dynamic-code](https://github.com/opariffazman/slidev-addon-dynamic-code).

> Caveman style: fragments OK, no fluff. Code/commands/paths normal.

## What

Slidev addon. Live-edit code blocks during talk. Edits broadcast to audience browsers via CF Worker + Durable Object relay. Static-build friendly (CF Pages etc.).

Architecture: [docs/architecture.md](docs/architecture.md)

## Repo shape

pnpm monorepo. Two packages:

- `packages/addon/` — npm pkg `slidev-addon-dynamic-code` (Vue 3 + Shiki + WS client)
- `packages/relay/` — CF Worker (private, deploy-only) `slidev-dynamic-code-relay`

## Key files

```
packages/addon/
├── components/DynamicCode.vue       # textarea overlay on shiki <pre> — the main UX
├── components/AdminPage.vue         # /dynamic-code-admin route
├── components/sync-key.ts           # InjectionKey for sync ctx
├── composables/sync-client.ts       # WS client w/ exp backoff + queue
├── composables/useSync.ts           # Vue composable wrapping SyncClient
├── lib/hash.ts                      # sha256→12hex
├── lib/parse-directive.ts           # regex on info string
├── lib/emit.ts                      # <DynamicCode> HTML emission
├── lib/protocol.ts                  # WS wire types
├── lib/read-config.ts               # frontmatter resolver
├── lib/registry.ts                  # build-time dup-id check
├── setup/transformers.ts            # defineTransformersSetup → codeblocks: [...]
├── setup/main.ts                    # defineAppSetup → registers DynamicCode + provides sync
├── setup/routes.ts                  # /dynamic-code-admin
├── setup/shortcuts.ts               # pass-through (no custom shortcuts)
└── setup/context-menu.ts            # pass-through (no custom menu items)

packages/relay/
├── wrangler.jsonc                   # CF config (JSONC not TOML)
├── src/index.ts                     # Worker fetch: routes /pub /sub
├── src/talk-do.ts                   # TalkDO durable object (SQLite + WS hibernation)
└── test/*.test.ts                   # @cloudflare/vitest-pool-workers
```

## Critical conventions

- **Slidev floor: `^52.15.0`**. Older versions only support `preCodeblock` (MarkdownTransformer), not `codeblocks` (CodeblockTransformer). Addon emits `<DynamicCode>` via `codeblocks` → silently no-op on older slidev.
- **`#slidev/configs` is a DEFAULT export.** Not named. `import configs from '#slidev/configs'`. Got bit once.
- **`:deep()` only works in `<style scoped>`.** `DynamicCode.vue` uses unscoped style (to target v-html shiki output) → use plain descendant selectors, no `:deep()`. Got bit once → caused 0.1.2 caret drift regression.
- **Textarea + shiki metrics must match exactly.** Both elements need identical `font-family / font-size / line-height / font-feature-settings / font-variation-settings / letter-spacing / tab-size`. Any drift accumulates per char → caret floats away. Mirror slidev's own `ShikiEditor.vue` approach: one CSS rule with both selectors, `!important` to win specificity over slidev's `.slidev-code`.
- **Hardcoded fallbacks dropped from CSS.** Pull from slidev vars: `--slidev-code-padding`, `--slidev-code-radius`, `--slidev-code-font-family`, `--slidev-code-line-height`, etc. Container styling comes from `.slidev-code-wrapper` + `.slidev-code` classes (slidev's CSS does the heavy lifting). Caret color exception: `#000` light / `#fff` dark — `--shiki-light`/`--shiki-dark` don't cascade into the sibling textarea.
- **Origin hash = `sha256(trim(fenced)).slice(0, 12)`**. Embedded at build, sent w/ each edit. DO compares stored hash vs incoming — mismatch overwrites. Audience ignores incoming `update` if its compiled hash differs from msg hash.
- **Manual id required.** Auto-id (slide-no + nth) breaks on slide reorder. Build throws on missing id OR duplicate id across deck.

## Commands

From repo root:

```bash
pnpm install
pnpm test                                            # all packages
pnpm typecheck                                       # all packages
pnpm lint                                            # eslint . — antfu config
pnpm lint:fix
pnpm -F slidev-addon-dynamic-code test               # addon only
pnpm -F @opariffazman/slidev-dynamic-code-relay test # relay only (uses miniflare)
```

Relay local:

```bash
cd packages/relay
pnpm wrangler deploy --dry-run --outdir /tmp/dryrun  # validate wrangler.jsonc
pnpm wrangler dev                                    # local server on :8787
pnpm wrangler deploy                                 # ship to prod
pnpm wrangler secret put PRESENTER_TOKEN
```

Auth on headless server (no browser):

```bash
export CLOUDFLARE_API_TOKEN=...      # https://dash.cloudflare.com/profile/api-tokens (Edit Cloudflare Workers template)
export CLOUDFLARE_ACCOUNT_ID=...     # right sidebar on dash
```

## Release process

Tag-driven. CI publishes on `v*` tag push.

```bash
sed -i 's/"version": "0.X.Y"/"version": "0.X.Z"/' packages/addon/package.json
pnpm install                                         # update lockfile
git commit -am "chore(addon): bump to 0.X.Z"
git tag -a v0.X.Z -m "v0.X.Z — what changed"
git push --follow-tags
gh run watch                                         # confirm green
```

CI file: `.github/workflows/release.yml`. Uses `NPM_TOKEN` secret (granular, "All packages" scope until trusted-publishers gets set up).

## Conventional commits

`feat(addon|relay):` `fix(addon|relay):` `chore:` `docs:` `test:` `ci:` — kept by hand, no enforcement tool. Body wraps at ~78 cols. Co-author trailer optional.

## Test layout

- Addon: vitest + `@vue/test-utils` + `happy-dom` + `mock-socket`. Tests in `packages/addon/test/`.
- Relay: vitest w/ `@cloudflare/vitest-pool-workers`. Tests in `packages/relay/test/`. Isolated DO storage per test.
- No e2e in CI (Playwright lives at `e2e/` but only runs locally — needs `wrangler dev` + `slidev` running).

## CI

`.github/workflows/ci.yml` runs lint + typecheck + addon tests + relay tests on every push / PR. `release.yml` publishes on `v*` tag.

## Gotchas

- pnpm 11 dropped `package.json` `pnpm.onlyBuiltDependencies` — moved to `pnpm-workspace.yaml`. New format: `allowBuilds: { pkg: true }` AND `onlyBuiltDependencies: [pkg]`.
- pnpm 11 added `minimumReleaseAge` policy. Default cooldown blocks fresh-published packages for 24h. Add each new version of this addon to `minimumReleaseAgeExclude` in the consuming repo until 24h passes — or set `minimumReleaseAge: 0` workspace-wide to disable.
- Slidev 52.15.x added `slide-import-guard` plugin. Blocks `<img src="/abs/path">` in slide markdown. Use `:src="\`${$slidev.configs.base ?? '/'}path\`"` instead.
- For local testing into a consuming deck without npm publish: `pnpm pack --pack-destination /tmp/foo`, `cp /tmp/foo/*.tgz <deck>/vendor/`, `pnpm add -D file:./vendor/PKG.tgz`. Bump tarball name on each iteration (pnpm caches by file path).
- npm classic Automation tokens gone. Only granular tokens. First publish needs "All packages" scope (granular can't target nonexistent packages). After first publish, narrow to selected packages or set up Trusted Publishers (OIDC, no token).
- `wrangler.jsonc` preferred over `wrangler.toml` since wrangler 4. Both still work.
- Wrangler resets cwd after each command (claude-code shell quirk). Don't chain commands across cwd changes.

## Consumer pattern

```yaml
# slides.md frontmatter
addons:
  - slidev-addon-dynamic-code
dynamicCode:
  relayUrl: https://slidev-dynamic-code-relay.YOUR-SUBDOMAIN.workers.dev
  talkId: deck-name-2026
```

Presenter URL: `?presenter=TOKEN`. Audience: same URL without query. Token validated against Worker secret `PRESENTER_TOKEN`.

Block ids must be unique across deck. Talk ids namespace the DO instance — different decks under same relay can reuse block ids freely.

## Out of scope (do not add without strong reason)

- Multi-presenter / collaborative editing (last-write-wins is intentional).
- Code execution inside slide (display only; users run commands in their real terminal).
- VS Code extension integration.
- Per-keystroke history / undo across reloads.
- Themable connection badge (static glyphs are fine).
```

- [ ] **Step 2: Verify CLAUDE.md has no architecture section**

Confirm: no ASCII diagram, no "Architecture in 1 sentence" heading. Architecture pointer exists under "## What" section.

- [ ] **Step 3: Verify no content lost from old CLAUDE.md**

Cross-check old CLAUDE.md sections. Content moved out:
- "Architecture in 1 sentence" → `docs/architecture.md` (expanded)
- "Spec + plan live in `~/work/docs/superpowers/...`" → dropped (stale reference to external path, specs now live in-repo under `docs/superpowers/`)

Everything else retained.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite CLAUDE.md as dev workflow + gotchas only

Architecture moved to docs/architecture.md.
Removed stale external spec path reference."
```

---

### Task 6: Final cross-check

**Files:** All 5 doc files

- [ ] **Step 1: Verify all internal links resolve**

```bash
# From repo root — check that all linked files exist
for f in \
  packages/addon/README.md \
  packages/relay/README.md \
  docs/architecture.md \
  README.md \
  CLAUDE.md; do
  [ -f "$f" ] && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: all OK.

- [ ] **Step 2: Verify no content lost — exhaustive check**

Compare old addon README (264 lines) section-by-section against new locations:

| Old section | New location |
|-------------|-------------|
| Why this exists | addon README intro (condensed) |
| Requirements | addon README |
| Install | addon README |
| Mark a block dynamic | addon README |
| Click-stepped line reveal | addon README |
| Deploy the relay | relay README |
| Use it during a talk | addon README |
| Admin route | addon README |
| Connection badge | addon README |
| Theme integration | addon README |
| Persistence semantics | addon README |
| Multiple decks | addon README + relay README |
| Pre-talk runbook | addon README |
| Troubleshooting | addon README |
| Architecture + ASCII diagram | docs/architecture.md |
| Limitations | addon README |

Every section accounted for. No content dropped.

- [ ] **Step 3: Single final commit if any fixups needed**

```bash
git add -A
git diff --cached --stat
# If changes exist:
git commit -m "docs: fixup cross-references after docs rewrite"
# If no changes: skip
```
